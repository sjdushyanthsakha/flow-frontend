import { lazy, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type { Section } from '../../components/layout/AppShell';
import { Icon } from '../../lib/icons';
import { DashboardRequestError, dateLabel, initials, isDone, type Dashboard, type Member, type Project, type Task } from './data';
import { useDashboardRequest } from '../../auth/DashboardSession';

import { CreateTaskModal } from './CreateTaskModal';
import type { BoardMove, BoardUpdate } from './TaskBoard';
import { DashboardSummary } from './DashboardSummary';
import { projectPath, type ProjectView } from './projectRoutes';
import { WorkspacePanels } from './WorkspacePanels';
import { TeamWorkload } from './TeamWorkload';
import { WorkspaceEditor, type Editor } from './WorkspaceEditor';

const ProjectsPortfolio = lazy(() => import('./ProjectsPortfolio'));
const TaskDetailsDrawer = lazy(() => import('./TaskDetailsDrawer'));
const ProjectOverview = lazy(() => import('./ProjectOverview'));
const TaskTimeline = lazy(() => import('./TaskTimeline'));
const TaskBoard = lazy(() => import('./TaskBoard').then((module) => ({ default: module.TaskBoard })));

type Props = {
  selectedProject?: { id: string; view: ProjectView };
  search: string;
  view: Section;
  onNavigate: (view: Section) => void;
  dashboard: Dashboard;
  setDashboard: Dispatch<SetStateAction<Dashboard | undefined>>;
  editor?: Editor;
  setEditor: (editor: Editor | undefined) => void;
};

function AvatarStack({ members }: { members: string[] }) {
  return <div className="avatar-stack" aria-label={`${members.length} project members`}>{members.slice(0, 4).map((person, index) => <span className={`avatar avatar--${['coral', 'violet', 'green', 'blue'][index % 4]}`} key={`${person}-${index}`} title={person}>{person}</span>)}{members.length > 4 && <span className="avatar avatar--extra">+{members.length - 4}</span>}</div>;
}

function ProjectCard({ project, tasks }: { project: Project; tasks: Task[] }) {
  const completed = tasks.filter(isDone).length;
  const progress = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  const status = <span className={`status-pill status-pill--${project.status.toLowerCase().replaceAll(' ', '-')}`}><i />{project.status}</span>;
  return (
    <a className="project-card portfolio-card" href={projectPath(project.id)} aria-label={project.name}>
      <div className="project-card-top"><span className="project-icon">{initials(project.name).slice(0, 1)}</span>{status}</div>
      <h3>{project.name}</h3>
      <p>{tasks.length - completed} open tasks{project.dueDate ? ` · Due ${dateLabel(project.dueDate)}` : ''}</p>
      <div className="portfolio-progress">
        <div className="progress-track" role="progressbar" aria-label={`${project.name} progress`} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div>
        <strong>{progress}%</strong>
      </div>
      <div className="project-card-footer"><AvatarStack members={project.members.map(initials)} /><span>{project.members.length} {project.members.length === 1 ? 'member' : 'members'}</span></div>
    </a>
  );
}

function TaskRow({ task, pending, onToggle, onEdit }: { task: Task; pending: boolean; onToggle: (task: Task) => void; onEdit: () => void }) {
  const done = isDone(task);
  const priority = task.priority ?? 'None';
  return (
    <div className={`task-row ${done ? 'task-row--done' : ''}`}>
      <button type="button" className={`task-check ${done ? 'task-check--checked' : ''}`} aria-label={`${done ? 'Mark incomplete' : 'Complete'} ${task.title}`} disabled={pending} aria-pressed={done} onClick={() => onToggle(task)}>{done && <span>✓</span>}</button>
      <div className="task-copy"><button type="button" className="task-title-button" onClick={onEdit}><strong>{task.title}</strong></button><span>{task.project}</span></div>
      <span className={`priority priority--${priority.toLowerCase()}`}>{priority}</span>
      <span className="task-due"><Icon name="clock" />{dateLabel(task.dueDate)}</span>
      <span className="avatar avatar--violet task-assignee" title={task.assignee ?? 'Unassigned'}>{task.assignee ? initials(task.assignee) : '—'}</span>
    </div>
  );
}

export default function DashboardPage({ selectedProject, search, view, onNavigate, dashboard, setDashboard, editor, setEditor }: Props) {
  const dashboardRequest = useDashboardRequest();
  const [error, setError] = useState('');
  const [drawer, setDrawer] = useState<{ id: string; variant?: 'board' | 'timeline' }>();
  const [activityRevision, setActivityRevision] = useState(0);
  const [timeRevision, setTimeRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [taskFilter, setTaskFilter] = useState<'All tasks' | 'My tasks'>('My tasks');
  const showDashboard = view === 'Dashboard';
  const showPortfolio = view === 'Projects' && !selectedProject;
  const showTasks = view === 'My tasks';

  const { projects, tasks, members, userId, displayName, timezone, activeSprint } = dashboard;
  const drawerTask = tasks.find(({ id }) => id === drawer?.id);
  const scopedProject = selectedProject && projects.find(({ id }) => id === selectedProject.id);
  const projectTasks = useMemo(() => scopedProject ? tasks.filter(({ projectId }) => projectId === scopedProject.id) : [], [scopedProject, tasks]);
  const currentView = selectedProject?.view ?? (view === 'Board' ? 'board' : view === 'Timeline' ? 'timeline' : undefined);
  const query = search.trim().toLowerCase();
  const visibleProjects = projects.filter((project) => `${project.name} ${project.description ?? ''}`.toLowerCase().includes(query));
  const matchingTasks = tasks.filter((task) => `${task.title} ${task.description ?? ''} ${task.project} ${task.status} ${task.assignee ?? ''}`.toLowerCase().includes(query));
  const visibleTasks = matchingTasks.filter((task) =>
    (taskFilter === 'All tasks' || task.assigneeId === userId));
  const toggleTask = async (task: Task) => {
    setSaving(true);
    setError('');
    const done = !isDone(task);
    try {
      const update = await dashboardRequest<Pick<Task, 'status' | 'updatedAt'>>(`/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ done }) });
      setDashboard((current) => current && {
        ...current,
        tasks: current.tasks.map((item) => item.id === task.id ? { ...item, ...update } : item),
      });
    } catch {
      setError('Could not update the task.');
    } finally {
      setSaving(false);
    }
  };
  const moveTask = async (task: Task, move: BoardMove) => {
    setSaving(true);
    setError('');
    try {
      const changed = await dashboardRequest<BoardUpdate[]>(`/tasks/${task.id}/board-position`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...move, expectedStatus: task.status, expectedPosition: task.boardPosition,
        }),
      });
      const byId = new Map(changed.map((item) => [item.id, item]));
      setDashboard((current) => current && {
        ...current, tasks: current.tasks.map((item) => ({ ...item, ...byId.get(item.id) })),
      });
    } catch (failure) {
      if (failure instanceof DashboardRequestError && failure.status === 409) {
        try {
          setDashboard(await dashboardRequest<Dashboard>());
        } catch {
          setError('The board changed and could not be refreshed. Reload the page before trying again.');
          return;
        }
      }
      setError(failure instanceof Error ? failure.message : 'Could not move the task.');
    } finally {
      setSaving(false);
    }
  };
  const editTask = (task: Task) => setEditor({ kind: 'tasks', item: task });
  const openTaskDetails = (task: Task) => setDrawer({ id: task.id });
  const saveRecord = async (values: Record<string, string>) => {
    if (!editor) return;
    const item = editor.kind === 'members' ? undefined : editor.item;
    const path = `/${editor.kind}${item ? `/${item.id}` : ''}`;
    const options = { method: item ? 'PATCH' : 'POST', body: JSON.stringify(values) };

    if (editor.kind === 'projects') {
      const project = await dashboardRequest<Project>(path, options);
      setDashboard((current) => current && {
        ...current,
        projects: item ? current.projects.map((row) => row.id === project.id ? project : row) : [project, ...current.projects],
        tasks: current.tasks.map((task) => task.projectId === project.id ? { ...task, project: project.name } : task),
      });
    } else if (editor.kind === 'tasks') {
      const task = await dashboardRequest<Task>(path, options);
      setDashboard((current) => current && {
        ...current,
        tasks: item || current.tasks.some(({ id }) => id === task.id)
          ? current.tasks.map((row) => row.id === task.id ? task : row) : [...current.tasks, task],
      });
    } else {
      const member = await dashboardRequest<Member>(path, options);
      setDashboard((current) => current && {
        ...current,
        members: [...current.members, member].sort((first, second) => first.name.localeCompare(second.name)),
      });
    }
  };
  const deleteRecord = async () => {
    if (!editor || editor.kind === 'members' || !editor.item) return;
    const id = editor.item.id;
    await dashboardRequest(`/${editor.kind}/${id}`, { method: 'DELETE' });
    setDashboard((current) => current && {
      ...current,
      projects: editor.kind === 'projects' ? current.projects.filter((item) => item.id !== id) : current.projects,
      tasks: editor.kind === 'tasks' ? current.tasks.filter((item) => item.id !== id) : current.tasks,
    });
  };
  const now = new Date();
  const todayLabel = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long', month: 'long', day: 'numeric' }).format(now);
  const hour = Number(new Intl.DateTimeFormat('en', { timeZone: timezone, hour: 'numeric', hourCycle: 'h23' }).format(now));
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  if (selectedProject && !scopedProject) return <section className="empty-state">
    <h1>Project not found</h1>
    <a className="text-button" href="/projects">Back to projects</a>
  </section>;

  return (
    <div className={showDashboard ? 'dashboard-page dashboard-overview' :
      currentView === 'board' ? 'dashboard-page board-page' : currentView === 'timeline' ? 'dashboard-page timeline-page' : showPortfolio ? 'dashboard-page projects-page' : 'dashboard-page'}>
      {!scopedProject && currentView !== 'board' && currentView !== 'timeline' && !showPortfolio && view !== 'Team' && <div className="welcome-row">
        <div>{showDashboard ? <><div className="date-kicker">{todayLabel}</div><h1>{greeting}, {displayName.trim().split(/\s+/)[0]}</h1><p>Here’s what needs your attention across the workspace.</p></> : <h1>{view}</h1>}</div>
        {showDashboard && activeSprint && (
          <div className="sprint-card">
            <Icon name="spark" />
            <div>
              <strong>{activeSprint.name}</strong>
              <span>{activeSprint.daysRemaining === 0 ? 'Ends today' :
                `${activeSprint.daysRemaining} ${activeSprint.daysRemaining === 1 ? 'day' : 'days'} remaining`}</span>
            </div>
          </div>
        )}
      </div>}

      {error && <p role="alert">{error}</p>}
      {showDashboard && <DashboardSummary dashboard={dashboard} matchingTasks={matchingTasks}
        revision={timeRevision} onOpenTask={openTaskDetails} />}

      {showPortfolio && <ProjectsPortfolio projects={projects} tasks={tasks} workspaceSearch={query}
        timezone={timezone} onCreate={() => setEditor({ kind: 'projects' })} />}

      {showDashboard && <section className="section-block projects-block" aria-label="Projects">
        <div className="section-heading">
          <div><span className="eyebrow">Portfolio</span><h2>Active projects</h2></div>
          <button className="text-button" type="button" onClick={() => onNavigate('Projects')}>View all <Icon name="arrow" /></button>
        </div>
        {visibleProjects.length ? <div className="projects-grid">
          {visibleProjects.slice(0, 3).map((project) => <ProjectCard key={project.id} project={project} tasks={tasks.filter((task) => task.projectId === project.id)} />)}
        </div> : <div className="empty-state"><span className="empty-icon"><Icon name="search" /></span><strong>No projects found</strong>
          <p>{query ? 'Try a different search term.' : 'Create a project to get started.'}</p>
        </div>}
      </section>}

      {showTasks && <div>
        <section className="panel tasks-panel">
          <div className="panel-heading"><div><div className="section-title-line"><h2>{taskFilter === 'All tasks' ? 'All tasks' : 'Assigned to me'}</h2><span className="section-count section-count--soft">{visibleTasks.filter((task) => !isDone(task)).length}</span></div><p>Your focus for today</p></div><label className="select-wrap"><span className="sr-only">Task filter</span><select value={taskFilter} onChange={(event) => setTaskFilter(event.target.value as 'All tasks' | 'My tasks')}><option>My tasks</option><option>All tasks</option></select><Icon name="chevron" /></label></div>
          <div className="task-list">{visibleTasks.length ? visibleTasks.map((task) => <TaskRow key={task.id} task={task} pending={saving} onToggle={toggleTask} onEdit={() => editTask(task)} />) : <div className="empty-state empty-state--compact"><strong>No tasks match</strong><p>Try clearing your search or changing the filter.</p></div>}</div>
        </section>

      </div>}
      {showDashboard && <WorkspacePanels tasks={tasks} timezone={timezone} revision={activityRevision} onOpenTask={openTaskDetails} />}
      {scopedProject && currentView === 'overview' && (
        <ProjectOverview key={scopedProject.id} project={scopedProject} tasks={projectTasks} timezone={timezone}
          revision={timeRevision + activityRevision} onEditProject={() => setEditor({ kind: 'projects', item: scopedProject })}
          onEditTask={editTask} onOpenActivityTask={openTaskDetails} />
      )}
      {currentView === 'board' && <TaskBoard key={scopedProject?.id ?? 'workspace'} tasks={tasks}
        project={scopedProject} members={members} timeZone={timezone} workspaceSearch={query} revision={activityRevision}
        saving={saving} onMove={moveTask} onEdit={editTask} onOpen={(task) => setDrawer({ id: task.id, variant: 'board' })}
        onCreate={(status) => setEditor({ kind: 'tasks', projectId: scopedProject?.id, status })} />}
      {currentView === 'timeline' && <TaskTimeline key={scopedProject?.id ?? 'workspace'}
        project={scopedProject} projects={scopedProject ? [scopedProject] : visibleProjects}
        tasks={scopedProject ? projectTasks : tasks} members={members} timezone={timezone} workspaceSearch={query}
        onOpenTask={(task) => setDrawer({ id: task.id, variant: 'timeline' })} onEditProject={(project) => setEditor({ kind: 'projects', item: project })} />}
      {view === 'Team' && <TeamWorkload search={query} members={members} projects={projects} canEditCapacity={dashboard.canViewAdministration} sprint={Boolean(activeSprint)} onAddMember={() => setEditor({ kind: 'members' })} />}
      {drawerTask && <TaskDetailsDrawer key={drawerTask.id} task={drawerTask} dashboard={dashboard} variant={drawer?.variant}
        onClose={() => setDrawer(undefined)}
        onUpdate={(updated) => setDashboard((current) => current && {
          ...current, tasks: current.tasks.map((task) => task.id === updated.id ? { ...task, ...updated } : task),
        })}
        onDelete={(id) => {
          setDashboard((current) => current && { ...current, tasks: current.tasks.filter((task) => task.id !== id) });
          setDrawer(undefined);
        }}
        onTaskListChange={async () => setDashboard(await dashboardRequest<Dashboard>())}
        onActivityChange={() => setActivityRevision((value) => value + 1)}
        onTimeLogged={() => setTimeRevision((value) => value + 1)} />}
      {editor?.kind === 'tasks' && !editor.item ? <CreateTaskModal dashboard={dashboard}
        projectId={editor.projectId} status={editor.status} onClose={() => setEditor(undefined)} onCreate={saveRecord} /> :
        editor && <WorkspaceEditor editor={editor} dashboard={dashboard} onClose={() => setEditor(undefined)} onSave={saveRecord} onDelete={deleteRecord} onTimeLogged={() => setTimeRevision((value) => value + 1)} onActivityChange={() => setActivityRevision((value) => value + 1)} />}
    </div>
  );
}
