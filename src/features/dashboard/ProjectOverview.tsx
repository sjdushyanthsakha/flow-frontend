import { useEffect, useState, type CSSProperties } from 'react';
import { Icon, type IconName } from '../../lib/icons';
import { dateKey, dateLabel, formatCapacity, initials, isDone, type Project, type Task } from './data';
import { useDashboardRequest } from '../../auth/DashboardSession';
import { projectPath } from './projectRoutes';
import { activityMessage, type Activity } from './WorkspacePanels';

type Contributor = { id: string; name: string; activeTasks: number; assignedMinutes: number; capacityMinutes: number };
type Overview = { owner: string | null; loggedMinutes: number; activity: Activity[]; contributors: Contributor[] };
type Props = {
  project: Project;
  tasks: Task[];
  timezone: string;
  revision: number;
  onEditProject: () => void;
  onEditTask: (task: Task) => void;
  onOpenActivityTask: (task: Task) => void;
};

const statuses = [
  { label: 'To do', color: 'neutral' },
  { label: 'In progress', color: 'violet' },
  { label: 'In review', color: 'amber' },
  { label: 'Blocked', color: 'rose' },
  { label: 'Completed', color: 'green' },
];
const avatarColors = ['violet', 'green', 'coral', 'blue'];
const calendarDay = new Intl.DateTimeFormat('en', { day: 'numeric', timeZone: 'UTC' });
const calendarMonth = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' });
const dateWithYear = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

function PersonAvatar({ name, index = 0 }: { name: string; index?: number }) {
  return <span className={`avatar avatar--${avatarColors[index % avatarColors.length]}`} title={name} aria-hidden="true">{initials(name)}</span>;
}

function ProjectStatus({ status }: { status: string }) {
  return <span className={`status-pill status-pill--${status.toLowerCase().replaceAll(' ', '-')}`}><i />{status}</span>;
}

function ProjectProgress({ tasks, percentage }: { tasks: Task[]; percentage: number }) {
  const groups = new Map(statuses.map(({ label, color }) => [label.toLowerCase(), { label, color, count: 0 }]));
  for (const task of tasks) {
    const label = isDone(task) ? 'Completed' : task.status;
    const key = label.toLowerCase();
    const group = groups.get(key) ?? { label, color: 'neutral', count: 0 };
    group.count++;
    groups.set(key, group);
  }
  const entries = [...groups.values()];
  const max = Math.max(1, ...entries.map(({ count }) => count));
  return <section className="panel project-progress-panel">
    <div className="panel-heading"><div><span className="eyebrow">Status distribution</span><h2>Project progress</h2></div></div>
    <div className="project-distribution">
      <div className="capacity-ring" role="img" aria-label={`${percentage}% complete`}
        style={{ '--utilization': `${percentage}%` } as CSSProperties}>
        <div className="capacity-ring-label" aria-hidden="true"><strong>{percentage}%</strong><span>complete</span></div>
      </div>
      <dl className="project-status-list">
        {entries.map(({ label, color, count }) => <div key={label} className={`project-status--${color}`}><dt>{label}</dt><dd>{count}</dd></div>)}
      </dl>
    </div>
    <div className="project-status-bars" aria-hidden="true">
      {entries.map(({ label, color, count }) => <span key={label} className={`project-status--${color}`}
        style={{ height: `${count / max * 100}%` }} />)}
    </div>
  </section>;
}

