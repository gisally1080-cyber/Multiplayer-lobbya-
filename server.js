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
  return String(name || "Player").replace(/[<>]/g, "").trim().slice(0, 16) || "Player";
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

    if (socket.data.room) {
      delete rooms[socket.data.room][socket.id];
      socket.leave(socket.data.room);
    }

    socket.data.room = roomName;
    socket.data.name = safeName(name);

    rooms[roomName][socket.id] = {
      id: socket.id,
      name: socket.data.name,
      x: Math.random() * 20 - 10,
      z: Math.random() * 20 - 10,
      rot: 0,
      color: `hsl(${Math.floor(Math.random() * 360)}, 80%, 60%)`,
      lastMessage: ""
    };

    socket.join(roomName);
    socket.emit("joined", { roomName, id: socket.id });
    io.to(roomName).emit("players", rooms[roomName]);
    broadcastRoomList();
  });

  socket.on("move", data => {
    const room = socket.data.room;
    if (!room || !rooms[room]?.[socket.id]) return;

    const p = rooms[room][socket.id];
    p.x = Math.max(-45, Math.min(45, Number(data.x) || p.x));
    p.z = Math.max(-45, Math.min(45, Number(data.z) || p.z));
    p.rot = Number(data.rot) || 0;

    socket.to(room).emit("playerMoved", p);
  });

  socket.on("chat", msg => {
    const room = socket.data.room;
    if (!room) return;

    const text = String(msg || "").replace(/[<>]/g, "").trim().slice(0, 80);
    if (!text) return;

    rooms[room][socket.id].lastMessage = text;

    io.to(room).emit("chat", {
      id: socket.id,
      name: socket.data.name,
      text
    });
  });

  socket.on("disconnect", () => {
    const room = socket.data.room;
    if (room && rooms[room]?.[socket.id]) {
      delete rooms[room][socket.id];
      io.to(room).emit("players", rooms[room]);
      broadcastRoomList();
    }
  });
});

server.listen(PORT, () => console.log(`Running on port ${PORT}`));