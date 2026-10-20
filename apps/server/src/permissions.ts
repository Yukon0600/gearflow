import type { Role } from './auth';

const RANK: Record<Role, number> = { clerk: 1, manager: 2, admin: 3 };

/**
 * 每个接口要求的最低角色。
 * 思考顺序：管理类（账号）> 分析类（报表）> 写业务数据 > 只读。
 */
export function requiredRole(method: string, path: string): Role {
  if (path.startsWith('/api/users')) return 'admin';
  if (path.startsWith('/api/reports')) return 'manager';
  if (method === 'GET' || method === 'HEAD') return 'clerk';
  // 开单、草稿、盘点：店员即可执行
  if (path === '/api/orders' || path.startsWith('/api/drafts') || path === '/api/stocktakes') return 'clerk';
  // 商品资料、往来单位、员工、装机服务：店长级别
  return 'manager';
}

export function canAccess(role: Role, method: string, path: string): boolean {
  return RANK[role] >= RANK[requiredRole(method, path)];
}

/** 给前端用的能力清单，避免两边规则各写一套 */
export function abilities(role: Role) {
  return {
    role,
    canManageUsers: RANK[role] >= RANK.admin,
    canViewReports: RANK[role] >= RANK.manager,
    canEditCatalog: RANK[role] >= RANK.manager,
    canTrade: RANK[role] >= RANK.clerk,
  };
}
