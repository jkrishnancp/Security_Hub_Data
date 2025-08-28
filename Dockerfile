# Production Dockerfile for Security Data Hub
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci --only=production

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js app
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the public folder
COPY --from=builder /app/public ./public

# Copy the standalone build
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma files
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Create directories for database and uploads
RUN mkdir -p ./prisma/prisma/prisma ./public/uploads/avatars
RUN chown -R nextjs:nodejs ./prisma ./public/uploads

# Create startup script before switching to nextjs user
RUN echo '#!/bin/sh\n\
set -e\n\
\n\
# Initialize database if it does not exist\n\
if [ ! -f "./prisma/prisma/prisma/dev.db" ]; then\n\
  echo "Initializing database..."\n\
  npx prisma db push\n\
  echo "Database initialized"\n\
fi\n\
\n\
# Start the application\n\
exec node server.js' > /app/start.sh

RUN chmod +x /app/start.sh
RUN chown nextjs:nodejs /app/start.sh

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["/app/start.sh"]