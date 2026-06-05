FROM node:18-slim

# Install latest chrome dev package and necessary system dependencies to support Puppeteer
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer environment to use the system-installed Chrome binary
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /app

# Copy dependency files
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy application code
COPY whatsapp-gateway.js ./

# Expose port (Render/Railway will read this or assign PORT env var)
EXPOSE 3001

# Command to execute the gateway
CMD ["node", "whatsapp-gateway.js"]
