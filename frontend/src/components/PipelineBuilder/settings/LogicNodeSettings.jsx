import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Zap, Code, LayoutList, Plus, Trash2, Radio, Check, Copy, 
  AlertTriangle, Crosshair, Package, Binary, ShieldAlert, Sparkles, 
  Maximize2, Users, ChevronDown, ChevronRight, Activity, ArrowRight, 
  Settings2, Sliders, CheckCircle2, XCircle
} from 'lucide-react';
import usePipelineStore from '../../../store/usePipelineStore';
import { useShallow } from 'zustand/react/shallow';
import { 
  COMMON_CLASSES, 
  CONDITION_TYPES, 
  FACTORY_PRESETS, 
  compileRulesToExpression, 
  parseExpressionToRules 
} from './logicNodeUtils';

const SNIPPETS = [
  { label: 'Any object',        expr: 'len(msg["payload"]) > 0' },
  { label: 'No object',         expr: 'len(msg["payload"]) == 0' },
  { label: 'Count >=',          expr: 'len(msg["payload"]) >= 2' },
  { label: 'Has label',         expr: 'has("cup")' },
  { label: 'Centered in ROI',   expr: 'is_centered("cup")' },
  { label: 'Defect (Missing Date)', expr: 'is_centered("cup") and not centered_has("expire_date")' },
  { label: 'A and B together',  expr: 'has("cup") and has("expire_date")' },
  { label: 'A or B',           expr: 'has("cup") or has("bottle")' },
];

const VARS_REF = [
  ['msg["payload"]',            'list   — the payload detections'],
  ['count',                     'int    — total detections in ROI'],
  ['has("label")',              'bool   — label exists in ROI'],
  ['is_centered("label")',      'bool   — label is centered in ROI'],
  ['centered_has("label")',     'bool   — centered object contains label inside'],
  ['centered_missing("label")', 'bool   — centered object missing label'],
  ['is_fully_in_roi("label")',  'bool   — bbox is completely inside ROI'],
  ['label_count("label")',      'int    — count of specific label'],
  ['confidence',                'float  — max confidence overall (0.0 - 1.0)'],
  ['label_confidence("label")', 'float  — max confidence of label (0.0 - 1.0)'],
];

