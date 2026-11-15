# syntax=docker/dockerfile:1
#
# Pangtao production image: one container serves the API and the built React app
# (system-sds §1). Used by docker compose; CI (#24) and Cloud Run (#25, #27) are to use it unchanged.
#
# - Settings come from the environment at run time (R-02). No secret or .env is baked in;
#   NODE_ENV, PORT and APP_COMMIT are defaults the environment can override.
# - The same image runs the service (default CMD) and the one-off database job:
#     npx prisma migrate deploy              (every release)
#     npx prisma db seed                     (Cloud Run: first deploy only; compose: every up; deployment.md §3)
# - Build with the commit so the running release can be identified (R-08):
#     docker build --build-arg GIT_SHA=$(git rev-parse HEAD) -t pangtao:local .
# - Needs BuildKit (default since Docker 23; buildx in GitHub Actions) for the npm cache mounts.

# Node 22 LTS, pinned by version and digest so a rebuild from the same commit uses the same
# base. To update: `docker buildx imagetools inspect node:22-bookworm-slim`, then replace both.
ARG NODE_IMAGE=node:22.23.5-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee

# ---- base: OS packages shared by every stage --------------------------------
FROM ${NODE_IMAGE} AS base
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false
# openssl: Prisma engines. tini: PID 1, forwards signals to its child and reaps zombie
# processes, which matters for the `sh -c` / npx / tsx chain of the migrate job. The server
# shuts down gracefully on SIGTERM through its own handler (server/src/index.ts).
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
# The seed (prisma/seed.ts) imports server/src/env.ts, run by tsx; nothing else in src is used.
COPY server/src/env.ts server/src/env.ts
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/web/dist web/dist

# Last, so a new commit only rebuilds these metadata layers.
ARG GIT_SHA=unknown
LABEL org.opencontainers.image.title="pangtao" \
      org.opencontainers.image.source="https://github.com/Finyakginshabu/pangtao" \
      org.opencontainers.image.revision="${GIT_SHA}"
ENV APP_COMMIT=${GIT_SHA}

USER node
EXPOSE 8080
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server/dist/index.js"]
