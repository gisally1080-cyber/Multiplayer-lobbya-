const socket = io();

const menu = document.getElementById("menu");
const game = document.getElementById("game");
const roomsDiv = document.getElementById("rooms");
const nameInput = document.getElementById("nameInput");
const roomTitle = document.getElementById("roomTitle");
const playerCount = document.getElementById("playerCount");
const leaveBtn = document.getElementById("leaveBtn");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const messages = document.getElementById("messages");
const chatToggle = document.getElementById("chatToggle");

let myId = null;
let currentRoom = null;
let players = {};
let playerMeshes = {};
let keys = {};
let yaw = 0;
let pitch = 0;

let scene, camera, renderer;

socket.on("welcome", data => myId = data.id);

socket.on("roomList", rooms => {
  roomsDiv.innerHTML = "";
  rooms.forEach(room => {
    const div = document.createElement("div");
    div.className = "room";
    div.innerHTML = `<b>${room.name}</b><br>${room.players} players<br><button>Join</button>`;
    div.querySelector("button").onclick = () => {
      socket.emit("joinRoom", {
        roomName: room.name,
        name: nameInput.value || "Player"
      });
    };
    roomsDiv.appendChild(div);
  });
});

socket.on("joined", data => {
  currentRoom = data.roomName;
  menu.classList.add("hidden");
  game.classList.remove("hidden");
  roomTitle.textContent = data.roomName;
  init3D();
  buildMap(currentRoom);
});

socket.on("players", data => {
  players = data;
  playerCount.textContent = `${Object.keys(players).length} players`;
  Object.values(players).forEach(updatePlayerMesh);
});

socket.on("playerMoved", p => {
  players[p.id] = p;
  updatePlayerMesh(p);
});

socket.on("chat", data => {
  const div = document.createElement("div");
  div.textContent = `${data.name}: ${data.text}`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;

  if (players[data.id]) {
    players[data.id].lastMessage = data.text;
    players[data.id].messageTime = Date.now();
  }
});

leaveBtn.onclick = () => location.reload();

chatToggle.onclick = () => {
  document.getElementById("chatBox").classList.toggle("hidden");
};

chatForm.onsubmit = e => {
  e.preventDefault();
  socket.emit("chat", chatInput.value);
  chatInput.value = "";
};

window.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
window.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

function mobileButton(id, key) {
  const btn = document.getElementById(id);
  btn.addEventListener("touchstart", e => {
    e.preventDefault();
    keys[key] = true;
  });
  btn.addEventListener("touchend", e => {
    e.preventDefault();
    keys[key] = false;
  });
}

mobileButton("upBtn", "w");
mobileButton("downBtn", "s");
mobileButton("leftBtn", "a");
mobileButton("rightBtn", "d");

function init3D() {
  if (renderer) return;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);

  camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.65));

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(20, 30, 10);
  scene.add(light);

  setupLookControls();
  animate();
}

function clearMap() {
  const keep = [];
  scene.children.forEach(obj => {
    if (obj.isLight) keep.push(obj);
  });
  scene.clear();
  keep.forEach(obj => scene.add(obj));
}

function makeWall(x, z, w, h, d, color = 0x444466) {
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color })
  );
  wall.position.set(x, h / 2, z);
  scene.add(wall);
}

function buildMap(room) {
  clearMap();

  let floorColor = 0x2f8f3a;
  let skyColor = 0x87ceeb;

  if (room === "Lobby 2") {
    floorColor = 0x7755aa;
    skyColor = 0x111133;
  }

  if (room === "Chill Room") {
    floorColor = 0xccaa55;
    skyColor = 0xffbb88;
  }

  scene.background = new THREE.Color(skyColor);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({ color: floorColor })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  scene.add(new THREE.GridHelper(120, 40, 0xffffff, 0x222222));

  makeWall(0, -60, 120, 6, 2);
  makeWall(0, 60, 120, 6, 2);
  makeWall(-60, 0, 2, 6, 120);
  makeWall(60, 0, 2, 6, 120);

  if (room === "Lobby 1") {
    makeWall(0, 15, 25, 4, 2);
    makeWall(20, -10, 2, 4, 25);
    makeWall(-25, -15, 30, 4, 2);
  }

  if (room === "Lobby 2") {
    for (let i = -30; i <= 30; i += 15) {
      makeWall(i, i, 8, 8, 8, 0x663399);
    }
    makeWall(0, 0, 35, 3, 2, 0x8855ff);
  }

  if (room === "Chill Room") {
    for (let i = 0; i < 12; i++) {
      makeWall(Math.random() * 80 - 40, Math.random() * 80 - 40, 3, 8, 3, 0x996633);
    }
    makeWall(0, 0, 20, 1, 20, 0xffdd88);
  }
}

