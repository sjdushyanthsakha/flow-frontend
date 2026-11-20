import { useEffect, useState } from 'react';
import { initials } from './data';
import { useDashboardRequest } from '../../auth/DashboardSession';

type Entry = {
  id: string;
  actor: string | null;
  action: 'created' | 'updated' | 'commented';
  fields: string[];
  createdAt: string;
};
type Page = { items: Entry[]; nextCursor: string | null };
const actionText = { created: 'created the task', updated: 'updated the task', commented: 'posted a comment' };
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function TaskActivity({ taskId, drawer = false, withAvatars = false, timezone }: { taskId: string; drawer?: boolean; withAvatars?: boolean; timezone?: string }) {
  const dashboardRequest = useDashboardRequest();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const path = `/tasks/${taskId}/activity${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`;
    dashboardRequest<Page>(path, { signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      setEntries((current) => cursor ? [...current, ...result.items] : result.items);
      setNextCursor(result.nextCursor);
      setLoading(false);
    }).catch((failure: Error) => {
      if (controller.signal.aborted) return;
      setError(failure.message);
      setLoading(false);
    });
    return () => controller.abort();
  }, [taskId, cursor, attempt]);

  const drawerDate = new Intl.DateTimeFormat('en', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: timezone,
  });

  return (
    <section className={drawer ? "task-comments drawer-activity" : "task-comments"} aria-label="Task activity">
      {!drawer && <h3>Activity</h3>}
      {error && <><p className="field-error" role="alert">{error}</p>
        <button type="button" className="text-button" onClick={() => {
          setError('');
          setLoading(true);
          setAttempt((value) => value + 1);
        }}>Retry</button></>}
      {loading && <p role="status">Loading activity…</p>}
      {!loading && !error && !entries.length && <p>No activity recorded yet.</p>}
      {entries.length > 0 && <ul>
        {entries.map((entry) => {
          const actor = entry.actor ?? 'System';
          if (withAvatars) return <li key={entry.id} className="drawer-activity-row">
            <span className="avatar avatar--me" aria-hidden="true">{initials(actor)}</span>
            <div>
              <p title={entry.fields.length ? `Changed: ${entry.fields.join(', ')}` : undefined}>
                <strong>{actor}</strong> {entry.action === 'updated' ? 'updated task details' :
                  entry.action === 'created' ? 'created this task' : actionText[entry.action]}
                {entry.fields.length > 0 && <span className="sr-only">. Changed: {entry.fields.join(', ')}</span>}
              </p>
              <time dateTime={entry.createdAt}>{drawerDate.format(new Date(entry.createdAt))}</time>
            </div>
          </li>;
          return <li key={entry.id}>
            <strong>{actor}</strong> {actionText[entry.action]}
            {entry.fields.length > 0 && <p>{entry.fields.join(', ')}</p>}
            <p><time dateTime={entry.createdAt}>{dateFormat.format(new Date(entry.createdAt))}</time></p>
          </li>;
        })}
      </ul>}
      {nextCursor && !error && <button type="button" className="text-button" disabled={loading} onClick={() => {
        setLoading(true);
        setCursor(nextCursor);
      }}>Load older activity</button>}
    </section>
  );
}
