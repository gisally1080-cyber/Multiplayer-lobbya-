const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static("."));

const rooms = {
  "Lobby 1": {},
  "Lobby 2": {},
  "Chill Room": {}
};

function safeName(name) {
  return String(name || "Player")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, 16) || "Player";
}

function getRoomState(roomName) {
  return rooms[roomName] || {};
}

function broadcastRoomList() {
  const list = Object.keys(rooms).map(name => ({
    name,
    players: Object.keys(rooms[name]).length
  }));
  io.emit("roomList", list);
}

io.on("connection", socket => {
  socket.data.room = null;
  socket.data.name = "Player";

  socket.emit("welcome", { id: socket.id });
  broadcastRoomList();

  socket.on("joinRoom", ({ roomName, name }) => {
    if (!rooms[roomName]) return;

    if (socket.data.room && rooms[socket.data.room]) {
      delete rooms[socket.data.room][socket.id];
      socket.leave(socket.data.room);
      io.to(socket.data.room).emit("players", getRoomState(socket.data.room));
    }

    socket.data.room = roomName;
    socket.data.name = safeName(name);

    rooms[roomName][socket.id] = {
      id: socket.id,
      name: socket.data.name,
      x: Math.floor(Math.random() * 600) + 80,
      y: Math.floor(Math.random() * 350) + 80,
      color: `hsl(${Math.floor(Math.random() * 360)}, 80%, 60%)`
    };

    socket.join(roomName);
    socket.emit("joined", { roomName, id: socket.id });
    io.to(roomName).emit("players", getRoomState(roomName));
    io.to(roomName).emit("chat", {
      system: true,
      text: `${socket.data.name} joined ${roomName}`
    });
    broadcastRoomList();
  });

  socket.on("move", ({ x, y }) => {
    const room = socket.data.room;
    if (!room || !rooms[room] || !rooms[room][socket.id]) return;

    const player = rooms[room][socket.id];
    player.x = Math.max(20, Math.min(780, Number(x) || player.x));
    player.y = Math.max(20, Math.min(480, Number(y) || player.y));

    socket.to(room).emit("playerMoved", player);
  });

  socket.on("chat", msg => {
    const room = socket.data.room;
    if (!room) return;

    const text = String(msg || "").replace(/[<>]/g, "").trim().slice(0, 120);
    if (!text) return;

    io.to(room).emit("chat", {
      name: socket.data.name,
      text
    });
  });

  socket.on("disconnect", () => {
    const room = socket.data.room;
    if (room && rooms[room] && rooms[room][socket.id]) {
      const name = rooms[room][socket.id].name;
      delete rooms[room][socket.id];
      io.to(room).emit("players", getRoomState(room));
      io.to(room).emit("chat", {
        system: true,
        text: `${name} left`
      });
      broadcastRoomList();
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});