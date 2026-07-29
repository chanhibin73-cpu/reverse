const BOARD_SIZE = 8;
const EMPTY = 0, BLACK = 1, WHITE = -1;
const SPECTATOR = 0; // 観戦者フラグ

let board = [];
let currentPlayer = BLACK;
let gameMode = 'pvp';
let aiLevel = 1;
let isProcessing = false;

// オンライン通信用変数
let peer = null;
let conn = null;
let spectatorConns = [];
let myRole = BLACK; // BLACK, WHITE, SPECTATOR
let isAwaitingAck = false;
let isRandomMatching = false;
let opponentRating = 100;
let opponentName = "対戦相手";

const ROOM_PREFIX = "othello-app-room-v2-";
const LOBBY_PEER_ID = "othello-app-random-lobby-v2";

const WEIGHTS = [
  [ 120, -30,  20,   5,   5,  20, -30, 120],
  [-30,  -50,  -5,  -5,  -5,  -5, -50, -30],
  [  20,  -5,  15,   3,   3,  15,  -5,  20],
  [   5,  -5,   3,   3,   3,   3,  -5,   5],
  [   5,  -5,   3,   3,   3,   3,  -5,   5],
  [  20,  -5,  15,   3,   3,  15,  -5,  20],
  [-30,  -50,  -5,  -5,  -5,  -5, -50, -30],
  [ 120, -30,  20,   5,   5,  20, -30, 120]
];

const directions = [
  [-1,-1], [-1,0], [-1,1],
  [ 0,-1],         [ 0,1],
  [ 1,-1], [ 1,0], [ 1,1]
];

// --- レーティング＆ランキングシステム（初期値: 100 / 架空人物なし） ---

function getPlayerName() {
  return localStorage.getItem('othello_player_name') || "あなた";
}

function savePlayerName() {
  const name = document.getElementById('player-name-input').value.trim();
  if (name) {
    localStorage.setItem('othello_player_name', name);
    updatePlayerRatingRecord(name, getUserRating());
    alert("プレイヤー名を変更しました: " + name);
    renderRankingList();
  }
}

function getUserRating() {
  const saved = localStorage.getItem('othello_user_rating');
  return saved ? parseInt(saved, 10) : 100; // 初期レーティング 100
}

function setUserRating(newRating) {
  localStorage.setItem('othello_user_rating', newRating);
  updatePlayerRatingRecord(getPlayerName(), newRating);
  updateRatingUI();
}

function getRankingRecords() {
  const saved = localStorage.getItem('othello_rankings_data');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      return [];
    }
  }
  // 架空人物は作らず、自身の初期データのみ登録
  return [{ name: getPlayerName(), rating: getUserRating() }];
}

function updatePlayerRatingRecord(name, rating) {
  let records = getRankingRecords();
  const existing = records.find(r => r.name === name);
  if (existing) {
    existing.rating = rating;
  } else {
    records.push({ name, rating });
  }
  localStorage.setItem('othello_rankings_data', JSON.stringify(records));
}

function renderRankingList() {
  const listElem = document.getElementById('ranking-list');
  if (!listElem) return;

  const records = getRankingRecords();
  // レーティング順にソート
  records.sort((a, b) => b.rating - a.rating);

  listElem.innerHTML = '';
  if (records.length === 0) {
    listElem.innerHTML = '<div style="opacity: 0.6; padding: 10px;">記録された対戦データがありません</div>';
    return;
  }

  const myName = getPlayerName();
  records.forEach((player, index) => {
    const item = document.createElement('div');
    const isSelf = (player.name === myName);
    item.className = `ranking-item ${isSelf ? 'self' : ''}`;

    let rankClass = '';
    if (index === 0) rankClass = 'rank-1';
    else if (index === 1) rankClass = 'rank-2';
    else if (index === 2) rankClass = 'rank-3';

    item.innerHTML = `
      <div class="player-info">
        <div class="rank-badge ${rankClass}">${index + 1}</div>
        <span>${player.name} ${isSelf ? '(あなた)' : ''}</span>
      </div>
      <div class="player-rating">${player.rating} R</div>
    `;
    listElem.appendChild(item);
  });
}

function updateRatingUI() {
  const elem = document.getElementById('user-rating-val');
  if (elem) elem.innerText = getUserRating();
}

// 将棋風イロレーティング計算 (K=32)
function calculateRatingChange(myRating, oppRating, result) {
  const expected = 1 / (1 + Math.pow(10, (oppRating - myRating) / 400));
  const K = 32;
  return Math.round(K * (result - expected));
}

