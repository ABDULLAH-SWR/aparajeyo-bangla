# The Food API. Build context: the feature root (src/features/food); .dockerignore admits only what
# is copied here, so no .env file or dataset can reach an image.
# The Bun version must equal "packageManager" in the repository's root package.json.
FROM oven/bun:1.4.4
WORKDIR /app

# contract/ resolves its packages from the feature root, the API from api/.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY api/package.json api/bun.lock api/
RUN cd api && bun install --frozen-lockfile --production

COPY api/*.ts api/
COPY contract contract
COPY types.ts ./
COPY data/geo_codes.v03.json data/geo_codes.v03.json.sha256 data/

USER bun
CMD ["bun", "api/server.ts"]
