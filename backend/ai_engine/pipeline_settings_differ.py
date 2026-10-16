"""Pipeline Settings Differ & Detailed Change Inspector.

Performs fine-grained comparison of pipeline nodes, configurations, parameters,
and connections, capturing exact old-vs-new value changes for history tracking.
"""
from typing import Any, Dict, List, Optional, Tuple

IGNORED_DATA_KEYS = {
    "positions",
    "selected",
    "dragging",
    "width",
    "height",
    "measured",
    "isDirty",
    "isInvalid",
    "isPaused",
    "viewMode",
    "isTutorialMock",
    "resizing",
    "zIndex",
}

FIELD_LABELS: Dict[str, str] = {
    "label": "ชื่อโหนด (Label)",
    "confidenceThreshold": "ค่าความมั่นใจ (Confidence Threshold)",
    "confidenceThresholdEnabled": "เปิดใช้เกณฑ์ความมั่นใจ",
    "classFilter": "คลาสวัตถุที่ตรวจจับ (Class Filter)",
    "classFilterEnabled": "เปิดใช้การกรองคลาส",
    "roi": "กรอบพื้นที่ตรวจจับ (ROI Box)",
    "roiEnabled": "เปิดใช้พื้นที่ตรวจจับ (ROI)",
    "showRoi": "แสดงกรอบ ROI บนภาพสด",
    "target_count": "เป้าหมายการนับ (Target Count)",
    "actual": "จำนวนที่นับได้จริง (Actual Count)",
    "goal": "เป้าหมาย (Goal)",
    "entityId": "โมเดล AI / แหล่งข้อมูล",
    "modelPath": "พาธโมเดล (Model Path)",
    "bcm_pin": "พินฮาร์ดแวร์ BCM GPIO",
    "pin": "หมายเลขพิน",
    "active_high": "ระดับสัญญาณ Active Level",
    "pull_resistor": "ตัวต้านทาน Pull Resistor",
    "auto_off_ms": "หน่วงเวลาดับอัตโนมัติ (ms)",
    "baudrate": "ความเร็ว Baudrate",
    "serial_port": "พอร์ต Serial RS485",
    "triggerCondition": "เงื่อนไขเปรียบเทียบ (Condition)",
    "threshold": "ค่าเกณฑ์เปรียบเทียบ (Threshold)",
    "limit": "จำกัดอัตราความถี่ (Rate Limit)",
    "timeUnit": "หน่วยเวลา (Time Unit)",
    "commentText": "เนื้อหาข้อความโน้ต",
    "commentTheme": "ธีมสีโน้ต",
    "commentTitle": "หัวข้อโน้ต",
    "fontSize": "ขนาดตัวอักษร",
    "input_source": "ช่องสัญญาณภาพขาเข้า",
    "rtsp_url": "RTSP Stream URL",
}


