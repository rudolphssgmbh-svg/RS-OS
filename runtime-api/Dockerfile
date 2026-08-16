FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js .
COPY bootstrap ./bootstrap
COPY evidence ./evidence
COPY ingress ./ingress
COPY keys ./keys
COPY operators ./operators
COPY modules ./modules
COPY response ./response
COPY routes ./routes
COPY trace ./trace
COPY verification ./verification
COPY src ./src

EXPOSE 8080

CMD ["node", "server.js"]
