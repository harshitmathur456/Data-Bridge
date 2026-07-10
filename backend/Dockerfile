# Stage 1: deps
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
COPY package.json package-lock.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist

EXPOSE 3001
CMD ["npm", "start"]