// --- 音響システム ---
const N = {
  E4: 329.63, Fs4: 369.99, Gs4: 415.30, A4: 440.00, B4: 493.88,
  Cs5: 554.37, Ds5: 622.25, E5: 659.25, Fs5: 739.99, Gs5: 830.61, _ : 0
};

let audioCtx = null;
let bgmGainNode = null, seGainNode = null;
let bgmTimer = null, currentBgmType = 'pop', bgmStep = 0;

const BGM_DATA = {
  'pop': { type: 'sine', tempo: 250, notes: [261.63, 329.63, 392.00, 523.25, 392.00, 329.63, 293.66, 349.23, 392.00, 587.33, 392.00, 349.23] },
  'ambient': { type: 'triangle', tempo: 400, notes: [220.00, 261.63, 329.63, 440.00, 329.63, 261.63, 196.00, 246.94, 293.66, 392.00, 293.66, 246.94] },
  '8bit': { type: 'square', tempo: 150, notes: [N.E5, N._, N.E5, N.Fs5, N.Gs5, N.Fs5, N.E5, N.Ds5, N.Cs5, N._, N.B4] }
};

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    bgmGainNode = audioCtx.createGain();
    seGainNode = audioCtx.createGain();
    bgmGainNode.connect(audioCtx.destination);
    seGainNode.connect(audioCtx.destination);
    updateVolume();
    startBGM();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function updateVolume() {
  const bgmVol = document.getElementById('bgm-volume').value;
  const seVol = document.getElementById('se-volume').value;
  document.getElementById('bgm-val').innerText = bgmVol;
  document.getElementById('se-val').innerText = seVol;

  if (bgmGainNode) bgmGainNode.gain.value = (bgmVol / 100) * 0.15;
  if (seGainNode) seGainNode.gain.value = (seVol / 100) * 0.3;
}

function changeBGMType(type) { currentBgmType = type; bgmStep = 0; startBGM(); }

function playSE(type) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain); gain.connect(seGainNode);
  const now = audioCtx.currentTime;

  if (type === 'place') {
    osc.type = 'triangle'; osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
    gain.gain.setValueAtTime(1, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    osc.start(now); osc.stop(now + 0.08);
  } else if (type === 'pass') {
    osc.type = 'sine'; osc.frequency.setValueAtTime(440, now); osc.frequency.setValueAtTime(330, now + 0.1);
    gain.gain.setValueAtTime(0.5, now); gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
    osc.start(now); osc.stop(now + 0.25);
  } else if (type === 'win') {
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
      const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
      o.connect(g); o.connect(seGainNode); o.frequency.value = freq;
      g.gain.setValueAtTime(0.3, now + i * 0.12); g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.3);
      o.start(now + i * 0.12); o.stop(now + i * 0.12 + 0.3);
    });
  }
}

function startBGM() {
  if (bgmTimer) clearInterval(bgmTimer);
  const bgm = BGM_DATA[currentBgmType];
  bgmTimer = setInterval(() => {
    if (!audioCtx || bgmGainNode.gain.value === 0) return;
    const freq = bgm.notes[bgmStep % bgm.notes.length];
    if (freq > 0) {
      const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
      osc.type = bgm.type; osc.frequency.value = freq;
      const now = audioCtx.currentTime; const noteLen = (bgm.tempo / 1000) * 0.85;
      gain.gain.setValueAtTime(0.12, now); gain.gain.exponentialRampToValueAtTime(0.001, now + noteLen);
      osc.connect(gain); gain.connect(bgmGainNode);
      osc.start(now); osc.stop(now + noteLen);
    }
    bgmStep++;
  }, bgm.tempo);
}

function showBanner(text, duration = 2000) {
  const banner = document.getElementById('message-banner');
  banner.innerText = text;
  banner.classList.add('show');
  setTimeout(() => banner.classList.remove('show'), duration);
}

