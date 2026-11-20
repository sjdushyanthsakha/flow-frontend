export type EventType = 'assignment' | 'status' | 'deadline' | 'comment' | 'membership';

export type Notification = {
  id: string;
  title: string;
  body: string;
  type: EventType;
  readAt: string | null;
  createdAt: string;
};
export type Feed = { items: Notification[]; unreadCount: number; counts: Partial<Record<EventType, number>>; nextCursor: string | null };
export type Workspace = { id: string; name: string };
export type RequestApi = <T>(path: string, options?: RequestInit) => Promise<T>;

const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/$/, '');

export async function requestApi<T>(path: string, options?: RequestInit, token?: string): Promise<T> {
  const headers = new Headers(options?.headers);
  if (options?.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${apiUrl}/${path}`, { credentials: 'include', ...options, headers });
  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new Error(response.status < 500 && typeof problem?.message === 'string'
      ? problem.message : 'The workspace API is unavailable.');
  }
  return response.status === 204 ? undefined as T : response.json();
}

const workspaceStorageKey = 'flowdeck.notification-workspace';

export function notificationWorkspace(workspaces: Workspace[]): string | undefined {
  const selected = sessionStorage.getItem(workspaceStorageKey);
  return workspaces.find(({ id }) => id === selected)?.id ?? workspaces[0]?.id;
}

export function setNotificationWorkspace(id: string) {
  sessionStorage.setItem(workspaceStorageKey, id);
}

export function clearNotificationWorkspace() {
  sessionStorage.removeItem(workspaceStorageKey);
}
