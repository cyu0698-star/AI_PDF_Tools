FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Hosts (Render/Railway) inject $PORT. Fall back to 3000 for local runs.
ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000

# Shell form so ${PORT} is expanded at runtime.
CMD npm run start -- -H 0.0.0.0 -p ${PORT}
