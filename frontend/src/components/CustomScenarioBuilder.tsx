import { useEffect, useMemo, useRef, useState } from 'react';
import {
  effectiveSlots,
  emptyGearByRole,
  emptySlotsByRole,
  DEFAULT_ROLES,
  type Level,
  type LevelGearByRole,
  type Role,
  type RoleId,
  type SlotDef,
  type SlotValue,
  type SlotsByRole,
} from '../types';

type Props = {
  scenarioName: string;
  initialRoles?: Role[];
  initialSlots?: SlotsByRole;
  initialLevels?: Level[];
  onChange: (roles: Role[], slots: SlotsByRole, levels: Level[]) => void;
};

let nextId = 1;
function freshLevel(roles: Role[]): Level {
  const id = nextId++;
  return { id, name: `Level ${id}`, gear: emptyGearByRole(roles) };
}

function slugify(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'role';
}

type CellMode = 'inherit' | 'set' | 'clear';

function cellMode(level: Level, role: RoleId, slot: string): CellMode {
  const explicit = level.gear?.[role] ?? {};
  if (!Object.prototype.hasOwnProperty.call(explicit, slot)) return 'inherit';
  return explicit[slot] === null ? 'clear' : 'set';
}

export default function CustomScenarioBuilder({
  scenarioName,
  initialRoles,
  initialSlots,
  initialLevels,
  onChange,
}: Props) {
  const [roles, setRoles] = useState<Role[]>(initialRoles ?? DEFAULT_ROLES.map(r => ({ ...r })));
  const [slots, setSlots] = useState<SlotsByRole>(
    initialSlots ?? emptySlotsByRole(initialRoles ?? DEFAULT_ROLES)
  );
  const [levels, setLevels] = useState<Level[]>(
    initialLevels && initialLevels.length > 0 ? initialLevels : [freshLevel(initialRoles ?? DEFAULT_ROLES)]
  );
  const [activeRole, setActiveRole] = useState<RoleId>(roles[0]?.id ?? '');
  const [newSlotName, setNewSlotName] = useState('');
  const [newRoleLabel, setNewRoleLabel] = useState('');
  const [defaultsOpen, setDefaultsOpen] = useState<Record<string, boolean>>({});
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    onChange(roles, slots, levels);
  }, [roles, slots, levels, onChange]);

  // Make sure activeRole stays valid when roles change.
  useEffect(() => {
    if (roles.length === 0) { setActiveRole(''); return; }
    if (!roles.some(r => r.id === activeRole)) setActiveRole(roles[0].id);
  }, [roles, activeRole]);

  const roleSlots = slots[activeRole] ?? [];

  const resolved = useMemo(
    () => effectiveSlots(levels, activeRole, roleSlots),
    [levels, activeRole, roleSlots]
  );

  // ---- role editing ----
  function addRole() {
    const label = newRoleLabel.trim();
    if (!label) return;
    const baseId = slugify(label);
    let id = baseId;
    let n = 2;
    while (roles.some(r => r.id === id)) { id = `${baseId}-${n++}`; }
    const newRole: Role = { id, label };
    setRoles(rs => [...rs, newRole]);
    setSlots(s => ({ ...s, [id]: [] }));
    setLevels(ls => ls.map(l => ({ ...l, gear: { ...l.gear, [id]: {} } })));
    setNewRoleLabel('');
  }
  function renameRoleLabel(id: RoleId, nextLabel: string) {
    setRoles(rs => rs.map(r => r.id === id ? { ...r, label: nextLabel } : r));
  }
  function removeRole(id: RoleId) {
    if (roles.length <= 1) return; // require at least one
    setRoles(rs => rs.filter(r => r.id !== id));
    setSlots(s => {
      const { [id]: _, ...rest } = s;
      return rest;
    });
    setLevels(ls => ls.map(l => {
      const { [id]: _, ...rest } = l.gear;
      return { ...l, gear: rest };
    }));
  }

  // ---- slot definition editing ----
  function addSlot() {
    const name = newSlotName.trim();
    if (!name) return;
    if (roleSlots.some(s => s.name.toLowerCase() === name.toLowerCase())) return;
    setSlots(s => ({ ...s, [activeRole]: [...(s[activeRole] ?? []), { name }] }));
    setNewSlotName('');
  }
  function renameSlot(idx: number, next: string) {
    const trimmed = next.trim();
    if (!trimmed) return;
    const old = roleSlots[idx]?.name;
    if (!old || old === trimmed) return;
    if (roleSlots.some((s, i) => i !== idx && s.name.toLowerCase() === trimmed.toLowerCase())) return;
    setSlots(s => ({
      ...s,
      [activeRole]: (s[activeRole] ?? []).map((v, i) => i === idx ? { ...v, name: trimmed } : v),
    }));
    setLevels(ls => ls.map(l => {
      const role = l.gear[activeRole] ?? {};
      if (!Object.prototype.hasOwnProperty.call(role, old)) return l;
      const { [old]: moved, ...rest } = role;
      return { ...l, gear: { ...l.gear, [activeRole]: { ...rest, [trimmed]: moved } } };
    }));
  }
  function removeSlot(idx: number) {
    const name = roleSlots[idx]?.name;
    if (!name) return;
    setSlots(s => ({ ...s, [activeRole]: (s[activeRole] ?? []).filter((_, i) => i !== idx) }));
    setLevels(ls => ls.map(l => {
      const role = l.gear[activeRole] ?? {};
      if (!Object.prototype.hasOwnProperty.call(role, name)) return l;
      const { [name]: _, ...rest } = role;
      return { ...l, gear: { ...l.gear, [activeRole]: rest } };
    }));
  }
  function moveSlot(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= roleSlots.length) return;
    setSlots(s => {
      const arr = [...(s[activeRole] ?? [])];
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return { ...s, [activeRole]: arr };
    });
  }

  function patchSlotDefault(idx: number, patch: Partial<SlotValue>) {
    setSlots(s => ({
      ...s,
      [activeRole]: (s[activeRole] ?? []).map((d, i) => {
        if (i !== idx) return d;
        const base: SlotValue = d.default && typeof d.default === 'object' ? d.default : { name: '' };
        return { ...d, default: { ...base, ...patch } };
      }),
    }));
  }
  function clearSlotDefault(idx: number) {
    setSlots(s => ({
      ...s,
      [activeRole]: (s[activeRole] ?? []).map((d, i) => i === idx ? { name: d.name } : d),
    }));
  }
  function toggleDefaultsOpen(slotName: string) {
    const key = `${activeRole}::${slotName}`;
    setDefaultsOpen(o => ({ ...o, [key]: !o[key] }));
  }

  // ---- level editing ----
  function addLevel() {
    setLevels(ls => [
      ...ls,
      { id: (ls[ls.length - 1]?.id ?? 0) + 1, name: `Level ${ls.length + 1}`, gear: emptyGearByRole(roles) },
    ]);
  }
  function removeLevel(idx: number) {
    setLevels(ls => ls.filter((_, i) => i !== idx));
  }
  function updateLevel(idx: number, patch: Partial<Level>) {
    setLevels(ls => ls.map((l, i) => i === idx ? { ...l, ...patch } : l));
  }

  function updateSlotEntry(
    levelIdx: number,
    slot: string,
    next: SlotValue | null | undefined  // undefined => remove the key (inherit)
  ) {
    setLevels(ls => ls.map((l, i) => {
      if (i !== levelIdx) return l;
      const role = { ...(l.gear[activeRole] ?? {}) };
      if (next === undefined) {
        delete role[slot];
      } else {
        role[slot] = next;
      }
      return { ...l, gear: { ...l.gear, [activeRole]: role } };
    }));
  }

  function setMode(levelIdx: number, slot: string, mode: CellMode, currentInherited: SlotValue | null) {
    if (mode === 'inherit') updateSlotEntry(levelIdx, slot, undefined);
    else if (mode === 'clear') updateSlotEntry(levelIdx, slot, null);
    else {
      updateSlotEntry(levelIdx, slot, currentInherited ?? { name: '' });
    }
  }

  function patchValue(levelIdx: number, slot: string, patch: Partial<SlotValue>) {
    setLevels(ls => ls.map((l, i) => {
      if (i !== levelIdx) return l;
      const role = l.gear[activeRole] ?? {};
      const cur = role[slot];
      const base: SlotValue = cur && typeof cur === 'object' ? cur : { name: '' };
      const nextVal: SlotValue = { ...base, ...patch };
      return { ...l, gear: { ...l.gear, [activeRole]: { ...role, [slot]: nextVal } } };
    }));
  }

  // ---- import ----
  function parseImportPayload(text: string): { roles: Role[]; slots: SlotsByRole; levels: Level[] } {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (e) {
      throw new Error(`Invalid JSON: ${(e as Error).message}`);
    }
    if (!raw || typeof raw !== 'object') throw new Error('Expected a JSON object at the top level.');
    const obj = raw as Record<string, unknown>;

    if (!Array.isArray(obj.roles)) throw new Error('Missing or invalid "roles" array.');
    const importedRoles: Role[] = obj.roles.map((r, i) => {
      if (!r || typeof r !== 'object') throw new Error(`roles[${i}] is not an object.`);
      const rec = r as Record<string, unknown>;
      const id = typeof rec.id === 'string' ? rec.id.trim() : '';
      const label = typeof rec.label === 'string' ? rec.label : id;
      if (!id) throw new Error(`roles[${i}] is missing a string "id".`);
      return { id, label };
    });
    if (importedRoles.length === 0) throw new Error('"roles" must contain at least one role.');
    const roleIds = new Set(importedRoles.map(r => r.id));

    if (!obj.slots || typeof obj.slots !== 'object' || Array.isArray(obj.slots)) {
      throw new Error('Missing or invalid "slots" object.');
    }
    const importedSlots: SlotsByRole = emptySlotsByRole(importedRoles);
    for (const [roleId, defs] of Object.entries(obj.slots as Record<string, unknown>)) {
      if (!roleIds.has(roleId)) continue; // ignore slots for unknown roles
      if (!Array.isArray(defs)) throw new Error(`slots["${roleId}"] is not an array.`);
      importedSlots[roleId] = defs.map((d, i) => {
        if (typeof d === 'string') return { name: d };
        if (d && typeof d === 'object') {
          const rec = d as Record<string, unknown>;
          const name = typeof rec.name === 'string' ? rec.name : '';
          if (!name) throw new Error(`slots["${roleId}"][${i}] is missing "name".`);
          const def: SlotDef = { name };
          if (rec.default && typeof rec.default === 'object') {
            const dv = rec.default as Record<string, unknown>;
            def.default = {
              name: typeof dv.name === 'string' ? dv.name : '',
              notes: typeof dv.notes === 'string' ? dv.notes : undefined,
              color: typeof dv.color === 'string' ? dv.color : undefined,
            };
          } else if (rec.default === null) {
            def.default = null;
          }
          return def;
        }
        throw new Error(`slots["${roleId}"][${i}] must be a string or object.`);
      });
    }

    if (!Array.isArray(obj.levels)) throw new Error('Missing or invalid "levels" array.');
    const importedLevels: Level[] = obj.levels.map((l, i) => {
      if (!l || typeof l !== 'object') throw new Error(`levels[${i}] is not an object.`);
      const rec = l as Record<string, unknown>;
      const idNum = typeof rec.id === 'number' ? rec.id : Number(rec.id);
      const id = Number.isFinite(idNum) ? idNum : i + 1;
      const name = typeof rec.name === 'string' && rec.name.trim() ? rec.name : `Level ${id}`;
      const gearIn = rec.gear && typeof rec.gear === 'object' ? rec.gear as Record<string, unknown> : {};
      const gear: LevelGearByRole = emptyGearByRole(importedRoles);
      for (const roleId of roleIds) {
        const roleMap = gearIn[roleId];
        if (!roleMap || typeof roleMap !== 'object') continue;
        const out: Record<string, SlotValue | null> = {};
        for (const [slot, v] of Object.entries(roleMap as Record<string, unknown>)) {
          if (v === null) {
            out[slot] = null;
          } else if (v && typeof v === 'object') {
            const vv = v as Record<string, unknown>;
            out[slot] = {
              name: typeof vv.name === 'string' ? vv.name : '',
              notes: typeof vv.notes === 'string' ? vv.notes : undefined,
              color: typeof vv.color === 'string' ? vv.color : undefined,
            };
          }
        }
        gear[roleId] = out;
      }
      return { id, name, gear };
    });
    if (importedLevels.length === 0) throw new Error('"levels" must contain at least one level.');

    return { roles: importedRoles, slots: importedSlots, levels: importedLevels };
  }

  function builderHasUserData(): boolean {
    if (roles.length !== DEFAULT_ROLES.length) return true;
    for (let i = 0; i < roles.length; i++) {
      if (roles[i].id !== DEFAULT_ROLES[i].id || roles[i].label !== DEFAULT_ROLES[i].label) return true;
    }
    for (const r of roles) {
      if ((slots[r.id] ?? []).length > 0) return true;
    }
    if (levels.length !== 1) return true;
    const lone = levels[0];
    for (const r of roles) {
      if (Object.keys(lone.gear?.[r.id] ?? {}).length > 0) return true;
    }
    return false;
  }

  function applyImport(parsed: { roles: Role[]; slots: SlotsByRole; levels: Level[] }) {
    setRoles(parsed.roles);
    setSlots(parsed.slots);
    setLevels(parsed.levels);
    setActiveRole(parsed.roles[0]?.id ?? '');
    setDefaultsOpen({});
    const maxId = parsed.levels.reduce((m, l) => Math.max(m, l.id), 0);
    if (maxId >= nextId) nextId = maxId + 1;
  }

  async function handleImportFile(file: File) {
    setImportError(null);
    try {
      const text = await file.text();
      const parsed = parseImportPayload(text);
      if (builderHasUserData()) {
        const ok = window.confirm('Replace current builder contents with the imported scenario?');
        if (!ok) return;
      }
      applyImport(parsed);
    } catch (e) {
      setImportError((e as Error).message);
    }
  }

  function triggerImport() {
    setImportError(null);
    fileInputRef.current?.click();
  }

  // ---- export ----
  function handleExport() {
    const id = slugify(scenarioName || 'custom');
    const exportSlots: Record<string, Array<string | { name: string; default?: SlotValue | null }>> = {};
    for (const r of roles) {
      exportSlots[r.id] = (slots[r.id] ?? []).map(d =>
        d.default ? { name: d.name, default: d.default } : d.name
      );
    }
    const payload = {
      id,
      name: scenarioName || 'Custom Scenario',
      description: null,
      roles: roles.map(r => ({ id: r.id, label: r.label })),
      slots: exportSlots,
      levels,
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="builder">
      <div className="builder-roles-editor">
        <div className="builder-slots-header">Roles</div>
        <ul className="builder-role-defs">
          {roles.map(r => (
            <li key={r.id}>
              <input
                value={r.label}
                onChange={e => renameRoleLabel(r.id, e.target.value)}
                aria-label={`Role ${r.id} label`}
              />
              <span className="role-id-badge" title="role id">{r.id}</span>
              <button
                type="button"
                onClick={() => removeRole(r.id)}
                disabled={roles.length <= 1}
                aria-label={`Remove role ${r.label}`}
              >×</button>
            </li>
          ))}
        </ul>
        <div className="builder-add-slot">
          <input
            value={newRoleLabel}
            onChange={e => setNewRoleLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRole(); } }}
            placeholder="New role label (e.g. Support)"
          />
          <button type="button" onClick={addRole}>+ Add role</button>
        </div>
      </div>

      <div className="role-selector" role="radiogroup" aria-label="Edit gear for role">
        <span className="role-selector-label">Editing role:</span>
        {roles.map(r => (
          <button
            type="button"
            key={r.id}
            role="radio"
            aria-checked={activeRole === r.id}
            className={`role-pill${activeRole === r.id ? ' active' : ''}`}
            onClick={() => setActiveRole(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {activeRole && (
        <div className="builder-slots-editor">
          <div className="builder-slots-header">
            Slots for {roles.find(r => r.id === activeRole)?.label}
          </div>
          {roleSlots.length === 0 && <p className="gear-empty">No slots yet — add one below.</p>}
          <ul className="builder-slot-defs">
            {roleSlots.map((def, i) => {
              const key = `${activeRole}::${def.name}`;
              const open = !!defaultsOpen[key];
              const dv = def.default ?? null;
              return (
                <li key={i} className="builder-slot-def">
                  <div className="builder-slot-def-row">
                    <input
                      value={def.name}
                      onChange={e => renameSlot(i, e.target.value)}
                      aria-label={`Slot ${i + 1} name`}
                    />
                    <button
                      type="button"
                      onClick={() => toggleDefaultsOpen(def.name)}
                      aria-expanded={open}
                      title="Default value (shown when slot is empty or cleared)"
                    >
                      {dv ? `default: ${dv.name || '(unnamed)'}` : '+ default'}
                    </button>
                    <button type="button" onClick={() => moveSlot(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                    <button type="button" onClick={() => moveSlot(i, 1)} disabled={i === roleSlots.length - 1} aria-label="Move down">↓</button>
                    <button type="button" onClick={() => removeSlot(i)} aria-label="Remove slot">×</button>
                  </div>
                  {open && (
                    <div className="builder-slot-default">
                      <div className="builder-slot-fields">
                        <input
                          value={dv?.name ?? ''}
                          onChange={e => patchSlotDefault(i, { name: e.target.value })}
                          placeholder="Default item name"
                        />
                        <input
                          value={dv?.notes ?? ''}
                          onChange={e => patchSlotDefault(i, { notes: e.target.value })}
                          placeholder="Notes"
                        />
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <input
                            type="color"
                            value={dv?.color ?? '#222831'}
                            onChange={e => patchSlotDefault(i, { color: e.target.value })}
                            aria-label="Default background color"
                          />
                          <span title="Color">🎨</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => clearSlotDefault(i)}
                          disabled={!dv}
                          title="Remove default"
                        >no default</button>
                      </div>
                      <p className="builder-slot-default-hint muted">
                        Shown on this slot whenever a level inherits empty or is explicitly cleared.
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="builder-add-slot">
            <input
              value={newSlotName}
              onChange={e => setNewSlotName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSlot(); } }}
              placeholder="New slot name (e.g. weapon)"
            />
            <button type="button" onClick={addSlot}>+ Add slot</button>
          </div>
        </div>
      )}

      {levels.map((lvl, idx) => {
        const rowResolved = resolved[idx] ?? [];
        return (
          <div key={lvl.id} className="builder-level">
            <div className="builder-level-header">
              <input
                className="builder-level-name"
                value={lvl.name}
                onChange={e => updateLevel(idx, { name: e.target.value })}
                placeholder="Level name"
              />
              <button type="button" onClick={() => removeLevel(idx)} disabled={levels.length === 1}>Remove level</button>
            </div>
            {!activeRole ? (
              <p className="gear-empty">Add at least one role above to edit levels.</p>
            ) : roleSlots.length === 0 ? (
              <p className="gear-empty">Define slots above to edit values per level.</p>
            ) : (
              <div className="builder-slot-rows">
                {roleSlots.map((def, sIdx) => {
                  const slot = def.name;
                  const mode = cellMode(lvl, activeRole, slot);
                  const inheritedValue = rowResolved[sIdx]?.value ?? null;
                  const defaultValue = def.default ?? null;
                  const explicit = lvl.gear[activeRole]?.[slot];
                  const editing = mode === 'set' && explicit && typeof explicit === 'object' ? explicit : null;
                  return (
                    <div key={slot} className={`builder-slot-row mode-${mode}`}>
                      <div className="builder-slot-label">{slot}</div>
                      <div className="builder-slot-mode">
                        <label><input type="radio" name={`mode-${lvl.id}-${slot}`} checked={mode === 'inherit'} onChange={() => setMode(idx, slot, 'inherit', inheritedValue)} /> inherit</label>
                        <label><input type="radio" name={`mode-${lvl.id}-${slot}`} checked={mode === 'set'} onChange={() => setMode(idx, slot, 'set', inheritedValue)} /> set</label>
                        <label><input type="radio" name={`mode-${lvl.id}-${slot}`} checked={mode === 'clear'} onChange={() => setMode(idx, slot, 'clear', inheritedValue)} /> clear</label>
                      </div>
                      {mode === 'set' && (
                       <div className="builder-slot-fields">
                          <input value={editing?.name ?? ''} onChange={e => patchValue(idx, slot, { name: e.target.value })} placeholder="Item name" />
                          <input value={editing?.notes ?? ''} onChange={e => patchValue(idx, slot, { notes: e.target.value })} placeholder="Notes" />
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input type="color" value={editing?.color ?? '#222831'} onChange={e => patchValue(idx, slot, { color: e.target.value })} aria-label="Background color" />
                            <span title="Color">🎨</span>
                          </label>
                        </div>
                      )}
                      {mode === 'inherit' && (
                        <div className="builder-slot-preview muted">
                          inherits: {inheritedValue
                            ? inheritedValue.name
                            : defaultValue
                              ? <>default: <em>{defaultValue.name || '(unnamed)'}</em></>
                              : <em>empty</em>}
                        </div>
                      )}
                      {mode === 'clear' && (
                        <div className="builder-slot-preview muted">
                          cleared from this level on
                          {defaultValue && <> · default: <em>{defaultValue.name || '(unnamed)'}</em></>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      <div className="builder-actions">
        <button type="button" onClick={addLevel}>+ Add level</button>
        <button type="button" onClick={triggerImport} title="Load roles, slots and levels from a previously exported JSON file">
          ⬆ Import JSON
        </button>
        <button type="button" onClick={handleExport} title="Download current builder state as a template-shaped JSON file">
          ⬇ Export to JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) void handleImportFile(f);
            e.target.value = '';
          }}
        />
      </div>
      {importError && <p className="error" role="alert">Import failed: {importError}</p>}
    </div>
  );
}
