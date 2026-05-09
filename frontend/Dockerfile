# Build stage
FROM node:18-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Runtime stage
FROM node:18-alpine
WORKDIR /app

# Install serve to run the static app
RUN npm install -g serve

# Copy built app from build stage
COPY --from=build /app/dist ./dist

EXPOSE 3000
ENV SERVE_PORT=3000

CMD ["serve", "-s", "dist", "-l", "3000"]
