import type {
  Player, GameState, Room, Order, BattleAction, Battle, City, Airship,
} from '../types/game';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
    const text = await res.text();
    let json: ApiResponse<T>;
    try {
      json = text ? JSON.parse(text) : { success: res.ok };
    } catch {
      json = { success: res.ok, message: text };
    }
    if (!res.ok && !json.success) {
      json.success = false;
      json.error = json.error || `HTTP ${res.status}`;
    }
    return json;
  } catch (e: any) {
    return {
      success: false,
      error: e.message || '网络请求失败',
    };
  }
}

export const apiClient = {
  getRooms: (): Promise<ApiResponse<Room[]>> =>
    request<Room[]>('/rooms', { method: 'GET' }),

  getRoom: (roomId: string): Promise<ApiResponse<Room>> =>
    request<Room>(`/rooms/${roomId}`, { method: 'GET' }),

  createRoom: (playerName: string, maxPlayers: number): Promise<ApiResponse<{ room: Room; player: Player }>> =>
    request('/rooms', {
      method: 'POST',
      body: JSON.stringify({ playerName, maxPlayers }),
    }),

  joinRoom: (roomId: string, playerName: string): Promise<ApiResponse<{ room: Room; player: Player }>> =>
    request(`/rooms/${roomId}/join`, {
      method: 'POST',
      body: JSON.stringify({ playerName }),
    }),

  leaveRoom: (roomId: string, playerId: string): Promise<ApiResponse> =>
    request(`/rooms/${roomId}/leave`, {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    }),

  startGame: (roomId: string): Promise<ApiResponse<{ gameState: GameState; player: Player }>> =>
    request(`/rooms/${roomId}/start`, {
      method: 'POST',
    }),

  getGameState: (roomId: string): Promise<ApiResponse<GameState>> =>
    request<GameState>(`/game/${roomId}/state`, { method: 'GET' }),

  submitOrders: (roomId: string, playerId: string, orders: Order[]): Promise<ApiResponse> =>
    request(`/game/${roomId}/orders`, {
      method: 'POST',
      body: JSON.stringify({ playerId, orders }),
    }),

  submitBattleAction: (roomId: string, action: BattleAction): Promise<ApiResponse<Battle>> =>
    request<Battle>(`/game/${roomId}/battle/action`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),

  getBattle: (roomId: string, battleId: string): Promise<ApiResponse<Battle>> =>
    request<Battle>(`/game/${roomId}/battle/${battleId}`, { method: 'GET' }),

  getCity: (cityId: string): Promise<ApiResponse<City>> =>
    request<City>(`/cities/${cityId}`, { method: 'GET' }),

  trade: (
    cityId: string,
    playerId: string,
    airshipId: string,
    tradeType: 'buy' | 'sell',
    goodId: string,
    quantity: number
  ): Promise<ApiResponse<{ player: Player; airship: Airship }>> =>
    request(`/cities/${cityId}/trade`, {
      method: 'POST',
      body: JSON.stringify({ playerId, airshipId, tradeType, goodId, quantity }),
    }),

  repairAirship: (
    cityId: string,
    playerId: string,
    airshipId: string,
    amount: number
  ): Promise<ApiResponse<{ player: Player; airship: Airship }>> =>
    request(`/cities/${cityId}/repair`, {
      method: 'POST',
      body: JSON.stringify({ playerId, airshipId, amount }),
    }),

  recruitCrew: (
    cityId: string,
    playerId: string,
    airshipId: string,
    role: string,
    count: number
  ): Promise<ApiResponse<{ player: Player; airship: Airship }>> =>
    request(`/cities/${cityId}/recruit`, {
      method: 'POST',
      body: JSON.stringify({ playerId, airshipId, role, count }),
    }),

  getPlayer: (playerId: string): Promise<ApiResponse<Player>> =>
    request<Player>(`/players/${playerId}`, { method: 'GET' }),

  getAirship: (airshipId: string): Promise<ApiResponse<Airship>> =>
    request<Airship>(`/airships/${airshipId}`, { method: 'GET' }),

  modifyAirship: (
    playerId: string,
    airshipId: string,
    modifications: {
      modules?: Array<{ slot: number; moduleId: string | null }>;
      balloonType?: string;
    }
  ): Promise<ApiResponse<{ player: Player; airship: Airship }>> =>
    request(`/airships/${airshipId}/modify`, {
      method: 'POST',
      body: JSON.stringify({ playerId, modifications }),
    }),

  buildNewAirship: (
    playerId: string,
    cityId: string,
    name: string,
    balloonType: string,
    modules: string[]
  ): Promise<ApiResponse<{ player: Player; airship: Airship }>> =>
    request('/airships/build', {
      method: 'POST',
      body: JSON.stringify({ playerId, cityId, name, balloonType, modules }),
    }),

  formAlliance: (roomId: string, playerId: string, targetPlayerId: string): Promise<ApiResponse> =>
    request(`/game/${roomId}/alliance`, {
      method: 'POST',
      body: JSON.stringify({ playerId, targetPlayerId }),
    }),
};

export default apiClient;
