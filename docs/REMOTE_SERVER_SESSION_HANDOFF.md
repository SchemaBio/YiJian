# SchemaBio SaaS 远端连接、认证与开发交接

**2026-10-31 组织重置功能已部署，最新三服务镜像与提交见第60节；支持UUID二次确认、指定初始积分及可选示例数据。Cuttlefish公网正常；额外发现YiJian公网登录521、源站200，入口问题待排查。**

核对日期：**2026-10-30，Asia/Shanghai**。本文替代此前 2026-10-08 的版本。
主机、服务和仓库状态均已重新只读核实；新对话开始时仍需核对现场状态。
**最新注册链路以第59节为准：三端已部署人工审核与Resend通知；公开注册仍待Turnstile和可信入口配置，邮件Token由管理员在Cuttlefish填写。**
本文只记录凭据位置和使用方式，不保存私钥、密码、令牌、完整 DSN 或签名链接。

**最新完整仓库部署以第 58 节为准：Squid / Octopus / Cuttlefish / YiJian及官网已部署，标签 `latest-repositories-20261029t153312z`；使用协议及支付安全设置已包含。正式收款与下载防护保持关闭，待应用计算配置保留一项。第 41 节为此前支付发布记录：Squid / Cuttlefish / YiJian 已部署 Stripe 接入代码，test/live 收款均关闭，Stripe 测试凭据和真实测试卡闭环验收待完成。服务器仍有待应用计算配置，支付发布以显式 preserve-applied 选项保留当前运行配置。以下 2026-10-27 镜像记录为历史状态。**

**2026-10-27 当前线上：SepiLens 为 `cnv-default-draft-20261027t023827z`（第 37 节），Octopus 为 `cnv-copy-estimate-20261026t145125z`，YiJian 为 `cnv-autofill-20261027t023917z`，Squid 保持 `cnv-ai-20261026t115034z`。第 33 节修复深度估算小数拷贝数被错误拒绝，保留其估算身份、不取整。第 31 节修复 CNV 浏览器 BIGINT 区间长度在提交前序列化失败导致一直转圈，并增加有界传输超时。第 30 节接通 CNV Gain/Loss AI 自动上下文、联网候选、人工填表保存及每次 1 积分，保留正式规则批准门禁；同步修复质控大于号文案。第 28 节修正 IGV 放大后的正文与三样本轨道高度自适应，按钮移至关闭按钮左侧；第 27 节启用 CNV Region 本地初评/HPO 关联/得分排序；第 26 节补齐 Peddy 亲缘关系接口和总览展示；第 25 节统一管理页提醒字号，并记录本阶段本地提交。第 24 节允许缺少疾病/遗传模式时返回部分评估。第 23 节将任务编辑限制为失败/待启动状态。第 22 节修复完成结果保存误报不可用，并强制检索、自动补全 SVC 四项上下文；保留第 21 节输出合同及有界格式纠正。第 19 节家系内部编号/性别显示修复保留，第 20 节增加 SVC AI 结果一键保存。ACMG / SVC v4 / CNV Gain / CNV Loss AI 服务均按每次 1 积分收费；HPO / ACMG / SVC 的本会话免提示选择分别记录。保留正式医学规则批准门禁、SVC 草案身份及此前 HPO、家系角色和缓存修复。第 15–17 节修改已按仓库本地提交、未 push，用户自行测试，智能体不代发真实模型请求。旧 Git HEAD 不能直接重建。**

**2026-10-30 前端增量发布：YiJian 当前为 `schemabio/yijian:agreement-contact-20261030t014053z`，精确提交 `14fb54eca1735c8fa582a5ec8ec6f8cebd4ca65a`。包含此前统一使用协议页面提交 `774afcb`；签约主体和联系信息在运营配置缺失时显示 `SchemaBio` / `support@schema-bio.com`，不修改后端运营配置或收款开关。**

本次保护目录：`/home/ubuntu/schema/backups/agreement-contact-20261030T014053Z`，保存源码归档及摘要、部署配置、旧镜像回退标签、构建/测试日志、`result.json` 和 `verification.json`。本地类型检查、此前12项协议回归及服务器17项协议/登录/充值回归通过；镜像healthy、重启0，四语言源站及中英文公网主体/邮箱核对通过（Cloudflare邮箱保护编码已解码核对）。业务/公告摘要、计算配置及其他容器身份保持，仅更新YiJian；回退仅切换前端镜像，不恢复数据库。代码已本地提交，未push GitHub。

**2026-10-30 公告已读状态增量发布：YiJian 最新镜像为 `schemabio/yijian:announcement-reads-20261030t021208z`，精确提交 `29231e82947654ee0449e57361bb798c05fa4a66`，替代上述协议联系信息镜像并保留其功能。公告中心展示完整正文后将当前版本记为已读，红点按未读版本判断；浏览器 localStorage 按用户/组织隔离保存，支持跨标签页同步，新公告/新版重新提醒。横幅关闭记录独立，存储不可用时本次访问仍可清除红点。**

本次保护目录 `/home/ubuntu/schema/backups/announcement-reads-20261030T021208Z` 保存源码归档及摘要、原部署配置、旧镜像回退标签、构建/测试日志、result和verification。本地12项公告回归与类型检查通过，远端29项公告/协议/登录/充值回归、类型检查及生产构建通过；容器healthy、重启0，公网脚本与镜像中包含已读修复的静态资源摘要一致。行为验收基于自动化回归，未操作生产用户公告已读记录；业务/公告摘要、计算配置及其他服务容器身份不变。仅切换YiJian前端，不恢复数据库，未push GitHub。

**2026-10-30 注册优化最新增量部署：Squid `60f6f5ac67f930abaf5b9596c4d9e5702e28cf6c`、Octopus `b74c2e90e9f1df5761fd35cee4d07ca80d1ebeed`、YiJian `a27a734abf78703e4afdf366359dc8893f8d3460`，三服务统一镜像标签 `registration-optional-20261030t050735z`，替代各自此前运行版本。注册增加密码确认；姓名、机构名称及机构标识选填，空字段由后端生成默认显示名/工作区和唯一组织标识；仍保留验证码、邮箱验证、待审核与租户隔离。补齐注册页验证码组件渲染；自部署Octopus支持省略姓名。**

保护目录 `/home/ubuntu/schema/backups/registration-optional-20261030T050735Z` 保存两业务库dump（Squid278084字节、Octopus98337922字节）、原部署配置/密钥保护副本、旧镜像回退标签、三仓库精确归档/摘要、构建/测试日志、本机隔离PostgreSQL注册测试证据、result和verification。按Squid→Octopus→YiJian切换，三服务healthy、重启0；远端44项前端回归、类型检查及生产构建通过，两个后端Linux镜像构建通过。本地18项前端回归、Squid注册handler及实际隔离PostgreSQL注册全组、Octopus选填姓名绑定验证通过，临时数据库容器已清理。

独立源站及四种语言参数公网注册页核对必填/选填属性、登录接口及精确镜像提交成功；不以公网请求创建测试账户或发送邮件。业务/公告摘要和计算有效/applied配置保持，未切换服务容器身份保持；收款及下载防护设置未改，待计算配置保护继续保留。回退只切换镜像，不恢复业务库或改历史账务。三个功能提交及本交接记录已本地提交，未push GitHub。

## 1. 新对话先读

本机工作区为 `D:\WSL\Github\SchemaBio`，包括 YiJian（用户前端）、Squid（认证、组织、计费、云计算网关）、Octopus（样本、任务与结果）、Cuttlefish（管理控制台）、SepiLens（AI 引擎服务）、Sepiida（节点 Agent/进度服务）和 Schema_CPU（工作流及计算镜像）。

**第58节已从origin/main拉取完整版本并部署。业务服务和官网镜像对应精确Git提交，早期overlay记录为历史；以后以最新发布节的提交、镜像及保护目录为准。**

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


## 19. 2026-10-26 解读页样本内部编号及父母登记性别显示

用户要求任务 `8f7cd22b-c171-4cdb-97e6-d5802964560f` 的性别核对显示内部编号，父亲、母亲已知角色时补全登记性别。只读确认：此任务 template=trio，但没有 trio_members 创建快照，原 QC members / sampleId 保存的是 proband/father/mother 工作流角色别名；父母 declaredGender=unknown，检测性别分别 male/female。任务样本接口已有先证者及父母内部编号。

- YiJian 将显示编号与质控关联 ID 分开：存在任务家系快照时优先使用快照内部编号和性别；无快照的旧任务按角色关联任务样本及其父母内部编号。保留原 QC ID 做测量关联，不按数组位置重新分配数据。质控列提示及复制表格也使用相同内部编号。
- 性别核对页优先保留明确的登记性别；缺失或未知时按用户要求将父亲补为 male、母亲补为 female。按最终显示登记性别和原检测性别重新计算一致/需核对/信息不足，明确冲突仍保留警示。此为解读页显示派生，不更新样本库性别、任务输入快照、原质控报告或检测结果。
- 单样本 VCF 的 chrX 推断保持原逻辑；家系不会把单份 chrX 推断复制给父母。没有足够信息时仍显示未知。
- 当前前端镜像 `schemabio/yijian:family-sex-identities-20261026t033719z`，仅替换 YiJian，healthy；网关检查并重载，其他服务容器身份保持。基于第 17 节精确源码快照 overlay，源码清单与镜像标签一致，未使用远端旧 HEAD 重建。
- 本地类型检查及 12 项相关测试通过；服务器生产构建、类型检查和 5 个文件 36 项回归通过。另用指定任务实际内部编号、QC 数据在保护目录生成独立渲染测试，三人内部编号、男/男/女登记性别及一致状态全部通过；无需在日志输出内部编号或临床内容。没有操作用户实际浏览器。
- 发布资料 `/home/ubuntu/schema/backups/family-sex-identities-20261026T033719Z` 含完整前端源码/清单、原环境与 Compose、数据摘要基线、构建和测试日志、保护身份输入、result.json、final-acceptance.json 和 rollback.py（语法核验）。发布前后数据集、人工调整、账本/余额/账户/任务数量及配置摘要保持；无数据库写入、真实模型调用、收费或计算任务。无 schema 迁移，完整业务库备份复用第 12 节；回退仅代码/环境，不恢复数据库，须用户授权。
- 本次仅修改 YiJian，尚未提交或 push；第 18 节四仓库提交保留。旧段落中的当前镜像以本节和页首为准。


## 20. 2026-10-26 SVC AI 评估结果一键保存

用户反馈 SVC v4 AI 已产生结果，但“保存新版评定”仍要求先填疾病、遗传模式、基因疾病关联有效性和变异影响。原因是 AI 卡片只有展示功能，保存按钮接的是独立手工规则计算表单；并非 AI 生成失败。

- AI 结果卡片下新增“保存 AI 评估结果”，无需填写手工计算参数，不再调用模型或扣费；保存成功显示“AI 评估结果已保存”，按钮禁用。保存失败保留结果并允许重试，未完成解读权限及只读状态限制继续生效。
- 保存请求仅传 `svcv4AIResult: <request UUID>`。Octopus 先沿用任务编辑权限、当前 attempt / dataset / 行 ID、乐观版本和幂等写入校验，再按租户、任务、SVC 功能、completed 状态和解密后的原请求位点 ID 检查，复制服务器加密保存的真实结果。拒绝客户端直接提交伪造分类、分值或结果对象，不从其他任务/位点借用 AI 结果。
- 摘要、建议分类、证据、模型/时间、请求 ID、来源与实验结果随版本化行调整保存，沿用调整历史审计。前端浏览器 Parquet 投影、Go 查询投影和行规范化都传递 `svcv4AIResult`；保存后当前详情同步，重开位点恢复 AI 卡片，只读也可查看已保存结果。
- 保存是 AI 草案建议存档，字段与 `svcv4Assessment` 手工计算结果分开；不会自动设 confirmed、改变 activeAcmgVersion、覆盖 ACMG 人工证据/分类、写 reviewerDecision 或把草案作为正式临床结论。手工计算及证据确认流程继续可用。没有把未知前提编造为疾病、遗传模式或方法积分。
- 旧的、仅在页面内生成而未保存的 AI 卡片仍依赖原页面状态；本次未添加“按位点自动查找最近一次未保存 AI 请求”接口。已保存快照可在重开后恢复，勿将其描述为所有历史未保存请求自动回填。
- 当前 Octopus / YiJian 镜像 `schemabio/{octopus,yijian}:svc-ai-save-20261026t042124z`。源码分别基于第 17 节 Octopus 和第 19 节 YiJian 的已校验完整快照 overlay，保留家系、初评缓存、收费及独立首次确认修复。其他容器和配置未替换；无数据库 schema 迁移。
- 本地类型检查、SVC 表单/AI 保存/重开/失败重试、变异详情、结果映射、费用确认及翻译测试通过。服务器临时独立 PostgreSQL 测试实际验证完成结果的租户/任务/位点归属及拒绝无效数据；同时回归 SVC/ACMG 商业计费生命周期和手工 SVC 计算/版本约束。前端生产构建和对应回归通过。临时数据库和私有网络已清理；未在生产保存测试结果、代发真实模型请求或扣费，用户仍自行在页面测试。
- 保护资料 `/home/ubuntu/schema/backups/svc-ai-save-20261026T042124Z` 包含两个仓库完整源码/清单、原环境/Compose、基线、构建与测试日志、result.json、final-acceptance.json、rollback.py。源码清单与运行镜像标签核验；任务数据集、人工调整、账本/余额/账户/任务数及配置摘要保持。完整业务库备份继续复用第 12 节，代码回退不恢复数据库，须用户授权。
- 第 19、20 节修改尚未提交或 push；以前各仓库提交保留。不要从远端旧 Git HEAD 重建。


## 21. 2026-10-26 模型结构化输出约束及有界格式纠正

