# SchemaBio SaaS 远端连接、认证与开发交接

核对日期：**2026-10-25，Asia/Shanghai**。本文替代此前 2026-10-08 的版本。
主机、服务和仓库状态均已重新只读核实；新对话开始时仍需核对现场状态。
本文只记录凭据位置和使用方式，不保存私钥、密码、令牌、完整 DSN 或签名链接。

**2026-10-25 当前线上：Octopus / YiJian / SepiLens / Squid 均为 `svc-billing-confirmations-20261025t154057z`。ACMG 与 SVC v4 AI 服务均按每次 1 积分收费；HPO / ACMG / SVC 的本会话免提示选择分别记录。保留正式医学规则批准门禁、SVC 草案身份及此前 HPO、家系角色和缓存修复；CNV 开关未变。第 15–17 节修改已按仓库本地提交、未 push，用户自行测试，智能体不代发真实模型请求。旧 Git HEAD 不能直接重建。**

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

首次 HPO 发布时四个 SaaS 镜像均为 `schemabio/<服务名>:hpo-production-20261025t082212z`，已健康部署。镜像构建时未提交，所以 revision 标签记录旧基准；最终源码身份由 `io.schemabio.source.sha256` 标签与备份清单共同确定，`io.schemabio.source.dirty=true` 是本次发布的预期标记。

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

首次 HPO 发布保护备份（后续签名修复备份见第 8 节）：

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


## 8. 2026-10-25 HPO 积分接口签名修复

用户在样本管理调用 AI HPO 时出现“积分服务不可用，本次未生成结果。”。根因为 Octopus assistance 计费客户端仅发送 Bearer token，缺少 Squid Overlay 认证要求的 `X-Overlay-Timestamp` / `X-Overlay-Signature`。共享密钥一致；无签名请求被拒绝为 401 `invalid overlay signature`。

修复在计费专用 `CallOverlay` 中按 `HMAC-SHA256(secret, timestamp + "." + exact_JSON_body)` 签名，覆盖 reserve/settle/refund，普通 SepiLens 调用不附带 Overlay 签名。生命周期测试现在强制校验签名，新增三种计费操作协议测试和 SepiLens 隔离测试。

- 当前 Octopus 镜像：`schemabio/octopus:hpo-signature-20261025t085812z`，已 healthy，仅替换 Octopus 并检查、重载网关。
- 源码 SHA256：`eaef815076bfda84660c03c9a2e4e4a44bffb50d3c3130f318e5f85da5a363ed`。从首次发布完整源码快照叠加本次四个文件构建，保留此前全部功能。
- 本地 Octopus 的 `internal/assistance/{client.go,service.go,hpo_billing_test.go,client_overlay_test.go}` 为未提交修复；未 push，远端仓库 HEAD 仍为 `429212d`。镜像 revision 标签 `e6efb21` 是本地已提交基准，最终身份仍按源码摘要和清单判断。
- 保护备份：`/home/ubuntu/schema/backups/hpo-signature-20261025T085812Z`，含两库 PostgreSQL 18 scoped dumps、原部署环境、完整源码、清单、回归日志、认证探测、账务基线、结果及只回退 Octopus 的 `rollback.py`。回退须用户授权，不恢复业务库 dump。
- 服务器隔离 PostgreSQL 上 `go test ./internal/assistance -count=1` 全包通过。修复后的 Go 客户端向线上 Squid 的 reserve/settle/refund 发送空身份，均通过签名校验并在业务写入前返回 400；验证未创建真实计费请求或调用模型。
- 原有 4 条 `billing_unavailable` 请求均 `billing_reserved=false`，本次上线后自动完成计费终态处理为 `billing_done=true`。账本、余额、账户、任务数前后摘要一致，未修改历史账务。
- 登录、HPO 计费能力、其他 AI 全局开关和服务挂载/环境均验收通过；真实付费模型未调用。用户可重新发起 HPO 生成，旧失败请求不自动重跑。


## 9. 2026-10-25 HPO 已结算流水展示修复

用户真实 HPO 请求 `8e2fb99a-b62e-42f6-9e8c-f0e953749f58` 已成功生成，17:18:28 Asia/Shanghai 完成结算：Octopus `completed/billing_done=true/billable=true`，Squid `settled`。其流水为 `pre_deduction=-1` 与 `settlement=0`，实际净扣费 1 积分；原页面将历史预扣类型原样展示，且遗漏 settlement 翻译，造成等待结算的误解。

