# syntax=docker/dockerfile:1
FROM node:20-slim
WORKDIR /app

# 先装依赖
COPY package*.json ./
COPY backend/package*.json ./backend/
RUN npm install

# 复制源码并构建前端
COPY . .
RUN npm run build

# 启动服务
EXPOSE 3000
CMD ["node", "backend/server.js"]