function showScreen(screenId) {
  initAudio();
  updateRatingUI();
  if (screenId === 'ranking-screen') {
    document.getElementById('player-name-input').value = getPlayerName();
    renderRankingList();
  }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

function showDifficultySelect() { showScreen('difficulty-screen'); }
function changeBgColor(color) { document.documentElement.style.setProperty('--bg-color', color); }

function startGame(mode, level = 1) {
  gameMode = mode;
  aiLevel = level;

  document.getElementById('reset-btn').style.display = (mode === 'online') ? 'none' : 'inline-block';
  document.getElementById('leave-online-btn').style.display = (mode === 'online') ? 'inline-block' : 'none';
  document.getElementById('menu-btn').style.display = (mode === 'online') ? 'none' : 'inline-block';
  document.getElementById('spectator-badge').style.display = (myRole === SPECTATOR && mode === 'online') ? 'block' : 'none';

  showScreen('game-screen');
  initGame();
}

function initGame() {
  board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(EMPTY));
  board[3][3] = WHITE; board[3][4] = BLACK;
  board[4][3] = BLACK; board[4][4] = WHITE;
  
  currentPlayer = BLACK;
  isProcessing = false;
  isAwaitingAck = false;

  setSyncOverlay(false);
  document.getElementById('thinking-badge').style.display = 'none';
  renderBoard();
  updateStatus();
}

// --- オンライン通信＆観戦・ランダム対戦処理 (PeerJS) ---

function getRoomNumber() {
  const num = document.getElementById('room-number').value;
  if (!num || num.length !== 4 || isNaN(num)) {
    alert("4桁の数字を入力してください（例: 1234）");
    return null;
  }
  return num;
}

function setOnlineStatus(msg) {
  document.getElementById('online-status').innerText = msg;
}

function startRandomMatch() {
  setOnlineStatus("対戦相手を探しています...");
  document.getElementById('cancel-online-btn').style.display = 'inline-block';
  isRandomMatching = true;

  if (peer) peer.destroy();
  
  peer = new Peer();
  peer.on('open', () => {
    const lobbyConn = peer.connect(LOBBY_PEER_ID);
    
    let connectedToLobby = false;
    lobbyConn.on('open', () => {
      connectedToLobby = true;
      myRole = WHITE;
      conn = lobbyConn;
      setupConnection();
      conn.send({ type: 'JOIN_RANDOM', rating: getUserRating(), name: getPlayerName() });
    });

    setTimeout(() => {
      if (!connectedToLobby) {
        lobbyConn.close();
        if (peer) peer.destroy();
        
        peer = new Peer(LOBBY_PEER_ID);
        peer.on('open', () => {
          myRole = BLACK;
          setOnlineStatus("対戦相手の参戦を待っています...");
        });

        peer.on('connection', (c) => {
          if (conn) {
            c.send({ type: 'REJECT_FULL' });
            setTimeout(() => c.close(), 500);
            return;
          }
          conn = c;
          setupConnection();
        });

        peer.on('error', (err) => {
          if (err.type === 'unavailable-id') {
            startRandomMatch();
          }
        });
      }
    }, 1500);
  });
}

function createRoom() {
  const num = getRoomNumber();
  if (!num) return;
  setOnlineStatus("部屋を作成中...");
  document.getElementById('cancel-online-btn').style.display = 'inline-block';

  if (peer) peer.destroy();
  spectatorConns = [];
  peer = new Peer(ROOM_PREFIX + num);

  peer.on('open', () => {
    myRole = BLACK;
    setOnlineStatus(`部屋 ${num} を作成しました。対戦相手を待っています...`);
  });

  peer.on('connection', (c) => {
    c.on('data', (data) => {
      if (data.type === 'JOIN_REQUEST') {
        if (!conn) {
          conn = c;
          opponentRating = data.rating || 100;
          opponentName = data.name || "対戦相手";
          c.send({ type: 'JOIN_ACCEPT', role: WHITE, board: board, turn: currentPlayer, rating: getUserRating(), name: getPlayerName() });
          setupConnection();
          startGame('online');
          showBanner("対戦相手が接続しました！");
        } else {
          spectatorConns.push(c);
          c.send({ type: 'JOIN_SPECTATE', board: board, turn: currentPlayer });
        }
      } else {
        handleNetworkMessage(data, c);
      }
    });
  });

  peer.on('error', (err) => {
    if (err.type === 'unavailable-id') {
      alert("その部屋はすでに存在します。観戦または参加する場合は「部屋に参加」を押してください。");
    }
    cancelOnlineWaiting();
  });
}

