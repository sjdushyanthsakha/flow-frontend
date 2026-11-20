import { useAuth0 } from '@auth0/auth0-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { hasAuth0Configuration } from '../../auth/AuthProvider';
import { Icon } from '../../lib/icons';
import { notificationWorkspace, requestApi, type Feed, type RequestApi, type Workspace } from './api';

type Props = {
  unreadCount?: number;
  onUnreadCount: (count: number) => void;
  onViewAll: () => void;
};

function Preview({ unreadCount, onUnreadCount, onViewAll, request }: Props & { request: RequestApi }) {
  const [open, setOpen] = useState(false);
  const [feed, setFeed] = useState<Feed>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const focusOnOpen = useRef(false);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    if (focusOnOpen.current) closeButton.current?.focus();
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    request<Feed>('notifications?limit=3', { signal: controller.signal }).then((result) => {
      if (!controller.signal.aborted) {
        setFeed(result);
        onUnreadCount(result.unreadCount);
      }
    }).catch((failure: Error) => {
      if (!controller.signal.aborted) setError(failure.message);
    });
    return () => controller.abort();
  }, [open, attempt, request, onUnreadCount]);

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  return (
    <div className="notification-wrap" ref={container}>
      <button className="icon-button notification-button" type="button" ref={trigger} aria-label="Notifications"
        aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
        onClick={(event) => {
          if (open) { close(); return; }
          focusOnOpen.current = event.detail === 0;
          setFeed(undefined);
          setError('');
          setOpen(true);
        }}>
        <Icon name="bell" />{Boolean(unreadCount) && <i />}
      </button>
      {open && (
        <section className="notification-popover" role="dialog" id={id} aria-labelledby={`${id}-title`}>
          <header className="notification-preview-header">
            <div><span className="eyebrow">Inbox</span><h2 id={`${id}-title`}>Notifications</h2></div>
            <button className="icon-button" type="button" ref={closeButton} aria-label="Close notifications"
              onClick={() => close()}><Icon name="close" /></button>
          </header>
          {feed?.items.length ? <ul className="notification-preview-list">
            {feed.items.map((item) => (
              <li key={item.id}>
                <span className={item.readAt ? 'preview-dot preview-dot--read' : 'preview-dot'} aria-hidden="true" />
                <div><strong>{item.title}</strong><p>{item.body}</p></div>
                {!item.readAt && <span className="sr-only">Unread</span>}
              </li>
            ))}
          </ul> : <div className="notification-preview-state">
            {error ? <><p role="alert">{error}</p><button className="text-button" type="button" onClick={() => {
              setAttempt((value) => value + 1);
              setError('');
            }}>Retry</button></> : <p role="status">{feed ? 'No notifications yet.' : 'Loading notifications…'}</p>}
          </div>}
          <button className="notification-center-button" type="button" onClick={() => { close(); onViewAll(); }}>
            View notification center
          </button>
        </section>
      )}
    </div>
  );
}

function AuthenticatedPreview(props: Props) {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const request = useCallback<RequestApi>(async (path, options) => {
    if (!isAuthenticated) throw new Error('Sign in to view your notifications.');
    const token = await getAccessTokenSilently();
    const workspaces = await requestApi<Workspace[]>('notifications/workspaces', options, token);
    const workspaceId = notificationWorkspace(workspaces);
    if (!workspaceId) throw new Error('You don’t have access to a workspace.');
    const headers = new Headers(options?.headers);
    headers.set('X-Workspace-Id', workspaceId);
    return requestApi(path, { ...options, headers }, token);
  }, [getAccessTokenSilently, isAuthenticated]);
  return <Preview {...props} request={request} />;
}

export function NotificationPreview(props: Props) {
  return hasAuth0Configuration() ? <AuthenticatedPreview {...props} /> : <Preview {...props} request={requestApi} />;
}