def _clean_data(data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not isinstance(data, dict):
        return {}
    return {k: v for k, v in data.items() if k not in IGNORED_DATA_KEYS}


def _format_value(val: Any) -> Any:
    """Format complex values (like dictionaries or lists) for display."""
    if isinstance(val, (int, float, bool, str)) or val is None:
        return val
    if isinstance(val, dict):
        # Format compact ROI or object
        if all(k in val for k in ("x", "y", "w", "h")):
            return f"x:{val['x']}, y:{val['y']}, w:{val['w']}, h:{val['h']}"
        return val
    return val


def diff_pipeline_settings(
    old_nodes: List[Dict[str, Any]],
    old_edges: List[Dict[str, Any]],
    new_nodes: List[Dict[str, Any]],
    new_edges: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Compares two pipeline snapshots and returns an exhaustive diff

    including specific node setting modifications (old_value -> new_value).
    """
    old_map = {str(n.get("id")): n for n in old_nodes if isinstance(n, dict) and "id" in n}
    new_map = {str(n.get("id")): n for n in new_nodes if isinstance(n, dict) and "id" in n}

    old_ids = set(old_map.keys())
    new_ids = set(new_map.keys())

    added_node_ids = sorted(new_ids - old_ids)
    removed_node_ids = sorted(old_ids - new_ids)
    common_node_ids = sorted(old_ids & new_ids)

    added_nodes = []
    for nid in added_node_ids:
        n = new_map[nid]
        added_nodes.append({
            "id": nid,
            "type": n.get("type", "node"),
            "label": n.get("data", {}).get("label") or n.get("type", "Node"),
        })

    removed_nodes = []
    for nid in removed_node_ids:
        n = old_map[nid]
        removed_nodes.append({
            "id": nid,
            "type": n.get("type", "node"),
            "label": n.get("data", {}).get("label") or n.get("type", "Node"),
        })

    modified_nodes = []
    bullet_summaries = []

    for nid in common_node_ids:
        old_n = old_map[nid]
        new_n = new_map[nid]
        old_d = _clean_data(old_n.get("data", {}))
        new_d = _clean_data(new_n.get("data", {}))

        all_keys = sorted(set(old_d.keys()) | set(new_d.keys()))
        changes = []

        node_label = new_d.get("label") or old_d.get("label") or new_n.get("type", nid)

        for k in all_keys:
            old_val = old_d.get(k)
            new_val = new_d.get(k)
            if old_val != new_val:
                label = FIELD_LABELS.get(k, k)
                changes.append({
                    "field": k,
                    "label": label,
                    "old_value": _format_value(old_val),
                    "new_value": _format_value(new_val),
                })
                # Create concise bullet summary
                bullet_summaries.append(
                    f"โหนด '{node_label}': แก้ไข {label} จาก '{_format_value(old_val)}' เป็น '{_format_value(new_val)}'"
                )

        if changes:
            modified_nodes.append({
                "id": nid,
                "type": new_n.get("type", old_n.get("type", "node")),
                "label": node_label,
                "changes": changes,
            })

    # Compare edges
    def _edge_repr(e: Dict[str, Any], node_map: Dict[str, Dict[str, Any]]) -> Tuple[str, str, str]:
        src_id = str(e.get("source", ""))
        tgt_id = str(e.get("target", ""))
        src_name = node_map.get(src_id, {}).get("data", {}).get("label") or src_id
        tgt_name = node_map.get(tgt_id, {}).get("data", {}).get("label") or tgt_id
        return (src_id, tgt_id, f"{src_name} → {tgt_name}")

    old_edge_keys = {
        (str(e.get("source")), str(e.get("target")), str(e.get("sourceHandle") or ""), str(e.get("targetHandle") or "")): e
        for e in old_edges if isinstance(e, dict)
    }
    new_edge_keys = {
        (str(e.get("source")), str(e.get("target")), str(e.get("sourceHandle") or ""), str(e.get("targetHandle") or "")): e
        for e in new_edges if isinstance(e, dict)
    }

    added_edges = []
    for k, e in new_edge_keys.items():
        if k not in old_edge_keys:
            _, _, label = _edge_repr(e, new_map)
            added_edges.append({
                "source": k[0],
                "target": k[1],
                "label": label,
            })
            bullet_summaries.append(f"เพิ่มการเชื่อมต่อ: {label}")

    removed_edges = []
    for k, e in old_edge_keys.items():
        if k not in new_edge_keys:
            _, _, label = _edge_repr(e, old_map)
            removed_edges.append({
                "source": k[0],
                "target": k[1],
                "label": label,
            })
            bullet_summaries.append(f"ตัดการเชื่อมต่อ: {label}")

    for an in added_nodes:
        bullet_summaries.append(f"เพิ่มโหนดใหม่: {an['label']} ({an['type']})")
    for rn in removed_nodes:
        bullet_summaries.append(f"ลบโหนด: {rn['label']} ({rn['type']})")

    # Generate top-level summary headline
    headline_parts = []
    if modified_nodes:
        headline_parts.append(f"แก้ไข {len(modified_nodes)} โหนด")
    if added_nodes:
        headline_parts.append(f"เพิ่ม {len(added_nodes)} โหนด")
    if removed_nodes:
        headline_parts.append(f"ลบ {len(removed_nodes)} โหนด")
    if added_edges or removed_edges:
        headline_parts.append(f"ปรับเส้นเชื่อม ({len(added_edges)} เพิ่ม, {len(removed_edges)} ตัดออก)")

    summary_headline = ", ".join(headline_parts) if headline_parts else "ไม่มีการเปลี่ยนแปลงของการตั้งค่า"

    total_changes = len(added_nodes) + len(removed_nodes) + sum(len(m["changes"]) for m in modified_nodes) + len(added_edges) + len(removed_edges)

    return {
        "summary": summary_headline,
        "total_changes": total_changes,
        "added_nodes": added_nodes,
        "removed_nodes": removed_nodes,
        "modified_nodes": modified_nodes,
        "added_edges": added_edges,
        "removed_edges": removed_edges,
        "bullet_summaries": bullet_summaries,
    }
