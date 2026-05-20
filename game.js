const socket = io();

const menu = document.getElementById("menu");
const game = document.getElementById("game");
const roomsDiv = document.getElementById("rooms");
const nameInput = document.getElementById("nameInput");
const leaveBtn = document.getElementById("leaveBtn");
const roomTitle = document.getElementById("roomTitle");
const playerCount = document.getElementById("playerCount");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const messages = document.getElementById("messages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");

let myId = null;
let currentRoom = null;
let players = {};
let keys = {};

socket.on("welcome", data => {
  myId = data.id;
});

socket.on("roomList", rooms => {
  roomsDiv.innerHTML = "";
  rooms.forEach(room => {
    const div = document.createElement("div");
    div.className = "room";
    div.innerHTML = `
      <div>
        <strong>${room.name}</strong><br>
        <span>${room.players} player${room.players === 1 ? "" : "s"}</span>
      </div>
      <button>Join</button>
    `;
    div.querySelector("button").onclick = () => joinRoom(room.name);
    roomsDiv.appendChild(div);
  });
});

socket.on("joined", data => {
  currentRoom = data.roomName;
  menu.classList.add("hidden");
  game.classList.remove("hidden");
  roomTitle.textContent = data.roomName;
  messages.innerHTML = "";
});

socket.on("players", serverPlayers => {
  players = serverPlayers;
  playerCount.textContent = `${Object.keys(players).length} player${Object.keys(players).length === 1 ? "" : "s"}`;
  draw();
});

socket.on("playerMoved", player => {
  if (players[player.id]) {
    players[player.id] = player;
    draw();
  }
});

socket.on("chat", data => {
  const div = document.createElement("div");
  div.className = data.system ? "msg system" : "msg";
  div.textContent = data.system ? data.text : `${data.name}: ${data.text}`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
});

function joinRoom(roomName) {
  const name = nameInput.value.trim() || "Player";
  socket.emit("joinRoom", { roomName, name });
}

leaveBtn.onclick = () => {
  location.reload();
};

chatForm.addEventListener("submit", e => {
  e.preventDefault();
  socket.emit("chat", chatInput.value);
  chatInput.value = "";
});

window.addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;
});

window.addEventListener("keyup", e => {
  keys[e.key.toLowerCase()] = false;
});

function updateMovement() {
  if (!currentRoom || !players[myId]) return;

  const me = players[myId];
  let speed = 4;
  let moved = false;

  if (keys["w"] || keys["arrowup"]) {
    me.y -= speed;
    moved = true;
  }
  if (keys["s"] || keys["arrowdown"]) {
    me.y += speed;
    moved = true;
  }
  if (keys["a"] || keys["arrowleft"]) {
    me.x -= speed;
    moved = true;
  }
  if (keys["d"] || keys["arrowright"]) {
    me.x += speed;
    moved = true;
  }

  me.x = Math.max(20, Math.min(canvas.width - 20, me.x));
  me.y = Math.max(20, Math.min(canvas.height - 20, me.y));

  if (moved) {
    socket.emit("move", { x: me.x, y: me.y });
    draw();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  for (let x = 0; x < canvas.width; x += 40) {
    ctx.fillRect(x, 0, 1, canvas.height);
  }
  for (let y = 0; y < canvas.height; y += 40) {
    ctx.fillRect(0, y, canvas.width, 1);
  }

  Object.values(players).forEach(p => {
    ctx.beginPath();
    ctx.fillStyle = p.color;
    ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
    ctx.fill();

    if (p.id === myId) {
      ctx.strokeStyle = "white";
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    ctx.fillStyle = "white";
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    ctx.fillText(p.name, p.x, p.y - 26);
  });
}

setInterval(updateMovement, 1000 / 60);
draw();