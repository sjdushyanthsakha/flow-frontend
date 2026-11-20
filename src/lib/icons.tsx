import type { ReactNode, SVGProps } from 'react';

export type IconName =
  | 'grid' | 'folder' | 'check' | 'board' | 'calendar' | 'users'
  | 'search' | 'zoom-in' | 'zoom-out' | 'bell' | 'plus' | 'arrow' | 'dots' | 'clock'
  | 'organization' | 'departments' | 'shield' | 'audit'
  | 'key' | 'lock' | 'logout' | 'moon' | 'sun'
  | 'list' | 'eye' | 'edit' | 'mail' | 'user-plus' | 'upload' | 'download' | 'sheet' | 'copy' | 'history'
  | 'trash' | 'attachment' | 'comment' | 'link' | 'tag'
  | 'timer' | 'completed' | 'alert'
  | 'chevron' | 'spark' | 'filter' | 'close' | 'menu';

const paths: Record<IconName, ReactNode> = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  folder: <><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H10l2 2h7.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/><path d="M3 9h18"/></>,
  check: <><path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 .8.8L6 5M3.5 12l.8.8L6 11M3.5 18l.8.8L6 17"/></>,
  board: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></>,
  'zoom-in': <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5M7.8 10.8h6m-3-3v6"/></>,
  'zoom-out': <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5M7.8 10.8h6"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  arrow: <><path d="M7 17 17 7M7 7h10v10"/></>,
  dots: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  organization: <><rect x="9" y="3" width="6" height="5" rx="1"/><rect x="3" y="16" width="5" height="5" rx="1"/><rect x="9.5" y="16" width="5" height="5" rx="1"/><rect x="16" y="16" width="5" height="5" rx="1"/><path d="M12 8v8m-6.5 0v-4h13v4"/></>,
  departments: <><path d="M8 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M8 9H5a2 2 0 0 0-2 2v10h18M12 7h3m-3 4h3m-3 4h3m-3 6v-2h3v2"/></>,
  shield: <><path d="M12 22s7-4 7-10V5l-7-3-7 3v7c0 6 7 10 7 10z"/><path d="m9 12 2 2 4-4"/></>,
  audit: <><path d="M7 2h11a2 2 0 0 1 2 2v13H10M7 2a2 2 0 0 0-2 2v4h4V4a2 2 0 0 0-2-2Zm2 6v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2H11v2a2 2 0 0 1-2 2m4-15h3m-3 4h3m-3 4h3"/></>,
  moon: <path d="M20.9 13.8A9 9 0 0 1 10.2 3.1 9 9 0 1 0 20.9 13.8Z"/>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4m0-14.2-1.4 1.4M6.3 17.7l-1.4 1.4"/></>,
  key: <path d="M15.5 3a5.5 5.5 0 0 0-5.2 7.3L3 17.6V21h3.4l2-2v-2h2l2.8-2.8A5.5 5.5 0 1 0 15.5 3Zm2 4.5h.01"/>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/></>,
  logout: <path d="M10 17v4H4V3h6v4m-2 5h13m-4-4 4 4-4 4"/>,
  list: <><path d="M8 6h12M8 12h12M8 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01" strokeWidth="3"/></>,
  eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/></>,
  edit: <><path d="m4 20 1-4L16 5l3 3L8 19l-4 1ZM14 7l3 3M16 5l1.5-1.5a1 1 0 0 1 1.4 0l1.6 1.6a1 1 0 0 1 0 1.4L19 8"/></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></>,
  'user-plus': <><circle cx="9" cy="7" r="3"/><path d="M2 20v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2m3-12v6m-3-3h6"/></>,
  upload: <><path d="M7 17a5 5 0 1 1 1.5-9.8A6 6 0 0 1 20 9a4 4 0 0 1 0 8h-1M12 22V11m-4 4 4-4 4 4"/></>,
  download: <path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>,
  sheet: <><path d="M6 3h8l4 4v14H6zM14 3v5h4M9 11h6M9 14h6M9 17h6M12 11v6"/></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></>,
  history: <path d="M3 11a9 9 0 1 1 2.6 7.3M3 6v5h5m4-4v5l3 2"/>,
  trash: <><path d="M3 6h18M9 6V3h6v3m4 0-1 15H6L5 6m5 4v7m4-7v7"/></>,
  attachment: <path d="m20 11-8.5 8.5a5 5 0 0 1-7-7L14 3a3.5 3.5 0 0 1 5 5l-9.5 9.5a2 2 0 0 1-3-3L15 6"/>,
  comment: <path d="M21 11.5a7.5 7.5 0 0 1-7.5 7.5H4l1.7-3.4A7.5 7.5 0 1 1 21 11.5Z"/>,
  link: <><path d="M10 7l2-2a4 4 0 0 1 6 6l-2 2M14 17l-2 2a4 4 0 0 1-6-6l2-2m1.5 3.5 5-5"/></>,
  tag: <><path d="M3 3h8l10 10-8 8L3 11z"/><circle cx="7.5" cy="7.5" r="1"/></>,
  timer: <><circle cx="12" cy="13" r="7"/><path d="M10 3h4M12 13l3-3"/></>,
  completed: <><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></>,
  alert: <><path d="M10.5 4.7 3.4 17a1.6 1.6 0 0 0 1.4 2.4h14.4a1.6 1.6 0 0 0 1.4-2.4L13.5 4.7a1.7 1.7 0 0 0-3 0Z"/><path d="M12 9v4m0 3h.01"/></>,
  chevron: <path d="m7 10 5 5 5-5"/>,
  spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/></>,
  filter: <><path d="M4 6h16M7 12h10m-7 6h4"/></>,
  close: <><path d="m6 6 12 12M18 6 6 18"/></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
};

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
