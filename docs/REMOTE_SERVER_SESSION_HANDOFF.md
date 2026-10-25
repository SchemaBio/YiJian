# SchemaBio SaaS 远端连接、认证与开发交接

核对日期：**2026-10-25，Asia/Shanghai**。本文替代此前 2026-10-08 的版本。
主机、服务和仓库状态均已重新只读核实；新对话开始时仍需核对现场状态。
本文只记录凭据位置和使用方式，不保存私钥、密码、令牌、完整 DSN 或签名链接。

## 1. 新对话先读

本机工作区为 `D:\WSL\Github\SchemaBio`，包括 YiJian（用户前端）、Squid（认证、组织、计费、云计算网关）、Octopus（样本、任务与结果）、Cuttlefish（管理控制台）、SepiLens（AI 引擎服务）、Sepiida（节点 Agent/进度服务）和 Schema_CPU（工作流及计算镜像）。

本次 HPO 生产计费已经部署。**本地代码现已提交但未 push；远端仓库仍是旧基准，运行镜像含精确源码 overlay。不要从远端旧 HEAD 直接重建，否则会丢失本次更新。**

进一步资料：

- `YiJian/docs/AI_ASSISTANCE_FRONTEND_HANDOFF.md`：AI 入口与确认流程。
- `Octopus/docs/SEPILENS_INTEGRATION.md`：服务端请求生命周期、计费及部署顺序。
- `YiJian/.gotmp/hpo-production-20261025-deployment.md`：本次部署记录。
- `YiJian/.gotmp/remote-server-handoff.md`：历史运维流水，只按末尾日期理解；开头重置说明和早期任务/域名不能当作当前状态。

`.gotmp` 是本机忽略目录，不保证新 clone 后存在；本文件已纳入 Git，可独立用于新对话交接。

## 2. SSH 连接与主机认证

| 项目 | 当前值 |
| --- | --- |
| 主机 IP | `106.53.190.244` |
| SSH 端口 | `53729` |
| 用户 | `ubuntu` |
| 本地登录私钥 | `D:\WSL\Github\SchemaBio\ssh-login-key` |
| 已验证辅助程序 | `D:\WSL\Github\SchemaBio\Squid\.gotmp\live-node-diagnostic\ssh.exe` |
| 已有 SSH 别名 | `schema-bio-remote`，使用前核对本机配置 |
| 主机密钥记录 | `C:\Users\pzweu\.ssh\known_hosts`，不关闭主机身份校验 |

当前实际使用的 PowerShell 命令：

```powershell
& 'D:/WSL/Github/SchemaBio/Squid/.gotmp/live-node-diagnostic/ssh.exe' `
  -host '106.53.190.244:53729' `
  -user ubuntu `
  -key 'D:/WSL/Github/SchemaBio/ssh-login-key' `
  -command 'hostname'
```

运行本地准备好的远端只读脚本：

```powershell
& 'D:/WSL/Github/SchemaBio/Squid/.gotmp/live-node-diagnostic/ssh.exe' `
  -host '106.53.190.244:53729' `
  -user ubuntu `
  -key 'D:/WSL/Github/SchemaBio/ssh-login-key' `
  -command 'sudo -n python3 -' `
  -stdin-file 'D:/WSL/Github/SchemaBio/YiJian/.gotmp/your-readonly-script.py'
```

辅助程序的端口放在 `-host` 内，不使用标准 OpenSSH 参数。`sudo -n` 已用于受保护配置、Docker 和备份操作。该程序的 stdin-file 传输可能发生中文编码转换：优先让传输脚本仅含 ASCII，非 ASCII 数据用 UTF-8 后 base64 传输，不能把密码作为命令行参数。

标准 OpenSSH 备用方式：

```powershell
ssh.exe -p 53729 -i 'D:/WSL/Github/SchemaBio/ssh-login-key' ubuntu@106.53.190.244
```

私钥 ACL 过宽会导致 Windows OpenSSH 拒绝使用，应核实文件 ACL，而不是更换远端认证或关闭主机校验。辅助程序和密钥都不是仓库分发文件，不读取或复制私钥内容。

计算节点密钥另为 `D:\WSL\Github\SchemaBio\Schema_CPU\Schema_Job_Key.pem`；只有从当前 task/attempt 和云端确认实例身份后才连接，不复用历史临时 IP。

## 3. 公共入口及应用认证

| 服务 | 当前入口 | 认证方式与凭据位置 |
| --- | --- | --- |
| YiJian | `https://yijian.schema-bio.com/login` | Squid 用户邮箱/密码；API `POST /api/v1/auth/login`，JSON `email`、`password` |
| Cuttlefish | `https://cuttlefish-dev.schema-bio.com/` | 首页登录；API `POST /api/auth/login`，JSON `username`、`password` |
| Octopus | `https://yijian.schema-bio.com/api/v1/octopus` | 经 Squid 使用当前用户认证及组织上下文，没有独立浏览器登录页 |
| Sepiida | `https://sepiida-dev.schema-bio.com` | 查询 API 用 Bearer query key；Agent 回调用当前执行的任务令牌 |
| SepiLens | 内网 `http://sepilens:8080` | 专用服务 Bearer token，不发布公网端口 |