function joinRoom() {
  const num = getRoomNumber();
  if (!num) return;
  setOnlineStatus("部屋に接続中...");
  document.getElementById('cancel-online-btn').style.display = 'inline-block';

  if (peer) peer.destroy();
  peer = new Peer();

  peer.on('open', () => {
    const targetConn = peer.connect(ROOM_PREFIX + num);
    targetConn.on('open', () => {
      conn = targetConn;
      conn.send({ type: 'JOIN_REQUEST', rating: getUserRating(), name: getPlayerName() });
    });

    targetConn.on('data', (data) => {
      if (data.type === 'JOIN_ACCEPT') {
        myRole = WHITE;
        opponentRating = data.rating || 100;
        opponentName = data.name || "対戦相手";
        document.getElementById('cancel-online-btn').style.display = 'none';
        setupConnection();
        startGame('online');
        showBanner("部屋に対戦相手として参加しました！");
      } else if (data.type === 'JOIN_SPECTATE') {
        myRole = SPECTATOR;
        board = data.board;
        currentPlayer = data.turn;
        document.getElementById('cancel-online-btn').style.display = 'none';
        setupConnection();
        startGame('online');
        showBanner("観戦モードで参加しました！");
      } else {
        handleNetworkMessage(data, targetConn);
      }
    });

    targetConn.on('error', () => {
      alert("部屋が見つかりませんでした。");
      cancelOnlineWaiting();
    });
  });
}

function setupConnection() {
  if (!conn) return;

  conn.on('data', (data) => {
    handleNetworkMessage(data, conn);
  });

  conn.on('close', () => {
    alert("対戦相手の通信が切断されました。");
    leaveOnlineAndReturnMenu();
  });
}

function cancelOnlineWaiting() {
  if (conn) { conn.close(); conn = null; }
  if (peer) { peer.destroy(); peer = null; }
  spectatorConns = [];
  isRandomMatching = false;
  setOnlineStatus("");
  document.getElementById('cancel-online-btn').style.display = 'none';
}

function leaveOnlineAndReturnMenu() {
  cancelOnlineWaiting();
  showScreen('online-screen');
}

function broadcastToSpectators(msg) {
  spectatorConns.forEach(c => {
    if (c && c.open) c.send(msg);
  });
}

function handleNetworkMessage(data, fromConn) {
  if (data.type === 'JOIN_RANDOM') {
    opponentRating = data.rating || 100;
    opponentName = data.name || "対戦相手";
    document.getElementById('cancel-online-btn').style.display = 'none';
    startGame('online');
    showBanner("対戦相手が見つかりました！");
    fromConn.send({ type: 'START_RANDOM', rating: getUserRating(), name: getPlayerName() });
  } else if (data.type === 'START_RANDOM') {
    opponentRating = data.rating || 100;
    opponentName = data.name || "対戦相手";
    document.getElementById('cancel-online-btn').style.display = 'none';
    startGame('online');
    showBanner("対戦相手が見つかりました！");
  } else if (data.type === 'MOVE') {
    executeMove(data.r, data.c, false);
    if (fromConn) fromConn.send({ type: 'ACK', board: board });
    broadcastToSpectators({ type: 'SYNC_BOARD', board: board, turn: currentPlayer });
  } else if (data.type === 'ACK') {
    isAwaitingAck = false;
    setSyncOverlay(false);
    checkNextTurn();
    broadcastToSpectators({ type: 'SYNC_BOARD', board: board, turn: currentPlayer });
  } else if (data.type === 'SYNC_BOARD') {
    board = data.board;
    currentPlayer = data.turn;
    renderBoard();
    updateStatus();
  } else if (data.type === 'REJECT_FULL') {
    alert("このランダム対戦枠は埋まりました。再試行します。");
    startRandomMatch();
  }
}

function setSyncOverlay(show) {
  const overlay = document.getElementById('sync-overlay');
  if (show) overlay.classList.add('active');
  else overlay.classList.remove('active');
}

// --- 盤面描画＆動作処理 ---

function renderBoard() {
  const boardElement = document.getElementById('board');
  boardElement.innerHTML = '';

  const validMoves = getValidMoves(board, currentPlayer);

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = document.createElement('div');
      cell.classList.add('cell');

      if (board[r][c] !== EMPTY) {
        const disc = document.createElement('div');
        disc.classList.add('disc', board[r][c] === BLACK ? 'black' : 'white');
        cell.appendChild(disc);
      } else if (!isProcessing && !isAwaitingAck && myRole !== SPECTATOR && validMoves.some(m => m.r === r && m.c === c)) {
        if (gameMode === 'pvp' || 
           (gameMode === 'ai' && currentPlayer === BLACK) ||
           (gameMode === 'online' && currentPlayer === myRole)) {
          cell.classList.add('placeable');
          cell.addEventListener('click', () => handlePlayerMove(r, c));
        }
      }

      boardElement.appendChild(cell);
    }
  }
}

function handlePlayerMove(r, c) {
  if (isProcessing || isAwaitingAck || myRole === SPECTATOR) return;

  if (gameMode === 'online') {
    executeMove(r, c, true);
  } else {
    executeMove(r, c, false);
  }
}

