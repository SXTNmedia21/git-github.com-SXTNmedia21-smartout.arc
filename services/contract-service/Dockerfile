FROM node:22-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY dist ./dist
EXPOSE 3100
ENV NODE_ENV=production
CMD ["node", "dist/server.js"]
