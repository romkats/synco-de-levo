const KEY_PREFIX = 'leaderToken:';

export function getLeaderToken(scenarioId: string): string | null {
  return localStorage.getItem(KEY_PREFIX + scenarioId);
}

export function setLeaderToken(scenarioId: string, token: string): void {
  localStorage.setItem(KEY_PREFIX + scenarioId, token);
}

export function clearLeaderToken(scenarioId: string): void {
  localStorage.removeItem(KEY_PREFIX + scenarioId);
}
