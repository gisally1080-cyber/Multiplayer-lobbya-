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
let effectLines = [];

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
  updateLoadoutText();
});

socket.on("playerMoved", p => {
  players[p.id] = p;
  updatePlayerMesh(p);
});

socket.on("itemUsed", data => {
  makeEffectLine(data.x, data.z, data.dx, data.dz, data.selected);
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

window.addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;

  if (e.key === "1") socket.emit("selectItem", "ranged");
  if (e.key === "2") socket.emit("selectItem", "melee");
  if (e.key === "3") socket.emit("selectItem", "gadget");
});

window.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

window.addEventListener("click", () => useSelectedItem());

function useSelectedItem() {
  if (!players[myId] || !camera) return;

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  dir.y = 0;
  dir.normalize();

  socket.emit("useItem", {
    dx: dir.x,
    dz: dir.z
  });
}

function updateLoadoutText() {
  let hud = document.getElementById("loadoutHud");
  if (!hud) {
    hud = document.createElement("div");
    hud.id = "loadoutHud";
    hud.style.position = "fixed";
    hud.style.right = "10px";
    hud.style.top = "60px";
    hud.style.zIndex = "10";
    hud.style.background = "rgba(0,0,0,0.6)";
    hud.style.padding = "10px";
    hud.style.borderRadius = "12px";
    hud.style.fontFamily = "Arial";
    hud.style.color = "white";
    document.body.appendChild(hud);
  }

  const me = players[myId];
  if (!me || !me.loadout) return;

  hud.innerHTML = `
    <b>Items</b><br>
    1 Ranged: ${me.loadout.ranged} ${me.selected === "ranged" ? "◀" : ""}<br>
    2 Melee: ${me.loadout.melee} ${me.selected === "melee" ? "◀" : ""}<br>
    3 Gadget: ${me.loadout.gadget} ${me.selected === "gadget" ? "◀" : ""}<br>
    HP: ${Math.round(me.health)}
  `;
}

function mobileButton(id, key) {
  const btn = document.getElementById(id);
  if (!btn) return;

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
  playerMeshes = {};
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

  if (room === "Item Asylum") {
    floorColor = 0x555555;
    skyColor = 0x1b1b25;
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

  if (room === "Item Asylum") {
    makeWall(0, 0, 20, 2, 20, 0x777777);
    makeWall(30, 0, 12, 8, 12, 0x333344);
    makeWall(-30, 0, 12, 8, 12, 0x333344);
    makeWall(0, 30, 30, 4, 4, 0x993333);
    makeWall(0, -30, 4, 4, 30, 0x339933);

    for (let i = 0; i < 18; i++) {
      makeWall(Math.random() * 90 - 45, Math.random() * 90 - 45, 4, 3, 4, 0x666666);
    }
  } else {
    makeWall(0, 15, 25, 4, 2);
    makeWall(20, -10, 2, 4, 25);
    makeWall(-25, -15, 30, 4, 2);
  }
}

function setupLookControls() {
  document.addEventListener("mousemove", e => {
    yaw -= e.movementX * 0.002;
    pitch -= e.movementY * 0.002;
    pitch = Math.max(-1.3, Math.min(1.3, pitch));
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

    const itemBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.25, 0.25),
      new THREE.MeshStandardMaterial({ color: 0xffff00 })
    );
    itemBox.position.set(0.65, 1.1, -0.25);
    group.add(itemBox);

    const labelCanvas = document.createElement("canvas");
    labelCanvas.width = 256;
    labelCanvas.height = 128;

    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture }));
    label.position.y = 2.5;
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
  ctx.font = "27px Arial";
  ctx.textAlign = "center";
  ctx.fillText(p.name, 128, 35);

  ctx.fillStyle = "lime";
  ctx.font = "18px Arial";
  ctx.fillText(`HP ${Math.round(p.health)}`, 128, 58);

  if (p.lastMessage && Date.now() - (p.messageTime || 0) < 3000) {
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(20, 72, 216, 42);
    ctx.fillStyle = "white";
    ctx.font = "22px Arial";
    ctx.fillText(p.lastMessage.slice(0, 18), 128, 101);
  }

  mesh.labelTexture.needsUpdate = true;
}

function makeEffectLine(x, z, dx, dz, type) {
  if (!scene) return;

  let length = type === "melee" ? 5 : 45;

  const points = [
    new THREE.Vector3(x, 1.5, z),
    new THREE.Vector3(x + dx * length, 1.5, z + dz * length)
  ];

  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({ color: type === "gadget" ? 0x00ffff : 0xffffff });
  const line = new THREE.Line(geo, mat);

  scene.add(line);
  effectLines.push({ line, time: Date.now() });
}

function movePlayer() {
  if (!players[myId]) return;

  const p = players[myId];
  let speed = p.speedBoostUntil && Date.now() < p.speedBoostUntil ? 0.28 : 0.16;

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

  socket.emit("move", {
    x: p.x,
    z: p.z,
    rot: yaw
  });
}

function animate() {
  requestAnimationFrame(animate);

  movePlayer();
  updateLoadoutText();

  Object.values(players).forEach(p => {
    if (p.id !== myId) updatePlayerMesh(p);
  });

  effectLines = effectLines.filter(s => {
    if (Date.now() - s.time > 160) {
      scene.remove(s.line);
      return false;
    }
    return true;
  });

  renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
  if (!camera || !renderer) return;

  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});