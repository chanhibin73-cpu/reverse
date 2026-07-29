/* --- グローバル設定・変数 --- */
:root {
  --bg-color: #2b3a42;
  --board-color: #0e8841;
  --board-border: #053b1b;
  --cell-border: #085327;
  --text-color: #ffffff;
  --card-bg: rgba(255, 255, 255, 0.08);
  --card-border: rgba(255, 255, 255, 0.15);
  --accent-color: #f1c40f;
  --btn-primary: #27ae60;
  --btn-online: #2980b9;
  --btn-danger: #e74c3c;
  --btn-secondary: #7f8c8d;
  --btn-ultra: #8e44ad;
  --btn-profile: #d35400;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  user-select: none;
}

body {
  background-color: var(--bg-color);
  color: var(--text-color);
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 15px;
  transition: background-color 0.4s ease;
}

/* --- 画面切り替え管理 --- */
.screen {
  display: none;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 480px;
  animation: fadeIn 0.3s ease-in-out;
}

.screen.active {
  display: flex;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

h1 {
  font-size: 2.2rem;
  margin-bottom: 15px;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  letter-spacing: 2px;
}

/* --- メニューカード & ボタン --- */
.menu-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 24px;
  width: 100%;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.btn {
  background-color: var(--btn-primary);
  color: #fff;
  border: none;
  padding: 14px 20px;
  font-size: 1rem;
  font-weight: bold;
  border-radius: 10px;
  cursor: pointer;
  transition: transform 0.1s ease, filter 0.2s ease, box-shadow 0.2s ease;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}

.btn:hover {
  filter: brightness(1.1);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.3);
}

.btn:active {
  transform: scale(0.98);
}

.btn-online { background-color: var(--btn-online); }
.btn-danger { background-color: var(--btn-danger); }
.btn-secondary { background-color: var(--btn-secondary); }
.btn-profile { background-color: var(--btn-profile); }
.btn-ultra { 
  background: linear-gradient(135deg, #8e44ad, #d35400); 
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* --- プロフィール & バッジ UI --- */
.user-badge-box {
  background: rgba(241, 196, 15, 0.15);
  border: 1px solid var(--accent-color);
  color: var(--accent-color);
  padding: 8px 20px;
  border-radius: 20px;
  font-weight: bold;
  font-size: 1.05rem;
  margin-bottom: 15px;
  cursor: pointer;
  transition: transform 0.2s ease;
  box-shadow: 0 2px 8px rgba(241, 196, 15, 0.2);
}

.user-badge-box:hover {
  transform: scale(1.03);
}

.profile-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
}

.profile-field label {
  font-size: 0.9rem;
  opacity: 0.9;
}

.input-with-btn {
  display: flex;
  gap: 8px;
}

.input-with-btn input {
  flex: 1;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--card-border);
  background: rgba(0, 0, 0, 0.3);
  color: #fff;
  font-size: 1rem;
  outline: none;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 10px;
  margin: 10px 0;
}

.stat-card {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--card-border);
  padding: 12px;
  border-radius: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-label {
  font-size: 0.95rem;
  opacity: 0.85;
}

.stat-value {
  font-size: 1.2rem;
  font-weight: bold;
  color: var(--accent-color);
}

.spectator-badge {
  background: #9b59b6;
  color: #fff;
  font-weight: bold;
  padding: 5px 14px;
  border-radius: 12px;
  margin-bottom: 10px;
  font-size: 0.9rem;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { opacity: 0.8; }
  50% { opacity: 1; }
  100% { opacity: 0.8; }
}

/* --- オンライン対戦 プレイヤー表示ヘッダー --- */
.match-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  max-width: 420px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid var(--card-border);
  padding: 8px 14px;
  border-radius: 12px;
  margin-bottom: 8px;
}

.player-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
  font-weight: bold;
}

.disc-icon {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  display: inline-block;
}

.disc-icon.black { background: #000; border: 1px solid #666; }
.disc-icon.white { background: #fff; border: 1px solid #ccc; }

.rating-tag {
  font-size: 0.75rem;
  color: var(--accent-color);
  background: rgba(241, 196, 15, 0.15);
  padding: 2px 6px;
  border-radius: 6px;
}

.vs-divider {
  font-size: 0.8rem;
  font-weight: 900;
  opacity: 0.5;
}

/* --- 入力フォーム --- */
.room-input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
}

.room-input-group label {
  font-size: 0.85rem;
  opacity: 0.9;
}

.room-input-group input {
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--card-border);
  background: rgba(0, 0, 0, 0.25);
  color: #fff;
  font-size: 1.1rem;
  text-align: center;
  letter-spacing: 3px;
  outline: none;
}

