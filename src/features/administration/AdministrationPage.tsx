import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { OperationsDialog, OperationsHeading } from '../../components/workspace/OperationsLayout';
import { Icon } from '../../lib/icons';
import { formatCapacity, initials, type Member } from '../dashboard/data';
import { useDashboardRequest } from '../../auth/DashboardSession';
import { AuditLogs } from './AuditLogs';

export type AdminSection = 'organization' | 'departments' | 'roles' | 'audit';
type Person = { id: string; name: string; role: string; jobTitle: string | null; departmentId: string | null; department: string | null; managerId: string | null };
type Organization = { kind: 'organization'; name: string; departments: number; members: number; managers: number;
  people: Person[]; departmentOptions: { id: string; name: string }[] };
type Department = { id: string; name: string; description: string | null; leadId: string | null; lead: string | null; members: number; capacityMinutes: number };
type Role = { key: string; name: string; members: number; permissions: string[] };
type Roles = { kind: 'roles'; modules: string[]; actions: string[]; items: Role[]; selected?: string };
type Departments = { kind: 'departments'; items: Department[] };
type AdminData = Organization | Departments | Roles;
type Editor = { kind: 'reporting' } | { kind: 'department'; department?: Department } | { kind: 'role'; source?: Role };

const pageCopy = {
  organization: ['Organization hierarchy', 'Explore reporting relationships independently from application access roles.'],
  departments: ['Departments', 'Manage functional groups, leaders, and team capacity.'],
  roles: ['Roles & permissions', 'Control module access and project-specific responsibilities for every role.'],
} as const;
const adminPath = '/administration';

function PersonAvatar({ name, order }: { name: string; order: number }) {
  return <span className={`operations-avatar operations-avatar--${order % 7}`} aria-hidden="true">{initials(name)}</span>;
}

function OrganizationSummary({ data }: { data: Organization }) {
  const totals = [
    { label: 'Departments', value: data.departments, icon: 'departments' },
    { label: 'People', value: data.members, icon: 'users' },
    { label: 'Managers', value: data.managers, icon: 'organization' },
  ] as const;
  return <dl className="operations-summary">{totals.map(({ label, value, icon }) =>
    <div key={label}><Icon name={icon} /><div><dt>{label}</dt><dd>{value}</dd></div></div>)}</dl>;
}