用户报告“模型输出未通过结构化校验”。只读核查最近失败 SVC 请求 `550ab80c-f78d-49fa-97f9-9593ba63e9f8`（job `job-f076605833f0d15ae4260a982301cbf1`）以及前两次失败，均为 AI_OUTPUT_INVALID；解密审计仅输出字段结构，确认 stage=model_run、rounds=2、未保留被拒绝的最终模型输出。**不能声称已从历史原文确认某个具体错误字段**。旧 provider 校验只返回通用失败，agent 在该失败分支未保留输出，历史证据不足；本次修复同时加强合同和今后的安全诊断。

- 新增 assessmentSchemaFor，按固定引擎给出合法条款代码和有限分类取值。SVC 只允许 POP / CLN / LOC / NUL / CDS / PFD，strength 只能空串，score_hundredths 必须 null；无已核验 draft 方法输入时 points 必须 null，facts_confirmed 必须空数组。ACMG 仅允许本引擎代码/强度；CNV 分别采用各自规则代码。保留独立语义核验和已有 ACMG 冗余数字不参与评分政策。
- 系统提示明确只返回一个 JSON 对象，禁止代码围栏/额外字段/嵌套 JSON 字符串，字段必须齐全，类型、大小写、枚举和未知值必须符合合同；prompt_version 升至 four-engine-ai-2.3。
- 本地 schema 校验增加不含模型值的字段路径与固定原因，正确执行原生整数形式的 maxItems/maxLength 等约束，保留严格 nullable 类型检查；provider 将安全 schema 原因传回 agent。未知属性报父路径，不将模型自行写的患者内容键或值带入错误信息。
- 同一请求最多一次结构纠正，沿用原输入及已有工具历史，纠正阶段禁用工具。没有新请求 UUID、没有重新预扣或额外平台收费；原有三分钟/轮次/工具预算继续约束，累计模型用量计入当前请求。网络失败、未知工具等不进行此格式重试；第二次不合格仍 AI_OUTPUT_INVALID，不采纳、不结算。不会把非法医学证据直接改成合法结论来绕过校验。
- RunResult 增加 output_validation_errors / output_repairs / rejected_output，仅进入原有加密 evidence snapshot 审计；被拒绝输出按 256 KiB 上限保留为字符串，避免非法 JSON 破坏审计序列化。不写普通服务日志，不暴露给用户 AI 建议卡片。历史失败请求不自动重新生成。
- 本地新增合成测试覆盖错误积分类型/混入其他引擎代码/非法强度/未经核验事实、纠正成功、两次失败、纠正期间工具调用被拒、网络失败不重试、用量累计和诊断不泄露输入。真实 HTTP 合成 provider 验证 SVC 格式错误后有效交付，或持续不合格时拒绝且不结算，草案/clinical_use=forbidden 保持。
- 服务器全仓库 `CGO_ENABLED=0 go test ./... -count=1` 28 个测试包通过；生产构建、健康、完整源码清单及镜像标签核验通过。当前仅 SepiLens 替换为 `schemabio/sepilens:model-output-contract-20261026t053516z`，其他服务容器身份保持；SVC/ACMG 商业能力和医学规则门禁保持。未调用真实模型、未在生产保存测试结果或扣费，继续由用户自行测试。
- 发布资料 `/home/ubuntu/schema/backups/model-output-contract-20261026T053516Z` 含当前 SepiLens SQLite 一致性备份、原环境与 Compose、完整源码/清单、基线、构建/全量测试日志、result.json、final-acceptance.json、rollback.py（语法核验）。基于第 17 节已校验的运行源快照 overlay，保留构建专用镜像源配置；无 schema 迁移。前后数据集、人工调整、账本/余额/账户/任务数与配置摘要保持；回退仅代码/环境，须用户授权，不恢复业务数据库。
- 第 19–21 节代码仍未提交或 push：YiJian、Octopus、SepiLens 各自保留修改；此前已提交内容不变。远端旧 Git HEAD 仍不可直接重建运行镜像。


## 22. 2026-10-26 SVC 完成结果保存修复与联网自动补全

用户指出已有结果仍显示 AI service unavailable，且一键保存没有解决手工选择疾病/遗传模式/有效性/变异影响的问题。只读核查最近成功请求 `b7784fb4-de38-46e5-bec4-98eec146390d` 和更早成功请求，确认结果密文可解密、summary/resultKind 完整，但输入 ciphertext 已为空。第 20 节保存逻辑错误地依赖原输入；assistance.finish 本来就在终态清理原输入，所以此前仅用保留输入的测试 fixture 验收不充分。此次补上真实完成生命周期测试，不将其归因于模型未返回。

- Octopus 在清理输入前，仅把当前请求可信位点 row ID 保存在加密 Result.variantId 中；完成结果保存按该绑定核对当前位点，不再依赖已清理的输入。完整临床请求仍按原策略清理，没有为保存而长期保留原文。
- 对旧结果，保存服务在租户/任务/功能/完成态校验后，读取同一上游实例中原 job 的不可变 evidence snapshot，核对当前授权 Parquet 行的参考基因组、染色体、位置、REF/ALT、基因及转录本，匹配才保存。坐标由服务器读取当前已核验行，不能由浏览器自报；不重新调用模型或扣费，证据缺失/不匹配明确失败，不借其他位点结果。新绑定字段不作为公开模型输入。
- SepiLens 在 SVC imported context 生成前，强制使用当前官方 PubMed/ClinVar 检索链路执行基因范围检索，结果连同变异注释进入模型输入；不再取决于模型是否主动调用 search_literature。工具再次请求相同检索时复用本轮结果，保持现有请求/时间预算。检索不可用与无命中区分，检索失败继续不结算；不把联网失败解释成无相关证据。
- SVC 模型合同新增必需 svc_context：disease / moi / geneDiseaseValidity / workflow 四字段均包含 value、reason、source_ids，MOI/有效性/工作流取值与当前表单一致。模型按实际表型和基因选疾病候选，有效性须有对应疾病的明确整理断言，工作流按实际变异影响选择；缺少可靠依据时留空并解释，不编造方法积分或让用户猜选。引用必须来自本轮来源或原始 annotation；未知引用拒绝，服务端填入来源标题/URL/检索状态。prompt_version=four-engine-ai-2.4，前节 JSON/格式纠正约束保持。
- Octopus 把 svc_context 传为 Result.svcContext，随 AI 结果存档。YiJian 在收到新结果时直接回填疾病、遗传模式、基因与疾病关联有效性、变异影响工作流；选择新工作流时清理旧工作流专属影响输入，其他已有证据保持。显示各字段理由及来源链接；保存 AI 快照后重开可恢复回填。旧 AI 结果没有结构化上下文时不从自由文本猜造四字段；新生成结果使用新合同。
- 回填为可编辑候选，draft.confirmed=false、旧本地计算结果失效；不自动把 AI 候选当作人工确认，不切换正式分类或临床采用。只保存 AI 结果仍不要求手工补齐方法参数；手工计算规则及 SVC 草案身份保留。
- 服务器 SepiLens 全仓库 28 包测试通过，包括强制检索先于模型、带引用四字段交付；Octopus 隔离 PostgreSQL 实际测试终态输入清理后保存、跨机构/任务/位点拒绝及历史审计匹配。历史保存用例首次因名称筛选遗漏，已用独立临时库补跑成功，证据为 legacy-verification.log；测试库/网络清理。前端 9 文件 90 测试通过，包括自动选择四项、来源链接和重开恢复；类型检查、生产构建通过。
- 另外以公开 BRCA1 示例通过实际官方检索器只读验证服务器联网：PubMed available=true、5 条来源；ClinVar available=true、0 命中。没有发送患者背景、调用模型或产生平台测试费用。不能将此连通性和合成模型验收称为用户真实家系的模型生成全链路验收，仍由用户自行测试。
- 当前三镜像 `schemabio/{sepilens,octopus,yijian}:svc-autofill-20261026t060848z`，均 healthy、源码清单与镜像标签一致；Squid 及其他容器身份保持。保留旧缓存、角色映射、四功能计费与独立首次确认等修复，计费和医学规则门禁不变，无 schema 迁移。
- 发布资料 `/home/ubuntu/schema/backups/svc-autofill-20261026T060848Z` 含三仓库完整源码/清单、原环境/Compose、SepiLens SQLite 一致性备份、基线、构建/全量与隔离测试日志、公开联网检查、result.json、final-acceptance.json 和 rollback.py。基于第 20 节 Octopus/YiJian、第 21 节 SepiLens 的运行快照 overlay。任务数据集/人工调整/账本/余额/账户/任务数及配置摘要保持，没有生产测试保存、真实模型调用或扣费。代码回退须用户授权，不恢复业务数据库；完整业务库备份继续复用第 12 节。
- 运维注意：本轮首次只读辅助脚本用过于具体的 split 标记加载第 21 节 release.py，意外进入入口，但在 ensure_idle 因当时存在用户 AI 请求立即停止，尚未备份/替换部署环境或服务。该旧备份目录新增的 failure.txt 只属这次诊断误导入，原发布成功仍由 result.json/final-acceptance.json 证明；diagnostic-import-note.json 已解释。以后仅用 `.split('\ntry:\n',1)[0]` 加载函数定义，禁止执行旧入口。未重跑真实请求。
- 第 19–22 节修改仍未 commit/push；三仓库现有工作区改动全部保留。部署源码以各保护快照为准，不从远端旧 HEAD 重建。当前本地前端测试文件另有一次结尾空白清理，不影响运行代码；运行清单仍对应发布时确切源码。


## 23. 2026-10-26 任务中心仅失败/待启动可编辑

用户要求只有失败或待启动任务可编辑。当前系统待启动对应 queued（界面原文“排队中”），不包括 waiting_for_data（等待数据）或 cancelled（已取消）。

- YiJian 新增统一 canEditTask，仅 failed / queued 满足状态白名单，原有家系能力、解读完成和云端执行中限制保留。任务中心编辑按钮、编辑弹窗及提交入口共同使用；其他状态按钮禁用。列表刷新发现任务已不可编辑时关闭已开的编辑弹窗，提交时也校验最新列表状态。同步四语言提示。
- Octopus UpdateTask 在数据库事务中 SELECT FOR UPDATE 读取当前任务，再验证 failed / queued、解读锁和 CVM 执行阶段。仅更新 internal_id / pipeline / remark / updated_at / version，不用旧完整任务快照覆盖运行状态。状态不允许时返回冲突响应，旧浏览器或直接 API 不能绕过。空字段原有更新语义保持，无 schema 迁移。
- 本地类型检查及前端状态/弹窗测试通过。服务器 5 文件 49 项前端回归、生产构建通过，保留此前 SVC 自动补全与解读回归。服务端测试覆盖 queued/failed 允许、等待数据/运行/完成/待解读/取消/未知拒绝，断言锁定读取后检查状态、非法状态回滚且无 UPDATE，以及执行与解读锁不可绕过；handler 包编译通过。
- 当前 Octopus / YiJian 镜像 `schemabio/{octopus,yijian}:task-edit-states-20261026t070138z`，均 healthy、完整源码清单与标签一致；SepiLens / Squid 及其他容器身份保持，网关检查并重载。基于第 22 节运行快照 overlay；额外核对本地任务服务和 handler 原文件摘要与该运行源一致，避免覆盖既有修复。
- 发布资料 `/home/ubuntu/schema/backups/task-edit-states-20261026T070138Z` 包含两仓库源码/清单、原环境/Compose、基线、构建与测试日志、result.json、final-acceptance.json、rollback.py（语法核验）。前后任务数据集、人工调整、账本/余额/账户/任务数与配置摘要保持，没有编辑生产任务、发起模型/计算或测试扣费。仅代码更新，业务库完整备份继续复用第 12 节；回退须用户授权，不恢复数据库。
- 第 19–23 节各仓库代码仍未提交/push；所有先前工作区改动保留。旧章节“当前镜像”以页首及本节为准。


## 24. 2026-10-26 SVC 缺失疾病/遗传模式时返回部分评估

用户报告 `SVCv4: 请确认疾病及遗传模式`。原因是 Octopus 的确定性手工计算器入口将这两字段缺失视为硬错误；不是 AI 模型未返回，也不能通过随意填写疾病/MOI 来绕过。第 22 节 AI 联网建议仍可独立生成，确定性计算与 AI 建议保持区别。

- 保留 svcv4.Evaluate 参考入口，应用服务改用 EvaluatePartial 适配入口。疾病/MOI 完整时所有已有参考案例的输出逐项不变；缺失时不填占位疾病、不默认 AD/AR，而返回 state=insufficient_context、partial=true、missingFields、具体说明及原输入。
- 部分评估仍严格校验证据结构、非法枚举、频率范围、病例身份/重复等；有效 FAF/DAFT 可保留 POP_FRQ 分项暂算和真实 0。疾病或遗传模式缺失时，不计算 POP_HMZ，不给变异影响、临床病例/对照与家系条目套用未确定的疾病前提，相关输入保留为已校验/未计分。不会把缺失当 0。
- 此模式不汇总总分，score/classification/vusSubclass 均为 null，confirmed 强制 false；不生成 VUS 来替代未知，不能作为 activeAcmgVersion=svcv4 的有效采用。部分结果在现版/未采用状态可保存为评估记录；若当前正在采用有效 SVC 结果，原采用门禁仍阻止用不完整评估直接覆盖采用结果。没有更改完整上下文的规则阈值或正式医学批准状态。
- 前端显示“信息不足（部分评估）”、缺少疾病/MOI 的说明及可计算分项，隐藏该结果的确认采用复选框，允许保存部分记录。补足上下文后可重新计算。四语言同步。
- 同时修正 AI 上下文恢复：只有自动补全确实改变疾病/MOI/有效性/工作流时才使已有计算失效；未知或相同的 AI 字段不再在重开时清空已保存的部分评估。新工作流仍清理旧工作流输入。
- 服务器参考计算与完整输入适配输出逐项一致性回归、缺项/真实零/非法输入/不可采用回归通过；fixture 在构建镜像中被 dockerignore 排除，测试时只读挂载保护源码中的原 fixture。前端 7 文件 68 测试、类型检查与生产构建通过，保留任务编辑限制、SVC 联网补全及保存回归。
- 线上授权接口只做一次空疾病/MOI、空证据的确定性计算，HTTP 200，state=insufficient_context、总分/分类 null、confirmed=false、两项缺失正确。该请求不保存结果、不调用模型、不扣费；不是对真实家系临床证据的计算验收，也未重跑原任务。
- 当前 Octopus / YiJian `schemabio/{octopus,yijian}:svc-partial-context-20261026t071635z`，均 healthy，源码清单与镜像标签一致。SepiLens / Squid 等容器不变，网关检查重载；保留第 22、23 节联网补全、保存和任务编辑限制。
- 发布资料 `/home/ubuntu/schema/backups/svc-partial-context-20261026T071635Z` 含两仓库源码/清单、原环境/Compose、基线、参考/部分计算与前端测试日志、result.json、final-acceptance.json、rollback.py（语法核验）。基于第 23 节完整运行源 overlay，并额外校验计算器及服务原文件摘要。规则 revision 继续标明原参考源，部分适配在 details.contextAdapter 标为 yijian-svc-partial-context-v1。前后数据集/人工调整/账本/余额/账户/任务数/配置摘要一致，无 schema 迁移；代码回退须授权，不恢复业务库。
- 本轮及第 19–23 节修改均未 commit/push，其他工作区改动保留。当前镜像以页首及本节为准。