function setupLookControls() {
  document.addEventListener("mousemove", e => {
    yaw -= e.movementX * 0.002;
    pitch -= e.movementY * 0.002;
    pitch = Math.max(-1.3, Math.min(1.3, pitch));
  });

  let lastTouch = null;
  renderer.domElement.addEventListener("touchstart", e => lastTouch = e.touches[0]);
  renderer.domElement.addEventListener("touchmove", e => {
    if (!lastTouch) return;
    const t = e.touches[0];
    yaw -= (t.clientX - lastTouch.clientX) * 0.006;
    pitch -= (t.clientY - lastTouch.clientY) * 0.006;
    pitch = Math.max(-1.3, Math.min(1.3, pitch));
    lastTouch = t;
  });
}

function updatePlayerMesh(p) {
  if (p.id === myId) return;

  if (!playerMeshes[p.id]) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.5, 1.2, 4, 8),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(p.color) })
    );
    body.position.y = 1;
    group.add(body);

    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const texture = new THREE.CanvasTexture(canvas);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
    label.position.y = 2.4;
    label.scale.set(3, 1.5, 1);
    group.add(label);

    group.labelCanvas = canvas;
    group.labelTexture = texture;
    scene.add(group);
    playerMeshes[p.id] = group;
  }

  const mesh = playerMeshes[p.id];
  mesh.position.set(p.x, 0, p.z);
  mesh.rotation.y = p.rot;

  const ctx = mesh.labelCanvas.getContext("2d");
  ctx.clearRect(0, 0, 256, 128);
  ctx.fillStyle = "white";
  ctx.font = "28px Arial";
  ctx.textAlign = "center";
  ctx.fillText(p.name, 128, 42);

  if (p.lastMessage && Date.now() - (p.messageTime || 0) < 3000) {
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(20, 55, 216, 42);
    ctx.fillStyle = "white";
    ctx.font = "22px Arial";
    ctx.fillText(p.lastMessage.slice(0, 18), 128, 84);
  }

  mesh.labelTexture.needsUpdate = true;
}

function movePlayer() {
  if (!players[myId]) return;

  const p = players[myId];
  const speed = 0.16;

  const forward = new THREE.Vector3();
camera.getWorldDirection(forward);
forward.y = 0;
forward.normalize();

const right = new THREE.Vector3();
right.crossVectors(forward, camera.up).normalize();
  if (keys["w"] || keys["arrowup"]) {
    p.x += forward.x * speed;
    p.z += forward.z * speed;
  }
  if (keys["s"] || keys["arrowdown"]) {
    p.x -= forward.x * speed;
    p.z -= forward.z * speed;
  }
  if (keys["a"] || keys["arrowleft"]) {
    p.x -= right.x * speed;
    p.z -= right.z * speed;
  }
  if (keys["d"] || keys["arrowright"]) {
    p.x += right.x * speed;
    p.z += right.z * speed;
  }

  p.x = Math.max(-55, Math.min(55, p.x));
  p.z = Math.max(-55, Math.min(55, p.z));
  p.rot = yaw;

  camera.position.set(p.x, 1.8, p.z);
  camera.rotation.order = "YXZ";
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;

  socket.emit("move", { x: p.x, z: p.z, rot: yaw });
}

function animate() {
  requestAnimationFrame(animate);
  movePlayer();

  Object.values(players).forEach(p => {
    if (p.id !== myId) updatePlayerMesh(p);
  });

  renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
  if (!camera || !renderer) return;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});