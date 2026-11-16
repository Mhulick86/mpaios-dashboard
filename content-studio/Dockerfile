FROM node:22.16.0-slim
WORKDIR /app
COPY package.json server.mjs db.mjs agents.mjs knowledge.mjs qa-checks.mjs events.mjs env.mjs integrations.mjs ./
COPY public ./public
COPY scripts ./scripts
COPY knowledge/seed.json ./knowledge/seed.json
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4173 DATA_DIR=/app/data
RUN mkdir -p /app/data
EXPOSE 4173
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:4173/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
