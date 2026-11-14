# syntax=docker/dockerfile:1
#
# Pangtao production image: one container serves the API and the built React app
# (system-sds §1). Used unchanged by docker compose, CI and Cloud Run.
#
# - Settings come only from the environment at run time (R-02); nothing is baked in.
# - The same image runs the service (default CMD) and the migrate/seed job:
#     npx prisma migrate deploy && npx prisma db seed
# - Node 22 LTS: npm 10 runs the install scripts bcrypt and Prisma need.

ARG NODE_IMAGE=node:22-bookworm-slim

# ---- base: OS packages shared by every stage --------------------------------
FROM ${NODE_IMAGE} AS base
WORKDIR /app
# openssl: Prisma engines. tini: PID 1 that forwards SIGTERM so Cloud Run can stop
# the container gracefully (Node as PID 1 ignores it).
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl tini \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/

# ---- build: full install, compile server and web ----------------------------
FROM base AS build
RUN --mount=type=cache,target=/root/.npm npm ci
COPY prisma prisma
RUN npx prisma generate
COPY server server
COPY web web
RUN npm run build

# ---- prod-deps: runtime dependencies only (server + Prisma CLI + tsx) -------
FROM base AS prod-deps
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --workspace=server --include-workspace-root
COPY prisma prisma
RUN npx prisma generate

# ---- runtime ----------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=8080 \
    PRISMA_HIDE_UPDATE_MESSAGE=1

COPY --from=prod-deps /app/node_modules node_modules
COPY prisma prisma
# server/src is kept because the seed (prisma/seed.ts) imports server/src/env.ts.
COPY server/src server/src
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/web/dist web/dist

USER node
EXPOSE 8080
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server/dist/index.js"]
