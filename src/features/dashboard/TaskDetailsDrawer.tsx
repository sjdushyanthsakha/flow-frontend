import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Icon } from '../../lib/icons';
import { formatCapacity, initials, isDone, type Task, type Dashboard } from './data';
import { DashboardDownload, useDashboardRequest } from '../../auth/DashboardSession';
import { projectPath } from './projectRoutes';
import { TaskActivity } from './TaskActivity';
import { TaskComments } from './TaskComments';
import { TaskTimeForm } from './TaskTimeForm';

type Attachment = { id: string; name: string } & ({ url: string } | { sizeBytes: number });
type DetailTab = 'comments' | 'activity';
type Subtask = Pick<Task, 'id' | 'title' | 'status'>;
type Details = Pick<Task, 'id' | 'title' | 'description' | 'status' | 'priority' | 'assignee' | 'assigneeId' | 'dueDate' |
  'projectId' | 'project' | 'estimateMinutes' | 'startDate' | 'updatedAt'> & {
  approval: string; blockingTaskId: string | null; reporter: string | null; loggedMinutes: number;
  commentCount: number; activityCount: number; labels: string[];
  subtasks: Subtask[]; attachments: Attachment[];
};

type Props = {
  task: Task;
  dashboard: Dashboard;
  variant?: 'board' | 'timeline';
  onClose: () => void;
  onUpdate: (task: Partial<Task> & { id: string }) => void;
  onDelete: (id: string) => void;
  onTaskListChange: () => Promise<void>;
  onActivityChange: () => void;
  onTimeLogged: () => void;
};

const statuses = ['To do', 'In progress', 'In review', 'Blocked', 'Done'];
const priorities = ['Low', 'Medium', 'High', 'Urgent'];
const approvals = ['Not required', 'Pending', 'Approved', 'Changes requested'];
const maxAttachmentBytes = 5 * 1024 * 1024;
const formatSize = (bytes: number) => bytes < 1024 ? `${bytes} B` :
  bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
const optionValues = (base: string[], current: string) => [...new Set([...base, current].filter(Boolean))];

