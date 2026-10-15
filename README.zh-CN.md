# YiJian

[English](./README.md) | **中文**

开源的胚系生物信息分析与变异注释 Web 前端。覆盖从 FASTQ 到分析结果的路径：质控、变异注释和结果浏览。对接自部署的 [Octopus](https://github.com/SchemaBio/Octopus) API。

采用 [Apache License 2.0](./LICENSE)。

## 使用边界

本仓库是开源、可自部署的版本。部署者自行决定使用场景、工作流、数据保留和结果用途，并负责输入数据授权、安全保护、结果验证、人员资质以及适用的法律和监管要求。

软件及其输出不自动构成经过验证的医疗产品或诊断结论。若用于受监管场景，由部署者完成必要验证与手续。Apache 许可不替代这些要求，本说明也不在许可之外新增用途限制。

## 包含的功能

- 概览、样本列表、家系管理
- 测序文件数据中心
- 任务中心：创建任务、查看运行、浏览变异、质控、IGV 和报告
- 历史检出
- 流程中心：流程、基因列表、BED 文件、CNV 基线、报告服务
- 平台管理与权限设置（平台管理员）
- 用于整理证据、筛选研究候选的 AI 辅助

CNV 基线校正任务（`baseline_fix`）产出的是基线资源，不是解读报告。这类任务的详情路由返回 404。

## 环境要求

- Node.js 22
- pnpm 9.15.9（见 `package.json` 的 `packageManager`）
- 可访问的 Octopus API（默认 `http://localhost:8080/api`）

## 本地开发

```sh
cp .env.example .env.local
pnpm install
pnpm dev
```

默认开发配置直连 `http://localhost:8080/api`。

## 配置

YiJian 需要 API 地址和后端类型。开源版的后端是 `octopus`。

```env
# Docker 运行时
YIJIAN_API_URL=/api
YIJIAN_BACKEND=octopus

# Next.js 本地开发
NEXT_PUBLIC_API_URL=http://localhost:8080/api
NEXT_PUBLIC_BACKEND=octopus
```

旧部署可能仍设置 `YIJIAN_BACKEND_FLAVOR`。新配置应使用 `YIJIAN_BACKEND`。

任务详情路由会在服务端核验任务。Docker 默认访问 `http://octopus:8080/api`。自定义网络或端口时，设置仅服务端使用的 `YIJIAN_SERVER_API_URL`，不要填写浏览器里的 localhost 地址。

其他运行时配置，默认值来自 `.env.example` 和 `docker-entrypoint.sh`：

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `YIJIAN_DEFAULT_LOCALE` | `zh-CN` | 部署默认语言 |
| `YIJIAN_SUPPORT_EMAIL` | `support@schema-bio.com` | 界面显示的支持邮箱 |
| `YIJIAN_UPLOAD_ORIGINS` | 空 | 额外允许的上传来源 |
| `YIJIAN_PASSWORD_RESET_ENABLED` | `false` | 密码重置 |
| `NEXT_PUBLIC_PASSWORD_HASH_ENABLED` | `false` | 客户端密码哈希，构建镜像时写入 |
| `NEXT_PUBLIC_PRIVACY_CONSENT_REQUIRED` | `true` | 隐私同意，构建镜像时写入 |

`NEXT_PUBLIC_DEV_MOCK_AUTH=true` 会被生产镜像拒绝。

## Docker

```sh
docker build -t yijian .
docker run -p 3000:3000 \
  -e YIJIAN_API_URL=/api \
  -e YIJIAN_BACKEND=octopus \
  yijian
```

入口脚本会根据环境变量生成 `public/runtime-config.js`，因此 API 地址、后端、支持邮箱、上传来源、密码重置和默认语言都可以不重新构建镜像而修改。镜像监听 3000 端口，以非 root 用户运行。

## 界面语言

支持简体中文（`zh-CN`）、通用繁体中文（`zh-Hant`）、英语（`en`）和拉美西班牙语（`es-419`）。

在“设置 → 个人设置 → 界面语言”选择语言并保存。偏好通过当前网站的 `yijian-locale` Cookie 保存一年，退出登录后保留，不跨设备同步。

Docker 默认语言由 `YIJIAN_DEFAULT_LOCALE` 设置，未设置时为 `zh-CN`。同一镜像支持四种默认语言；修改后重建容器即可，无需重建镜像。已有浏览器偏好优先于部署默认值，不根据浏览器语言自动选择。

本地开发使用 `NEXT_PUBLIC_DEFAULT_LOCALE`。

样本资料、报告正文、AI 输出及原始文件保持原文。

## 验证

```sh
pnpm test
pnpm typecheck
pnpm build
node scripts/check-i18n.cjs
```

反向代理、TLS 与公网访问控制由部署者负责。