- Squid 交易列表响应增加只读 `billing_state`。批量查询当前组织的 AI 请求状态，不依赖分页内是否包含对应结算流水；不修改原流水、金额、描述或余额，无数据库迁移。
- YiJian 对 AI 已结算的预扣记录展示“扣费”，退款后的预扣展示“预扣已退回”。零额 settlement 展示“结算确认”，说明“已结算，无额外扣费”；金额 0 使用中性色。支持四种界面语言。
- 积分页面对仍 reserved 的 AI 请求每 3 秒静默刷新，收到积分更新事件或窗口重新聚焦也刷新；结算后停止轮询。
- 当前 Squid：`schemabio/squid:hpo-settlement-display-20261025t092458z`；YiJian：`schemabio/yijian:hpo-settlement-display-20261025t092458z`。两服务 healthy，网关检查并重载；Octopus 保留第 8 节签名修复镜像，其他容器未替换。
- 备份与证据：`/home/ubuntu/schema/backups/hpo-settlement-display-20261025T092458Z`，含两库 PostgreSQL 18 scoped dumps、原部署环境、完整两仓库构建源码、源码清单、构建/测试日志、API/前端包验收、基线、结果与回退 Squid/YiJian 的 `rollback.py`。回滚须用户授权，不恢复数据库 dump。
- 本地及服务器前端 28 项相关测试通过，类型检查及生产构建通过。服务器隔离 PostgreSQL 回归覆盖预扣/结算/退款、每页 1 条的跨页状态和组织隔离。线上以现有成功请求每页 1 条验证两条记录均为 `billing_state=settled`、金额合计 -1；前端部署包已包含新状态和文案。
- 发布前后账本、余额、账户、任务数及计费/计算/AI 配置摘要一致。未调用真实模型、未新增扣费、未改历史流水。
- 本地 Squid 新增/修改 `internal/model/billing.go`、`internal/service/{billing_service.go,ai_billing_view.go,ai_billing_integration_test.go}`；YiJian 修改积分页、`billing.ts`、四语言字典，新增 `billing-presentation.ts` 与测试。当前修复均尚未提交或 push。此前本地提交仍是基准，远端 Git 仓库未同步源码。


## 10. 2026-10-25 指定家系任务 UPD / ROH 空结果核查与准备

任务 `8f7cd22b-c171-4cdb-97e6-d5802964560f`、当前 attempt `107e2f30-2712-4628-a432-72b1bc8e5cc6`，状态 completed / import success，模板 trio。

云端原始 ROH 注释报告为 86 字节、仅一行表头；UPD 报告为 162 字节、仅一行表头，两者数据行均为 0。归档 workflow.log 证明先证者与父母 ROHReport、UPD 步骤均 complete / exit_code=0。UPD 原报告存在于云端及输出清单，本地旧 TSV 导入路径未纳入 UPD；两者当时均未生成 Parquet，也无 result_datasets 条目。不能把“无数据集”或页面未展示解释为计算步骤没执行，也不能把家系任务必然有 UPD/ROH 区域作为假设。

已使用现有容器内 `results-parquet --task <task> --attempt <attempt> --table roh --backfill --execute`，再对 upd 执行准备，按原报告生成两个 0 行 Parquet 并发布独立 catalogue，未改原始报告或 outputs。当前两表均 rows=expected_rows=0 且列定义完整；浏览器 descriptor API、对象下载均 HTTP 200，文件 SHA256 与数据集记录一致。结果页面刷新后可读取空结果，既有筛选状态不会创造原报告中不存在的区域。

审计记录：`/home/ubuntu/schema/backups/upd-roh-empty-results-20261025T093310Z`，含任务/账务/原有数据集/人工调整基线、执行日志、前后数据集与浏览器接口验收。账本、余额、账户、任务状态与执行身份、其他六张结果表、人工调整摘要均保持；未重跑计算、未调用模型、未重启服务。前端及服务镜像以第 8、9、11 节为准。

后续工作流空报告未生成 Parquet 的通用处理仍需另行修复；本次仅补齐此任务的派生结果。原始报告为 0 行是本次流程输出事实，不等于临床排除结论。


## 11. 2026-10-25 家系 SNP/InDel 三人合子状态及 VAF 修复

**后续纠正：本节初次验收只验证了数值计算，未核对原报告样本身份。原报告列名存在角色错位，本节按旧列名给出的三人统计不能当作真实身份统计；真实映射及当前修复以第 12 节为准。**

