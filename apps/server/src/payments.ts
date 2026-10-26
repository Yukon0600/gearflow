import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { BadRequestException, ConflictException } from '@nestjs/common';

export type PaymentDirection = 'in' | 'out';

export const PAYMENT_METHODS = ['cash', 'wechat', 'alipay', 'bank', 'other'] as const;
export const METHOD_LABEL: Record<string, string> = {
  cash: '现金',
  wechat: '微信',
  alipay: '支付宝',
  bank: '银行转账',
  other: '其他',
};

export interface PaymentInput {
  direction?: unknown;
  partner?: unknown;
  amount?: unknown;
  method?: unknown;
  note?: unknown;
  orderId?: unknown;
}

export interface PaymentRow {
  id: string;
  direction: PaymentDirection;
  partner: string;
  amount: number;
  method: string;
  note: string;
  orderId: string | null;
  createdAt: string;
  createdBy: string;
}

export interface ReconcileItem {
  partner: string;
  billed: number;
  returned: number;
  settled: number;
  balance: number;
}

const text = (value: unknown, label: string, max = 120): string => {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) throw new BadRequestException(`${label}不能为空`);
  if (s.length > max) throw new BadRequestException(`${label}不能超过 ${max} 个字符`);
  return s;
};

export class Payments {
  constructor(private db: DatabaseSync) {
    db.exec(`CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      direction TEXT NOT NULL CHECK(direction IN ('in','out')),
      partner TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK(amount > 0),
      method TEXT NOT NULL DEFAULT 'bank',
      note TEXT NOT NULL DEFAULT '',
      orderId TEXT REFERENCES orders(id),
      createdAt TEXT NOT NULL,
      createdBy TEXT NOT NULL
    );`);
  }

  /** 往来单位的应收（客户）或应付（供应商）余额 */
  outstanding(direction: PaymentDirection): Map<string, ReconcileItem> {
    const map = new Map<string, ReconcileItem>();
    const ensure = (partner: string): ReconcileItem => {
      if (!map.has(partner)) map.set(partner, { partner, billed: 0, returned: 0, settled: 0, balance: 0 });
      return map.get(partner)!;
    };

    // 应收看销售与销售退货；应付看采购与采购退货
    const billedTypes = direction === 'in' ? ['sale'] : ['purchase'];
    const returnedTypes = direction === 'in' ? ['return_in'] : ['return_out'];
    const orders = this.db.prepare('SELECT partner, type, total FROM orders').all() as any[];
    for (const o of orders) {
      if (billedTypes.includes(o.type)) ensure(String(o.partner)).billed += Number(o.total);
      else if (returnedTypes.includes(o.type)) ensure(String(o.partner)).returned += Number(o.total);
    }

    const paid = this.db.prepare('SELECT partner, SUM(amount) AS amount FROM payments WHERE direction=? GROUP BY partner').all(direction) as any[];
    for (const row of paid) ensure(String(row.partner)).settled = Number(row.amount);

    for (const item of map.values()) {
      item.balance = item.billed - item.returned - item.settled;
    }
    return map;
  }

  reconcile() {
    const summarize = (direction: PaymentDirection) => {
      const items = Array.from(this.outstanding(direction).values())
        .filter((i) => Math.abs(i.balance) > 0)
        .sort((a, b) => b.balance - a.balance);
      const total = items.reduce((s, i) => s + (i.balance > 0 ? i.balance : 0), 0);
      return { total, items };
    };
    return {
      receivables: summarize('in'),
      payables: summarize('out'),
      updatedAt: new Date().toISOString(),
    };
  }

  create(input: PaymentInput, createdBy: string): PaymentRow {
    const direction = String(input.direction || '') as PaymentDirection;
    if (direction !== 'in' && direction !== 'out') throw new BadRequestException('收付方向只能是 in 或 out');
    const partner = text(input.partner, direction === 'in' ? '客户' : '供应商');
    const amount = Number(input.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new BadRequestException('金额必须为正整数（分）');
    const method = String(input.method || 'bank');
    if (!PAYMENT_METHODS.includes(method as any)) throw new BadRequestException('不支持的收付方式');
    const note = input.note === undefined || input.note === '' ? '' : text(input.note, '备注', 500);
    const orderId = typeof input.orderId === 'string' && input.orderId ? input.orderId : null;

    if (orderId && !this.db.prepare('SELECT id FROM orders WHERE id=?').get(orderId)) {
      throw new BadRequestException('关联单据不存在');
    }

    // 不能超额收付：拿当前余额做上限
    const current = this.outstanding(direction).get(partner);
    const balance = current ? current.balance : 0;
    if (amount > balance) {
      throw new ConflictException(
        `${partner} 当前${direction === 'in' ? '应收' : '应付'}余额为 ${(Math.max(balance, 0) / 100).toFixed(2)} 元，不能登记 ${(amount / 100).toFixed(2)} 元`,
      );
    }

    const row: PaymentRow = {
      id: randomUUID(),
      direction,
      partner,
      amount,
      method,
      note,
      orderId,
      createdAt: new Date().toISOString(),
      createdBy,
    };
    this.db.prepare('INSERT INTO payments VALUES(?,?,?,?,?,?,?,?,?)').run(
      row.id, row.direction, row.partner, row.amount, row.method, row.note, row.orderId, row.createdAt, row.createdBy,
    );
    return row;
  }

  list(page = 1, size = 20, filter: { direction?: string; partner?: string } = {}) {
    const p = Math.max(Number(page) || 1, 1);
    const s = Math.min(Math.max(Number(size) || 20, 1), 100);
    const where: string[] = [];
    const params: any[] = [];
    if (filter.direction === 'in' || filter.direction === 'out') {
      where.push('direction = ?');
      params.push(filter.direction);
    }
    if (filter.partner) {
      where.push('partner LIKE ?');
      params.push(`%${filter.partner}%`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = Number((this.db.prepare(`SELECT count(*) AS n FROM payments ${clause}`).get(...params) as any).n);
    const items = this.db.prepare(`SELECT * FROM payments ${clause} ORDER BY createdAt DESC, rowid DESC LIMIT ? OFFSET ?`)
      .all(...params, s, (p - 1) * s) as any[];
    return { page: p, size: s, total, pages: Math.max(Math.ceil(total / s), 1), items };
  }
}
