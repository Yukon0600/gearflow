# 小程序 / 移动端（uni-app）

一套 Vue 3 代码，编译到微信小程序、App（Android / iOS）和 H5。

## 页面

| 页面 | 说明 |
| --- | --- |
| `pages/login/login` | 账号密码登录，成功后把 token 存到本地缓存 |
| `pages/stock/stock` | 库存列表，支持搜索、下拉刷新、扫码按 SKU 过滤、低于阈值高亮 |
| `pages/stock/detail` | 单个商品详情（品牌、分类、单价、补货阈值） |

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
3. AppID 填自己的（`src/manifest.json` 的 `mp-weixin.appid` 也可以直接写死）；
4. `详情 → 本地设置` 勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」。

## 后端地址

在 `src/config.js` 里改 `BASE_URL`：

- 正式环境：`https://timomo.store`
- 备案审核期（域名被拦截）：临时改成 `https://182.92.126.12`

上线前记得在微信公众平台把域名加进 **request 合法域名**，否则真机请求会被拦。

## 认证方式

小程序没有浏览器 Cookie，服务端已支持 `Authorization: Bearer <token>`：

```
POST /api/auth/login   → { user, token, expiresIn }
GET  /api/mobile/stock → { updatedAt, total, lowCount, products[] }
```

token 与网页端共用同一张 `sessions` 表，有效期 8 小时，退出登录后服务端会删除会话。
