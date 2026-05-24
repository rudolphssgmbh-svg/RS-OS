FROM node:20-alpine

WORKDIR /app

COPY package.json .
RUN npm install --production

COPY server.js .
COPY keys ./keys
COPY operators ./operators

EXPOSE 8080

CMD ["node", "server.js"]
