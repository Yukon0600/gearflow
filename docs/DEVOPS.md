# DevOps 实践说明

本系统把一个本地开发的进销存应用，做成"提交即验证、一条命令发布、故障自愈、数据可回滚"的完整交付链路。本文用于说明各环节的职责、实现方式与演示步骤，可直接作为论文中"系统部署与运维"章节的素材。

## 总体链路

```
开发者提交 → Git 仓库 → CI（构建 + 单元测试 + 前端产物）
                              ↓
                 发布（GitHub Actions 手动触发 / 本地 release.ps1）
                              ↓
          打包 tar → scp 上传 → docker compose 滚动重建 → 健康检查
                              ↓
        运行期：健康巡检（5 分钟）+ 自动重启 + 每日备份 + 证书自动续期
```

## 各环节

| 环节 | 实现 | 关键文件 |
| --- | --- | --- |
| 版本管理 | Git，忽略依赖/产物/密钥/数据库 | `.gitignore` |
| 持续集成 | GitHub Actions：`npm ci` → 编译后端 → 6 个单元测试 → 构建前端 → 上传产物 | `.github/workflows/ci.yml` |
| 持续部署 | 手动触发的 Actions 工作流，SSH 上传并滚动重建 | `.github/workflows/deploy.yml` |
| 本地一键发布 | PowerShell 脚本，含测试门禁与冒烟验证 | `scripts/release.ps1` |
| 容器化 | 前后端分离两个容器，Nginx 提供静态页并反代 `/api` | `infra/docker-compose.prod.yml` |
| 健康巡检 | 每 5 分钟探测 `/api/health`，连续 3 次失败自动重启容器 | `infra/ops/healthcheck.sh` |
| 数据备份 | 每日 3:10 用 SQLite `VACUUM INTO` 做在线快照，保留 14 天 | `infra/ops/backup.sh` |
| HTTPS | acme.sh + Let's Encrypt，TLS-ALPN 验证，自动续期并热加载 | `infra/nginx.https.conf` |
| 镜像源加速 | Docker Hub 与 npm 均配置国内镜像，构建不再等待超时 | `/etc/docker/daemon.json` |

## 为什么这样选

- **CI 与 CD 分离**：提交自动跑测试，但发布要人点一下。学生项目没有值班机制，自动发布一旦出错没人兜底。
- **滚动重建而不是原地替换**：`docker compose up -d --build` 会先起新容器再加入流量，旧容器保留到新容器健康，服务不中断。
- **健康检查做成两级**：容器级 `healthcheck` 决定启动顺序，主机级 `healthcheck.sh` 负责运行期自愈。
- **备份用 `VACUUM INTO`**：SQLite 直接复制文件可能拿到写入一半的库，`VACUUM INTO` 生成一致性快照，不需要停机。

## 答辩演示步骤

1. 改一行前端文案，`git commit`；
2. 打开 Actions 页面，展示 CI 流水线由红转绿（构建 + 测试）；
3. 本地执行 `powershell -ExecutionPolicy Bypass -File scripts\release.ps1`，展示"测试 → 构建 → 上传 → 发布 → 冒烟"七个阶段；
4. 浏览器刷新，页面已更新；
5. 演示自愈：`docker stop infra-server-1`，等 5 分钟，巡检自动拉起；
6. 演示备份：`sudo /opt/gearflow/infra/ops/backup.sh`，`ls -lh /opt/gearflow/backups/`。

## 回滚

镜像按构建缓存保留，回滚有两级：

```bash
# 只回滚代码：重新检出上一个提交，再执行 release
git checkout <上一个提交> && powershell -ExecutionPolicy Bypass -File scripts\release.ps1

# 只回滚数据：停服务，用备份覆盖卷内数据库，再启动
docker compose -f infra/docker-compose.prod.yml stop server
docker cp backups/gearflow-<时间戳>.sqlite infra-server-1:/data/gearflow.sqlite
docker compose -f infra/docker-compose.prod.yml start server
```

## 接入远程仓库

本地仓库已初始化（分支 `main`），推到 GitHub 或 Gitee 后 CI 就会自动跑：

```bash
git remote add origin git@github.com:<账号>/gearflow.git   # 或 https://gitee.com/<账号>/gearflow.git
git push -u origin main
```

推 GitHub 后要在 `Settings → Secrets and variables → Actions` 里加三个 secret，Deploy 流水线才能连服务器：

| Secret | 值 |
| --- | --- |
| `DEPLOY_SSH_KEY` | 部署私钥全文（本机 `artifacts/deploy_key`） |
| `DEPLOY_HOST` | `182.92.126.12` |
| `DEPLOY_USER` | `root` |

若改用 Gitee，`.github/workflows/*.yml` 不被识别，需要改写成 Gitee Go 的 `.workflow/*.yml` 格式，语法差别较大，二者不要混放。

## 已知局限

- CI 只覆盖后端单元测试，前端与端到端用例（Playwright）尚未进流水线，因为 runner 上装浏览器耗时较长；
- 备份只留在本机 `backups/`，未同步到 OSS，磁盘损坏会一起丢，后续可加 `ossutil cp` 到对象存储；
- 没有集中式日志与指标，排障仍靠 `docker logs`，规模再大就需要 Loki / Prometheus 这类组件；
- 发布靠 tar 包覆盖而非 git checkout，服务器上没有 `.git`，好处是省内存，代价是无法在服务器上 `git log` 追溯版本。