function executeMove(r, c, isMyOnlineMove = false) {
  const flipped = getFlippedDiscs(board, r, c, currentPlayer);
  if (flipped.length === 0) return;

  playSE('place');
  board[r][c] = currentPlayer;
  flipped.forEach(p => board[p.r][p.c] = currentPlayer);

  currentPlayer = -currentPlayer;
  updateStatus(); 

  if (isMyOnlineMove) {
    isAwaitingAck = true;
    setSyncOverlay(true);
    renderBoard();
    if (conn) conn.send({ type: 'MOVE', r: r, c: c });
  } else {
    checkNextTurn();
  }
}

function checkNextTurn() {
  const validMoves = getValidMoves(board, currentPlayer);

  if (validMoves.length === 0) {
    const nextPlayerMoves = getValidMoves(board, -currentPlayer);
    if (nextPlayerMoves.length === 0) {
      isProcessing = false;
      document.getElementById('thinking-badge').style.display = 'none';
      renderBoard();
      updateStatus(true);
      playSE('win');
      return;
    }

    playSE('pass');
    showBanner((currentPlayer === BLACK ? '黒' : '白') + ' パス');
    
    isProcessing = true;
    currentPlayer = -currentPlayer;
    updateStatus();
    
    setTimeout(() => {
      checkNextTurn();
    }, 1200);
    return;
  }

  if (gameMode === 'ai' && currentPlayer === WHITE) {
    isProcessing = true;
    renderBoard();
    
    const badge = document.getElementById('thinking-badge');
    if (aiLevel >= 3) {
      badge.innerText = aiLevel === 5 ? '⚡ 超最強思考中...' : '🤔 思考中...';
      badge.style.display = 'block';
    }
    
    setTimeout(() => {
      makeAIMove();
    }, 50);
  } else {
    isProcessing = false;
    document.getElementById('thinking-badge').style.display = 'none';
    renderBoard();
  }
}

// --- AI形勢判断＆対戦記録（ランキング更新）機能 ---

function updateStatus(isGameOver = false) {
  let blackCount = 0, whiteCount = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === BLACK) blackCount++;
      else if (board[r][c] === WHITE) whiteCount++;
    }
  }

  document.getElementById('black-score').innerText = `黒: ${blackCount}`;
  document.getElementById('white-score').innerText = `白: ${whiteCount}`;

  const turnDisplay = document.getElementById('turn-display');
  const evalText = document.getElementById('eval-text');
  const evalBar = document.getElementById('eval-bar');
  const analysisTitle = document.getElementById('analysis-title');

  if (isGameOver) {
    analysisTitle.innerText = "📊 最終結果";
    let outcomeText = "";

    if (blackCount > whiteCount) {
      turnDisplay.innerText = '黒の勝ち！';
      evalBar.style.width = '100%';
      evalText.innerText = `黒 勝利 (+${blackCount - whiteCount})`;
      if (gameMode === 'online' && myRole !== SPECTATOR) {
        const result = (myRole === BLACK) ? 1 : 0;
        const myChange = calculateRatingChange(getUserRating(), opponentRating, result);
        const oppChange = calculateRatingChange(opponentRating, getUserRating(), 1 - result);
        
        setUserRating(getUserRating() + myChange);
        updatePlayerRatingRecord(opponentName, opponentRating + oppChange);
        
        outcomeText = ` (レーティング: ${myChange >= 0 ? '+' : ''}${myChange})`;
      }
    } else if (whiteCount > blackCount) {
      turnDisplay.innerText = '白の勝ち！';
      evalBar.style.width = '0%';
      evalText.innerText = `白 勝利 (-${whiteCount - blackCount})`;
      if (gameMode === 'online' && myRole !== SPECTATOR) {
        const result = (myRole === WHITE) ? 1 : 0;
        const myChange = calculateRatingChange(getUserRating(), opponentRating, result);
        const oppChange = calculateRatingChange(opponentRating, getUserRating(), 1 - result);

        setUserRating(getUserRating() + myChange);
        updatePlayerRatingRecord(opponentName, opponentRating + oppChange);

        outcomeText = ` (レーティング: ${myChange >= 0 ? '+' : ''}${myChange})`;
      }
    } else {
      turnDisplay.innerText = '引き分け！';
      evalBar.style.width = '50%';
      evalText.innerText = 'ゲーム終了 (引き分け)';
      if (gameMode === 'online' && myRole !== SPECTATOR) {
        const myChange = calculateRatingChange(getUserRating(), opponentRating, 0.5);
        const oppChange = calculateRatingChange(opponentRating, getUserRating(), 0.5);

        setUserRating(getUserRating() + myChange);
        updatePlayerRatingRecord(opponentName, opponentRating + oppChange);

        outcomeText = ` (レーティング: ${myChange >= 0 ? '+' : ''}${myChange})`;
      }
    }

    if (outcomeText) showBanner("対局終了" + outcomeText, 4000);
    return;
  }

  turnDisplay.innerText = currentPlayer === BLACK ? '黒の番' : '白の番';
  analysisTitle.innerText = "🤖 AI形勢判断（計算中...）";
  evalText.innerText = "読込中...";
  
  updateAIAnalysis();
}