以上 YiJian/Cuttlefish 页面及 Sepiida `/health` 已验证 HTTP 200。不要用旧 `cuttlefish.schema-bio.com`、旧 `sepiida.schema-bio.com` 来判断当前服务是否可用。

### YiJian / Squid

- 正常用户以数据库中的实际密码为准。部署 `.env` 中 `PLATFORM_ADMIN_EMAIL/PASSWORD` 映射到 Squid 容器 `DEFAULT_ADMIN_EMAIL/PASSWORD`，用于既有管理员验证的凭据来源；不能假定初始化密码永远等于数据库密码，不为验收重置密码。
- 浏览器使用 HttpOnly `access_token`、`refresh_token` Cookie。Cookie 写请求按现有中间件携带 `csrf_token` Cookie 对应的 `X-CSRF-Token`。
- 受控 API 脚本可正常登录后在内存中使用返回的 `access_token`，请求头为 `Authorization: Bearer ...`，完成后退出登录。不要把令牌打印到输出或浏览器持久存储。
- 任务地址例：`/api/v1/octopus/tasks/<uuid>`；代理前缀后不能再插入 `/v1`。

### Cuttlefish

- 控制台首先校验容器中的 `CUTTLEFISH_ADMIN_USERNAME`、`CUTTLEFISH_ADMIN_PASSWORD`，再通过 `SQUID_ADMIN_EMAIL`、`SQUID_ADMIN_PASSWORD` 向 Squid 登录；上游账号须为已激活的 `PLATFORM_ADMIN`。
- 两组凭据是独立配置，不能假定与 YiJian 登录值相同。凭据来自部署配置/运行环境，验证脚本只在远端进程内使用。
- 浏览器持有独立 `cuttlefish_session` HttpOnly Cookie；管理写请求附带登录响应中的 CSRF token，头名 `x-cuttlefish-csrf`，并遵守 Origin 校验。
- `CUTTLEFISH_SESSION_SECRET` 用于会话保护；持久会话及上游令牌由服务管理。不能将 YiJian Cookie 作为管理台会话，也不能通过直接写数据库绕过管理员接口。

### 服务间与数据库认证

- Octopus → Squid overlay 使用 `OVERLAY_SHARED_SECRET`，与浏览器 JWT 不同；AI 计费接口为 `/api/v1/overlay/ai/reserve|settle|refund`。
- Octopus → Sepiida 当前内网地址为 `http://sepiida-20260829-sepiida-1:9090`，查询凭据为 `SEPIIDA_QUERY_KEY`。查询 key 文件存在于 `/root/sepiida-20260829/secrets/query-keys-20260829.txt`；Agent 的 per-task token 不得替换为查询密钥。
- Octopus → SepiLens 使用 `AI_ASSISTANCE_BASE_URL=http://sepilens:8080` 和 `AI_ASSISTANCE_TOKEN_FILE`；实际服务 token 在 `/home/ubuntu/schema/saas-deploy/secrets/sepilens/service.token`。`AI_ASSISTANCE_MASTER_KEY_FILE` 保护持久化 AI 配置/输入，密钥不可重新随机生成或丢失。
- SepiLens 为独立容器，`AI_ASSISTANCE_MANAGED_PROCESS=false`。不要套用旧版 Octopus+SepiLens 组合镜像方案。
- 业务 PostgreSQL 连接由运行环境 `DB_DSN` 提供，读取时保留 TLS、CA 和 `search_path`。运行时路径须按容器挂载映射到宿主机，不输出完整 DSN。
- 备份使用 PostgreSQL 18 客户端，按实际应用 schema 导出；宿主机较旧 pg_dump 不兼容。隔离 Go 测试的 `AI_ASSISTANCE_TEST_DSN` 使用 keyword DSN，例如 `host=127.0.0.1 port=<测试端口> user=<测试用户> password=<测试密码> dbname=<测试库> sslmode=disable`，不得使用线上库。
- Cloudflare Tunnel 是入口保护层，服务自身鉴权仍必须执行。不要为诊断开放后端公网端口、关闭代理信任校验或放宽 Cloudflare 规则；节点认证头也不能放入 URL 或普通日志。

