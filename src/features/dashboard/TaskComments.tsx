import { useEffect, useState, type FormEvent } from 'react';
import { Icon } from '../../lib/icons';
import { initials } from './data';
import { useDashboardRequest } from '../../auth/DashboardSession';

type Comment = { id: string; author: string; body: string; createdAt: string };
type Page = { items: Comment[]; nextCursor: string | null };
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function TaskComments({ taskId, onPosted, drawerUser }: { taskId: string; onPosted: () => void; drawerUser?: string }) {
  const dashboardRequest = useDashboardRequest();
  const path = `/tasks/${taskId}/comments`;
  const [page, setPage] = useState<Page>();
  const [body, setBody] = useState('');
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    dashboardRequest<Page>(path, { signal: controller.signal }).then((result) => {
      if (!controller.signal.aborted) setPage(result);
    }).catch((failure: Error) => {
      if (!controller.signal.aborted) setError(failure.message);
    });
    return () => controller.abort();
  }, [path, attempt]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const comment = await dashboardRequest<Comment>(path, {
        method: 'POST',
        body: JSON.stringify({ body, requestId }),
      });
      setPage((current) => current && {
        ...current,
        items: [comment, ...current.items.filter(({ id }) => id !== comment.id)],
      });
      setBody('');
      onPosted();
      setRequestId(crypto.randomUUID());
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function loadMore() {
    if (!page?.nextCursor || busy) return;
    setBusy(true);
    setError('');
    try {
      const next = await dashboardRequest<Page>(`${path}?cursor=${encodeURIComponent(page.nextCursor)}`);
      setPage({ ...next, items: [...page.items, ...next.items] });
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const form = <form onSubmit={(event) => void submit(event)}>
    <label><span className={drawerUser ? 'sr-only' : undefined}>Add a comment</span>
      <textarea rows={drawerUser ? 4 : 2} maxLength={5000} required value={body} disabled={busy}
        placeholder={drawerUser ? 'Write a comment…' : undefined} onChange={(event) => {
          setBody(event.target.value);
          setRequestId(crypto.randomUUID());
        }} />
    </label>
    <div className={drawerUser ? 'drawer-comment-actions' : undefined}>
      <button type="submit" className={`button button--${drawerUser ? 'primary' : 'secondary'}`} disabled={busy || !body.trim()}>
        {drawerUser && <Icon name="comment" />}{drawerUser ? 'Comment' : 'Post comment'}
      </button>
    </div>
  </form>;

  return (
    <section className={drawerUser ? 'task-comments drawer-comments' : 'task-comments'} aria-label="Task comments">
      {!drawerUser && <h3>Comments</h3>}
      {error && <p className="field-error" role="alert">{error}</p>}
      {!page && (error
        ? <button type="button" className="text-button" onClick={() => { setError(''); setAttempt((value) => value + 1); }}>Retry</button>
        : <p role="status">Loading comments…</p>)}
      {page && (
        <>
          {drawerUser && <div className="drawer-comment-compose"><span className="avatar avatar--me" aria-hidden="true">{initials(drawerUser)}</span>{form}</div>}
          {page.items.length ? (
            <ul>
              {page.items.map((item) => (
                <li key={item.id}>
                  <strong>{item.author}</strong> <time dateTime={item.createdAt}>{dateFormat.format(new Date(item.createdAt))}</time>
                  <p>{item.body}</p>
                </li>
              ))}
            </ul>
          ) : <p className={drawerUser ? 'drawer-comments-empty' : undefined}>
            {drawerUser ? 'No comments yet. Start the conversation.' : 'No comments yet.'}
          </p>}
          {page.nextCursor && <button type="button" className="text-button" disabled={busy} onClick={() => void loadMore()}>Load older comments</button>}
          {!drawerUser && form}
        </>
      )}
    </section>
  );
}
