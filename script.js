// ---------- Helpers / Storage ----------
const STORAGE_KEY = "arcadeAlleyData_v1";

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      playerName: "",
      points: 0,
      winsTTT: 0,
      winsGuess: 0,
      leaderboard: [] // { name, points, updatedISO }
    };
  }
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return loadData();
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

let data = loadData();

// ---------- UI Elements ----------
const yearEl = document.getElementById("year");
yearEl.textContent = new Date().getFullYear();

const statTTT = document.getElementById("statTTT");
const statGuess = document.getElementById("statGuess");
const statPoints = document.getElementById("statPoints");
const pointsNow = document.getElementById("pointsNow");

const playerNameInput = document.getElementById("playerName");
const leaderBody = document.getElementById("leaderTableBody");

const saveNameBtn = document.getElementById("saveNameBtn");
const clearScoresBtn = document.getElementById("clearScoresBtn");
const resetAllBtn = document.getElementById("resetAllBtn");
const addBonusBtn = document.getElementById("addBonusBtn");

// Mobile nav
const mobileToggle = document.getElementById("mobileToggle");
const mobileNav = document.getElementById("mobileNav");

mobileToggle.addEventListener("click", () => {
  mobileNav.classList.toggle("show");
});

// Close mobile nav on click
mobileNav.querySelectorAll("a").forEach(a => {
  a.addEventListener("click", () => mobileNav.classList.remove("show"));
});

// ---------- Leaderboard ----------
function upsertLeaderboardEntry(name, points) {
  if (!name.trim()) return;

  const nowISO = new Date().toISOString();
  const existingIndex = data.leaderboard.findIndex(e => e.name.toLowerCase() === name.toLowerCase());

  if (existingIndex >= 0) {
    // keep best points
    data.leaderboard[existingIndex].points = Math.max(data.leaderboard[existingIndex].points, points);
    data.leaderboard[existingIndex].updatedISO = nowISO;
  } else {
    data.leaderboard.push({ name: name.trim(), points, updatedISO: nowISO });
  }

  data.leaderboard.sort((a, b) => b.points - a.points);
  data.leaderboard = data.leaderboard.slice(0, 8);
}

function renderLeaderboard() {
  leaderBody.innerHTML = "";
  const rows = data.leaderboard;

  if (rows.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="4" class="muted">No scores yet — win a game!</td>`;
    leaderBody.appendChild(tr);
    return;
  }

  rows.forEach((row, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${escapeHtml(row.name)}</td>
      <td><strong>${row.points}</strong></td>
      <td class="muted">${formatDate(row.updatedISO)}</td>
    `;
    leaderBody.appendChild(tr);
  });
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function awardPoints(amount, reason) {
  data.points = Math.max(0, (data.points || 0) + amount);

  // auto-upsert leaderboard if name exists
  if (data.playerName.trim()) {
    upsertLeaderboardEntry(data.playerName, data.points);
  }

  saveData(data);
  renderAllStats();
  renderLeaderboard();

  // tiny console breadcrumb
  console.log(`[Points] +${amount} for ${reason}. Total: ${data.points}`);
}

function renderAllStats() {
  statTTT.textContent = `${data.winsTTT || 0} wins`;
  statGuess.textContent = `${data.winsGuess || 0} wins`;
  statPoints.textContent = `${data.points || 0}`;
  pointsNow.textContent = `${data.points || 0}`;
  playerNameInput.value = data.playerName || "";
}

saveNameBtn.addEventListener("click", () => {
  const name = playerNameInput.value.trim();
  data.playerName = name;
  if (name) upsertLeaderboardEntry(name, data.points || 0);
  saveData(data);
  renderLeaderboard();
});

clearScoresBtn.addEventListener("click", () => {
  data.leaderboard = [];
  saveData(data);
  renderLeaderboard();
});

resetAllBtn.addEventListener("click", () => {
  const ok = confirm("Reset ALL saved data (points, wins, leaderboard)?");
  if (!ok) return;

  localStorage.removeItem(STORAGE_KEY);
  data = loadData();
  resetTTT(true);
  resetGuess(true);
  renderAllStats();
  renderLeaderboard();
});

addBonusBtn.addEventListener("click", () => {
  awardPoints(5, "bonus button");
});

// ---------- Tic Tac Toe ----------
const tttBoardEl = document.getElementById("tttBoard");
const tttStatusEl = document.getElementById("tttStatus");
const tttNewGameBtn = document.getElementById("tttNewGameBtn");
const tttClearBtn = document.getElementById("tttClearBtn");

let tttBoard = Array(9).fill("");
let tttLocked = false;

function buildTTTBoard() {
  tttBoardEl.innerHTML = "";
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement("button");
    cell.className = "ttt-cell";
    cell.type = "button";
    cell.setAttribute("aria-label", `Cell ${i + 1}`);
    cell.addEventListener("click", () => handleTTTMove(i));
    tttBoardEl.appendChild(cell);
  }
}

function renderTTT() {
  const cells = tttBoardEl.querySelectorAll(".ttt-cell");
  cells.forEach((c, i) => {
    c.textContent = tttBoard[i];
    c.classList.toggle("disabled", tttLocked || tttBoard[i] !== "");
  });
}

function setTTTStatus(text) {
  tttStatusEl.textContent = text;
}

