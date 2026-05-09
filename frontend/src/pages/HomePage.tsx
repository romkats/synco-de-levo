import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTemplate, listTemplates } from '../api/templates';
import { createScenario } from '../api/scenarios';
import { setLeaderToken } from '../state/leaderTokens';
import {
  DEFAULT_ROLES,
  emptySlotsByRole,
  type Level,
  type Role,
  type SlotValue,
  type SlotsByRole,
  type TemplateSummary,
} from '../types';
import CustomScenarioBuilder from '../components/CustomScenarioBuilder';

type Mode = 'template' | 'custom';

export default function HomePage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('template');
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState<string>('');
  const [customRoles, setCustomRoles] = useState<Role[]>(DEFAULT_ROLES.map(r => ({ ...r })));
  const [customSlots, setCustomSlots] = useState<SlotsByRole>(emptySlotsByRole(DEFAULT_ROLES));
  const [customLevels, setCustomLevels] = useState<Level[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [builderKey, setBuilderKey] = useState(0);

  useEffect(() => {
    listTemplates()
      .then(ts => {
        setTemplates(ts);
        if (ts.length > 0) setTemplateId(ts[0].id);
      })
      .catch(e => setTemplatesError(e.message));
  }, []);

  async function adjustFromTemplate() {
    setSeedError(null);
    if (!templateId) { setSeedError('Pick a template first'); return; }
    setSeeding(true);
    try {
      const t = await getTemplate(templateId);
      const seededRoles: Role[] = t.roles.map(r => ({ ...r }));
      const seededSlots: SlotsByRole = {};
      for (const r of seededRoles) {
        const defs = t.slots[r.id] ?? [];
        seededSlots[r.id] = defs.map(d => ({
          name: d.name,
          default: d.default ? { ...d.default } : d.default ?? null,
        }));
      }
      const seededLevels: Level[] = t.levels.map(l => {
        const gear: Level['gear'] = {};
        for (const r of seededRoles) {
          const roleMap = l.gear?.[r.id] ?? {};
          const out: Record<string, SlotValue | null> = {};
          for (const [slot, v] of Object.entries(roleMap)) {
            out[slot] = v === null ? null : { ...v };
          }
          gear[r.id] = out;
        }
        return { id: l.id, name: l.name, gear };
      });
      setCustomRoles(seededRoles);
      setCustomSlots(seededSlots);
      setCustomLevels(seededLevels);
      setBuilderKey(k => k + 1);
      setMode('custom');
    } catch (e) {
      setSeedError((e as Error).message);
    } finally {
      setSeeding(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError('Name is required'); return; }

    let req;
    if (mode === 'template') {
      if (!templateId) { setError('Pick a template'); return; }
      req = { name: name.trim(), source: 'template' as const, templateId };
    } else {
      if (customRoles.length === 0) { setError('Add at least one role'); return; }
      const allowedRoleIds = new Set(customRoles.map(r => r.id));
      const cleanedLevels: Level[] = customLevels
        .map(l => {
          const gear = l.gear ?? {};
          const cleanedGear = {} as Level['gear'];
          for (const roleId of allowedRoleIds) {
            const roleMap = gear[roleId] ?? {};
            const out: Record<string, SlotValue | null> = {};
            for (const [slot, v] of Object.entries(roleMap)) {
              if (v === null) {
                out[slot] = null;
              } else if (v && typeof v === 'object') {
                const n = (v.name ?? '').trim();
                if (!n) continue; // skip incomplete set values
                out[slot] = {
                  name: n,
                  notes: v.notes?.toString().trim() || undefined,
                  color: v.color?.toString().trim() || undefined,
                };
              }
            }
            cleanedGear[roleId] = out;
          }
          return { ...l, name: l.name.trim() || `Level ${l.id}`, gear: cleanedGear };
        })
        .filter(l => l.name);
      if (cleanedLevels.length === 0) { setError('Add at least one level'); return; }
      req = {
        name: name.trim(),
        source: 'custom' as const,
        roles: customRoles,
        slots: customSlots,
        levels: cleanedLevels,
      };
    }

    setSubmitting(true);
    try {
      const res = await createScenario(req);
      setLeaderToken(res.scenarioId, res.leaderToken);
      navigate(`/s/${res.scenarioId}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page home">
      <h1>synco-de-levo</h1>
      <p className="tagline">Keep your group in sync on which level is active.</p>

      <form onSubmit={handleSubmit} className="card">
        <h2>Create a scenario</h2>

        <label className="field">
          <span>Scenario name</span>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Friday Night Raid" autoFocus />
        </label>

        <div className="tabs">
          <button type="button" className={mode === 'template' ? 'tab active' : 'tab'} onClick={() => setMode('template')}>From template</button>
          <button type="button" className={mode === 'custom' ? 'tab active' : 'tab'} onClick={() => setMode('custom')}>Custom</button>
        </div>

        {mode === 'template' ? (
          <div className="field">
            {templatesError && <p className="error">Could not load templates: {templatesError}</p>}
            {templates.length === 0 && !templatesError && <p>Loading templates…</p>}
            <ul className="template-list">
              {templates.map(t => (
                <li key={t.id}>
                  <label>
                    <input type="radio" name="template" value={t.id} checked={templateId === t.id} onChange={() => setTemplateId(t.id)} />
                    <span className="template-name">{t.name}</span>
                    <span className="template-meta">{t.levelCount} levels</span>
                    {t.description && <span className="template-desc">{t.description}</span>}
                  </label>
                </li>
              ))}
            </ul>
            <div className="template-actions">
              <button
                type="button"
                onClick={adjustFromTemplate}
                disabled={!templateId || seeding}
                title="Load this template into the Custom builder so you can tweak it before creating"
              >
                {seeding ? 'Loading…' : 'Adjust before creating'}
              </button>
            </div>
            {seedError && <p className="error">Could not load template: {seedError}</p>}
          </div>
        ) : (
          <CustomScenarioBuilder
            key={builderKey}
            scenarioName={name}
            initialRoles={customRoles}
            initialSlots={customSlots}
            initialLevels={customLevels}
            onChange={(roles, slots, levels) => {
              setCustomRoles(roles);
              setCustomSlots(slots);
              setCustomLevels(levels);
            }}
          />
        )}

        {error && <p className="error">{error}</p>}

        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create scenario & become leader'}
        </button>
      </form>
    </div>
  );
}
