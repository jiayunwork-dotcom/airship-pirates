import { createContext, useContext, createSignal, createEffect, onCleanup } from 'solid-js';
import type {
  Player, GameState, Room, Order, BattleAction,
} from '../types/game';

export interface GameStoreState {
  currentPlayer: Player | null;
  gameState: GameState | null;
  rooms: Room[];
  currentRoom: Room | null;
  websocket: WebSocket | null;
  isConnected: boolean;
  selectedAirshipId: string | null;
  selectedCityId: string | null;
  activeBattleId: string | null;
  notifications: string[];
  error: string | null;
}

export interface GameStoreActions {
  createRoom: (playerName: string, maxPlayers: number) => Promise<void>;
  joinRoom: (roomId: string, playerName: string) => Promise<void>;
  leaveRoom: () => void;
  submitOrders: (orders: Order[]) => Promise<void>;
  submitBattleAction: (action: BattleAction) => Promise<void>;
  connectWebSocket: (playerId?: string) => Promise<void>;
  disconnectWebSocket: () => void;
  setSelectedAirship: (id: string | null) => void;
  setSelectedCity: (id: string | null) => void;
  setActiveBattle: (id: string | null) => void;
  addNotification: (msg: string) => void;
  clearError: () => void;
  startGame: () => Promise<void>;
  fetchRooms: () => Promise<void>;
  setPlayerReady: (ready: boolean) => Promise<void>;
  processTurn: () => Promise<void>;
}

export type GameStore = GameStoreState & GameStoreActions;

const GameContext = createContext<GameStore>();

const API_BASE_URL = 'http://localhost:8000/api';
const WS_BASE_URL = 'ws://localhost:8000/api/ws';

const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];

let generatedPlayerId = '';
function getPlayerId(): string {
  if (!generatedPlayerId) {
    generatedPlayerId = 'p_' + Math.random().toString(36).substring(2, 10);
  }
  return generatedPlayerId;
}

function stateToRoom(state: GameState): Room {
  const players = state.players.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    ready: p.ready,
  }));
  return {
    id: state.room_id,
    name: `房间 ${state.room_id}`,
    maxPlayers: 6,
    currentPlayers: state.players.length,
    players,
    started: state.phase !== 'lobby',
    hostId: players[0]?.id || '',
    turn: state.turn,
  };
}

