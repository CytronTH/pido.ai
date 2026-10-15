/**
 * Helper utilities, presets, and expression compiler for LogicNode
 */

export const COMMON_CLASSES = [
  'person',
  'car',
  'cup',
  'bottle',
  'expire_date',
  'cap',
  'box',
  'helmet',
  'vest',
  'truck',
  'chair',
  'part',
  'defect'
];

export const CONDITION_TYPES = [
  { id: 'presence', label: '📦 ตรวจพบวัตถุ (Presence)', desc: 'ตรวจสอบว่าพบหรือไม่มีวัตถุในภาพ' },
  { id: 'count', label: '🔢 นับจำนวน (Count)', desc: 'ตรวจสอบจำนวนชิ้นของวัตถุ' },
  { id: 'confidence', label: '⭐ ความมั่นใจ (Confidence)', desc: 'กรองค่าความมั่นใจของ AI' },
  { id: 'position', label: '🎯 ตำแหน่ง (Position / Centered)', desc: 'ตรวจสอบตำแหน่งกึ่งกลางหรืออยู่ในกรอบ' },
  { id: 'defect', label: '🔍 ตรวจสอบ Defect (Missing Part)', desc: 'ตรวจสอบชิ้นส่วนย่อยที่ขาดหาย' }
];

export const FACTORY_PRESETS = [
  {
    id: 'presence',
    icon: 'Package',
    title: 'ตรวจพบวัตถุ (Object Detected)',
    badge: 'พื้นฐาน',
    desc: 'ส่งสัญญาณ True เมื่อตรวจพบวัตถุชนิดที่กำหนดอย่างน้อย 1 ชิ้นในภาพ',
    combineMode: 'and',
    createRules: (classes) => [
      {
        id: 'r_pres_' + Date.now(),
        type: 'presence',
        condition: 'exists',
        targetClass: classes[0] || 'person'
      }
    ]
  },
  {
    id: 'count_threshold',
    icon: 'Binary',
    title: 'นับจำนวนถึงเป้า (Target Count)',
    badge: 'สายการผลิต',
    desc: 'ส่งสัญญาณเมื่อตรวจพบคลาสที่กำหนดครบตามจำนวน เช่น >= 2 ชิ้น',
    combineMode: 'and',
    createRules: (classes) => [
      {
        id: 'r_cnt_' + Date.now(),
        type: 'count',
        targetClass: classes[0] || 'person',
        operator: '>=',
        value: 2
      }
    ]
  },
  {
    id: 'centered_qc',
    icon: 'Crosshair',
    title: 'ชิ้นงานอยู่กึ่งกลาง (Centered in ROI)',
    badge: 'ตรวจสอบ QC',
    desc: 'ส่งสัญญาณเมื่อชิ้นงานเลื่อนมาอยู่กึ่งกลางพื้นที่ตรวจจับพอดี',
    combineMode: 'and',
    createRules: (classes) => [
      {
        id: 'r_cen_' + Date.now(),
        type: 'position',
        posType: 'centered',
        targetClass: classes[0] || 'cup'
      }
    ]
  },
  {
    id: 'missing_defect',
    icon: 'AlertTriangle',
    title: 'ตรวจชิ้นส่วนขาดหาย (Missing Part)',
    badge: 'ตรวจ Defect',
    desc: 'ตรวจพบชิ้นงานหลัก แต่ขาดชิ้นส่วนย่อย (เช่น มีแก้วแต่ไม่มีวันหมดอายุ หรือไม่มีฝา)',
    combineMode: 'and',
    createRules: (classes) => [
      {
        id: 'r_def_' + Date.now(),
        type: 'defect',
        defectCondition: 'missing_part',
        parentClass: classes[0] || 'cup',
        childClass: classes[1] || 'expire_date'
      }
    ]
  },
  {
    id: 'ppe_safety',
    icon: 'ShieldAlert',
    title: 'ความปลอดภัย PPE (Safety Check)',
    badge: 'โรงงานปลอดภัย',
    desc: 'ตรวจพบคน (person) แต่ไม่พบหมวกนิรภัย (helmet) เพื่อส่งสัญญาณแจ้งเตือน',
    combineMode: 'and',
    createRules: (classes) => [
      {
        id: 'r_ppe_p_' + Date.now(),
        type: 'presence',
        condition: 'exists',
        targetClass: classes.find(c => c.toLowerCase().includes('person')) || 'person'
      },
      {
        id: 'r_ppe_h_' + (Date.now() + 1),
        type: 'presence',
        condition: 'not_exists',
        targetClass: classes.find(c => c.toLowerCase().includes('helmet')) || 'helmet'
      }
    ]
  },
  {
    id: 'high_confidence',
    icon: 'Sparkles',
    title: 'คัดกรองความมั่นใจสูง (High Confidence)',
    badge: 'ลด False Alarm',
    desc: 'ส่งสัญญาณเฉพาะเมื่อตรวจพบวัตถุด้วยความมั่นใจ >= 80%',
    combineMode: 'and',
    createRules: (classes) => [
      {
        id: 'r_hc_pres_' + Date.now(),
        type: 'presence',
        condition: 'exists',
        targetClass: classes[0] || 'person'
      },
      {
        id: 'r_hc_conf_' + (Date.now() + 1),
        type: 'confidence',
        targetClass: classes[0] || 'person',
        operator: '>=',
        value: 80
      }
    ]
  },
  {
    id: 'fully_in_roi',
    icon: 'Maximize2',
    title: 'วัตถุอยู่ในกรอบสมบูรณ์ (Fully in ROI)',
    badge: 'เข้าพื้นที่',
    desc: 'ตรวจพบวัตถุเข้ามาอยู่ในกรอบพื้นที่ ROI ครบทั้งตัวโดยไม่ล้นขอบ',
    combineMode: 'and',
    createRules: (classes) => [
      {
        id: 'r_inroi_' + Date.now(),
        type: 'position',
        posType: 'fully_in_roi',
        targetClass: classes[0] || 'person'
      }
    ]
  },
  {
    id: 'overcrowd',
    icon: 'Users',
    title: 'ความหนาแน่นเกินพิกัด (Overcrowding)',
    badge: 'พื้นที่แออัด',
    desc: 'ตรวจพบวัตถุรวมทุกชนิดเกิน 5 ชิ้นในภาพ',
    combineMode: 'and',
    createRules: () => [
      {
        id: 'r_oc_' + Date.now(),
        type: 'count',
        targetClass: 'all',
        operator: '>=',
        value: 5
      }
    ]
  }
];

