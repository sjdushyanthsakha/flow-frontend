import { useState, type FormEvent } from 'react';
import { TaskTimeForm } from './TaskTimeForm';
import { TaskActivity } from './TaskActivity';
import { TaskComments } from './TaskComments';
import { Icon } from '../../lib/icons';
import type { Dashboard, Project, Task } from './data';

export type Editor =
  | { kind: 'projects'; item?: Project }
  | { kind: 'tasks'; item?: Task; projectId?: string; status?: string }
  | { kind: 'members' };

type Props = {
  editor: Editor;
  dashboard: Dashboard;
  onClose: () => void;
  onSave: (values: Record<string, string>) => Promise<void>;
  onDelete: () => Promise<void>;
  onTimeLogged: () => void;
  onActivityChange: () => void;
};

export function WorkspaceEditor({ editor, dashboard, onClose, onSave, onDelete, onTimeLogged, onActivityChange }: Props) {
  const [showActivity, setShowActivity] = useState(false);
  const [activityRevision, setActivityRevision] = useState(0);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const project = editor.kind === 'projects' ? editor.item : undefined;
  const task = editor.kind === 'tasks' ? editor.item : undefined;
  const entity = { projects: 'project', tasks: 'task', members: 'team member' }[editor.kind];
  const statuses = editor.kind === 'projects'
    ? ['On track', 'At risk', 'In review', 'Completed']
    : ['To do', 'In progress', 'In review', 'Blocked', 'Done'];
  const currentStatus = project?.status ?? task?.status ?? (editor.kind === 'tasks' ? editor.status : undefined) ?? statuses[0];
  const priorities = [...new Set(['Low', 'Medium', 'High', 'Urgent', ...(task?.priority ? [task.priority] : [])])];

  const perform = async (action: () => Promise<void>) => {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      await action();
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The operation failed.');
    } finally {
      setPending(false);
    }
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values: Record<string, string> = {};
    new FormData(event.currentTarget).forEach((value, key) => { values[key] = String(value).trim(); });
    void perform(() => onSave(values));
  };

  return <div className="dialog-backdrop" onMouseDown={(event) => { if (!pending && event.target === event.currentTarget) onClose(); }}>
    <section className="dialog workspace-editor" role="dialog" aria-modal="true" aria-labelledby="editor-title"
      onKeyDown={(event) => { if (event.key === 'Escape' && !pending) onClose(); }}>
      <div className="dialog-heading">
        <h2 id="editor-title">{project || task ? 'Edit' : 'Add'} {entity}</h2>
        <button type="button" className="icon-button" aria-label="Close dialog" disabled={pending} onClick={onClose}><Icon name="close" /></button>
      </div>
      <form onSubmit={submit}>
        {editor.kind === 'members' ? <>
          <label>Display name<input name="name" required maxLength={160} autoFocus /></label>
          <label>Email<input name="email" type="email" required maxLength={320} /></label>
        </> : <>
          {editor.kind === 'projects' ? <>
            <label>Project name<input name="name" required maxLength={200} defaultValue={project?.name} autoFocus /></label>
            <label>Description<textarea name="description" rows={3} maxLength={5000} defaultValue={project?.description ?? ''} /></label>
            <label>Start date<input name="startDate" type="date" defaultValue={project?.startDate ?? ''} /></label>
          </> : <>
            <label>Task title<input name="title" required maxLength={240} defaultValue={task?.title} autoFocus /></label>
            <label>Description<textarea name="description" rows={3} maxLength={5000} defaultValue={task?.description ?? ''} /></label>
            <label>Project<select name="projectId" required defaultValue={task?.projectId ?? editor.projectId ?? ''}>
              <option value="" disabled>Select a project</option>
              {dashboard.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select></label>
            <label>Assignee<select name="assigneeId" defaultValue={task ? task.assigneeId ?? '' : dashboard.userId}>
              <option value="">Unassigned</option>
              {dashboard.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select></label>
            <label>Estimated effort (minutes)<input type="number" min={1} max={10080} step={1}
              name="estimateMinutes" defaultValue={task?.estimateMinutes ?? ''} placeholder="Optional" /></label>
            <label>Priority<select name="priority" defaultValue={task?.priority ?? ''}>
              <option value="">No priority</option>
              {priorities.map((priority) => <option key={priority}>{priority}</option>)}
            </select></label>
          </>}
          <label>Status<select name="status" defaultValue={currentStatus}>
            {[...new Set([...statuses, currentStatus])].map((status) => <option key={status}>{status}</option>)}
          </select></label>
          {editor.kind === 'tasks' && <label>Start date<input name="startDate" type="date" defaultValue={task?.startDate ?? ''} /></label>}
          <label>Due date<input type="date" name="dueDate" defaultValue={project?.dueDate ?? task?.dueDate ?? ''} /></label>
        </>}
        {confirmDelete && <p role="status">Delete this {entity} permanently?</p>}
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          {(project || task) && <button type="button" disabled={pending} className="button button--secondary workspace-delete"
            onClick={() => confirmDelete ? void perform(onDelete) : setConfirmDelete(true)}>{confirmDelete ? 'Confirm delete' : 'Delete'}</button>}
          <button type="button" disabled={pending} className="button button--secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={pending} className="button button--primary">Save</button>
        </div>
      </form>
      {task && <>
        <TaskTimeForm key={task.id} taskId={task.id} onLogged={onTimeLogged} />
        <TaskComments key={task.id} taskId={task.id} onPosted={() => {
          setActivityRevision((value) => value + 1);
          onActivityChange();
        }} />
        <button className="text-button task-activity-toggle" type="button" aria-expanded={showActivity}
          onClick={() => setShowActivity(!showActivity)}>{showActivity ? 'Hide activity' : 'Show activity'}</button>
        {showActivity && <TaskActivity key={`${task.id}:${activityRevision}`} taskId={task.id} />}
      </>}
    </section>
  </div>;
}
