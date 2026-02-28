FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY dist ./dist
EXPOSE 3100
ENV NODE_ENV=production
CMD ["node", "dist/server.js"]
