import { useEffect, useRef, useState } from 'react';
import { hasAuth0Configuration } from '../../auth/AuthProvider';
import { NotificationPreview } from '../../features/notifications/NotificationPreview';
import { initials } from '../../features/dashboard/data';
import { Icon, type IconName } from '../../lib/icons';
import { saveTheme, type Theme } from '../../theme';

export type Section = 'Dashboard' | 'Projects' | 'My tasks' | 'Board' | 'Timeline' | 'Team' | 'Users' | 'Organization' | 'Departments' | 'Roles & permissions' | 'Audit logs' | 'Notifications' | 'Import tasks' | 'Import history' | 'My profile' | 'Change password' | 'Logout';

const groups: { title: string; links: { section: Section; label?: string; icon: IconName; adminOnly?: boolean }[] }[] = [
  { title: 'Workspace', links: [
    { section: 'Dashboard', icon: 'grid' }, { section: 'Projects', icon: 'folder' },
    { section: 'Board', label: 'Kanban board', icon: 'board' }, { section: 'Timeline', icon: 'calendar' },
    { section: 'Team', label: 'Team workload', icon: 'users' },
  ] },
  { title: 'Administration', links: [
    { section: 'Users', label: 'User management', icon: 'users' },
    { section: 'Organization', icon: 'organization', adminOnly: true },
    { section: 'Departments', icon: 'departments', adminOnly: true },
    { section: 'Roles & permissions', icon: 'shield', adminOnly: true },
    { section: 'Audit logs', icon: 'audit', adminOnly: true },
  ] },
  { title: 'Productivity', links: [
    { section: 'Import tasks', icon: 'folder' }, { section: 'Import history', icon: 'clock' },
    { section: 'Notifications', icon: 'bell' },
  ] },
  { title: 'Account', links: [
    { section: 'My profile', icon: 'users' }, { section: 'Change password', icon: 'key' }, { section: 'Logout', icon: 'logout' },
  ] },
];

type Props = {
  active: Section;
  projectContext?: boolean;
  workspaceName?: string;
  displayName?: string;
  role?: string;
  canViewAdministration?: boolean;
  userId?: string;
  unreadCount?: number;
  onUnreadCount: (count: number) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onNavigate: (section: Section) => void;
  onCreateTask?: () => void;
  children: import('react').ReactNode;
};

export function AppShell({ active, projectContext, searchValue, onSearchChange, onNavigate, onCreateTask, workspaceName, displayName, role, canViewAdministration, userId, unreadCount, onUnreadCount, children }: Props) {
  const [theme, setTheme] = useState<Theme>(() => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  const nextTheme = theme === 'light' ? 'dark' : 'light';
  const themeLabel = `Switch to ${nextTheme} theme`;
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const accountPage = active === 'My profile' || active === 'Change password' || active === 'Logout';
  const showAccount = Boolean(userId) || hasAuth0Configuration() || accountPage;

  useEffect(() => {
    if (accountPage) navRef.current?.querySelector('[aria-current="page"]')?.closest('.nav-group')
      ?.scrollIntoView({ block: 'nearest' });
  }, [accountPage, active, mobileOpen]);

  const navigate = (section: Section) => {
    onNavigate(section);
    setMobileOpen(false);
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`} aria-label="Main navigation">
        <div className="brand"><span className="brand-mark"><span /></span><span>Flowdeck</span></div>
        <div className="workspace-switch">
          <span className="workspace-avatar">{workspaceName ? initials(workspaceName) : '—'}</span>
          <span className="workspace-copy"><strong>{workspaceName ?? 'Workspace'}</strong><small>Workspace</small></span>
        </div>
        <nav ref={navRef} className="primary-nav" aria-label="Workspace pages">
          {groups.filter(({ title }) => title !== 'Account' || showAccount).map(({ title, links }) => <div className="nav-group" key={title}>
            <p className="nav-label">{title}</p>
            {links.filter(({ adminOnly }) => !adminOnly || canViewAdministration).map(({ section, label, icon }) => (
              <button className={`nav-item ${active === section || (section === 'Projects' && projectContext) ? 'nav-item--active' : ''}`}
                key={section} type="button" onClick={() => navigate(section)} aria-current={active === section ? 'page' : undefined}>
                <Icon name={icon} /><span>{label ?? section}</span>
                {section === 'Notifications' && Boolean(unreadCount) && <span className="nav-count" aria-label={`${unreadCount} unread`}>{unreadCount}</span>}
              </button>
            ))}
          </div>)}
        </nav>
        <div className="sidebar-bottom">
          {displayName && <div className="user-profile"><div className="avatar avatar--me">{initials(displayName)}</div>
            <span><strong>{displayName}</strong>{role && <small className="profile-role">{role}</small>}</span>
          </div>}
        </div>
      </aside>

      {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <div className="main-column">
        <header className="topbar">
          <button type="button" className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Icon name="menu" /></button>
          <label className="global-search"><Icon name="search" /><input aria-label="Search workspace" placeholder="Search tasks and projects" value={searchValue} onChange={(event) => onSearchChange(event.target.value)} /><kbd>/</kbd></label>
          <div className="topbar-actions">
            {onCreateTask && <button className="button button--primary" type="button" onClick={onCreateTask}>
              <Icon name="plus" />Create task
            </button>}
            <button className="icon-button theme-toggle" type="button" aria-label={themeLabel} title={themeLabel}
              onClick={() => {
                saveTheme(nextTheme);
                setTheme(nextTheme);
              }}>
              <Icon name={theme === 'light' ? 'moon' : 'sun'} />
            </button>
            <NotificationPreview key={active} unreadCount={unreadCount} onUnreadCount={onUnreadCount}
              onViewAll={() => navigate('Notifications')} />
            {displayName && userId && <a className="avatar avatar--me topbar-avatar" href="/account/profile" aria-label={`Profile for ${displayName}`}>{initials(displayName)}</a>}
          </div>
        </header>
        <main id="main-content" className="page-content">{children}</main>
      </div>
    </div>
  );
}
