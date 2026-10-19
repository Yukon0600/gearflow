import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

function text(value: unknown, label: string, max = 120) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new BadRequestException(`${label}不能为空且不能超过 ${max} 个字符`);
  return value.trim();
}
function number(value: unknown, label: string, max: number) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > max) throw new BadRequestException(`${label}必须为 0–${max} 的整数`);
  return value;
}

export class Workforce {
  constructor(private db: DatabaseSync) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL,
        phone TEXT NOT NULL, active INTEGER NOT NULL CHECK(active IN (0,1)),
        salesBps INTEGER NOT NULL CHECK(salesBps BETWEEN 0 AND 10000),
        serviceBps INTEGER NOT NULL CHECK(serviceBps BETWEEN 0 AND 10000), createdAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS assembly_services (
        id TEXT PRIMARY KEY, number TEXT UNIQUE NOT NULL, customerId TEXT NOT NULL REFERENCES partners(id),
        employeeId TEXT NOT NULL REFERENCES employees(id), designated INTEGER NOT NULL CHECK(designated IN (0,1)),
        orderId TEXT REFERENCES orders(id), title TEXT NOT NULL, note TEXT NOT NULL,
        fee INTEGER NOT NULL CHECK(fee>=0), status TEXT NOT NULL CHECK(status IN ('pending','working','completed','cancelled')),
        createdAt TEXT NOT NULL, completedAt TEXT
      );
      CREATE TABLE IF NOT EXISTS commissions (
        id TEXT PRIMARY KEY, employeeId TEXT NOT NULL REFERENCES employees(id), employeeName TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('sale','service')), orderId TEXT UNIQUE REFERENCES orders(id),
        serviceId TEXT UNIQUE REFERENCES assembly_services(id), base INTEGER NOT NULL CHECK(base>=0),
        rateBps INTEGER NOT NULL CHECK(rateBps BETWEEN 0 AND 10000), amount INTEGER NOT NULL CHECK(amount>=0),
        createdAt TEXT NOT NULL,
        CHECK((type='sale' AND orderId IS NOT NULL AND serviceId IS NULL) OR (type='service' AND serviceId IS NOT NULL AND orderId IS NULL))
      );
    `);
  }
  private transaction<T>(fn: () => T): T {
    if (this.db.isTransaction) return fn();
    this.db.exec('BEGIN IMMEDIATE');
    try { const value = fn(); this.db.exec('COMMIT'); return value; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  employee(id: unknown, active = true) {
    const employee = this.db.prepare('SELECT * FROM employees WHERE id=?').get(text(id, '员工'));
    if (!employee) throw new NotFoundException('员工不存在');
    if (active && !employee.active) throw new BadRequestException('该员工已停用，请选择在职员工');
    return employee;
  }
  employees() {
    return this.db.prepare(`SELECT e.*,
      COALESCE((SELECT SUM(amount) FROM commissions WHERE employeeId=e.id AND type='sale'),0) AS salesCommission,
      COALESCE((SELECT SUM(amount) FROM commissions WHERE employeeId=e.id AND type='service'),0) AS serviceCommission,
      (SELECT count(*) FROM commissions WHERE employeeId=e.id AND type='sale') AS salesCount,
      (SELECT count(*) FROM assembly_services WHERE employeeId=e.id AND status='completed') AS serviceCount
      FROM employees e ORDER BY e.code`).all();
  }
  saveEmployee(body: any, id?: string) {
    if (!body || typeof body !== 'object') throw new BadRequestException('员工资料格式错误');
    const code = text(body.code, '工号', 30).toUpperCase(), name = text(body.name, '姓名', 50), role = text(body.role, '岗位', 50);
    const phone = body.phone ? text(body.phone, '电话', 40) : '';
    const salesBps = number(body.salesBps, '销售提成比例', 10000), serviceBps = number(body.serviceBps, '装机提成比例', 10000);
    if (typeof body.active !== 'boolean') throw new BadRequestException('员工在职状态格式错误');
    if (id) this.employee(id, false);
    const duplicate = this.db.prepare('SELECT id FROM employees WHERE code=?').get(code);
    if (duplicate && duplicate.id !== id) throw new ConflictException('工号已存在');
    const key = id || randomUUID();
    if (id) this.db.prepare('UPDATE employees SET code=?,name=?,role=?,phone=?,active=?,salesBps=?,serviceBps=? WHERE id=?').run(code,name,role,phone,+body.active,salesBps,serviceBps,key);
    else this.db.prepare('INSERT INTO employees VALUES(?,?,?,?,?,?,?,?,?)').run(key,code,name,role,phone,+body.active,salesBps,serviceBps,new Date().toISOString());
    return this.employee(key, false);
  }
  recordSale(orderId: string, employeeId: string) {
    const employee = this.employee(employeeId);
    const order = this.db.prepare('SELECT * FROM orders WHERE id=?').get(orderId);
    if (!order || order.type !== 'sale') throw new BadRequestException('只能为销售单记录销售提成');
    this.recordCommission(employee, 'sale', orderId, Number(order.total));
  }
  private recordCommission(employee: any, type: 'sale'|'service', sourceId: string, base: number) {
    const rate = Number(type === 'sale' ? employee.salesBps : employee.serviceBps);
    // Round half up to fen with integer arithmetic, including large order totals.
    const amount = Number((BigInt(base) * BigInt(rate) + 5000n) / 10000n);
    this.db.prepare('INSERT INTO commissions VALUES(?,?,?,?,?,?,?,?,?,?)').run(randomUUID(),employee.id,employee.name,type,type==='sale'?sourceId:null,type==='service'?sourceId:null,base,rate,amount,new Date().toISOString());
  }
  commissions() {
    return this.db.prepare(`SELECT c.*,COALESCE(o.number,s.number) AS sourceNumber,
      COALESCE(o.partner,p.name) AS customer,
      CASE WHEN c.type='service' THEN s.title ELSE (SELECT group_concat(pr.name || ' × ' || l.quantity, '；') FROM order_lines l JOIN products pr ON pr.id=l.productId WHERE l.orderId=o.id) END AS description
      FROM commissions c LEFT JOIN orders o ON o.id=c.orderId LEFT JOIN assembly_services s ON s.id=c.serviceId
      LEFT JOIN partners p ON p.id=s.customerId ORDER BY c.createdAt DESC,c.rowid DESC`).all();
  }
  services() {
    return this.db.prepare(`SELECT s.*,p.name AS customer,e.name AS employeeName,e.code AS employeeCode,
      o.number AS orderNumber,c.amount AS commission,c.rateBps,c.employeeName AS creditedEmployeeName
      FROM assembly_services s JOIN partners p ON p.id=s.customerId JOIN employees e ON e.id=s.employeeId
      LEFT JOIN orders o ON o.id=s.orderId LEFT JOIN commissions c ON c.serviceId=s.id
      ORDER BY s.createdAt DESC,s.rowid DESC`).all();
  }
  createService(body: any) {
    if (!body || typeof body !== 'object') throw new BadRequestException('装机服务格式错误');
    return this.transaction(() => {
      const customerId = text(body.customerId, '客户'), employee = this.employee(body.employeeId);
      const customer = this.db.prepare("SELECT * FROM partners WHERE id=? AND kind='customer'").get(customerId);
      if (!customer) throw new BadRequestException('请选择客户档案');
      const title = text(body.title, '服务项目'), note = body.note ? text(body.note, '服务说明', 500) : '';
      const fee = number(body.fee, '装机服务费（分）', 100000000);
      if (typeof body.designated !== 'boolean') throw new BadRequestException('指定员工标记格式错误');
      const orderId = body.orderId ? text(body.orderId, '销售单') : null;
      if (orderId) {
        const order = this.db.prepare("SELECT * FROM orders WHERE id=? AND type='sale'").get(orderId);
        if (!order || order.partner !== customer.name) throw new BadRequestException('关联销售单必须属于当前客户');
      }
      const id = randomUUID(), now = new Date().toISOString();
      const seq = Number(this.db.prepare('SELECT count(*) AS n FROM assembly_services').get()!.n) + 1;
      const serviceNumber = `SV-${now.slice(0,10).replaceAll('-','')}-${String(seq).padStart(4,'0')}`;
      this.db.prepare('INSERT INTO assembly_services VALUES(?,?,?,?,?,?,?,?,?,?,?,NULL)').run(id,serviceNumber,customerId,employee.id,+body.designated,orderId,title,note,fee,'pending',now);
      return {id,number:serviceNumber};
    });
  }
  transitionService(id: string, status: unknown) {
    if (!['working','completed','cancelled'].includes(String(status))) throw new BadRequestException('服务状态无效');
    return this.transaction(() => {
      const service = this.db.prepare('SELECT * FROM assembly_services WHERE id=?').get(id);
      if (!service) throw new NotFoundException('装机服务不存在');
      if (service.status === status) return service;
      if (service.status === 'completed' || service.status === 'cancelled') throw new ConflictException('已完成或取消的服务不可再次变更');
      if (status === 'completed' && service.status !== 'working') throw new ConflictException('请先开始装机，再确认完成');
      const now = new Date().toISOString();
      if (status === 'completed') this.recordCommission(this.employee(service.employeeId, false), 'service', id, Number(service.fee));
      this.db.prepare('UPDATE assembly_services SET status=?,completedAt=? WHERE id=?').run(String(status),status==='completed'?now:null,id);
      return this.db.prepare('SELECT * FROM assembly_services WHERE id=?').get(id);
    });
  }
  seed() {
    if (this.db.prepare('SELECT name FROM demo_migrations WHERE name=?').get('workforce-v1')) return;
    this.transaction(() => {
      const staff = [ ['DEMO-001','林泽（演示）','装机工程师',150,3000], ['DEMO-002','陈曦（演示）','销售顾问',250,2000], ['DEMO-003','周航（演示）','装机工程师',150,3500], ['DEMO-004','许宁（演示）','门店接待',200,2000] ];
      const employees = staff.map(([code,name,role,salesBps,serviceBps]) => this.db.prepare('SELECT * FROM employees WHERE code=?').get(code) || this.saveEmployee({code,name,role,salesBps,serviceBps,phone:'',active:true}));
      const orders = this.db.prepare("SELECT * FROM orders WHERE type='sale' AND note LIKE '【演示数据】%' ORDER BY rowid").all();
      orders.forEach((order, i) => {
        if (!this.db.prepare('SELECT id FROM commissions WHERE orderId=?').get(order.id)) this.recordSale(String(order.id), String(employees[i % employees.length].id));
      });
      const customers = this.db.prepare("SELECT * FROM partners WHERE kind='customer' AND name LIKE '%（演示）' ORDER BY name").all();
      if (customers.length) for (let i = 0; i < 10; i++) {
        const customer = customers[i % customers.length];
        const order = orders.find(o => o.partner === customer.name);
        const service = this.createService({customerId:customer.id,employeeId:employees[i%employees.length].id,designated:i%2===0,orderId:order?.id,title:['整机组装与理线','系统安装与驱动调试','硬件升级与稳定性测试'][i%3],fee:[19900,9900,29900][i%3],note:'【演示数据】包含开机检查与交付验收；配件费用另计。'});
        if (i < 8) this.transitionService(service.id,'working');
        if (i < 6) this.transitionService(service.id,'completed');
        if (i === 9) this.transitionService(service.id,'cancelled');
      }
      this.db.prepare('INSERT INTO demo_migrations VALUES(?)').run('workforce-v1');
    });
  }
}
