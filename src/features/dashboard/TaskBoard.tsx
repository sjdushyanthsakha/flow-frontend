import { useEffect, useState, type DragEvent } from 'react';
import { Icon } from '../../lib/icons';
import { dateKey, initials, isDone, type Member, type Project, type Task } from './data';
import { useDashboardRequest } from '../../auth/DashboardSession';
import { projectPath } from './projectRoutes';

const defaultStatuses = ['To do', 'In progress', 'In review', 'Blocked', 'Done'];
const columnStatus = (task: Task) => isDone(task) ? 'Done' : task.status;
const statusLabel = (status: string) => status === 'Done' ? 'Completed' : status;
const avatarColors = ['violet', 'green', 'coral', 'blue'];

type CardDetails = { id: string; labels: string[]; commentCount: number; subtaskCount: number; completedSubtasks: number };
export type BoardMove = { status: string; beforeId: string | null; expectedColumn: string[] };
export type BoardUpdate = Pick<Task, 'id' | 'status' | 'boardPosition' | 'updatedAt'>;

type Props = {
  tasks: Task[];
  project?: Project;
  members: Member[];
  timeZone: string;
  workspaceSearch: string;
  revision: number;
  saving: boolean;
  onMove: (task: Task, move: BoardMove) => Promise<void>;
  onEdit: (task: Task) => void;
  onOpen: (task: Task) => void;
  onCreate: (status?: string) => void;
};