function updateAIAnalysis() {
  setTimeout(() => {
    const emptyCells = countEmptyCells(board);
    let depth = 4;
    if (emptyCells <= 14) depth = 8;
    else if (emptyCells <= 40) depth = 5;
    
    const score = minimax(board, depth, -Infinity, Infinity, true);
    const blackScore = -score; 
    
    const evalText = document.getElementById('eval-text');
    const evalBar = document.getElementById('eval-bar');
    const analysisTitle = document.getElementById('analysis-title');
    
    analysisTitle.innerText = `🤖 AI形勢判断（${depth}手先読み）`;
    let percentage = Math.round((1 / (1 + Math.exp(-blackScore / 150))) * 100);
    evalBar.style.width = `${percentage}%`;

    if (Math.abs(blackScore) < 15) {
      evalText.innerText = `互角 (${blackScore > 0 ? '+' : ''}${blackScore})`;
    } else if (blackScore > 0) {
      evalText.innerText = `黒 優勢 (+${blackScore})`;
    } else {
      evalText.innerText = `白 優勢 (${blackScore})`;
    }
  }, 30);
}

// --- AI・ゲーム基本ロジック ---

function makeAIMove() {
  const validMoves = getValidMoves(board, WHITE);
  if (validMoves.length === 0) {
    isProcessing = false;
    checkNextTurn();
    return;
  }

  if (validMoves.length === 1) {
    document.getElementById('thinking-badge').style.display = 'none';
    executeMove(validMoves[0].r, validMoves[0].c);
    return;
  }

  let chosenMove = null;

  if (aiLevel === 1) {
    chosenMove = validMoves[Math.floor(Math.random() * validMoves.length)];
    executeMove(chosenMove.r, chosenMove.c);
  } else if (aiLevel === 2) {
    let bestScore = -Infinity;
    validMoves.forEach(m => {
      const score = WEIGHTS[m.r][m.c];
      if (score > bestScore) { bestScore = score; chosenMove = m; }
    });
    executeMove(chosenMove.r, chosenMove.c);
  } else if (aiLevel === 3) {
    let bestScore = -Infinity, alpha = -Infinity, beta = Infinity;
    validMoves.forEach(m => {
      const tempBoard = simulateMove(board, m.r, m.c, WHITE);
      const score = minimax(tempBoard, 3, alpha, beta, false);
      if (score > bestScore) { bestScore = score; chosenMove = m; }
      alpha = Math.max(alpha, bestScore);
    });
    executeMove(chosenMove.r, chosenMove.c);
  } else if (aiLevel === 4) {
    let emptyCount = countEmptyCells(board);
    if (emptyCount <= 14) chosenMove = getBestEndgameMove(validMoves);
    else chosenMove = getBestMinimaxMove(validMoves, 5);
    executeMove(chosenMove.r, chosenMove.c);
  } else if (aiLevel === 5) {
    makeUltraFastEngineMove(validMoves);
  }
}

function makeUltraFastEngineMove(validMoves) {
  const emptyCount = countEmptyCells(board);
  const startTime = Date.now();
  const MAX_TIME = emptyCount > 20 ? 10000 : 25000;

  validMoves.sort((a, b) => WEIGHTS[b.r][b.c] - WEIGHTS[a.r][a.c]);

  let bestMove = validMoves[0];
  let bestScore = -Infinity, alpha = -Infinity, beta = Infinity;
  const depth = emptyCount <= 16 ? 99 : (emptyCount <= 28 ? 9 : 7);

  for (let i = 0; i < validMoves.length; i++) {
    if (Date.now() - startTime >= MAX_TIME) break;
    const m = validMoves[i];
    const tempBoard = simulateMove(board, m.r, m.c, WHITE);
    let score = 0;

    if (depth === 99) {
      score = -solveEndgameWithTimeLimit(tempBoard, BLACK, -beta, -alpha, startTime, MAX_TIME);
    } else {
      score = minimaxWithTimeLimit(tempBoard, depth - 1, alpha, beta, false, startTime, MAX_TIME);
    }

    if (score > bestScore) { bestScore = score; bestMove = m; }
    alpha = Math.max(alpha, bestScore);
  }

  document.getElementById('thinking-badge').style.display = 'none';
  executeMove(bestMove.r, bestMove.c);
}

