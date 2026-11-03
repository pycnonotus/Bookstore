FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY db ./db
COPY drizzle ./drizzle
USER node
CMD ["npm", "run", "db:migrate"]
