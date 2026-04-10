# Use a lightweight Node image
FROM node:lts-alpine

# Set working directory
WORKDIR /app

# Copy package files first (for better caching)
COPY utils/package*.json ./utils/
COPY booking-service/package*.json ./booking-service/

# Install dependencies
RUN cd utils && npm ci 
RUN cd booking-service && npm ci

# Copy full source
COPY utils ./utils
COPY booking-service ./booking-service

# Set working directory to booking-service
WORKDIR /app/booking-service

# Expose app port
EXPOSE 3002

# Start the service
CMD ["npm", "run", "dev"]
