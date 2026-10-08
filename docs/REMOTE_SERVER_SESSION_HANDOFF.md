# SchemaBio 生产服务器与跨 Session 交接

核对日期：**2026-10-08，Asia/Shanghai**。本文依据当日远端只读检查及当前认证源码整理；服务版本可能继续变化，新 Session 应重新核对运行镜像。

本文不包含密码、私钥内容、JWT、COS 密钥或签名下载地址。路径和变量名用于定位凭据，不能代替凭据本身。

## 1. 新 Session 从哪里开始

本地项目根目录：`D:\WSL\Github\SchemaBio`。

| 仓库 | 用途 |
|---|---|
| YiJian | 医生端、任务与结果工作台、浏览器 Parquet 计算 |
| Cuttlefish | 平台管理控制台 |
| Squid | 登录、组织权限、积分、竞价节点与生命周期、Octopus API 代理 |
| Octopus | 流程/资源、任务、归档、结果数据准备、调整记录与报告快照 |
| Sepiida | 计算节点 Agent、工作流进度与 Agent 采集状态服务 |
| Schema_CPU | 工作流、初始化脚本及计算镜像相关资源 |

首先阅读本文，再按工作内容阅读：

- `YiJian/docs/AUTOMATIC_ASSESSMENT_IMPLEMENTATION.md`
- `YiJian/docs/AUTOMATIC_ASSESSMENT_PRODUCTION_20261007.md`
- `Squid/LIVE_NODE_DIAGNOSTIC_HANDOFF.md`：历史节点诊断记录，**不是当前配置的唯一依据**。其早期镜像、暂停队列、旧实例 IP 和版本已过时。

当前结果方案是**浏览器本地计算**。交互筛选、排序、统计、分页和自动初评在浏览器 Worker 执行；服务器准备授权数据、核验来源并保存人工调整。不要恢复服务端查询作为页面计算的切换方案。

## 2. 连接生产主机

| 项目 | 当前值 |
|---|---|
| SaaS 主机公网 IP | `106.53.190.244` |
| SSH 端口 | `53729` |
| SSH 用户 | `ubuntu` |
| 本地私钥文件 | `D:\WSL\Github\SchemaBio\ssh-login-key` |
| 已有 SSH 别名 | `schema-bio-remote`，使用前检查本机 SSH 配置 |
| 本机已知主机记录 | `C:\Users\pzweu\.ssh\known_hosts` |

Windows PowerShell：

```powershell
ssh.exe -p 53729 -i 'D:\WSL\Github\SchemaBio\ssh-login-key' ubuntu@106.53.190.244
# 若本机已有正确的 Host 配置，也可使用：
ssh.exe schema-bio-remote
```

Windows OpenSSH 可能因私钥 ACL 过宽拒绝使用该文件。这是本机权限问题，不等于远端拒绝密钥。核对并收紧文件 ACL；不要关闭主机密钥校验或随意替换 known_hosts。

本机现有诊断 SSH 工具已验证可连接：

```powershell
& 'D:\WSL\Github\SchemaBio\Squid\.gotmp\live-node-diagnostic\ssh.exe' `
  -host '106.53.190.244:53729' `
  -user ubuntu `
  -key 'D:\WSL\Github\SchemaBio\ssh-login-key' `
  -command 'python3 -' `
  -stdin-file 'D:\WSL\Github\SchemaBio\YiJian\.gotmp\your-readonly-script.py'
```

该工具的端口包含在 `-host` 中，**没有 `-port` 参数**。默认使用已知主机记录校验。工具和临时脚本位于忽略目录，不保证 Git clone 后存在；缺失时使用标准 OpenSSH。

计算节点使用另一把密钥：`D:\WSL\Github\SchemaBio\Schema_CPU\Schema_Job_Key.pem`，用户通常是 `ubuntu`。必须先从当前 task/attempt 及云端确认实例和 IP；禁止连接历史文档中已销毁实例的旧 IP。

## 3. 服务入口与登录

### YiJian

- 入口：`https://yijian.schema-bio.com/`
- 登录：`https://yijian.schema-bio.com/login`
- 浏览器填写 **Squid 中真实用户的邮箱和密码**。
- 公网登录 API：`POST /api/v1/auth/login`，字段为 `email`、`password`。
- 登录后使用 HttpOnly `access_token` / `refresh_token` Cookie；涉及写入的 API 还需遵循 CSRF 机制。
- 不在地址栏、文档、日志或浏览器持久存储中写入访问令牌。
- 环境中的默认管理员密码是初始化/配置凭据；已有账号以数据库实际密码为准。不要通过重置密码来完成普通验收。

