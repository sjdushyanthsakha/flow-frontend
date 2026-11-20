import { useEffect, useState } from 'react';
import { OperationsHeading } from '../../components/workspace/OperationsLayout';
import { Icon } from '../../lib/icons';
import { formatCapacity, initials } from '../dashboard/data';
import { useDashboardRequest } from '../../auth/DashboardSession';
import { projectPath } from '../dashboard/projectRoutes';
import { userAvatar, userPath, userStatuses, type Directory, type UserDetail, type UserStatus, type WorkspaceUser } from './directoryData';
import { UserEditor, type UserEditMode } from './UserEditor';

const profilePath = (id: string) => `/admin/users/${id}`;
const summaryLabels = [
  ['active', 'Active'], ['inactive', 'Inactive'], ['pending_invitation', 'Pending Invitation'], ['departments', 'Departments'],
] as const;

function StatusPill({ status }: { status: UserStatus }) {
  return <span className={`operations-pill user-status user-status--${status}`}>{userStatuses[status]}</span>;
}

export default function UsersPage({ search, onChange }: { search: string; onChange: () => void }) {
  const dashboardRequest = useDashboardRequest();
  const [data, setData] = useState<Directory>();
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState<UserEditMode>();
  const params = new URLSearchParams({ search: query.trim() || search.trim(), department, status, sort, page: String(page) }).toString();

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const timer = setTimeout(() => {
      dashboardRequest<Directory>(`${userPath}?${params}`, { signal: controller.signal }).then(result => {
        if (!controller.signal.aborted) setData(result);
      }).catch((failure: Error) => {
        if (!controller.signal.aborted) {
          setData(undefined);
          setError(failure.message);
        }
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 120);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [params, attempt]);

  useEffect(() => setPage(1), [search]);

  const rows = data?.items ?? [];
  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 5)));
  const currentPage = data?.page ?? 1;

  function open(mode: UserEditMode) { setMessage(''); setEditing(mode); }

  return <div className="operations-page user-management-page">
    <OperationsHeading section="Administration" title="User management" description="Manage people, invitations, reporting details, and workspace assignments.">
      <button type="button" className="button button--secondary" disabled={!data} onClick={() => open({ kind: 'invite' })}>
        <Icon name="user-plus" />Invite user
      </button>
      <button type="button" className="button button--primary" disabled={!data} onClick={() => open({ kind: 'create' })}>
        <Icon name="plus" />Create user
      </button>
    </OperationsHeading>
    {data && <dl className="operations-summary user-summary">{summaryLabels.map(([key, label]) =>
      <div key={key}><div><dt>{label}</dt><dd>{data.summary[key]}</dd></div></div>)}</dl>}
    {message && <p className="user-notice" role="status">{message}</p>}
    <section className="operations-card user-directory" aria-label="Workspace user directory" aria-busy={loading}>
      <div className="operations-toolbar">
        <label className="operations-search"><Icon name="search" /><input type="search" aria-label="Search name, email, or ID"
          placeholder="Search name, email, or ID…" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} /></label>
        <div className="operations-actions">
          <select aria-label="Filter by status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            <option value="">All</option>{Object.entries(userStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select aria-label="Filter by department" value={department} onChange={(event) => { setDepartment(event.target.value); setPage(1); }}>
            <option value="">All</option>{data?.departments.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select aria-label="Sort users" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}>
            <option value="name">Sort: Name</option><option value="employee">Sort: Employee ID</option>
            <option value="department">Sort: Department</option><option value="status">Sort: Status</option>
          </select>
        </div>
      </div>
      <div className="operations-table-scroll">
        <table className="operations-table user-table">
          <thead><tr>{['User', 'Employee ID', 'Department', 'Role', 'Status'].map(label => <th key={label} scope="col">{label}</th>)}
            <th scope="col"><span className="sr-only">User actions</span></th></tr></thead>
          <tbody>{rows.map((user) => {
            const avatar = userAvatar(user);
            const href = profilePath(user.id);
            return <tr key={user.id} onClick={(event) => {
              if (!(event.target instanceof Element) || event.target.closest('button, a')) return;
              window.location.assign(href);
            }}>
              <td><div className="operations-person">
                <span className={avatar.className} aria-hidden="true">{avatar.text}</span>
                <div><a className="user-name-link" href={href}>{user.name}</a><small>{user.email}</small></div>
              </div></td>
              <td>{user.employeeId}</td><td>{user.department ?? '—'}{user.jobTitle && <small>{user.jobTitle}</small>}</td>
              <td>{user.roleLabel}</td><td><StatusPill status={user.status} /></td>
              <td><div className="user-row-actions">
                <a className="icon-button" href={href} title="View profile" aria-label={`View ${user.name}`}><Icon name="eye" /></a>
                <button className="icon-button" type="button" title="Edit user" aria-label={`Edit ${user.name}`} aria-haspopup="dialog"
                  onClick={() => open({ kind: 'edit', user })}><Icon name="dots" /></button>
              </div></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      {error && <div className="operation-empty"><p role="alert">{error}</p><button className="button button--secondary" type="button"
        onClick={() => setAttempt(attempt + 1)}>Retry</button></div>}
      {loading && !data && <p className="operation-empty" role="status">Loading users…</p>}
      {!loading && data && !rows.length && <p className="operation-empty">No users match your filters.</p>}
      {data && <footer className="user-directory-footer">
        <span>Showing {rows.length} of {data.total} {data.total === 1 ? 'user' : 'users'}</span>
        <nav aria-label="User directory pages">
          <button className="icon-button" type="button" disabled={loading || currentPage <= 1} aria-label="Previous page"
            onClick={() => setPage(currentPage - 1)}><Icon name="chevron" /></button>
          <span aria-current="page">{currentPage}</span>
          <button className="icon-button" type="button" disabled={loading || currentPage >= pageCount} aria-label="Next page"
            onClick={() => setPage(currentPage + 1)}><Icon name="chevron" /></button>
        </nav>
      </footer>}
    </section>
    {editing && <UserEditor mode={editing} onClose={() => setEditing(undefined)} onSave={() => {
      setMessage(editing.kind === 'invite' ? 'Invitation saved as pending.' : editing.kind === 'create' ? 'User created.' : 'User updated.');
      setEditing(undefined);
      setAttempt(attempt + 1);
      onChange();
    }} />}
  </div>;
}

function ProfileCards({ user, projects, workload }: UserDetail) {
  const avatar = userAvatar(user);
  const progress = workload.capacityMinutes ? Math.min(100, Math.round(workload.assignedMinutes / workload.capacityMinutes * 100)) :
    workload.assignedMinutes ? 100 : 0;
  const info = [
    { label: 'Email', value: user.email, icon: 'mail' },
    { label: 'Department', value: user.department ?? 'Unassigned', icon: 'departments' },
    { label: 'Access role', value: user.roleLabel, icon: 'shield' },
    { label: 'Reports to', value: user.manager ?? 'Unassigned', icon: 'user-plus' },
  ] as const;

  return <div className="user-profile-grid">
    <section className="operations-card user-profile-card" aria-label="Profile information">
      <span className={avatar.className} aria-hidden="true">{avatar.text}</span>
      <h2>{user.name}</h2><StatusPill status={user.status} />
      <dl>{info.map(({ label, value, icon }) => <div key={label}><Icon name={icon} /><div><dt>{label}</dt><dd>{value}</dd></div></div>)}</dl>
    </section>
    <div className="user-profile-work">
      <section className="operations-card user-workload-card">
        <h2>Workload snapshot</h2>
        <p><strong>{formatCapacity(workload.assignedMinutes)}</strong> of {formatCapacity(workload.capacityMinutes)} allocated</p>
        <div className="progress-track" role="progressbar" aria-label="Weekly assigned workload" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="user-workload-metrics">
          <span><strong>{workload.assigned}</strong> assigned</span><span><strong>{workload.completed}</strong> completed</span>
          <span><strong>{workload.blocked}</strong> blocked</span>
        </div>
      </section>
      <section className="operations-card user-project-card">
        <h2>Project assignments</h2>
        {projects.length ? <ul>{projects.map(project => <li key={project.id}>
          <a href={projectPath(project.id)}>
            <span className="operations-tile operation-tone--teal">{initials(project.name).slice(0, 1)}</span>
            <div><strong>{project.name}</strong><small>{project.tasks} assigned {project.tasks === 1 ? 'task' : 'tasks'}</small></div>
            <small>{project.role}</small>
          </a>
        </li>)}</ul> : <p className="operation-muted">No project assignments.</p>}
      </section>
    </div>
  </div>;
}

export function UserDetailPage({ memberId, onChange }: { memberId: string; onChange: () => void }) {
  const dashboardRequest = useDashboardRequest();
  const [detail, setDetail] = useState<UserDetail>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const path = `${userPath}/${encodeURIComponent(memberId)}`;

  useEffect(() => {
    const controller = new AbortController();
    dashboardRequest<UserDetail>(path, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setDetail(result); })
      .catch((failure: Error) => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [path, attempt]);

  async function toggleStatus(user: WorkspaceUser) {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const status = user.status === 'active' ? 'inactive' : 'active';
      setDetail(await dashboardRequest<UserDetail>(path, { method: 'PATCH', body: JSON.stringify({ status }) }));
      onChange();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not update user status.');
    } finally { setSaving(false); }
  }

  const user = detail?.user;
  return <div className="operations-page user-management-page user-details-page">
    <a className="user-back" href={user?.canEditProfile ? '/users' : '/dashboard'}>
      <Icon name="arrow" />{user?.canEditProfile ? 'Back to users' : 'Back to dashboard'}
    </a>
    <OperationsHeading section={user ? [user.department, user.employeeId].filter(Boolean).join(' / ') : 'Administration'}
      title={user?.name ?? 'User details'} description={user ? [user.jobTitle, user.roleLabel].filter(Boolean).join(' · ') : ''}>
      {user?.canEditProfile && <>
        <button className="button button--secondary" type="button" disabled={saving} onClick={() => setEditing(true)}><Icon name="edit" />Edit profile</button>
        {user.canManageAccess && <button className="button button--primary" type="button" disabled={saving} onClick={() => void toggleStatus(user)}>
          {user.status === 'active' ? 'Deactivate' : 'Activate'}
        </button>}
      </>}
    </OperationsHeading>
    {error && <div className="operations-card operation-empty"><p role="alert">{error}</p>{!detail && <button
      className="button button--secondary" type="button" onClick={() => { setError(''); setAttempt(attempt + 1); }}>Retry</button>}</div>}
    {!detail && !error && <p className="operation-empty" role="status">Loading user profile…</p>}
    {detail && <ProfileCards {...detail} />}
    {editing && user && <UserEditor mode={{ kind: 'edit', user }} onClose={() => setEditing(false)} onSave={(updated) => {
      if (updated) setDetail(updated);
      setError('');
      setEditing(false);
      onChange();
    }} />}
  </div>;
}