同一任务原始 SNP/InDel 报告 43,592 行，三人的 `VAF/VAF_father/VAF_mother` 全部为 `.`，但各自 AD、Genotype、Zygosity 有值。旧前端 `n(.)` 把缺失转成 0，导致先证者百分比全为 0%。本次不修改原始报告、Parquet 或服务端原字段。

- 家系 SNP/InDel 表现在显示先证者、父亲、母亲各自的杂合性（合子状态）及 VAF；按任务 trio / 成员信息决定家系列，未知模板时才以父母字段识别。单样本表不额外展示父母列。
- 优先显示合法的原始 VAF（0～1）；缺失时仅在双等位、两个有效整数 AD 且总和大于 0 的情况下计算 `ALT / (REF + ALT)`。不以 DP 作为分母，不用父母或先证者的数据互相代替。真实 0 保留；缺失、零总深度、歧义多等位等显示“未提供”。
- 浏览器本地增加 `Sample_VAF`、`Sample_VAF_father`、`Sample_VAF_mother` 数值列，排序及表头筛选使用这些派生列。原 VAF/AD 字段保留；派生列不写回原 Parquet、数据库或自动评估证据。
- 详情面板同步使用相同 VAF 并注明 AD 计算来源，家系展示父母值。合子状态识别 WT / 0/0 为参考型，支持相位基因型和缺失值。四语言文案齐全。
- 当前 YiJian 镜像：`schemabio/yijian:trio-snv-metrics-20261025t094652z`，源码 SHA256 `b105cbeca1038f3a9008c3e3c1db8995cdb039f2171a9e7959891ba83181d078`。仅前端容器替换并健康，网关已检查并重载；保留此前计费展示及全部服务镜像修复。
- 保护备份与测试证据：`/home/ubuntu/schema/backups/trio-snv-metrics-20261025T094652Z`，含两业务库 PostgreSQL 18 scoped dumps、原环境与服务身份、完整前端源码和清单、受保护的原始 Parquet 验收副本、测试/构建/部署日志、基线、结果及仅回退 YiJian 的 `rollback.py`。回滚须授权，不恢复业务库 dump。
- 类型检查及生产构建通过；服务器 14 个测试文件、132 项测试全部通过。使用实际 DuckDB WASM 对原 43,592 行全量验收并与 JS 显示计算核对：先证者 VAF 可用 43,138（非零 35,891 / 真零 7,247），父亲可用 43,136（非零 35,649 / 真零 7,487），母亲可用 43,161（非零 41,146 / 真零 2,015）。不足以推算的行仍保留缺失。
- 发布前后原数据集、人工调整、账本、余额、账户、任务数及计费/计算/AI 配置摘要一致。未调用模型或重跑计算。当前本地修改仍未提交或 push；远端 Git 仓库仍非运行镜像最终源码，不能直接旧 HEAD 重建。


## 12. 2026-10-25 家系报告样本身份错位纠正（当前状态）

用户指出 `1:65099775 C>T` 被错误显示为先证者野生型。全量核验确认：原始 VCF 的 #CHROM 样本顺序为 `father,mother,proband`，输入角色顺序为 `proband,father,mother`，旧 `schema-germline/scripts/vep_report.py` 按位置套用 --names，没有按 VCF 样本名重排。因此报告无后缀列实际是父亲，_father 实际是母亲，_mother 实际是先证者。上次仅验证 VAF 计算、没有验证样本身份的验收不充分，不能继续沿用。

### 已上线的当前任务纠正

