import type { Store } from './store';
import { demoPartners } from './demo-data';

// Called inside one transaction; never backdate movements across existing stock history.
export function seedDemoActivity(store: Store) {
  const migration = 'business-activity-v1';
  if (store.db.prepare('SELECT name FROM demo_migrations WHERE name=?').get(migration)) return;
  const suppliers = demoPartners.filter(p => p[0] === 'supplier').map(p => p[1]);
  const customers = demoPartners.filter(p => p[0] === 'customer').map(p => p[1]);
  const products = store.db.prepare('SELECT * FROM products ORDER BY sku').all();
  if (products.length < 6) throw new Error('演示业务记录需要先初始化商品');
  const purposes = ['常规补货', '装机订单备货', '办公升级备货', '门店周转补货'];
  for (let batch = 0; batch < 12; batch++) {
    const selected = Array.from({length: 6}, (_, i) => products[(batch * 6 + i) % products.length]);
    for (let group = 0; group < 2; group++) {
      const index = batch * 2 + group;
      const items = selected.slice(group * 3, group * 3 + 3);
      store.createOrder({
        type: 'purchase', partner: suppliers[index % suppliers.length],
        note: `【演示数据】第 ${index + 1} 批采购 · ${purposes[batch % purposes.length]}，模拟验收入库。`,
        lines: items.map((p, i) => ({productId: p.id, quantity: 6 + (index + i) % 7, unitPrice: p.cost})),
      });
      store.createOrder({
        type: 'sale', partner: customers[index % customers.length],
        note: `【演示数据】第 ${index + 1} 批交付 · ${['整机配件交付', '设备升级领货', '门店零售出库', '项目配件交付'][batch % 4]}。`,
        lines: items.map((p, i) => ({productId: p.id, quantity: 2 + (index + i) % 4, unitPrice: p.price})),
      });
    }
    const changes = batch % 4 === 0 ? [0, 0, 0] : [1, -1, 0];
    store.createStocktake({
      note: `【演示数据】第 ${batch + 1} 次抽盘 · ${batch % 4 === 0 ? '账实一致，完成抽样复核' : '模拟货位复核：首项盘盈 1 件、次项盘亏 1 件、末项账实一致' }。`,
      lines: selected.slice(0, 3).map((p, i) => {
        const expected = Number(store.db.prepare('SELECT stock FROM products WHERE id=?').get(p.id)!.stock);
        return {productId: p.id, expected, actual: expected + changes[i]};
      }),
    });
  }
  store.db.prepare('INSERT INTO demo_migrations VALUES(?)').run(migration);
}
