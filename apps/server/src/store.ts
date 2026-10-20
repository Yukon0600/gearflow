import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { demoProducts, demoPartners } from './demo-data';
import { seedDemoActivity } from './demo-activity';
import { Workforce } from './workforce';

type ProductInput = { name?: unknown; sku?: unknown; category?: unknown; brand?: unknown; cost?: unknown; price?: unknown; threshold?: unknown };
type OrderInput = { type?: unknown; partner?: unknown; note?: unknown; lines?: unknown; employeeId?: unknown };
type Line = { productId: string; quantity: number; unitPrice: number };
const categories = ['处理器', '显卡', '内存', '存储', '主板', '外设', '电源 / 散热'];
function stringValue(value: unknown, name: string, max = 120) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new BadRequestException(`${name}不能为空且不能超过 ${max} 个字符`);
  return value.trim();
}
function integer(value: unknown, name: string, min = 0, max = 100000000) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw new BadRequestException(`${name}必须是 ${min} 至 ${max} 的整数`);
  return value;
}

export class Store {
  db: DatabaseSync;
  workforce: Workforce;
  constructor(path: string, seed = true) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS partners (id TEXT PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL, contact TEXT NOT NULL, phone TEXT NOT NULL, address TEXT NOT NULL, note TEXT NOT NULL, createdAt TEXT NOT NULL, UNIQUE(kind,name));
      CREATE TABLE IF NOT EXISTS drafts (id TEXT PRIMARY KEY, payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', orderId TEXT REFERENCES orders(id), createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS stocktakes (id TEXT PRIMARY KEY, number TEXT UNIQUE NOT NULL, note TEXT NOT NULL, createdAt TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS stocktake_lines (id TEXT PRIMARY KEY, stocktakeId TEXT NOT NULL REFERENCES stocktakes(id), productId TEXT NOT NULL REFERENCES products(id), expected INTEGER NOT NULL, actual INTEGER NOT NULL, delta INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS stocktake_movements (movementId TEXT PRIMARY KEY REFERENCES movements(id), stocktakeId TEXT NOT NULL REFERENCES stocktakes(id));
      CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, sku TEXT UNIQUE NOT NULL, name TEXT NOT NULL, category TEXT NOT NULL, brand TEXT NOT NULL, cost INTEGER NOT NULL CHECK(cost>=0), price INTEGER NOT NULL CHECK(price>=0), stock INTEGER NOT NULL DEFAULT 0 CHECK(stock>=0), threshold INTEGER NOT NULL DEFAULT 5, createdAt TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, number TEXT UNIQUE NOT NULL, type TEXT NOT NULL CHECK(type IN ('purchase','sale')), partner TEXT NOT NULL, note TEXT NOT NULL, total INTEGER NOT NULL, createdAt TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS order_lines (id TEXT PRIMARY KEY, orderId TEXT NOT NULL REFERENCES orders(id), productId TEXT NOT NULL REFERENCES products(id), quantity INTEGER NOT NULL CHECK(quantity>0), unitPrice INTEGER NOT NULL CHECK(unitPrice>=0));
      CREATE TABLE IF NOT EXISTS movements (id TEXT PRIMARY KEY, productId TEXT NOT NULL REFERENCES products(id), orderId TEXT REFERENCES orders(id), type TEXT NOT NULL, delta INTEGER NOT NULL, balance INTEGER NOT NULL CHECK(balance>=0), createdAt TEXT NOT NULL);
    `);
    this.workforce = new Workforce(this.db);
    if (seed && (this.db.prepare('SELECT count(*) AS n FROM products').get() as any).n === 0) this.seed();
    if (seed) this.expandDemo();
    if (seed) this.transaction(() => seedDemoActivity(this));
    if (seed) this.workforce.seed();
  }
  private transaction<T>(fn: () => T): T {
    if (this.db.isTransaction) return fn();
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  products() { return this.db.prepare('SELECT * FROM products ORDER BY createdAt DESC, sku').all(); }
  movements() {
    return this.db.prepare(`SELECT m.*, p.name, p.sku, COALESCE(o.number,c.number) AS orderNumber, o.partner FROM movements m JOIN products p ON p.id=m.productId LEFT JOIN orders o ON o.id=m.orderId LEFT JOIN stocktake_movements sm ON sm.movementId=m.id LEFT JOIN stocktakes c ON c.id=sm.stocktakeId ORDER BY m.createdAt DESC, m.rowid DESC`).all();
  }
  orders() {
    return this.db.prepare('SELECT * FROM orders ORDER BY createdAt DESC, rowid DESC').all().map(o => ({ ...o, lines: this.db.prepare('SELECT l.*, p.name, p.sku FROM order_lines l JOIN products p ON p.id=l.productId WHERE orderId=?').all(o.id) }));
  }
  snapshot() { return { products: this.products(), orders: this.orders(), movements: this.movements(), categories, partners:this.partners(), drafts:this.drafts(), stocktakes:this.stocktakes(), employees:this.workforce.employees(), services:this.workforce.services(), commissions:this.workforce.commissions() }; }
  /** 移动端（小程序 / 鸿蒙）用的精简库存清单，只带必要字段。 */
  mobileStock() {
    const rows = this.db.prepare(
      'SELECT id, sku, name, category, brand, stock, threshold, price FROM products ORDER BY stock ASC, name ASC'
    ).all() as any[];
    const counts = new Map<string, { count: number; low: number }>();
    for (const p of rows) {
      const key = String(p.category || '未分类');
      const cur = counts.get(key) || { count: 0, low: 0 };
      cur.count += 1;
      if (Number(p.stock) <= Number(p.threshold)) cur.low += 1;
      counts.set(key, cur);
    }
    const categoryList = Array.from(counts.entries())
      .map(([name, v]) => ({ name, count: v.count, low: v.low }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    return {
      updatedAt: new Date().toISOString(),
      total: rows.length,
      lowCount: rows.filter((p) => Number(p.stock) <= Number(p.threshold)).length,
      categories: categoryList,
      products: rows.map((p) => ({ ...p, low: Number(p.stock) <= Number(p.threshold) })),
    };
  }

  /** 移动端商品详情：含该商品最近流水。 */
  mobileProduct(id: string, limit = 10) {
    const p = this.db.prepare(
      'SELECT id, sku, name, category, brand, stock, threshold, price FROM products WHERE id=?'
    ).get(id) as any;
    if (!p) return null;
    const size = Math.min(Math.max(Number(limit) || 10, 1), 50);
    const history = (this.movements() as any[])
      .filter((m) => String(m.productId) === String(id))
      .slice(0, size)
      .map((m) => ({
        id: String(m.id),
        type: String(m.type),
        delta: Number(m.delta),
        balance: Number(m.balance),
        orderNumber: m.orderNumber ? String(m.orderNumber) : '',
        partner: m.partner ? String(m.partner) : '',
        createdAt: String(m.createdAt),
      }));
    return {
      ...p,
      low: Number(p.stock) <= Number(p.threshold),
      movements: history,
    };
  }

  /** 移动端首页概览：库存价值、今日出入库、低库存与最近流水。 */
  mobileSummary() {
    const rows = this.db.prepare('SELECT id, sku, name, brand, stock, threshold, cost, price FROM products').all() as any[];
    const stockValue = rows.reduce((s, p) => s + Number(p.stock) * Number(p.cost), 0);
    const retailValue = rows.reduce((s, p) => s + Number(p.stock) * Number(p.price), 0);
    const today = new Date().toISOString().slice(0, 10);
    const all = this.movements() as any[];
    const todayRows = all.filter((m) => String(m.createdAt).startsWith(today));
    const inbound = todayRows.filter((m) => Number(m.delta) > 0)
      .reduce((s, m) => s + Number(m.delta), 0);
    const outbound = todayRows.filter((m) => Number(m.delta) < 0)
      .reduce((s, m) => s + Math.abs(Number(m.delta)), 0);
    const lowList = rows
      .filter((p) => Number(p.stock) <= Number(p.threshold))
      .sort((a, b) => Number(a.stock) - Number(b.stock));
    return {
      updatedAt: new Date().toISOString(),
      productCount: rows.length,
      lowCount: lowList.length,
      stockValue,
      retailValue,
      todayInbound: inbound,
      todayOutbound: outbound,
      todayOrders: new Set(todayRows.map((m) => m.orderId).filter(Boolean)).size,
      lowProducts: lowList.slice(0, 5).map((p) => ({
        id: String(p.id),
        name: String(p.name),
        sku: String(p.sku),
        brand: String(p.brand),
        stock: Number(p.stock),
        threshold: Number(p.threshold),
        suggest: Math.max(Number(p.threshold) * 2 - Number(p.stock), 0),
      })),
      recent: all.slice(0, 8).map((m) => ({
        id: String(m.id),
        name: String(m.name),
        sku: String(m.sku),
        type: String(m.type),
        delta: Number(m.delta),
        balance: Number(m.balance),
        orderNumber: m.orderNumber ? String(m.orderNumber) : '',
        createdAt: String(m.createdAt),
      })),
    };
  }

  /** 移动端流水列表。 */
  mobileMovements(limit = 50) {
    const size = Math.min(Math.max(Number(limit) || 50, 1), 200);
    return {
      total: Number((this.db.prepare('SELECT count(*) AS n FROM movements').get() as any).n),
      items: (this.movements() as any[]).slice(0, size).map((m) => ({
        id: String(m.id),
        name: String(m.name),
        sku: String(m.sku),
        type: String(m.type),
        delta: Number(m.delta),
        balance: Number(m.balance),
        orderNumber: m.orderNumber ? String(m.orderNumber) : '',
        partner: m.partner ? String(m.partner) : '',
        createdAt: String(m.createdAt),
      })),
    };
  }
  createProduct(body: ProductInput, existingId?: string) {
    if (existingId && !this.db.prepare('SELECT id FROM products WHERE id=?').get(existingId)) throw new NotFoundException('商品不存在');
    if (!body || typeof body !== 'object') throw new BadRequestException('商品数据格式错误');
    const name = stringValue(body.name, '商品名称');
    const sku = stringValue(body.sku, 'SKU', 50).toUpperCase();
    const category = stringValue(body.category, '分类');
    if (!categories.includes(category)) throw new BadRequestException('无效的商品分类');
    const brand = stringValue(body.brand, '品牌', 40);
    const cost = integer(body.cost, '采购单价（分）');
    const price = integer(body.price, '销售单价（分）');
    const threshold = integer(body.threshold, '预警库存', 0, 1000000);
    const duplicate = this.db.prepare('SELECT id FROM products WHERE sku=?').get(sku);
    if (duplicate && duplicate.id !== existingId) throw new ConflictException('SKU 已存在，请使用其他编码');
    if (existingId) {
      this.db.prepare('UPDATE products SET sku=?,name=?,category=?,brand=?,cost=?,price=?,threshold=? WHERE id=?').run(sku,name,category,brand,cost,price,threshold,existingId);
      return this.db.prepare('SELECT * FROM products WHERE id=?').get(existingId);
    }
    const id = randomUUID();
    this.db.prepare('INSERT INTO products VALUES(?,?,?,?,?,?,?,0,?,?)').run(id, sku, name, category, brand, cost, price, threshold, new Date().toISOString());
    return this.db.prepare('SELECT * FROM products WHERE id=?').get(id);
  }
  createOrder(body: OrderInput) {
    if (!body || typeof body !== 'object') throw new BadRequestException('单据数据格式错误');
    const type = body.type;
    if (type !== 'purchase' && type !== 'sale') throw new BadRequestException('无效单据类型');
    const partner = stringValue(body.partner, type === 'purchase' ? '供应商' : '客户');
    const note = body.note === undefined || body.note === '' ? '' : stringValue(body.note, '备注', 500);
    if (!Array.isArray(body.lines) || !body.lines.length || body.lines.length > 50) throw new BadRequestException('单据应包含 1 至 50 行商品');
    const lines: Line[] = body.lines.map((l: any) => {
      if (!l || typeof l !== 'object') throw new BadRequestException('商品行格式错误');
      return { productId: stringValue(l.productId, '商品'), quantity: integer(l.quantity, '数量', 1, 1000000), unitPrice: integer(l.unitPrice, '单价（分）') };
    });
    if (new Set(lines.map(l => l.productId)).size !== lines.length) throw new BadRequestException('相同商品请合并到一行');
    const total = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    if (!Number.isSafeInteger(total) || total > 100000000000) throw new BadRequestException('单据金额过大');
    return this.transaction(() => {
      for (const line of lines) {
        const p = this.db.prepare('SELECT * FROM products WHERE id=?').get(line.productId);
        if (!p) throw new BadRequestException('商品不存在');
        if (type === 'sale' && Number(p.stock) < line.quantity) throw new ConflictException(`${p.name} 库存不足，当前可用 ${p.stock} 件`);
      }
      const id = randomUUID();
      const createdAt = new Date().toISOString();
      const seq = Number((this.db.prepare('SELECT count(*) AS n FROM orders').get() as any).n) + 1;
      const number = `${type === 'purchase' ? 'PO' : 'SO'}-${createdAt.slice(0, 10).replaceAll('-', '')}-${String(seq).padStart(4, '0')}`;
      this.db.prepare('INSERT INTO orders VALUES(?,?,?,?,?,?,?)').run(id, number, type, partner, note, total, createdAt);
      for (const line of lines) {
        const delta = type === 'purchase' ? line.quantity : -line.quantity;
        this.db.prepare('INSERT INTO order_lines VALUES(?,?,?,?,?)').run(randomUUID(), id, line.productId, line.quantity, line.unitPrice);
        this.db.prepare('UPDATE products SET stock=stock+? WHERE id=?').run(delta, line.productId);
        const p = this.db.prepare('SELECT stock FROM products WHERE id=?').get(line.productId)!;
        this.db.prepare('INSERT INTO movements VALUES(?,?,?,?,?,?,?)').run(randomUUID(), line.productId, id, type, delta, p.stock, createdAt);
      }
      if (type === 'sale' && body.employeeId) this.workforce.recordSale(id, stringValue(body.employeeId, '接待员工'));
      return { id, number, total };
    });
  }

  partners() {
    return this.db.prepare('SELECT * FROM partners ORDER BY createdAt DESC').all().map(p=>{
      const transactions=this.db.prepare('SELECT id,number,total,createdAt FROM orders WHERE partner=? AND type=? ORDER BY createdAt DESC').all(p.name,p.kind==='supplier'?'purchase':'sale');
      return {...p,transactions,total:transactions.reduce((a,o)=>a+Number(o.total),0)};
    });
  }
  savePartner(body:any,id?:string) {
    if(!body||typeof body!=='object') throw new BadRequestException('档案格式错误');
    if(!['customer','supplier'].includes(body.kind)) throw new BadRequestException('往来类型错误');
    const name=stringValue(body.name,'单位名称');
    const optional=(v:any,label:string,max=200)=>v===undefined||v===''?'':stringValue(v,label,max);
    const contact=optional(body.contact,'联系人',50),phone=optional(body.phone,'联系电话',40),address=optional(body.address,'地址'),note=optional(body.note,'备注',500);
    const existing=id?this.db.prepare('SELECT * FROM partners WHERE id=?').get(id):null;
    if(id&&!existing) throw new NotFoundException('档案不存在');
    if(existing&&(existing.name!==name||existing.kind!==body.kind)) throw new BadRequestException('单位名称和类型创建后不可修改，请新建档案');
    const duplicate=this.db.prepare('SELECT id FROM partners WHERE kind=? AND name=?').get(body.kind,name);
    if(duplicate&&duplicate.id!==id) throw new ConflictException('该单位档案已存在');
    const key=id||randomUUID();
    if(id) this.db.prepare('UPDATE partners SET contact=?,phone=?,address=?,note=? WHERE id=?').run(contact,phone,address,note,id);
    else this.db.prepare('INSERT INTO partners VALUES(?,?,?,?,?,?,?,?)').run(key,body.kind,name,contact,phone,address,note,new Date().toISOString());
    return this.db.prepare('SELECT * FROM partners WHERE id=?').get(key);
  }
  drafts() {
    return this.db.prepare('SELECT * FROM drafts WHERE status=? ORDER BY updatedAt DESC').all('draft').map(d=>({...d,payload:JSON.parse(String(d.payload))}));
  }
  saveDraft(body:any,id?:string) {
    if(!body||!['purchase','sale'].includes(body.type)||!Array.isArray(body.lines)||!body.lines.length||body.lines.length>50) throw new BadRequestException('草稿需要有效类型及 1–50 行商品');
    const partner=body.partner===''?'':stringValue(body.partner,'往来单位');
    const note=body.note===undefined||body.note===''?'':stringValue(body.note,'备注',500);
    const lines=body.lines.map((l:any)=>{
      if(!l||typeof l!=='object')throw new BadRequestException('商品行格式错误');
      const productId=stringValue(l.productId,'商品');
      if(!this.db.prepare('SELECT id FROM products WHERE id=?').get(productId))throw new BadRequestException('商品不存在');
      return {productId,quantity:integer(l.quantity,'数量',1,1000000),unitPrice:integer(l.unitPrice,'单价（分）')};
    });
    if(new Set(lines.map((l:any)=>l.productId)).size!==lines.length)throw new BadRequestException('相同商品请合并到一行');
    const employeeId = body.type==='sale' && body.employeeId ? String(this.workforce.employee(body.employeeId).id) : '';
    const payload=JSON.stringify({type:body.type,partner,note,lines,employeeId});
    if(id){const d=this.db.prepare('SELECT * FROM drafts WHERE id=?').get(id);if(!d)throw new NotFoundException('草稿不存在');if(d.status!=='draft')throw new ConflictException('草稿已记账，不可修改');}
    const key=id||randomUUID(),now=new Date().toISOString();
    if(id)this.db.prepare('UPDATE drafts SET payload=?,updatedAt=? WHERE id=?').run(payload,now,id);
    else this.db.prepare('INSERT INTO drafts VALUES(?,?,?,NULL,?,?)').run(key,payload,'draft',now,now);
    return {id:key};
  }
  postDraft(id:string){
    return this.transaction(()=>{
      const d=this.db.prepare('SELECT * FROM drafts WHERE id=?').get(id);
      if(!d)throw new NotFoundException('草稿不存在');
      if(d.status==='posted')return this.db.prepare('SELECT * FROM orders WHERE id=?').get(d.orderId);
      const order=this.createOrder(JSON.parse(String(d.payload)));
      this.db.prepare('UPDATE drafts SET status=?,orderId=?,updatedAt=? WHERE id=?').run('posted',order.id,new Date().toISOString(),id);
      return order;
    });
  }
  stocktakes(){
    return this.db.prepare('SELECT * FROM stocktakes ORDER BY createdAt DESC,rowid DESC').all().map(c=>({...c,lines:this.db.prepare('SELECT l.*,p.name,p.sku FROM stocktake_lines l JOIN products p ON p.id=l.productId WHERE stocktakeId=?').all(c.id)}));
  }
  createStocktake(body:any){
    if(!body||!Array.isArray(body.lines)||!body.lines.length||body.lines.length>100)throw new BadRequestException('盘点需要 1–100 行商品');
    const note=stringValue(body.note,'盘点原因',500);
    const lines=body.lines.map((l:any)=>{
      if(!l||typeof l!=='object')throw new BadRequestException('盘点行格式错误');
      return {productId:stringValue(l.productId,'商品'),expected:integer(l.expected,'账面数量',0,100000000000),actual:integer(l.actual,'实盘数量',0,100000000000)};
    });
    if(new Set(lines.map((l:any)=>l.productId)).size!==lines.length)throw new BadRequestException('盘点商品不可重复');
    return this.transaction(()=>{
      for(const l of lines){const p=this.db.prepare('SELECT * FROM products WHERE id=?').get(l.productId);if(!p)throw new BadRequestException('商品不存在');if(p.stock!==l.expected)throw new ConflictException(`${p.name} 库存已变动，请刷新后重新盘点`);}
      const id=randomUUID(),now=new Date().toISOString();
      const seq=Number(this.db.prepare('SELECT count(*) AS n FROM stocktakes').get()!.n)+1;
      const number=`ST-${now.slice(0,10).replaceAll('-','')}-${String(seq).padStart(4,'0')}`;
      this.db.prepare('INSERT INTO stocktakes VALUES(?,?,?,?)').run(id,number,note,now);
      for(const l of lines){
        const delta=l.actual-l.expected;
        this.db.prepare('INSERT INTO stocktake_lines VALUES(?,?,?,?,?,?)').run(randomUUID(),id,l.productId,l.expected,l.actual,delta);
        this.db.prepare('UPDATE products SET stock=? WHERE id=?').run(l.actual,l.productId);
        if(delta!==0){const movementId=randomUUID();this.db.prepare('INSERT INTO movements VALUES(?,?,NULL,?,?,?,?)').run(movementId,l.productId,'stocktake',delta,l.actual,now);this.db.prepare('INSERT INTO stocktake_movements VALUES(?,?)').run(movementId,id);}
      }
      return {id,number};
    });
  }
  private expandDemo() {
    this.db.exec('CREATE TABLE IF NOT EXISTS demo_migrations (name TEXT PRIMARY KEY)');
    if (this.db.prepare('SELECT name FROM demo_migrations WHERE name=?').get('catalog-v2')) return;
    this.transaction(() => {
      for (const [name,sku,category,brand,cost,price,stock] of demoProducts) {
        if (this.db.prepare('SELECT id FROM products WHERE sku=?').get(sku)) continue;
        const p = this.createProduct({name,sku,category,brand,cost,price,threshold:5})!;
        this.db.prepare('UPDATE products SET stock=? WHERE id=?').run(stock,p.id);
        this.db.prepare('INSERT INTO movements VALUES(?,?,NULL,?,?,?,?)').run(randomUUID(),p.id,'opening',stock,stock,new Date().toISOString());
      }
      for (const [kind,name,contact,address,note] of demoPartners) {
        if (this.db.prepare('SELECT id FROM partners WHERE kind=? AND name=?').get(kind,name)) continue;
        this.savePartner({kind,name,contact,address,phone:'',note:`测试数据，单位与联系人均为虚构；${note}`});
      }
      this.db.prepare('INSERT INTO demo_migrations VALUES(?)').run('catalog-v2');
    });
  }
  private seed() {
    const demo = [
      ['AMD Ryzen 7 9700X', 'CPU-AMD-9700X', '处理器', 'AMD', 199900, 239900, 24],
      ['GeForce RTX 5070 12GB', 'GPU-RTX-5070', '显卡', 'NVIDIA', 409900, 469900, 8],
      ['FURY Beast DDR5 32GB', 'RAM-KF-32G', '内存', 'Kingston', 52900, 69900, 46],
      ['990 PRO NVMe 2TB', 'SSD-990P-2T', '存储', 'Samsung', 99900, 129900, 32],
      ['ROG STRIX B850-A', 'MB-ROG-B850A', '主板', 'ASUS', 139900, 169900, 12],
      ['MX Master 3S', 'MS-MX-3S', '外设', 'Logitech', 49900, 69900, 4],
      ['Vengeance DDR5 64GB', 'RAM-COR-64G', '内存', 'Corsair', 109900, 139900, 18],
      ['FOCUS GX-850 ATX 3.0', 'PSU-GX-850', '电源 / 散热', 'Seasonic', 69900, 89900, 3],
      ['WD BLACK SN850X 1TB', 'SSD-WD-1T', '存储', 'Western Digital', 49900, 64900, 27],
      ['ROG Swift OLED 27″', 'MON-ROG-27', '外设', 'ASUS', 399900, 499900, 0]
    ];
    this.transaction(() => {
      for (const [name, sku, category, brand, cost, price, stock] of demo) {
        const p = this.createProduct({ name, sku, category, brand, cost, price, threshold: 5 })!;
        this.db.prepare('UPDATE products SET stock=? WHERE id=?').run(stock, p.id);
        this.db.prepare('INSERT INTO movements VALUES(?,?,NULL,?,?,?,?)').run(randomUUID(), p.id, 'opening', stock, stock, new Date().toISOString());
      }
    });
  }
  close() { this.db.close(); }
}
