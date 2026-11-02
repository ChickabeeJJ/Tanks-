FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY public ./public
COPY server ./server
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server/server.js"]
