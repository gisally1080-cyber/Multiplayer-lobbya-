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

 