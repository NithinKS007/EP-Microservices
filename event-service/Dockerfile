# Use a lightweight Node image
FROM node:lts-alpine

# Set working directory
WORKDIR /app

# Copy package files first (for better caching)
COPY utils/package*.json ./utils/
COPY event-service/package*.json ./event-service/

# Install dependencies
RUN cd utils && npm ci && cd ../event-service && npm ci

# Copy full source
COPY utils ./utils
COPY event-service ./event-service

# Set working directory to event-service
WORKDIR /app/event-service

# Expose app port
EXPOSE 3003

# Start the service
CMD ["npm", "run", "dev"]
