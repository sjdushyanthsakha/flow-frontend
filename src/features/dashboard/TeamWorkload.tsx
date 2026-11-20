import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { formatCapacity, initials, type Member, type Project } from './data';
import { useDashboardRequest } from '../../auth/DashboardSession';

import { OperationsDialog, OperationsHeading } from '../../components/workspace/OperationsLayout';
import { Icon } from '../../lib/icons';

type Workload = {
  id: string; open: number; overdue: number; completed: number; review: number;
  capacityMinutes: number; assignedMinutes: number; loggedMinutes: number; jobTitle: string | null;
};
type WorkRow = Workload & Member;

function CapacityForm({ id, initial, onSave }: { id: string; initial: number; onSave: (minutes: number) => void }) {
  const dashboardRequest = useDashboardRequest();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const minutes = Number(new FormData(event.currentTarget).get('capacityMinutes'));
    setBusy(true);
    setError('');
    try {
      const result = await dashboardRequest<{ capacityMinutes: number }>(`/members/${id}/weekly-capacity`, {
        method: 'PATCH', body: JSON.stringify({ capacityMinutes: minutes }),
      });
      onSave(result.capacityMinutes);
      setEditing(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save capacity.');
    } finally {
      setBusy(false);
    }
  }

  return editing ? <form className="capacity-form" onSubmit={(event) => void submit(event)}>
    <label>Weekly capacity (minutes)
      <input type="number" name="capacityMinutes" min={0} max={10080} step={1} required defaultValue={initial} disabled={busy} />
    </label>
    <button className="button button--secondary" type="submit" disabled={busy}>Save</button>
    <button className="text-button" type="button" disabled={busy} onClick={() => { setEditing(false); setError(''); }}>Cancel</button>
    {error && <span role="alert">{error}</span>}
  </form> : <button className="text-button capacity-edit" type="button" onClick={() => setEditing(true)}>Edit capacity</button>;
}

function CapacityChart({ rows }: { rows: WorkRow[] }) {
  const maxHours = Math.max(40, ...rows.map(row => Math.max(row.capacityMinutes, row.assignedMinutes) / 60));
  const top = Math.ceil(maxHours / 20) * 20;
  return <section className="operations-card capacity-chart" aria-label="Capacity versus assigned work">
    <header><div><span className="eyebrow">Current week</span><h2>Capacity vs assigned work</h2></div>
      <div className="capacity-legend"><span>Assigned</span><span>Capacity</span></div>
    </header>
    {rows.length ? <div className="capacity-chart-body">
      <div className="capacity-axis" aria-hidden="true">{[top, top * .75, top * .5, top * .25, 0].map(value => <span key={value}>{value}</span>)}</div>
      <div className="capacity-chart-rail">
        <div className="capacity-chart-grid" aria-hidden="true">{[0, 1, 2, 3, 4].map(index => <span key={index} />)}</div>
        <ul style={{ '--members': rows.length } as CSSProperties}>
          {rows.map(({ id, name, assignedMinutes, capacityMinutes }) => <li key={id}
            aria-label={`${name}, ${formatCapacity(assignedMinutes)} assigned of ${formatCapacity(capacityMinutes)} capacity`}
            title={`${name} · ${formatCapacity(assignedMinutes)} assigned · ${formatCapacity(capacityMinutes)} capacity`}>
            <div className="capacity-bar-pair">
              <span style={{ height: `${assignedMinutes / (top * 60) * 100}%` }} />
              <span style={{ height: `${capacityMinutes / (top * 60) * 100}%` }} />
            </div>
            <span>{name.split(/\s+/)[0]}</span>
          </li>)}
        </ul>
      </div>
    </div> : <p className="operation-empty">No members on this project.</p>}
  </section>;
}

