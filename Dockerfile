FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/proto ./proto
COPY --from=builder /app/dto ./dto
COPY --from=builder /app/package*.json ./

RUN npm ci

EXPOSE 3000

CMD ["node", "dist/src/main.js"]

