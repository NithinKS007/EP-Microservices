# Use a lightweight Node image
FROM node:lts-alpine

# Set working directory
WORKDIR /app

# Copy package files first (for better caching)
COPY utils/package*.json ./utils/
COPY user-service/package*.json ./user-service/

# Install dependencies
RUN cd utils && npm ci 
RUN cd user-service && npm ci

# Copy full source
COPY utils ./utils
COPY user-service ./user-service

# Set working directory to user-service
WORKDIR /app/user-service

# Expose app port
EXPOSE 3002

# Start the service
CMD ["npm", "run", "dev"]