- 对任务 `8f7cd22b-c171-4cdb-97e6-d5802964560f`、attempt `107e2f30-2712-4628-a432-72b1bc8e5cc6` 的全部 43,592 个位点，逐一对照带样本名的原 VCF，核验 GT / AD / DP / PS。映射为 `{proband: "mother", father: "", mother: "father"}`，值表示原报告列后缀。
- 此映射写入独立 `results.parquet.catalog.json` 的 `sample_column_roles.snv-indel`，绑定原 Parquet SHA256 `b4a09d762b8e0e9aa63741816fca6c01a0cd24ace2a60b9926804be64066a00b`。保留原始错误报告及 VCF/Parquet，不通过覆盖原文件隐去证据，也不把该映射硬编码到所有家系任务。
- Octopus 校验映射一一对应与原文件摘要，通过 transient `ResultDataset.sampleColumnRoles` 传递；无数据库迁移。Go 引擎在读取时整组纠正 GT / Zygosity / PS / Depth / AD / VAF / GQ / PL，用于查询、排序、筛选和导出；有纠正映射时不复用旧的自动评估存储结果。后续受控回填保留此元数据。
- YiJian 在浏览器本地同时重映射三组字段，再计算三人的 VAF；跨表自动评估流也按相同身份映射读取。原 Parquet、数据版本、行标识未改，人工标注保持。自动评估本地缓存 key 升级，避免复用按旧角色计算的缓存。
- 界面“参考型”统一改为“野生型”，内部 Reference 类型保持稳定。
- 指定位点正确结果：先证者 GT `1|0`，AD `63,68`，VAF `68/131=51.9%`，杂合；父亲 GT `0/0`，AD `53,0`，VAF 0%，野生型；母亲 GT `0/1`，AD `58,59`，VAF `59/117=50.4%`，杂合。
- 全量正确身份统计：先证者 VAF 可用 43,161（非零 41,146 / 真零 2,015）；父亲 43,138（非零 35,891 / 真零 7,247）；母亲 43,136（非零 35,649 / 真零 7,487）。
- 当前镜像：`schemabio/octopus:trio-sample-roles-20261025t101022z`、`schemabio/yijian:trio-sample-roles-20261025t101022z`，均 healthy，网关检查并重载；Squid、Cuttlefish、SepiLens、Sepiida、官网镜像未换。

### 验证、审计与边界

备份与审计位于 `/home/ubuntu/schema/backups/trio-sample-roles-20261025T101022Z`，含两业务库 PostgreSQL 18 scoped dumps、原环境/源码清单、原始报告与 VCF、原 Parquet 验收副本、身份审计、原/新目录 JSON、测试/构建/发布日志、前后数据集元数据及最终 result.json。Go 对象摘要约束/真实读取引擎回归通过；前端 8 个测试文件、71 项测试（含实际 Parquet 的 DuckDB WASM 全量和指定位点断言）通过，类型检查及生产构建通过；线上浏览器 descriptor 返回已核验映射，原对象摘要、dataVersion、43,592 行保持。

首次服务器测试因 Docker 忽略了测试 fixture 未通过，补齐只读挂载后通过。首次切换因原检查要求完整数据集元数据摘要不变而自动恢复；逐字段从保护 dump 对照确认只改变 SNP/InDel 的 `manifest_version`、`created_at`（目录刷新导致的缓存信息）。最终使用 `finish.py` 重新切换并逐字段检查，仅允许这两项缓存信息变化，其他表全部字段、原文件身份、数据版本、行数、列定义、人工调整、账本/余额/账户/任务数均一致。当前成功以 result.json 为准，不按历史 failure.txt 判定仍失败。未调用模型或重跑计算。

保留了 `rollback.py`（语法已核验）；只有用户授权才执行，其恢复旧目录及旧镜像，不恢复数据库 dump。该回滚会恢复旧角色显示，不能当作正确身份修复。

### 上游代码仍待计算镜像发布

本地 `D:/WSL/Github/SchemaBio/schema-germline/scripts/vep_report.py` 已修正：读取 #CHROM 样本名，按请求身份排列样本，未知/重复/不一致身份直接报错；单样本显示别名兼容；汇总统计同样使用纠正后的顺序。新增 `tests/test_vep_sample_roles.py` 三项测试通过。原有其他 WDL 改动保留。

**这项上游脚本修复尚未构建/发布到计算镜像，当前基础计算镜像及 germline runtime 镜像未更换。不要声称未来新家系任务的原报告已因此自动修复。当前线上修复覆盖已核验的本任务，并为带可信角色元数据的数据集提供正确读取；其他旧任务须逐任务核验 VCF 身份后再纠正，不得盲目套用排列。** 所有本地修复仍未提交或 push，远端旧 Git HEAD 不能直接重建运行镜像。


## 13. 2026-10-25 初评缓存复用与解读页样本详情调整（当前前端）

用户报告 HPO 未变但每次打开任务都会重新初评。对第 12 节任务连续读取结果上下文、初评上下文，版本及内容摘要均稳定；参考服务排名和基因补充请求正常。未读取用户实际浏览器的 IndexedDB，不能把具体浏览器缓存失效原因说成已被现场证实。