function countEmptyCells(b) {
  let count = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (b[r][c] === EMPTY) count++;
    }
  }
  return count;
}

function getBestMinimaxMove(moves, depth) {
  let bestMove = moves[0], bestScore = -Infinity, alpha = -Infinity, beta = Infinity;
  for (const m of moves) {
    const tempBoard = simulateMove(board, m.r, m.c, WHITE);
    const score = minimax(tempBoard, depth, alpha, beta, false);
    if (score > bestScore) { bestScore = score; bestMove = m; }
    alpha = Math.max(alpha, bestScore);
  }
  return bestMove;
}

function getBestEndgameMove(moves) {
  let bestMove = moves[0], bestScore = -Infinity, alpha = -Infinity, beta = Infinity;
  for (const m of moves) {
    const tempBoard = simulateMove(board, m.r, m.c, WHITE);
    const outcome = -solveEndgame(tempBoard, BLACK, alpha, beta);
    if (outcome > bestScore) { bestScore = outcome; bestMove = m; }
    alpha = Math.max(alpha, bestScore);
  }
  return bestMove;
}

function minimaxWithTimeLimit(currentBoard, depth, alpha, beta, isMaximizing, startTime, maxTime) {
  if (Date.now() - startTime >= maxTime || depth === 0) return evaluateStaticBoard(currentBoard);

  const player = isMaximizing ? WHITE : BLACK;
  const validMoves = getValidMoves(currentBoard, player);

  if (validMoves.length === 0) {
    const opponentMoves = getValidMoves(currentBoard, -player);
    if (opponentMoves.length === 0) return evaluateStaticBoard(currentBoard) * 10;
    return minimaxWithTimeLimit(currentBoard, depth - 1, alpha, beta, !isMaximizing, startTime, maxTime);
  }

  validMoves.sort((a, b) => WEIGHTS[b.r][b.c] - WEIGHTS[a.r][a.c]);

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const m of validMoves) {
      if (Date.now() - startTime >= maxTime) break;
      const nextBoard = simulateMove(currentBoard, m.r, m.c, WHITE);
      const evalVal = minimaxWithTimeLimit(nextBoard, depth - 1, alpha, beta, false, startTime, maxTime);
      maxEval = Math.max(maxEval, evalVal);
      alpha = Math.max(alpha, maxEval);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const m of validMoves) {
      if (Date.now() - startTime >= maxTime) break;
      const nextBoard = simulateMove(currentBoard, m.r, m.c, BLACK);
      const evalVal = minimaxWithTimeLimit(nextBoard, depth - 1, alpha, beta, true, startTime, maxTime);
      minEval = Math.min(minEval, evalVal);
      beta = Math.min(beta, minEval);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

function solveEndgameWithTimeLimit(currentBoard, player, alpha = -Infinity, beta = Infinity, startTime, maxTime) {
  if (Date.now() - startTime >= maxTime) return evaluateStaticBoard(currentBoard);

  const validMoves = getValidMoves(currentBoard, player);

  if (validMoves.length === 0) {
    const opponentMoves = getValidMoves(currentBoard, -player);
    if (opponentMoves.length === 0) {
      let blackCount = 0, whiteCount = 0;
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (currentBoard[r][c] === BLACK) blackCount++;
          else if (currentBoard[r][c] === WHITE) whiteCount++;
        }
      }
      return blackCount - whiteCount;
    }
    return solveEndgameWithTimeLimit(currentBoard, -player, alpha, beta, startTime, maxTime);
  }

  if (player === BLACK) {
    let maxEval = -Infinity;
    for (const m of validMoves) {
      if (Date.now() - startTime >= maxTime) break;
      const nextBoard = simulateMove(currentBoard, m.r, m.c, BLACK);
      const evalVal = solveEndgameWithTimeLimit(nextBoard, WHITE, alpha, beta, startTime, maxTime);
      maxEval = Math.max(maxEval, evalVal);
      alpha = Math.max(alpha, maxEval);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const m of validMoves) {
      if (Date.now() - startTime >= maxTime) break;
      const nextBoard = simulateMove(currentBoard, m.r, m.c, WHITE);
      const evalVal = solveEndgameWithTimeLimit(nextBoard, BLACK, alpha, beta, startTime, maxTime);
      minEval = Math.min(minEval, evalVal);
      beta = Math.min(beta, minEval);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

function simulateMove(currentBoard, r, c, player) {
  const newBoard = currentBoard.map(row => [...row]);
  const flipped = getFlippedDiscs(newBoard, r, c, player);
  newBoard[r][c] = player;
  flipped.forEach(p => newBoard[p.r][p.c] = player);
  return newBoard;
}

function minimax(currentBoard, depth, alpha, beta, isMaximizing) {
  if (depth === 0) return evaluateStaticBoard(currentBoard);

  const player = isMaximizing ? WHITE : BLACK;
  const validMoves = getValidMoves(currentBoard, player);

  if (validMoves.length === 0) {
    const opponentMoves = getValidMoves(currentBoard, -player);
    if (opponentMoves.length === 0) return evaluateStaticBoard(currentBoard) * 10;
    return minimax(currentBoard, depth - 1, alpha, beta, !isMaximizing);
  }

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const m of validMoves) {
      const nextBoard = simulateMove(currentBoard, m.r, m.c, WHITE);
      const evalVal = minimax(nextBoard, depth - 1, alpha, beta, false);
      maxEval = Math.max(maxEval, evalVal);
      alpha = Math.max(alpha, maxEval);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const m of validMoves) {
      const nextBoard = simulateMove(currentBoard, m.r, m.c, BLACK);
      const evalVal = minimax(nextBoard, depth - 1, alpha, beta, true);
      minEval = Math.min(minEval, evalVal);
      beta = Math.min(beta, minEval);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

function evaluateStaticBoard(b) {
  let score = 0, totalDiscs = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (b[r][c] !== EMPTY) {
        totalDiscs++;
        const val = WEIGHTS[r][c];
        score += (b[r][c] === WHITE ? val : -val);
      }
    }
  }

  const whiteMoves = getValidMoves(b, WHITE).length;
  const blackMoves = getValidMoves(b, BLACK).length;
  score += (whiteMoves - blackMoves) * 15;

  if (totalDiscs > 52) {
    let whiteCount = 0, blackCount = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (b[r][c] === WHITE) whiteCount++;
        if (b[r][c] === BLACK) blackCount++;
      }
    }
    score += (whiteCount - blackCount) * 25;
  }

  return score;
}

