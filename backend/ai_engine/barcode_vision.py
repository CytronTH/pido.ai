import logging
import time
from typing import List, Dict, Any, Optional, Tuple

logger = logging.getLogger(__name__)

class BarcodeVisionDetector:
    """
    Decodes 1D Barcodes and 2D QR Codes from video frames using OpenCV / ZBar.
    Supports ROI cropping and normalized bounding box mapping.
    """
    def __init__(self) -> None:
        import cv2
        self.qr_detector = cv2.QRCodeDetector()
        self.barcode_detector = None
        try:
            self.barcode_detector = cv2.barcode_BarcodeDetector()
        except Exception as e:
            logger.debug(f"OpenCV barcode detector not available: {e}")

    def detect_and_decode(
        self,
        frame,
        roi: Optional[Dict[str, float]] = None,
        code_types: str = "all"
    ) -> List[Dict[str, Any]]:
        """
        Detects and decodes barcodes and QR codes from a BGR image frame.
        
        Args:
            frame: OpenCV numpy BGR frame
            roi: Optional dict {"x": float, "y": float, "w": float, "h": float} in range 0.0-1.0
            code_types: "all" | "qr" | "barcode"
            
        Returns:
            List of detected code dicts:
            [
                {
                    "text": str,
                    "format": "QR_CODE" | "BARCODE" | "EAN_13" | ...,
                    "bbox": [x1, y1, x2, y2], # normalized 0.0-1.0
                    "confidence": 1.0
                }
            ]
        """
        if frame is None or frame.size == 0:
            return []

        H, W = frame.shape[:2]
        if H == 0 or W == 0:
            return []

        # Calculate crop area from ROI
        has_roi = False
        offset_x, offset_y = 0, 0
        crop_w, crop_h = W, H
        target_img = frame

        if roi and isinstance(roi, dict):
            rx = float(roi.get("x", 0.0))
            ry = float(roi.get("y", 0.0))
            rw = float(roi.get("w", 1.0))
            rh = float(roi.get("h", 1.0))
            if rw > 0.02 and rh > 0.02 and (rx > 0.01 or ry > 0.01 or rw < 0.99 or rh < 0.99):
                has_roi = True
                offset_x = max(0, min(W - 1, int(rx * W)))
                offset_y = max(0, min(H - 1, int(ry * H)))
                crop_w = max(10, min(W - offset_x, int(rw * W)))
                crop_h = max(10, min(H - offset_y, int(rh * H)))
                target_img = frame[offset_y:offset_y + crop_h, offset_x:offset_x + crop_w]

        results: List[Dict[str, Any]] = []

        # 1. 2D QR Code Detection
        if code_types in ("all", "qr"):
            try:
                ret, decoded_info, points, _ = self.qr_detector.detectAndDecodeMulti(target_img)
                if ret and decoded_info:
                    for i, text in enumerate(decoded_info):
                        clean_text = str(text).strip()
                        if clean_text:
                            pts = points[i] if points is not None and len(points) > i else None
                            bbox = self._calculate_normalized_bbox(pts, offset_x, offset_y, W, H)
                            results.append({
                                "text": clean_text,
                                "format": "QR_CODE",
                                "bbox": bbox,
                                "confidence": 1.0
                            })
            except Exception as e:
                logger.debug(f"QR decode error: {e}")

        # 2. 1D Barcode Detection
        if code_types in ("all", "barcode") and self.barcode_detector is not None:
            try:
                ret, decoded_info, decoded_types, points = self.barcode_detector.detectAndDecode(target_img)
                if ret and decoded_info:
                    info_list = decoded_info if isinstance(decoded_info, (list, tuple)) else [decoded_info]
                    type_list = decoded_types if isinstance(decoded_types, (list, tuple)) else ["BARCODE"] * len(info_list)
                    for i, text in enumerate(info_list):
                        clean_text = str(text).strip()
                        if clean_text:
                            btype = str(type_list[i]) if i < len(type_list) else "BARCODE"
                            pts = points[i] if points is not None and len(points) > i else None
                            bbox = self._calculate_normalized_bbox(pts, offset_x, offset_y, W, H)
                            results.append({
                                "text": clean_text,
                                "format": btype or "BARCODE",
                                "bbox": bbox,
                                "confidence": 1.0
                            })
            except Exception as e:
                logger.debug(f"Barcode decode error: {e}")

        return results

    def _calculate_normalized_bbox(
        self,
        points,
        offset_x: int,
        offset_y: int,
        total_w: int,
        total_h: int
    ) -> List[float]:
        """Calculates normalized [x1, y1, x2, y2] from quadrilateral corner points."""
        if points is None or len(points) == 0:
            if offset_x > 0 or offset_y > 0:
                return [
                    round(offset_x / total_w, 4),
                    round(offset_y / total_h, 4),
                    round((offset_x + 50) / total_w, 4),
                    round((offset_y + 50) / total_h, 4)
                ]
            return [0.0, 0.0, 0.1, 0.1]

        import numpy as np
        pts = np.array(points).reshape(-1, 2)
        min_x = float(np.min(pts[:, 0])) + offset_x
        max_x = float(np.max(pts[:, 0])) + offset_x
        min_y = float(np.min(pts[:, 1])) + offset_y
        max_y = float(np.max(pts[:, 1])) + offset_y

        norm_x1 = max(0.0, min(1.0, round(min_x / total_w, 4)))
        norm_y1 = max(0.0, min(1.0, round(min_y / total_h, 4)))
        norm_x2 = max(0.0, min(1.0, round(max_x / total_w, 4)))
        norm_y2 = max(0.0, min(1.0, round(max_y / total_h, 4)))

        return [norm_x1, norm_y1, norm_x2, norm_y2]
