# ───────────────────────── base ─────────────────────────
FROM node:20-alpine AS base
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
# Directorio de las fotografías de docentes (volumen en docker-compose)
RUN mkdir -p /app/uploads/teachers

# ────────────────────── development ─────────────────────
FROM base AS development
ENV NODE_ENV=development
RUN npm install
RUN npx prisma generate
COPY . .
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && npm run seed && npm run start:dev"]

# ──────────────────────── builder ───────────────────────
FROM base AS builder
RUN npm ci
RUN npx prisma generate
COPY . .
RUN npm run build
RUN npm prune --omit=dev

# ─────────────────────── production ─────────────────────
FROM node:20-alpine AS production
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001 && chown -R nestjs:nodejs /app
USER nestjs

EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
