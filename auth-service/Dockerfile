# Use a lightweight Node image
FROM node:lts-alpine

# Set working directory
WORKDIR /app

# Copy package files first (for better caching)
COPY utils/package*.json ./utils/
COPY auth-service/package*.json ./auth-service/

# Install dependencies
RUN cd utils && npm ci 
RUN cd auth-service && npm ci

# Copy full source
COPY utils ./utils
COPY auth-service ./auth-service

# Set working directory to auth-service
WORKDIR /app/auth-service

# Expose app port
EXPOSE 3001

# Start the service
CMD ["npm", "run", "dev"] 