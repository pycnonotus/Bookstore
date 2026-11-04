FROM node:22-alpine AS server
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY server/db ./db
COPY server/drizzle ./drizzle
COPY server/src ./src
USER node
EXPOSE 3012
CMD ["npm", "start"]

FROM node:22-alpine AS frontend
WORKDIR /app
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM caddy:2-alpine AS caddy
COPY client/Caddyfile /etc/caddy/Caddyfile
COPY --from=frontend /app/dist /srv
