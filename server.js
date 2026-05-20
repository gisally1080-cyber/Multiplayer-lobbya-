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

const breakables = {
  "Lobby 1": {},
  "Lobby 2": {},
  "Chill Room": {}
};

for (const room in breakables) {
  for (let i = 0; i < 14; i++) {
    breakables[room]["block" + i] = {
      id: "block" + i,
      x: Math.random() * 80 - 40,
      z: Math.random() * 80 - 40,
      broken: false
    };
  }
}

function safeName(name) {
  return String(name || "Player").replace(/[<>]/g, "").trim().slice(0, 16) || "Player";
}

function broadcastRoomList() {
  io.emit("roomList", Object.keys(rooms).map(name => ({
    name,
    players: Object.keys(rooms[name]).length
  })));
}

io.on("connection", socket => {
  socket.emit("welcome", { id: socket.id });
  broadcastRoomList();

  socket.on("joinRoom", ({ roomName, name }) => {
    if (!rooms[roomName]) return;

    socket.data.room = roomName;
    socket.data.name = safeName(name);

    rooms[roomName][socket.id] = {
      id: socket.id,
      name: socket.data.name,
      x: Math.random() * 20 - 10,
      z: Math.random() * 20 - 10,
      rot: 0,
      health: 100,
      hasGun: socket.data.name.toLowerCase() === "gun",
      color: `hsl(${Math.floor(Math.random() * 360)}, 80%, 60%)`
    };

    socket.join(roomName);
    socket.emit("joined", { roomName, id: socket.id });
    io.to(roomName).emit("players", rooms[roomName]);
    io.to(roomName).emit("breakables", breakables[roomName]);
    broadcastRoomList();
  });

  socket.on("move", data => {
    const room = socket.data.room;
    const p = rooms[room]?.[socket.id];
    if (!p) return;

    p.x = Math.max(-55, Math.min(55, Number(data.x) || p.x));
    p.z = Math.max(-55, Math.min(55, Number(data.z) || p.z));
    p.rot = Number(data.rot) || 0;

    socket.to(room).emit("playerMoved", p);
  });

  socket.on("shoot", data => {
    const room = socket.data.room;
    const shooter = rooms[room]?.[socket.id];
    if (!shooter || !shooter.hasGun) return;

    const sx = shooter.x;
    const sz = shooter.z;
    const dx = Number(data.dx);
    const dz = Number(data.dz);

    io.to(room).emit("gunShot", { x: sx, z: sz, dx, dz });

    for (const id in rooms[room]) {
      if (id === socket.id) continue;

      const target = rooms[room][id];
      const vx = target.x - sx;
      const vz = target.z - sz;
      const distance = Math.sqrt(vx * vx + vz * vz);
      if (distance === 0) continue;

      const dot = (vx / distance) * dx + (vz / distance) * dz;

      if (distance < 45 && dot > 0.96) {
        target.health = 100;
        target.x = Math.random() * 20 - 10;
        target.z = Math.random() * 20 - 10;
        io.to(room).emit("players", rooms[room]);
      }
    }

    for (const id in breakables[room]) {
      const b = breakables[room][id];
      if (b.broken) continue;

      const vx = b.x - sx;
      const vz = b.z - sz;
      const distance = Math.sqrt(vx * vx + vz * vz);
      if (distance === 0) continue;

      const dot = (vx / distance) * dx + (vz / distance) * dz;

      if (distance < 55 && dot > 0.97) {
        b.broken = true;
        io.to(room).emit("breakables", breakables[room]);
      }
    }
  });

  socket.on("chat", msg => {
    const room = socket.data.room;
    if (!room) return;

    const text = String(msg || "").replace(/[<>]/g, "").trim().slice(0, 80);
    if (!text) return;

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