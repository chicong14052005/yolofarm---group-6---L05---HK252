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

const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://smart-farmsmart-life.vercel.app',
];

const configuredOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const socketAllowedOrigins = [...new Set([...defaultAllowedOrigins, ...configuredOrigins])];

const isSocketOriginAllowed = (origin) => {
  if (!origin) return true;
  if (socketAllowedOrigins.includes(origin)) return true;
  return /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);
};

// Khởi tạo Socket.IO
const io = new Server(server, {
  cors: {
    origin(origin, callback) {
      callback(null, isSocketOriginAllowed(origin));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  }
});

// Lưu io instance vào shared manager
socketManager.setIO(io);

const activeSockets = new Map(); // socket.id -> userId

const broadcastOnlineUsers = () => {
  const onlineUserIds = Array.from(new Set(activeSockets.values()));
  io.emit('onlineUsersUpdate', onlineUserIds);
};

io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client káº¿t ná»‘i: ${socket.id}`);

  // Gáº¯n userId vĂ o socket náº¿u client gá»i
  socket.on('register', (userId) => {
    socket.join(`user_${userId}`);
    activeSockets.set(socket.id, userId);
    broadcastOnlineUsers();
  });

  // Láº¯ng nghe yĂªu cáº§u láº¥y danh sĂ¡ch tĂ i khoáº£n Ä‘ang online (cho admin)
  socket.on('requestOnlineUsers', () => {
    const onlineUserIds = Array.from(new Set(activeSockets.values()));
    socket.emit('onlineUsersUpdate', onlineUserIds);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client ngáº¯t káº¿t ná»‘i: ${socket.id}`);
    if (activeSockets.has(socket.id)) {
      activeSockets.delete(socket.id);
      broadcastOnlineUsers();
    }
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
