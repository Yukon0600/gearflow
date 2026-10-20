# 鸿蒙客户端（HarmonyOS NEXT / ArkTS）

原生 ArkTS 工程，Stage 模型，两个页面：登录、库存列表。

## 环境

- DevEco Studio 5.0 及以上
- HarmonyOS SDK 5.0.0(12) 及以上
- 需要真机或模拟器运行，签名在 DevEco 里自动完成

## 打开与运行

1. DevEco Studio → `File → Open` → 选择 `apps/harmony` 目录；
2. 等待 Sync 完成（首次会下载 hvigor 依赖）；
3. `File → Project Structure → Signing Configs` 勾选 Automatic，登录华为账号生成调试签名；
4. 选择设备，点击 Run。

命令行构建（需先配好签名与 `hdc`）：

```bash
hvigorw assembleHap --mode module -p product=default
```

## 目录

```
apps/harmony
├── AppScope/app.json5              # 应用级配置：bundleName、版本、图标
├── build-profile.json5             # SDK 版本与产物配置
├── entry/src/main/module.json5     # 模块与 Ability、Internet 权限
└── entry/src/main/ets
    ├── entryability/EntryAbility.ets  # 启动入口，加载 pages/Login
    ├── common/Api.ets                 # HTTP 封装，Bearer token
    └── pages
        ├── Login.ets                  # 账号密码登录
        └── Stock.ets                  # 库存列表、搜索、刷新、退出
```

## 后端地址

`entry/src/main/ets/common/Api.ets` 里的 `BASE_URL`：

- 正式：`https://timomo.store`
- 调试（域名被备案拦截期间）：`https://182.92.126.12`

鸿蒙的 `http` 模块默认会校验证书链，用 IP 访问会报证书不匹配，调试时可以在 `HttpRequestOptions` 里加
`caPath` 或改用系统信任的域名。**正式环境一律用域名。**

## 接口

与小程序共用：

```
POST /api/auth/login   → { user, token, expiresIn }
GET  /api/mobile/stock → { updatedAt, total, lowCount, products[] }
```

请求头带 `Authorization: Bearer <token>`。
