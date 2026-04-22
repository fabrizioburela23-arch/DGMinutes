# ── Build stage ──────────────────────────────────────────────
FROM node:18-slim AS builder

WORKDIR /app

# Install build tools needed for better-sqlite3 native compilation
RUN apt-get update && \
    apt-get install -y python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

# Copy package files first for better Docker cache
COPY package.json package-lock.json ./

# Install ALL dependencies (including devDependencies for the build)
RUN npm ci

# Copy source code
COPY . .

# Build frontend (Vite) + backend (esbuild)
RUN npm run build

# ── Production stage ─────────────────────────────────────────
FROM node:18-slim

WORKDIR /app

# Install only the runtime dependency for better-sqlite3
RUN apt-get update && \
    apt-get install -y libatomic1 && \
    rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json ./

# Install only production dependencies (no devDependencies)
RUN npm ci --omit=dev

# Copy built assets from the builder stage
COPY --from=builder /app/dist ./dist

# Expose the port Railway will set via $PORT
EXPOSE ${PORT:-3000}

# Set production mode
ENV NODE_ENV=production

# Start the server
CMD ["node", "dist/server.cjs"]
