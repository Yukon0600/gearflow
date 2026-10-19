# 部署配置

# 阿里云 ECS 部署

需要 Ubuntu 22.04/24.04、Docker Engine + Compose plugin，以及安全组开放 TCP 80；SSH 只开放给你的固定 IP。域名和 HTTPS 建议使用阿里云 SSL 证书 + Nginx/Caddy，配置完成后将 `GEARFLOW_SECURE_COOKIE=1`。

## 域名解析（timomo.store）

域名在西部数码，DNS 服务器为 `ns5.myhostadmin.net` / `ns6.myhostadmin.net`，直接在其「域名解析」里加记录即可，不要改 NS：

| 记录类型 | 主机记录 | 记录值 | TTL |
| --- | --- | --- | --- |
| A | `@` | `182.92.126.12` | 600 |
| A | `www` | `182.92.126.12` | 600 |

同一主机名下不要再留西部数码默认的 parking/URL 转发记录，`@` 上也不能同时有 CNAME。解析生效后访问 `http://timomo.store/`，`/api/health` 应返回正常；ECS 安全组需放行 TCP 80（HTTPS 再放行 443），大陆地域的 80/443 还需域名已完成 ICP 备案。

## 备案

ECS 在华北2（北京），属于大陆地域：域名对外提供网站服务（80/443）前必须完成 ICP 备案，未备案时阿里云会拦截并返回备案提示页。备案走 `beian.aliyun.com`「首次备案」，主体性质按实际情况选「个人」或「企业 / 个体工商户」，接入填该 ECS 实例即可，阿里云初审 1–2 个工作日、管局 3–7 个工作日，整体约 2–3 周，期间解析可以保持不动。备案省份按主体证件地址决定，与服务器地域无关。

有三点容易卡住：

- 备案主体必须与域名持有者一致。域名当前持有者为个人（邹小宇）：走**个人备案正好一致，无需过户**；若改用公司或个体工商户主体，需先在西部数码做「模板过户」。
- 个人备案只能是非经营性个人网站，网站名称不能含「企业」「管理」「系统」「平台」「商城」等词。本系统若对外提供服务，应改用单位主体备案，或部署到香港节点（免备案）。
- 网站名称不能用「中国」「国家」「XX网」等词；备案号下发后要在页脚展示并链接 `beian.miit.gov.cn`，30 日内再做公安联网备案。

未备案期间做功能验收，可临时让 Nginx 再监听 8080 并用 `http://服务器IP:8080/` 访问，或在服务器本机 `curl 127.0.0.1` 验证，避免长时间占用 80 端口做对外演示。

## 首次部署

```bash
git clone <你的仓库地址> gearflow
cd gearflow
cp infra/.env.example infra/.env
nano infra/.env                         # 设置 GEARFLOW_ADMIN_PASSWORD
npm run build --workspace=@gearflow/server
docker compose -f infra/docker-compose.yml up -d --build
curl http://127.0.0.1/api/health
```

浏览器访问 `http://服务器公网IP/`。前端容器由 Nginx 提供静态页面，并把 `/api` 转发到内部 server；3000 端口不暴露公网。SQLite 位于 Docker volume `gearflow-data`，容器重建不会丢失。

后续更新：`git pull && npm run build --workspace=@gearflow/server && docker compose -f infra/docker-compose.yml up -d --build`。备份：`bash infra/backup.sh`，备份文件在 `backups/`，请再复制到阿里云 OSS 或其他机器。查看日志：`docker compose -f infra/docker-compose.yml logs -f --tail=200 server web`。

也可以直接运行 `bash infra/deploy.sh` 完成构建、启动和健康检查。不要把 `infra/.env`、数据库或备份提交到仓库。

## 线上环境记录（2026-10-19 部署）

| 项 | 值 |
| --- | --- |
| 访问地址 | `http://timomo.store/`、`http://182.92.126.12/` |
| 服务器 | 阿里云 ECS `iZ2zedvzyju598hvdqhb41Z`，华北2（北京），Alibaba Cloud Linux 3，2 vCPU / 2 GB |
| 代码路径 | `/opt/gearflow`（tar 包解压，非 git 仓库） |
| 运行时 | Docker 26.1.3 + Compose v2.27.0，数据卷 `gearflow-data` |
| 端口 | 宿主机 80 / 443 / 8080 映射到容器 80 / 443 / 8080；安全组放通 80、443 |
| 内存 | 额外 2 GB `/swapfile`，已写入 `/etc/fstab` |
| 生产 compose | `infra/docker-compose.prod.yml`（预构建前端 + HTTPS + 证书挂载） |

这台机器有几个环境限制，重新部署时要注意：

- Docker Hub 直连不通，`/etc/docker/daemon.json` 配了 `registry-mirrors`（daocloud、1ms.run、dockerproxy），否则 build 会卡在 `registry-1.docker.io` 超时。
- 2 GB 内存跑不动 `npm ci + vite build`，所以 web 用 `infra/Dockerfile.web.prebuilt` 直接拷贝本机构建好的 `apps/customer-web/dist`；server 的 `npm ci --omit=dev` 已加 `--registry=https://registry.npmmirror.com`。
- 更新代码时不要在服务器上重新构建前端，本地 `npm run build --workspace=@gearflow/customer-web` 后只传 `dist` 即可。

首次启动会自动写入演示数据（36 个商品、24 笔销售），要空库上线就 `docker compose -f infra/docker-compose.yml down -v` 后重新 `up -d`。

## HTTPS

证书是 Let's Encrypt 的 ECC 证书（`timomo.store` + `www.timomo.store`），用 acme.sh 签发，安装在 `/opt/gearflow/certs`（`fullchain.pem` / `privkey.pem`），由 `docker-compose.prod.yml` 挂到容器 `/etc/nginx/certs`。

签发时 80 端口已被阿里云备案拦截（返回 `403 Beaver`），HTTP-01 验证走不通，所以用 **TLS-ALPN-01 在 443 上验证**：

```bash
/root/.acme.sh/acme.sh --issue --alpn -d timomo.store -d www.timomo.store --server letsencrypt
```

续期由 acme.sh 的 cron 触发（每天 5、11、17、23 点）。因为 ALPN 需要独占 443，续期配置里带了前后钩子：先 `docker stop infra-web-1`，验证完 `docker start infra-web-1`，再用 `nginx -s reload` 加载新证书。这三条写在 `/root/.acme.sh/timomo.store_ecc/timomo.store.conf` 的 `Le_PreHook` / `Le_PostHook` / `Le_ReloadCmd` 里，手工改过就别再执行 `--install-cert`，否则会被覆盖。

**备案通过后要补两件事**（现在域名 80/443 都被备案策略拦着，所以暂时关着）：

1. `infra/.env` 里 `GEARFLOW_SECURE_COOKIE=1`，登录 Cookie 才会带 `Secure`；
2. [infra/nginx.https.conf](nginx.https.conf) 里放开那行 `return 301 https://$host$request_uri;`，80 强制跳 HTTPS。

改完 `docker compose -f infra/docker-compose.prod.yml up -d --build` 生效。
