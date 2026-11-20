import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Icon } from '../../lib/icons';
import type { Dashboard } from './data';

type Props = {
  dashboard: Dashboard;
  projectId?: string;
  status?: string;
  onCreate: (values: Record<string, string>) => Promise<void>;
  onClose: () => void;
};

const statuses = ['To do', 'In progress', 'In review', 'Blocked', 'Done'];
const priorities = ['Low', 'Medium', 'High', 'Urgent'];

export function CreateTaskModal({ dashboard, projectId, status = 'To do', onCreate, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const lastRequest = useRef<{ fingerprint: string; id: string } | undefined>(undefined);
  const titleId = useId();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    node.showModal();
    titleInput.current?.focus();
    return () => { if (node.open) node.close(); };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const values: Record<string, string> = {};
    new FormData(event.currentTarget).forEach((value, key) => { values[key] = String(value).trim(); });
    if (!values.title) {
      setError('Enter a task title.');
      titleInput.current?.focus();
      return;
    }
    const fingerprint = JSON.stringify(values);
    if (lastRequest.current?.fingerprint !== fingerprint) {
      lastRequest.current = { fingerprint, id: crypto.randomUUID() };
    }
    setSaving(true);
    setError('');
    try {
      await onCreate({ ...values, requestId: lastRequest.current.id });
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not create the task.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog className="create-task-dialog" ref={dialog} aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <form className="create-task-form" onSubmit={(event) => void submit(event)} aria-busy={saving}>
        <header className="create-task-header">
          <div><span className="eyebrow">New work item</span><h2 id={titleId}>Create task</h2></div>
          <button type="button" className="icon-button" aria-label="Close create task" disabled={saving} onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        <fieldset className="create-task-fields" disabled={saving}>
          <label className="create-task-full">
            Task title
            <input ref={titleInput} name="title" required maxLength={240} placeholder="What needs to be done?" onChange={() => setError('')} />
          </label>
          <label className="create-task-full">
            Project
            <select name="projectId" required defaultValue={projectId ?? ''}>
              <option value="" disabled>Select a project</option>
              {dashboard.projects.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <label>
            Status
            <select name="status" defaultValue={status}>
              {[...new Set([...statuses, status])].map((value) => <option value={value} key={value}>{value === 'Done' ? 'Completed' : value}</option>)}
            </select>
          </label>
          <label>
            Priority
            <select name="priority" defaultValue="Medium">
              <option value="">No priority</option>
              {priorities.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            Assignee
            <select name="assigneeId" defaultValue={dashboard.userId}>
              <option value="">Unassigned</option>
              {dashboard.members.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <label>Due date<input name="dueDate" type="date" /></label>
          {error && <p className="field-error create-task-full" role="alert">{error}</p>}
        </fieldset>
        <footer className="create-task-footer">
          <button type="button" className="button button--secondary" disabled={saving} onClick={onClose}>Cancel</button>
          <button type="submit" className="button button--primary" disabled={saving}><Icon name="plus" />
            {saving ? 'Creating…' : 'Create task'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
