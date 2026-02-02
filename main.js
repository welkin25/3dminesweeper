import * as THREE from "three";
import { EdgesGeometry, LineSegments, LineBasicMaterial } from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";

// ---------------- Scene ----------------
let loadedFont = null;

function loadFont() {
  return new Promise((resolve, reject) => {
    const loader = new FontLoader();
    loader.load(
      "/fonts/helvetiker_regular.typeface.json",
      (font) => {
        loadedFont = font;
        resolve(font);
      },
      undefined,
      reject,
    );
  });
}
await loadFont();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f1020);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.position.set(5, 5, -10);
camera.lookAt(5, 5, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// ---------------- Controls ----------------
const controls = new PointerLockControls(camera, document.body);
document.addEventListener("click", () => {
  if (!controls.isLocked) controls.lock();
});

const keys = { w: false, a: false, s: false, d: false, z: false, x: false };
document.addEventListener("keydown", (e) => {
  if (e.code === "KeyW") keys.w = true;
  if (e.code === "KeyA") keys.a = true;
  if (e.code === "KeyS") keys.s = true;
  if (e.code === "KeyD") keys.d = true;
  if (e.code === "KeyZ") keys.z = true;
  if (e.code === "KeyX") keys.x = true;
});
document.addEventListener("keyup", (e) => {
  if (e.code === "KeyW") keys.w = false;
  if (e.code === "KeyA") keys.a = false;
  if (e.code === "KeyS") keys.s = false;
  if (e.code === "KeyD") keys.d = false;
  if (e.code === "KeyZ") keys.z = false;
  if (e.code === "KeyX") keys.x = false;
});

// ---------------- Lighting ----------------
scene.add(new THREE.AmbientLight(0xffffff, 0.1));
const light = new THREE.DirectionalLight(0xffffff, 0.2);
light.position.set(5, 10, 5);
scene.add(light);

const spotlight = new THREE.SpotLight(0x88ccff, 10, 40, Math.PI / 10, 0.2, 2);
// camera.add(spotlight);
spotlight.position.set(0, 11, 1);
spotlight.target = camera;
scene.add(spotlight);
// scene.add(spotlight.target);

// scene.add(new THREE.GridHelper(20, 20));

const loader = new THREE.TextureLoader();
const caustics = loader.load("caustics.jpg");

caustics.wrapS = caustics.wrapT = THREE.RepeatWrapping;
caustics.repeat.set(2, 2);

const causticsMat = new THREE.MeshBasicMaterial({
  map: caustics,
  transparent: true,
  opacity: 0.15,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

const causticsPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  causticsMat
);

causticsPlane.position.y = -50;
causticsPlane.rotation.x = -Math.PI / 2;
scene.add(causticsPlane);

// ---------------- Blocks ----------------
function makeTextTexture(number) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, size, size);

  // background
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);

  // text
  ctx.fillStyle = "white";
  ctx.font = "bold 64px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(number, size / 2, size / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  return texture;
}

const cubeGeo = new THREE.BoxGeometry(1, 1, 1);
const cubeMat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
const transParentMaterial = new THREE.MeshStandardMaterial({
  transparent: true,
  opacity: 0,
  color: 0x00ff00,
});

const GRID_SIZE = 11;
const blocks = [];
let numMines = 50;

// assume grid[x][y][z] already exists and is filled with 0
const coords = [];

// generate all possible coordinates
for (let x = 0; x < GRID_SIZE; x++) {
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let z = 0; z < GRID_SIZE; z++) {
        coords.push([x, y, z]);
    }
  }
}

function make3DArray(x, y, z) {
  return Array.from({ length: x }, () =>
    Array.from({ length: y }, () =>
      Array.from({ length: z }, () => ({
        mine: false,
        surround: 0,
        block: undefined,
      })),
    ),
  );
}

// ---------------- Win or lose ----------------
function checkWin() {
  if (numMines != 0) return;
  let won = true;
  outer: for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        if (!mineMap[x][y][z].block) continue;
        if (
          !mineMap[x][y][z].block.userData.revealed &&
          !mineMap[x][y][z].block.userData.flagged
        ) {
          won = false;
          break outer;
        }
      }
    }
  }

  if (won) {
    gameOver(true);
  }
}

function gameOver(won) {
  const overlay = won
    ? document.getElementById("winScreen")
    : document.getElementById("loseScreen");
  overlay.style.display = "flex";

  // optionally stop controls / animation
  controls.unlock(); // release pointer lock
  // cancelAnimationFrame or set a flag to stop updates
}