function ProjectDeadlines({ tasks, today, projectId, onEditTask }: {
  tasks: Task[]; today: string; projectId: string; onEditTask: (task: Task) => void;
}) {
  const deadline = new Date(today + 'T00:00:00Z');
  deadline.setUTCDate(deadline.getUTCDate() + 14);
  const horizon = deadline.toISOString().slice(0, 10);
  const upcoming = tasks.flatMap((task) => task.dueDate && task.dueDate <= horizon && !isDone(task)
    ? [{ task, date: task.dueDate }] : [])
    .sort((left, right) => left.date.localeCompare(right.date) || left.task.title.localeCompare(right.task.title))
    .slice(0, 5);
  return <section className="panel project-deadlines">
    <div className="panel-heading">
      <div><span className="eyebrow">Next 14 days</span><h2>Upcoming deadlines</h2></div>
      <a className="text-button" href={projectPath(projectId, 'timeline')}>View timeline</a>
    </div>
    {upcoming.length ? <ul className="project-detail-list">
      {upcoming.map(({ task, date }, index) => {
        const day = new Date(date + 'T00:00:00Z');
        return <li key={task.id}>
          <time className={`project-deadline-date${date < today ? ' project-deadline-date--late' : ''}`} dateTime={date}>
            <strong>{calendarDay.format(day)}</strong><span>{calendarMonth.format(day)}</span>
          </time>
          <div className="project-detail-item">
            <button className="task-title-button" type="button" onClick={() => onEditTask(task)}><strong>{task.title}</strong></button>
            <div><ProjectStatus status={task.status} />{task.priority && <span>{task.priority} priority</span>}</div>
          </div>
          {task.assignee && <PersonAvatar name={task.assignee} index={index} />}
        </li>;
      })}
    </ul> : <p className="project-detail-empty">No open deadlines in this period.</p>}
  </section>;
}