export function TeamWorkload({ members, projects, search, canEditCapacity, sprint, onAddMember }: {
  members: Member[]; projects: Project[]; search: string; canEditCapacity: boolean; sprint: boolean; onAddMember: () => void;
}) {
  const dashboardRequest = useDashboardRequest();
  const [workload, setWorkload] = useState<Workload[]>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [project, setProject] = useState('');
  const [query, setQuery] = useState('');
  const [details, setDetails] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();
    setError('');
    setWorkload(undefined);
    const path = project ? `/team-workload?projectId=${project}` : '/team-workload';
    dashboardRequest<Workload[]>(path, { signal: controller.signal }).then((result) => {
      if (!controller.signal.aborted) setWorkload(result);
    }).catch((failure: Error) => {
      if (!controller.signal.aborted) setError(failure.message);
    });
    return () => controller.abort();
  }, [attempt, members, project]);

  const byMember = new Map(workload?.map((entry) => [entry.id, entry]));
  const rows = members.flatMap(member => {
    const work = byMember.get(member.id);
    return work ? [{ ...member, ...work }] : [];
  });
  const capacity = rows.reduce((total, row) => total + row.capacityMinutes, 0);
  const assigned = rows.reduce((total, row) => total + row.assignedMinutes, 0);
  const overCapacity = rows.filter(row => row.assignedMinutes > row.capacityMinutes).length;
  const available = Math.max(0, capacity - assigned);
  const stats = [
    { label: 'Active members', value: rows.length, hint: project ? 'Selected project' : `Across ${projects.length} projects`, icon: 'users', tone: 'purple' },
    { label: 'Team utilization', value: capacity ? `${Math.round(assigned / capacity * 100)}%` : '—', hint: `${formatCapacity(assigned)} of ${formatCapacity(capacity)}`, icon: 'timer', tone: 'teal' },
    { label: 'Over capacity', value: overCapacity, hint: 'Needs rebalancing', icon: 'alert', tone: 'rose' },
    { label: 'Available capacity', value: formatCapacity(available), hint: 'This week', icon: 'clock', tone: 'green' },
  ] as const;
  const term = query.trim().toLowerCase();
  const visible = rows.filter(({ name, role, jobTitle }) => {
    const text = `${name} ${role} ${jobTitle ?? ''}`.toLowerCase();
    return text.includes(search) && text.includes(term);
  });
  const capacityRows = details === 'all' ? rows : rows.filter(row => row.id === details);

  return <div className="operations-page workload-page">
    <OperationsHeading section="People & capacity" title="Team workload" description="Balance assignments and spot capacity risks before they slow delivery.">
      <button className="button button--primary" type="button" onClick={() => setDetails('all')} disabled={!rows.length}><Icon name="users" />Capacity details</button>
    </OperationsHeading>
    {error && <div className="operations-card operation-empty"><p role="alert">{error}</p>
      <button className="button button--secondary" type="button" onClick={() => setAttempt(attempt + 1)}>Retry</button></div>}
    {!workload && !error && <p className="operation-empty" role="status">Loading workload…</p>}
    {workload && <>
      <div className="workload-stats">{stats.map(({ label, value, hint, icon, tone }) => (
        <div className="operations-card" key={label}><span className={`operations-tile operation-tone--${tone}`}><Icon name={icon} /></span>
          <div><small>{label}</small><strong>{value}</strong><span>{hint}</span></div></div>
      ))}</div>
      <CapacityChart rows={rows} />
    </>}
    <div className="operations-toolbar workload-toolbar">
      <label className="operations-search"><Icon name="search" /><input type="search" aria-label="Search team members"
        placeholder="Search team members…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <label className="operations-filter">Project <select value={project} onChange={(event) => setProject(event.target.value)}>
        <option value="">All projects</option>{projects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
    </div>
    {workload && <section className="operations-card" aria-label="Team capacity by member">
      <div className="operations-table-scroll"><table className="operations-table workload-table">
        <thead><tr>{['Team member', 'Assigned work', 'Task mix', 'Time logged', 'Availability'].map(label => <th key={label} scope="col">{label}</th>)}
          <th scope="col"><span className="sr-only">Capacity details</span></th></tr></thead>
        <tbody>{visible.map((row) => {
          const over = row.assignedMinutes > row.capacityMinutes;
          const total = row.open + row.completed;
          const mix = [row.open - row.review, row.review, row.completed];
          return <tr key={row.id}>
            <td><div className="operations-person"><span className={`operations-avatar operations-avatar--${members.findIndex(member => member.id === row.id) % 7}`}
              aria-hidden="true">{initials(row.name)}</span><div><strong>{row.name}</strong><small>{row.jobTitle ?? row.role}</small></div></div></td>
            <td><div className={`workload-assigned ${over ? 'workload-over' : ''}`}>
              <span><strong>{formatCapacity(row.assignedMinutes)}</strong> / {formatCapacity(row.capacityMinutes)}</span>
              <div className="progress-track"><span style={{ width: `${row.capacityMinutes ? Math.min(100, row.assignedMinutes / row.capacityMinutes * 100) : over ? 100 : 0}%` }} /></div>
            </div></td>
            <td><div className="workload-mix" role="img" aria-label={`${mix[0]} open, ${mix[1]} in review, ${mix[2]} completed`}>
              {mix.map((count, index) => <span key={index} style={{ width: `${total ? count / total * 100 : 0}%` }} />)}
            </div></td>
            <td><strong>{formatCapacity(row.loggedMinutes)}</strong><small>{sprint ? 'this sprint' : 'this week'}</small></td>
            <td><span className={`workload-availability ${over ? 'workload-over' : ''}`}>{over ? 'Over capacity' : row.assignedMinutes === row.capacityMinutes ? 'At capacity' : 'Available'}</span></td>
            <td><button className="icon-button workload-open" type="button" aria-label={`Capacity details for ${row.name}`}
              onClick={() => setDetails(row.id)}><Icon name="chevron" /></button></td>
          </tr>;
        })}</tbody>
      </table></div>
      {!visible.length && <p className="operation-empty">No team members match.</p>}
    </section>}
    {details && <OperationsDialog title={details === 'all' ? 'Capacity details' : capacityRows[0]?.name ?? 'Capacity details'}
      onClose={() => setDetails(undefined)}>
      <ul className="workspace-list">{capacityRows.map(row => <li key={row.id}>
        <div><strong>{row.name}</strong><span>{formatCapacity(row.assignedMinutes)} assigned · {formatCapacity(row.capacityMinutes)} capacity</span>
          <span>{row.open} open · {row.overdue} overdue · {row.completed} completed</span>
          {canEditCapacity && <CapacityForm id={row.id} initial={row.capacityMinutes} onSave={minutes =>
            setWorkload(current => current?.map(entry => entry.id === row.id ? { ...entry, capacityMinutes: minutes } : entry))} />}
        </div></li>)}</ul>
      {details === 'all' && canEditCapacity && <button className="button button--secondary" type="button" onClick={() => {
        setDetails(undefined); onAddMember();
      }}><Icon name="plus" />Add member</button>}
    </OperationsDialog>}
  </div>;
}
