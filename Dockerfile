# ============ 构建阶段 ============
FROM node:22-alpine AS builder

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

ARG NEXT_PUBLIC_PASSWORD_HASH_ENABLED=false
ARG NEXT_PUBLIC_PRIVACY_CONSENT_REQUIRED=true
ENV NEXT_PUBLIC_PASSWORD_HASH_ENABLED=$NEXT_PUBLIC_PASSWORD_HASH_ENABLED
ENV NEXT_PUBLIC_PRIVACY_CONSENT_REQUIRED=$NEXT_PUBLIC_PRIVACY_CONSENT_REQUIRED
ENV NEXT_TELEMETRY_DISABLED=1

# 复制依赖配置
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源码
COPY . .

# 构建
RUN pnpm build

# ============ 运行时阶段 ============
FROM node:22-alpine AS runner

ARG NEXT_PUBLIC_PASSWORD_HASH_ENABLED=false
ARG NEXT_PUBLIC_PRIVACY_CONSENT_REQUIRED=true
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV YIJIAN_API_URL=/api
ENV YIJIAN_CORE_API_PREFIX=
ENV YIJIAN_BACKEND_FLAVOR=auto
ENV NEXT_PUBLIC_PASSWORD_HASH_ENABLED=$NEXT_PUBLIC_PASSWORD_HASH_ENABLED
ENV NEXT_PUBLIC_PRIVACY_CONSENT_REQUIRED=$NEXT_PUBLIC_PRIVACY_CONSENT_REQUIRED

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

WORKDIR /app

# 从构建阶段复制 standalone 产物
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/docker-entrypoint.sh ./docker-entrypoint.sh

RUN sed -i 's/\r$//' /app/docker-entrypoint.sh && \
    chmod +x /app/docker-entrypoint.sh

# 设置端口
ENV PORT=3000
# Next.js standalone server 默认 listen 在 localhost；容器健康检查、
# 反向代理等通过容器名/IP 访问时会失败。绑定到 0.0.0.0 让容器内外都可达。
ENV HOSTNAME=0.0.0.0

USER nextjs

EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
