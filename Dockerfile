# ============ 构建阶段 ============
FROM node:20-alpine AS builder

# 安装 pnpm（固定版本：pnpm 10+ 要求 Node.js ≥ 20.0.0 且部分新版本要求更高，
# 与当前 node:20-alpine 不兼容；lockfile 为 v9.0，使用 pnpm@9.x 保持一致）
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

ARG NEXT_PUBLIC_PASSWORD_HASH_ENABLED=false
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

ARG NEXT_PUBLIC_PASSWORD_HASH_ENABLED=false
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV YIJIAN_API_URL=/api
ENV NEXT_PUBLIC_PASSWORD_HASH_ENABLED=$NEXT_PUBLIC_PASSWORD_HASH_ENABLED

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

WORKDIR /app

# 从构建阶段复制 standalone 产物
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x /app/docker-entrypoint.sh

# 设置端口
ENV PORT=3000

USER nextjs

EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
