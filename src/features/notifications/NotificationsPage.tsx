import { useAuth0 } from '@auth0/auth0-react';
import { useCallback, useEffect, useState } from 'react';
import { OperationsHeading } from '../../components/workspace/OperationsLayout';
import { Icon } from '../../lib/icons';
import { hasAuth0Configuration } from '../../auth/AuthProvider';
import { notificationWorkspace, requestApi, setNotificationWorkspace, type EventType, type Feed, type RequestApi, type Workspace } from './api';

const labels = {
  assignment: 'Assignment',
  status: 'Status',
  deadline: 'Deadline',
  comment: 'Comment',
  membership: 'Membership',
} as const;

type Filter = 'all' | 'unread' | EventType;
type Preferences = Record<Exclude<EventType, 'status'>, boolean>;
const filters: Filter[] = ['all', 'unread', 'assignment', 'deadline', 'comment', 'status', 'membership'];
const settings = {
  assignment: 'Task assignments',
  deadline: 'Deadlines',
  comment: 'Comments and mentions',
  membership: 'Project membership',
} as const;
const fullTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const minutesAgo = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'short' });

function formatTime(value: string) {
  const elapsed = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60000));
  if (!elapsed) return 'Just now';
  if (elapsed < 60) return minutesAgo.format(-elapsed, 'minute');
  if (elapsed < 1440) return relative.format(-Math.floor(elapsed / 60), 'hour');
  if (elapsed < 10080) return relative.format(-Math.floor(elapsed / 1440), 'day');
  return fullTime.format(new Date(value));
}

const filterLabel = (filter: Filter) => filter === 'all' ? 'All' : filter === 'unread' ? 'Unread' : labels[filter];

function feedPath(filter: Filter, cursor?: string) {
  const search = new URLSearchParams();
  if (filter === 'unread') search.set('unread', 'true');
  else if (filter !== 'all') search.set('type', filter);
  if (cursor) search.set('cursor', cursor);
  return `notifications?${search}`;
}

