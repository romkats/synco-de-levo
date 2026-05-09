import type { TemplateSummary, Template } from '../types';

export async function listTemplates(): Promise<TemplateSummary[]> {
  const res = await fetch('/api/templates');
  if (!res.ok) throw new Error(`Failed to list templates: ${res.status}`);
  return res.json();
}

export async function getTemplate(id: string): Promise<Template> {
  const res = await fetch(`/api/templates/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Failed to get template: ${res.status}`);
  return res.json();
}
