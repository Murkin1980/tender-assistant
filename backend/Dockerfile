FROM node:22.22.3-bookworm-slim AS build

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/package.json

RUN corepack enable && pnpm install --frozen-lockfile

COPY backend ./backend

RUN pnpm --filter @tender-assistant/backend build \
  && pnpm --filter @tender-assistant/backend deploy --prod /prod/backend \
  && rm -rf /prod/backend/dist \
  && cp -R backend/dist /prod/backend/dist

FROM node:22.22.3-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /prod/backend ./

EXPOSE 3000

CMD ["node", "dist/main.js"]
