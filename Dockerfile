# syntax=docker/dockerfile:1.7
#
# KOKKOK Garden — production runtime image.
#
# Multi-stage build that produces a small (~250MB) image containing the
# Next.js standalone server + the static assets it serves. Built on
# node:22-alpine to keep the base layer small and predictable.
#
# Architecture note (2026-06-24):
#   - Phase 1 builds linux/arm64 to match the current t4g.small EC2.
#   - Phase 5 will flip to linux/amd64 when we switch to t3a.small
#     (권대영's Jenkins+Docker environment is x64-only). The Dockerfile
#     itself is arch-agnostic; the runner does the cross-build via
#     `docker buildx`.
#
# Layout matches the existing tarball deploy on purpose, so a runtime
# misbehavior can be debugged by extracting the image and comparing
# byte-for-byte against s3://kokkok-deploy-artifacts/latest.tar.gz.

# ──────────────────────────────────────────────────────────────────────
# Stage 1: install dependencies (cached on package-lock.json changes)
# ──────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# libc6-compat covers the handful of glibc-linked native modules
# (sharp's image processing, in particular) that fail to resolve
# symbols on plain musl. Tiny addition (~3MB), prevents class-of-bug
# we've already debugged once on the EC2 host.
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# ──────────────────────────────────────────────────────────────────────
# Stage 2: build the Next.js standalone bundle
# ──────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

# NEXT_PUBLIC_* must exist at build time — Next.js inlines them into
# the client bundle. The CI passes them via --build-arg from the same
# repo secrets the tarball pipeline already uses.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ──────────────────────────────────────────────────────────────────────
# Stage 3: minimal runtime image
# ──────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as non-root for defense-in-depth. The standalone server only
# needs read access to /app and ephemeral write to /tmp.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Layer order matches the package-tarball pipeline:
#   .next/standalone/. → /app
#   .next/static       → /app/.next/static
#   public/            → /app/public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

# server.js is created by Next.js's standalone output mode and starts
# the production HTTP server on $PORT.
CMD ["node", "server.js"]