管理员配置的定位：当前 `/home/ubuntu/schema/saas-deploy/.env` 含 `PLATFORM_ADMIN_EMAIL`、`PLATFORM_ADMIN_PASSWORD`；运行中的 Squid 注入 `DEFAULT_ADMIN_EMAIL`、`DEFAULT_ADMIN_PASSWORD`。具体值应由授权操作者私下读取，或由验证脚本仅在内存中使用，不输出到工具结果。

### Cuttlefish

- **入口及登录界面在首页**：`https://cuttlefish.schema-bio.com/`
- 当前 `/login` 路径返回 404，不要用该地址判断管理台不可用。
- 浏览器登录 API：`POST /api/auth/login`，字段为 `username`、`password`。
- 当前运行容器使用 `CUTTLEFISH_ADMIN_USERNAME`、`CUTTLEFISH_ADMIN_PASSWORD` 校验控制台登录。
- 验证成功后，通过 `SQUID_ADMIN_EMAIL`、`SQUID_ADMIN_PASSWORD` 向 Squid 换取管理会话；需要有效的平台管理员权限。
- 浏览器持有独立的 `cuttlefish_session` HttpOnly Cookie，写操作遵循 `x-cuttlefish-csrf`。
- 2026-10-08 只读比较确认：控制台用户名/密码和它的 Squid 上游管理员用户名/密码目前分别相同。**两组配置仍是独立机制，不能推断以后必然一致，也不能把 YiJian Cookie 当作 Cuttlefish 会话。**

当前 Cuttlefish 镜像仍是较早的 `git-ba08ab8`。仓库新版部署说明可能描述统一管理员登录与 `.generated/runtime.env`；本服务器当前没有这个生成文件，不能直接套用新版说明。读取实际 `.env`、Compose 与容器配置，密码值仅在受控内存/操作者私有终端中处理。

### Octopus 与 Sepiida

- Octopus 没有独立的医生端登录页面，YiJian 通过 Squid 代理访问。
- 公网 Octopus API 前缀：`https://yijian.schema-bio.com/api/v1/octopus`。
- 例如结果上下文：`/api/v1/octopus/tasks/<taskUUID>/results/context`；**不要在这个代理前缀后再增加一层 `/v1`**。
- Sepiida 公网服务域名：`https://sepiida.schema-bio.com`，不是与 YiJian 共用的浏览器登录页面。
- Sepiida 查询接口使用 `Authorization: Bearer <query-key>`；Octopus 使用 `SEPIIDA_QUERY_KEY`。
- Agent 回调使用当前执行的 per-task token，不使用查询密钥代替节点令牌。
- 当前 Octopus 到 Sepiida 的内部地址：`http://sepiida-20260829-sepiida-1:9090`。

## 4. 生产目录、入口路由与配置

| 路径 | 用途 |
|---|---|
| `/home/ubuntu/schema/` | SaaS 项目工作区 |
| `/home/ubuntu/schema/{YiJian,Octopus,Squid,Cuttlefish}/` | 对应项目源码 |
| `/home/ubuntu/schema/saas-deploy/compose.yaml` | 当前 SaaS 主 Compose |
| `/home/ubuntu/schema/Octopus/deploy/saas-parquet-query.override.yaml` | 当前 Parquet 配置覆盖文件 |
| `/home/ubuntu/schema/saas-deploy/.env` | 运维配置及部分敏感变量，当前权限 `0600` |
| `/home/ubuntu/schema/saas-deploy/nginx.conf` | SaaS 网关路由 |
| `/home/ubuntu/schema/saas-deploy/pg-ca.crt` | 数据库 CA 证书 |
| `/home/ubuntu/schema/saas-deploy/parquet-cache/` | 受控结果缓存 |
| `/home/ubuntu/schema/saas-deploy/parquet-cache/reference/` | 当前自动初评公共证据包与 task-proofs |
| `/home/ubuntu/schema/saas-deploy/parquet-assessments/` | 保留的服务端历史评估目录，页面交互不用它作为自动基线 |
| `/home/ubuntu/schema/backups/` | 发布前备份、镜像身份、哈希清单与验收证据 |
| `/root/sepiida-20260829/docker-compose.yml` | 独立 Sepiida Compose；不是 SaaS 主 Compose 的服务 |
| `/root/sepiida-20260829/secrets/query-keys-20260829.txt` | Sepiida 查询密钥文件，受限读取，不输出内容 |

