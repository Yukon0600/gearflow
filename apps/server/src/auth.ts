import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export class Auth {
  constructor(private db: DatabaseSync) {
    db.exec(`CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, salt TEXT NOT NULL, passwordHash TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (tokenHash TEXT PRIMARY KEY, username TEXT NOT NULL REFERENCES users(username), expires INTEGER NOT NULL);`);
    if (!db.prepare('SELECT username FROM users LIMIT 1').get()) {
      const salt = randomBytes(16).toString('hex');
      const password = process.env.GEARFLOW_ADMIN_PASSWORD || 'GearFlow@2026';
      db.prepare('INSERT INTO users VALUES(?,?,?)').run('admin', salt, scryptSync(password, salt, 64).toString('hex'));
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
  user(token: string) {
    const session = this.db.prepare('SELECT username FROM sessions WHERE tokenHash=? AND expires>?').get(this.hash(token), Date.now());
    return session ? { username: String(session.username) } : null;
  }
  logout(token: string) { this.db.prepare('DELETE FROM sessions WHERE tokenHash=?').run(this.hash(token)); }
}
