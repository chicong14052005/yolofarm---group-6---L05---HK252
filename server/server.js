process.env.TZ = 'Asia/Ho_Chi_Minh';
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./src/app');
const mqttService = require('./src/services/mqttService');
const schedulerService = require('./src/services/schedulerService');

const PORT = process.env.PORT || 5000;

// Tạo HTTP server
const server = http.createServer(app);

const socketManager = require('./src/config/socketManager');

// Khởi tạo Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',') : ['http://localhost:5173', 'https://smart-farmsmart-life.vercel.app'],
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Lưu io instance vào shared manager
socketManager.setIO(io);

io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client kết nối: ${socket.id}`);

  // Gắn userId vào socket nếu client gửi
  socket.on('register', (userId) => {
    socket.join(`user_${userId}`);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client ngắt kết nối: ${socket.id}`);
  });
});

// Khởi tạo MQTT Service
mqttService.init(io);

// Khởi động Scheduler (truyền io để weatherService emit realtime)
schedulerService.start(io);

// Start server
server.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║   🌱 YoloFarm Server is running          ║
  ║   Port: ${PORT}                              ║
  ║   Mode: ${process.env.NODE_ENV || 'development'}                    ║
  ║   API:  http://localhost:${PORT}/api          ║
  ╚═══════════════════════════════════════════╝
  `);
});

module.exports = server;