网关容器 `schemabio-saas-gateway-1`：

- 容器 80 → 主机 `127.0.0.1:8080`，YiJian；`/api/` 转到 Squid，其余转到 YiJian。
- 容器 81 → 主机 `127.0.0.1:8082`，Cuttlefish。
- 运行有 Cloudflared 容器 `cloudflared_2-cloudflared-1`。本文只核对了应用网关路由，未核查 Tunnel/Cloudflare Access 控制台策略。
- Octopus/Squid 的 8080 和 YiJian/Cuttlefish 的 3000 没有直接发布到宿主公网。
- Sepiida 容器 9090 映射到主机 `0.0.0.0:24417`；不要在排障中扩大其访问范围。

### 当前运行镜像

| 容器 | 镜像 | 2026-10-08 状态 |
|---|---|---|
| `schemabio-saas-yijian-1` | `schemabio/yijian:assessment-snappy-20261008-c71e87d4` | healthy |
| `schemabio-saas-octopus-1` | `schemabio/octopus:assessment-20261007-262d5c41-proof1` | healthy |
| `schemabio-saas-squid-1` | `schemabio/squid:workflow-center-20261007-f553661f` | healthy |
| `schemabio-saas-cuttlefish-1` | `schemabio/cuttlefish:git-ba08ab8` | healthy |
| `schemabio-saas-parquet-query-1` | `schemabio/parquet-query:parquet-results-2` | healthy |
| `sepiida-20260829-sepiida-1` | `schemabio/sepiida-server:git-825f18e` | healthy |
| `schemabio-saas-gateway-1` | `nginx:1.28-alpine` | healthy |

最近发布采用**受控源文件同步再构建**，没有在本 Session 执行 Git push，也不能假定远端 `git log` 就等于部署代码版本。版本核对要结合运行镜像、源文件哈希和发布记录。

本地功能提交：YiJian `bfdfe73`，发布记录 `b88b8a0`；Octopus `b285742`、修正 `62779c1`。是否已推送到 GitHub需另行确认。

最新修复证据目录：`/home/ubuntu/schema/backups/assessment-snappy-20261008-c71e87d4/`。修复初评临时 Parquet 同名路径复用导致的 Snappy 读取错误，按类型及内容哈希隔离路径并在异常时清理。仅重建 YiJian；浏览器已验证全量初评完成及 SNP、两类 CNV 的第二页可读取。

初评流式读取优化与节点镜像更新目录：`/home/ubuntu/schema/backups/assessment-perf-20261008-78ae792e/`，包含源文件哈希、旧源码、运行镜像身份、构建日志、配置备份和健康检查结果。该轮重建 Squid 容器将 `CVM_IMAGE_ID` 更新为 `img-b1dhdlia`；修复发布保留此配置。保留旧镜像用于回滚。

上一轮证据与 VCF 适配验收目录：`/home/ubuntu/schema/backups/assessment-20261007-262d5c41/`，其中有 `source-manifest.json`、`commits.json`、`documentation-commit.json`、`assessment-acceptance.json`、`proof-acceptance.json`、构建日志和配置备份。配置备份仍然是敏感文件，不能整份输出。

## 5. 当前业务设置与待核验项

- 地域：`ap-guangzhou`。
- 计算节点系统镜像：Squid 当前 `CVM_IMAGE_ID=img-b1dhdlia`（2026-10-08 用户授权更新，Compose 与运行容器均已核对生效；未创建计算实例验证镜像启动）。
- 参考桶：`schemabio-1327430028`；路径例如 `database/hg19/`、`database/hg38/`。
- 用户归档桶：`schemabio-user-1327430028`，按组织、任务、attempt 隔离。
- BAM 保留配置：`BAM_RETENTION_DAYS=7`、`BAM_CLEANUP_ENABLED=true`。
- 当前 Squid 没有注入 `CVM_QUEUE_PAUSED`；源码默认 false。不能沿用早期“队列已暂停”的结论。
- 当前未注入 `CVM_NODE_PRIVATE_ADDR`、`SEPIIDA_PRIVATE_ADDR`；**计算节点内网 HTTPS 回退仍未启用**。不要把 Octopus → Sepiida 容器内网通信等同于计算节点 HTTPS 回退已部署。
- Octopus 已设置 `IGV_REFERENCE_PROXY_BASE_URL`，未设置直接的 `IGV_HG19/HG38_FASTA_URL/FAI_URL`。现状是使用代理配置，不能仅凭直接 URL 为空判断 IGV 一定不可用；实际 reads/Range 仍需浏览器验收。
- Octopus 专用 `CVM_REFERENCE_SECRET_ID/KEY` 和相应 `_FILE` 当前未配置。源码允许复用现有存储凭据；本轮没有执行 COS HEAD，不应把“专用变量为空”写成“参考访问必然失败”。下一次真实投递前，应先核对有效凭据来源及参考 HEAD 权限，不输出凭据。

