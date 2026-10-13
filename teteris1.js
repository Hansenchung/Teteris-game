const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
context.scale(20, 20);

const nextCanvas = document.getElementById('next-piece');
const nextContext = nextCanvas.getContext('2d');
nextContext.scale(20, 20);

const holdCanvas = document.getElementById('hold-piece');
const holdContext = holdCanvas.getContext('2d');
holdContext.scale(20, 20);

const COLORS = [
  null,
  '#00E5FF', // I
  '#3877FF', // J
  '#FF8E0D', // L
  '#FFE138', // O
  '#0DFF72', // S
  '#F538FF', // T
  '#FF0D72'  // Z
];
const PIECE_TYPES = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
const PIECE_VALUES = { I: 1, J: 2, L: 3, O: 4, S: 5, T: 6, Z: 7 };
const JLSTZ_KICKS = {
  '0>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '1>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '1>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '2>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '2>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '3>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '3>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '0>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]
};
const I_KICKS = {
  '0>1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '1>0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '1>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  '2>1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '3>2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '3>0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '0>3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]]
};

let audioCtx = null;
function initAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!audioCtx && AudioContextClass) audioCtx = new AudioContextClass();
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

function playSound(type) {
  if (!audioCtx) return;
  const sounds = {
    move: [300, 0.05],
    rotate: [450, 0.05],
    drop: [150, 0.08],
    clear: [600, 0.2],
    gameover: [100, 0.4]
  };
  const [frequency, duration] = sounds[type];
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  oscillator.connect(gain);
  gain.connect(audioCtx.destination);
  oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
  oscillator.start();
  oscillator.stop(audioCtx.currentTime + duration);
}

function createPiece(type) {
  const shapes = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    J: [[2, 0, 0], [2, 2, 2], [0, 0, 0]],
    L: [[0, 0, 3], [3, 3, 3], [0, 0, 0]],
    O: [[4, 4], [4, 4]],
    S: [[0, 5, 5], [5, 5, 0], [0, 0, 0]],
    T: [[0, 6, 0], [6, 6, 6], [0, 0, 0]],
    Z: [[7, 7, 0], [0, 7, 7], [0, 0, 0]]
  };
  return shapes[type].map(row => row.slice());
}

function createMatrix(width, height) {
  return Array.from({ length: height }, () => new Array(width).fill(0));
}

const arena = createMatrix(12, 20);
const savedHighScore = Number.parseInt(localStorage.getItem('tetris_highscore') || '0', 10);
const player = {
  pos: { x: 0, y: 0 },
  matrix: null,
  type: null,
  nextType: null,
  heldType: null,
  canHold: true,
  rotation: 0,
  score: 0,
  highScore: Number.isFinite(savedHighScore) ? savedHighScore : 0,
  lines: 0,
  level: 1
};

let bag = [];
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let isPaused = true;
let isGameOver = false;

function drawMatrix(ctx, matrix, offset, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        ctx.fillStyle = COLORS[value];
        ctx.fillRect(x + offset.x, y + offset.y, 1, 1);
        ctx.lineWidth = 0.05;
        ctx.strokeStyle = '#000';
        ctx.strokeRect(x + offset.x, y + offset.y, 1, 1);
      }
    });
  });
  ctx.restore();
}

function drawPreview(ctx, canvasElement, type) {
  ctx.fillStyle = '#0d0d13';
  ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);
  if (!type) return;
  const matrix = createPiece(type);
  drawMatrix(ctx, matrix, {
    x: (4 - matrix[0].length) / 2,
    y: (4 - matrix.length) / 2
  });
}

function drawNextPiece() {
  drawPreview(nextContext, nextCanvas, player.nextType);
}

function drawHoldPiece() {
  drawPreview(holdContext, holdCanvas, player.heldType);
  document.getElementById('hold-label').textContent = player.heldType || '—';
}

function getGhostPosition() {
  const ghost = { x: player.pos.x, y: player.pos.y };
  while (!collide(arena, player.matrix, ghost)) ghost.y++;
  ghost.y--;
  return ghost;
}

