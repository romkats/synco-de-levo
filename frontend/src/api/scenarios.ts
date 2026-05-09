import type { CreateScenarioRequest, CreateScenarioResponse, Scenario } from '../types';

export async function createScenario(req: CreateScenarioRequest): Promise<CreateScenarioResponse> {
  const res = await fetch('/api/scenarios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  });
  if (!res.ok) throw new Error(`Create failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function getScenario(id: string): Promise<Scenario> {
  const res = await fetch(`/api/scenarios/${encodeURIComponent(id)}`);
  if (res.status === 404) throw new Error('Scenario not found');
  if (!res.ok) throw new Error(`Get failed: ${res.status}`);
  return res.json();
}

export async function setActiveLevel(scenarioId: string, levelId: number, leaderToken: string): Promise<void> {
  const res = await fetch(`/api/scenarios/${encodeURIComponent(scenarioId)}/active`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Leader-Token': leaderToken },
    body: JSON.stringify({ levelId })
  });
  if (!res.ok) throw new Error(`Set active failed: ${res.status}`);
}

export async function startTransfer(scenarioId: string, leaderToken: string): Promise<string> {
  const res = await fetch(`/api/scenarios/${encodeURIComponent(scenarioId)}/transfer`, {
    method: 'POST',
    headers: { 'X-Leader-Token': leaderToken }
  });
  if (!res.ok) throw new Error(`Transfer start failed: ${res.status}`);
  const data = await res.json();
  return data.transferToken as string;
}

export async function acceptTransfer(scenarioId: string, transferToken: string): Promise<string> {
  const res = await fetch(`/api/scenarios/${encodeURIComponent(scenarioId)}/transfer/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transferToken })
  });
  if (!res.ok) throw new Error(`Transfer accept failed: ${res.status}`);
  const data = await res.json();
  return data.leaderToken as string;
}

export async function heartbeat(scenarioId: string, leaderToken: string): Promise<boolean> {
  const res = await fetch(`/api/scenarios/${encodeURIComponent(scenarioId)}/heartbeat`, {
    method: 'POST',
    headers: { 'X-Leader-Token': leaderToken }
  });
  return res.ok;
}
