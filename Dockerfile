# Dockerfile (place in repo root)
FROM node:18-alpine

# Create app dir
WORKDIR /usr/src/app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy source
COPY . .

# Create uploads dir and ensure permissions
RUN mkdir -p /usr/src/app/uploads && chown -R node:node /usr/src/app/uploads

USER node
EXPOSE 3000

CMD ["node", "server.js"]
