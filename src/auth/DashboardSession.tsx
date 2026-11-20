import { useAuth0 } from '@auth0/auth0-react';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { dashboardRequest, dashboardResponse } from '../features/dashboard/data';
import { notificationWorkspace, requestApi, setNotificationWorkspace, type Workspace } from '../features/notifications/api';
import { SignedOutPage } from '../features/account/AccountPages';

type Authorize = (options?: RequestInit) => Promise<RequestInit | undefined>;
const DashboardSession = createContext<Authorize>(async (options) => options);

export function AuthenticatedDashboard({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, getAccessTokenSilently } = useAuth0();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;
    const controller = new AbortController();
    getAccessTokenSilently()
      .then((token) => requestApi<Workspace[]>('notifications/workspaces', { signal: controller.signal }, token))
      .then((result) => {
        if (controller.signal.aborted) return;
        setWorkspaces(result);
        setWorkspaceId(notificationWorkspace(result) ?? '');
        if (!result.length) setError('This sign-in is not linked to an active Flow workspace membership.');
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('Could not load your workspaces.');
      });
    return () => controller.abort();
  }, [attempt, getAccessTokenSilently, isAuthenticated]);

  const authorize = useCallback<Authorize>(async (options) => {
    const headers = new Headers(options?.headers);
    headers.set('Authorization', `Bearer ${await getAccessTokenSilently()}`);
    headers.set('X-Workspace-Id', workspaceId);
    return { ...options, headers };
  }, [getAccessTokenSilently, workspaceId]);

  if (isLoading) return <p role="status">Checking sign-in…</p>;
  if (!isAuthenticated) return <SignedOutPage />;
  if (error) return <section className="empty-state">
    <p role="alert">{error}</p>
    <button className="button button--secondary" type="button" onClick={() => {
      setError('');
      setAttempt((value) => value + 1);
    }}>Retry</button>
  </section>;
  if (!workspaceId) return <p role="status">Loading workspaces…</p>;

  return <DashboardSession.Provider key={workspaceId} value={authorize}>
    {workspaces.length > 1 && <label>
      Workspace <select value={workspaceId} onChange={(event) => {
        setNotificationWorkspace(event.target.value);
        setWorkspaceId(event.target.value);
      }}>
        {workspaces.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
      </select>
    </label>}
    {children}
  </DashboardSession.Provider>;
}

export function useDashboardRequest() {
  const authorize = useContext(DashboardSession);
  return useCallback<typeof dashboardRequest>(async (path, options) =>
    dashboardRequest(path, await authorize(options)), [authorize]);
}

export function DashboardDownload({ path, filename, children, ...props }: {
  path: string;
  filename: string;
  children: ReactNode;
  className?: string;
  title?: string;
  'aria-label'?: string;
}) {
  const authorize = useContext(DashboardSession);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function download() {
    setError('');
    setBusy(true);
    try {
      const response = await dashboardResponse(path, await authorize());
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError('Could not download the file.');
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button {...props} type="button" onClick={download} disabled={busy}>{children}</button>
    {error && <span role="alert">{error}</span>}
  </>;
}