- YiJian 初评先读取授权上下文和完整缓存，未命中才创建 Worker；缓存检查使用 checking 状态，避免命中缓存时仍显示正在初评。缓存命中后恢复结果并继续版本检查，候选基因排名后台刷新失败也不会迫使已有完整结果重新计算。
- 缓存键规范化对象键、HPO 集合、成员顺序、结果表及可用性顺序；保留分析批次、HPO、证据、规则包及参考资源等完整上下文约束。同一账户切换组织保留分区缓存；退出或切换账户清除。增加只保存最近一个完整结果的内存后备，IndexedDB 不可用时同一页面会话仍可复用。有效期保持 24 小时，不缓存取消、部分或参考查询失败的初评结果。
- 授权上下文仍以 active 快照为准，latestVersion 不同则提示重新评估，不自动覆盖原快照。重新初评按钮、显式重试和任务到期清理行为保留。规范化后的键可能使旧缓存首次重建一次。
- 解读页样本详情移除送检日期、采样日期、收样日期、样本质量、承诺周期；不删除样本管理中保存的原数据。“已知诊断”去掉“用户提供”字样；诊断及家族史分栏、窄屏纵排，长文本换行，HPO 术语单独占整行，编辑功能保留；同步四语言。
- 当前 YiJian：`schemabio/yijian:assessment-cache-layout-20261025t131447z`。Octopus 保留 `trio-sample-roles-20261025t101022z`，其他服务未替换；前后端 healthy，网关检查并重载。
- 基于第 12 节运行源码快照精确 overlay 构建，源码清单和镜像标签一致。服务器 7 个文件、48 项回归测试通过，类型检查和生产构建通过；覆盖缓存命中不创建 Worker、重开任务不重读变异、参考刷新失败、版本轮询、规范化、组织隔离、退出清理、过期、样本详情和 HPO 编辑，以及原家系列回归。
- 线上只读验收：初评上下文稳定、HPO 数量 1；参考查询 HTTP 200；SNP/InDel 43,592 行、原对象摘要和样本角色映射保持。发布前后数据集、人工调整、账本、余额、账户、任务数量及配置摘要一致，未调用模型或发起计算。
- 发布资料：`/home/ubuntu/schema/backups/assessment-cache-layout-20261025T131447Z`，含完整前端源码及清单、原部署环境、构建与测试日志、数据摘要基线、result.json、final-acceptance.json 和 rollback.py。本次仅替换前端，保留本轮完成的 Squid dump；因 Octopus 重复完整备份过慢，明确停止该只读备份容器，复用第 12 节已有完整 Octopus dump。本轮 octopus.dump 为未完成副本，不可用于恢复；backup-reuse.json 记录此事，failure.txt 仅为主动停止备份的历史记录，最终成功以 result.json / final-acceptance.json 为准。
- 回退脚本仅恢复本次前端及部署环境，不恢复数据库。源码尚未提交或 push；远端旧 Git HEAD 仍不能直接重建。


## 14. 2026-10-25 本次会话提交状态

第 8–13 节后续修复已分别在 YiJian、Octopus、Squid、schema-germline 本地提交，未 push。此前各发布段落中“尚未提交”的描述记录当时状态，以本节为最新状态；生产运行镜像与源码快照位置保持第 12、13 节所述。schema-germline 的上游脚本虽已提交，计算镜像仍未构建/发布，不能据此认定未来任务的原报告已修复。忽略目录 .gotmp 中运维脚本、数据副本和凭据不纳入提交。


## 15. 2026-10-25 ACMG AI disabled 链路及家系分析模式修复（当前状态）

### 原因与开放范围

线上 SepiLens 原为 `SEPILENS_AI_MODE=enabled`、`SEPILENS_AI_ONLY=true`、`SEPILENS_REQUIRE_RULE_APPROVAL=true`；HPO、SVC 可用，但 ACMG 的 `ai_available=false`，Octopus 因而显示“引擎状态：disabled”。模型配置和网络链路正常，直接将医学规则 enabled 改为 true 不是本次修复。

SepiLens 新增显式 `SEPILENS_AI_CANDIDATE_ENGINES`，按引擎放行 evidence_only AI。生产仅配置 `acmg_amp_2015`，正式规则批准要求保持 true，ACMG `enabled=false` 但 `ai_available=true`。能力查询、请求提交及后台执行使用同一按引擎检查；其他未批准引擎默认继续关闭。Octopus 现返回 ACMG `enabled=true, mode=candidate, billingEnabled=false`。CNV 能力、SVC 实验边界及 HPO 收费均未改变；不伪造批准材料，不自动保存或覆盖人工判读。