const colorMap = {
  1: 0x0000ff,
  2: 0x008000,
  3: 0xff0000,
  4: 0x00008b,
  5: 0x800000,
  6: 0x008080,
  7: 0x000000,
};

function reveal({ x, y, z }) {
  if (!mineMap[x][y][z].block) {
    return;
  }
  if (mineMap[x][y][z].block.userData.revealed) {
    return;
  }

  if (mineMap[x][y][z].mine) {
    const geometry = new THREE.SphereGeometry(0.5, 32, 32); // radius=1, 32 segments
    const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });

    // Create the mesh
    const sphere = new THREE.Mesh(geometry, material);

    // Position it if you like
    sphere.position.set(
      mineMap[x][y][z].block.position.x,
      mineMap[x][y][z].block.position.y,
      mineMap[x][y][z].block.position.z,
    );
    // Add it to the scene
    scene.add(sphere);

    scene.remove(mineMap[x][y][z].block);
    gameOver();
  }

  const oldBlock = mineMap[x][y][z].block;
    oldBlock.userData.revealed = true;

  if (mineMap[x][y][z].surround !== 0) {

    const edges = new EdgesGeometry(oldBlock.geometry);
    const line = new LineSegments(
      edges,
      new LineBasicMaterial({ color: 0x111133, opacity: 0.5 }),
    );
    oldBlock.add(line);
    oldBlock.material = transParentMaterial;
    const geometry = new TextGeometry(`${mineMap[x][y][z].surround}`, {
      font: loadedFont,
      size: 0.8, // height of text
      depth: 0.5,
      curveSegments: 12,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelOffset: 0,
      bevelSegments: 3,
    });
    geometry.computeBoundingBox();
    geometry.center();

    const material = new THREE.MeshStandardMaterial({
      color: colorMap[mineMap[x][y][z].surround] ?? 0x000000,
    });
    const textMesh = new THREE.Mesh(geometry, material);
    textMesh.position.set(
      oldBlock.position.x,
      oldBlock.position.y,
      oldBlock.position.z,
    );
    textMesh.userData = {
      revealed: true,
      flagged: false,
      gridPos: { x, y, z },
    };
    mineMap[x][y][z].block = textMesh;
    scene.add(textMesh);

    checkWin();
    return;
  }
  // this is zero
  scene.remove(oldBlock);
  mineMap[x][y][z].block = undefined;

  // Check neighbors in 3D
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dx === 0 && dy === 0 && dz === 0) continue;

        const nx = x + dx;
        const ny = y + dy;
        const nz = z + dz;

        if (
          nx >= 0 &&
          nx < GRID_SIZE &&
          ny >= 0 &&
          ny < GRID_SIZE &&
          nz >= 0 &&
          nz < GRID_SIZE
        ) {
          reveal({ x: nx, y: ny, z: nz });
        }
      }
    }
  }
  checkWin();
}

const mineMap = make3DArray(GRID_SIZE, GRID_SIZE, GRID_SIZE);

// Fisher–Yates shuffle
for (let i = coords.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [coords[i], coords[j]] = [coords[j], coords[i]];
}

document.getElementById("numMinesLeft").innerHTML = numMines;

for (let i = 0; i < numMines; i++) {
  const [x, y, z] = coords[i];
  mineMap[x][y][z].mine = true;
}

// initialize the numbers
for (let x = 0; x < GRID_SIZE; x++) {
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let z = 0; z < GRID_SIZE; z++) {
      let count = 0;

      // loop over all neighbors
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -1; dz <= 1; dz++) {
            // skip the cell itself
            if (dx === 0 && dy === 0 && dz === 0) continue;

            const nx = x + dx;
            const ny = y + dy;
            const nz = z + dz;

            // check bounds
            if (
              nx >= 0 &&
              nx < GRID_SIZE &&
              ny >= 0 &&
              ny < GRID_SIZE &&
              nz >= 0 &&
              nz < GRID_SIZE
            ) {
              if (mineMap[nx][ny][nz].mine) {
                count++;
              } else {
              }
            }
          }
        }
      }

      mineMap[x][y][z].surround = count;
    }
  }
}

for (let x = 0; x < GRID_SIZE; x++) {
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let z = 0; z < GRID_SIZE; z++) {
      const cube = new THREE.Mesh(cubeGeo, cubeMat);
      cube.position.set(
        x,
        y,
        z,
      );
      //   console.log(cube.position, mineMap[x][y][z].surround);
      cube.userData.gridPos = { x, y, z };
      cube.userData.revealed = false;
      cube.userData.flagged = false;
      mineMap[x][y][z].block = cube;
      scene.add(cube);
      blocks.push(cube);
    }
  }
}