function Inbox({ request, onUnreadCount }: { request: RequestApi; onUnreadCount?: (count: number) => void }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [feed, setFeed] = useState<Feed>();
  const [counts, setCounts] = useState<Partial<Record<Filter, number>>>({});
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showPreferences, setShowPreferences] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    request<Feed>(feedPath(filter), { signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      setFeed(result);
      setCounts({ ...result.counts, unread: result.unreadCount, all: Object.values(result.counts ?? {}).reduce((sum, count) => sum + count, 0) });
      onUnreadCount?.(result.unreadCount);
    }).catch((failure: Error) => {
      if (!controller.signal.aborted) setError(failure.message);
    });
    return () => controller.abort();
  }, [filter, request, revision, onUnreadCount]);

  function reload() {
    setError('');
    setFeed(undefined);
    setRevision((value) => value + 1);
  }

  async function update(path: string, method: string) {
    setBusy(true);
    setError('');
    try {
      await request<void>(path, { method });
      reload();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function loadMore() {
    if (!feed?.nextCursor) return;
    setBusy(true);
    setError('');
    try {
      const next = await request<Feed>(feedPath(filter, feed.nextCursor));
      setFeed({ ...next, items: [...feed.items, ...next.items] });
      setCounts({ ...next.counts, unread: next.unreadCount, all: Object.values(next.counts ?? {}).reduce((sum, count) => sum + count, 0) });
      onUnreadCount?.(next.unreadCount);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return <div className="operations-page notification-center-page">
    <OperationsHeading section="Productivity" title="Notification center" description="Stay current on assignments, deadlines, mentions, and project changes.">
      <button className="button button--secondary" type="button" disabled={busy || !counts.unread}
        onClick={() => void update('notifications/read-all', 'POST')}><Icon name="check" />Mark all read</button>
      <button className="button button--primary" type="button" aria-expanded={showPreferences}
        aria-controls="notification-preferences" onClick={() => setShowPreferences(!showPreferences)}><Icon name="filter" />Preferences</button>
    </OperationsHeading>
    {showPreferences && <PreferencePanel request={request} />}
    <div className="notification-center-layout">
      <nav className="operations-card notification-center-filters" aria-label="Notification filters">
        <span className="eyebrow">Inbox filters</span>
        {filters.map(item => <button key={item} type="button" disabled={busy} aria-pressed={filter === item}
          onClick={() => {
            if (filter === item) return;
            setFilter(item);
            setError('');
            setFeed(undefined);
          }}>{filterLabel(item)}<span>{counts[item] ?? 0}</span></button>)}
      </nav>
      <section className="operations-card notification-center-feed" aria-label="Notification feed" aria-busy={busy || (!feed && !error)}>
        <header><h2>{filter === 'all' ? 'All notifications' : `${filterLabel(filter)} notifications`}</h2>
          <span>{counts[filter] ?? 0} {(counts[filter] ?? 0) === 1 ? 'result' : 'results'}</span></header>
        {error && <div className="operation-empty"><p role="alert">{error}</p>
          <button className="button button--secondary" onClick={reload} type="button">Retry</button></div>}
        {!feed && !error && <p className="operation-empty" role="status">Loading notifications…</p>}
        {feed?.items.length === 0 && <p className="operation-empty" role="status">No notifications here.</p>}
        {!!feed?.items.length && <ul>{feed.items.map((item) => {
          const contents = <>
            <span className="operations-tile"><Icon name="bell" /></span>
            <span className="notification-center-copy"><strong>{item.title}</strong><small>{item.body}</small></span>
            <time dateTime={item.createdAt} title={fullTime.format(new Date(item.createdAt))}>{formatTime(item.createdAt)}</time>
          </>;
          return <li key={item.id}>
            {item.readAt ? <div className="notification-center-item">{contents}</div> :
              <button className="notification-center-item notification-center-unread" type="button" disabled={busy}
                aria-label={`Mark ${item.title} as read`} onClick={() => void update(`notifications/${item.id}/read`, 'PATCH')}>
                {contents}<span className="notification-center-dot" aria-hidden="true" />
              </button>}
          </li>;
        })}</ul>}
        {feed?.nextCursor && <button className="panel-footer-button" type="button" disabled={busy}
          onClick={() => void loadMore()}>Load more</button>}
      </section>
    </div>
  </div>;
}

function PreferencePanel({ request }: { request: RequestApi }) {
  const [preferences, setPreferences] = useState<Preferences>();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    request<Preferences>('notification-preferences', { signal: controller.signal }).then((result) => {
      if (!controller.signal.aborted) setPreferences(result);
    }).catch((failure: Error) => {
      if (!controller.signal.aborted) setError(failure.message);
    });
    return () => controller.abort();
  }, [request, revision]);

  async function save() {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await request<void>('notification-preferences', { method: 'PATCH', body: JSON.stringify(preferences) });
      setSaved(true);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel notification-preferences" id="notification-preferences" aria-label="Notification preferences">
      <div className="panel-heading"><h2>Notification preferences</h2></div>
      {error && <p role="alert">{error}</p>}
      {!preferences && (error ? <button className="button button--secondary" type="button" onClick={() => {
        setError('');
        setRevision((value) => value + 1);
      }}>Retry</button> : <p role="status">Loading preferences…</p>)}
      {preferences && (
        <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <fieldset disabled={saving}>
            <legend className="sr-only">In-app events</legend>
            {(Object.keys(settings) as (keyof Preferences)[]).map((type) => (
              <label key={type}><input type="checkbox" checked={preferences[type]} onChange={(event) => {
                setSaved(false);
                setPreferences({ ...preferences, [type]: event.target.checked });
              }} />{settings[type]}</label>
            ))}
          </fieldset>
          <button className="button button--primary" disabled={saving} type="submit">Save preferences</button>
          {saved && <p role="status">Preferences saved.</p>}
        </form>
      )}
    </section>
  );
}

function AuthenticatedInbox({ onUnreadCount }: { onUnreadCount?: (count: number) => void }) {
  const { getAccessTokenSilently, isAuthenticated, isLoading, loginWithRedirect, error } = useAuth0();
  const [workspaces, setWorkspaces] = useState<Workspace[]>();
  const [workspaceId, setWorkspaceId] = useState('');
  const [workspaceError, setWorkspaceError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return;
    const controller = new AbortController();
    getAccessTokenSilently().then((token) =>
      requestApi<Workspace[]>('notifications/workspaces', { signal: controller.signal }, token)
    ).then((result) => {
      if (controller.signal.aborted) return;
      setWorkspaces(result);
      setWorkspaceId(notificationWorkspace(result) ?? '');
    }).catch((failure: Error) => {
      if (!controller.signal.aborted) setWorkspaceError(failure.message);
    });
    return () => controller.abort();
  }, [isAuthenticated, getAccessTokenSilently, attempt]);

  const request = useCallback<RequestApi>(async (path, options) => {
    const token = await getAccessTokenSilently();
    const headers = new Headers(options?.headers);
    headers.set('X-Workspace-Id', workspaceId);
    return requestApi(path, { ...options, headers }, token);
  }, [getAccessTokenSilently, workspaceId]);

  if (isLoading) return <p role="status">Checking your session…</p>;
  if (!isAuthenticated) return (
    <section className="empty-state">
      {(loginError || error) && <p role="alert">{loginError || error?.message}</p>}
      <button className="button button--primary" type="button"
        onClick={() => void loginWithRedirect({ appState: { returnTo: '/notifications' } })
          .catch((failure: Error) => setLoginError(failure.message))}>Sign in to view notifications</button>
    </section>
  );
  if (workspaceError) return (
    <section className="empty-state">
      <p role="alert">{workspaceError}</p>
      <button className="button button--secondary" type="button" onClick={() => {
        setWorkspaceError('');
        setAttempt((value) => value + 1);
      }}>Retry</button>
    </section>
  );
  if (!workspaces) return <p role="status">Loading workspaces…</p>;
  if (!workspaces.length) return <p role="status">You don’t have access to a workspace.</p>;
  return (
    <>
      {workspaces.length > 1 && <label className="notification-workspace">
        Workspace
        <select value={workspaceId} onChange={(event) => {
          setWorkspaceId(event.target.value);
          setNotificationWorkspace(event.target.value);
        }}>
          {workspaces.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
        </select>
      </label>}
      <Inbox key={workspaceId} request={request} onUnreadCount={onUnreadCount} />
    </>
  );
}

export default function NotificationsPage({ onUnreadCount }: { onUnreadCount?: (count: number) => void }) {
  return hasAuth0Configuration() ? <AuthenticatedInbox onUnreadCount={onUnreadCount} /> : <Inbox request={requestApi} onUnreadCount={onUnreadCount} />;
}