## 4. 生产目录与编排

| 路径 | 用途 |
| --- | --- |
| `/home/ubuntu/schema/{YiJian,Octopus,Squid,Cuttlefish,SepiLens,Sepiida}` | 远端源码仓库 |
| `/home/ubuntu/schema/saas-deploy/compose.yaml` | SaaS 主 Compose，含独立 SepiLens |
| `/home/ubuntu/schema/Octopus/deploy/saas-parquet-query.override.yaml` | 必须一起使用的覆盖配置 |
| `/home/ubuntu/schema/saas-deploy/.env` | 生产配置、镜像引用及部分凭据，保留权限和所有权 |
| `/home/ubuntu/schema/saas-deploy/secrets/` | 挂载的受保护服务密钥 |
| `/home/ubuntu/schema/saas-deploy/nginx.conf` | SaaS 网关路由 |
| `/home/ubuntu/schema/backups/` | 发布备份、源码、测试/验收证据与回滚脚本 |
| `/root/sepiida-20260829/docker-compose.yml` | 独立 Sepiida 服务编排 |
| `/root/sepiida-20260829/.env.20260829` | Sepiida 的受保护环境配置 |

SaaS 使用两份配置，不追加已退役的 `trio-test.override.yaml`：

```bash
cd /home/ubuntu/schema/saas-deploy
docker compose --project-name schemabio-saas \
  --env-file /home/ubuntu/schema/saas-deploy/.env \
  -f compose.yaml \
  -f ../Octopus/deploy/saas-parquet-query.override.yaml ps

docker ps --format '{{.Names}} {{.Image}} {{.Status}}'
curl -fsS http://127.0.0.1:8080/gateway-health
curl -fsS http://127.0.0.1:8082/gateway-health
```

主要容器为 `schemabio-saas-{squid,octopus,yijian,cuttlefish,sepilens,gateway}-1`；Sepiida 为 `sepiida-20260829-sepiida-1`。应用容器未单独绑定宿主机端口，入口由网关及 Tunnel 提供。不要输出完整 `docker inspect`、`docker compose config`、`.env` 或敏感日志；只提取白名单字段。

构建应使用独立源码快照，后台运行并写保护日志；切换时只重建受影响服务，使用 `up -d --no-deps --no-build <service>`。新容器健康后检查并重载网关：

```bash
docker exec schemabio-saas-gateway-1 nginx -t
docker exec schemabio-saas-gateway-1 nginx -s reload
```

## 5. 当前部署、源码与本地提交

四个 SaaS 镜像均为 `schemabio/<服务名>:hpo-production-20261025t082212z`，已健康部署。镜像构建时未提交，所以 revision 标签记录旧基准；最终源码身份由 `io.schemabio.source.sha256` 标签与备份清单共同确定，`io.schemabio.source.dirty=true` 是本次发布的预期标记。

| 仓库 | 远端干净 HEAD（部署基准） | 本次本地提交 |
| --- | --- | --- |
| Squid | `cce76dc` | `7af73ca` |
| Octopus | `429212d` | `e6efb21` |
| Cuttlefish | `adeba2d` | `5cf0991` |
| YiJian | `f7ba0db` | 包含本文的本地提交，用 `git log -1 --oneline` 查看 |

远端 YiJian/Octopus/Sepiida 在 `codex/sepilens-refresh-20261024t121356z`；Squid/Cuttlefish 在 `codex/saas-refresh-20261023t155935z`；SepiLens 在 `main`。本地四个仓库本次提交在 `main`，本对话未 push。后续用户 push 后，再检查远端分支、上游差异和工作区，进行受控快进同步，不能 `reset --hard` 或丢弃历史保留的补丁/stash。