// ---------------- Raycaster (click remove) ----------------
const raycaster = new THREE.Raycaster();
raycaster.far = 6;

document.addEventListener("mousedown", (event) => {
  if (!controls.isLocked) return;

  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const unrevealedBlocks = blocks.filter((b) => !b.userData.revealed);
  const hits = raycaster.intersectObjects(unrevealedBlocks);

  if (hits.length > 0) {
    const block = hits[0].object;
    if (event.button === 0) {
      reveal(block.userData.gridPos);
    } else if (event.button === 2) {
      if (!block.userData.flagged) {
        const texture = makeTextTexture("🚩");
        block.material = new THREE.MeshStandardMaterial({
          map: texture,
        //   transparent: true,
        });
        block.userData.flagged = true;
        numMines--;
        document.getElementById("numMinesLeft").innerHTML = numMines;
        checkWin();
      } else {
        // unflag
        block.material = cubeMat;
        block.userData.flagged = false;
        numMines++;
        document.getElementById("numMinesLeft").innerHTML = numMines;
      }
    }
  }
});

// ---------------- Collision ----------------
const PLAYER_RADIUS = 0.3;
const PLAYER_HEIGHT = 1.6;

function collides(position) {
  return false;
  //   for (const block of blocks) {
  //     if (block.userData.revealed) {
  //       continue;
  //     }
  //     const bx = block.position.x;
  //     const by = block.position.y;
  //     const bz = block.position.z;

  //     // Block AABB
  //     const minX = bx - 0.5 - PLAYER_RADIUS;
  //     const maxX = bx + 0.5 + PLAYER_RADIUS;
  //     const minZ = bz - 0.5 - PLAYER_RADIUS;
  //     const maxZ = bz + 0.5 + PLAYER_RADIUS;

  //     const minY = by - 0.5;
  //     const maxY = by + 0.5 + PLAYER_HEIGHT;

  //     if (
  //       position.x > minX &&
  //       position.x < maxX &&
  //       position.z > minZ &&
  //       position.z < maxZ &&
  //       position.y > minY &&
  //       position.y < maxY
  //     ) {
  //       return true;
  //     }
  //   }
  //   return false;
}

// ---------------- Animation loop ----------------
const clock = new THREE.Clock();
const velocity = new THREE.Vector3();

function updateSpotlight() {
    // Position it 1 unit behind camera
    const behind = new THREE.Vector3(0, 0, 1); // +Z is behind camera in camera space
    behind.applyQuaternion(camera.quaternion); // rotate into camera orientation
    spotlight.position.copy(camera.position).add(behind);

    // Point it forward
    // const forward = new THREE.Vector3(0, 0, -1); // forward in camera space
    // forward.applyQuaternion(camera.quaternion);
    // spotlight.target.position.copy(camera.position.clone().add(forward));
}

function animate(time) {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const speed = 5;

  velocity.set(0, 0, 0);

  if (controls.isLocked) {
    if (keys.w) velocity.z -= speed * delta;
    if (keys.s) velocity.z += speed * delta;
    if (keys.a) velocity.x -= speed * delta;
    if (keys.d) velocity.x += speed * delta;
    if (keys.z) velocity.y -= speed * delta;
    if (keys.x) velocity.y += speed * delta;

    // Move in camera space
    const move = velocity.clone().applyQuaternion(camera.quaternion);

    // X movement
    const nextX = camera.position.clone();
    nextX.x += move.x;
    if (!collides(nextX)) camera.position.x = nextX.x;

    // Y movement
    const nextY = camera.position.clone();
    nextY.y += move.y;
    if (!collides(nextY)) camera.position.y = nextY.y;

    // Z movement
    const nextZ = camera.position.clone();
    nextZ.z += move.z;
    if (!collides(nextZ)) camera.position.z = nextZ.z;
  }

//   console.log("camera", camera.position);
const pos = new THREE.Vector3();
spotlight.getWorldPosition(pos);
// console.log("spotlight world position:", pos);
// console.log("spotlight target:", spotlight.target.position);

  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        if (
          !mineMap[x][y][z].block ||
          !mineMap[x][y][z].block.userData.revealed
        ) {
          continue;
        }
        mineMap[x][y][z].block.lookAt(camera.position);
        mineMap[x][y][z].block.position.y += Math.sin(time * 0.001 + mineMap[x][y][z].block.position.x) * 0.001;
      }
    }
  }

  // water effects
  caustics.offset.x = time * 0.00002;
  caustics.offset.y = time * 0.00003;

    updateSpotlight();
  renderer.render(scene, camera);
}

animate();

// ---------------- Resize ----------------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
