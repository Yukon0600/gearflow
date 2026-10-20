# 小程序 / 移动端（uni-app）

一套 Vue 3 代码，编译到微信小程序、App（Android / iOS）和 H5。四个标签页 + 登录、商品详情、开单。

## 页面

| 页面 | 说明 |
| --- | --- |
| `pages/login/login` | 账号密码登录，token 存本地缓存，8 小时有效 |
| `pages/index/index` | **工作台**：库存总值、今日出入库/单据、功能宫格、库存预警、最近动态 |
| `pages/stock/stock` | **库存**：左侧分类栏 + 右侧商品分区列表，双向联动；支持搜索、下拉刷新、扫码定位 |
| `pages/stock/detail` | 商品详情：库存进度条、属性四宫格、**该商品最近出入库**、底部固定入库/出库按钮 |
| `pages/order/order` | 开单：入库/出库切换、数量步进、单价、往来单位、备注、实时合计 |
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
