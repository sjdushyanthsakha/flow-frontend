import { useMemo, useState } from 'react';
import { Icon } from '../../lib/icons';
import { dateKey, dateLabel, initials, isDone, type Project, type Task } from './data';
import { projectPath } from './projectRoutes';

type Props = {
  projects: Project[];
  tasks: Task[];
  workspaceSearch: string;
  timezone: string;
  onCreate: () => void;
};
type ProjectTotals = { open: number; done: number; progress: number };
const colors = ['violet', 'green', 'coral', 'blue'];
const tones = ['violet', 'teal', 'pink'];

function shortName(name: string) {
  return name.trim().split(/\s+/)[0].slice(0, 18);
}

function healthKey(status: string) {
  return status.trim().toLowerCase();
}

function PortfolioCard({ project, totals, tone }: { project: Project; totals: ProjectTotals; tone: string }) {
  const percent = Math.round(totals.progress * 100);
  const health = healthKey(project.status).replaceAll(' ', '-');
  return <a href={projectPath(project.id)} className={`projects-portfolio-card projects-portfolio-card--${tone} project-card`} aria-label={project.name}>
    <div className="projects-card-top">
      <span className="projects-card-icon" aria-hidden="true">{initials(project.name).slice(0, 1)}</span>
      <span className={`projects-health projects-health--${health}`}><i aria-hidden="true" />{project.status}</span>
      <Icon name="arrow" className="projects-card-arrow" />
    </div>
    <div className="projects-card-heading">
      <span className="eyebrow">{shortName(project.name)}</span>
      <h2>{project.name}</h2>
      {project.description && <p>{project.description}</p>}
    </div>
    <div className="projects-card-progress">
      <div><span>Overall progress</span><strong>{percent}%</strong></div>
      <div className="progress-track" role="progressbar" aria-label={`${project.name} progress`}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
    <div className="projects-card-counts">
      <span><strong>{totals.open}</strong> open</span><span><strong>{totals.done}</strong> done</span>
      {project.dueDate && <time dateTime={project.dueDate}><Icon name="calendar" />{dateLabel(project.dueDate)}</time>}
    </div>
    <div className="projects-card-people">
      <div className="projects-card-owner">
        {project.owner && <span className="avatar avatar--me" aria-hidden="true">{initials(project.owner)}</span>}
        <span><small>Owner</small><strong>{project.owner ?? 'Unassigned'}</strong></span>
      </div>
      {project.members.length > 0 && <div className="avatar-stack" aria-label={`${project.members.length} project members`}>
        {project.members.slice(0, 4).map((member, index) => <span key={`${member}-${index}`}
          className={`avatar avatar--${colors[index % colors.length]}`} title={member}>{initials(member)}</span>)}
        {project.members.length > 4 && <span className="avatar avatar--extra">+{project.members.length - 4}</span>}
      </div>}
    </div>
  </a>;
}

export default function ProjectsPortfolio({ projects, tasks, workspaceSearch, timezone, onCreate }: Props) {
  const [search, setSearch] = useState('');
  const [health, setHealth] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const totals = useMemo(() => {
    const byProject = new Map<string, { open: number; done: number }>();
    let open = 0;
    let blocked = 0;
    for (const task of tasks) {
      const counts = byProject.get(task.projectId) ?? { open: 0, done: 0 };
      if (isDone(task)) {
        counts.done++;
      } else {
        counts.open++;
        open++;
        if (healthKey(task.status) === 'blocked') blocked++;
      }
      byProject.set(task.projectId, counts);
    }
    const withProgress = projects.map((project, index) => {
      const counts = byProject.get(project.id) ?? { open: 0, done: 0 };
      return { project, tone: tones[index % tones.length], totals: { ...counts, progress: counts.done / (counts.open + counts.done || 1) } };
    });
    return { open, blocked, withProgress };
  }, [projects, tasks]);

  const today = dateKey(new Date(), timezone);
  const horizon = new Date(today + 'T00:00:00Z');
  horizon.setUTCDate(horizon.getUTCDate() + 30);
  const end = horizon.toISOString().slice(0, 10);
  const inactive = new Set(['done', 'complete', 'completed', 'archived', 'cancelled', 'canceled']);
  const active = projects.filter(({ status }) => !inactive.has(healthKey(status)));
  const milestones = active.filter(({ dueDate }) => dueDate && dueDate >= today && dueDate <= end).length;
  const progress = projects.length
    ? Math.round(totals.withProgress.reduce((sum, entry) => sum + entry.totals.progress, 0) * 100 / projects.length) : 0;
  const summary = [
    { label: 'Active projects', value: active.length, detail: `${projects.length} total` },
    { label: 'Average progress', value: `${progress}%`, detail: `Across ${projects.length} ${projects.length === 1 ? 'project' : 'projects'}` },
    { label: 'Open tasks', value: totals.open, detail: `${totals.blocked} currently blocked` },
    { label: 'Upcoming milestones', value: milestones, detail: 'Next 30 days', title: 'Counts active project due dates' },
  ];
  const options = [...new Map(projects.map(({ status }) => [healthKey(status), status])).entries()]
    .sort((left, right) => left[1].localeCompare(right[1]));
  const query = search.trim().toLowerCase();
  const visible = totals.withProgress.filter(({ project }) => {
    const text = [project.name, project.owner, project.description, project.status].join(' ').toLowerCase();
    return text.includes(query) && text.includes(workspaceSearch) && (!health || health === healthKey(project.status));
  });

  return <>
    <header className="projects-portfolio-header">
      <div><span className="eyebrow">Portfolio</span><h1>Projects</h1><p>Track progress, milestones, and team health in one place.</p></div>
      <button className="button button--primary" type="button" onClick={onCreate}><Icon name="plus" />New project</button>
    </header>
    <dl className="projects-summary" aria-label="Portfolio summary">
      {summary.map(({ label, value, detail, title }) => <div key={label} title={title}>
        <dt>{label}</dt><dd><strong>{value}</strong><small>{detail}</small></dd>
      </div>)}
    </dl>
    <div className="projects-toolbar">
      <label className="projects-search">
        <Icon name="search" /><input aria-label="Search projects" placeholder="Search projects…" type="search"
          value={search} onChange={(event) => setSearch(event.target.value)} />
      </label>
      <div className="projects-toolbar-actions">
        <label className="projects-filter">
          <Icon name="filter" /><select aria-label="Filter by project health" value={health} onChange={(event) => setHealth(event.target.value)}>
            <option value="">All health</option>
            {options.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <div className="projects-view-toggle" role="group" aria-label="Project view">
          <button type="button" className="icon-button" aria-pressed={view === 'grid'} aria-label="Grid view" onClick={() => setView('grid')}><Icon name="grid" /></button>
          <button type="button" className="icon-button" aria-pressed={view === 'list'} aria-label="List view" onClick={() => setView('list')}><Icon name="list" /></button>
        </div>
      </div>
    </div>
    {visible.length ? <div className={`projects-grid projects-portfolio-grid projects-portfolio-grid--${view}`}>
      {visible.map(({ project, totals: stats, tone }) => <PortfolioCard key={project.id} project={project} totals={stats} tone={tone} />)}
    </div> : <section className="panel empty-state">
      <strong>{projects.length ? 'No matching projects' : 'No projects yet'}</strong>
      <p>{projects.length ? 'Try changing the search or health filter.' : 'Create a project to get started.'}</p>
      {projects.length > 0 && (search || health) && <button className="text-button" type="button" onClick={() => {
        setSearch(''); setHealth('');
      }}>Clear filters</button>}
    </section>}
  </>;
}
