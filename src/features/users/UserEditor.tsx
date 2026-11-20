import { useEffect, useState, type FormEvent } from 'react';
import { OperationsDialog } from '../../components/workspace/OperationsLayout';
import { useDashboardRequest } from '../../auth/DashboardSession';
import { userPath, userStatuses, type UserDetail, type WorkspaceUser } from './directoryData';

export type UserEditMode = { kind: 'edit'; user: WorkspaceUser } | { kind: 'create' } | { kind: 'invite' };
type Option = { id: string; name: string };
type Options = { departments: Option[]; managers: Option[]; roles: { key: string; name: string }[] };

export function UserEditor({ mode, onClose, onSave }: {
  mode: UserEditMode; onClose: () => void; onSave: (detail?: UserDetail) => void;
}) {
  const dashboardRequest = useDashboardRequest();
  const [options, setOptions] = useState<Options>();
  const [loadingError, setLoadingError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const user = mode.kind === 'edit' ? mode.user : undefined;
  const isInvite = mode.kind === 'invite';
  const title = user ? 'Edit user' : isInvite ? 'Invite user' : 'Create user';

  useEffect(() => {
    const controller = new AbortController();
    dashboardRequest<Options>(`${userPath}/options`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setOptions(result); })
      .catch((failure: Error) => { if (!controller.signal.aborted) setLoadingError(failure.message); });
    return () => controller.abort();
  }, [attempt]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !options) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    if (isInvite) fields.status = 'pending_invitation';
    setSaving(true);
    setError('');
    try {
      const request = { method: user ? 'PATCH' : 'POST', body: JSON.stringify(fields) };
      if (user) onSave(await dashboardRequest<UserDetail>(`${userPath}/${user.id}`, request));
      else {
        await dashboardRequest<WorkspaceUser>(userPath, request);
        onSave();
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save the user.');
    } finally { setSaving(false); }
  }

  return <OperationsDialog title={title} eyebrow="Flowdeck" variant="wide" busy={saving} onClose={onClose}
    description={isInvite ? 'Save an invitation as pending in this workspace. Email delivery is unavailable.' :
      'Access roles and reporting relationships are managed independently.'}>
    <form className="user-edit-form" onSubmit={(event) => void submit(event)}>
      {loadingError && <p className="field-error" role="alert">{loadingError} <button className="text-button" type="button" onClick={() => {
        setLoadingError(''); setAttempt(attempt + 1);
      }}>Retry</button></p>}
      {!options && !loadingError && <p className="operation-empty" role="status">Loading user settings…</p>}
      {options && <fieldset className="user-edit-fields" disabled={saving}>
        <label>Full name<input name="name" maxLength={160} required defaultValue={user?.name} /></label>
        <label>Work email<input name="email" type="email" maxLength={320} required defaultValue={user?.email} /></label>
        <label>Department<select name="departmentId" defaultValue={user?.departmentId ?? ''}>
          <option value="">No department</option>
          {options.departments.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
        </select></label>
        <label>Designation<input name="jobTitle" maxLength={120} defaultValue={user?.jobTitle ?? ''} /></label>
        <label>Application role<select name="roleKey" defaultValue={user?.roleKey ?? 'team-member'} disabled={Boolean(user && !user.canManageAccess)}>
          {user && !options.roles.some(role => role.key === user.roleKey) && <option value={user.roleKey}>{user.roleLabel}</option>}
          {options.roles.map(({ key, name }) => <option key={key} value={key}>{name}</option>)}
        </select></label>
        <label>User status<select name="status" defaultValue={user?.status ?? (isInvite ? 'pending_invitation' : 'active')}
          disabled={isInvite || Boolean(user && !user.canManageAccess)}>
          {Object.entries(userStatuses).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select></label>
        <label>Reporting manager<select name="managerId" defaultValue={user?.managerId ?? ''}>
          <option value="">No manager</option>
          {user?.managerId && !options.managers.some(manager => manager.id === user.managerId) &&
            <option value={user.managerId}>{user.manager}</option>}
          {options.managers.filter(item => item.id !== user?.id).map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
        </select></label>
      </fieldset>}
      {error && <p className="field-error" role="alert">{error}</p>}
      <footer>
        <button type="button" className="button button--secondary" disabled={saving} onClick={onClose}>Cancel</button>
        <button type="submit" className="button button--primary" disabled={saving || !options}>
          {saving ? 'Saving…' : user ? 'Save changes' : title}
        </button>
      </footer>
    </form>
  </OperationsDialog>;
}
