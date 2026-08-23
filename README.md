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
为兼容旧部署，运行时仍识别 `YIJIAN_BACKEND_FLAVOR`，新配置应统一使用 `YIJIAN_BACKEND`。
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

## 验证

```sh
pnpm typecheck
pnpm build
```

生产反向代理、TLS 与公网访问控制由部署者管理。路由契约见对应部署目录的
README。
