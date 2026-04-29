FROM node:20-alpine
WORKDIR /app

# Install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --production

# Copy server source
COPY server/ ./server/

EXPOSE 3001
ENV NODE_ENV=production

CMD ["node", "server/index.js"]
