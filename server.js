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
  "Chill Room": {},
  "Item Asylum": {}
};

const rangedItems = [
  "Blaster", "Slingshot", "Boom Stick", "Paint Rifle", "Crossbow", "Bubble Gun",
  "Snowball Cannon", "Firecracker", "Star Shooter", "Zap Wand"
];

const meleeItems = [
  "Big Sword", "Hammer", "Frying Pan", "Bat", "Stop Sign", "Pipe",
  "Golden Spoon", "Chair", "Shovel", "Rubber Chicken"
];

const gadgetItems = [
  "Speed Cola", "Heal Soda", "Dash Boots", "Smoke Bomb", "Gravity Glove",
  "Banana Peel", "Shield Watch", "Jump Spring", "Swap Remote", "Mini Turret"
];

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function safeName(name) {
  return String(name || "Player").replace(/[<>]/g, "").trim().slice(0, 16) || "Player";
}

function makeLoadout() {
  return {
    ranged: rand(rangedItems),
    melee: rand(meleeItems),
    gadget: rand(gadgetItems)
  };
}

function spawnPlayer(socket, roomName, name) {
  rooms[roomName][socket.id] = {
    id: socket.id,
    name,
    x: Math.random() * 20 - 10,
    z: Math.random() * 20 - 10,
    rot: 0,
    health: 100,
    loadout: makeLoadout(),
    selected: "ranged",
    color: `hsl(${Math.floor(Math.random() * 360)}, 80%, 60%)`
  };
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

    spawnPlayer(socket, roomName, socket.data.name);

    socket.join(roomName);
    socket.emit("joined", { roomName, id: socket.id });
    io.to(roomName).emit("players", rooms[roomName]);
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

  socket.on("selectItem", slot => {
    const room = socket.data.room;
    const p = rooms[room]?.[socket.id];
    if (!p) return;

    if (["ranged", "melee", "gadget"].includes(slot)) {
      p.selected = slot;
      io.to(room).emit("players", rooms[room]);
    }
  });

  socket.on("useItem", data => {
    const room = socket.data.room;
    const p = rooms[room]?.[socket.id];
    if (!p) return;

    const dx = Number(data.dx);
    const dz = Number(data.dz);
    const selected = p.selected;
    const itemName = p.loadout[selected];

    io.to(room).emit("itemUsed", {
      id: p.id,
      x: p.x,
      z: p.z,
      dx,
      dz,
      itemName,
      selected
    });

    if (selected === "ranged") {
      for (const id in rooms[room]) {
        if (id === socket.id) continue;
        const t = rooms[room][id];

        const vx = t.x - p.x;
        const vz = t.z - p.z;
        const dist = Math.sqrt(vx * vx + vz * vz);
        if (dist === 0) continue;

        const dot = (vx / dist) * dx + (vz / dist) * dz;

        if (dist < 45 && dot > 0.96) {
          t.health -= 35;
          if (t.health <= 0) {
            t.health = 100;
            t.loadout = makeLoadout();
            t.x = Math.random() * 20 - 10;
            t.z = Math.random() * 20 - 10;
          }
        }
      }
    }

    if (selected === "melee") {
      for (const id in rooms[room]) {
        if (id === socket.id) continue;
        const t = rooms[room][id];

        const dist = Math.hypot(t.x - p.x, t.z - p.z);
        if (dist < 5) {
          t.health -= 50;
          if (t.health <= 0) {
            t.health = 100;
            t.loadout = makeLoadout();
            t.x = Math.random() * 20 - 10;
            t.z = Math.random() * 20 - 10;
          }
        }
      }
    }

    if (selected === "gadget") {
      if (itemName === "Heal Soda") {
        p.health = Math.min(100, p.health + 45);
      }

      if (itemName === "Dash Boots") {
        p.x += dx * 9;
        p.z += dz * 9;
      }

      if (itemName === "Speed Cola") {
        p.speedBoostUntil = Date.now() + 5000;
      }

      if (itemName === "Jump Spring") {
        p.x += dx * 4;
        p.z += dz * 4;
      }

      if (itemName === "Shield Watch") {
        p.health = Math.min(150, p.health + 50);
      }

      if (itemName === "Swap Remote") {
        const others = Object.values(rooms[room]).filter(o => o.id !== p.id);
        if (others.length) {
          const target = rand(others);
          const ox = p.x;
          const oz = p.z;
          p.x = target.x;
          p.z = target.z;
          target.x = ox;
          target.z = oz;
        }
      }
    }

    io.to(room).emit("players", rooms[room]);
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