## 6. 可复用的只读检查

连接后先确认路径与服务：

```bash
cd /home/ubuntu/schema/saas-deploy
docker compose -f compose.yaml -f ../Octopus/deploy/saas-parquet-query.override.yaml ps
docker ps --format '{{.Names}} {{.Image}} {{.Status}}'
docker inspect schemabio-saas-octopus-1 schemabio-saas-yijian-1 \
  --format '{{.Name}} {{.Config.Image}} {{.State.Health.Status}}'
curl -fsS http://127.0.0.1:8080/gateway-health
curl -fsS http://127.0.0.1:8082/gateway-health
```

不要直接输出 `docker inspect` 全结果、`docker compose config`、`.env` 或凭据备份，它们可能含密钥。诊断脚本应选取白名单字段，敏感变量仅输出“是否已配置”。日志也可能含样本资料、对象路径或签名 URL，先脱敏再展示。

实际构建部署应同时使用上述两个 Compose 文件，明确指定目标服务，保留 `.env` 中现有镜像与业务配置；不要不加区分地 `up` 整个栈。发布前保存配置与镜像身份，后端先更新，健康检查后更新前端。保留回滚镜像，不删除数据卷。

## 7. 可继续使用的已归档任务

- task：`73ac68fd-4f6e-437b-8244-d16b09bbc7e1`
- attempt：`5298563b-0d4a-4a28-93c9-e10f86d3b2fe`
- 参考：hg19，single。
- 页面：`https://yijian.schema-bio.com/tasks/73ac68fd-4f6e-437b-8244-d16b09bbc7e1`
- 归档：`schemabio-user-1327430028/organizations/0b99dc67-70b5-4f8b-b1db-a9d2298d141d/workflows/73ac68fd-4f6e-437b-8244-d16b09bbc7e1/attempts/5298563b-0d4a-4a28-93c9-e10f86d3b2fe/`。

已核对：SNP/InDel 55,393，CNV Region 64,732，CNV Exon 18,414，STR 37，MEI 34，MT 309，ROH 0；未产生 UPD。证据适配生成 138,919 条，VCF 匹配 SNP 55,393 条，54,937 条有先证者 GQ。

自动初评 profile：`germline-browser-assessment-v1`。公共包版本：`HPO-20260901-ClinGen-20261007-Mondo-20261006-v1`。

接口、attempt、记录数量、上下文版本稳定及匿名访问拒绝已验收。2026-10-08 浏览器实测全量初评完成；SNP/InDel、CNV Region 和 CNV Exon 的记录数及第二页读取通过。**实际内存/性能指标、交互保存和真实 IGV 读取尚未完成验收**。STR/印记区域等临床补充资料、完整 PVS1 决策树与资源分片仍待完善。

受控命令仅用于需要重新检查资料的情况，默认不执行：

```bash
docker exec schemabio-saas-octopus-1 /app/octopus results-assessment \
  --task 73ac68fd-4f6e-437b-8244-d16b09bbc7e1 \
  --attempt 5298563b-0d4a-4a28-93c9-e10f86d3b2fe
```

加 `--execute` 会发布证据侧文件；不是普通只读检查。已有资料已准备，不应每次进入新 Session 重复执行，更不能为了页面验收重新运行工作流或申请竞价实例。

## 8. 给新 Session 的起始消息

> 请先阅读 `D:/WSL/Github/SchemaBio/YiJian/docs/REMOTE_SERVER_SESSION_HANDOFF.md`，按本文连接生产主机并只读核对当前服务镜像与配置。当前浏览器 Parquet 本地计算是唯一交互计算方案。使用已有归档任务 `73ac68fd-4f6e-437b-8244-d16b09bbc7e1` 的固定 attempt 继续验收；保护所有凭据，不把环境变量、令牌或签名链接输出到日志。先说明要继续的具体工作，不默认重新申请节点、重跑工作流、修改人工判读或积分。本文的历史状态需要现场重新核对。