## 25. 2026-10-26 管理页 banner 字号统一及本阶段提交

- 样本管理/任务中心共用 RetentionNotice 和数据中心临时保留提醒中，外层为 text-sm，补充说明却另设 text-xs，造成同一 banner 字号不一致。本次删除两处补充说明的 text-xs，使标题、说明共同继承外层 text-sm；保留原有字重、文案和交互。
- 本地类型检查、样本管理/数据中心/任务中心 3 个文件 36 项回归通过；服务器相同回归及生产构建通过。只替换 YiJian 为 `schemabio/yijian:banner-font-20261026t072331z`，healthy，源码清单与镜像标签核验；其他容器身份不变，网关检查并重载。
- 发布资料 `/home/ubuntu/schema/backups/banner-font-20261026T072331Z` 含前端完整源码/清单、原环境/Compose、基线、构建与测试日志、result.json、final-acceptance.json 和 rollback.py（语法核验）。基于第 24 节精确运行源 overlay，保留之前全部修复。任务数据集、人工调整、账本/余额/账户/任务数及配置摘要不变，未调用模型/计算或编辑生产任务。
- 用户要求提交本阶段全部更新。Octopus 已本地提交 `89c31e9`（SVC 结果保存/上下文传递/部分评估、任务编辑状态与对应回归）；SepiLens 已本地提交 `58e2e30`（逐引擎输出约束、有界结构纠正、强制检索及四字段补全与回归）。YiJian 的家系编号/性别、SVC 保存/自动填表/部分评估、任务编辑限制、统一 banner 字号及交接记录随本节一起提交。均不 push，Squid 本阶段无新增改动。
- 第 19–24 节“未提交”是当时记录，最新提交状态以本节为准。此前提交保留；忽略目录 .gotmp 中的运维脚本、保护数据和凭据不入库。线上代码来源仍以运行镜像的保护快照/清单为准，远端旧 Git HEAD 不能直接重建。


## 26. 2026-10-26 家系亲缘关系结果接入总览

用户询问家系分析为何总览没有亲缘关系。只读核对任务 `8f7cd22b-c171-4cdb-97e6-d5802964560f` 当前执行 `107e2f30-2712-4628-a432-72b1bc8e5cc6`：trio.wdl 已调用 Peddy，summary 声明 ped_check.csv，归档原始报告 420 字节、三组配对，另有对应 Parquet。不是没有执行亲缘分析，而是 ResultContext / 总览此前未接入。

- 原始报告 father–mother：rel=-0.06313、PED 预期 0、IBS0=545、n=4920，predicted_parents=false；father–proband：rel=0.6492、预期 0.5、IBS0=6、n=4920，predicted_parents=true；mother–proband：rel=0.6409、预期 0.5、IBS0=6、n=4919，predicted_parents=true。三组 parent_error / sample_duplication_error 均 false。保留工具原值及标记，不把负值截断为零，也不将 rel 套用其他工具的 kinship 阈值。
- Octopus ResultContext 新增 kinship；仅 trio 任务读取当前租户/任务/执行的归档。云端严格限定 resultPackagePrefix 下 .ped_check.csv，对重复归档只接受字节一致者；本地仅接受 manifest 声明且受归档路径约束的文件。不回退其他执行，1 MiB 上限；严格校验列、有限数值、位点计数、布尔标记和重复配对。不可用、待生成、空报告和异常均明确状态，不阻塞变异工作区、不伪装为核对成功。不修改工作流、数据集、临床证据或家系判定门禁。
- YiJian 总览新增“亲缘关系核对（Peddy）”，展示内部编号、基因型 rel、PED 预期相关度、比较位点数、IBS0、预测亲子、亲子冲突和重复样本提示，支持复制。复用任务快照优先的内部编号解析，按 Peddy 源标识匹配，不使用历史 SNP 报告的位置列。四语言同步；不自动采用为 ACMG 家系证据。
- 本地后端报告解析测试、前端 24 项回归、类型检查通过；服务器后端含 30 个通过项，前端 4 文件 36 测试、类型检查与生产构建通过。当前授权只读接口确认 ready、三组配对、两组预测亲子、冲突与重复提示为零。
- 同时延续上一轮 ROH/UPD 只读核对：当前执行的 ROH 原始报告 86 字节、UPD 原始报告 162 字节，均只有表头、零数据行；对应 Parquet 与浏览器读取零行一致，日志步骤成功。这个任务的两项空表来自原报告无记录，不是漏渲染；不构成临床排除。
- 当前 Octopus / YiJian 镜像 `schemabio/{octopus,yijian}:family-kinship-20261026t074652z`，healthy、完整源码清单和镜像标签核对。SepiLens / Squid 等容器身份不变，网关检查重载；此前全部修复保留。未重跑任务、调用真实模型、生产测试保存或扣费；业务数据集/人工调整/账本/余额/账户/任务数与配置摘要保持。
- 发布资料 `/home/ubuntu/schema/backups/family-kinship-20261026T074652Z` 包含两仓库保护源码/清单、原环境/Compose、基线、构建与测试日志、kinship-acceptance.json、result.json、final-acceptance.json 和 rollback.py（语法核验，使用通用定义入口 split）。基于第 24 节 Octopus 与第 25 节 YiJian 精确快照 overlay，无 schema 迁移；业务库完整备份继续复用第 12 节，代码回退须授权，不恢复数据库。
- 本轮修改未 commit/push。前一阶段提交 YiJian `cca67cd`、Octopus `89c31e9`、SepiLens `58e2e30` 已保留；忽略目录 .gotmp 中的临时运维资料不入库。远端旧 Git HEAD 仍不可直接重建当前镜像。


## 27. 2026-10-26 CNV Region 本地初评、HPO 候选及 IGV 网页放大还原

用户要求 CNV Region（cnv-segment）执行本地初评、结合 HPO 候选，按分数置顶 P / LP；随后追加 IGV 显示框的网页放大/缩小按钮。两项一起完成并部署，只更换 YiJian。

- 当前家系任务的授权初评快照中，pack 的 dosage/diseases/HPO 与 proofs 均空。原前端 CNV 评分器依赖归档区间及本地剂量参考，因而不能从原始 CNV 区间触发实际评分。HPO/HGNC/ClinGen 补充 SQLite 查询已可用，但不能替代剂量敏感性坐标数据。没有把原报告 Classification、Total_Score、HI_Max 或 Evidence_* 直接当本地评分结果。
- 新增 scripts/build-cnv-browser-reference.py，从此前已校验的 hg19/hg38 管理源清单生成两个公开 ClinGen 剂量敏感性快照。逐源核对 SHA256、来源/版本/许可证，ClinGen 一基闭区间转零基半开；源版本明确保留为基因 2026-10-07、区域 2026-04-28，不声称最新。资源位于 public/assessment-reference/cnv/<sha256>.json，分别 398613 / 396630 字节，内含公开来源元数据，无患者内容。客户端从自身站点加载，核对字节数/摘要/参考组装/版本/结构后才交给 Worker；不运行外部 AI 或在线医学推断。
- 对当前工作流已核实的 CNR/BED 八列 schema（Chromosome/Start/End/Col4–Col8），本地流增加显式零基半开格式标签，并仅投影必要坐标。评分器校验整型区间和标准染色体，未知/普通坐标不猜测，已有不同参考组装的区间证据不回退套用。正常 CN 不当作事件；DEL 对 HI、DUP 对 TS，完整覆盖且对应 ClinGen 分数为 3 才自动应用 2A=1；部分重叠与 30/40 不当成充分证据。现有已核验其他条款继续保留，缺失的蛋白编码计数、病例、遗传证据保持待核验，不虚构加分或自动保存人工采用。
- CNV 涉及的剂量参考基因按当前样本正向 HPO 进入现有本地 HPO/HGNC 查询，评估中保留匹配基因/疾病/术语/相似度。CNV Region 列表新增 HPO 候选匹配列；HPO 不直接增加 CNV 致病积分，HPO-only VUS 不被本次规则自动置顶。评分和关联仍在浏览器 Worker 内完成。
- DuckDB 在分页前对整个表使用人工修订或本地初评的有效 CNV 分类/分数：P / LP 按 CNV 得分降序，同分以 HPO 相似度排序，显式人工关注/置顶/取消选择保持。浏览、筛选和导出共用该排序。用真实 WASM 验证跨页、人工改分和取消置顶，未只排序当前页。
- 浏览器规则 profile 升为 germline-browser-assessment-v5-cnv-region，CNV 公开资源摘要和数据纳入现有完整缓存键；不会替换服务器已授权的历史 active 快照/HPO，也不伪造归档 proof。升级后首次重建一次；相同任务/HPO/参考继续复用缓存。资源异常明确 pending，失败初评不缓存；现有账号/组织/任务/执行隔离与 24 小时缓存政策保留。Octopus 上下文快照的既有 profile 不因此改写。
- IGV 工具栏增加放大按钮；点击后模态框占满当前网页可视区域（100vw / 100dvh），按钮切为缩小，再次点击恢复原尺寸。复用同一 IGV browser、当前位点及轨道，利用现有 resize 监听重新布局，不通过重载实现；关闭后再次打开默认原尺寸。同步四语言和 aria-pressed。未启用浏览器系统全屏。
- 本地 168 项回归通过，含 CNV 坐标/剂量、HPO 分离、缓存、55,393 行 Worker 流、IGV 切换；生产构建含类型检查通过。服务器最终 19 文件 198 测试通过，另一个未提供完整参考包的独立性能 fixture 按原门禁跳过；生产数据验收未跳过。
- 当前执行原始 CNV Parquet 摘要核验后，以真实 DuckDB WASM 只读投影并本地重算：64732 行、19288 条 DEL/DUP，1 条有剂量证据可评分并达到 P 初评置顶。其他没有充分自动证据者保持不足，不从原报告高标签凑数。该数是这版自动初评候选数，不是最终临床报告结论。授权 HPO 补充查询 HTTP 200、两个公开测试基因有匹配且版本与 active 快照一致；没有真实模型调用。
- 发布前验收首次在测试 SQL 中未给保留字 End 加引号，WASM Node 报 _setThrew，第一轮在切换前停止；修正测试为带引号的必要字段投影后，原始文件验收和全量回归均通过，再从当前保护源重建发布。不是篡改业务原文件或绕过验收。Windows 测试中 Node bindings 硬编码 homedir 的扩展缓存，现将测试缓存隔离在 .gotmp，预置项目相同的已签名 json/parquet 扩展，无外部下载和全局环境变量改写。
- 当前 YiJian 镜像 schemabio/yijian:cnv-region-igv-20261026t082550z，healthy，源码清单/标签及两份公开资源 HTTP 内容摘要核对通过；Octopus 保持 family-kinship-20261026t074652z，SepiLens / Squid 等容器身份不变，网关检查重载。没有重跑家系工作流、模型请求、测试保存、扣费或 schema 迁移；数据集/人工调整/账本/余额/账户/任务数与配置摘要保持。
- 发布资料 /home/ubuntu/schema/backups/cnv-region-igv-20261026T082550Z 含完整 YiJian 源码/清单、原环境/Compose、基线、构建/测试日志、原始 CNV 保护副本及摘要、hpo-reference-acceptance.json、result.json、final-acceptance.json 和 rollback.py。基于第 26 节精确运行源 overlay，保留亲缘关系、SVC、收费等此前修复。失败的首次构建保护目录为 cnv-region-igv-20261026T082102Z，未切换生产；以成功目录为准。代码回退须授权，不恢复数据库，完整业务库备份继续复用第 12 节。
- 本轮及第 26 节修改仍未 commit/push；此前阶段提交保留。生成的公开资源、构建脚本和测试属于待提交源码，.gotmp 中的运维资料与患者数据保护副本不入库。远端旧 Git HEAD 不能直接重建当前镜像。


## 28. 2026-10-26 IGV 标题栏控制与三样本纵向适配

用户反馈上一版按钮位置不符，放大外框后 reads 显示区没有同步增长，仍须向下滚动寻找父母样本。核查确认：ModalBody 默认 max-h-[60vh] 未解除，Modal 外层未建立纵向 flex 布局，且各 alignment track 仍固定 180px；第 27 节仅窗口 resize 和外框尺寸不足以实现需求。

