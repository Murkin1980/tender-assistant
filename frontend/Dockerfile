FROM node:22.22.3-bookworm-slim AS build

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json ./frontend/package.json

RUN corepack enable && pnpm install --frozen-lockfile

COPY frontend ./frontend

ARG NEXT_PUBLIC_API_BASE_URL=/api
ARG BACKEND_INTERNAL_URL=http://backend:3000
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV BACKEND_INTERNAL_URL=$BACKEND_INTERNAL_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter @tender-assistant/frontend build \
  && pnpm --filter @tender-assistant/frontend deploy --prod /prod/frontend \
  && rm -rf /prod/frontend/.next /prod/frontend/public \
  && cp -R frontend/.next /prod/frontend/.next \
  && cp -R frontend/public /prod/frontend/public

FROM node:22.22.3-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=build /prod/frontend ./

EXPOSE 3000

CMD ["node", "node_modules/next/dist/bin/next", "start"]
