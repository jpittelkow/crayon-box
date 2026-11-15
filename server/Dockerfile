# Crayon Box family sync server (ADR 0024). Node 24 runs the TypeScript directly and has SQLite built in, so the
# image is Node plus the source files: no install step, no dependencies. Family data lives only in /data.
FROM node:24-alpine
LABEL org.opencontainers.image.source="https://github.com/jpittelkow/crayon-box" \
      org.opencontainers.image.description="Crayon Box family sync server (ADR 0024)" \
      org.opencontainers.image.licenses="MIT"

WORKDIR /app
COPY package.json ./
COPY src ./src

ENV NODE_ENV=production \
    PORT=8787 \
    DATA_DIR=/data

RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
EXPOSE 8787
USER node

HEALTHCHECK --interval=60s --timeout=5s --start-period=10s \
  CMD wget -q -O /dev/null http://127.0.0.1:${PORT}/api/v1/info || exit 1

CMD ["node", "--disable-warning=ExperimentalWarning", "src/main.ts"]
