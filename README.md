# GearFlow 电脑配件进销存

## 线上地址

| 项目 | 地址 |
| --- | --- |
| 站点 | https://timomo.store |
| 接口 | https://timomo.store/api/health |
| 备案 | 粤ICP备2026167701号（2026-10-28 通过审核） |

HTTP 与 IP 访问均 301 跳转到 `https://timomo.store`，全站启用 HSTS。
服务端 Node.js 24+（服务器使用内置 node:sqlite），根目录运行：

```sh
npm install
npm run dev
```

- 客户业务端：http://localhost:5173 —— 商品、采购、销售、流水。
- API：http://localhost:3000/api/health。
- `npm run dev:admin`：原管理看板 http://localhost:5174。
- `npm run dev:web` / `npm run dev:server`：分别启动。
- `npm run build`：统一构建。
- `npm run start:server`：运行编译后的服务器。

数据库在 apps/server/data/gearflow.sqlite（不提交版本库），可通过 GEARFLOW_DB_PATH 覆盖。
客户开发端通过 Vite 转发 /api，可用 GEARFLOW_API_TARGET 覆盖代理目标。

## 操作体验

1. 商品页新建商品，初始库存为 0。
2. 点击入库，填供应商与数量，确认后库存增加。
3. 点击出库，填客户与数量；库存不足会被拒绝。
4. 采购、销售页面查看单据，库存流水查看变动。刷新、重启数据保留。
5. 支持搜索、分类和库存状态过滤、导出 CSV。

初始商品、业务单据、员工和装机服务为演示数据；本地单工作区登录已完成。阿里云 ECS 部署见 `infra/README.md`，正式上线前仍需配置 HTTPS、备份、角色权限和企业隔离。
详细架构见 docs/architecture.md。

## 验证

```sh
npm run test:server
npm run test:e2e
```

浏览器测试使用已安装的 Microsoft Edge，独立启动 3001 / 5175 端口。
测试数据库在 artifacts/e2e.sqlite，不影响正常业务数据；截图在 artifacts/。
编辑器打开 gearflow.code-workspace 按端管理。
