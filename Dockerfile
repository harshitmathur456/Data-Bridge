# Stage 1: deps
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install

# Stage 2: builder
# Mirror local repo layout:  /app/frontend  and  /app/shared
# so that next.config.ts can resolve @shared as ../shared
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/frontend/node_modules ./frontend/node_modules
COPY frontend/ ./frontend
COPY shared/ ./shared

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app/frontend
RUN npm run build

# Stage 3: runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/frontend/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
