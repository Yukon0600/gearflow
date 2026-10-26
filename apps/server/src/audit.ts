import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export interface AuditInput {
  username: string;
  role: string;
  method: string;
  path: string;
  status: number;
  ip: string;
}

export interface AuditRow {
  id: string;
  at: string;
  username: string;
  role: string;
  method: string;
  path: string;
  action: string;
  target: string;
  status: number;
  ip: string;
}

const RESOURCE_LABEL: Record<string, string> = {
  orders: '单据',
  products: '商品',
  partners: '往来单位',
  drafts: '草稿',
  stocktakes: '盘点',
  employees: '员工',
  services: '装机服务',
  users: '账号',
};

const METHOD_LABEL: Record<string, string> = {
  POST: '新建',
  PATCH: '修改',
  PUT: '修改',
  DELETE: '删除',
};

/** 把接口路径翻译成人能读懂的操作用语 */
function describe(method: string, path: string): string {
  if (path === '/api/orders' && method === 'POST') return '开单';
  if (/^\/api\/drafts\/[^/]+\/post$/.test(path)) return '草稿过账';
  if (/^\/api\/services\/[^/]+\/status$/.test(path)) return '装机服务状态变更';
  const resource = path.split('/')[2] || '';
  const label = RESOURCE_LABEL[resource] || resource || '数据';
  return `${METHOD_LABEL[method] || method}${label}`;
}

function targetOf(path: string): string {
  const parts = path.split('/').filter(Boolean); // ['api','orders','123']
  if (parts.length <= 2) return parts[1] || '';
  const id = parts[2];
  const short = id.length > 12 ? `${id.slice(0, 8)}…` : id;
  return `${parts[1]}/${short}`;
}

export class Audit {
  constructor(private db: DatabaseSync) {
    db.exec(`CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      at TEXT NOT NULL,
      username TEXT NOT NULL,
      role TEXT NOT NULL,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT NOT NULL,
      status INTEGER NOT NULL,
      ip TEXT NOT NULL
    );`);
  }

  record(input: AuditInput) {
    this.db.prepare('INSERT INTO audit_log VALUES(?,?,?,?,?,?,?,?,?,?)').run(
      randomUUID(),
      new Date().toISOString(),
      input.username,
      input.role,
      input.method,
      input.path,
      describe(input.method, input.path),
      targetOf(input.path),
      input.status,
      input.ip,
    );
  }

  list(limit = 100, username = ''): { total: number; items: AuditRow[] } {
    const size = Math.min(Math.max(Number(limit) || 100, 1), 500);
    const total = Number((this.db.prepare('SELECT count(*) AS n FROM audit_log').get() as any).n);
    const rows = username
      ? this.db.prepare('SELECT * FROM audit_log WHERE username=? ORDER BY at DESC, rowid DESC LIMIT ?').all(username, size)
      : this.db.prepare('SELECT * FROM audit_log ORDER BY at DESC, rowid DESC LIMIT ?').all(size);
    return { total, items: rows as unknown as AuditRow[] };
  }
}