function DepartmentFilter({ value, onChange, departments }: {
  value: string; onChange: (value: string) => void; departments: Organization['departmentOptions'];
}) {
  return <label className="organization-filter"><span>Filter organization</span>
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">All</option>
      {departments.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
    </select>
  </label>;
}

function ReportingTree({ data, visible }: { data: Organization; visible: Person[] }) {
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const people = new Set(visible.map(({ id }) => id));
  const children = new Map<string | null, Person[]>();
  for (const person of visible) {
    const parent = person.managerId && people.has(person.managerId) ? person.managerId : null;
    const reports = children.get(parent) ?? [];
    reports.push(person);
    children.set(parent, reports);
  }
  const reportCounts = new Map<string, number>();
  for (const { managerId } of data.people) {
    if (managerId) reportCounts.set(managerId, (reportCounts.get(managerId) ?? 0) + 1);
  }

  function branch(person: Person): ReactNode {
    const reports = children.get(person.id) ?? [];
    const expanded = !collapsed.includes(person.id);
    const count = reportCounts.get(person.id) ?? 0;
    return <li key={person.id}>
      <div className="organization-person">
        <div className="organization-expand">
          {reports.length > 0 && <button type="button" className="icon-button" aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} reports for ${person.name}`}
            onClick={() => setCollapsed(current => expanded ? [...current, person.id] : current.filter(id => id !== person.id))}>
            <Icon name="chevron" />
          </button>}
        </div>
        <div className="organization-person-name">
          <PersonAvatar name={person.name} order={data.people.indexOf(person)} />
          <span><strong>{person.name}</strong><small>{[person.jobTitle, person.department].filter(Boolean).join(' · ')}</small></span>
        </div>
        <span className="organization-role">{person.role}</span>
        <span className="operation-muted">{count} {count === 1 ? 'report' : 'reports'}</span>
      </div>
      {expanded && reports.length > 0 && <ul>{reports.map(branch)}</ul>}
    </li>;
  }

  return <section className="operations-card organization-tree" aria-label="Reporting structure">
    <header><div><span className="eyebrow">{data.name}</span><h2>Reporting structure</h2></div><span className="operation-muted">{visible.length} people shown</span></header>
    {visible.length ? <ul>{children.get(null)?.map(branch)}</ul> : <p className="operation-empty">No people match this filter.</p>}
  </section>;
}

function DepartmentGrid({ items, members, onEdit }: { items: Department[]; members: Member[]; onEdit: (department: Department) => void }) {
  return items.length ? <div className="department-grid">{items.map((department) => (
    <section className="operations-card department-card" key={department.id}>
      <header><span className="operations-tile"><Icon name="departments" /></span><div><h2>{department.name}</h2>
        <small>{department.members} {department.members === 1 ? 'member' : 'members'} · {formatCapacity(department.capacityMinutes)} weekly capacity</small>
      </div></header>
      <div className="department-lead">
        {department.lead && <PersonAvatar name={department.lead} order={Math.max(0, members.findIndex(member => member.id === department.leadId))} />}
        <div><small>Department lead</small><strong>{department.lead ?? 'Unassigned'}</strong></div>
      </div>
      <button className="button button--secondary" type="button" onClick={() => onEdit(department)}>Manage department</button>
    </section>
  ))}</div> : <p className="operations-card operation-empty">No departments have been configured.</p>;
}

function PermissionMatrix({ data, selected, setSelected, busy, error, onSave, onDuplicate }: {
  data: Roles; selected: string; setSelected: (key: string) => void; busy: boolean; error: string;
  onSave: (permission: string, enabled: boolean) => void; onDuplicate: (role: Role) => void;
}) {
  const role = data.items.find(item => item.key === selected) ?? data.items[0];
  return <>
    <div className="permissions-callout"><Icon name="shield" /><p><strong>Permission preview</strong> Workspace administrator access is enforced by the server.</p>
      <label>Test as<select value={role.key} onChange={(event) => setSelected(event.target.value)}>
        {data.items.map(item => <option key={item.key} value={item.key}>{item.name}</option>)}
      </select></label>
    </div>
    <div className="permissions-layout">
      <section className="operations-card permissions-roles" aria-label="Workspace roles">
        <header><span className="eyebrow">Workspace roles</span><strong>{data.items.length} roles</strong></header>
        {data.items.map(item => <button type="button" key={item.key} aria-pressed={item.key === role.key} onClick={() => setSelected(item.key)}>
          <span className="operations-tile"><Icon name="shield" /></span>
          <span><strong>{item.name}</strong><small>{item.members} assigned {item.members === 1 ? 'user' : 'users'}</small></span>
          {item.key === role.key && <Icon name="check" />}
        </button>)}
      </section>
      <section className="operations-card permissions-matrix">
        <header><div><span className="eyebrow">Permission matrix</span><h2>{role.name}</h2><small>Changes are saved to this workspace’s permission preview.</small></div>
          <button type="button" className="button button--secondary" onClick={() => onDuplicate(role)}><Icon name="copy" />Duplicate role</button>
        </header>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="operations-table-scroll"><table>
          <thead><tr><th scope="col">Module</th>{data.actions.map(action => <th key={action} scope="col">{action}</th>)}</tr></thead>
          <tbody>{data.modules.map(module => <tr key={module}><th scope="row">{module}</th>
            {data.actions.map(action => {
              const key = `${module}:${action}`;
              return <td key={action}><input type="checkbox" aria-label={`${module}, ${action}`} checked={role.permissions.includes(key)}
                disabled={busy} onChange={(event) => onSave(key, event.target.checked)} /></td>;
            })}
          </tr>)}</tbody>
        </table></div>
      </section>
    </div>
  </>;
}

function ReportingFields({ data }: { data: Organization }) {
  const [id, setId] = useState('');
  const person = data.people.find(item => item.id === id);
  return <>
    <label>Person<select name="personId" required value={id} onChange={(event) => setId(event.target.value)}>
      <option value="">Select a person</option>{data.people.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label>
    {person && <div className="operations-form-fields" key={person.id}>
      <label>Manager<select name="managerId" defaultValue={person.managerId ?? ''}>
        <option value="">No manager</option>{data.people.filter(item => item.id !== person.id).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      <label>Department<select name="departmentId" defaultValue={person.departmentId ?? ''}>
        <option value="">No department</option>{data.departmentOptions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      <label>Job title<input name="jobTitle" maxLength={120} defaultValue={person.jobTitle ?? ''} /></label>
    </div>}
  </>;
}

function AdministrationWorkspace({ section, members }: { section: Exclude<AdminSection, 'audit'>; members: Member[] }) {
  const dashboardRequest = useDashboardRequest();
  const [data, setData] = useState<AdminData>();
  const [summary, setSummary] = useState<Organization>();
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState('system-admin');
  const [editor, setEditor] = useState<Editor>();
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: controller.signal };
    Promise.all([
      dashboardRequest<AdminData>(`${adminPath}/${section}`, options),
      section === 'departments' ? dashboardRequest<Organization>(`${adminPath}/organization`, options) : undefined,
    ]).then(([payload, totals]) => {
      if (!controller.signal.aborted) {
        setData(payload);
        setSummary(totals);
      }
    }).catch((failure: Error) => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [section, attempt]);

  function open(next: Editor) { setFormError(''); setEditor(next); }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || busy) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    let path = adminPath;
    let method = 'POST';
    if (editor.kind === 'reporting') {
      path += `/reporting/${fields.personId}`;
      method = 'PATCH';
    } else if (editor.kind === 'department') {
      path += '/departments';
      if (editor.department) {
        path += `/${editor.department.id}`;
        method = 'PATCH';
      }
    } else {
      path += '/roles';
      if (editor.source) fields.copyFrom = editor.source.key;
    }
    setBusy(true);
    setFormError('');
    try {
      const result = await dashboardRequest<AdminData>(path, { method, body: JSON.stringify(fields) });
      setData(result);
      if (result.kind === 'departments') setSummary(current => current && { ...current, departments: result.items.length, departmentOptions: result.items });
      if (result.kind === 'roles' && result.selected) setSelected(result.selected);
      setEditor(undefined);
    } catch (failure) {
      setFormError(failure instanceof Error ? failure.message : 'Could not save changes.');
    } finally {
      setBusy(false);
    }
  }

  async function savePermission(permission: string, enabled: boolean) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      setData(await dashboardRequest<Roles>(`${adminPath}/roles/${selected}`, { method: 'PATCH', body: JSON.stringify({ permission, enabled }) }));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save the permission.');
    } finally {
      setBusy(false);
    }
  }

  const [title, description] = pageCopy[section];
  const org = data?.kind === 'organization' ? data : summary;
  const department = editor?.kind === 'department' ? editor.department : undefined;
  const sourceRole = editor?.kind === 'role' ? editor.source : undefined;
  return <div className="operations-page">
    <OperationsHeading section="Administration" title={title} description={description}>
      {data && <button type="button" className="button button--primary" onClick={() => open(
        section === 'organization' ? { kind: 'reporting' } : section === 'departments' ? { kind: 'department' } : { kind: 'role' },
      )}><Icon name="plus" />{section === 'organization' ? 'Assign manager' : section === 'departments' ? 'Add department' : 'Create custom role'}</button>}
    </OperationsHeading>
    {!data && (error ? <div className="operations-card operation-empty"><p role="alert">{error}</p>
      <button type="button" className="button button--secondary" onClick={() => { setError(''); setAttempt(attempt + 1); }}>Retry</button>
    </div> : <p role="status" className="operation-empty">Loading {title.toLowerCase()}…</p>)}
    {org && <><OrganizationSummary data={org} />
      <DepartmentFilter value={filter} onChange={setFilter} departments={org.departmentOptions} /></>}
    {data?.kind === 'organization' && <ReportingTree data={data} visible={data.people.filter(person => !filter || person.departmentId === filter)} />}
    {data?.kind === 'departments' && <DepartmentGrid items={data.items.filter(item => !filter || item.id === filter)}
      members={members} onEdit={(item) => open({ kind: 'department', department: item })} />}
    {data?.kind === 'roles' && <PermissionMatrix data={data} selected={selected} setSelected={setSelected} busy={busy} error={error}
      onSave={(permission, enabled) => void savePermission(permission, enabled)} onDuplicate={(source) => open({ kind: 'role', source })} />}
    {editor && <OperationsDialog title={editor.kind === 'reporting' ? 'Assign manager' : editor.kind === 'department' ?
      department ? 'Manage department' : 'Add department' : sourceRole ? 'Duplicate role' : 'Create custom role'}
      onClose={() => setEditor(undefined)} busy={busy}>
      <form className="operations-form-fields" onSubmit={(event) => void submit(event)}>
        {editor.kind === 'reporting' && org && <ReportingFields data={org} />}
        {editor.kind === 'department' && <>
          <label>Department name<input name="name" maxLength={100} required defaultValue={department?.name} /></label>
          <label>Description<textarea name="description" maxLength={1000} rows={3} defaultValue={department?.description ?? ''} /></label>
          <label>Department lead<select name="leadId" defaultValue={department?.leadId ?? ''}>
            <option value="">Unassigned</option>{members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select></label>
        </>}
        {editor.kind === 'role' && <label>Role name<input name="name" maxLength={64} required
          defaultValue={sourceRole ? `${sourceRole.name.slice(0, 59)} copy` : ''} /></label>}
        {formError && <p role="alert" className="field-error">{formError}</p>}
        <footer><button type="button" className="button button--secondary" disabled={busy} onClick={() => setEditor(undefined)}>Cancel</button>
          <button type="submit" className="button button--primary" disabled={busy}>Save</button></footer>
      </form>
    </OperationsDialog>}
  </div>;
}

export default function AdministrationPage({ section, members, search }: { section: AdminSection; members: Member[]; search: string }) {
  return section === 'audit' ? <AuditLogs workspaceSearch={search} /> : <AdministrationWorkspace section={section} members={members} />;
}