.room-input-group input:focus {
  border-color: var(--btn-online);
}

.online-status-text {
  font-size: 0.9rem;
  color: var(--accent-color);
  min-height: 24px;
  margin-top: 5px;
  text-align: center;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
  margin-bottom: 10px;
}

.setting-group select, .setting-group input[type="range"] {
  padding: 8px;
  border-radius: 6px;
  border: 1px solid var(--card-border);
  background: rgba(0, 0, 0, 0.3);
  color: #fff;
  outline: none;
}

/* --- ゲーム画面 UI --- */
.status-panel {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  max-width: 420px;
  background: rgba(0, 0, 0, 0.3);
  padding: 10px 18px;
  border-radius: 12px;
  margin-bottom: 12px;
  font-weight: bold;
  font-size: 1.1rem;
}

.turn-indicator {
  color: var(--accent-color);
  font-size: 1rem;
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}

/* 盤面領域 */
.board-container {
  position: relative;
  width: min(88vw, 420px);
  height: min(88vw, 420px);
  margin: 0 auto;
}

.board {
  width: 100%;
  height: 100%;
  background-color: var(--board-color);
  border: 8px solid var(--board-border);
  border-radius: 10px;
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  grid-template-rows: repeat(8, 1fr);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

.cell {
  border: 1px solid var(--cell-border);
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
}

.cell.placeable {
  cursor: pointer;
}

.cell.placeable::after {
  content: '';
  width: 25%;
  height: 25%;
  background-color: rgba(255, 255, 255, 0.35);
  border-radius: 50%;
  transition: transform 0.2s ease, background-color 0.2s ease;
}

.cell.placeable:hover::after {
  transform: scale(1.4);
  background-color: rgba(255, 255, 255, 0.6);
}

/* オセロ石 */
.disc {
  width: 84%;
  height: 84%;
  border-radius: 50%;
  transition: transform 0.3s ease;
}

.disc.black {
  background: radial-gradient(circle at 35% 35%, #444, #000 80%);
  box-shadow: 2px 3px 6px rgba(0, 0, 0, 0.6);
}

.disc.white {
  background: radial-gradient(circle at 35% 35%, #ffffff, #dcdcdc 80%);
  box-shadow: 2px 3px 6px rgba(0, 0, 0, 0.4);
}

/* 通信・思考オーバーレイ */
.sync-overlay, .thinking-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 1.2rem;
  font-weight: bold;
  border-radius: 6px;
  z-index: 10;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  backdrop-filter: blur(2px);
}

.sync-overlay.active {
  opacity: 1;
  pointer-events: auto;
}

.thinking-overlay {
  background: rgba(0, 0, 0, 0.4);
  font-size: 1.1rem;
  color: var(--accent-color);
}

/* メッセージバナー */
.message-banner {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%) scale(0.8);
  background: rgba(0, 0, 0, 0.88);
  color: var(--accent-color);
  padding: 12px 24px;
  border-radius: 30px;
  font-size: 1.1rem;
  font-weight: bold;
  border: 2px solid var(--accent-color);
  opacity: 0;
  pointer-events: none;
  transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.25s ease;
  z-index: 20;
  text-align: center;
  white-space: nowrap;
  box-shadow: 0 8px 20px rgba(0,0,0,0.5);
}

.message-banner.show {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}

/* --- AI形勢分析パネル --- */
.analysis-panel {
  width: 100%;
  max-width: 420px;
  margin-top: 14px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--card-border);
  padding: 10px 14px;
  border-radius: 10px;
  text-align: center;
}

.analysis-title {
  font-size: 0.85rem;
  font-weight: bold;
  margin-bottom: 6px;
  opacity: 0.9;
}

.bar-container {
  width: 100%;
  height: 14px;
  background-color: #ffffff;
  border-radius: 7px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.4);
}

.bar-black {
  height: 100%;
  background-color: #1a1a1a;
  transition: width 0.4s ease-out;
}

.analysis-text {
  margin-top: 5px;
  font-size: 0.85rem;
  font-weight: bold;
  color: #ddd;
}

/* 下部操作ボタン群 */
.nav-btns {
  display: flex;
  gap: 10px;
  margin-top: 15px;
  width: 100%;
  max-width: 420px;
  justify-content: center;
}

.nav-btns .btn {
  flex: 1;
  padding: 10px 12px;
  font-size: 0.9rem;
}