function createGameStore(): GameStore {
  const [currentPlayer, setCurrentPlayer] = createSignal<Player | null>(null);
  const [gameState, setGameState] = createSignal<GameState | null>(null);
  const [rooms, setRooms] = createSignal<Room[]>([]);
  const [currentRoom, setCurrentRoom] = createSignal<Room | null>(null);
  const [websocket, setWebsocket] = createSignal<WebSocket | null>(null);
  const [isConnected, setIsConnected] = createSignal(false);
  const [selectedAirshipId, setSelectedAirshipId] = createSignal<string | null>(null);
  const [selectedCityId, setSelectedCityId] = createSignal<string | null>(null);
  const [activeBattleId, setActiveBattleId] = createSignal<string | null>(null);
  const [notifications, setNotifications] = createSignal<string[]>([]);
  const [error, setError] = createSignal<string | null>(null);

  const addNotification = (msg: string) => {
    setNotifications((prev) => [...prev, msg]);
    setTimeout(() => {
      setNotifications((prev) => prev.slice(1));
    }, 5000);
  };

  const clearError = () => setError(null);

  const updateFromState = (state: GameState) => {
    setGameState(state);
    setCurrentRoom(stateToRoom(state));
    const pid = getPlayerId();
    const player = state.players.find((p) => p.id === pid);
    if (player) {
      setCurrentPlayer(player);
    }
    if (state.battles.length > 0) {
      const playerShipIds = state.airships
        .filter((a) => a.player_id === pid)
        .map((a) => a.id);
      const activeBattle = state.battles.find(
        (b) =>
          (playerShipIds.includes(b.ship_a_id) || playerShipIds.includes(b.ship_b_id)) &&
          b.phase !== 'ended'
      );
      if (activeBattle) {
        setActiveBattleId(activeBattle.id);
      }
    }
  };

  const handleWSMessage = (event: MessageEvent) => {
    try {
      const msg: any = JSON.parse(event.data);
      const type = msg.type || '';

      if (type === 'initial_state' || type === 'state_update') {
        const state: GameState = msg.data as GameState;
        updateFromState(state);
      } else if (type === 'event') {
        addNotification(`事件: ${msg.event_type || ''}`);
      } else if (type === 'turn_start') {
        addNotification(`第 ${msg.data?.turn || ''} 回合开始`);
      } else if (type === 'battle_started') {
        addNotification('战斗开始！');
      } else if (type === 'game_started') {
        addNotification('游戏开始！');
      } else if (type === 'game_ended') {
        addNotification('游戏结束！');
      } else if (type === 'chat') {
        addNotification(`${msg.player_name}: ${msg.message}`);
      } else if (type === 'notification') {
        addNotification(msg.message || '');
      } else if (type === 'error') {
        setError(msg.message || '发生错误');
      } else if (type === 'pong') {
        // heartbeat response
      }
    } catch (e) {
      console.error('解析WebSocket消息失败:', e);
    }
  };

  const connectWebSocket = async (roomId?: string, playerId?: string): Promise<void> => {
    const pid = playerId || getPlayerId();
    const rid = roomId || (currentRoom()?.id as string);
    if (!rid) {
      throw new Error('房间ID不存在');
    }
    const url = `${WS_BASE_URL}/${rid}/${pid}`;
    const ws = new WebSocket(url);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('连接超时')), 10000);

      ws.onopen = () => {
        clearTimeout(timeout);
        setIsConnected(true);
        setWebsocket(ws);
        addNotification('已连接服务器');
        ws.send(JSON.stringify({ type: 'request_state' }));
        resolve();
      };

      ws.onclose = () => {
        clearTimeout(timeout);
        setIsConnected(false);
        setWebsocket(null);
        addNotification('已断开连接');
      };

      ws.onerror = (ev) => {
        clearTimeout(timeout);
        setError('WebSocket连接错误');
        reject(ev);
      };

      ws.onmessage = handleWSMessage;

      // heartbeat
      const heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        }
      }, 30000);

      const origOnClose = ws.onclose;
      ws.onclose = (ev) => {
        clearInterval(heartbeat);
        if (origOnClose) origOnClose.call(ws, ev);
      };
    });
  };

  const disconnectWebSocket = () => {
    const ws = websocket();
    if (ws) {
      ws.close();
      setWebsocket(null);
      setIsConnected(false);
    }
  };

  const sendWS = (type: string, data: any) => {
    const ws = websocket();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, data }));
    } else {
      setError('未连接到服务器');
    }
  };

  const createRoom = async (playerName: string, maxPlayers: number) => {
    const roomId = 'ROOM' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const pid = getPlayerId();
    const colorIdx = 0;
    try {
      const res = await fetch(`${API_BASE_URL}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId, player_count: Math.max(4, Math.min(6, maxPlayers)) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || '创建房间失败');
      }
      await res.json();

      const joinRes = await fetch(`${API_BASE_URL}/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: pid,
          player_name: playerName,
          color: PLAYER_COLORS[colorIdx],
        }),
      });
      if (!joinRes.ok) {
        const err = await joinRes.json().catch(() => ({}));
        throw new Error(err.detail || '加入房间失败');
      }
      const joinedState: GameState = await joinRes.json();

      await connectWebSocket(roomId, pid);

      updateFromState(joinedState);
    } catch (e: any) {
      setGameState(null);
      setCurrentRoom(null);
      setCurrentPlayer(null);
      setError(e.message || '创建房间失败');
      throw e;
    }
  };

  const joinRoom = async (roomId: string, playerName: string) => {
    const pid = getPlayerId();
    try {
      const existingPlayer = gameState()?.players.findIndex((p) => p.id === pid) ?? -1;
      const colorIdx = Math.max(0, (gameState()?.players.length || 0) % PLAYER_COLORS.length);

      const joinRes = await fetch(`${API_BASE_URL}/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: pid,
          player_name: playerName,
          color: existingPlayer >= 0 ? undefined : PLAYER_COLORS[colorIdx],
        }),
      });
      if (!joinRes.ok) {
        const err = await joinRes.json().catch(() => ({}));
        throw new Error(err.detail || '加入房间失败');
      }
      const joinedState: GameState = await joinRes.json();

      await connectWebSocket(roomId, pid);

      updateFromState(joinedState);
    } catch (e: any) {
      setGameState(null);
      setCurrentRoom(null);
      setCurrentPlayer(null);
      setError(e.message || '加入房间失败');
      throw e;
    }
  };

  const leaveRoom = () => {
    sendWS('leave_room', { roomId: currentRoom()?.id });
    disconnectWebSocket();
    setCurrentRoom(null);
    setGameState(null);
    setCurrentPlayer(null);
    setSelectedAirshipId(null);
    setSelectedCityId(null);
  };

  const submitOrders = async (orders: Order[]) => {
    try {
      const rid = currentRoom()?.id as string;
      const pid = getPlayerId();
      const res = await fetch(`${API_BASE_URL}/rooms/${rid}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: pid, orders }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || '提交指令失败');
      }
      const state: GameState = await res.json();
      updateFromState(state);
      addNotification('指令已提交');
    } catch (e: any) {
      setError(e.message || '提交指令失败');
      throw e;
    }
  };

  const submitBattleAction = async (action: BattleAction) => {
    try {
      const rid = currentRoom()?.id as string;
      const pid = getPlayerId();
      const battleId = activeBattleId() as string;
      if (!battleId) return;

      const res = await fetch(`${API_BASE_URL}/rooms/${rid}/battle_actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: pid,
          battle_id: battleId,
          actions: [action],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || '提交行动失败');
      }
      const state: GameState = await res.json();
      updateFromState(state);
    } catch (e: any) {
      setError(e.message || '提交行动失败');
      throw e;
    }
  };

  const setSelectedAirship = (id: string | null) => {
    setSelectedAirshipId(id);
    if (id) setSelectedCityId(null);
  };

  const setSelectedCity = (id: string | null) => {
    setSelectedCityId(id);
    if (id) setSelectedAirshipId(null);
  };

  const setActiveBattle = (id: string | null) => {
    setActiveBattleId(id);
  };

  const setPlayerReady = async (ready: boolean) => {
    try {
      const rid = currentRoom()?.id as string;
      const pid = getPlayerId();
      const res = await fetch(`${API_BASE_URL}/rooms/${rid}/ready?player_id=${encodeURIComponent(pid)}&ready=${ready}`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || '设置失败');
      }
      const state: GameState = await res.json();
      updateFromState(state);
    } catch (e: any) {
      setError(e.message || '设置失败');
      throw e;
    }
  };

  const startGame = async () => {
    try {
      await setPlayerReady(true);
      addNotification('准备完成，等待其他玩家...');
    } catch (e: any) {
      setError(e.message || '开始游戏失败');
      throw e;
    }
  };

  const processTurn = async () => {
    try {
      const rid = currentRoom()?.id as string;
      const res = await fetch(`${API_BASE_URL}/rooms/${rid}/process_turn`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || '处理回合失败');
      }
      const state: GameState = await res.json();
      updateFromState(state);
    } catch (e: any) {
      setError(e.message || '处理回合失败');
      throw e;
    }
  };

  const fetchRooms = async () => {
    // Backend doesn't have a room list endpoint, so we use an empty list
    // Rooms are discovered by room ID
    setRooms([]);
  };

  onCleanup(() => {
    disconnectWebSocket();
  });

  createEffect(() => {
    if (currentPlayer() && !websocket() && currentRoom()) {
      connectWebSocket(currentRoom()?.id as string, currentPlayer()?.id).catch(() => {});
    }
  });

  return {
    get currentPlayer() { return currentPlayer(); },
    get gameState() { return gameState(); },
    get rooms() { return rooms(); },
    get currentRoom() { return currentRoom(); },
    get websocket() { return websocket(); },
    get isConnected() { return isConnected(); },
    get selectedAirshipId() { return selectedAirshipId(); },
    get selectedCityId() { return selectedCityId(); },
    get activeBattleId() { return activeBattleId(); },
    get notifications() { return notifications(); },
    get error() { return error(); },
    createRoom,
    joinRoom,
    leaveRoom,
    submitOrders,
    submitBattleAction,
    connectWebSocket,
    disconnectWebSocket,
    setSelectedAirship,
    setSelectedCity,
    setActiveBattle,
    addNotification,
    clearError,
    startGame,
    fetchRooms,
    setPlayerReady,
    processTurn,
  };
}

export function GameProvider(props: { children: any }) {
  const store = createGameStore();
  return (
    <GameContext.Provider value={store}>
      {props.children}
    </GameContext.Provider>
  );
}

export function useGameStore(): GameStore {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error('useGameStore 必须在 GameProvider 内使用');
  }
  return ctx;
}
