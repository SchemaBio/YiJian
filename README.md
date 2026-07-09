# 贻鉴 YiJian

遗传病胚系突变分析平台，面向临床遗传病诊断场景。

## 功能特性

- 家系管理（三代家系支持）
- 样本管理
- 变异分析（SNV/InDel/CNV/STR/UPD/MEI）
- 家系分离分析
- ACMG 致病性分类评估
- Sanger 验证管理
- IGV 基因组浏览器集成

## 技术栈

- Next.js 16
- React 19
- Tailwind CSS
- Radix UI
- IGV.js

## 环境要求

- Node.js >= 20.9.0
- pnpm >= 9.0.0

## 本地开发

```bash
pnpm install
pnpm dev
```

开发服务器运行在 http://localhost:3000

## 构建

```bash
pnpm build      # 生产构建
pnpm start      # 启动生产服务
pnpm typecheck  # 类型检查
pnpm lint       # 代码检查
```

## Docker 部署

```bash
docker build -t yijian .
# Direct Octopus
docker run -p 3000:3000 -e YIJIAN_API_URL=http://octopus:8080 yijian

# Squid SaaS gateway + Octopus core proxy
docker run -p 3000:3000 \
  -e YIJIAN_API_URL=http://squid:8080 \
  -e YIJIAN_CORE_API_PREFIX=/v1/octopus \
  -e YIJIAN_BACKEND_FLAVOR=squid \
  yijian
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `YIJIAN_API_URL` | 运行时浏览器可见的后端 API 基址（Docker 部署用）；留空回退 `NEXT_PUBLIC_API_URL` | `/api` |
| `NEXT_PUBLIC_API_URL` | 本地开发回退的后端 API 基址 | `/api` |
| `YIJIAN_CORE_API_PREFIX` / `NEXT_PUBLIC_CORE_API_PREFIX` | Octopus 核心 API 前缀；直连 Octopus 留空，走 Squid 网关设为 `/v1/octopus` | 空 |
| `YIJIAN_BACKEND_FLAVOR` / `NEXT_PUBLIC_BACKEND_FLAVOR` | 后端模式：`auto` / `octopus` / `squid` | `auto` |
| `NEXT_PUBLIC_PASSWORD_HASH_ENABLED` | 客户端密码 SHA-256 哈希，需与 Squid `CLIENT_PASSWORD_HASH_ENABLED` 一致 | `false` |
| `PORT` | 服务端口 | `3000` |

## 项目结构

```
src/
├── app/                    # Next.js App Router
│   ├── (main)/             # 主布局页面
│   │   ├── dashboard/      # 工作台
│   │   ├── tasks/          # 任务中心
│   │   ├── samples/        # 样本管理（含家系）
│   │   ├── history/        # 历史检出
│   │   ├── pipeline/       # 流程中心
│   │   ├── settings/       # 系统设置
│   │   └── admin/          # 管理中心
│   ├── login/              # 登录
│   └── register/           # 注册
├── components/             # 组件
│   ├── assistant/          # AI 助手
│   ├── layout/             # 布局组件
│   └── providers/          # Context Provider
├── hooks/                  # 自定义 Hooks
├── config/                 # 配置
├── lib/                    # 工具库
├── types/                  # 类型定义
└── app/globals.css         # 全局样式
```

## 依赖

- [@schema/ui-kit](https://github.com/SchemaBio/ui-kit) — 共享 UI 组件库
- 后端 API：[Octopus](https://github.com/schemabio/Octopus)（社区版直连）
- SaaS 网关：Squid（SaaS 模式下经 `/v1/octopus/*` 代理访问 Octopus 核心）

## License

Apache License 2.0
