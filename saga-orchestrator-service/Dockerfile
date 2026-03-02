# Use a lightweight Node image
FROM node:lts-alpine

# Set working directory
WORKDIR /app

# Copy package files first (for better caching)
COPY utils/package*.json ./utils/
COPY saga-orchestrator-service/package*.json ./saga-orchestrator-service/

# Install dependencies
RUN cd utils && npm ci && cd ../saga-orchestrator-service && npm ci

# Copy full source
COPY utils ./utils
COPY saga-orchestrator-service ./saga-orchestrator-service

# Set working directory to saga-orchestrator-service
WORKDIR /app/saga-orchestrator-service

# Expose app port
EXPOSE 3004

# Start the service
CMD ["npm", "run", "dev"]