function handleTTTMove(i) {
  if (tttLocked) return;
  if (tttBoard[i] !== "") return;

  // Player = X
  tttBoard[i] = "X";
  renderTTT();

  const result = checkTTTResult(tttBoard);
  if (result) {
    endTTT(result);
    return;
  }

  // AI move
  tttLocked = true;
  setTTTStatus("AI thinking…");

  setTimeout(() => {
    const aiIndex = pickAIMove(tttBoard);
    if (aiIndex !== -1) tttBoard[aiIndex] = "O";
    tttLocked = false;
    renderTTT();

    const after = checkTTTResult(tttBoard);
    if (after) {
      endTTT(after);
    } else {
      setTTTStatus("Your turn");
    }
  }, 450);
}

function checkTTTResult(b) {
  const wins = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];

  for (const [a,c,d] of wins) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) {
      return { type: "win", winner: b[a], line: [a,c,d] };
    }
  }

  if (b.every(x => x !== "")) return { type: "draw" };
  return null;
}

function endTTT(result) {
  tttLocked = true;

  if (result.type === "draw") {
    setTTTStatus("Draw 🤝");
    awardPoints(1, "Tic-Tac-Toe draw");
    return;
  }

  if (result.winner === "X") {
    setTTTStatus("You win 🏆");
    data.winsTTT = (data.winsTTT || 0) + 1;
    saveData(data);
    awardPoints(10, "Tic-Tac-Toe win");
  } else {
    setTTTStatus("AI wins 😵");
    awardPoints(0, "Tic-Tac-Toe loss");
  }
}

function resetTTT(silent = false) {
  tttBoard = Array(9).fill("");
  tttLocked = false;
  renderTTT();
  setTTTStatus("Your turn");
  if (!silent) console.log("[TTT] reset");
}

tttNewGameBtn.addEventListener("click", () => resetTTT(false));
tttClearBtn.addEventListener("click", () => resetTTT(false));

/**
 * Basic AI: tries to win, then block, then center, then random corner/side.
 */
function pickAIMove(board) {
  const empty = board.map((v, idx) => (v === "" ? idx : -1)).filter(x => x !== -1);

  // 1) Win if possible
  for (const idx of empty) {
    const copy = board.slice();
    copy[idx] = "O";
    if (checkTTTResult(copy)?.winner === "O") return idx;
  }

  // 2) Block player's win
  for (const idx of empty) {
    const copy = board.slice();
    copy[idx] = "X";
    if (checkTTTResult(copy)?.winner === "X") return idx;
  }

  // 3) Take center
  if (board[4] === "") return 4;

  // 4) Corners
  const corners = [0,2,6,8].filter(i => board[i] === "");
  if (corners.length) return corners[Math.floor(Math.random() * corners.length)];

  // 5) Sides
  const sides = [1,3,5,7].filter(i => board[i] === "");
  if (sides.length) return sides[Math.floor(Math.random() * sides.length)];

  return -1;
}

// ---------- Guess the Number ----------
const guessStatusEl = document.getElementById("guessStatus");
const guessInput = document.getElementById("guessInput");
const guessBtn = document.getElementById("guessBtn");
const guessNewBtn = document.getElementById("guessNewBtn");
const guessHintEl = document.getElementById("guessHint");
const guessLogEl = document.getElementById("guessLog");

let secret = randomInt(1, 20);
let triesLeft = 6;
let guessOver = false;

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function setGuessStatus(text) {
  guessStatusEl.textContent = text;
}

function logGuessLine(html) {
  const p = document.createElement("p");
  p.className = "log-line";
  p.innerHTML = html;
  guessLogEl.prepend(p);
}

function resetGuess(silent = false) {
  secret = randomInt(1, 20);
  triesLeft = 6;
  guessOver = false;
  guessInput.value = "";
  guessLogEl.innerHTML = "";
  guessHintEl.textContent = "You have 6 tries.";
  setGuessStatus("Ready");
  if (!silent) console.log("[Guess] new secret generated");
}

function finishGuessWin() {
  guessOver = true;
  setGuessStatus("Win 🎯");
  data.winsGuess = (data.winsGuess || 0) + 1;
  saveData(data);

  // More points if you win with more tries left
  const bonus = triesLeft;
  awardPoints(6 + bonus, "Guess game win");
  guessHintEl.textContent = `Nice! You had ${triesLeft} tries left.`;
}

function finishGuessLose() {
  guessOver = true;
  setGuessStatus("Lost 💀");
  guessHintEl.textContent = `Out of tries. The number was ${secret}.`;
  awardPoints(0, "Guess game loss");
}

guessBtn.addEventListener("click", () => {
  if (guessOver) return;

  const val = Number(guessInput.value);
  if (!Number.isInteger(val) || val < 1 || val > 20) {
    setGuessStatus("Enter 1–20");
    return;
  }

  triesLeft -= 1;

  if (val === secret) {
    logGuessLine(`You guessed <strong>${val}</strong>. Correct ✅`);
    finishGuessWin();
    return;
  }

  const hint = val < secret ? "Too low" : "Too high";
  logGuessLine(`You guessed <strong>${val}</strong>. ${hint}…`);

  if (triesLeft <= 0) {
    finishGuessLose();
  } else {
    setGuessStatus(hint);
    guessHintEl.textContent = `Tries left: ${triesLeft}`;
  }
});

guessNewBtn.addEventListener("click", () => resetGuess(false));

// Enter key to guess
guessInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") guessBtn.click();
});

// ---------- Init ----------
buildTTTBoard();
renderTTT();
renderAllStats();
renderLeaderboard();
resetGuess(true);