export default function LogicNodeSettings({ nodeId, data, onChange, isSidebar = true }) {
  const [models, setModels] = useState([]);
  const [showRef, setShowRef] = useState(false);
  const [copied, setCopied] = useState(false);
  const [presetTargetClass, setPresetTargetClass] = useState('');

  const { edges, nodes, debugData } = usePipelineStore(useShallow((state) => ({
    edges: state.edges,
    nodes: state.nodes,
    debugData: state.debugData?.[nodeId]
  })));

  // Fetch available AI models to extract classes
  useEffect(() => {
    fetch('/api/entities', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setModels(d.models || []))
      .catch(e => console.warn('Failed to fetch entities', e));
  }, []);

  // Multi-hop backwards traversal to find upstream AINode
  const upstreamAiNode = useMemo(() => {
    let currId = nodeId;
    const visited = new Set();
    while (currId && !visited.has(currId)) {
      visited.add(currId);
      const inEdge = edges.find(e => e.target === currId);
      if (!inEdge) break;
      const src = nodes.find(n => n.id === inEdge.source);
      if (!src) break;
      if (src.type === 'aiNode') {
        return src;
      }
      currId = src.id;
    }
    return null;
  }, [nodeId, nodes, edges]);

  // Extract model classes from upstream AI node
  const availableClasses = useMemo(() => {
    if (!upstreamAiNode?.data?.entityId) return COMMON_CLASSES;
    const aiModel = models.find(m => m.id === upstreamAiNode.data.entityId);
    if (aiModel?.classes && aiModel.classes.length > 0) {
      return aiModel.classes;
    }
    return COMMON_CLASSES;
  }, [upstreamAiNode, models]);

  // Active mode: 'visual' | 'presets' | 'code'
  const activeMode = data?.rulesMode ?? (data?.isAdvancedMode ? 'code' : 'visual');
  const expr = data?.expression ?? 'count > 0';
  const combineMode = data?.rulesCombineMode ?? 'and';
  const outputMode = data?.outputMode ?? 'on_change';
  const debounceMs = data?.debounceMs ?? 0;
  const cooldownMs = data?.cooldownMs ?? 0;

  // Initialize and normalize rules so no required fields are undefined
  const rules = useMemo(() => {
    let rawRules = data?.rules;
    if (!rawRules || !Array.isArray(rawRules) || rawRules.length === 0) {
      const parsed = parseExpressionToRules(expr);
      if (parsed?.rules) {
        rawRules = parsed.rules;
      } else {
        rawRules = [
          {
            id: 'r_default',
            type: 'presence',
            condition: 'exists',
            targetClass: availableClasses[0] || 'cup'
          }
        ];
      }
    }

    const pClass = availableClasses[0] || 'cup';
    const cClass = availableClasses[1] || availableClasses[0] || 'expire_date';

    return rawRules.map((r, i) => {
      if (r.type === 'defect') {
        return {
          ...r,
          parentClass: r.parentClass || pClass,
          childClass: r.childClass || cClass,
          defectCondition: r.defectCondition || 'missing_part'
        };
      }
      if (r.type === 'position') {
        return {
          ...r,
          targetClass: r.targetClass || pClass,
          posType: r.posType || 'centered'
        };
      }
      if (r.type === 'presence') {
        return {
          ...r,
          targetClass: r.targetClass || pClass,
          condition: r.condition || 'exists'
        };
      }
      if (r.type === 'count') {
        return {
          ...r,
          targetClass: r.targetClass || pClass,
          operator: r.operator || '>=',
          value: r.value ?? 1
        };
      }
      if (r.type === 'confidence') {
        return {
          ...r,
          targetClass: r.targetClass || pClass,
          operator: r.operator || '>=',
          value: r.value ?? 75
        };
      }
      return r;
    });
  }, [data?.rules, expr, availableClasses]);

  // Auto-heal legacy or invalid expressions (e.g., if parentClass was missing or fell back to 'person'/'bottle' mistakenly)
  useEffect(() => {
    if (data?.rules && Array.isArray(data.rules) && data.rules.length > 0) {
      let needsHeal = false;
      const pClass = availableClasses[0] || 'cup';
      const cClass = availableClasses[1] || availableClasses[0] || 'expire_date';
      const isInvalidClass = (cls) => cls && availableClasses.length > 0 && !availableClasses.includes(cls);

      const healedRules = data.rules.map(r => {
        if (r.type === 'defect') {
          const invalidParent = !r.parentClass || isInvalidClass(r.parentClass) || r.parentClass === 'bottle' || r.parentClass === 'person';
          const invalidChild = !r.childClass || isInvalidClass(r.childClass) || r.childClass === 'cap';
          if (invalidParent || invalidChild || r.targetClass) {
            needsHeal = true;
            const updated = {
              ...r,
              parentClass: invalidParent ? pClass : r.parentClass,
              childClass: invalidChild ? cClass : r.childClass,
              defectCondition: r.defectCondition || 'missing_part'
            };
            delete updated.targetClass;
            return updated;
          }
        }
        if (r.type === 'position' || r.type === 'presence') {
          if (isInvalidClass(r.targetClass)) {
            needsHeal = true;
            return { ...r, targetClass: pClass };
          }
        }
        return r;
      });

      const exprHasInvalidPerson = data.expression && data.expression.includes('"person"') && !availableClasses.includes('person');
      const exprHasInvalidBottle = data.expression && data.expression.includes('"bottle"') && !availableClasses.includes('bottle');

      if (needsHeal || exprHasInvalidPerson || exprHasInvalidBottle) {
        const compiled = compileRulesToExpression(healedRules, combineMode, availableClasses);
        onChange({
          rules: healedRules,
          expression: compiled
        });
      }
    }
  }, [data?.rules, data?.expression, availableClasses, combineMode]);

  // Update mode
  const setMode = (mode) => {
    onChange({ 
      rulesMode: mode,
      isAdvancedMode: mode === 'code'
    });
  };

  // Sync rules update & re-compile expression
  const updateRules = (newRules, newCombineMode = combineMode) => {
    const compiled = compileRulesToExpression(newRules, newCombineMode, availableClasses);
    onChange({
      rules: newRules,
      rulesCombineMode: newCombineMode,
      expression: compiled
    });
  };

  // Add a new condition with full valid defaults
  const handleAddCondition = () => {
    const pClass = availableClasses[0] || 'cup';
    const newRule = {
      id: 'r_' + Date.now(),
      type: 'presence',
      condition: 'exists',
      targetClass: pClass
    };
    updateRules([...rules, newRule]);
  };

  // Switch condition type and populate full defaults for that type
  const handleTypeChange = (index, newType) => {
    const pClass = availableClasses[0] || 'cup';
    const cClass = availableClasses[1] || availableClasses[0] || 'expire_date';

    let defaults = { type: newType };
    if (newType === 'defect') {
      defaults = {
        type: 'defect',
        parentClass: pClass,
        childClass: cClass,
        defectCondition: 'missing_part'
      };
    } else if (newType === 'position') {
      defaults = {
        type: 'position',
        posType: 'centered',
        targetClass: pClass
      };
    } else if (newType === 'presence') {
      defaults = {
        type: 'presence',
        condition: 'exists',
        targetClass: pClass
      };
    } else if (newType === 'count') {
      defaults = {
        type: 'count',
        targetClass: pClass,
        operator: '>=',
        value: 1
      };
    } else if (newType === 'confidence') {
      defaults = {
        type: 'confidence',
        targetClass: pClass,
        operator: '>=',
        value: 75
      };
    }

    const nextRules = [...rules];
    const updatedRule = { ...nextRules[index], ...defaults };
    if (newType === 'defect') {
      delete updatedRule.targetClass;
    }
    nextRules[index] = updatedRule;
    updateRules(nextRules);
  };

  // Update a single rule
  const handleUpdateRule = (index, updates) => {
    const nextRules = [...rules];
    nextRules[index] = { ...nextRules[index], ...updates };
    updateRules(nextRules);
  };

  // Remove a condition
  const handleRemoveRule = (index) => {
    if (rules.length <= 1) {
      updateRules([{
        id: 'r_' + Date.now(),
        type: 'presence',
        condition: 'exists',
        targetClass: availableClasses[0] || 'cup'
      }]);
      return;
    }
    const nextRules = rules.filter((_, idx) => idx !== index);
    updateRules(nextRules);
  };

  // Apply a factory preset
  const handleApplyPreset = (preset) => {
    const target = presetTargetClass || availableClasses[0] || 'cup';
    const classesForPreset = [target, ...availableClasses.filter(c => c !== target)];
    const generatedRules = preset.createRules(classesForPreset);
    const newCombine = preset.combineMode || 'and';
    const compiled = compileRulesToExpression(generatedRules, newCombine, availableClasses);

    onChange({
      rules: generatedRules,
      rulesCombineMode: newCombine,
      expression: compiled,
      rulesMode: 'visual',
      isAdvancedMode: false
    });
  };

  const handleCopyExpr = () => {
    navigator.clipboard?.writeText(expr);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Live state from telemetry / websocket
  const liveState = debugData?.value;
  const isLiveMatched = liveState === true;

  return (
    <div className="flex flex-col gap-3.5">
      {/* Real-time Status Banner */}
      <div className={`p-2.5 rounded-lg border flex items-center justify-between transition-all ${
        isLiveMatched 
          ? 'bg-emerald-500/10 border-emerald-500/50 shadow-sm shadow-emerald-500/10' 
          : 'bg-canvas border-line'
      }`}>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {isLiveMatched && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            )}
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
              isLiveMatched ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-line-strong'
            }`}></span>
          </span>
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold flex items-center gap-1.5">
              สถานะประเมินผล:
              <span className={`font-mono font-bold ${isLiveMatched ? 'text-emerald-700 dark:text-emerald-400' : 'text-fg-subtle'}`}>
                {isLiveMatched ? '🟢 MATCHED (TRUE)' : '⚪ WAITING (FALSE)'}
              </span>
            </span>
          </div>
        </div>

        {upstreamAiNode && (
          <span className="text-[10px] px-2 py-0.5 rounded bg-surface border border-line-strong font-mono text-fg-secondary">
            AI: {upstreamAiNode.data?.label || 'Connected'}
          </span>
        )}
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex bg-canvas rounded-lg p-1 border border-line shrink-0">
        <button 
          type="button"
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
            activeMode === 'visual' 
              ? 'bg-surface-2 text-orange-700 dark:text-orange-400 shadow-sm border border-line/60' 
              : 'text-fg-subtle hover:text-fg'
          }`}
          onClick={() => setMode('visual')}
        >
          <LayoutList size={13} /> Visual Builder
        </button>
        <button 
          type="button"
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
            activeMode === 'presets' 
              ? 'bg-surface-2 text-orange-700 dark:text-orange-400 shadow-sm border border-line/60' 
              : 'text-fg-subtle hover:text-fg'
          }`}
          onClick={() => setMode('presets')}
        >
          <Zap size={13} /> Factory Presets
        </button>
        <button 
          type="button"
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
            activeMode === 'code' 
              ? 'bg-surface-2 text-orange-700 dark:text-orange-400 shadow-sm border border-line/60' 
              : 'text-fg-subtle hover:text-fg'
          }`}
          onClick={() => setMode('code')}
        >
          <Code size={13} /> Python Code
        </button>
      </div>

      {/* MODE 1: VISUAL RULE BUILDER */}
      {activeMode === 'visual' && (
        <div className="flex flex-col gap-3">
          {/* Combine Mode Selector (AND / OR) */}
          <div className="flex items-center justify-between bg-surface-2/40 px-3 py-2 rounded-lg border border-line">
            <span className="text-xs font-medium text-fg-secondary">
              การรวมเงื่อนไขทั้งหมด:
            </span>
            <div className="flex items-center gap-1 bg-canvas p-0.5 rounded-md border border-line">
              <button
                type="button"
                onClick={() => updateRules(rules, 'and')}
                className={`text-[11px] font-bold px-2 py-0.5 rounded transition-colors ${
                  combineMode === 'and'
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-fg-subtle hover:text-fg'
                }`}
              >
                AND (ตรงทุกข้อ)
              </button>
              <button
                type="button"
                onClick={() => updateRules(rules, 'or')}
                className={`text-[11px] font-bold px-2 py-0.5 rounded transition-colors ${
                  combineMode === 'or'
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-fg-subtle hover:text-fg'
                }`}
              >
                OR (ตรงข้อใดข้อหนึ่ง)
              </button>
            </div>
          </div>

          {/* Condition Cards */}
          <div className="flex flex-col gap-2.5 max-h-[380px] overflow-y-auto styled-scrollbar pr-0.5">
            {rules.map((rule, idx) => (
              <div 
                key={rule.id || idx} 
                className="p-3 rounded-lg border border-line-strong bg-surface-2/30 flex flex-col gap-2.5 relative group hover:border-orange-500/40 transition-colors"
              >
                {/* Card Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/30 flex items-center justify-center text-[10px] font-mono font-bold">
                      {idx + 1}
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
                      {idx === 0 ? 'ถ้าเงื่อนไข (IF)' : (combineMode === 'and' ? 'และ (AND)' : 'หรือ (OR)')}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveRule(idx)}
                    className="p-1 rounded text-fg-subtle hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    title="ลบเงื่อนไขนี้"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Condition Type Selector */}
                <div className="grid grid-cols-1 gap-2">
                  <select
                    className="w-full bg-surface border border-line-strong rounded-md p-1.5 text-xs text-fg focus:outline-none focus:border-orange-500 font-medium"
                    value={rule.type || 'presence'}
                    onChange={(e) => handleTypeChange(idx, e.target.value)}
                  >
                    {CONDITION_TYPES.map(ct => (
                      <option key={ct.id} value={ct.id}>{ct.label}</option>
                    ))}
                  </select>
                </div>

                {/* Sub-inputs based on Condition Type */}
                <div className="bg-canvas/60 p-2.5 rounded border border-line/70 flex flex-col gap-2">
                  {/* Type 1: Presence */}
                  {rule.type === 'presence' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-fg-subtle block mb-1">สถานะ</label>
                        <select
                          className="w-full bg-surface border border-line-strong rounded p-1 text-xs text-fg"
                          value={rule.condition || 'exists'}
                          onChange={(e) => handleUpdateRule(idx, { condition: e.target.value })}
                        >
                          <option value="exists">✅ ตรวจพบ (Exists)</option>
                          <option value="not_exists">❌ ไม่พบ (Missing)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-fg-subtle block mb-1">คลาสวัตถุ (Class)</label>
                        <select
                          className="w-full bg-surface border border-line-strong rounded p-1 text-xs font-mono text-fg"
                          value={rule.targetClass || availableClasses[0] || 'cup'}
                          onChange={(e) => handleUpdateRule(idx, { targetClass: e.target.value })}
                        >
                          {availableClasses.map(cls => (
                            <option key={cls} value={cls}>{cls}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Type 2: Count */}
                  {rule.type === 'count' && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-1">
                        <label className="text-[10px] text-fg-subtle block mb-1">คลาส</label>
                        <select
                          className="w-full bg-surface border border-line-strong rounded p-1 text-xs font-mono text-fg"
                          value={rule.targetClass || 'all'}
                          onChange={(e) => handleUpdateRule(idx, { targetClass: e.target.value })}
                        >
                          <option value="all">🌐 ทุกคลาส (All)</option>
                          {availableClasses.map(cls => (
                            <option key={cls} value={cls}>{cls}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-fg-subtle block mb-1">ตัวดำเนินการ</label>
                        <select
                          className="w-full bg-surface border border-line-strong rounded p-1 text-xs font-mono text-fg text-center"
                          value={rule.operator || '>='}
                          onChange={(e) => handleUpdateRule(idx, { operator: e.target.value })}
                        >
                          <option value=">=">&gt;= (อย่างน้อย)</option>
                          <option value="==">== (เท่ากับ)</option>
                          <option value="<=">&lt;= (ไม่เกิน)</option>
                          <option value=">">&gt; (มากกว่า)</option>
                          <option value="<">&lt; (น้อยกว่า)</option>
                          <option value="!=">!= (ไม่เท่ากับ)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-fg-subtle block mb-1">จำนวนชิ้น</label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          className="w-full bg-surface border border-line-strong rounded p-1 text-xs text-right font-mono text-fg"
                          value={rule.value ?? 1}
                          onChange={(e) => handleUpdateRule(idx, { value: parseInt(e.target.value, 10) || 0 })}
                        />
                      </div>
                    </div>
                  )}

                  {/* Type 3: Confidence */}
                  {rule.type === 'confidence' && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-1">
                        <label className="text-[10px] text-fg-subtle block mb-1">คลาส</label>
                        <select
                          className="w-full bg-surface border border-line-strong rounded p-1 text-xs font-mono text-fg"
                          value={rule.targetClass || 'all'}
                          onChange={(e) => handleUpdateRule(idx, { targetClass: e.target.value })}
                        >
                          <option value="all">🌐 ทุกคลาส (All)</option>
                          {availableClasses.map(cls => (
                            <option key={cls} value={cls}>{cls}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-fg-subtle block mb-1">เกณฑ์</label>
                        <select
                          className="w-full bg-surface border border-line-strong rounded p-1 text-xs font-mono text-fg text-center"
                          value={rule.operator || '>='}
                          onChange={(e) => handleUpdateRule(idx, { operator: e.target.value })}
                        >
                          <option value=">=">&gt;= (อย่างน้อย)</option>
                          <option value="<=">&lt;= (ไม่เกิน)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-fg-subtle block mb-1">ความมั่นใจ (%)</label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          step="5"
                          className="w-full bg-surface border border-line-strong rounded p-1 text-xs text-right font-mono text-fg"
                          value={rule.value ?? 75}
                          onChange={(e) => handleUpdateRule(idx, { value: Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 75)) })}
                        />
                      </div>
                    </div>
                  )}

                  {/* Type 4: Position */}
                  {rule.type === 'position' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-fg-subtle block mb-1">เงื่อนไขตำแหน่ง</label>
                        <select
                          className="w-full bg-surface border border-line-strong rounded p-1 text-xs text-fg"
                          value={rule.posType || 'centered'}
                          onChange={(e) => handleUpdateRule(idx, { posType: e.target.value })}
                        >
                          <option value="centered">🎯 อยู่กึ่งกลาง ROI (Centered)</option>
                          <option value="fully_in_roi">📦 อยู่ในกรอบสมบูรณ์ (Fully in ROI)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-fg-subtle block mb-1">คลาสวัตถุ</label>
                        <select
                          className="w-full bg-surface border border-line-strong rounded p-1 text-xs font-mono text-fg"
                          value={rule.targetClass || availableClasses[0] || 'cup'}
                          onChange={(e) => handleUpdateRule(idx, { targetClass: e.target.value })}
                        >
                          {availableClasses.map(cls => (
                            <option key={cls} value={cls}>{cls}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Type 5: Defect (QC) */}
                  {rule.type === 'defect' && (
                    <div className="flex flex-col gap-2">
                      <div>
                        <label className="text-[10px] text-fg-subtle block mb-1">รูปแบบการตรวจสอบ</label>
                        <select
                          className="w-full bg-surface border border-line-strong rounded p-1 text-xs text-fg font-medium"
                          value={rule.defectCondition || 'missing_part'}
                          onChange={(e) => handleUpdateRule(idx, { defectCondition: e.target.value })}
                        >
                          <option value="missing_part">⚠️ ตรวจจุดกึ่งกลาง: พบชิ้นงานหลัก แต่ขาดชิ้นส่วนย่อย (Centered Defect)</option>
                          <option value="missing_anywhere">🔍 ตรวจทั่วทั้งภาพ: พบชิ้นงานหลัก แต่ไม่พบชิ้นส่วนย่อย (General Defect)</option>
                          <option value="has_part">✅ ตรวจจุดกึ่งกลาง: พบชิ้นงานหลัก และมีชิ้นส่วนย่อยครบ (Centered Assembly OK)</option>
                          <option value="has_anywhere">📦 ตรวจทั่วทั้งภาพ: มีทั้งชิ้นงานหลักและชิ้นส่วนย่อยครบ (General Assembly OK)</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-fg-subtle block mb-1">ชิ้นงานหลัก (Parent)</label>
                          <select
                            className="w-full bg-surface border border-line-strong rounded p-1 text-xs font-mono text-fg"
                            value={rule.parentClass || availableClasses[0] || 'cup'}
                            onChange={(e) => handleUpdateRule(idx, { parentClass: e.target.value })}
                          >
                            {availableClasses.map(cls => (
                              <option key={cls} value={cls}>{cls}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] text-fg-subtle block mb-1">ชิ้นส่วนย่อย (Child/Part)</label>
                          <select
                            className="w-full bg-surface border border-line-strong rounded p-1 text-xs font-mono text-fg"
                            value={rule.childClass || availableClasses[1] || availableClasses[0] || 'expire_date'}
                            onChange={(e) => handleUpdateRule(idx, { childClass: e.target.value })}
                          >
                            {availableClasses.map(cls => (
                              <option key={cls} value={cls}>{cls}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add Condition Button */}
          <button
            type="button"
            onClick={handleAddCondition}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-dashed border-orange-500/60 hover:border-orange-500 hover:bg-orange-500/10 text-orange-700 dark:text-orange-400 text-xs font-semibold transition-all"
          >
            <Plus size={14} /> เพิ่มเงื่อนไข ({combineMode === 'and' ? 'AND' : 'OR'})
          </button>

          {/* Generated Python Expression Preview */}
          <div className="bg-canvas border border-line rounded-lg p-2.5 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[10px] font-mono text-fg-subtle">
              <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400 font-bold">
                <Code size={11} /> Generated Python Expression:
              </span>
              <button
                type="button"
                onClick={handleCopyExpr}
                className="hover:text-fg flex items-center gap-1 text-[10px] transition-colors"
                title="คัดลอกโค้ด"
              >
                {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="font-mono text-xs text-orange-600 dark:text-orange-300 break-all bg-surface-2/60 p-2 rounded border border-line-strong/40">
              {expr}
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: FACTORY PRESETS */}
      {activeMode === 'presets' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-fg-secondary">
              เลือกคลาสเป้าหมายสำหรับแม่แบบ:
            </label>
            <select
              className="w-full bg-surface border border-line-strong rounded-md p-1.5 text-xs font-mono text-fg"
              value={presetTargetClass || availableClasses[0] || 'cup'}
              onChange={(e) => setPresetTargetClass(e.target.value)}
            >
              {availableClasses.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto styled-scrollbar pr-0.5">
            {FACTORY_PRESETS.map(preset => (
              <div
                key={preset.id}
                className="p-3 rounded-lg border border-line-strong bg-surface-2/40 hover:border-orange-500/50 hover:bg-surface-2 transition-all flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-fg">{preset.title}</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 font-medium">
                        {preset.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-fg-muted mt-0.5 leading-relaxed">
                      {preset.desc}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-line/60">
                  <span className="text-[10px] font-mono text-fg-subtle truncate max-w-[180px]">
                    Target: {presetTargetClass || availableClasses[0] || 'cup'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-semibold transition-colors shadow-sm"
                  >
                    ใช้แม่แบบนี้ <ArrowRight size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODE 3: PYTHON CODE EDITOR */}
      {activeMode === 'code' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider flex justify-between text-fg-muted">
              <span>Python Expression</span>
              <span className="text-orange-600 dark:text-orange-400 font-mono text-[10px]">eval()</span>
            </label>
            <textarea
              className="bg-canvas border border-line-strong rounded-lg p-2.5 text-xs font-mono text-green-700 dark:text-green-300 focus:outline-none focus:border-orange-500 resize-none leading-relaxed w-full"
              rows={4}
              value={expr}
              onChange={e => onChange({ expression: e.target.value })}
              placeholder={'count > 0\nhas("cup") and not centered_has("expire_date")'}
              spellCheck={false}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-wider text-fg-subtle">Quick Snippets</label>
            <div className="flex flex-wrap gap-1.5">
              {SNIPPETS.map(s => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => onChange({ expression: s.expr })}
                  className="text-[10px] bg-surface-2 hover:bg-orange-100 dark:hover:bg-orange-950/40 border border-line-strong hover:border-orange-500 hover:text-orange-600 px-2 py-1 rounded transition-colors text-fg-secondary"
                  title={s.expr}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border border-line rounded-lg overflow-hidden mt-1">
            <button
              type="button"
              className="w-full flex items-center justify-between px-3 py-2 bg-surface-2/50 hover:bg-surface-2 text-xs transition-colors text-fg-secondary"
              onClick={() => setShowRef(r => !r)}
            >
              <span className="flex items-center gap-1.5 font-medium">
                <Zap size={13} className="text-orange-500" />
                Available variables & functions
              </span>
              {showRef ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>
            {showRef && (
              <div className="bg-canvas/90 px-3 py-2.5 flex flex-col gap-2 max-h-[160px] overflow-y-auto styled-scrollbar">
                {VARS_REF.map(([v, desc]) => (
                  <div key={v} className="flex gap-2 items-start">
                    <code
                      className="text-[10px] font-mono text-amber-700 dark:text-amber-300 bg-surface-2 px-1.5 py-0.5 rounded cursor-pointer hover:bg-orange-200 dark:hover:bg-orange-900/30 transition-colors shrink-0"
                      onClick={() => onChange({ expression: expr + (expr ? ' and ' : '') + v })}
                      title="คลิกเพื่อแทรกต่อท้าย"
                    >
                      {v}
                    </code>
                    <span className="text-[10px] leading-relaxed text-fg-subtle">{desc}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* OUTPUT TRIGGER & ANTI-FLOOD CONTROLS */}
      <div className="flex flex-col gap-2.5 p-3 rounded-lg bg-canvas border border-line mt-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
            <Radio size={13} /> Output Trigger Mode
          </span>
          <span className="text-[10px] font-mono text-fg-subtle">Anti-Flood</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <select
            value={outputMode}
            onChange={e => onChange({ outputMode: e.target.value })}
            className="w-full bg-surface border border-line-strong hover:border-orange-500/70 focus:border-orange-500 rounded p-1.5 text-xs focus:outline-none transition-colors font-medium text-fg"
          >
            <option value="on_change">🔄 On Change (ส่งเฉพาะเมื่อสถานะเปลี่ยน)</option>
            <option value="rising_edge">⚡ Rising Edge (ส่ง 1 ครั้งเมื่อเริ่มเป็นจริง)</option>
            <option value="continuous">🌊 Continuous (ส่งทุกเฟรม - 30 FPS)</option>
          </select>
          <p className="text-[10px] leading-tight text-fg-muted">
            {outputMode === 'on_change' && '🛡️ แนะนำ: ส่งสัญญาณเฉพาะเมื่อสถานะเปลี่ยน (False ↔ True) ช่วยลดภาระโหนดปลายทาง'}
            {outputMode === 'rising_edge' && '⚡ เหมาะสำหรับสั่งถ่ายภาพ/แจ้งเตือน: ยิงสัญญาณ 1 ครั้งเมื่อตรวจพบ'}
            {outputMode === 'continuous' && '⚠️ ส่งทุกเฟรม: อาจทำให้โหนดปลายทางทำงานหนักหากรับข้อมูล 30Hz'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-line/80">
          <div>
            <label className="text-[11px] flex flex-col text-fg-secondary">
              <span className="font-medium">Debounce (ms)</span>
              <span className="text-[9px] text-fg-subtle">หน่วงกันสัญญาณกะพริบ</span>
            </label>
            <input
              type="number" 
              min="0" 
              step="100"
              className="mt-1 w-full bg-surface border border-line-strong rounded p-1.5 text-xs focus:outline-none focus:border-orange-500 text-right font-mono text-fg"
              value={debounceMs}
              onChange={e => onChange({ debounceMs: Math.max(0, parseInt(e.target.value, 10) || 0) })}
            />
          </div>

          <div>
            <label className="text-[11px] flex flex-col text-fg-secondary">
              <span className="font-medium">Cooldown (ms)</span>
              <span className="text-[9px] text-fg-subtle">ระยะพักป้องกันยิงซ้ำ</span>
            </label>
            <input
              type="number" 
              min="0" 
              step="500"
              className="mt-1 w-full bg-surface border border-line-strong rounded p-1.5 text-xs focus:outline-none focus:border-orange-500 text-right font-mono text-fg"
              value={cooldownMs}
              onChange={e => onChange({ cooldownMs: Math.max(0, parseInt(e.target.value, 10) || 0) })}
              placeholder="0"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
