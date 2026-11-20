import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { projectPath } from './projectRoutes';
import { Icon, type IconName } from '../../lib/icons';
import { dateKey, dateLabel, isDone, type Dashboard, type Task } from './data';
import { useDashboardRequest } from '../../auth/DashboardSession';

type Day = { date: string; count: number };
type Overview = { days: Day[]; previousCompletions: number; personalMinutes: number; workspaceMinutes: number };

const dayLabel = new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'UTC' });
const weekday = (date: string) => dayLabel.format(new Date(date + 'T00:00:00Z'));
const plot = { left: 32, right: 12, top: 12, bottom: 28 };
const hours = (minutes: number) => `${new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(minutes / 60)}h`;

function MomentumChart({ days }: { days: Day[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const id = useId();
  const [activeIndex, setActiveIndex] = useState<number>();
  const intervalCount = Math.max(1, days.length - 1);
  const step = Math.max(1, Math.ceil(Math.max(0, ...days.map(({ count }) => count)) / 4));
  const ceiling = step * 4;
  const activeDay = activeIndex === undefined ? undefined : days[activeIndex];

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !days.length) return;
    function draw() {
      if (!canvas) return;
      const context = canvas.getContext('2d');
      if (!context) return;
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      const scale = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      context.scale(scale, scale);
      const { left, right, top, bottom } = plot;
      const baseline = height - bottom;
      const plotWidth = width - left - right;
      const palette = getComputedStyle(canvas);
      context.font = '11px "DM Sans", sans-serif';
      context.fillStyle = palette.getPropertyValue('--chart-label').trim();
      context.strokeStyle = palette.getPropertyValue('--chart-grid').trim();
      for (let tick = 0; tick <= ceiling; tick += step) {
        const y = baseline - (baseline - top) * tick / ceiling;
        context.textAlign = 'right';
        context.fillText(String(tick), left - 8, y + 4);
        context.beginPath();
        context.setLineDash([3, 3]);
        context.moveTo(left, y);
        context.lineTo(left + plotWidth, y);
        context.stroke();
      }
      context.setLineDash([]);
      const points = days.map(({ date, count }, index) => ({
        x: left + plotWidth * index / intervalCount,
        y: baseline - (baseline - top) * count / ceiling,
        label: weekday(date),
      }));
      context.textAlign = 'center';
      for (const point of points) context.fillText(point.label, point.x, height - 9);
      const line = new Path2D();
      line.moveTo(points[0].x, points[0].y);
      for (let index = 1; index < points.length; index++) {
        const previous = points[index - 1];
        const next = points[index];
        const midpoint = (previous.x + next.x) / 2;
        line.bezierCurveTo(midpoint, previous.y, midpoint, next.y, next.x, next.y);
      }
      const area = new Path2D(line);
      area.lineTo(points[points.length - 1].x, baseline);
      area.lineTo(points[0].x, baseline);
      area.closePath();
      const gradient = context.createLinearGradient(0, top, 0, baseline);
      gradient.addColorStop(0, palette.getPropertyValue('--chart-fill').trim());
      gradient.addColorStop(1, palette.getPropertyValue('--chart-fill-end').trim());
      context.fillStyle = gradient;
      context.fill(area);
      context.strokeStyle = palette.getPropertyValue('--chart-line').trim();
      context.lineWidth = 2.5;
      context.stroke(line);
    }
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    const themeObserver = new MutationObserver(draw);
    themeObserver.observe(document.documentElement, { attributeFilter: ['data-theme'] });
    draw();
    return () => {
      observer.disconnect();
      themeObserver.disconnect();
    };
  }, [days, ceiling, step, intervalCount]);

  function selectByPointer(event: PointerEvent<HTMLCanvasElement>) {
    if (!days.length) return;
    const { left, width } = event.currentTarget.getBoundingClientRect();
    const plotWidth = width - plot.left - plot.right;
    if (plotWidth <= 0) return;
    const fraction = (event.clientX - left - plot.left) / plotWidth;
    const index = Math.round(fraction * intervalCount);
    setActiveIndex(Math.max(0, Math.min(days.length - 1, index)));
  }

  function selectByKey(event: KeyboardEvent<HTMLCanvasElement>) {
    if (event.key === 'Escape') {
      setActiveIndex(undefined);
      return;
    }
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || !days.length) return;
    event.preventDefault();
    if (event.key === 'Home' || event.key === 'End') {
      setActiveIndex(event.key === 'Home' ? 0 : days.length - 1);
      return;
    }
    const direction = event.key === 'ArrowLeft' ? -1 : 1;
    setActiveIndex(current => current === undefined ? 0 : Math.max(0, Math.min(days.length - 1, current + direction)));
  }

  const x = (activeIndex ?? 0) / intervalCount * 100;
  const y = activeDay ? (1 - activeDay.count / ceiling) * 100 : 0;
  return <div className="momentum-chart-frame">
    <canvas className="momentum-chart" ref={ref} role="img" aria-labelledby={id} aria-describedby={`${id}-help`}
      tabIndex={days.length ? 0 : undefined} onPointerMove={selectByPointer} onPointerDown={selectByPointer}
      onPointerLeave={(event) => { if (event.pointerType !== 'touch') setActiveIndex(undefined); }}
      onPointerCancel={() => setActiveIndex(undefined)} onKeyDown={selectByKey}
      onFocus={() => setActiveIndex(current => current ?? 0)} onBlur={() => setActiveIndex(undefined)} />
    {activeDay && <div className="momentum-hover" aria-hidden="true" style={plot}>
      <span className="momentum-hover-guide" style={{ left: `${x}%` }} />
      <span className="momentum-hover-point" style={{ left: `${x}%`, top: `${y}%` }} />
      <div className={`momentum-tooltip${x > 50 ? ' momentum-tooltip--before' : ''}`}
        style={{ left: `${x}%`, top: `clamp(0px, calc(${y}% + 5px), calc(100% - 74px))` }}>
        <strong>{weekday(activeDay.date)}</strong>
        <span>completed : {activeDay.count}</span>
      </div>
    </div>}
    <p className="sr-only" id={id}>{days.map(({ date, count }) => `${weekday(date)}: ${count} completed`).join(', ')}</p>
    <p className="sr-only" id={`${id}-help`}>Use the left and right arrow keys to explore daily counts.</p>
    <span className="sr-only" role="status">{activeDay && `${weekday(activeDay.date)}, ${activeDay.count} completed`}</span>
  </div>;
}