### 家系上下文

- Octopus 在任务/样本权限校验后，按任务 Template 补入 `sample.analysis_mode=single|trio|unknown`；不根据样本当前是否关联父母来猜测任务模式。存在任务创建快照时，父母 affected_status 按快照角色取值，避免用当前样本关系替代当次分析背景。
- YiJian 向选定位点输入增加命名 `sampleGenotypes.proband/father/mother`，仅包含 GT、杂合性、AD、VAF 及 VAF 来源。Octopus 再做角色和字段白名单、数值范围校验；样本身份和文件信息不进入此字段。
- SepiLens 接收 `analysis_mode`，模型提示区分执行方式 `mode=ai_assisted` 与分析设计 `trio`，按明确角色名比较三人的位点数据。真实 0 VAF 保留，缺失仍未知；trio、本人的叙述或这些未验证输入都不自动证明亲子关系、新生突变、相位、共分离或 PP4。未知遗传模式与胚系来源继续为 unknown。
- 指定任务 `8f7cd22b-c171-4cdb-97e6-d5802964560f` 线上模板仍为 trio；SNP/InDel 43,592 行、原摘要及第 12 节角色映射保持。当前任务 AI 的执行方式为 ai_assisted、分析设计为 trio。

### 构建、验证与资料

当前镜像：`schemabio/{sepilens,octopus,yijian}:acmg-trio-ai-20261025t142021z`，三者均 healthy，网关检查并重载。其他服务容器未替换。

源码基础：SepiLens 的干净 `cdb6d7309666b8c9ae0ab4865ac5682350b49761`（与旧运行镜像 revision 相同），Octopus 第 12 节快照，YiJian 第 13 节快照，再精确 overlay 本次文件。构建时默认 Alpine/Go 模块源在该主机不可达，第一次主动取消停滞构建，第二次 Go 模块源超时；改用服务器既有腾讯镜像源后成功，改动记录进构建源码和清单。failure.txt 是这些历史构建记录，以最终 result.json 和 preflight-acceptance.json 为准。业务镜像仅在所有验证通过后切换。

本地及服务器通过 SepiLens config / assessment / api 回归（含合成模型 HTTP 调用）、Octopus ACMG / SVC / HPO 相关回归；前端服务器 4 个文件、34 项测试，类型检查及生产构建通过。覆盖候选按引擎隔离、正式门禁、任务 trio 模式、父母子命名基因型及真实零/缺失 VAF。线上能力经 SepiLens 和 Squid→Octopus 两层确认；合成 single/trio 请求均通过严格输入与候选能力校验，到刻意不存在的 provider 查询处停止，未创建 job，未调用真实模型。不能把此预检描述为已在生产真实模型上生成 ACMG 结果。

发布前后任务数据集、人工调整、账本、余额、账户、任务数量及业务配置摘要一致，模型和计算调用数为 0。备份 `/home/ubuntu/schema/backups/acmg-trio-ai-20261025T142021Z` 包含原环境/Compose、当前 SepiLens SQLite 一致性备份、三仓库源码与清单、基线、日志、result.json、preflight-acceptance.json 和 rollback.py（语法核验）。本次无 schema 迁移，完整业务库备份复用第 12 节；不恢复数据库来回退代码。回退脚本恢复原三个镜像、环境及 Compose，只有用户授权才执行；回退后 ACMG 候选也将重新关闭。

本次修改尚未提交或 push；此前第 14 节提交保留。SepiLens 本地 `docs/openapi.yaml` 已生成并通过 drift 校验，增加可选 analysis_mode 字段；这是构建后更新的文档文件，不包含在本次镜像源码清单内。生产代码以保护快照清单为准，后续同步源码需连同此文档更新。上游计算镜像仍遵守第 12 节未发布边界。


## 16. 2026-10-25 ACMG 正式商业计费与联调文案清理（当前状态）

用户要求按正式版本测试。第 15 节仅恢复候选 AI、没有开放商业计费，前端因此仍显示“联调期间不扣费”；该遗漏已修正，不以仅改文案冒充收费链路。