function drawOverlay() {
  if (!isPaused && !isGameOver) return;
  context.fillStyle = 'rgba(13, 13, 19, 0.78)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#fff';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = 'bold 1.2px Segoe UI, sans-serif';
  const title = isGameOver ? 'GAME OVER' : player.matrix ? 'PAUSED' : 'READY';
  context.fillText(title, canvas.width / 40, canvas.height / 40 - 0.5);
  context.font = '0.55px Segoe UI, sans-serif';
  context.fillText(isGameOver ? 'Press Start to play again' : 'Press Start to play', canvas.width / 40, canvas.height / 40 + 0.7);
}

function draw() {
  context.fillStyle = '#0d0d13';
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawMatrix(context, arena, { x: 0, y: 0 });
  if (player.matrix) {
    if (!isGameOver) drawMatrix(context, player.matrix, getGhostPosition(), 0.25);
    drawMatrix(context, player.matrix, player.pos);
  }
  drawOverlay();
}

function merge() {
  player.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) arena[y + player.pos.y][x + player.pos.x] = value;
    });
  });
}

function collide(board, matrix, position) {
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[y].length; x++) {
      if (matrix[y][x] === 0) continue;
      const boardY = y + position.y;
      const boardX = x + position.x;
      if (boardX < 0 || boardX >= board[0].length || boardY >= board.length) return true;
      if (boardY >= 0 && board[boardY][boardX] !== 0) return true;
    }
  }
  return false;
}

function arenaSweep() {
  let cleared = 0;
  outer: for (let y = arena.length - 1; y >= 0; y--) {
    for (let x = 0; x < arena[y].length; x++) {
      if (arena[y][x] === 0) continue outer;
    }
    arena.splice(y, 1);
    arena.unshift(new Array(arena[0].length).fill(0));
    cleared++;
    y++;
  }
  if (cleared) {
    const lineScores = [0, 100, 300, 500, 800];
    player.score += lineScores[cleared] * player.level;
    player.lines += cleared;
    player.level = Math.floor(player.lines / 10) + 1;
    dropInterval = Math.max(80, 1000 * Math.pow(0.8, player.level - 1));
    playSound('clear');
  }
  if (player.score > player.highScore) {
    player.highScore = player.score;
    localStorage.setItem('tetris_highscore', String(player.highScore));
  }
  updateScore();
}

function playerDrop(softDrop = false) {
  player.pos.y++;
  if (collide(arena, player.matrix, player.pos)) {
    player.pos.y--;
    lockPiece();
  } else if (softDrop) {
    player.score++;
    updateScore();
  }
  dropCounter = 0;
}

function lockPiece() {
  merge();
  player.matrix = null;
  arenaSweep();
  player.canHold = true;
  playSound('drop');
  spawnPiece();
}

function playerHardDrop() {
  let distance = 0;
  while (!collide(arena, player.matrix, { x: player.pos.x, y: player.pos.y + 1 })) {
    player.pos.y++;
    distance++;
  }
  player.score += distance * 2;
  updateScore();
  lockPiece();
  dropCounter = 0;
}

function playerMove(direction) {
  const nextPosition = { x: player.pos.x + direction, y: player.pos.y };
  if (!collide(arena, player.matrix, nextPosition)) {
    player.pos.x = nextPosition.x;
    playSound('move');
  }
}

function getRandomPiece() {
  if (bag.length === 0) {
    bag = PIECE_TYPES.slice();
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  }
  return bag.pop();
}

function spawnPiece() {
  player.type = player.nextType || getRandomPiece();
  player.matrix = createPiece(player.type);
  player.nextType = getRandomPiece();
  player.rotation = 0;
  player.pos.y = 0;
  player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);
  drawNextPiece();
  if (collide(arena, player.matrix, player.pos)) {
    isGameOver = true;
    isPaused = true;
    player.matrix = null;
    playSound('gameover');
    document.getElementById('start-btn').textContent = 'Play Again';
  }
  draw();
}

