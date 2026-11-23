export type Project = {
  id: string;
  name: string;
  description: string | null;
  startDate: string | null;
  status: string;
  dueDate: string | null;
  members: string[];
  owner: string | null;
  ownerId: string | null;
};

export type Task = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  project: string;
  status: string;
  priority: string | null;
  assigneeId: string | null;
  assignee: string | null;
  startDate: string | null;
  createdAt: string;
  dueDate: string | null;
  updatedAt: string;
  boardPosition: number | null;
  estimateMinutes: number | null;
};

export type Member = { id: string; name: string; role: string };

export type Dashboard = {
  userId: string;
  displayName: string;
  workspaceName: string;
  role: string;
  timezone: string;
  canViewAdministration: boolean;
  activeSprint: { name: string; daysRemaining: number } | null;
  projects: Project[];
  tasks: Task[];
  members: Member[];
};

const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/$/, '');

export class DashboardRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function dashboardUrl(path = '') {
  return `${apiUrl}/dashboard${path}`;
}

export async function dashboardResponse(path = '', options?: RequestInit): Promise<Response> {
  const headers = new Headers(options?.headers);
  if (options?.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(dashboardUrl(path), { credentials: 'include', ...options, headers });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new DashboardRequestError(response.status < 500 && typeof error?.message === 'string'
      ? error.message : 'The dashboard API is unavailable.', response.status);
  }
  return response;
}

export async function dashboardRequest<T>(path = '', options?: RequestInit): Promise<T> {
  const response = await dashboardResponse(path, options);
  return response.json();
}

export function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
}

export const isDone = (task: Pick<Task, 'status'>) => ['done', 'completed', 'complete'].includes(task.status.toLowerCase());

export function dateLabel(value: string | null) {
  if (!value) return 'No due date';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(value));
}

export function dateKey(date: Date, timezone?: string) {
  if (timezone) {
    const parts = new Intl.DateTimeFormat('en', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    return ['year', 'month', 'day'].map((type) => parts.find((part) => part.type === type)?.value).join('-');
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function formatCapacity(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours}h${remainder ? ` ${remainder}m` : ''}` : remainder ? `${remainder}m` : '0h';
}
