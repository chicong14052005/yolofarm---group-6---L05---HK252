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

const PRESENCE_TTL_MS = Number(process.env.PRESENCE_TTL_MS || 45000);
const PRESENCE_HEARTBEAT_EVENT = 'presenceHeartbeat';

// socket.id -> { userId: number, lastSeen: number }
const activeSockets = new Map();

const normalizeUserId = (rawUserId) => {
  const parsed = Number(rawUserId);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

const getOnlineUserIds = () => {
  const now = Date.now();
  const ids = [];

  for (const presence of activeSockets.values()) {
    if (now - presence.lastSeen <= PRESENCE_TTL_MS) {
      ids.push(presence.userId);
    }
  }

  return Array.from(new Set(ids));
};

const upsertPresence = (socket, rawUserId) => {
  const normalizedUserId = normalizeUserId(rawUserId);
  if (!normalizedUserId) return false;

  socket.join(`user_${normalizedUserId}`);
  activeSockets.set(socket.id, {
    userId: normalizedUserId,
    lastSeen: Date.now(),
  });

  return true;
};

const broadcastOnlineUsers = () => {
  const onlineUserIds = getOnlineUserIds();
  io.emit('onlineUsersUpdate', onlineUserIds);
};

// Periodically remove stale sockets that did not send heartbeat in time.
const presenceCleanupInterval = setInterval(() => {
  const now = Date.now();
  let hasChanged = false;

  for (const [socketId, presence] of activeSockets.entries()) {
    if (now - presence.lastSeen > PRESENCE_TTL_MS) {
      activeSockets.delete(socketId);
      hasChanged = true;
    }
  }

  if (hasChanged) {
    broadcastOnlineUsers();
  }
}, 10000);

server.on('close', () => {
  clearInterval(presenceCleanupInterval);
});

io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client káº¿t ná»‘i: ${socket.id}`);

  // Gáº¯n userId vĂ o socket náº¿u client gá»i
  socket.on('register', (userId) => {
    if (upsertPresence(socket, userId)) {
      broadcastOnlineUsers();
    }
  });

  socket.on(PRESENCE_HEARTBEAT_EVENT, (userId) => {
    if (upsertPresence(socket, userId)) {
      broadcastOnlineUsers();
    }
  });

  // Láº¯ng nghe yĂªu cáº§u láº¥y danh sĂ¡ch tĂ i khoáº£n Ä‘ang online (cho admin)
  socket.on('requestOnlineUsers', () => {
    const onlineUserIds = getOnlineUserIds();
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
