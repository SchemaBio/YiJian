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

- Next.js 14
- React 18
- Tailwind CSS
- Radix UI
- IGV.js

## 环境要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0

## 本地开发

```bash
pnpm install
pnpm dev
```

开发服务器运行在 http://localhost:3001

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
docker run -p 3000:3000 -e NEXT_PUBLIC_API_URL=http://backend:8080 yijian
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `NEXT_PUBLIC_API_URL` | 后端 API 地址 | `http://localhost:8080` |
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
- 后端 API：[Octopus](https://github.com/schemabio/Octopus)

## License

Apache License 2.0