type Props = {
  dashboard: Dashboard;
  matchingTasks: Task[];
  revision: number;
  onOpenTask: (task: Task) => void;
};

export function DashboardSummary({ dashboard, matchingTasks, revision, onOpenTask }: Props) {
  const dashboardRequest = useDashboardRequest();
  const [overview, setOverview] = useState<Overview>();
  const [metricsError, setMetricsError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const { tasks, projects, userId, role, timezone } = dashboard;
  useEffect(() => {
    const controller = new AbortController();
    dashboardRequest<Overview>('/overview', { signal: controller.signal }).then((result) => {
      if (!controller.signal.aborted) {
        setOverview(result);
        setMetricsError(false);
      }
    }).catch(() => {
      if (!controller.signal.aborted) setMetricsError(true);
    });
    return () => controller.abort();
  }, [tasks, revision, attempt]);

  const today = dateKey(new Date(), timezone);
  const assigned = tasks.filter((task) => task.assigneeId === userId);
  const open = assigned.filter((task) => !isDone(task));
  const overdue = (task: Task) => !isDone(task) && Boolean(task.dueDate && task.dueDate < today);
  const priorities = matchingTasks.filter((task) => task.assigneeId === userId && !isDone(task))
    .sort((left, right) => (left.dueDate ?? '9999-99-99').localeCompare(right.dueDate ?? '9999-99-99'));
  const activeProjects = new Set(open.map((task) => task.projectId)).size;
  const completedThisWeek = overview?.days.reduce((sum, { count }) => sum + count, 0) ?? 0;
  const percentChange = overview?.previousCompletions
    ? Math.round((completedThisWeek - overview.previousCompletions) / overview.previousCompletions * 100) : undefined;
  const stats: { label: string; value: number | string; description: string; icon: IconName; color: string }[] = [
    { label: 'Assigned tasks', value: assigned.length, description: `Across ${activeProjects} active ${activeProjects === 1 ? 'project' : 'projects'}`, icon: 'check', color: 'purple' },
    { label: 'In progress', value: open.filter(({ status }) => status.toLowerCase() === 'in progress').length, description: 'Assigned to you', icon: 'timer', color: 'blue' },
    { label: 'Completed', value: assigned.length - open.length, description: 'Assigned to you', icon: 'completed', color: 'green' },
    { label: 'Overdue', value: open.filter(overdue).length, description: 'Action required today', icon: 'alert', color: 'rose' },
    { label: 'Hours logged', value: overview ? hours(overview.personalMinutes) : '—', description: 'This week', icon: 'clock', color: 'teal' },
  ];

  return <>
    <section className="summary-stats" aria-label="Your task summary">
      {stats.map(({ label, value, description, icon, color }) => (
        <article className="summary-stat" key={label}>
          <span className={`stat-icon stat-icon--${color}`}><Icon name={icon} /></span>
          <div><h2>{label}</h2><strong>{value}</strong><small>{description}</small></div>
        </article>
      ))}
    </section>
    <section className="summary-role panel" aria-label="Workspace overview">
      <div><Icon name="spark" /><strong>{role} view</strong></div>
      <ul>
        <li><strong>{projects.filter(({ status }) => status.toLowerCase() === 'at risk').length}</strong> at-risk projects</li>
        <li><strong>{tasks.filter(overdue).length}</strong> overdue tasks</li>
        {overview && <li><strong>{hours(overview.workspaceMinutes)}</strong> tracked this week</li>}
      </ul>
    </section>
    <div className="summary-grid">
      <section className="panel momentum-panel" aria-label="Weekly momentum">
        <div className="panel-heading"><div><span className="eyebrow">Productivity</span><h2>Weekly momentum</h2></div>
          <span className="chart-legend">Completed tasks</span>
        </div>
        {overview ? <MomentumChart days={overview.days} /> : (
          <div className="momentum-placeholder" role={metricsError ? 'alert' : 'status'}>
            {metricsError ? <>Could not load weekly momentum. <button className="text-button" type="button"
              onClick={() => { setMetricsError(false); setAttempt((value) => value + 1); }}>Retry</button></> : 'Loading weekly momentum…'}
          </div>
        )}
        {overview && <div className="momentum-footer">
          <span><strong>{completedThisWeek}</strong> tasks completed</span>
          <span><strong>{hours(overview.workspaceMinutes)}</strong> tracked</span>
          {percentChange !== undefined && <span className={`momentum-trend ${percentChange < 0 ? 'momentum-trend--down' : ''}`}>
            {percentChange > 0 ? '+' : ''}{percentChange}% vs last week
          </span>}
        </div>}
      </section>
      <section className="panel focus-panel" aria-label="Your priorities">
        <div className="panel-heading">
          <div><span className="eyebrow">Your priorities</span><h2>Focus today</h2></div>
          <span className="section-count">{priorities.length}</span>
        </div>
        {priorities.length ? <ul className="focus-list">
          {priorities.slice(0, 4).map((task) => <li key={task.id}>
            <button type="button" className="focus-row-button" aria-haspopup="dialog" onClick={() => onOpenTask(task)}>
              <span><strong>{task.title}</strong><small>{task.project}</small></span>
              {task.dueDate && <time dateTime={task.dueDate} className={overdue(task) ? 'focus-overdue' : undefined}>{dateLabel(task.dueDate)}</time>}
            </button>
          </li>)}
        </ul> : <p className="focus-empty">No open tasks match.</p>}
        <a className="text-button focus-board-link" href={priorities.length ? projectPath(priorities[0].projectId, 'board') : '/board'}>
          View assigned work <Icon name="arrow" />
        </a>
      </section>
    </div>
  </>;
}