function solveEndgame(currentBoard, player, alpha = -Infinity, beta = Infinity) {
  const validMoves = getValidMoves(currentBoard, player);

  if (validMoves.length === 0) {
    const opponentMoves = getValidMoves(currentBoard, -player);
    if (opponentMoves.length === 0) {
      let blackCount = 0, whiteCount = 0;
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (currentBoard[r][c] === BLACK) blackCount++;
          else if (currentBoard[r][c] === WHITE) whiteCount++;
        }
      }
      return blackCount - whiteCount;
    }
    return solveEndgame(currentBoard, -player, alpha, beta);
  }

  if (player === BLACK) {
    let maxEval = -Infinity;
    for (const m of validMoves) {
      const nextBoard = simulateMove(currentBoard, m.r, m.c, BLACK);
      const evalVal = solveEndgame(nextBoard, WHITE, alpha, beta);
      maxEval = Math.max(maxEval, evalVal);
      alpha = Math.max(alpha, maxEval);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const m of validMoves) {
      const nextBoard = simulateMove(currentBoard, m.r, m.c, WHITE);
      const evalVal = solveEndgame(nextBoard, BLACK, alpha, beta);
      minEval = Math.min(minEval, evalVal);
      beta = Math.min(beta, minEval);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

function getValidMoves(currentBoard, player) {
  const moves = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (currentBoard[r][c] === EMPTY && getFlippedDiscs(currentBoard, r, c, player).length > 0) {
        moves.push({ r, c });
      }
    }
  }
  return moves;
}

function getFlippedDiscs(currentBoard, r, c, player) {
  const flipped = [];
  directions.forEach(([dr, dc]) => {
    let nr = r + dr, nc = c + dc;
    const temp = [];
    while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && currentBoard[nr][nc] === -player) {
      temp.push({ r: nr, c: nc });
      nr += dr; nc += dc;
    }
    if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && currentBoard[nr][nc] === player) {
      flipped.push(...temp);
    }
  });
  return flipped;
}

function resetGame() {
  initGame();
}

// 初回ロード時表示更新
window.onload = () => {
  updateRatingUI();
};