- SepiLens 增加 `SEPILENS_ACMG_BILLING_ENABLED=true` 和逐引擎 billing_available。只有实际有效 ACMG AI 交付（有摘要和条款）才明确 settlement_eligible；失败、无效、取消、外部检索不可用等分支保持不结算。此商业交付资格不替代医学规则批准，正式规则 enabled 仍为 false；SVC、CNV 不因此开放收费。
- Octopus 与 Squid 分别显式启用 `AI_ASSISTANCE_ACMG_BILLING_ENABLED=true`，不打开其他 AI 全局收费开关。每次 1 积分；客户端必须 confirmedCharge，先预扣，成功结算，失败/不具资格退款；同一请求幂等且不重复扣款。
- Octopus 使用请求自身 BillingEnabled 快照接收 ACMG evidence_only 商业交付资格，不能追溯重定价旧免费请求；仍要求上游明确交付及 settlement_eligible。能力检查同时确认上游可计费，未就绪不开放正式收费调用。
- YiJian 以逐功能 billingEnabled 为准，ACMG/HPO 正式收费未就绪时不免费放行。四语言去掉“联调期间”字样；ACMG 显示 1 积分确认，其他保持免费的功能只显示“不收平台积分”，不暗示当前部署仍是联调。
- 当前四镜像：`schemabio/{sepilens,octopus,squid,yijian}:acmg-production-billing-20261025t151144z`，均 healthy，源码清单与镜像标签核验，网关检查并重载。其余服务未替换。Compose 增加三项服务对应商业计费变量，保留第 15 节仅开放 ACMG 候选的设置及正式审批 true。

服务器独立临时 PostgreSQL 和私有 Docker 网络已实际运行 Octopus 确认/预扣/成功结算/失败退款/无效交付/预扣失败/重复调用测试，Squid 并发结算与退款和历史账单状态测试。测试使用隔离 schema 和合成模型/账本；测试库容器、网络已清理。SepiLens config / assessment / api 回归通过（包括付费成功与检索缺失不结算），前端 5 个文件、46 项测试、类型检查和生产构建通过，OpenAPI 生成且含 billing_available 及 analysis_mode。

发布期间生产账本、余额、账户、任务数、任务数据集和人工调整摘要一致，未产生真实扣费或模型调用。保护资料 `/home/ubuntu/schema/backups/acmg-production-billing-20261025T151144Z` 含四仓库完整构建源码与清单、原部署/Compose、SepiLens SQLite 一致性备份、基线、隔离测试日志、result.json、rollback.py（语法核验）；业务库完整备份复用第 12 节。回退代码和环境不恢复数据库，也不会自动撤销用户之后正常支付的请求。

### 待用户明确授权的真实家系测试

已经准备一次真实验收：任务 `8f7cd22b-c171-4cdb-97e6-d5802964560f`、位点 `1:65099775 C>T`，1 积分，明确 confirmedCharge。尝试查询该位点的通用 Go query API 返回 500；未继续修改该独立问题，改从第 12 节已做全量 VCF 身份核验的原报告保护副本提取，校验报告与当前 Parquet 摘要绑定并按角色纠正所有 GT/AD/DP/PS 等输入。先证者 `1|0`、父亲 `0/0`、母亲 `0/1` 再次通过断言；不把旧报告未经重映射的字段直接发给模型。保护输入是验收材料，不保存人工判读。

真实调用启动操作被自动审批审查拒绝：用户虽然要求正式测试，但尚未明确授权将真实家系遗传数据披露给具体外部接收方。随后只读核对当前接收方为 **api.deepseek.com，模型 deepseek-flash**。必须先向用户明确请求授权，将该家系临床/表型背景及父母子位点数据发给该接收方，并成功扣 1 积分。不得换途径绕过此拒绝。该真实测试尚未发出，没有 request ID，也未扣费；不能宣称真实模型收费验收已完成。

授权后可用本机忽略目录 `.gotmp/acmg-paid-real-test-launch.py` 进行一次测试；其运行脚本、输入及幂等键位于该保护备份目录，首个 request ID 一旦生成即保存，必须先检查原请求再重试，不自动换键。监测脚本 `.gotmp/acmg-paid-real-test-monitor.py`；只输出请求状态和流水摘要，不打印临床内容或凭据。若用户拒绝，保持已上线的正常费用确认入口，不执行这个真实数据测试。

本节及第 15 节源码尚未提交或 push；第 14 节提交不包含这些后续变化。


### 用户后续决定：自行测试

用户明确表示“你配置好链路就行了，我会自行测试”。正式收费链路已配置并上线，真实测试由用户自行在页面发起。智能体不再请求代测授权，也不执行上述 real-test 启动脚本；此前自动审批拒绝仅作为历史审计记录，不代表线上配置仍未完成。没有代发真实请求、没有新增测试扣费。用户页面仍按正常流程确认每次 1 积分，再预扣、交付结算或失败退款。


