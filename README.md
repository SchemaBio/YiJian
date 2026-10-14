# YiJian

生物信息分析与变异注释工具前端，支持从 FASTQ 到分析结果的工作流、质控、变异注释和结果浏览，兼容 Octopus 自部署后端和 Squid SaaS 网关。

## 产品定位与使用边界

### SaaS 托管版

面向个人科研用户、科研机构及获授权人员。个人用户须拥有提交数据的合法权限；服务不面向个人医疗决策。

SaaS 是从 FASTQ 到分析结果的科研分析与注释器（Research Use Only，RUO）：用户提交已有测序文件，平台执行配置的流程，展示质控、变异及公共数据库注释。ACMG 初评、HPO 关联和 AI 辅助用于整理证据和筛选研究候选，不构成个人疾病诊断、健康风险结论、治疗或用药建议。

托管服务不提供采样、实验室检测、诊断报告签发、长期数据保藏或跨任务历史检出档案。任务期间的结果、人工标记和操作记录仍按实际保留规则保存，不应描述为“完全不留记录”。具体期限以服务中的数据保留说明为准。

用户须拥有提交数据的合法权限，不得提交真实姓名、证件、联系方式等身份信息。研究编号或化名不等同于遗传数据已经匿名；结果须自行核验，不得将托管服务用于个人医疗决策。

### 开源自部署版

开源版提供可自行部署、配置和修改的分析工具。部署者自行决定使用场景、工作流、数据保留和结果用途，并负责输入数据授权、安全保护、结果验证、人员资质以及适用法律和监管要求。

软件及其输出不自动构成经过验证的医疗产品或诊断结论。若用于受监管场景，由部署者完成必要验证与手续；开源许可不替代这些要求。SaaS 的 RUO 服务边界与强制保留期限不自动适用于独立部署实例，本说明不新增开源许可的用途限制。

## 本地开发

```sh
cp .env.example .env.local
pnpm install
pnpm dev
```

默认开发配置直连 `http://localhost:8080/api`。生产部署不要单独维护
YiJian 环境变量，使用 `Octopus/deploy` 或 `Squid/deploy` 的统一入口。

## 后端选择

YiJian 只需要选择 API 地址和后端类型：

```env
# Docker 运行时
YIJIAN_API_URL=/api
YIJIAN_BACKEND=octopus

# Next.js 本地开发
NEXT_PUBLIC_API_URL=http://localhost:8080/api
NEXT_PUBLIC_BACKEND=octopus
```

`YIJIAN_BACKEND` 只能是 `octopus` 或 `squid`。选择 `squid` 时，客户端自动
将 Octopus 核心接口路由到 `/v1/octopus`，不再单独配置 API 前缀或 flavor。
为兼容旧部署，运行时仍识别 `YIJIAN_BACKEND_FLAVOR`，新配置应统一使用 `YIJIAN_BACKEND`。
任务详情路由会在服务端核验任务类型，CNV 校正任务（`baseline_fix`）返回 404。
Docker 默认通过 `octopus:8080/api` 或 `squid:8080/api` 核验；自定义网络或端口时，
设置仅服务端使用的 `YIJIAN_SERVER_API_URL`，不要填写浏览器中的 localhost 地址。

数据中心在 `octopus` 自部署模式下显示总容量无限制；在 `squid` SaaS 模式下，
显示并预检由平台管理员为当前租户分配的共享存储总容量，配额值为 `0` 时同样表示无限制。

## Docker

```sh
docker build -t yijian .
docker run -p 3000:3000 \
  -e YIJIAN_API_URL=/api \
  -e YIJIAN_BACKEND=octopus \
  yijian
```

运行时入口会生成 `public/runtime-config.js`，因此同一个镜像可以在 Octopus
和 Squid 两条路线间复用，无需重新构建。

## 界面语言

支持简体中文（`zh-CN`）、通用繁体中文（`zh-Hant`）、英语（`en`）和拉美西班牙语（`es-419`）。
在“设置 → 个人设置 → 界面语言”选择语言并点击保存。偏好通过当前网站的
`yijian-locale` Cookie 保存一年，退出登录后保留，不跨设备同步。

Docker 默认语言通过 `YIJIAN_DEFAULT_LOCALE` 配置，未设置时为 `zh-CN`。
同一镜像支持四种默认语言；修改配置后重建 YiJian 容器即可，无需重建镜像。
已有浏览器偏好优先于部署默认值，不根据浏览器语言自动选择。
本地开发使用 `NEXT_PUBLIC_DEFAULT_LOCALE`；生产配置使用 Octopus 或 Squid 的部署入口。
样本资料、报告正文、AI 输出及原始文件保持原文。

## 验证

```sh
pnpm test
pnpm typecheck
pnpm build
node scripts/check-i18n.cjs
```

生产反向代理、TLS 与公网访问控制由部署者管理。路由契约见对应部署目录的
README。
