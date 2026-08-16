# Use the official Node.js image with pre-installed Chromium and dependencies
FROM ghcr.io/remotion-dev/template:minimal

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application files
COPY . .

# Build the Vite React frontend
RUN npm run build

# Expose the Express port (Render overrides this, but 5001 is our fallback)
EXPOSE 5001

# Start the Express server
CMD ["npx", "tsx", "server.ts"]
