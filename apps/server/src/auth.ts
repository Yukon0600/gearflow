import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export type Role = 'admin' | 'manager' | 'clerk';
export const ROLES: Role[] = ['admin', 'manager', 'clerk'];
export const ROLE_LABEL: Record<Role, string> = {
  admin: '管理员',
  manager: '店长',
  clerk: '店员',
};

export interface Account {
  username: string;
  role: Role;
  createdAt: string;
}

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/;

function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString('hex');
}

export class Auth {
  constructor(private db: DatabaseSync) {
    db.exec(`CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, salt TEXT NOT NULL, passwordHash TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (tokenHash TEXT PRIMARY KEY, username TEXT NOT NULL REFERENCES users(username), expires INTEGER NOT NULL);`);

    // 老库升级：补角色与创建时间，默认按管理员处理，避免把人锁在外面
    const columns = (db.prepare('PRAGMA table_info(users)').all() as any[]).map((c) => String(c.name));
    if (!columns.includes('role')) db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'");
    if (!columns.includes('createdAt')) {
      db.exec("ALTER TABLE users ADD COLUMN createdAt TEXT NOT NULL DEFAULT ''");
      db.prepare("UPDATE users SET createdAt=? WHERE createdAt=''").run(new Date().toISOString());
    }

    if (!db.prepare('SELECT username FROM users LIMIT 1').get()) {
      const salt = randomBytes(16).toString('hex');
      const password = process.env.GEARFLOW_ADMIN_PASSWORD || 'GearFlow@2026';
      db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(
        'admin', salt, hashPassword(password, salt), 'admin', new Date().toISOString(),
      );
    }
  }

  login(username: unknown, password: unknown) {
    if (typeof username !== 'string' || typeof password !== 'string' || password.length > 256 || username.length > 100) return null;
    const user = this.db.prepare('SELECT * FROM users WHERE username=?').get(username);
    const hash = scryptSync(password, String(user?.salt || 'invalid-user-salt'), 64);
    if (!user || !timingSafeEqual(hash, Buffer.from(String(user.passwordHash), 'hex'))) return null;
    const token = randomBytes(32).toString('hex');
    const expires = Date.now() + 8 * 60 * 60 * 1000;
    this.db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now());
    this.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(this.hash(token), username, expires);
    return token;
  }

  private hash(token: string) { return createHash('sha256').update(token).digest('hex'); }

  user(token: string): { username: string; role: Role } | null {
    const session = this.db.prepare('SELECT username FROM sessions WHERE tokenHash=? AND expires>?').get(this.hash(token), Date.now());
    if (!session) return null;
    const row = this.db.prepare('SELECT username, role FROM users WHERE username=?').get(String(session.username)) as any;
    if (!row) return null;
    return { username: String(row.username), role: (row.role as Role) || 'clerk' };
  }

  logout(token: string) { this.db.prepare('DELETE FROM sessions WHERE tokenHash=?').run(this.hash(token)); }

  list(): Account[] {
    return (this.db.prepare('SELECT username, role, createdAt FROM users ORDER BY createdAt ASC, username ASC').all() as any[])
      .map((u) => ({ username: String(u.username), role: (u.role as Role) || 'clerk', createdAt: String(u.createdAt || '') }));
  }

  create(username: unknown, password: unknown, role: unknown): Account {
    const name = String(username || '').trim();
    const pwd = String(password || '');
    const r = String(role || 'clerk') as Role;
    if (!USERNAME_RE.test(name)) throw new Error('账号需为 3–32 位字母、数字、下划线、点或短横线');
    if (pwd.length < 8 || pwd.length > 128) throw new Error('密码长度需为 8–128 位');
    if (!ROLES.includes(r)) throw new Error('角色只能是 admin / manager / clerk');
    if (this.db.prepare('SELECT username FROM users WHERE username=?').get(name)) throw new Error('账号已存在');
    const salt = randomBytes(16).toString('hex');
    const createdAt = new Date().toISOString();
    this.db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(name, salt, hashPassword(pwd, salt), r, createdAt);
    return { username: name, role: r, createdAt };
  }

  update(username: string, patch: { password?: unknown; role?: unknown }): Account {
    const existing = this.db.prepare('SELECT * FROM users WHERE username=?').get(username) as any;
    if (!existing) throw new Error('账号不存在');
    if (patch.role !== undefined) {
      const r = String(patch.role) as Role;
      if (!ROLES.includes(r)) throw new Error('角色只能是 admin / manager / clerk');
      if (r !== 'admin' && this.adminCount() <= 1 && existing.role === 'admin') {
        throw new Error('至少要保留一个管理员');
      }
      this.db.prepare('UPDATE users SET role=? WHERE username=?').run(r, username);
    }
    if (patch.password !== undefined && patch.password !== '') {
      const pwd = String(patch.password);
      if (pwd.length < 8 || pwd.length > 128) throw new Error('密码长度需为 8–128 位');
      const salt = randomBytes(16).toString('hex');
      this.db.prepare('UPDATE users SET salt=?, passwordHash=? WHERE username=?').run(salt, hashPassword(pwd, salt), username);
      // 改密码后让旧会话全部失效
      this.db.prepare('DELETE FROM sessions WHERE username=?').run(username);
    }
    const row = this.db.prepare('SELECT username, role, createdAt FROM users WHERE username=?').get(username) as any;
    return { username: String(row.username), role: row.role as Role, createdAt: String(row.createdAt || '') };
  }

  /** 删除账号：不允许删自己，也不允许删最后一个管理员 */
  remove(username: string, operator: string) {
    if (username === operator) throw new Error('不能删除当前登录账号');
    const existing = this.db.prepare('SELECT role FROM users WHERE username=?').get(username) as any;
    if (!existing) throw new Error('账号不存在');
    if (existing.role === 'admin' && this.adminCount() <= 1) throw new Error('至少要保留一个管理员');
    this.db.prepare('DELETE FROM sessions WHERE username=?').run(username);
    this.db.prepare('DELETE FROM users WHERE username=?').run(username);
  }

  private adminCount(): number {
    return Number((this.db.prepare("SELECT count(*) AS n FROM users WHERE role='admin'").get() as any).n);
  }
}
