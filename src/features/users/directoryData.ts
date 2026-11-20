import { initials } from '../dashboard/data';

export const userPath = '/administration/users';
export const userStatuses = {
  active: 'Active',
  inactive: 'Inactive',
  pending_invitation: 'Pending Invitation',
} as const;

export type UserStatus = keyof typeof userStatuses;
export type WorkspaceUser = {
  id: string; name: string; email: string; employeeId: string; roleKey: string; roleLabel: string; status: UserStatus;
  departmentId: string | null; department: string | null; jobTitle: string | null; managerId: string | null;
  manager: string | null; canEditProfile: boolean; canManageAccess: boolean;
};
export type Directory = {
  items: WorkspaceUser[]; total: number; page: number; pageSize: number; departments: { id: string; name: string }[];
  summary: Record<UserStatus | 'departments', number>;
};
export type UserDetail = {
  user: WorkspaceUser;
  workload: { capacityMinutes: number; assignedMinutes: number; assigned: number; completed: number; blocked: number };
  projects: { id: string; name: string; tasks: number; role: string }[];
};

export function userAvatar(user: WorkspaceUser) {
  const variant = Number.parseInt(user.id.slice(0, 2), 16) % 7;
  return { text: initials(user.name), className: `operations-avatar operations-avatar--${variant}` };
}