- AppModal 新增可选 headerActions，位于共用关闭按钮紧邻左侧；IGV 的放大/缩小图标按钮改放此处，并为标题预留空间。其他弹窗默认行为保持，关闭仍为既有共享操作。
- IGV 放大模式明确建立视窗高的纵向 flex 容器，正文移除 60vh 限高并 min-height:0 / flex:1 / overflow:hidden；工具栏、提醒占实际高度，reads 外层获得剩余空间，不再保持旧固定高度或最低 260px。缩小保留原普通窗口样式。
- 新增 IGVTrackLayout，按容器实测可用高度扣除 IGV 导航、边框等非轨道部分，对父母子 alignment 轨道均分剩余高度；辅助基因/VCF/序列/尺标轨道压缩为适当高度，给 reads 优先留空间。同步调整覆盖度区域，使用当前安装 IGV 源码核实的 trackView.setTrackHeight(height,true)，临时关闭轨道 autoHeight，避免内容自动撑高整个列表。每个样本仍保留自己的 reads 视口及内部滚动，三个样本面板无需通过滚动整个列表才能看到；不宣称同时展示高覆盖度下的每一条 read。
- ResizeObserver 观察可用区域及内容高度，配合 RAF 合并重新布局；窗口大小变化自适应。原轨道高度/autoHeight/coverageTrackHeight 逐项保留，缩小时恢复。不重建浏览器、不丢失当前位点/轨道，也不改写原始数据。
- 完整 Radix/AppModal 集成测试还发现已有 session 时，Portal 容器可能尚未挂载，原初始化 effect 直接退出。改为稳定 callback ref 提供容器就绪状态，并将其作为初始化依赖及门禁，防止初始化早于实际容器或重复进入。保留晚完成初始化的释放、截图和错误恢复策略。
- 新增测试覆盖 420/560/720/980px 可用空间下三样本加辅助轨道总高度不超出预算、reads 获得可见空间、扩大及缩小、反复 resize 仍恢复原高度、未测量/释放的浏览器安全处理；真实 AppModal（IGV 数据为合成 mock、尺寸为受控测量）验证标题栏相邻顺序、正文解除限高、轨道实际收到高度调整、窗口变矮重新适配且同一 browser 不重建。不能把该合成布局测试称为真实患者浏览器截图验收。
- 本地类型检查及相关回归通过；服务器 9 文件 65 项测试、类型检查和生产构建通过，含既有截图、CNV 详情、SVC 和亲缘关系回归。当前 YiJian `schemabio/yijian:igv-trio-fit-20261026t085326z` healthy，完整源码清单及镜像标签一致；Octopus / SepiLens / Squid 等容器身份不变，网关检查重载。任务数据集、人工调整、积分账本/余额、账户、任务数量和配置摘要保持，无真实工作流/模型调用或生产测试保存。
- 发布资料 `/home/ubuntu/schema/backups/igv-trio-fit-20261026T085326Z` 含完整 YiJian 保护源码/清单、原环境与 Compose、基线、构建/测试日志、result.json、final-acceptance.json 和 rollback.py。基于第 27 节精确运行源 overlay，CNV Region 初评/HPO/排序及其公开参考资源等全部保留。无 schema 迁移，业务库备份继续复用第 12 节；代码回退须授权，不恢复数据库。
- 本轮与第 26–27 节仍未 commit/push；此前阶段提交保持。忽略目录 .gotmp 不入库，远端旧 Git HEAD 不可直接重建当前镜像。


## 29. 2026-10-26 本阶段本地提交

用户要求提交本阶段更新。Octopus 已提交 `d05b428`（feat: expose archived family relationship checks），包含当前执行归档的 Peddy 亲缘关系接口、严格报告解析与回归测试。YiJian 的亲缘关系总览与内部编号映射、CNV Region 本地 ClinGen 参考/初评/HPO 关联/全表得分排序及缓存、IGV 标题栏放大还原与父母子轨道自适应、相应公开参考构建脚本/资源、四语言/回归和第 26–28 节交接说明随本节一起提交。

- 沿用已通过的本地及服务器回归与生产构建/只读验收，本次仅整理提交和更新交接记录，不重新调用 AI 或工作流，也不更改线上镜像或业务数据。
- 两仓库均仅本地 commit、不 push。SepiLens / Squid 本阶段无新增改动，原提交保持。第 26–28 节“未提交”是当时状态，最新状态以本节和 Git 记录为准。
- 忽略目录 .gotmp、患者原始数据保护副本、私钥、令牌及运维临时文件不入库。纳入提交的两个 CNV JSON 均为带来源和校验摘要的公开 ClinGen 剂量参考，不含患者数据。运行镜像仍以第 27、28 节的精确源码快照/清单为准，远端旧 Git HEAD 不可直接重建。

