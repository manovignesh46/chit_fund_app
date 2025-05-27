FROM node:18-slim

# Set working directory
WORKDIR /usr/src/app

# Copy only package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the source code
COPY . .

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl

# Generate Prisma client for the correct environment
RUN npx prisma generate

# Build the Next.js app
RUN npm run build

# Expose port
EXPOSE 3000

# Start the app
CMD ["npm", "start"]
