export type ProjectView = 'overview' | 'board' | 'timeline';

export function projectPath(id: string, view: ProjectView = 'overview') {
  return `/projects/${encodeURIComponent(id)}${view === 'overview' ? '' : `/${view}`}`;
}

export function projectRoute(pathname: string): { id: string; view: ProjectView } | undefined {
  const match = /^\/projects\/([^/]+)(?:\/(board|timeline))?\/?$/.exec(pathname);
  if (!match) return undefined;
  const view = match[2] === 'board' || match[2] === 'timeline' ? match[2] : 'overview';
  return { id: match[1], view };
}
