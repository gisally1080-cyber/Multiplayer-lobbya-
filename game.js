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
const lookBtn = document.getElementById("lookBtn");

let myId = null;
let currentRoom = null;
let players = {};
let playerMeshes = {};
let keys = {};
let yaw = 0;
let pitch = 0;

let scene, camera, renderer;

socket.on("welcome", data => {
  myId = data.id;
});

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
});

socket.on("players", data => {
  players = data;
  playerCount.textContent = `${Object.keys(players).length} players`;
  syncPlayers();
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

chatForm.onsubmit = e => {
  e.preventDefault();
  socket.emit("chat", chatInput.value);
  chatInput.value = "";
};

window.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
window.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

function init3D() {
  if (renderer) return;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);

  camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
  camera.position.set(0, 2, 5);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(renderer.domElement);

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(10, 20, 10);
  scene.add(light);

  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshStandardMaterial({ color: 0x228833 })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  for (let i = 0; i < 25; i++) {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2),
      new THREE.MeshStandardMaterial({ color: 0x777777 })
    );
    box.position.set(Math.random() * 80 - 40, 1, Math.random() * 80 - 40);
    scene.add(box);
  }

  setupLookControls();
  animate();
}

function setupLookControls() {
  lookBtn.onclick = () => {
    renderer.domElement.requestPointerLock();
  };

  document.addEventListener("mousemove", e => {
    if (document.pointerLockElement === renderer.domElement) {
      yaw -= e.movementX * 0.002;
      pitch -= e.movementY * 0.002;
      pitch = Math.max(-1.3, Math.min(1.3, pitch));
    }
  });

  let lastTouch = null;

  renderer.domElement.addEventListener("touchstart", e => {
    lastTouch = e.touches[0];
  });

  renderer.domElement.addEventListener("touchmove", e => {
    if (!lastTouch) return;
    const t = e.touches[0];
    yaw -= (t.clientX - lastTouch.clientX) * 0.006;
    pitch -= (t.clientY - lastTouch.clientY) * 0.006;
    pitch = Math.max(-1.3, Math.min(1.3, pitch));
    lastTouch = t;
  });
}

function syncPlayers() {
  Object.values(players).forEach(updatePlayerMesh);
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

    const labelCanvas = document.createElement("canvas");
    labelCanvas.width = 256;
    labelCanvas.height = 128;
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture }));
    label.position.y = 2.4;
    label.scale.set(3, 1.5, 1);
    group.add(label);

    group.labelCanvas = labelCanvas;
    group.labelTexture = labelTexture;

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
    ctx.fillStyle = "rgba(0,0,0,0.7)";
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

  const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw) * -1);
  const right = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw));

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

  p.x = Math.max(-45, Math.min(45, p.x));
  p.z = Math.max(-45, Math.min(45, p.z));
  p.rot = yaw;

  camera.position.set(p.x, 1.8, p.z);
  camera.rotation.order = "YXZ";
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;

  socket.emit("move", {
    x: p.x,
    z: p.z,
    rot: yaw
  });
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