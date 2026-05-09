export type SlotValue = {
  name: string;
  notes?: string | null;
  color?: string | null;
};

// Roles are free-form strings owned by each scenario/template.
export type RoleId = string;
export type Role = { id: RoleId; label: string };

// Built-in starter roles offered when seeding a fresh custom scenario.
export const DEFAULT_ROLES: Role[] = [
  { id: 'tank',   label: 'Tank' },
  { id: 'healer', label: 'Healer' },
  { id: 'dps',    label: 'DPS' },
];

export type SlotDef = {
  name: string;
  default?: SlotValue | null;
};

// Per-role, per-slot map.
//   - key absent             -> inherit from previous level
//   - key present, value null -> explicit clear
//   - key present, value set  -> explicit value
export type LevelGearByRole = Record<RoleId, Record<string, SlotValue | null>>;

export type SlotsByRole = Record<RoleId, SlotDef[]>;

export type Level = { id: number; name: string; gear: LevelGearByRole };

export type Scenario = {
  id: string;
  name: string;
  createdAt: string;
  roles: Role[];
  slots: SlotsByRole;
  levels: Level[];
  activeLevelId: number | null;
};

export type TemplateSummary = { id: string; name: string; description?: string | null; levelCount: number };

export type Template = {
  id: string;
  name: string;
  description?: string | null;
  roles: Role[];
  slots: SlotsByRole;
  levels: Level[];
};

export type CreateScenarioRequest =
  | { name: string; source: 'template'; templateId: string }
  | { name: string; source: 'custom'; roles: Role[]; slots: SlotsByRole; levels: Level[] };

export type CreateScenarioResponse = { scenarioId: string; leaderToken: string; scenario: Scenario };

export function emptySlotsByRole(roles: Role[]): SlotsByRole {
  return roles.reduce((acc, r) => { acc[r.id] = []; return acc; }, {} as SlotsByRole);
}

export function emptyGearByRole(roles: Role[]): LevelGearByRole {
  return roles.reduce((acc, r) => { acc[r.id] = {}; return acc; }, {} as LevelGearByRole);
}

export type SlotCellState = 'set' | 'cleared' | 'empty';

export type ResolvedSlot = {
  slot: string;
  value: SlotValue | null;
  defaultValue: SlotValue | null;
  state: SlotCellState;     // resolved state at this level
  changed: boolean;          // true if the level itself made the change
};

/**
 * For each level in order, returns the resolved per-slot state for the given
 * role, applying inheritance:
 *   - missing key in level.gear[role] -> inherit previous level's resolved value
 *   - explicit null in level.gear[role] -> "cleared" at this level (changed=true)
 *   - explicit object -> "set" at this level (changed=true)
 *
 * The returned slot order matches `slots` (the role's declared slot order).
 */
export function effectiveSlots(
  levels: Level[],
  role: RoleId,
  slots: SlotDef[]
): ResolvedSlot[][] {
  const carrier: Record<string, { value: SlotValue | null; state: SlotCellState }> = {};
  for (const def of slots) carrier[def.name] = { value: null, state: 'empty' };

  return levels.map(level => {
    const explicit = level.gear?.[role] ?? {};
    return slots.map<ResolvedSlot>(def => {
      const slot = def.name;
      const defaultValue = def.default ?? null;
      const hasExplicit = Object.prototype.hasOwnProperty.call(explicit, slot);
      if (hasExplicit) {
        const v = explicit[slot];
        if (v === null) {
          carrier[slot] = { value: null, state: 'cleared' };
        } else {
          carrier[slot] = { value: v, state: 'set' };
        }
        return { slot, value: carrier[slot].value, defaultValue, state: carrier[slot].state, changed: true };
      }
      const inherited = carrier[slot];
      return { slot, value: inherited.value, defaultValue, state: inherited.state, changed: false };
    });
  });
}
