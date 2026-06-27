FROM node:20-alpine
RUN apk add --no-cache wget

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server.js ./
COPY control.html ./

ENV NODE_ENV=production
ENV RSOS_REGISTRY_HOST=0.0.0.0
ENV RSOS_REGISTRY_PORT=8090
ENV RSOS_REGISTRY_BASE_DIR=/app
ENV RSOS_REGISTRY_DATA_DIR=/data

EXPOSE 8090

CMD ["npm", "start"]
