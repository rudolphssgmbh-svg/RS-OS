FROM node:20-alpine

WORKDIR /app

COPY package.json .
RUN npm install --production

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

EXPOSE 8080

CMD ["node", "server.js"]
