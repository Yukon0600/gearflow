# 测试说明

## 怎么跑

```bash
npm run test:server
```

等价于「先编译后端，再跑 `node --test apps/server/test/*.test.cjs`」。CI 里也是这一条，所以推送前本地跑通基本不会红。

## 两层测试

| 层 | 文件 | 覆盖方式 |
| --- | --- | --- |
| 单元测试 | `store.test.cjs`、`auth.test.cjs`、`workforce.test.cjs`、`mobile.test.cjs`、`permissions.test.cjs`、`audit-and-cost.test.cjs`、`order-types.test.cjs`、`pagination.test.cjs` | 直接调 Store / Auth 类，用临时 SQLite，快（毫秒级） |
| 功能测试 | `e2e.test.cjs` | **真的 spawn 一个服务进程**，全部走 HTTP，模拟用户操作 |

功能测试会自己挑端口（3900 + pid 取模）、建临时库、结束后杀进程并清理目录，可以和单元测试同批跑。

## 功能测试覆盖了什么

| # | 场景 | 断言要点 |
| --- | --- | --- |
| 1 | 健康检查 | `db: ok`、商品数 > 0、`X-Content-Type-Options` / `X-Frame-Options` 存在 |
| 2 | 认证 | 未登录 401、错密码 401、登录返回 token 与角色、`/me` 返回能力清单 |
| 3 | 商品 | 创建 201、重复 SKU 409、PATCH 只传 `threshold` 时其他字段不变 |
| 4 | 正向单据 | 采购 10 → 销售 3 → 库存 7、单号前缀 PO/SO |
| 5 | 库存保护 | 超卖 409 且库存回滚不变 |
| 6 | 逆向单据 | 退货入库、采购退货、报损各一单，库存 7→5，报表净额正确（用增量断言，避免受演示数据影响） |
| 7 | 分页 | 每页 2 条、第二页与第一页不重复、越界页返回空数组、流水方向过滤 |
| 8 | 审计 | 开单/新建商品/修改商品都有记录，且失败请求不入库 |
| 9 | 权限 | 店员可开单，改商品/报表/账号/日志全部 403 |
| 10 | 账号 | 改角色即时生效、改密码后旧 token 立刻失效、最后一个管理员不能降级或删除 |
| 11 | 退出 | logout 后 token 立即不可用 |

## 两个容易踩的坑

1. **审计是异步落库的**：记录写在响应 `finish` 之后，功能测试里查审计前要等等（约 300ms），否则会偶发查不到。
2. **演示数据会污染报表断言**：种子数据里带几十张单据，报表绝对值不能用硬编码，改用「操作前抓基线、断言增量」。

## 没覆盖的部分

- 前端：没有自动化 UI 测试，靠 Playwright 截图人工核对（`scripts/shot-h5.cjs`、`artifacts/shot-admin.cjs`）
- 小程序：只能编译产物后在微信开发者工具里手动验证
- 并发：没有压测，库存并发只靠 SQLite 的 `BEGIN IMMEDIATE` 事务保证
