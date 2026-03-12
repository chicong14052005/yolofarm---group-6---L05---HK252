// Shared Socket.IO instance holder
// Dùng để các module (userController, notificationService, schedulerService) 
// có thể emit events mà không cần truyền io qua hàm

let io = null;

module.exports = {
  setIO(socketIo) {
    io = socketIo;
  },
  getIO() {
    return io;
  }
};
