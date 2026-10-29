# 小程序 / 移动端（uni-app）

一套 Vue 3 代码，编译到微信小程序、App（Android / iOS）和 H5。四个标签页 + 登录、商品详情、开单。

## 页面

| 页面 | 说明 |
| --- | --- |
| `pages/login/login` | 账号密码登录，token 存本地缓存，8 小时有效 |
| `pages/index/index` | **工作台**：库存总值、今日出入库/单据、功能宫格、库存预警、最近动态 |
| `pages/stock/stock` | **库存**：左侧分类栏 + 右侧商品分区列表，双向联动；支持搜索、下拉刷新、扫码定位 |
| `pages/stock/detail` | 商品详情：库存进度条、属性四宫格、**该商品最近出入库**、底部固定入库/出库按钮 |
| `pages/order/order` | 开单：五种类型（采购入库/销售出库/销售退货/采购退货/报损）、数量步进、单价、往来单位、备注、实时合计；店员提交进入待审批，店长/管理员提交直接生效 |
| `pages/orders/orders` | **单据中心**：待审批/已生效/已驳回/全部筛选、搜索、分页；点击卡片进详情 |
| `pages/order-detail/order-detail` | 单据详情：完整明细、提交→审批时间线、驳回原因 |
| `pages/stocktake/stocktake` | **库存盘点**：搜索/扫码定位、输实盘数、只提交有差异的行，确认后库存原子更新 |
| `pages/partners/partners` | **应收应付**：应收/应付合计与明细（单据金额/退货冲减/已结），店长及以上可登记收付款（现金/微信/支付宝/银行） |
| `pages/drafts/drafts` | **草稿箱**：草稿列表、继续开单、直接记账；开单页可「存草稿」/更新草稿 |
| `pages/reports/reports` | **经营速览**（店长/管理员）：销售额+环比、毛利/客单价/库存/周转、热销、滞销占用、客户排行 |
| `pages/flow/flow` | 库存流水：全部/入库/出库筛选，单据号、往来单位、变动与结存 |
| `pages/mine/mine` | 我的：账号、服务地址、接口状态、版本、退出登录 |

底部是微信原生 tabBar（`pages.json` 的 `tabBar` 配置 + `src/static/tabbar/*.png` 图标），
注意 tabBar 页面之间必须用 `uni.switchTab`，用 `reLaunch` 会失败。

## 开发与构建

```bash
cd apps/uni-mobile
npm install
npm run build:mp-weixin      # 产物 dist/build/mp-weixin
npm run build:h5             # 产物 dist/build/h5
```

微信小程序：

1. 打开「微信开发者工具」→ 导入项目；
2. 目录选 `apps/uni-mobile/dist/build/mp-weixin`；
3. AppID 已写进 `src/manifest.json`（`wx6ad6c7bb9c5927`），不用手填；
4. `详情 → 本地设置` 勾「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」。
   构建产物里 `project.config.json` 已内置 `urlCheck: false`，通常不用再手动勾。

## 审批与角色

- 登录后用户角色（`clerk`/`manager`/`admin`）存在本地缓存 `gf_role`，退出登录时清除。
- 店员提交的单据进入「待审批」，店长/管理员提交的直接生效（服务端规则）。
- 单据中心只对店长/管理员显示「通过/驳回」按钮；工作台有新的待审批单据时会弹提醒条并在「单据中心」图标上加红色角标。

## 疑难排查

- 构建时报 `fatal error: winmm.dll not found`：旧版 esbuild（0.20.2 自带 Go 运行时）对系统环境敏感，
  把 `esbuild` 升到 0.21+ 即可（与 vite 5.3 的官方搭配一致）：
  在 `apps/uni-mobile/package.json` 加 `"overrides": { "esbuild": "0.21.3" }` 后重新 `npm install`。

## 后端地址

`src/config.js`：

- 默认 `https://182.92.126.12`（备案审核期，域名被拦截）
- 备案通过后改成 `https://timomo.store`
- 临时指向别的地址不用改文件，构建前设环境变量：

```powershell
$env:VITE_API_BASE='http://127.0.0.1:3992'; npm run build:h5
```

正式发布前要在微信公众平台把域名加入「request 合法域名」。

## 接口

移动端专用（都是 Bearer token 认证，与网页端共用 sessions 表）：

```
POST /api/auth/login          → { user, token, expiresIn }
GET  /api/mobile/summary      → 库存总值、今日出入库、库存预警前 5 条、最近 8 条流水
GET  /api/mobile/stock        → 商品列表 + 分类聚合（含每类数量与低库存数）
GET  /api/mobile/product/:id  → 单品详情 + 该商品最近流水
GET  /api/mobile/movements    → 最近流水（?limit=60）
POST /api/orders              → 开单（入库 purchase / 出库 sale）
GET  /api/orders              → 单据分页（?status=pending|posted|rejected|all&q=&page=&size=）
GET  /api/drafts              → 草稿列表（采购/销售）
POST /api/drafts              → 存草稿 / PATCH /api/drafts/:id 更新 / POST /api/drafts/:id/post 记账
GET  /api/reconcile           → 应收应付汇总（每家余额：单据-退货-已结）
GET/POST /api/payments        → 收付款流水 / 登记收付款（店长+，不能超额）
GET  /api/reports/overview    → 经营报表（?days=7|30|90：销售额/毛利/热销/滞销/周转/环比）
POST /api/stocktakes          → 提交盘点（服务端校验账面数，库存变动则拒绝）
POST /api/orders/:id/approve  → 审批通过（店长/管理员）
POST /api/orders/:id/reject   → 审批驳回（{ reason }，店长/管理员）
```

## 登录预填（仅本地）

演示时不想每次输密码，可以放一个**本地凭据文件**（已被 `.gitignore` 忽略，不会进仓库）：

```
artifacts/dev-login.txt     内容一行：admin|你的密码
```

`scripts/build-mini.ps1` 会读取它，通过构建期常量注入登录页默认值；没有这个文件就不预填。
源码里不含任何密码，仓库里也查不到。

另外登录页有「记住密码」开关（默认开），首次登录成功后会保存在设备本地，下次打开自动登录。
上线或提交体验版之前，删掉 `artifacts/dev-login.txt` 重新构建一次，避免把密码打进包里。

## 界面自查（不需要真机）

把 H5 版本跑起来，用 Playwright 截图，能直接看到真实渲染效果：

```powershell
# 1. 本地起一个后端（带 CORS 与临时库）
$env:GEARFLOW_CORS_ORIGIN='http://127.0.0.1:5000'
$env:GEARFLOW_DB_PATH="$env:TEMP\gf-h5.sqlite"
node apps/server/dist/main.js      # PORT=3992

# 2. 构建 H5 指向本地后端
$env:VITE_API_BASE='http://127.0.0.1:3992'; npm run build:h5

# 3. 静态服务 + 截图
python -m http.server 5000 --directory apps/uni-mobile/dist/build/h5
node scripts/shot-h5.cjs           # 输出 artifacts/h5-0*.png
```

`GEARFLOW_CORS_ORIGIN` 只在本地联调时设置，生产环境不设置就不会下发任何跨域头。
