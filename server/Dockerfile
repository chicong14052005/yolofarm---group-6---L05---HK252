FROM node:20-bookworm-slim

# Thiết lập thư mục làm việc trong container
WORKDIR /app

# Copy package.json vào trước
COPY package*.json ./

# Theo đúng setting trên Render: Cài đặt pnpm toàn cục, sau đó dùng pnpm để install dependencies
RUN npm install -g pnpm && pnpm install

# Copy toàn bộ source code còn lại vào container
COPY . .

# Khai báo các thiết lập môi trường
ENV NODE_ENV=production
ENV PORT=7860
EXPOSE 7860

# Lệnh chạy server (tương đương node server.js)
CMD ["node", "server.js"]