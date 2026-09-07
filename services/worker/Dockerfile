FROM node:22-alpine
RUN corepack enable
WORKDIR /repo
# The worker imports lib/agentPrompts.ts and lib/agents.ts from the dashboard, so copy both.
COPY services/worker/package.json services/worker/pnpm-lock.yaml ./services/worker/
RUN cd services/worker && pnpm install --frozen-lockfile --prod=false
COPY lib/agentPrompts.ts lib/agents.ts ./lib/
COPY services/worker ./services/worker
WORKDIR /repo/services/worker
ENV NODE_ENV=production
EXPOSE 8787
CMD ["pnpm", "start"]
