# Dockerfile (place in repo root)
FROM node:18-alpine

# Create app dir
WORKDIR /usr/src/app

# Install dependencies (if this is a Node project)
COPY package.json package-lock.json* ./

RUN if [ -f package.json ]; then \
      if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev || true; fi; \
    else \
      echo "no package.json, skipping npm step"; \
    fi

# Copy source
COPY . .

# Create uploads dir and ensure permissions
RUN mkdir -p /usr/src/app/uploads && chown -R node:node /usr/src/app/uploads

USER node
EXPOSE 3000

CMD ["node", "server.js"]