function holdPiece() {
  if (!player.canHold || !player.matrix) return;
  const currentType = player.type;
  if (player.heldType) {
    const currentPosition = { x: player.pos.x, y: player.pos.y };
    const currentRotation = player.rotation;
    const currentMatrix = player.matrix;
    player.type = player.heldType;
    player.matrix = createPiece(player.type);
    player.rotation = 0;
    player.pos.y = 0;
    player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);
    if (collide(arena, player.matrix, player.pos)) {
      player.type = currentType;
      player.matrix = currentMatrix;
      player.rotation = currentRotation;
      player.pos = currentPosition;
      return;
    }
  } else {
    player.matrix = null;
    spawnPiece();
  }
  player.heldType = currentType;
  player.canHold = false;
  drawHoldPiece();
}

function rotateMatrix(matrix, direction) {
  const size = matrix.length;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < y; x++) {
      [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    }
  }
  if (direction > 0) matrix.forEach(row => row.reverse());
  else matrix.reverse();
}

function playerRotate(direction) {
  if (player.type === 'O') return;
  const from = player.rotation;
  const to = (from + (direction > 0 ? 1 : 3)) % 4;
  const kicks = (player.type === 'I' ? I_KICKS : JLSTZ_KICKS)[`${from}>${to}`];
  rotateMatrix(player.matrix, direction);
  for (const [x, y] of kicks) {
    const candidate = { x: player.pos.x + x, y: player.pos.y - y };
    if (!collide(arena, player.matrix, candidate)) {
      player.pos = candidate;
      player.rotation = to;
      playSound('rotate');
      return;
    }
  }
  rotateMatrix(player.matrix, -direction);
}

function resetGame() {
  arena.forEach(row => row.fill(0));
  player.score = 0;
  player.lines = 0;
  player.level = 1;
  player.type = null;
  player.nextType = null;
  player.heldType = null;
  player.canHold = true;
  player.matrix = null;
  player.rotation = 0;
  bag = [];
  dropInterval = 1000;
  isGameOver = false;
  isPaused = false;
  dropCounter = 0;
  lastTime = 0;
  document.getElementById('start-btn').textContent = 'Pause';
  updateScore();
  drawHoldPiece();
  player.nextType = getRandomPiece();
  spawnPiece();
}

function updateScore() {
  document.getElementById('score').textContent = player.score;
  document.getElementById('high-score').textContent = player.highScore;
  document.getElementById('lines').textContent = player.lines;
  document.getElementById('level').textContent = player.level;
}

function update(time = 0) {
  if (isPaused) return;
  const deltaTime = lastTime ? time - lastTime : 0;
  lastTime = time;
  dropCounter += deltaTime;
  if (dropCounter >= dropInterval && player.matrix) playerDrop();
  draw();
  if (!isPaused) requestAnimationFrame(update);
}

function performAction(action) {
  if (isPaused || !player.matrix) return;
  if (action === 'left') playerMove(-1);
  else if (action === 'right') playerMove(1);
  else if (action === 'down') playerDrop(true);
  else if (action === 'rotate') playerRotate(1);
  else if (action === 'hard-drop') playerHardDrop();
  else if (action === 'hold') holdPiece();
  draw();
}

document.addEventListener('keydown', event => {
  if (event.target instanceof HTMLElement && event.target.closest('button')) return;
  const actions = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowDown: 'down',
    ArrowUp: 'rotate',
    Space: 'hard-drop',
    KeyC: 'hold',
    ShiftLeft: 'hold',
    ShiftRight: 'hold'
  };
  if (event.code === 'KeyP' && !isGameOver && player.matrix) {
    isPaused = !isPaused;
    lastTime = 0;
    document.getElementById('start-btn').textContent = isPaused ? 'Resume' : 'Pause';
    if (!isPaused) update();
    else draw();
    return;
  }
  const action = actions[event.code];
  if (!action) return;
  event.preventDefault();
  performAction(action);
});

document.getElementById('start-btn').addEventListener('click', () => {
  initAudio();
  if (isGameOver || !player.matrix) {
    resetGame();
    update();
  } else if (isPaused) {
    isPaused = false;
    lastTime = 0;
    document.getElementById('start-btn').textContent = 'Pause';
    update();
  } else {
    isPaused = true;
    document.getElementById('start-btn').textContent = 'Resume';
    draw();
  }
});

document.querySelectorAll('[data-action]').forEach(button => {
  button.addEventListener('click', () => performAction(button.dataset.action));
});

updateScore();
drawNextPiece();
drawHoldPiece();
draw();