export default function TaskDetailsDrawer({ task, dashboard, variant, onClose, onUpdate, onDelete,
  onTaskListChange, onActivityChange, onTimeLogged }: Props) {
  const dashboardRequest = useDashboardRequest();
  const inlineDetails = variant !== undefined;
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const tabsId = useId();
  const [data, setData] = useState<Details>();
  const [description, setDescription] = useState(task.description ?? '');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tab, setTab] = useState<DetailTab>(variant === 'board' ? 'activity' : 'comments');
  const [addingLink, setAddingLink] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const subtaskRequest = useRef<string | undefined>(undefined);
  const loadedTask = useRef(false);
  const path = `/tasks/${task.id}`;
  const summary = data ?? task;
  const completedSubtasks = data?.subtasks.filter(isDone).length ?? 0;

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    node.showModal();
    closeButton.current?.focus();
    return () => { if (node.open) node.close(); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    dashboardRequest<Details>(`${path}/details`, { signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      if (!loadedTask.current) {
        setDescription(result.description ?? '');
        loadedTask.current = true;
      }
      setData(result);
    }).catch((failure: Error) => {
      if (!controller.signal.aborted) setError(failure.message);
    });
    return () => controller.abort();
  }, [path, revision]);

  function refresh() {
    setRevision((version) => version + 1);
    onActivityChange();
  }

  async function perform(operation: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try { await operation(); } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not update the task.');
    } finally { setBusy(false); }
  }

  function update(property: string, value: string | null) {
    void perform(async () => {
      const updated = await dashboardRequest<Details>(`${path}/details`, {
        method: 'PATCH', body: JSON.stringify({ [property]: value }),
      });
      setData(updated);
      if (property === 'description') setDescription(updated.description ?? '');
      const { id, assigneeId, assignee, status, priority, description: text, startDate, dueDate, updatedAt } = updated;
      onUpdate({ id, assigneeId, assignee, status, priority, description: text, startDate, dueDate, updatedAt });
      refresh();
    });
  }

  function addLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    void perform(async () => {
      await dashboardRequest(`${path}/attachment-links`, {
        method: 'POST', body: JSON.stringify({ name: fields.get('name'), url: fields.get('url') }),
      });
      setAddingLink(false);
      refresh();
    });
  }

  function addFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    if (!file.size || file.size > maxAttachmentBytes) {
      setError('Choose a file between 1 byte and 5 MB.');
      return;
    }
    const form = new FormData();
    form.append('file', file);
    void perform(async () => {
      await dashboardRequest(`${path}/attachments`, { method: 'POST', body: form });
      refresh();
    });
  }

  function addSubtask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = subtaskTitle.trim();
    if (!title) return;
    const requestId = subtaskRequest.current ??= crypto.randomUUID();
    void perform(async () => {
      await dashboardRequest(`${path}/subtasks`, {
        method: 'POST', body: JSON.stringify({ title, requestId }),
      });
      setSubtaskTitle('');
      setAddingSubtask(false);
      subtaskRequest.current = undefined;
      refresh();
      await onTaskListChange();
    });
  }

  const subtaskInput = <input aria-label={inlineDetails ? 'Add a subtask' : 'Subtask title'} name="title" required
    placeholder={inlineDetails ? 'Add a subtask' : undefined} maxLength={240} value={subtaskTitle}
    disabled={!data || busy} onChange={(event) => {
      setSubtaskTitle(event.target.value);
      subtaskRequest.current = undefined;
    }} />;

  return <dialog className={variant ? `task-details-drawer task-details-drawer--${variant}` : 'task-details-drawer'} ref={dialog} aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div className="task-drawer-frame">
      <header className="task-drawer-header">
        <div className="task-drawer-breadcrumb">
          <span className="task-drawer-project-icon" aria-hidden="true">{initials(summary.project).slice(0, 1)}</span>
          {inlineDetails && <><strong>{summary.id.slice(0, 8).toUpperCase()}</strong><Icon name="chevron" /></>}
          <a href={projectPath(summary.projectId)}>{summary.project}</a>
        </div>
        <div className="workspace-actions">
          <button className="icon-button" type="button" aria-label="Delete task" disabled={busy} onClick={() => setConfirmDelete(true)}><Icon name="trash" /></button>
          <button className="icon-button" ref={closeButton} type="button" aria-label="Close task details" disabled={busy} onClick={onClose}><Icon name="close" /></button>
        </div>
      </header>
      <div className="task-drawer-columns">
        <div className="task-drawer-main">
          <h1 id={titleId}>{summary.title}</h1>
          <div className="task-drawer-actions">
            <select className={`drawer-status drawer-status--${summary.status.toLowerCase().replaceAll(' ', '-')}`}
              aria-label="Task status" disabled={busy || !data} value={summary.status} onChange={(event) => update('status', event.target.value)}>
              {optionValues(statuses, summary.status).map((status) => <option key={status}>{status}</option>)}
            </select>
            <TaskTimeForm drawer taskId={task.id} onLogged={() => { refresh(); onTimeLogged(); }} />
          </div>
          {error && <p className="field-error" role="alert">{error}</p>}
          {!data && !error && <p role="status">Loading task details…</p>}
          {!data && error && <button className="text-button" type="button" onClick={() => {
            setError(''); setRevision((version) => version + 1);
          }}>Retry</button>}
          {confirmDelete && <div className="drawer-delete-confirm">
            <p>Delete this task permanently?</p>
            <button className="button button--secondary" type="button" disabled={busy} onClick={() => setConfirmDelete(false)}>Cancel</button>
            <button className="button button--primary" type="button" disabled={busy} onClick={() => void perform(async () => {
              await dashboardRequest(path, { method: 'DELETE' });
              onDelete(task.id);
            })}>Delete task</button>
          </div>}
          <form className="drawer-description" onSubmit={(event) => { event.preventDefault(); update('description', description); }}>
            <label>Description<textarea rows={4} value={description} maxLength={5000} disabled={busy || !data}
              onChange={(event) => setDescription(event.target.value)} placeholder="Add a description" /></label>
            {description !== (summary.description ?? '') &&
              <button className="button button--secondary" type="submit" disabled={busy}>Save description</button>}
          </form>
          <section className="drawer-task-section">
            <div className="drawer-section-heading">
              <h2>Dependencies &amp; attachments</h2>
              {inlineDetails && <button className="text-button drawer-advanced" type="button" aria-expanded={addingLink} disabled={!data || busy}
                onClick={() => setAddingLink(!addingLink)}>Advanced</button>}
            </div>
            <div className="drawer-dependency">
              <Icon name="link" />
              <select aria-label="Blocking dependency" value={data?.blockingTaskId ?? ''} disabled={busy || !data}
                onChange={(event) => update('blockingTaskId', event.target.value || null)}>
                <option value="">No blocking dependency</option>
                {dashboard.tasks.filter(({ id }) => id !== task.id).map((candidate) => (
                  <option value={candidate.id} key={candidate.id}>{candidate.title}</option>
                ))}
              </select>
            </div>
            {Boolean(data?.attachments.length) && <ul className={inlineDetails ? "drawer-attachments" : "drawer-item-list"}>
              {data?.attachments.map((item) => {
                const label = inlineDetails ? <><Icon name="attachment" /><strong>{item.name}</strong>
                  <span>{'sizeBytes' in item ? formatSize(item.sizeBytes) : 'Link'}</span></> : item.name;
                return <li key={item.id}>
                  {'url' in item ? <a href={item.url} target="_blank" rel="noreferrer">{label}</a> :
                    <DashboardDownload className="attachment-download" path={`${path}/attachments/${item.id}`} filename={item.name}>{label}</DashboardDownload>}
                </li>;
              })}
            </ul>}
            {inlineDetails ? <>
              <input ref={fileInput} type="file" hidden onChange={addFile} />
              <button className="button button--secondary drawer-add-attachment" type="button" disabled={!data || busy}
                onClick={() => fileInput.current?.click()}><Icon name="attachment" />Add attachment</button>
            </> : !addingLink && <button className="button button--secondary drawer-add-attachment" type="button" disabled={!data}
              onClick={() => setAddingLink(true)}><Icon name="attachment" />Add attachment link</button>}
            {addingLink && variant === 'timeline' && <label className="drawer-property drawer-schedule-start">
              <span><Icon name="calendar" />Start date</span>
              <input type="date" value={summary.startDate ?? ''} disabled={busy || !data}
                onChange={(event) => update('startDate', event.target.value || null)} />
            </label>}
            {addingLink && <form className="drawer-inline-form" onSubmit={addLink}>
              <label>Attachment name<input name="name" required maxLength={160} /></label>
              <label>URL<input name="url" type="url" required maxLength={2000} /></label>
              <button className="button button--secondary" type="submit" disabled={busy}>Save link</button>
              <button className="text-button" type="button" disabled={busy} onClick={() => setAddingLink(false)}>Cancel</button>
            </form>}
          </section>
          <section className="drawer-task-section">
            <div className="drawer-subtasks-heading"><h2>Subtasks</h2><span>{completedSubtasks}/{data?.subtasks.length ?? 0}</span></div>
            {Boolean(data?.subtasks.length) && <ul className={inlineDetails ? "drawer-item-list drawer-subtask-list" : "drawer-item-list"}>
              {data?.subtasks.map((subtask) => <li key={subtask.id}><label>
                <input type="checkbox" checked={isDone(subtask)} disabled={busy} onChange={(event) => {
                  const done = event.target.checked;
                  void perform(async () => {
                    const update = await dashboardRequest<Pick<Task, 'status' | 'updatedAt'>>(`/tasks/${subtask.id}`, {
                      method: 'PATCH', body: JSON.stringify({ done }),
                    });
                    onUpdate({ id: subtask.id, ...update });
                    refresh();
                  });
                }} />{subtask.title}
              </label></li>)}
            </ul>}
            {inlineDetails ? <form className="drawer-subtask-form" onSubmit={addSubtask}>
              <button type="submit" className="icon-button" aria-label="Add subtask"
                disabled={!data || busy || !subtaskTitle.trim()}><Icon name="plus" /></button>
              {subtaskInput}
            </form> : addingSubtask ? <form className="drawer-inline-form" onSubmit={addSubtask}>
              <label>Subtask title{subtaskInput}</label>
              <button type="submit" className="button button--secondary" disabled={busy}>Add subtask</button>
              <button type="button" className="text-button" disabled={busy} onClick={() => {
                setAddingSubtask(false);
                setSubtaskTitle('');
                subtaskRequest.current = undefined;
              }}>Cancel</button>
            </form> : <button type="button" className="text-button drawer-add-subtask" disabled={!data} onClick={() => setAddingSubtask(true)}>
              <Icon name="plus" />Add a subtask
            </button>}
          </section>
          <div className="drawer-tabs" role="tablist" aria-label="Task conversation"
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
              event.preventDefault();
              const next = tab === 'comments' ? 'activity' : 'comments';
              setTab(next);
              document.getElementById(`${tabsId}-${next}`)?.focus();
            }}>
            {(['comments', 'activity'] as const).map((item) => <button type="button" role="tab" key={item}
              id={`${tabsId}-${item}`} aria-controls={`${tabsId}-panel`} aria-selected={tab === item} tabIndex={tab === item ? 0 : -1}
              onClick={() => setTab(item)}>{item === 'comments' ? 'Comments' : 'Activity'} <span>{(item === 'comments' ? data?.commentCount : data?.activityCount) ?? 0}</span>
            </button>)}
          </div>
          <div role="tabpanel" id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-${tab}`}>
            {tab === 'comments' ? <TaskComments taskId={task.id} drawerUser={dashboard.displayName} onPosted={refresh} /> :
              <TaskActivity taskId={task.id} drawer withAvatars={inlineDetails} timezone={dashboard.timezone} key={revision} />}
          </div>
        </div>
        <aside className="task-drawer-properties" aria-label="Task properties">
          <h2>Properties</h2>
          <label className="drawer-property"><span><Icon name="users" />Assignee</span>
            <select value={summary.assigneeId ?? ''} disabled={busy || !data} onChange={(event) => update('assigneeId', event.target.value || null)}>
              <option value="">Unassigned</option>
              {dashboard.members.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <label className="drawer-property"><span><Icon name="shield" />Approval</span>
            <select value={data?.approval ?? 'Not required'} disabled={busy || !data} onChange={(event) => update('approval', event.target.value)}>
              {approvals.map((approval) => <option key={approval}>{approval}</option>)}
            </select>
          </label>
          <label className="drawer-property"><span><Icon name="calendar" />Due date</span>
            <input type="date" value={summary.dueDate ?? ''} disabled={busy || !data} onChange={(event) => update('dueDate', event.target.value || null)} />
          </label>
          <label className="drawer-property"><span><Icon name="tag" />Priority</span>
            <select value={summary.priority ?? ''} disabled={busy || !data} onChange={(event) => update('priority', event.target.value || null)}>
              <option value="">No priority</option>{optionValues(priorities, summary.priority ?? '').map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <div className="drawer-property-block"><h3>Priority</h3><span className={`drawer-priority drawer-priority--${summary.priority?.toLowerCase()}`}>{summary.priority ?? 'No priority'}</span></div>
          <div className="drawer-property-block"><h3>Reporter</h3>
            {data?.reporter ? <span className="drawer-person"><span className="avatar avatar--me" aria-hidden="true">{initials(data.reporter)}</span>{data.reporter}</span> : <span>—</span>}
          </div>
          <div className="drawer-property-block"><h3>Labels</h3>
            {data?.labels.length ? <ul className="drawer-labels">{data.labels.map((label) => <li key={label}>{label}</li>)}</ul> : <span>No labels</span>}
          </div>
          <div className="drawer-tracking">
            <div><span>Time tracking</span><span><strong>{data ? formatCapacity(data.loggedMinutes) : '—'}</strong>{summary.estimateMinutes ? ` of ${formatCapacity(summary.estimateMinutes)}` : ''}</span></div>
            {summary.estimateMinutes && <div className="progress-track" role="progressbar" aria-label="Time logged toward estimate"
              aria-valuemin={0} aria-valuemax={summary.estimateMinutes} aria-valuenow={Math.min(data?.loggedMinutes ?? 0, summary.estimateMinutes)}>
              <span style={{ width: Math.min((data?.loggedMinutes ?? 0) / summary.estimateMinutes * 100, 100) + '%' }} />
            </div>}
          </div>
          {summary.assignee && <div className="drawer-tracking drawer-current-assignee">
            <span className="avatar avatar--me" aria-hidden="true">{initials(summary.assignee)}</span>
            <div><span>Currently assigned to</span><strong>{summary.assignee}</strong></div>
          </div>}
        </aside>
      </div>
    </div>
  </dialog>;
}