export default function ProjectOverview({ project, tasks, timezone, revision, onEditProject, onEditTask, onOpenActivityTask }: Props) {
  const dashboardRequest = useDashboardRequest();
  const [data, setData] = useState<Overview>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    dashboardRequest<Overview>(`/projects/${project.id}/overview`, { signal: controller.signal }).then((result) => {
      if (!controller.signal.aborted) {
        setData(result);
        setError('');
      }
    }).catch((failure: Error) => {
      if (!controller.signal.aborted) setError(failure.message);
    });
    return () => controller.abort();
  }, [project, tasks, revision, attempt]);

  const today = dateKey(new Date(), timezone);
  const openTasks = tasks.filter((task) => !isDone(task));
  const completed = tasks.length - openTasks.length;
  const percentage = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  const overdue = openTasks.filter((task) => task.dueDate && task.dueDate < today).length;
  const estimate = tasks.reduce((sum, task) => sum + (task.estimateMinutes ?? 0), 0);
  const dates = [
    project.startDate && dateLabel(project.startDate),
    project.dueDate && dateWithYear.format(new Date(project.dueDate + 'T00:00:00Z')),
  ].filter(Boolean).join(' – ');
  const activityDate = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: timezone });
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const metrics: { label: string; value: string | number; detail: string; icon: IconName; color: string }[] = [
    { label: 'Total tasks', value: tasks.length, detail: `${openTasks.length} still open`, icon: 'check', color: 'purple' },
    { label: 'Completion', value: `${percentage}%`, detail: `${completed} ${completed === 1 ? 'task' : 'tasks'} delivered`, icon: 'completed', color: 'green' },
    { label: 'Overdue', value: overdue, detail: overdue ? 'Needs resolution' : 'No overdue tasks', icon: 'alert', color: 'rose' },
    { label: 'Hours logged', value: data ? formatCapacity(data.loggedMinutes) : '—', detail: estimate ? `of ${formatCapacity(estimate)} estimated` : 'No estimate', icon: 'clock', color: 'teal' },
  ];

  return <section className="project-overview" aria-label={`${project.name} overview`}>
    <nav className="project-breadcrumb" aria-label="Breadcrumb">
      <a href="/projects">Projects</a><Icon name="chevron" /><span aria-current="page">{project.name}</span>
    </nav>
    <header className="project-overview-header">
      <span className="project-icon project-icon--violet">{initials(project.name).slice(0, 1)}</span>
      <div className="project-overview-heading">
        <div className="project-title-line"><h1>{project.name}</h1><ProjectStatus status={project.status} /></div>
        {project.description && <p>{project.description}</p>}
        <div className="project-overview-meta">
          {dates && <span><Icon name="calendar" />{dates}</span>}
          {data?.owner && <span><PersonAvatar name={data.owner} />Owned by {data.owner}</span>}
          {project.members.length > 0 && (
            <div className="avatar-stack" aria-label={`${project.members.length} project members`}>
              {project.members.slice(0, 4).map((name, index) => <PersonAvatar name={name} index={index} key={`${name}-${index}`} />)}
              {project.members.length > 4 && <span className="avatar avatar--extra">+{project.members.length - 4}</span>}
            </div>
          )}
        </div>
      </div>
      <div className="workspace-actions project-overview-actions">
        <button className="text-button" type="button" onClick={onEditProject}>Edit project</button>
        <a className="button button--secondary" href={projectPath(project.id, 'timeline')}><Icon name="calendar" />Timeline</a>
        <a className="button button--primary" href={projectPath(project.id, 'board')}><Icon name="board" />Open board</a>
      </div>
    </header>

    {error && <div className="project-overview-error"><p role="alert">{error}</p>
      <button type="button" className="text-button" onClick={() => { setError(''); setAttempt((value) => value + 1); }}>Retry</button></div>}
    <section className="summary-stats project-overview-stats" aria-label="Project metrics">
      {metrics.map(({ label, value, detail, icon, color }) => <article className="summary-stat" key={label}>
        <span className={`stat-icon stat-icon--${color}`}><Icon name={icon} /></span>
        <div><h2>{label}</h2><strong>{value}</strong><small>{detail}</small></div>
      </article>)}
    </section>
    <div className="project-overview-grid project-overview-progress-grid">
      <ProjectProgress tasks={tasks} percentage={percentage} />
      <ProjectDeadlines tasks={tasks} today={today} projectId={project.id} onEditTask={onEditTask} />
    </div>
    <div className="project-overview-grid project-overview-stream-grid">
      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">Project stream</span><h2>Recent activity</h2></div></div>
        {!data ? <p className="project-detail-empty" role="status">{error ? 'Activity unavailable.' : 'Loading activity…'}</p> : data.activity.length ? (
          <ul className="project-detail-list project-stream-list">
            {data.activity.map((item, index) => {
              const task = taskById.get(item.taskId);
              const content = <>
                <PersonAvatar name={item.actor ?? 'System'} index={index} />
                <span className="project-detail-item">
                  <span><strong>{item.actor ?? 'System'}</strong> {activityMessage(item)}</span>
                  <span className="project-stream-meta">
                    <span className="activity-task-link">{item.task}</span>
                    <time dateTime={item.createdAt}>{activityDate.format(new Date(item.createdAt))}</time>
                  </span>
                </span>
              </>;
              return <li key={item.id}>
                {task ? <button className="activity-row-button" type="button" onClick={() => onOpenActivityTask(task)}>{content}</button> :
                  <div className="activity-row-content">{content}</div>}
              </li>;
            })}
          </ul>
        ) : <p className="project-detail-empty">No activity has been recorded for this project.</p>}
      </section>
      <section className="panel">
        <div className="panel-heading"><div>
          <span className="eyebrow">{data ? `${data.contributors.length} ${data.contributors.length === 1 ? 'contributor' : 'contributors'}` : 'Contributors'}</span>
          <h2>Team allocation</h2>
        </div></div>
        {!data ? <p className="project-detail-empty" role="status">{error ? 'Team allocation unavailable.' : 'Loading allocation…'}</p> : data.contributors.length ? (
          <ul className="project-detail-list project-allocation-list">
            {data.contributors.map(({ id, name, activeTasks, assignedMinutes, capacityMinutes }, index) => {
              const allocation = capacityMinutes ? Math.round(assignedMinutes / capacityMinutes * 100) : 0;
              return <li key={id}>
                <PersonAvatar name={name} index={index} />
                <div className="project-detail-item"><strong>{name}</strong><div>{activeTasks} {activeTasks === 1 ? 'active task' : 'active tasks'}</div></div>
                <div className="progress-track" aria-hidden="true"><span style={{ width: `${Math.min(allocation, 100)}%` }} /></div>
                <span className="project-allocation-hours">{formatCapacity(assignedMinutes)} / {formatCapacity(capacityMinutes)}</span>
              </li>;
            })}
          </ul>
        ) : <p className="project-detail-empty">No project contributors yet.</p>}
      </section>
    </div>
  </section>;
}