/**
 * Compile visual rules into Python expression for backend
 */
export function compileRulesToExpression(rules, combineMode = 'and', availableClasses = []) {
  if (!rules || !Array.isArray(rules) || rules.length === 0) {
    return 'count > 0';
  }

  const pDefault = availableClasses?.[0] || 'cup';
  const cDefault = availableClasses?.[1] || availableClasses?.[0] || 'expire_date';

  const subExprs = rules.map(rule => {
    switch (rule.type) {
      case 'presence': {
        const lbl = (rule.targetClass || pDefault).trim();
        return rule.condition === 'not_exists' ? `not has("${lbl}")` : `has("${lbl}")`;
      }
      case 'count': {
        const lbl = (rule.targetClass || 'all').trim();
        const op = rule.operator || '>=';
        const val = isNaN(parseInt(rule.value, 10)) ? 1 : parseInt(rule.value, 10);
        if (lbl === 'all') {
          return `count ${op} ${val}`;
        }
        return `label_count("${lbl}") ${op} ${val}`;
      }
      case 'confidence': {
        const lbl = (rule.targetClass || 'all').trim();
        const op = rule.operator || '>=';
        const rawVal = parseFloat(rule.value) || 75;
        // Normalize 0-100 to 0.0-1.0
        const confVal = rawVal > 1 ? (rawVal / 100).toFixed(2) : rawVal.toFixed(2);
        if (lbl === 'all') {
          return `confidence ${op} ${confVal}`;
        }
        return `label_confidence("${lbl}") ${op} ${confVal}`;
      }
      case 'position': {
        const lbl = (rule.targetClass || pDefault).trim();
        if (rule.posType === 'fully_in_roi') {
          return `is_fully_in_roi("${lbl}")`;
        }
        return `is_centered("${lbl}")`;
      }
      case 'defect': {
        const parent = (rule.parentClass || pDefault).trim();
        const child = (rule.childClass || cDefault).trim();
        
        if (rule.defectCondition === 'missing_anywhere') {
          return `has("${parent}") and not has("${child}")`;
        }
        if (rule.defectCondition === 'has_anywhere') {
          return `has("${parent}") and has("${child}")`;
        }
        if (rule.defectCondition === 'has_part') {
          return `is_centered("${parent}") and centered_has("${child}")`;
        }
        // Default: 'missing_part' (Centered inspection: centered parent missing child)
        return `is_centered("${parent}") and not centered_has("${child}")`;
      }
      default:
        return 'count > 0';
    }
  });

  if (subExprs.length === 1) {
    return subExprs[0];
  }

  const joiner = combineMode === 'or' ? ' or ' : ' and ';
  return subExprs.join(joiner);
}

