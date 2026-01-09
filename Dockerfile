# syntax=docker/dockerfile:1

# Monorepo build image: pnpm + turbo
FROM node:20-bookworm-slim AS base
WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable

# Copy repo
COPY . .

# Install dependencies
FROM base AS deps
RUN pnpm install --frozen-lockfile

# Build all packages (turbo)
FROM deps AS build
RUN pnpm build

# Run tests (turbo will build as needed)
FROM deps AS test
CMD ["pnpm", "test"]

# Build web app only (static)
FROM deps AS web-build
RUN pnpm --filter=@browserqemu/web build

# Production web server
FROM nginx:1.27-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