function dueLabel(dueDate: string, today: string) {
  const days = Math.round((Date.parse(dueDate + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000);
  return { days, text: days === 0 ? 'Today' : days < 0 ? `${-days}d late` : `${days}d` };
}

function BoardAvatar({ name, index = 0 }: { name: string; index?: number }) {
  return <span className={`avatar avatar--${avatarColors[index % avatarColors.length]}`} title={name} aria-label={name}>{initials(name)}</span>;
}

function BoardCard({ task, details, today, memberIndex, scoped, onOpen }: {
  task: Task; details?: CardDetails; today: string; memberIndex: number; scoped: boolean; onOpen: () => void;
}) {
  const due = task.dueDate ? dueLabel(task.dueDate, today) : null;
  const priority = task.priority?.toLowerCase();
  return <button className="board-card-open" type="button" aria-haspopup="dialog" onClick={onOpen}>
    <span className="board-card-meta"><Icon name="check" /><span>{task.id.slice(0, 8).toUpperCase()}</span></span>
    <strong>{task.title}</strong>
    {!scoped && <span className="board-card-project">{task.project}</span>}
    <span className="board-card-labels">
      {details?.labels.map((label) => <span key={label}>{label}</span>)}
    </span>
    {Boolean(details?.subtaskCount) && details && (
      <span className="board-card-progress" aria-label={`${details.completedSubtasks} of ${details.subtaskCount} subtasks completed`}>
        <span className="progress-track"><span style={{ width: `${details.completedSubtasks / details.subtaskCount * 100}%` }} /></span>
        <span>{details.completedSubtasks}/{details.subtaskCount}</span>
      </span>
    )}
    <span className="board-card-footer">
      <span className={`board-card-priority board-card-priority--${priority ?? 'none'}`} title={task.priority ? `${task.priority} priority` : 'No priority'}>
        {priority === 'urgent' || priority === 'high' ? '↑' : priority === 'low' ? '↓' : '−'}
      </span>
      {due && <time className={due.days < 0 && !isDone(task) ? 'board-card-late' : undefined} dateTime={task.dueDate ?? undefined}>
        <Icon name="calendar" />{due.text}
      </time>}
      <span className="board-card-assignment">
        {Boolean(details?.commentCount) && <span className="board-card-comments" title={`${details?.commentCount} comments`}>
          <Icon name="comment" />{details?.commentCount}
        </span>}
        {task.assignee && <BoardAvatar name={task.assignee} index={memberIndex} />}
      </span>
    </span>
  </button>;
}

export function TaskBoard({ tasks, project, members, timeZone, workspaceSearch, revision, saving, onMove, onEdit, onOpen, onCreate }: Props) {
  const dashboardRequest = useDashboardRequest();
  const [draggedId, setDraggedId] = useState('');
  const [search, setSearch] = useState('');
  const [assignee, setAssignee] = useState('');
  const [priority, setPriority] = useState('');
  const [details, setDetails] = useState<Record<string, CardDetails>>({});
  const [detailsError, setDetailsError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const query = project ? `?projectId=${encodeURIComponent(project.id)}` : '';
    dashboardRequest<CardDetails[]>(`/board-cards${query}`, { signal: controller.signal }).then((cards) => {
      if (controller.signal.aborted) return;
      setDetails(Object.fromEntries(cards.map((item) => [item.id, item])));
      setDetailsError('');
    }).catch((failure: Error) => {
      if (!controller.signal.aborted) setDetailsError(failure.message);
    });
    return () => controller.abort();
  }, [project, tasks, revision, attempt]);

  const boardQuery = search.trim().toLowerCase();
  const filtered = Boolean(boardQuery || workspaceSearch || assignee || priority);
  const canMove = !saving && !filtered;
  const today = dateKey(new Date(), timeZone);
  const scope = project ? tasks.filter(({ projectId }) => projectId === project.id) : tasks;
  const priorities = [...new Set(['Urgent', 'High', 'Medium', 'Low', ...scope.flatMap((task) => task.priority ? [task.priority] : [])])];
  const visible = new Set(scope.filter((task) => {
    const text = [task.title, task.description, task.project, task.status, task.assignee, ...(details[task.id]?.labels ?? [])].join(' ').toLowerCase();
    return text.includes(boardQuery) && text.includes(workspaceSearch) &&
      (!assignee || (assignee === 'unassigned' ? !task.assigneeId : task.assigneeId === assignee)) &&
      (!priority || (priority === 'none' ? !task.priority : task.priority === priority));
  }).map(({ id }) => id));

  // Keep the workspace column order for the move API, even on a project board.
  const columns = new Map<string, Task[]>(defaultStatuses.map((status) => [status, []]));
  const ordered = [...tasks].sort((left, right) =>
    (left.boardPosition ?? Infinity) - (right.boardPosition ?? Infinity)
    || (left.dueDate ?? '9999-99-99').localeCompare(right.dueDate ?? '9999-99-99')
    || left.id.localeCompare(right.id));
  for (const task of ordered) {
    const status = columnStatus(task);
    const column = columns.get(status) ?? [];
    column.push(task);
    columns.set(status, column);
  }
  const displayedColumns = [...columns].filter(([status, entries]) =>
    defaultStatuses.includes(status) || !project || entries.some(({ projectId }) => projectId === project.id));
  const contributorNames = project?.members ?? members.map(({ name }) => name);

  function move(task: Task, status: string, beforeId: string | null) {
    if (!canMove || task.id === beforeId) return;
    const expectedColumn = (columns.get(status) ?? []).map(({ id }) => id);
    void onMove(task, { status, beforeId, expectedColumn });
  }

  function drop(event: DragEvent, status: string, beforeId: string | null) {
    if (!canMove || !draggedId) return;
    event.preventDefault();
    event.stopPropagation();
    setDraggedId('');
    const task = tasks.find(({ id }) => id === draggedId);
    if (task) move(task, status, beforeId);
  }

  function allowDrop(event: DragEvent) {
    if (canMove && draggedId) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    }
  }

  return (
    <>
      <div className="board-heading">
        <div>
          {project ? <a className="eyebrow" href={projectPath(project.id)}>{project.name} / Tasks</a> : <span className="eyebrow">Workspace / Tasks</span>}
          <h1>{project ? `${project.name} board` : 'Kanban board'}</h1>
          <p>Move work forward and keep the team aligned.</p>
        </div>
        <div className="board-heading-actions">
          <div className="avatar-stack" aria-label={`${contributorNames.length} contributors`}>
            {contributorNames.slice(0, 4).map((name, index) => <BoardAvatar key={`${name}-${index}`} name={name} index={index} />)}
            {contributorNames.length > 4 && <span className="avatar avatar--extra">+{contributorNames.length - 4}</span>}
          </div>
          <button className="button button--primary" type="button" onClick={() => onCreate()}><Icon name="plus" />Create task</button>
        </div>
      </div>

      <div className="panel board-toolbar">
        <label className="board-search"><Icon name="search" /><input type="search" aria-label="Search this board"
          placeholder="Search this board…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <div className="board-filters">
          <label className="board-filter"><Icon name="filter" /><select aria-label="Filter by assignee" value={assignee} onChange={(event) => setAssignee(event.target.value)}>
            <option value="">All assignees</option><option value="unassigned">Unassigned</option>
            {members.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}
          </select></label>
          <label className="board-filter"><Icon name="tag" /><select aria-label="Filter by priority" value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option value="">All priorities</option><option value="none">No priority</option>
            {priorities.map((item) => <option key={item}>{item}</option>)}
          </select></label>
          <span className="board-task-count" aria-live="polite">{visible.size} {visible.size === 1 ? 'task' : 'tasks'}</span>
        </div>
      </div>
      {detailsError && <div className="board-details-error">
        <p role="alert">{detailsError}</p><button className="text-button" type="button" onClick={() => setAttempt((value) => value + 1)}>Retry card details</button>
      </div>}
      {filtered && <p className="board-filter-notice" role="status">Clear the search and filters to move or reorder tasks.</p>}
      <div className="workspace-board" aria-busy={saving}>
        {displayedColumns.map(([status, entries]) => {
          const column = entries.filter(({ id }) => visible.has(id));
          return (
            <section className={`board-column board-column--${status.toLowerCase().replaceAll(' ', '-')}`} key={status} onDragOver={allowDrop}
              onDrop={(event) => drop(event, status, null)}>
              <div className="board-column-header">
                <span className="board-column-dot" aria-hidden="true" /><h2>{statusLabel(status)}</h2><span className="board-column-count">{column.length}</span>
                <button className="icon-button" type="button" aria-label={`Add task to ${statusLabel(status)}`} onClick={() => onCreate(status)}>
                  <Icon name="plus" />
                </button>
              </div>
              <ul className="board-card-list">
                {column.map((task, index) => (
                  <li key={task.id} className={`board-task-card${draggedId === task.id ? ' board-item--dragging' : ''}`}
                    draggable={canMove}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', task.id);
                      setDraggedId(task.id);
                    }}
                    onDragEnd={() => setDraggedId('')}
                    onDrop={(event) => drop(event, status, task.id)}>
                    <BoardCard task={task} details={details[task.id]} today={today} scoped={Boolean(project)} onOpen={() => onOpen(task)}
                      memberIndex={Math.max(0, members.findIndex(({ id }) => id === task.assigneeId))} />
                    <details className="board-card-menu">
                      <summary className="icon-button" aria-label={`Actions for ${task.title}`}><Icon name="dots" /></summary>
                      <div className="board-move-actions">
                        <button className="text-button" type="button" onClick={() => onEdit(task)}>Edit task</button>
                        <select aria-label={`Move ${task.title} to column`} value={status} disabled={!canMove}
                          onChange={(event) => move(task, event.target.value, null)}>
                          {displayedColumns.map(([item]) => <option key={item} value={item}>{statusLabel(item)}</option>)}
                        </select>
                        <button className="text-button" type="button" disabled={!canMove || index === 0}
                          aria-label={`Move ${task.title} up`} onClick={() => move(task, status, column[index - 1].id)}>↑</button>
                        <button className="text-button" type="button" disabled={!canMove || index === column.length - 1}
                          aria-label={`Move ${task.title} down`} onClick={() => move(task, status, column[index + 2]?.id ?? null)}>↓</button>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
              <button type="button" className="board-column-add text-button" onClick={() => onCreate(status)}>
                <Icon name="plus" />Add task
              </button>
            </section>
          );
        })}
      </div>
    </>
  );
}
