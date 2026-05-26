# ============ 构建阶段 ============
FROM node:20-alpine AS builder

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Public Next.js variables are inlined into browser bundles during build.
ARG NEXT_PUBLIC_API_URL=/api
ARG NEXT_PUBLIC_PASSWORD_HASH_ENABLED=false
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_PASSWORD_HASH_ENABLED=$NEXT_PUBLIC_PASSWORD_HASH_ENABLED
ENV NEXT_TELEMETRY_DISABLED=1

# 复制依赖配置
COPY package.json pnpm-lock.yaml ./

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源码
COPY . .

# 构建
RUN pnpm build

# ============ 运行时阶段 ============
FROM node:20-alpine AS runner

ARG NEXT_PUBLIC_API_URL=/api
ARG NEXT_PUBLIC_PASSWORD_HASH_ENABLED=false
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_PASSWORD_HASH_ENABLED=$NEXT_PUBLIC_PASSWORD_HASH_ENABLED

# 安装 pnpm runtime shim
RUN corepack enable && corepack prepare pnpm@latest --activate

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

WORKDIR /app

# 从构建阶段复制构建产物
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./

# 复制运行时所需的 node_modules
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# 设置端口
ENV PORT=3000

USER nextjs

EXPOSE 3000

CMD ["pnpm", "start"]
