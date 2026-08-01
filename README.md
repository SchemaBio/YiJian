# YiJian

遗传病胚系突变分析平台前端，支持 Octopus 自部署后端和 Squid SaaS 网关。

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

## 验证

```sh
pnpm typecheck
pnpm build
```

生产反向代理、TLS 与公网访问控制由部署者管理。路由契约见对应部署目录的
README。
