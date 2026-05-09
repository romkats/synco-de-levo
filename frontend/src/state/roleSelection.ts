import type { RoleId } from '../types';

const KEY_PREFIX = 'role:';

export function getSelectedRole(scenarioId: string, fallback: RoleId): RoleId {
  const v = localStorage.getItem(KEY_PREFIX + scenarioId);
  return v && v.length > 0 ? v : fallback;
}

export function setSelectedRole(scenarioId: string, role: RoleId): void {
  localStorage.setItem(KEY_PREFIX + scenarioId, role);
}