/**
 * Generate human-readable short summary for node display
 */
export function getHumanReadableSummary(data, availableClasses = []) {
  if (!data) return 'ตรวจพบวัตถุ > 0';

  if (data.rulesMode === 'code' || data.isAdvancedMode) {
    const expr = data.expression || '';
    if (!expr) return 'ไม่ได้กำหนดเงื่อนไข';
    if (expr.length > 28) return expr.substring(0, 26) + '...';
    return expr;
  }

  const rules = data.rules;
  if (!rules || !Array.isArray(rules) || rules.length === 0) {
    const expr = data.expression || 'count > 0';
    if (expr === 'len(msg["payload"]) > 0' || expr === 'count > 0') {
      return 'ตรวจพบวัตถุ > 0';
    }
    return expr.length > 25 ? expr.substring(0, 23) + '...' : expr;
  }

  const pDefault = availableClasses?.[0] || 'ชิ้นงาน';
  const cDefault = availableClasses?.[1] || availableClasses?.[0] || 'ชิ้นส่วน';

  const parts = rules.map(r => {
    switch (r.type) {
      case 'presence': {
        const lbl = r.targetClass || pDefault;
        return r.condition === 'not_exists' ? `ไม่พบ ${lbl}` : `พบ ${lbl}`;
      }
      case 'count': {
        const lbl = r.targetClass || pDefault;
        return `${lbl === 'all' ? 'รวม' : lbl} ${r.operator || '>='} ${r.value ?? 1}`;
      }
      case 'confidence': {
        const lbl = r.targetClass || pDefault;
        return `ความมั่นใจ ${lbl === 'all' ? '' : lbl + ' '}>= ${r.value ?? 75}%`;
      }
      case 'position': {
        const lbl = r.targetClass || pDefault;
        return `${r.posType === 'fully_in_roi' ? 'ในกรอบ' : 'กึ่งกลาง'} ${lbl}`;
      }
      case 'defect': {
        const parent = r.parentClass || pDefault;
        const child = r.childClass || cDefault;
        if (r.defectCondition === 'has_part' || r.defectCondition === 'has_anywhere') {
          return `${parent} มี ${child}`;
        }
        return `${parent} ขาด ${child}`;
      }
      default:
        return 'เงื่อนไข';
    }
  });

  const sep = data.rulesCombineMode === 'or' ? ' หรือ ' : ' & ';
  return parts.join(sep);
}

/**
 * Best-effort parse common Python expressions back to visual rules
 */
export function parseExpressionToRules(expr) {
  if (!expr || typeof expr !== 'string') return null;
  const trimmed = expr.trim();

  // Pattern: len(msg["payload"]) > 0 or count > 0
  if (trimmed === 'len(msg["payload"]) > 0' || trimmed === 'count > 0') {
    return {
      combineMode: 'and',
      rules: [
        { id: 'r_init', type: 'count', targetClass: 'all', operator: '>', value: 0 }
      ]
    };
  }

  // Pattern: has("person")
  const hasMatch = trimmed.match(/^has\(["']([^"']+)["']\)$/);
  if (hasMatch) {
    return {
      combineMode: 'and',
      rules: [
        { id: 'r_init', type: 'presence', condition: 'exists', targetClass: hasMatch[1] }
      ]
    };
  }

  // Pattern: not has("person")
  const notHasMatch = trimmed.match(/^not\s+has\(["']([^"']+)["']\)$/);
  if (notHasMatch) {
    return {
      combineMode: 'and',
      rules: [
        { id: 'r_init', type: 'presence', condition: 'not_exists', targetClass: notHasMatch[1] }
      ]
    };
  }

  // Pattern: label_count("person") >= 2
  const countMatch = trimmed.match(/^label_count\(["']([^"']+)["']\)\s*(>=|==|<=|>|<|!=)\s*(\d+)$/);
  if (countMatch) {
    return {
      combineMode: 'and',
      rules: [
        { id: 'r_init', type: 'count', targetClass: countMatch[1], operator: countMatch[2], value: parseInt(countMatch[3], 10) }
      ]
    };
  }

  // Pattern: is_centered("bottle")
  const centerMatch = trimmed.match(/^is_centered\(["']([^"']+)["']\)$/);
  if (centerMatch) {
    return {
      combineMode: 'and',
      rules: [
        { id: 'r_init', type: 'position', posType: 'centered', targetClass: centerMatch[1] }
      ]
    };
  }

  return null;
}
