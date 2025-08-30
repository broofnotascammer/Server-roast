# Use official Node.js runtime as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy application source
COPY . .

# Create directory for model cache
RUN mkdir -p .cache

# Expose the port the app runs on
EXPOSE 3001

# Define environment variable
ENV PORT=3001
ENV NODE_ENV=production

# Run the application
CMD ["npm", "start"]
