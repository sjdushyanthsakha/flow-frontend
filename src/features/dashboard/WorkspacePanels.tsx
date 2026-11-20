import { useEffect, useState, type CSSProperties } from 'react';
import { formatCapacity, type Task } from './data';
import { useDashboardRequest } from '../../auth/DashboardSession';

export type Activity = {
  id: string;
  taskId: string;
  task: string;
  actor: string | null;
  action: 'created' | 'updated' | 'commented';
  fields: string[];
  statusAfter: string | null;
  createdAt: string;
};
type Panels = { activity: Activity[]; capacityMinutes: number; assignedMinutes: number };

export function activityMessage(event: Activity) {
  if (event.action === 'created') return 'created the task';
  if (event.action === 'commented') return 'commented';
  if (event.statusAfter) return `moved the task to ${event.statusAfter}`;
  if (event.fields.length === 1 && event.fields.includes('Board position')) return 'reordered the task';
  if (event.fields.length === 1 && event.fields.includes('Due date')) return 'updated the due date';
  return event.fields.length ? `updated ${event.fields.join(', ').toLowerCase()}` : 'updated the task';
}

type Props = {
  tasks: Task[];
  timezone: string;
  revision: number;
  onOpenTask: (task: Task) => void;
};

export function WorkspacePanels({ tasks, timezone, revision, onOpenTask }: Props) {
  const dashboardRequest = useDashboardRequest();
  const [data, setData] = useState<Panels>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    dashboardRequest<Panels>('/workspace-panels', { signal: controller.signal }).then((result) => {
      if (!controller.signal.aborted) {
        setData(result);
        setError('');
      }
    }).catch((failure: Error) => {
      if (!controller.signal.aborted) setError(failure.message);
    });
    return () => controller.abort();
  }, [tasks, revision, attempt]);

  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const dateFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: timezone });
  const utilized = data?.capacityMinutes ? Math.round(data.assignedMinutes / data.capacityMinutes * 100) : undefined;
  const available = data ? Math.max(data.capacityMinutes - data.assignedMinutes, 0) : 0;

  return <div className="lower-grid overview-lower">
    <section className="panel workspace-activity" aria-labelledby="workspace-activity-title">
      <div className="panel-heading"><div><span className="eyebrow">Workspace</span><h2 id="workspace-activity-title">Recent activity</h2></div></div>
      {error && <div className="workspace-panel-state">
        <p role="alert">{error}</p>
        <button className="text-button" type="button" onClick={() => { setError(''); setAttempt((value) => value + 1); }}>Retry</button>
      </div>}
      {!data && !error && <p className="workspace-panel-state" role="status">Loading activity…</p>}
      {data && (data.activity.length ? (
        <ul className="workspace-activity-list">
          {data.activity.map((event) => {
            const task = taskById.get(event.taskId);
            const content = <>
              <span className={`activity-dot activity-dot--${event.statusAfter ? 'status' : event.action}`} aria-hidden="true" />
              <span className="workspace-activity-description"><strong>{event.actor ?? 'System'}</strong> {activityMessage(event)} on{' '}
                <span className="activity-task-link">{event.task}</span>
              </span>
              <time dateTime={event.createdAt}>{dateFormat.format(new Date(event.createdAt))}</time>
            </>;
            return <li key={event.id}>
              {task ? <button className="activity-row-button" type="button" onClick={() => onOpenTask(task)}>{content}</button> :
                <div className="activity-row-content">{content}</div>}
            </li>;
          })}
        </ul>
      ) : <p className="workspace-panel-state">No task activity has been recorded.</p>)}
    </section>
    <section className="panel team-capacity" aria-labelledby="team-capacity-title">
      <div className="panel-heading"><div><span className="eyebrow">This week</span><h2 id="team-capacity-title">Team capacity</h2></div></div>
      {data ? <>
        <div className="capacity-ring" role="img"
          aria-label={utilized === undefined ? 'No team capacity configured' : `${utilized}% of weekly team capacity utilized`}
          style={{ '--utilization': `${Math.min(utilized ?? 0, 100)}%` } as CSSProperties}>
          <div className="capacity-ring-label" aria-hidden="true">
            <strong>{utilized === undefined ? '—' : `${utilized}%`}</strong>
            <span>{utilized === undefined ? 'No capacity' : 'utilized'}</span>
          </div>
        </div>
        <dl className="capacity-breakdown">
          <div><dt>Assigned</dt><dd>{formatCapacity(data.assignedMinutes)}</dd></div>
          <div><dt>Available</dt><dd>{formatCapacity(available)}</dd></div>
        </dl>
      </> : <p className="workspace-panel-state" role="status">{error ? 'Capacity is unavailable.' : 'Loading capacity…'}</p>}
    </section>
  </div>;
}