其余镜像：SepiLens `schemabio/sepilens:github-cdb6d73-20261025t031442z`；Sepiida `schemabio/sepiida-server:sepilens-refresh-20261024t121356z`；官网 `schemabio/schema-website:commit-5d91240-20261022t065902z`，本次均未替换。

远端 GitHub 拉取使用各仓库现有认证。Cuttlefish 配有自己的 `core.sshCommand`，使用 `/home/ubuntu/.ssh/github.cuttlefish`；保留此配置。Git 操作使用原部署用户 ubuntu，不覆盖为通用 SSH key，不输出私钥内容，避免 root 操作破坏仓库文件所有权。

## 6. 本次功能、验证与回滚

SaaS 临床信息 HPO AI 每次预扣 1 积分，用户确认后调用；可勾选“本次浏览器会话不再提示”，sessionStorage 按用户/组织隔离，跳过提示仍携带扣费确认。读取已保存候选及本地术语匹配免费；失败、取消、降级等按已有终态规则退款，重复请求幂等。新前端要求 HPO capability.billingEnabled=true 才开放操作。

HPO 独立于 `AI_ASSISTANCE_BILLING_ENABLED`，当前该全局开关仍为 false，只控制其他正式 AI 收费；SVC 实验仍不计费。自部署不收平台积分。发布顺序为 Squid → Octopus → YiJian，Cuttlefish 同步更新说明，无新增数据库迁移。

服务器隔离 PostgreSQL 回归通过：Octopus assistance 全包及 Squid AI 并发扣费/结算/退款；YiJian 38 项、Cuttlefish 8 项相关测试与两个前端生产构建通过。线上正常认证、HPO 计费能力、公开页面、管理接口、匿名拒绝及生产文案验证通过；未调用真实付费模型。

最新保护备份：

```text
/home/ubuntu/schema/backups/hpo-production-20261025T082212Z
```

包含两个业务库的 PostgreSQL 18 scoped dumps、原环境/编排、旧镜像身份、基准 Git archive、完整部署源码、`source-manifests.json`、构建/测试日志、`baseline.json`、`result.json`、独立验收记录和 `rollback.py`。本次临时测试数据库已清理，旧运行镜像保留。

仅在用户授权回滚时执行：

```bash
sudo python3 /home/ubuntu/schema/backups/hpo-production-20261025T082212Z/rollback.py
```

脚本恢复原镜像配置并依次重建四个服务，保留业务数据库和数据。不要重跑一次性 `release.py`，不要为应用回滚直接恢复数据库 dump。较早 `hpo-production-20261025T081934Z` 是切换前测试脚本失败记录，最终成功以 `082212Z/result.json` 为准。

## 7. 新对话的约束与待办

- 不再清空数据库，不删除现有公测数据，不为验收启动付费任务或模型，不擅自调整历史账务。默认任务倍率 2、VCF 注释每次预扣 50 积分保持。
- 云计算基础镜像仍为 `img-6vhs05ik`。此前 Sepiida gzip Agent 修复尚未烘焙到默认计算镜像；不能把服务端已更新当作未来 Agent 已更新。
- Stripe 仅预留接口/配置，未开放收款。注册邮件/Turnstile 不能因本次 AI 部署而视为已配置；启用注册前重新核实。
- 用户提出的新用户默认样本/FASTQ/完成任务模板组织方案尚未实现，不能当作现有功能。
- 结果交互使用浏览器 Parquet 本地计算，人工调整由服务端保存；不要恢复过时的页面服务端查询方案。
- 当前可只读验证的历史任务为 `8f7cd22b-c171-4cdb-97e6-d5802964560f`：导入成功，SNP/InDel 43,592 行。2026-10-20 重置前的旧任务已失效，不从旧交接文档复制它们验收。
- 本次部署前后账本、余额、账户激活状态、任务数及模型/计算/计费配置保持；继续工作前采用新鲜基线，不用旧余额常量推断或修改账务。

可复制给新对话：

> 请先阅读 `D:/WSL/Github/SchemaBio/YiJian/docs/REMOTE_SERVER_SESSION_HANDOFF.md`，按本文连接远端并只读核实服务与仓库状态。本次 HPO 1 积分计费已部署，本地已提交、尚未 push，远端仓库仍是旧基准，不能直接从旧 HEAD 重建。保留现有测试数据、默认倍率 2、VCF 预扣 50 及当前服务密钥，不调用付费任务验收、不修改历史账务，不自动 push。然后继续处理我接下来指定的开发工作。