- 提交时发现 Windows core.autocrlf 会转换内容寻址的公开 CNV JSON；新增 .gitattributes 对 public/assessment-reference/cnv/*.json 设置 -text，确保检出/提交保留原始字节。提交前核对 Git 暂存 blob 与参考 manifest 的长度和 SHA256 一致。仅 Git 元数据约束，不改变已部署资源。

## 30. 2026-10-26 CNV Gain/Loss AI 候选评估及每次 1 积分接入

- 接通 CNV Region / Exon 的 Gain 与 Loss AI 候选评估。SepiLens 保留正式规则 enabled=false 和签名批准门禁，显式候选白名单新增 cnv_gain_2020、cnv_loss_2020；通过 ai_available / billing_available 独立开放 AI。页面不再以正式规则 disabled 状态阻止候选请求。HPO、ACMG、SVC 现有能力保留。
- Octopus 按当前任务权限读取参考组装、样本/HPO/家系及分析模式，传入脱除身份和运行路径的上下文。疾病和遗传模式允许未知，不再要求先填弹窗；模型推测可编辑，不能自动变为已核实的临床事实。Gain/Loss 独立 rubric、引擎词表和分值校验；生成前执行有界官方检索，区分检索无记录和检索故障。未知引用、越界分值、重复/互斥条款拒绝交付。
- 明确识别原始 BED 列结构：Region 为 Chromosome/Start/End/Col4–Col8，Exon 为 Chromosome/Start/End/Col4–Col19；允许其后附加命名注释列，但不接受未知编号列布局。提交前转一基闭区间，不隐式 liftover。CN=0 与未知拷贝数在模型输入中明确区分；不将旧 Classification / Total_Score 作为受信规则事实。
- 新增临床可读的条款/重算分值预览，确认后填入现有评估表，再人工保存。保存 AI 请求标识、原建议和引用、采用条款/时间及采用时上下文，重开可恢复；后端重新计算分数和分类。第三节不从类别分值反推编码基因数；第四节建议分值单独记入 aiReviewed，不制造病例/家系数量，不与手工病例计数重复累计，并执行独立 rubric 边界和共享上限。CNV 快照上限调整为 2 MiB，容纳有界 AI 输出及审核记录，超限仍拒绝。
- 新增独立开关 SEPILENS_CNV_BILLING_ENABLED 与 Octopus/Squid 的 AI_ASSISTANCE_CNV_BILLING_ENABLED，默认 false，本次生产显式开启。Gain/Loss 每次 1 积分，沿用确认、会话免提示、预扣、成功结算、失败/取消/无结算资格退款及并发幂等；旧请求不重新定价，其他全局开关和计算账务策略保留。自部署不收平台积分。
- 本地与服务器相关回归、类型检查及生产构建通过；服务器独立 PostgreSQL 验证两类 CNV 的成功结算、失败退款、取消退款和并发幂等，使用合成模型/检索。原始规则与前端/保存校验副本逐项一致。最终只读验收确认两类 AI 可用且可计费、正式规则未启用、五类 AI 能力保留、匿名拒绝，以及当前任务两类实际列结构能够识别。无真实模型/工作流调用、生产测试保存或 schema 迁移，业务基线摘要保持。
- 当前 Squid / SepiLens / Octopus / YiJian 镜像均为 schemabio/<service>:cnv-ai-20261026t115034z，健康，源码清单与镜像标签一致，网关检查重载；其他服务身份保留。同期修复质控统计中“均一性（>0.2× 平均深度）”“线粒体 >0× 覆盖率”的多余单引号，四语言同步上线。
- 保护资料 /home/ubuntu/schema/backups/cnv-ai-20261026T115034Z 包含两业务库 PostgreSQL 18 scoped dumps、SepiLens SQLite 备份、原环境/Compose、四仓库完整保护源码/清单、隔离回归及构建日志、result.json、final-acceptance.json 和 rollback.py。坐标识别修正及客户端指令顺序修复在上线前重新构建测试；最终以 result.json、final-acceptance.json 与最新 source-manifests.json 为准。此前 113841Z / 114231Z 准备目录均未切换生产，保留诊断，不作为成功版本。代码回退须授权，不恢复业务数据库。
- 本阶段代码未 commit/push，既有提交保留；.gotmp 运维资料、备份和凭据不入库。远端旧 Git HEAD 仍不可直接重建当前镜像，真实付费模型由用户测试。

## 31. 2026-10-26 CNV AI 提交前转圈修复

- 用户反馈 CNV AI 长时间等待。只读核对 Octopus 与 SepiLens 均没有 CNV 请求/任务，亦无 CNV 预扣记录。根因位于前端：浏览器在原始 CNV Parquet 之外物化 Interval_Length BIGINT 列，Arrow 返回 bigint，随后被包含在 annotationValues；生成指纹的 JSON.stringify 位于 try/finally 之外，抛错后 busy 无法释放，尚未发出 POST。原始 Parquet 本身可 JSON 序列化，只有加入浏览器派生列后才复现，不能只检查原文件。
- 新增准备输入边界，安全范围内 bigint 转数字，超出安全范围的整数保留为十进制字符串，避免精度丢失；零值保持。准备输入、生成指纹和请求 ID 一并纳入异常处理，失败明确提示未提交并解除忙碌状态。循环结构不会发出 API 请求。
- 异步评估提交确认等待上限 45 秒、单次状态查询 30 秒；HPO 同步提交保留 360 秒观察窗口，兼容原 330 秒后端处理。这里只结束客户端观察，不隐式取消服务器工作，不改变已接收任务的计费终态。网络超时保留原幂等键，不自动新建请求或调用模型。
- 本地相关测试和类型检查通过。服务器 9 文件 62 项回归全部通过、无跳过，含真实 DuckDB WASM 的 BIGINT 派生列序列化、异常后解除 spinner/可重试、超时保留请求标识、不隐式取消及既有 HPO/ACMG/SVC/CNV 确认和保存流程。当前任务 CNV 保护副本的只读回归仍为 64732 行、19288 事件、1 条可评分置顶，本次未写入生产结果。
- 仅替换 YiJian 为 schemabio/yijian:cnv-ai-submit-fix-20261026t135427z，健康、完整源码清单及镜像标签核验，网关检查重载；其他容器身份、挂载、环境和业务基线摘要保持。最终只读验收 CNV 请求数/预扣数仍均为零；无真实模型调用、工作流或生产测试保存，不改历史账务，无 schema 迁移。用户刷新页面后自行测试真实模型。
- 保护资料 /home/ubuntu/schema/backups/cnv-ai-submit-fix-20261026T135427Z 含当前完整前端源码/清单、原环境与 Compose、基线、构建与回归日志、result.json、final-acceptance.json 及语法核验的 rollback.py。基于第 30 节最终精确源码快照叠加，完整业务库备份复用第 30 节；代码回退须授权，不恢复业务库。
- 本轮及第 30 节修改仍未 commit/push，既有提交保留；.gotmp 运维资料和凭据不入库，远端旧 Git HEAD 不能直接重建运行镜像。

## 32. 2026-10-26 CNV AI 阶段本地提交

- 用户要求提交本阶段改动。Squid 已本地提交 `5be01a3`（CNV AI 独立积分开关和并发结算/退款回归）；SepiLens 已本地提交 `ed52857`（CNV 候选上下文、独立规则校验、联网预取、计费资格及回归）；Octopus 已本地提交 `313f099`（CNV AI 上下文/坐标/计费接入、人工复核文献分值及保存重算）。
- YiJian 的 CNV Gain/Loss AI 人工填表和保存恢复、BED 坐标识别、质控符号文案、BIGINT 提交前序列化与忙碌恢复、保留幂等标识的传输超时，以及四语言、回归和第 30–32 节交接说明一起本地提交。具体提交号用 `git log -1 --oneline` 查看。
- 第 30–31 节“未 commit/push”是当时记录，当前提交状态以本节和各仓库 Git 记录为准。四仓库均不 push；沿用已通过的本地/服务器测试和生产构建，本次仅整理提交，不调用真实模型、工作流或更改线上镜像/业务数据。
- .gotmp 临时运维材料、备份、患者保护副本、私钥和令牌均不入库。新增 CNV rubric JSON 为公开规则定义，不含患者数据；线上仍以保护源码清单及镜像摘要为准，远端旧 Git HEAD 不可直接重建。

## 33. 2026-10-26 CNV 深度估算拷贝数输入修复

- 用户补充点击时提示 invalid CNV copy number。这是另一处输入校验问题：Octopus 曾要求页面 copyNumber 必须为整数，而现有报告包含连续深度估算。保护 Region 报告只读统计为 64732 行，其中 63744 行为非负小数估算，DEL/DUP 中 19077 行带小数；不是非法输入。该校验位于请求创建事务中，失败回滚，因此没有 AI 请求/上游任务/预扣记录；不能仅凭未落库就判断 HTTP 未到达。
- Octopus 接受非负有限、安全数值范围内的小数，不四舍五入、不强制变为整数；原值保留于 AI 导入注释 copyNumber / copyNumberEstimate，整数 cnv.copy_number 留空。整数和真实 0 保留；负数、非有限值和超安全范围输入仍拒绝。SepiLens 模型输入单列 copy_number_estimate，将 copy_number 保持未知，明确估算值不证明整数计数、胚系或嵌合。正式 CNV 整数接口、规则分值与批准门禁不变。
- 本地映射、模型输入及服务器相关 API/assistance/handler/assessment/config/retrieval/rules 回归与两个生产构建通过；隔离 PostgreSQL 保留两类 CNV 的计费生命周期验证。线上只做缺少模型 profile 的合成校验，确认估算上下文能到达 profile 必填门禁，422 返回前不建立模型任务；不调用真实模型。
- 当前仅更新 Octopus / SepiLens 为 schemabio/<service>:cnv-copy-estimate-20261026t145125z，健康、完整保护源码和镜像标签核验；YiJian 保持第 31 节修复，其他容器身份及挂载/环境不变，网关检查重载。最终业务基线摘要保持，CNV 请求/预扣数均为零，无生产测试保存、工作流或 schema 迁移。
- 保护资料 /home/ubuntu/schema/backups/cnv-copy-estimate-20261026T145125Z 含两服务完整保护源码/清单、原环境和 Compose、SepiLens SQLite 备份、隔离回归和构建日志、result.json、final-acceptance.json 与语法核验的 rollback.py；完整业务库备份继续复用第 30 节。代码回退须授权，不恢复业务库。
- 第 32 节四仓库本地提交保留，本轮修复及交接更新未 commit/push；.gotmp 和凭据不入库，远端旧 Git HEAD 不可直接重建运行镜像。

## 34. 2026-10-26 小数 CNV 拷贝数修复本地提交

- 用户要求提交第 33 节修复。Octopus 已本地提交 `973bef5`（保留小数深度拷贝数估算，整数/零值及非法值回归和对接说明）；SepiLens 已本地提交 `44410ea`（模型输入分离连续估算与整数计数，相关回归和对接说明）。YiJian 随本节提交第 33–34 节交接更新，前端代码仍为此前提交 `39f0abf`；Squid 无新增改动。
- 第 33 节“本轮未 commit/push”是当时记录，当前状态以本节和 Git 记录为准。本次仅本地提交、不 push，不重新调用模型或更改线上镜像、数据及账务；沿用已通过的本地/服务器回归与发布验收。.gotmp、保护副本及凭据不入库，线上精确源码仍以第 33 节清单和镜像标签为准。


## 35. 2026-10-27 CNV 模型输出长度处理与安全失败诊断

- 用户报告“模型调用失败或超时”。只读核实三个 CNV Loss 请求均为 AI_PROVIDER_UNAVAILABLE，最新为 4cf35dbb-9c97-4480-ad33-3f33a7f8a95a；联网检索及首轮模型已有返回，失败审计位于 model_run，执行 2–3 轮，有三次工具读取。输出用量累计 8298、15767、8322 token；其中一次出现 $.cnv_context: unexpected property 并进入格式纠正。历史代码没有保留 provider 的最终结束原因，因此只能确认模型输出阶段失败，不能断言全部为连接超时或全部为 token 截断。三条 Squid ai_billing_requests 均为 refunded，Octopus billing_done=true / billable=false；billing_reserved 是曾预扣标记，不能单凭该字段判为尚未退款。
- SepiLens 识别 Chat 的 finish_reason=length 和 Responses 的 incomplete/max_output_tokens，不再将明确截断归为通用连接失败。沿用当前请求、三分钟期限和最多一次纠正预算：首次截断丢弃部分内容/工具调用，禁用后续工具，保留既有工具历史与证据，将输出预算从 8192 提至 16384，并要求精简最终 JSON；再次截断返回 AI_OUTPUT_INVALID，不采用、不结算。与已有格式纠正共享一次预算，不增加新平台请求或预扣，不改变正常请求的 8192 预算。
- 加密 agent 审计增加白名单 provider_failure / finish_reason，仅记录固定类别；不记录任意 provider 错误、响应正文、端点、密钥或临床原文到普通日志。明确 CNV cnv_context 必须为 disease_id / inheritance / rationale / source_ids 的扁平对象，并要求减少重复缺项描述；prompt_version=four-engine-ai-2.6-bounded-output。未知字段、分值及引用校验、Gain/Loss 独立规则与正式医学批准门禁保持。
- 本地及远端模型适配、agent、API、assessment、config、retrieval、rules 回归和生产构建通过，使用合成模型/检索。新增覆盖两种协议截断、部分工具绝不执行、成功纠正、再次截断拒绝、用量累计和纠正上限。没有重发历史请求或调用真实付费模型；真实模型是否恢复交付仍由用户刷新页面测试，不将合成测试称为真实模型验收。
- 仅替换 SepiLens 为 schemabio/sepilens:cnv-output-limit-20261027t015653z，健康、完整源码清单与运行镜像标签核验，网关检查并重载；其他容器身份和业务数据/账务/配置基线保持。无数据库迁移、生产测试保存或工作流调用。
- 保护资料 /home/ubuntu/schema/backups/cnv-output-limit-20261027T015653Z 含完整 SepiLens 保护源码/清单、原环境/Compose、SQLite 一致性备份、测试/构建日志、result.json、final-acceptance.json、语法核验的 rollback.py。从第 33 节精确运行源叠加，保留此前全部修复；代码回退须用户授权，不恢复业务数据库。完整业务库备份复用第 30 节。本轮尚未 commit/push，.gotmp 及凭据不入库，远端旧 Git HEAD 不能直接重建。


## 36. 2026-10-27 CNV 条款语义校验纳入一次有界纠正

- 用户再次报告 AI_OUTPUT_INVALID。最新 job-20cb6bc16e956467feb363b10279e56a 已完整返回 JSON，用时约 33.5 秒、2 轮，失败在 proposal_validate，未触发格式纠正。本次有充分审计可确认具体原因：无检索来源时 1A / 3A 被标 met，但缺少来源和 rubric 必需事实；1B / 2F 为 not_met，却填 score_hundredths=0，超出对应 rubric 允许范围。不是本次连接超时或截断。诊断在服务器内只读解密重放，仅输出固定条款码、数值和违规类型，没有输出患者背景、模型临床原文或密钥。
- 根因还包括纠正边界不完整：之前仅 JSON schema 校验参与 agent 的一次纠正，CNV 分值/来源/事实/互斥等校验在模型执行结束后才运行，因而直接失败。新增 RunValidatedContract，将 CNV 精确建议及引用别名映射后的语义验证接入同一纠正循环；保留执行后独立复核。一次收集至多 24 项固定字段路径/原因，告知模型按真实证据修正；与 JSON 格式、长度纠正共用一次预算、原工具历史和三分钟总期限，纠正时禁止工具。未知来源、非法分值和缺失事实不静默改成合法内容，不提高正式医学规则批准状态。
- 提示明确未满足/未知条款使用 null 分值，不以 0 占位；真实零分的 met 仍须满足来源及事实前提，证据缺失应输出 insufficient_data。原始非法建议、校验原因及纠正后的建议保留在既有加密审计中，模型事实不能直接升级为确定性规则事实。prompt_version=four-engine-ai-2.7-cnv-validation。
- 新增两引擎真实 HTTP 合成模型测试，复现 met 缺少来源/事实及 not_met 零分越界；验证一次纠正后交付信息不足、两次非法拒绝且 settlement_eligible=false、纠正禁用工具、用量累计。本地 go test ./... 全部通过；服务器 agent/LLM/API/assessment/config/retrieval/rules 回归及生产构建通过。真实模型仍由用户测试，没有重发历史请求或生产保存。四条历史 CNV Loss 请求的 Squid 计费状态均为 refunded。
- 仅更新 SepiLens 为 schemabio/sepilens:cnv-semantic-repair-20261027t022004z，健康、完整保护源码/运行镜像标签核验，网关检查并重载；其他容器身份、业务数据/账务/配置基线保持。无 schema 迁移、工作流或真实模型调用。
- 保护资料 /home/ubuntu/schema/backups/cnv-semantic-repair-20261027T022004Z 含完整 SepiLens 源码/清单、原环境/Compose、SQLite 一致性备份、回归/构建日志、result.json、final-acceptance.json 与语法核验的 rollback.py；基于第 35 节精确运行源叠加，保留此前全部修复。代码回退须授权，不恢复业务数据库；完整业务库备份复用第 30 节。第 35–36 节修改仍未 commit/push，.gotmp 和凭据不入库，远端旧 Git HEAD 不能直接重建。


## 37. 2026-10-27 按用户明确要求自动填入 CNV 计算器、缺项用默认值并给出结果

用户明确要求“AI 评估后帮我把评估计算器填好并给出结果；能填的都填，缺失字段用默认值”。此要求更新第 30、36 节的交互和缺项处理：生成成功直接自动填表并重算，不再要求先点预览/确认填入，也不再因个别 CNV 语义条款不合格而拒绝整份有效 JSON 草稿。保存仍由用户点击，正式医学规则门禁保持。

- 前端 Region / Exon 共用流程：详情页 AI 返回后直接打开计算器；计算器内 AI 返回后直接填入当前表。合法且适用的建议映射到原计算器，其他已有手工/本地核实内容保留。缺失项补齐默认结构，未知选择保持未选、计数和贡献分数为 0，缺少遗传信息时选 5F（信息不可用、0 分）。第三节缺少确切编码基因数时显示默认 0，并记录 confirmed=false/defaulted=true；不把类别阈值反推为真实基因计数。
- 使用现有 Loss/Gain 本地计算器立即重算五节分数、总分及分类；全中性默认值对应 0 分/VUS 的待复核草稿。显示已自动填入、默认值涉及哪些分节及可修改保存的说明；默认值不是已核实临床事实。四语言同步。AI 摘要、上下文、原结果/来源和 autoFilled/defaultedFields/skippedCodes 审计随现有 criteria.aiReview JSON 保存，重开保留。相同请求不会在重渲染/重新载入时覆盖已修改内容；引擎/变异绑定不符不填，保存接口继续由 Octopus 重新计算分数与分类。
- SepiLens 对已通过 JSON 结构约束的 CNV 建议执行确定性保守投影：有效条款保留；未知/重复条款剔除；缺来源/必需事实、越界积分及互斥满足条款改为 insufficient_data/null score/空事实与来源，后续表单使用中性默认值。不满足条款不保留其模型分值。错误疾病 ID 留空，不支持的上下文引用剔除。原始输出留在加密 run.Raw，固定原因记入 ValidationErrors，交付额外标记 calculator_draft/calculator_defaults。原始不合法医学断言不会变为合法加分事实。
- 第 36 节的 CNV 专属语义重试不再阻断交付，避免反复要求付费模型纠正本可默认处理的缺项。JSON 类型/引擎枚举等结构约束及其一次纠正、第 35 节长度预算保护仍保留；传输失败、不可解析结果等仍不能声称完成 AI 评估。prompt_version=four-engine-ai-2.8-cnv-autofill。计费协议/开关、正式规则批准状态、数据库 schema 均未改变。
- 本地类型检查、自动填表/中性默认/重算/人工修改/两个入口测试通过，SepiLens 全仓库 go test ./... 通过。远端 SepiLens 模型/API/assessment/config/retrieval/rules 回归及构建通过；前端 12 文件 74 项回归、生产构建通过，无跳过，包含原始 CNV 保护副本真实 WASM 只读回归（64732 行、19288 事件、1 条可评分置顶）。没有实际模型调用、生产保存或工作流测试，真实付费模型仍由用户测试。
- 按顺序仅更新 SepiLens 为 schemabio/sepilens:cnv-default-draft-20261027t023827z、YiJian 为 schemabio/yijian:cnv-autofill-20261027t023917z，均健康、源码清单和镜像标签核验，网关检查重载。Octopus/Squid 等其他服务保持；两轮业务数据/人工调整/账务/配置基线均未改变。
- 两个保护目录分别为 /home/ubuntu/schema/backups/cnv-default-draft-20261027T023827Z 与 /home/ubuntu/schema/backups/cnv-autofill-20261027T023917Z，含完整对应源码/清单、原部署环境、构建/回归日志、result.json、final-acceptance.json、语法核验的 rollback.py；SepiLens 另有 SQLite 一致性备份。基于第 36 节 SepiLens 和第 31 节 YiJian 精确运行源叠加，保留此前修复。代码回退须授权，不恢复业务数据库；完整业务库备份复用第 30 节。第 35–37 节仍未 commit/push，运维 .gotmp、保护副本和凭据不入库，远端旧 Git HEAD 不能直接重建。


## 38. 2026-10-27 CNV 自动填表及默认草稿本地提交

- 用户要求提交本次更新。SepiLens 已本地提交 `81f8ac5`（CNV 默认草稿投影、固定校验诊断、模型输出长度处理与回归）；YiJian 将自动打开/填入计算器、缺项默认、立即重算、人工修改及保存恢复标记、四语言、相关回归和第 35–38 节交接一起提交，具体提交号以 Git 记录为准。
- 第 35–37 节“未 commit/push”为当时状态，当前提交状态以本节与各仓库 Git 记录为准。本次仅本地 commit、不 push，复用已通过的本地/服务器测试和构建，不重新调用模型或更改线上镜像、业务数据及账务。Octopus / Squid 无新增改动。
- .gotmp 运维材料、保护副本及凭据不入库；线上精确源码以第 37 节保护目录/清单及镜像摘要为准，远端旧 Git HEAD 不能直接重建运行镜像。

## 39. 2026-10-27 SaaS 新用户示例发放：本地实现，尚未上线

- 本地 Squid / Octopus / Cuttlefish / YiJian 已实现审核时可选发放示例：默认勾选，一组织一次；以审核事务记录的 T0 为起点，样本/结果 720 小时、FASTQ/BAM/BAI 168 小时。发放复制预计算结果，不启动计算或 AI、不扣积分；后续操作遵守已有策略。
- 平台模板独立保存在对象存储，按不可变版本发布；每次发放复制到新组织的独立路径。持久投递、机器签名、暂停/恢复、逐项校验及原子发布避免重复、半套可见和期限重置。用户端读取 Squid 队列状态，存储初始化期间也能显示准备中。BAM 和 FASTQ 删除历史版本，结果压缩包排除 BAM。
- 模板功能只适用于 SaaS：接口、示例表迁移、后台工作线程均受版本门禁保护，自部署不显示或调用示例功能。现有 WDL 流程模板不属于本功能。Squid 需显式 `DEPLOYMENT_EDITION=saas`；仓库 SaaS Compose 及 Octopus 必需覆盖配置已补齐该项。
- 操作说明及启用门槛见 `Octopus/docs/SAAS_EXAMPLE_DATA.md`。生产还没有选定/发布示例模板，也没有部署本阶段代码。必须先核实既有备份/删除策略，再在隔离组织验收真实选定的模板；不要仅为启用功能自动打开清理开关或设置核实标记。
- 本机专用 PostgreSQL 18 与版本化 MinIO 的真实复制、幂等、暂停恢复、原子发布、审核失败回滚、下载期限、Parquet 对象定位、BAM 历史版本清理和部分副本到期清理通过；两前端类型检查、相关测试及生产构建通过。Octopus 全仓库测试中的既有 PythonOracle 对照数据缺少 `svcv4AIResult`，已在干净 HEAD 复现；该结果引擎目录未被本阶段修改。
- 本阶段尚未 commit/push，无生产账号审批、示例发放、模型/工作流请求或业务数据变更。远端镜像仍以第 37 节为准；本机验收使用合成数据和独立测试容器。

## 40. 2026-10-27 SaaS 示例发放本地提交

- 按用户要求将第 39 节实现本地提交：Squid `080e939`（审核事务、持久发放队列及状态）、Octopus `c953655`（SaaS 模板、组织独立副本、保留策略及集成测试）、Cuttlefish `acdebb1`（审核发放选项和重试）。YiJian 将示例标签、准备/到期提示、四语言、测试及本节交接一并提交，具体提交号以 Git 记录为准。
- 第 39 节“尚未 commit”为当时状态；当前以本节和 Git 记录为准。本次仅本地提交、不 push、不部署，沿用已通过的测试和构建。模板尚未选定/发布，生产版本及业务数据保持。临时测试容器及其匿名卷已清理，`.gotmp`、源码验收副本和运维材料不入库。

## 41. 2026-10-28 仓库刷新及 SaaS Stripe 支付接入部署

- 先前仓库刷新已将六个应用仓库同步至各自 origin/main。之后按用户批准的计划实现并部署 Stripe：Squid / Cuttlefish / YiJian 当前均为 `schemabio/<service>:stripe-payments-20261028t152642z`，healthy。Octopus 保持 `github-refresh-20261028t143037z`，SepiLens 同为 `github-refresh-20261028t143037z`；其他容器保持。新增浏览器优化及 AI 证据链开关仍默认关闭。
- Cuttlefish 平台计费页支持 test/live 独立配置、只写密钥、商品价格验证、启用/暂停收款、订单分页/对账及事件失败重试。密钥由 Squid 独立 AES-GCM 主密钥加密保存，版本保留供历史订单使用，不向页面回显。每次保存暂停该模式收款并撤销验证。
- YiJian 充值页支持真实价格、Stripe 托管 Checkout、订单与返回状态；超时保留幂等键，返回页只读订单。每件 Credit 对应 1 积分，数量 1～5000。首版仅银行卡及可用卡钱包，单一一次性 Price，无套餐、折扣、附加税费或动态换汇。
- Squid 增加独立支付配置版本、持久订单、签名事件收件箱、重试与对账，官方 SDK `stripe-go/v87 v87.0.0`，API `2026-09-30.endive`。Webhook 使用 Snapshot 格式，路径 `/api/v1/payments/stripe/webhook`，独立验签且仅该路径豁免 CSRF。订单/余额/流水原子处理、事件及订单双重幂等；test 模拟到账不写真实余额或充值流水。
- 退款在 Stripe Dashboard 发起，平台按累计成功退款金额比例向下取整追回积分；真实支付争议开启追回剩余积分，胜诉恢复非退款部分，败诉保持。追回可形成负余额，保留既有消费准入；不改历史流水。旧订单、退款和对账在暂停收款后继续处理。
- 服务器已安全生成独立主密钥文件 `/home/ubuntu/schema/saas-deploy/secrets/payments/master.key`，只读挂载至 Squid `/run/secrets/payment_master_key`，通过 `PAYMENT_ENCRYPTION_KEY_FILE` 使用。`PAYMENT_PUBLIC_ORIGIN=https://yijian.schema-bio.com`。不要读取/输出、丢失或直接覆盖主密钥。Stripe API Key、Webhook Secret、商品/Price 尚未配置；test/live 均关闭，四张新支付表无订单/配置/事件记录。
- 原 Squid 存在 1 项待应用计算配置。发布前在远端内存核对加密 applied 快照与 live effective 配置一致，部署新增 `SAAS_SETTINGS_PRESERVE_APPLIED=true`，启动使用 applied，不应用/清除 desired，不修改 applied_revision。前后数据库摘要及 effective_values/effective_secrets/revision/applied_revision/restart_required 一致。该选项保持开启，直到用户明确安排应用计算配置。
- 本机专用 PostgreSQL 18 的支付生命周期、模拟隔离、加密/轮换、签名时间与原始字节校验、事务回滚、并发唯一入账、跨组织隔离、超时原键恢复及配置保留回归通过；Squid 全仓库编译检查通过。YiJian 38 项相关测试及类型检查、Cuttlefish 8 项相关测试及类型检查通过。三服务 Linux 生产构建、容器健康、正常用户/管理员只读接口、Cuttlefish 支付代理、公网页面和网关验收通过。无签名的公网 Webhook 返回 400，确认到达签名门禁；不等于已完成 Stripe 真签名投递或测试卡闭环。
- 扩大后端全量回归遇到 `TestDurableQueueConcurrentAdmissionAndCancellation` 超时，以及既有 CVM preflight/start_failed 测试返回 `Expiry fence unavailable`。已在干净 HEAD 的隔离副本复现同样问题；本阶段未修改相关 CVM 路径，不声称全量回归通过。证据保留在本机 Squid `.gotmp/stripe-baseline-regression/baseline.log`。
- 保护目录 `/home/ubuntu/schema/backups/stripe-payments-20261028T152642Z` 包含三仓库完整源码/清单、两业务库 PostgreSQL 18 scoped dumps、原环境/Compose/nginx、独立主密钥保护副本、基线、effective 配置记录、构建日志、result.json、final-acceptance.json 和语法核验的 rollback.py。手工回退脚本在存在待应用计算配置或 live 订单时主动拒绝，以免旧 Squid 应用待配置或丢失在途支付处理；不得直接恢复旧数据库。先准备保持配置与支付处理能力的兼容回退，且代码回退须用户授权。
- 正式收款未启用，Stripe 测试卡及真实签名回调验收因缺少测试凭据待完成；没有创建真实 Checkout、调用付费模型/计算工作流或改变生产积分。管理员可在 Cuttlefish 配置测试凭据后按 `Squid/docs/STRIPE_PAYMENTS.md` 完成测试；live 需要独立配置、验证及管理员主动启用。
- 三仓库本轮功能修改及本文交接尚未 commit/push；远端运行使用精确源码快照 overlay，`source_dirty=true`，不能从远端旧 Git HEAD 直接重建。临时本地 PostgreSQL 测试容器及匿名卷已清理；`.gotmp`、保护副本、凭据均不入库。

## 42. 2026-10-29 Stripe 接入本地提交

- 按用户要求提交第 41 节实现：Squid `b3e7de5`（Stripe 配置加密、Checkout/订单、签名回调、幂等到账、退款争议、配置保留及测试）；Cuttlefish `2ae0882`（分模式只写密钥配置、验证/启停、订单对账、事件重试及测试）。YiJian 将收银台、订单状态、四语言、账本展示、测试和第 41–42 节交接一起本地提交，具体提交号以 Git 记录为准。
- 第 41 节“尚未 commit/push”为当时状态；当前以本节及各仓库 Git 记录为准。本次仅本地提交、不 push、不重新部署，不调用 Stripe、模型或计算流程，不更改线上配置、业务数据及账务。
- 沿用第 41 节已通过的支付相关测试、生产构建及线上验收；既有 CVM 全量回归失败和缺少 Stripe 凭据导致的真实测试卡/签名投递验收限制仍保留。test/live 收款均保持关闭。
- `.gotmp` 运维资料、保护副本和密钥不入库；线上精确运行源码仍以第 41 节保护目录、清单及镜像摘要为准。

## 43. 2026-10-29 积分充值页版式优化本地提交

- 本地优化 YiJian 充值页：左侧积分选择、右侧支付确认、下方独立订单记录；增强选中状态、金额层级、加载和空列表提示。手机订单采用卡片，适配窄屏和深色主题；四语言文案同步。
- 相关 32 项测试、类型检查和生产构建通过；通过本地合成数据浏览器预览检查桌面、390px 窄屏、深色主题及支付未启用状态。未发起真实支付。
- 本轮按用户要求仅本地提交，不 push、不部署；线上仍为第 41 节版本。支付行为、单一 Stripe Price 决定币种及现有收款开关不变；本地预览和截图位于忽略的 `.gotmp/recharge-layout-preview/`，不入库。

## 44. 2026-10-29 后台直接定价提交及周末上线核对

- 按用户要求本地提交 Squid `2c1abc3`、Cuttlefish `d2e7c02`：配置密钥、币种和精确十进制积分售价，显式同步不可变 Stripe Price；保留旧 Price 接入、历史订单及 test/live 隔离。新增 SaaS payment_catalogs 绑定表与配置字段，先部署 Squid 再部署 Cuttlefish。相关前端 27 项测试、类型检查、生产构建及后端隔离 PostgreSQL 支付回归、全仓编译通过；无真实 Stripe 调用。
- 12:46 只读核对五服务 healthy、running、重启数零，线上镜像仍为第 41 节版本；新定价及第 43 节排版未部署。两公网入口 200，无签名回调 400；test/live 均未配置、未验证、关闭，支付配置/订单/事件零行。不能声明真实 Stripe 测试卡及签名回调验收完成。
- preserve-applied 仍 true、待应用计算配置一项。支付主密钥权限 0400，第 41 节密钥保护副本及两业务库 dump 存在；未读取密钥或恢复数据。主机可用空间约 14.3 GiB。
- 上线判断和待关闭门禁见 `docs/WEEKEND_LAUNCH_READINESS_20261029.md`。通用发布清单及既有 CVM 基线失败仍需最终版本验证和风险处置，不因支付相关测试通过而视为全量通过。当前结论是服务健康、正式收款及客户试运营准备尚未全部验收。
- 本次不 push、不部署、不应用计算配置，不发起支付、AI 或计算任务；本地合成预览和验收脚本仍在忽略的 `.gotmp`，不入库。

## 45. 2026-10-29 COS直连下载防护本地实现（尚未上线）

- 用户确认保留COS直连，接受1.3倍为日志检测后的停发阈值而非实时硬上限；固定公网IP，不自动换绑，网络变化经Cuttlefish管理员审批；达到阈值后用户可明确确认重新购买，不能自动扣分。
- Octopus新增SaaS防护数据、精确整数阈值、IP限定STS、签发标识摘要、CLS分页消费/去重/事务累计、停发与故障暂停、用户换绑申请及管理操作；Squid允许专用管理代理，由已验证平台管理员身份签名；Cuttlefish平台计费页新增筛选/详情/审核/暂停/同步入口；YiJian四语言展示观测流量、IP和网络申请状态。
- 防护默认 `DOWNLOAD_PROTECTION_ENABLED=false`。本轮没有开通或配置COS→CLS，也未完成真实云验收，没有改动远端镜像、存储权限或下载链路。开关关闭不允许已保护申请降级为无IP签名；历史申请须在生产启用前排空。DuckDB不升级。
- 本地使用独立PostgreSQL和合成HTTP/CLS数据验证并发去重、事务回滚、跨组织、换绑等待、阈值、刷新唯一扣费、日志分页故障与重启恢复；修复首次同步时GORM连接句柄残留ErrRecordNotFound导致无法创建状态记录的问题。前端相关30项测试、类型检查及两前端生产构建通过，Squid/Octopus Linux amd64编译通过。专用测试容器及匿名卷已清理。云端真实IP/小对象下载/日志关联仍待验收，不能用合成结果替代。操作和发布说明见Octopus `docs/DOWNLOAD_PROTECTION.md`。
- 本次实现尚未commit/push或部署。不得恢复旧账本覆盖申请、日志及账务，也不得回退至会给已保护申请签发无IP链接的版本；Squid待计算配置继续保留保护。

## 46. 2026-10-29 下载防护本地提交

- 按用户要求提交第45节实现：Octopus `f4a9ff8`（IP绑定、CLS观测阈值、审批和回归）、Squid `e2241b5`（受控管理代理）、Cuttlefish `d936aab`（事件、审批、暂停和同步管理）。YiJian将用户端状态、网络申请、四语言、测试及本节交接一起提交，具体提交号以Git记录为准。
- 第45节“尚未commit”为当时状态；本轮仅本地提交，不push、不部署、不启用防护。沿用第45节验收，CLS配置与真实云小对象验收仍待完成。线上下载行为、云资源、业务数据及账务保持不变，临时材料和凭据不入库。

## 47. 2026-10-29 注册审核空列表崩溃热修复

- 用户报告注册审核页显示“This page couldn’t load”。只读确认`/registrations` HTTP200、管理员审核接口200，但无待审核申请时`items:null`。原页面访问`queue.items.length/map`导致浏览器渲染崩溃。
- Cuttlefish在读取边界把有效空`items/budgets`与空审核历史规范为数组，格式错误及上游失败仍显示不可用，不伪装为空列表。12项本地/服务器审核相关回归与生产构建通过。
- 仅热发布Cuttlefish为`schemabio/cuttlefish:registration-null-20261029t082107z`，healthy；登录后的审核代理和页面HTTP200。Squid、Octopus、YiJian、SepiLens容器身份及Cuttlefish运行环境保持，没有执行审批、付费计算、云实例销毁或账务变更。
- 发布目录`/home/ubuntu/schema/backups/registration-null-20261029T082107Z`含原环境/Compose/nginx、精确Cuttlefish源码与摘要、构建/测试日志及result。严格基于第41节运行源码，仅叠加注册审核组件及回归，不包含本地直接定价、下载防护或计算实例页。回退只更新Cuttlefish镜像引用，不恢复数据库。

## 48. 2026-10-29 独立计算实例运营页本地实现

- 运营中心新增`/compute`，查看平台持久化的当前申请、实例、诊断保留及待释放/历史记录，含ID、地域规格、心跳、快照时间与释放状态；分页、搜索、30秒刷新及数据不可用提示。不是云账号全量扫描或CPU/内存实时监控。
- Squid新增安全投影列表与平台管理员终止接口。用户手动输入完整实例/执行ID、原因、冻结version；服务端锁定精确attempt并校验身份，终止意图、outbox和审计同事务提交。HTTP不直接调用云销毁接口；既有后台完成销毁确认、回调和结算。支持释放失败重试，重复受理幂等。
- 本地20项前端相关测试、独立PostgreSQL的身份/版本/审计回滚/outbox回归及后端相关释放/取消测试通过。新功能尚未部署；只有第47节审核修复上线。不得执行真实销毁作为验收。发布仍须保留Squid待应用计算配置保护；操作说明见Cuttlefish `docs/COMPUTE_OPERATIONS.md`、Squid `docs/CVM_ADMIN_OPERATIONS.md`。
- 第47–48节源码及本文尚未commit/push。用户后续提交时区分已上线审核修复与未上线计算实例功能；临时发布材料、凭据和测试数据不入库。

## 49. 2026-10-29 移动端状态摘要本地更新

- YiJian任务中心、样本管理、数据中心在767px以下改为摘要卡片，优先显示样本编号与真实任务/数据状态；操作、UUID、到期时间等折叠。任务保留分析阶段与进度；样本的数据匹配状态不冒充分析完成。768px起使用原表格，概览和位点筛选流程保持原样。
- 合成预览核对320px、390px和768px切换，相关39项交互回归、类型检查与生产构建通过。实现尚未commit/push或部署。

## 50. 2026-10-29 SaaS公告本地实现

- Cuttlefish运营中心新增「公告管理」，支持纯文本标题/正文、开始/结束时间、启用状态和banner开关；默认持续24小时，可编辑。Squid新增announcements表与管理员/登录用户接口，按服务器UTC筛选有效公告；保存使用revision并发控制，与操作审计同事务，审计不复制正文。
- YiJian仅SaaS版桌面/手机右上角显示公告按钮，顶部展示启用banner的有效公告。关闭记录按用户及公告版本保存在当前浏览器，不影响公告中心查看；编辑后新版本重新提示。每分钟/恢复页面可见时刷新，客户端按服务器时间差自动隐藏已到期公告；四语言界面，公告正文保留管理员原文。窄屏余额显示改为紧凑样式以容纳公告入口。
- Cuttlefish7项公告/导航回归、YiJian53项公告/语言/列表交互回归、隔离PostgreSQL的窗口筛选/并发编辑/审计回滚及后端鉴权输入回归通过；两个前端生产构建及Squid Linux构建通过。合成浏览器验收手机入口、详情、关闭后可查看与320px顶栏；未向生产用户发布公告、未触发云计算或收费。
- 公告尚未commit/push或部署；线上仍为第47节审核热修复。发布顺序Squid→Cuttlefish→YiJian，保留待计算配置保护，不恢复旧库覆盖新公告。操作说明见相邻Cuttlefish仓库 `docs/ANNOUNCEMENTS.md`。

## 51. 2026-10-29 运营功能提交及远端部署完成

- 按用户要求提交并部署：Squid `01a120e`（公告与带版本校验的计算实例管理）、Cuttlefish `ee164b3`（公告/计算运营页、审核空队列修复）、YiJian `d44f2ae`（SaaS公告、banner及移动端状态摘要）。Octopus配套发布此前提交 `f4a9ff8`，保持下载防护管理接口兼容；本节后续文档提交不改变运行功能源码。未push，远端使用这些精确提交的归档构建，不依赖旧远端Git HEAD。
- 四个运行镜像均为 `schemabio/<service>:ops-announcements-20261029t094949z`（octopus、squid、cuttlefish、yijian），逐个healthy且重启数0；SepiLens、Sepiida与网关容器身份未改变，网关配置检查和reload成功。前端读取仍使用原安全入口，无新增公开后端端口或放宽入口保护。此前已提交的后台Stripe直接定价、充值页排版随完整提交归档一并上线。
- 受保护发布目录：`/home/ubuntu/schema/backups/ops-announcements-20261029T094949Z`，包括两业务库dump（Squid 249197字节、Octopus 98329216字节）、原env/Compose/nginx/override与secrets副本、旧镜像回退标签、各提交源码归档及摘要、构建/测试日志、result.json和verification.json。数据库只新增表/字段，未恢复旧库。
- 本机相关回归：Cuttlefish25项、YiJian53项及类型检查通过；隔离PostgreSQL实际执行公告时间窗口/并发版本/审计回滚、计算终止意图/身份/版本/outbox、Stripe与支付配置回归、保留计算配置安全激活用例，以及Octopus下载防护/原COS兼容回归。服务器Linux镜像构建通过，Cuttlefish25项回归与typecheck、YiJian公告/语言14项回归通过。既有CVM全量套件历史问题未因此宣称全部解决。
- 线上验收：管理员登录后公告、计算实例、注册审核、支付设置、下载防护只读接口及代理成功；公告/计算/审核页面200；公告非法输入400、CSRF错误403，公网未登录公告接口拒绝，Stripe无签名回调400。没有创建生产公告、审批用户、发起真实支付/模型/计算任务或测试销毁云实例。
- 首次写入验收因直连容器时验收脚本未带网关forwarded-host/proto而触发同源保护，自动回退镜像；修正验收来源头后复用已验证镜像重新发布成功。问题在验收请求，不是关闭产品的同源/CSRF检查；过程中没有恢复数据库、覆盖账本或发布公告。原始失败记录与修正后的resume脚本均保留在受保护目录。
- 独立复核账本、余额、用户状态及业务表摘要不变，Squid有效配置及applied加密快照保持，`SAAS_SETTINGS_PRESERVE_APPLIED=true`，待计算配置仍1项。Stripe test/live收款仍关闭；下载防护仍关闭，不因代码上线宣称真实Stripe测试卡或COS/CLS闭环验收通过。当前公告0条，管理员可在Cuttlefish「运营中心→公告管理」编辑投放。
- 回退先检查没有运行任务并暂停新支付/签发，使用保护目录的镜像引用切换，保持现有数据库、密钥与支付/下载记录；启用收款后不得直接回到不能处理新订单的旧版本。第47–50节“未部署/未提交”均为当时状态，以本节为准。

## 52. 2026-10-29 公告管理与用户端横幅同步重设计上线

- 根据用户截图重做Cuttlefish公告列表的间距、状态、渠道、时间和编辑入口；单页不显示无效分页按钮。编辑抽屉分内容、投放计划及展示设置，提供1/3/7天快捷持续时间与并排用户端预览，窄屏改为单列。YiJian横幅改为低饱和单行通知栏（桌面约48px、手机约64px），标题、摘要、查看和关闭横向组织，公告详情同步优化；四语言说明及深色主题适配。
- Cuttlefish设计提交 `7264832`，运行归档为后续临时预览忽略规则提交 `97773a4`；YiJian设计提交 `273ee89`。文档提交不改变运行源码。未push。
- 两个前端已部署为 `schemabio/<service>:announcement-design-20261029t111450z`（cuttlefish、yijian），均healthy、重启0。Squid、Octopus、SepiLens及其他后端容器身份保持，网关检查/reload成功；没有数据库迁移、现有公告编辑、真实支付/AI/计算或云销毁操作。
- 本机及服务器Cuttlefish7项公告/导航回归、YiJian14项公告/语言回归、类型检查与生产构建通过。合成浏览器核对桌面列表/编辑器、390px编辑抽屉、320/390px横幅及深色主题；本机预览语言资源缓存刷新后新文案正常。线上独立核对新版CSS实际提供，登录后的页面/API、非法公告输入400及CSRF拒绝403通过。
- 发布目录 `/home/ubuntu/schema/backups/announcement-design-20261029T111450Z` 保存精确源码归档与摘要、旧镜像回退标签、原env/Compose/nginx、前后业务/现有公告摘要及构建/测试日志、result和verification。原公告内容、起止时间、状态与revision摘要不变，账务及计算配置保持；正式收款和下载防护仍关闭。仅回退前端镜像，不恢复数据库。

## 53. 2026-10-29 公告按组织UUID定向投放上线

- Cuttlefish编辑器新增「全部组织／指定组织」，支持每行或逗号分隔UUID，最多50个，规范化去重并验证组织存在；列表和预览显示投放范围。旧公告默认全体，旧管理客户端省略范围时保留既有定向设置。
- Squid按认证上下文的组织过滤有效公告，忽略客户端org_id参数；用户响应不返回目标名单。YiJian公告中心与banner共用此结果，切换组织立即隐藏旧公告，重新加载并核对响应组织；失败或组织不匹配时不显示旧内容。数据库只新增audience和target_org_ids字段。
- 功能提交：Squid `58aafcf`、Cuttlefish `8e95311`、YiJian `905fad0`，均已本地提交、未push；三服务顺序发布为 `schemabio/<service>:announcement-audience-20261029t112950z`，独立复核healthy、重启0，其他后端容器身份保持。
- 隔离PostgreSQL实际验证旧表迁移、双组织可见范围、无效组织拒绝、旧客户端保留范围、定向变更与恢复全体，以及认证组织隔离及参数伪造；相关Go测试通过。Cuttlefish本机7项、服务器含导航9项回归，YiJian公告/语言15项回归及两个前端类型检查、生产构建通过；Squid Linux镜像构建通过。合成浏览器核对指定组织编辑器。
- 生产只读验收认证组织过滤、伪造org_id无效、用户响应不泄漏目标UUID；未创建或修改生产公告。原有1条全体公告的内容、时间、状态、revision摘要保持，业务和账务摘要保持。待计算配置仍1项，preserve-applied继续开启；收款和下载防护仍关闭，没有真实支付、付费AI、计算任务或云销毁操作。
- 保护目录 `/home/ubuntu/schema/backups/announcement-audience-20261029T112950Z` 含业务库备份、部署配置和密钥保护副本、旧镜像标签、精确提交归档与摘要、构建/测试日志、result.json及verification.json。回退不得恢复旧数据库；一旦存在定向公告，禁止降级到不支持组织过滤的旧Squid，发布脚本回退保护会保留兼容Squid，可单独回退前端。
## 54. 2026-10-29 公告横幅醒目程度优化上线

- 根据用户反馈增强YiJian公告辨识度：暖金色背景、左侧强调线、较大广播图标、加粗标题、独立摘要和带边框的查看入口。桌面最小高度72px、手机80px，多公告区域限制高度；深色主题独立配色，公告铃铛提示点增大。不改变公告组织隔离、有效期及关闭记忆。
- 功能提交 `b4ce434`，仅YiJian发布为 `schemabio/yijian:announcement-emphasis-20261029t133233z`；本地和服务器15项公告/语言回归、类型检查及生产构建通过，合成浏览器核对桌面、深色和实际320px窄屏无横向溢出。未push。
- 独立线上验收镜像提交一致、healthy、重启0，公网CSS包含新样式。前后业务及全部公告摘要、计算有效配置不变，其他后端容器身份保持；未修改公告或触发支付、AI、计算及云资源操作。收款与下载防护仍关闭，待应用计算配置继续保留。
- 受保护发布目录 `/home/ubuntu/schema/backups/announcement-emphasis-20261029T133233Z` 保存原部署配置、旧前端镜像回退标签、精确源码归档/摘要、构建及回归日志、result.json和verification.json。仅回退YiJian镜像，不恢复数据库，不降级组织过滤后端。
## 55. 2026-10-29 Cuttlefish计算实例页渲染优化上线

- 顶部增加筛选结果总数、本页运行中、本页待释放摘要，不将本页统计冒充全平台总量；实例卡按编号/状态、规格地域、组织任务、执行阶段与心跳分层。释放失败突出显示，完整执行ID及生命周期时间折叠；单页无无效翻页按钮。手机及销毁确认抽屉适配320px，保留原因、精确ID和version围栏、CSRF及只读门禁。
- 主分支功能提交 `b4f6f83`。构建前发现另一个工作流程已提交支付安全改动 `d1dbf76`，首次构建在切换前主动停止，部署环境未变。重新以已上线兼容基础 `ba13aaf` 只叠加四个计算页文件，生成独立发布提交 `3875409`，保存在本地 `codex/compute-render-release` 分支。运行源码以该独立提交为准，不能从当前main直接重建本次镜像；支付安全等其他工作流程改动不包含在本次部署。
- 仅Cuttlefish镜像切换为 `schemabio/cuttlefish:compute-design-20261029t145708z`；本机及服务器8项计算交互/终止代理回归、类型检查与生产构建通过。合成浏览器核对桌面、手机及确认抽屉；未在生产提交释放请求。
- 线上鉴权列表与代理、公网页面、CSRF/非法输入门禁及新CSS验收通过；独立核对镜像提交一致、healthy、重启0。前后业务和全部公告摘要、计算有效配置不变，其他后端容器身份保持；待计算配置继续保留，收款和下载防护保持关闭。
- 保护目录 `/home/ubuntu/schema/backups/compute-design-20261029T145708Z` 保存原部署配置、旧镜像回退标签、精确源码及摘要、构建/回归日志、result.json和verification.json。停止的首次构建记录在同前缀 `20261029T145538Z`，未切换。回退只切换Cuttlefish镜像，不恢复数据库或降级组织过滤后端。未push。
## 56. 2026-10-29 YiJian公告改为按钮锚点浮层

- 公告中心改为右上角公告按钮下方展开的非模态浮层，不使用居中AppModal，不添加遮罩、背景变暗、页面滚动锁或焦点陷阱。支持按钮再次点击、外部点击/焦点移出、Esc及关闭按钮；Esc和关闭按钮将焦点归还触发按钮。横幅查看入口共用该浮层，组织切换仍立即清空旧公告。
- 浮层通过Portal避免顶栏裁切，按按钮位置计算并在滚动/窗口变化时更新，宽度不超过460px、窄屏两侧保留12px，高度受视口约束，公告列表内部滚动。桌面及320px合成浏览器核对锚点、外部关闭和背景无遮挡通过。
- 主分支功能提交 `933326d`；为避开并行协议/支付工作，基于线上兼容基础 `f2f90f6` 仅叠加三个公告相关文件，生成独立发布提交 `0a49b1d`，保存在本地 `codex/announcement-popover-release` 分支。运行镜像为 `schemabio/yijian:announcement-popover-20261029t151255z`，不要从当前main直接重建该精确版本。未push。
- 本机及服务器17项公告/四语言回归、类型检查和生产构建通过。最初采用的第三方浮层在JSDOM中出现超时，已改为仅使用React Portal及原生定位/交互的实现，并通过真实实现的自动化和浏览器验收，不保留替代库的测试mock。
- 独立线上核对镜像提交、新CSS、healthy及重启0；前后业务、全部公告摘要与计算配置保持，其他后端容器身份保持。未改生产公告、触发收费或真实计算/云销毁；待计算配置仍保留，收款及下载防护保持关闭。
- 保护目录 `/home/ubuntu/schema/backups/announcement-popover-20261029T151255Z` 保存原部署配置、旧镜像回退标签、精确源码归档及摘要、构建/回归日志、result.json及verification.json。只回退YiJian镜像，不恢复数据库或降级组织过滤后端。
## 57. 2026-10-29 登录页移除验证邮件重发快捷入口

- 登录页不再直接显示「重新发送验证邮件」，保留注册入口、注册提交后的提示及邮箱验证页重发能力。没有改动注册接口、验证token、挑战或发送邮件逻辑，没有实际发送邮件。
- 主分支提交 `621e4ec` 包含入口修正及既有登录回归断言。本机13项登录/注册挑战/验证回归和类型检查通过。为避免携带并行协议改动，部署以第56节精确版本 `0a49b1d` 仅删除登录页一行，独立提交 `4ecbe2d` 保存在本地 `codex/login-resend-cleanup-release` 分支；镜像 `schemabio/yijian:login-cleanup-20261029t152140z`。未push。
- 服务器10项验证/挑战回归、类型检查和生产构建通过。独立公网检查登录页无verify-email链接、注册链接保留、验证页200；镜像提交一致、healthy、重启0，业务/公告摘要及计算配置保持，其他后端容器身份不变。验收模板首次误替换公告CSS名称导致断言失败，修正模板后全项通过，无产品代码变更或回退。
- 保护目录 `/home/ubuntu/schema/backups/login-cleanup-20261029T152140Z` 保存原环境、回退镜像标签、精确源码归档及摘要、构建/测试日志、result.json及verification.json。待计算配置继续保留，收款与下载防护仍关闭；回退仅切换YiJian镜像，不恢复数据库。
## 58. 2026-10-29 拉取完整最新版并部署使用协议及支付安全

- 按用户明确要求，从远端GitHub获取并使用 `git pull --ff-only origin main` 快进六个业务仓库及官网。既有远端codex运维分支无upstream，故显式指定origin/main；未重置工作区。本机部分私有仓库Git认证未通过，已通过远端既有合法认证完成获取，不要求用户重复提供凭据。
- 完整发布Squid `927239f`、Octopus `7c52aab`、Cuttlefish `53a98a2`、YiJian `90467be`、官网基础 `7ba7d90`。四业务及官网统一镜像标签 `latest-repositories-20261029t153312z`；SepiLens `e48d751`、Sepiida `52326bb` 已与最新提交一致，不重启。Schema_CPU镜像和云节点不变。
- 完整版包含登录《使用协议》及默认未勾选的确认框、公开service/terms/refund政策、购买单独确认、后台收款条件/支付风险、此前公告/计算/移动端更新。真实浏览器已确认登录入口及协议正文；独立检查四语言正文、服务版本、后台准入/风险代理、鉴权、CSRF、订单组织隔离与原入口保护。
- 官网首次启动因构建归档目录权限过严，普通用户读取 `/app/public/images` 被拒而自动回退；目录权限规范化仍命中旧COPY层，新增普通用户资源探针提前拦截，未切换。最终仅修复官网Dockerfile的public资源COPY归属（`--chown=nextjs:nodejs`），提交 `4d36b18`；通过仅含该提交的Git bundle同步到远端并快进，未push。官网实际运行源码以4d36b18为准，资源读取探针、生产构建、类型检查、健康与公开政策链接验收通过。
- 本机YiJian56项、Cuttlefish45项相关回归及类型检查通过；一次性隔离PostgreSQL18实际执行Squid支付/风控/准入/政策/公告service、handler、router回归，未跳过数据库验证；容器及匿名卷已清理。服务器两前端同组回归、类型检查及生产构建通过，Squid/Octopus Linux镜像构建通过。不声称既有CVM全量套件问题已解决，没有真实Stripe、AI、计算或云销毁操作。
- 独立核对四业务healthy、重启0，官网healthy；全部业务/公告摘要及计算有效/applied快照保持，待计算配置仍1项，preserve-applied继续开启。支付和下载防护保持关闭，真实Stripe测试卡/签名回调及COS/CLS验收仍待完成。支付只增量迁移准入/账户检查/预算/风险表及订单字段，没有恢复数据库。
- 保护目录 `/home/ubuntu/schema/backups/latest-repositories-20261029T153312Z` 含两业务库dump（Squid262817字节、Octopus98337922字节）、部署配置及密钥副本、旧镜像标签、精确提交归档与摘要、构建/回归日志、官网首次失败和恢复记录、result.json、website-result.json、all-result.json及verification.json。官网编排位于 `/opt/dpanel/dpanel/compose/schema-website-20260828/docker-compose.yaml`，仅更新镜像引用，运行环境/网络/9339端口保持。回退只切换镜像且须保留在途支付处理及组织过滤能力，不恢复旧库。


## 59. 2026-10-30 人工注册审核与Resend通知部署

- 已部署Squid `52566b3`、Cuttlefish `2878651`、YiJian `c32b7b6`，统一镜像标签 `manual-review-20261030t061831z`。注册直接进入人工待审核，不发验证码或验证邮件；通过后立即启用账号/组织并排队通过通知，拒绝不发邮件。姓名/机构选填、二次密码确认、Turnstile、限流及示例发放事务保持。未验证的历史申请可审批，但不伪造verified_at。
- Cuttlefish注册审核页新增“注册通知邮件”：默认SchemaBio / no-reply@schema-bio.com / support@schema-bio.com，可配置Resend只写Token、显式清除、测试邮件（仅当前管理员邮箱）和通过通知重试。Squid加密保存配置及版本；发送在事务外，租约、固定请求幂等键、每日限额和有界重试生效。Resend接受不等于送达，未知结果不盲目换键补发。
- 增量迁移取消历史未发验证/拒绝通知、撤销验证token，历史未发通过通知仅标记人工处理；不自动批准，不修改密码，不集中补发邮件。旧verify/resend接口410，旧verify-email页仅显示流程更新并清除URL token。找回密码及Octopus自部署注册未调整。
- 现场确认此前没有邮件主密钥、通知origin、Turnstile和注册入口配置。首次建立保护文件 `/home/ubuntu/schema/saas-deploy/secrets/registration/mail-master.key`（base64的32字节主密钥，UID1000、0400），只读挂载 `/run/secrets/registration_mail_key`；以后必须保留、备份，禁止重新生成覆盖。Squid设置固定通知origin为https://yijian.schema-bio.com，新增Turnstile/入口的空配置映射。既有业务密钥、网关和Cloudflare规则未更改。
- **当前公开注册仍关闭**：Turnstile site/secret和可信入口尚未配置；不能绕过这些条件开放注册。邮件主密钥就绪，可在Cuttlefish填写Resend Token；发件域名还需在Resend验证。Token当前未配置，无真实邮件发送、生产注册或人工审批验收。注册与邮件就绪状态已分离，邮件配置缺失不再是注册开关条件。
- 发布目录 `/home/ubuntu/schema/backups/manual-review-20261030T061831Z` 保存两业务库dump、原env/Compose/nginx/override与secrets副本、新邮件主密钥保护副本、三仓库精确归档/摘要、原镜像标签、构建/测试日志、本地数据库证据、result与verification。构建前暂存暂停状态，完成后恢复原值；切换顺序Squid→Cuttlefish→YiJian，三个容器healthy、重启0，其他容器身份及业务/公告摘要、计算有效/applied快照保持。
- 本机YiJian26项、Cuttlefish21项相关回归、类型检查及两个生产构建通过；隔离PostgreSQL实际执行注册/配置/队列/迁移/原子审计和示例发放回归，模拟Resend覆盖HTTP故障、凭据修正、租约恢复、固定正文/版本、重试窗口及每日限额；临时库容器已清理。服务器YiJian52项、Cuttlefish23项、类型检查和生产构建通过，Squid Linux构建通过；独立公网与认证接口、旧验证退役及后台静态资源摘要核对成功。
- 发布验收脚本先在切换前修正固定英文假设，随后因把本次已退出的临时测试容器纳入并发检查而停止；两次均未切换运行服务。核对生产容器和数据基线未变化后，排除该临时容器并复用已验证镜像完成切换；相关脚本/日志保留，未通过修改产品或恢复数据库掩盖问题。
- 回退必须保留已生效审批、新任务状态与主密钥；不得恢复旧库，不直接启用会无视新通知状态的旧邮件worker。完整配置、接口和回退说明见Squid `deploy/registration.md`、Cuttlefish `docs/registration-mail.md`。本轮功能及本记录已本地提交，未push GitHub。

## 60. 2026-10-31 组织业务资料重置部署

- Cuttlefish「租户详情 → 租户设置 → 高风险操作」新增「重置组织」弹窗。必须输入完全匹配的组织UUID、填写原因，可设置重置后的初始积分（0–100000000整数，绝对余额）及是否重新载入示例数据；示例在清理完成后异步排队。保留组织、成员账号、密码、配额和费率配置、历史财务金额及重置审计，不重置其他组织。
- 清理样本、数据中心资产和上传记录、任务及结果、报告、家系、项目、自定义基因面板/流程/报告模板、CNV基线、缓存和旧示例发放记录；对象存储仅清理校验过的 `organizations/<UUID>/` 命名空间（包括对象版本和未完成分片），共享参考资源保留。任务和样本沿用既有研究资料清理协议处理临床审计细节和上游身份。具体范围与接口见 `Cuttlefish/docs/organization-reset.md`。
- Squid持久化请求UUID和参数，组织重置期间暂停其访问与新增计费/业务；拒绝重置当前平台管理员所属组织。活动计算、上传、AI、报告生成/打包和未结算执行须先完成/停止。Octopus以签名机器请求按步骤清理，数据库围栏序列化并发写入；完成回执保留，旧请求重放不会再次清理新工作区。初始积分调整、示例发放排队、完成审计与最终状态在同一事务提交。异常保留隔离状态并自动重试，弹窗可重新打开查询进度。
- 已部署三服务统一标签 `organization-reset-20261031t145737z`：Octopus `a4e4236b4d07885ca72d2951fa026ae770bef82b`、Squid `1c469de60a28aa38e4a096e59cad95a877e44f88`、Cuttlefish `437678a0e92f69cf691f6c2a088ae7d1f066cf6c`。Cuttlefish功能提交 `7fbaae9`，最终提交补齐无历史重置记录时的空响应规范化。
- Squid本地主分支功能提交为 `c491ea5`；为避免包含尚未上线的邮件模板提交 `c8da935`，独立发布提交基于线上 `c704869` 仅叠加组织重置改动，保存在本地 `codex/organization-reset-release` 分支。远端仓库已分别快进到上述精确发布提交；镜像源码由Git归档构建，不包含本机其他工作流程后续的未提交文件。未push GitHub。
- 发布目录 `/home/ubuntu/schema/backups/organization-reset-20261031T145737Z` 保存两业务库受保护dump、原env/Compose/nginx/override与secrets副本、旧镜像回退标签、Git bundle及源码归档/摘要、构建日志、result与verification。业务基线和计算配置摘要仅保存在远端，不导出到对话。三镜像生产构建完成，按Octopus→Squid→Cuttlefish切换；容器healthy、重启0，认证后的重置状态GET和租户设置页可用，其他服务容器身份、业务资料、余额账务和计算有效配置保持。当前待应用计算配置已为0，旧节中的“仍1项待应用”不是当前状态。
- 用户明确要求直接commit并部署、不用测试后，未继续运行测试；部署仅执行生产构建和只读健康核对，未在任何真实组织调用重置。此前早期版本的14项前端回归和Octopus隔离回归通过；Squid隔离回归因测试夹具用户名缺失停止，夹具已修正但按用户要求未重跑，不能将这些早期结果视作最终版本全量验收。临时本机数据库容器和匿名卷已清理。
- 发布脚本先因过时的“必须有preserve-applied开关”前提停止；只读确认待应用配置为0后修正前提。重入时修正已有备份目录的处理，均未切换服务。首次切换后的只读检查发现无重置记录的空响应被BFF重复封装，自动镜像回退；修正并提交后重新构建/发布成功。相关失败、回退和恢复记录保留，未恢复数据库、未覆盖业务资料。
- 回退仅切换镜像，不恢复旧数据库。一旦接收真实重置请求，必须保留支持重置隔离/回执的Squid与Octopus后端；不能用旧后端绕过进行中的清理。物理删除不可通过镜像回退恢复，禁止用真实组织作破坏性验收。
- 最终独立只读核对：三个容器healthy、重启0，镜像revision与远端仓库HEAD一致；Cuttlefish公网及源站均200。额外发现YiJian公网 `/login` 从服务器和用户本机检查均返回521，而 `127.0.0.1:8080/login` 携带原Host的源站为200、其容器身份保持。本轮未改动YiJian、Tunnel或Cloudflare配置，公网521原因尚未确认，不能宣称YiJian公网登录验收通过；结果已记录在保护目录verification.json。
