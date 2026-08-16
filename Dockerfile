# Remotion's minimal image has Chromium + FFmpeg pre-installed
FROM ghcr.io/remotion-dev/template:minimal

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev && npm ci

# Copy the rest of the application files
COPY . .

# Build Vite client + pre-bundle Remotion compositions
RUN npm run build

# Expose the Express port
EXPOSE 5001

# ── 512 MB RAM budget ──────────────────────────────────────────────────────
# --max-old-space-size=384  → Node.js heap capped at 384 MB
# remaining ~128 MB reserved for Chromium subprocess + OS
ENV NODE_OPTIONS="--max-old-space-size=384"
# ──────────────────────────────────────────────────────────────────────────

# Use tsx to run TypeScript directly; PORT is injected by Render at runtime
CMD ["npx", "tsx", "server.ts"]
