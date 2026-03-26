# Use a lightweight Node image
FROM node:lts-alpine

# Set working directory
WORKDIR /app

# Copy package files first (for better caching)
COPY utils/package*.json ./utils/
COPY payment-service/package*.json ./payment-service/

# Install dependencies
RUN cd utils && npm ci 
RUN cd payment-service && npm ci

# Copy full source
COPY utils ./utils
COPY payment-service ./payment-service

# Set working directory to payment-service
WORKDIR /app/payment-service

# Expose app port
EXPOSE 3005

# Start the service
CMD ["npm", "run", "dev"]
