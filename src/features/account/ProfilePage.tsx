import { useAuth0 } from '@auth0/auth0-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { hasAuth0Configuration } from '../../auth/AuthProvider';
import { OperationsDialog, OperationsHeading } from '../../components/workspace/OperationsLayout';
import { Icon } from '../../lib/icons';
import { initials } from '../dashboard/data';
import { notificationWorkspace, requestApi, setNotificationWorkspace, type RequestApi, type Workspace } from '../notifications/api';

const profilePath = 'account/profile';
type Profile = {
  id: string; name: string; email: string; status: 'active'; roleLabel: string; workspaceName: string;
  activeProjects: number; openTasks: number; session: 'local' | 'auth0' | 'password';
};

function ProfileEditor({ profile, request, onClose, onSave }: {
  profile: Profile; request: RequestApi; onClose: () => void; onSave: (profile: Profile) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const { name, email } = Object.fromEntries(new FormData(event.currentTarget));
    setSaving(true);
    setError('');
    try {
      onSave(await request<Profile>(profilePath, { method: 'PATCH', body: JSON.stringify({ name, email }) }));
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save your profile.');
    } finally { setSaving(false); }
  }

  return <OperationsDialog title="Edit profile" eyebrow="Flowdeck" variant="wide" busy={saving} onClose={onClose}
    description="These details are visible to members of this workspace.">
    <form className="user-edit-form" onSubmit={(event) => void save(event)}>
      <fieldset className="user-edit-fields" disabled={saving}>
        <label>Full name<input name="name" autoComplete="name" maxLength={160} required defaultValue={profile.name} /></label>
        <label>Work email<input name="email" autoComplete="email" type="email" maxLength={320} required defaultValue={profile.email} /></label>
      </fieldset>
      {error && <p className="field-error" role="alert">{error}</p>}
      <footer>
        <button type="button" className="button button--secondary" disabled={saving} onClick={onClose}>Cancel</button>
        <button type="submit" className="button button--primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
      </footer>
    </form>
  </OperationsDialog>;
}

function ProfileContent({ request, onSave, workspacePicker }: {
  request: RequestApi; onSave: () => void; workspacePicker?: React.ReactNode;
}) {
  const [profile, setProfile] = useState<Profile>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    request<Profile>(profilePath, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setProfile(result); })
      .catch((failure: Error) => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [request, attempt]);

  return <div className="operations-page account-page">
    <OperationsHeading section="Account" title="My profile" description="Your personal details, role, and workspace assignments.">
      {workspacePicker}
      {profile && <button type="button" className="button button--primary" onClick={() => setEditing(true)}>Edit profile</button>}
    </OperationsHeading>
    {error && <div className="operations-card operation-empty">
      <p role="alert">{error}</p>
      <button type="button" className="button button--secondary" onClick={() => {
        setError(''); setAttempt(attempt + 1);
      }}>Retry</button>
    </div>}
    {!profile && !error && <p className="operation-empty" role="status">Loading your profile…</p>}
    {profile && <div className="user-profile-grid account-profile-grid">
      <section className="operations-card user-profile-card" aria-label="Personal details">
        <span className="operations-avatar" aria-hidden="true">{initials(profile.name)}</span>
        <h2>{profile.name}</h2>
        <span className="operations-pill user-status user-status--active">Active</span>
        <dl>
          <div><Icon name="mail" /><div><dt>Email</dt><dd>{profile.email}</dd></div></div>
          <div><Icon name="shield" /><div><dt>Access role</dt><dd>{profile.roleLabel}</dd></div></div>
        </dl>
      </section>
      <section className="operations-card account-workspace-card">
        <h2>Your workspace</h2>
        <p>You are assigned to {profile.activeProjects} active {profile.activeProjects === 1 ? 'project' : 'projects'} and {profile.openTasks} open {profile.openTasks === 1 ? 'task' : 'tasks'}.</p>
        <div className="account-session-info">
          <Icon name="shield" />
          <div>
            <strong>{profile.session === 'auth0' ? 'Account secured' : 'Local demo session'}</strong>
            <small>{profile.session === 'auth0' ? 'Signed in with Auth0' : profile.session === 'password' ? 'Signed in with a password' : 'Using the configured local workspace'}</small>
          </div>
        </div>
      </section>
    </div>}
    {editing && profile && <ProfileEditor profile={profile} request={request} onClose={() => setEditing(false)} onSave={(updated) => {
      setProfile(updated); onSave();
    }} />}
  </div>;
}

function Auth0Profile({ onSave }: { onSave: () => void }) {
  const { getAccessTokenSilently, isAuthenticated, isLoading, loginWithRedirect } = useAuth0();
  const [workspaces, setWorkspaces] = useState<Workspace[]>();
  const [workspaceId, setWorkspaceId] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;
    const controller = new AbortController();
    getAccessTokenSilently().then(token => requestApi<Workspace[]>('notifications/workspaces', { signal: controller.signal }, token))
      .then(result => {
        if (controller.signal.aborted) return;
        setWorkspaces(result);
        setWorkspaceId(notificationWorkspace(result) ?? '');
      }).catch((failure: Error) => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [isAuthenticated, getAccessTokenSilently, attempt]);

  const request = useCallback<RequestApi>(async (path, options) => {
    const token = await getAccessTokenSilently();
    const headers = new Headers(options?.headers);
    headers.set('X-Workspace-Id', workspaceId);
    return requestApi(path, { ...options, headers }, token);
  }, [getAccessTokenSilently, workspaceId]);

  if (isAuthenticated && workspaceId) {
    const picker = workspaces && workspaces.length > 1 ? <label className="operations-filter">Workspace
      <select value={workspaceId} onChange={event => {
        setWorkspaceId(event.target.value);
        setNotificationWorkspace(event.target.value);
      }}>
        {workspaces.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
      </select>
    </label> : undefined;
    return <ProfileContent key={workspaceId} request={request} onSave={onSave} workspacePicker={picker} />;
  }

  return <div className="operations-page account-page">
    <OperationsHeading section="Account" title="My profile" description="Your personal details, role, and workspace assignments." />
    <section className="operations-card operation-empty">
      {error && <p role="alert">{error}</p>}
      {isLoading ? <p role="status">Checking your session…</p> : !isAuthenticated ?
        <button className="button button--primary" type="button" onClick={() => {
          setError('');
          void loginWithRedirect({ appState: { returnTo: '/account/profile' } }).catch(() => setError('Could not open sign-in.'));
        }}>Sign in</button> : error ? <button className="button button--secondary" type="button"
          onClick={() => { setError(''); setAttempt(attempt + 1); }}>Retry</button> :
          <p role="status">{workspaces ? 'You don’t have access to an active workspace.' : 'Loading workspaces…'}</p>}
    </section>
  </div>;
}

export default function ProfilePage({ onSave }: { onSave: () => void }) {
  return hasAuth0Configuration() ? <Auth0Profile onSave={onSave} /> : <ProfileContent request={requestApi} onSave={onSave} />;
}