## 17. 2026-10-25 SVC v4 同步计费及各功能独立会话确认（当前状态）

用户反馈 ACMG 首次扣费提示被样本管理 HPO 的免提示设置跳过，并要求 SVC v4 与 ACMG 一起接通。本次同时修正两项：

- YiJian 将免提示偏好由共享布尔值改为按功能存储。键为 `yijian:ai-charge-confirmation:v2:<用户:机构>:<feature>`，HPO、ACMG、SVC 各自首次确认；一个功能勾选记住不会跳过其他功能。旧共享键不能证明同意任何具体功能，因此不迁移；升级刷新后会分别重新确认一次。仍只使用 sessionStorage，并按账户/机构隔离；取消不保存记住选项，不触发请求。
- 四语言勾选说明改为“本次浏览器会话内，此功能不再提示”，仍明确每次操作照常收费。已验证功能间双向隔离、取消、旧共享偏好不跳过首次确认、同功能会话内记住及换账户/会话重新确认。
- SVC AI 服务同步每次 1 积分、确认、预扣、有效交付结算和失败/不具资格退款。新增 Octopus / Squid `AI_ASSISTANCE_SVC_BILLING_ENABLED=true` 与 SepiLens `SEPILENS_SVC_BILLING_ENABLED=true`；保留 ACMG 已有收费配置，不开启 CNV 或其他全局收费。
- SepiLens 对 SVC 有效 AI 摘要及条款的交付明确提供 billing_available / settlement_eligible；检索不可用、失败等仍不结算。Octopus 仅按请求的 BillingEnabled 快照接受此商业交付资格，旧免费 SVC 请求不重新计费。
- 商业服务收费不将 SVC 医学规则伪装成正式版本：SVC status=experimental、enabled=false，结果仍为 experimental，正式规则结论与临床采纳限制保留；输入模式仍为 ai_assisted + allow_experimental，trio 身份与上下文沿用第 15 节。AI 服务可收费与草案规则正式批准是不同状态。

当前四服务镜像：`schemabio/{sepilens,octopus,squid,yijian}:svc-billing-confirmations-20261025t154057z`，均 healthy；源自第 16 节当前镜像对应的完整源码快照再精确 overlay，源码清单与镜像标签核验通过。网关检查并重载，其余服务未替换。线上 SepiLens 和平台能力均确认 ACMG/SVC 已开启计费、SVC 草案状态保持；前端部署包已包含 v2 独立确认键。

本地及服务器 SepiLens config / assessment / api 回归通过（付费/免费边界、SVC 成功和检索缺失不结算）；Octopus 在隔离 PostgreSQL 中实际运行 SVC/ACMG 确认、成功、无资格、无效、预扣失败退款及重复请求幂等；Squid 隔离库并发结算/退款覆盖 HPO、ACMG、SVC。前端服务器 5 个文件、50 项测试通过，类型检查及生产构建通过。测试临时容器和私有网络已清理。没有代发真实模型请求，没有新增真实扣费。

发布资料：`/home/ubuntu/schema/backups/svc-billing-confirmations-20261025T154057Z`，含四仓库完整源码与清单、原部署/Compose、SepiLens SQLite 一致性备份、基线、构建/隔离测试日志、result.json、final-acceptance.json 和 rollback.py（语法核验）。发布前后账本、余额、账户、任务数、数据集和人工调整摘要一致，原角色映射保持。无 schema 迁移，完整业务库备份继续复用第 12 节。仅用户明确授权时回退代码/环境，不恢复数据库，不自动撤销用户正常请求。

第 15–17 节后续修改仍未提交或 push；真实测试由用户自行发起，沿用第 16 节最后的用户决定，不启动旧 real-test 脚本。前述章节关于 SVC 免费、共享免提示的内容仅记录当时状态，以本节为准。


## 18. 2026-10-25 本轮本地提交状态

第 15–17 节的 ACMG/SVC AI 链路、trio 上下文、正式商业计费、独立会话扣费确认及对应测试，已分别在 YiJian、Octopus、Squid、SepiLens 本地提交，未 push。前文“尚未提交”记录当时状态，以本节为最新提交状态。当前运行镜像、源码快照、测试和回退资料仍以第 17 节为准；用户自行测试的决定不变，智能体未代发真实模型请求或扣费。忽略目录中的运维脚本、验收数据和凭据不纳入提交。
