import { createMemo, For, Show, createSignal, onMount } from 'solid-js';
import { useGameStore } from '../store/gameStore';
import AirshipPanel from './AirshipPanel';
import ModuleBuilder from './ModuleBuilder';
import { ActionType, AltitudeLevel, WeatherType } from '../types/game';
import type { Airship, City, Waypoint, Weather, Order } from '../types/game';
import type { Component } from 'solid-js';

const MAP_WIDTH = 20;
const MAP_HEIGHT = 15;
const HEX_SIZE = 34;
const HEX_WIDTH = HEX_SIZE * 2;
const HEX_HEIGHT = Math.sqrt(3) * HEX_SIZE;

const WEATHER_ICONS: Record<WeatherType, string> = {
  clear: '☀️',
  windy: '🌬️',
  storm: '⛈️',
  fog: '🌫️',
  turbulence: '🌀',
  sandstorm: '🏜️',
};

const ALTITUDE_COLORS: Record<AltitudeLevel, string> = {
  low: '#f59e0b',
  medium: '#3b82f6',
  high: '#a855f7',
  extreme: '#ef4444',
};

const WORLD_MAX = 1000;

function worldToGrid(wx: number, wy: number): { col: number; row: number } {
  const col = Math.max(0, Math.min(MAP_WIDTH - 1, Math.floor((wx / WORLD_MAX) * MAP_WIDTH)));
  const row = Math.max(0, Math.min(MAP_HEIGHT - 1, Math.floor((wy / WORLD_MAX) * MAP_HEIGHT)));
  return { col, row };
}

function hexToPixel(col: number, row: number): { x: number; y: number } {
  const x = HEX_WIDTH * 0.75 * col;
  const y = HEX_HEIGHT * (row + (col % 2 ? 0.5 : 0));
  return { x: x + HEX_SIZE + 10, y: y + HEX_SIZE + 10 };
}

function worldToPixel(wx: number, wy: number): { x: number; y: number } {
  const { col, row } = worldToGrid(wx, wy);
  return hexToPixel(col, row);
}

function hexCorners(cx: number, cy: number, size: number): string {
  const points: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const x = cx + size * Math.cos(angle);
    const y = cy + size * Math.sin(angle);
    points.push(`${x},${y}`);
  }
  return points.join(' ');
}

interface TileData {
  col: number;
  row: number;
  x: number;
  y: number;
  fill: string;
}

const TopBar: Component<{
  turn: number;
  phase: string;
  weathers: Weather[];
}> = (props) => {
  const phaseLabels: Record<string, string> = {
    lobby: '大厅阶段',
    orders: '指令阶段',
    processing: '处理阶段',
    battle: '战斗阶段',
    ended: '游戏结束',
  };
  return (
    <div class="h-14 bg-gradient-to-r from-amber-900/95 to-stone-800/95 border-b-2 border-brass flex items-center justify-between px-4 shrink-0">
      <div class="flex items-center gap-6">
        <div class="flex items-center gap-2">
          <span class="text-amber-300 text-sm">回合</span>
          <span class="text-2xl font-bold text-amber-100 font-mono bg-stone-700 px-3 py-0.5 rounded">
            {props.turn}
          </span>
        </div>
        <div class="h-8 w-px bg-brass/40" />
        <div class="flex items-center gap-2">
          <span class="text-amber-300 text-sm">阶段</span>
          <span class="px-3 py-1 bg-sky-800 rounded text-sky-100 font-bold text-sm">
            {phaseLabels[props.phase] || '指令阶段'}
          </span>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <span class="text-amber-300 text-sm">天气预报:</span>
        <div class="flex gap-2">
          <For each={props.weathers.slice(0, 4)}>
            {(w) => (
              <div
                class="flex items-center gap-1 px-2 py-1 bg-stone-700/70 rounded text-xs"
                title={`${w.type}`}
              >
                <span class="text-lg">{WEATHER_ICONS[w.type] || '🌤️'}</span>
                <span
                  class="inline-block w-4 h-4 rounded-full border border-white/20"
                  style={{
                    background: `conic-gradient(from 0deg, transparent 45%, white 46% 54%, transparent 55%), #44403c`,
                    transform: `rotate(${w.wind_direction}deg)`,
                  }}
                />
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
};

const PlayerSidebar: Component<{ onLeaveHome: () => void }> = (props) => {
  const store = useGameStore();

  const player = store.currentPlayer;

  const playerAirships = createMemo(() => {
    if (!player || !store.gameState) return [];
    return store.gameState.airships.filter((a) => a.player_id === player.id);
  });

  const allPlayers = createMemo(() => {
    if (!store.gameState) return [];
    return store.gameState.players;
  });

  if (!player) return null;

  return (
    <div class="w-64 bg-gradient-to-b from-amber-900/90 to-stone-800/90 border-r-2 border-brass p-3 overflow-y-auto scrollbar-steampunk shrink-0">
      <div class="mb-4">
        <div class="flex items-center gap-2 mb-2">
          <span
            class="w-8 h-8 rounded-full border-2 border-white/30"
            style={{ background: player.color }}
          />
          <div>
            <div class="font-bold text-amber-200 text-sm">{player.name}</div>
            <div class="text-[10px] text-amber-200/50">船长</div>
          </div>
        </div>
      </div>

      <div class="space-y-2 mb-4">
        <div class="flex items-center justify-between p-2 bg-stone-800/60 rounded border border-brass/30">
          <span class="text-amber-200/80 text-xs flex items-center gap-1">
            💰 财富
          </span>
          <span class="text-amber-300 font-bold font-mono">
            {player.wealth.toLocaleString()}
          </span>
        </div>
        <div class="flex items-center justify-between p-2 bg-stone-800/60 rounded border border-brass/30">
          <span class="text-amber-200/80 text-xs flex items-center gap-1">
            ⭐ 声望
          </span>
          <span class="text-yellow-400 font-bold font-mono">
            {player.reputation}
          </span>
        </div>
        <div class="flex items-center justify-between p-2 bg-stone-800/60 rounded border border-brass/30">
          <span class="text-amber-200/80 text-xs flex items-center gap-1">
            🚁 飞艇
          </span>
          <span class="text-sky-300 font-bold font-mono">
            {playerAirships().length}
          </span>
        </div>
      </div>

      <div class="mb-4">
        <div class="text-xs text-amber-300 font-bold mb-2 border-b border-brass/40 pb-1">
          🎮 所有玩家 ({allPlayers().length})
        </div>
        <div class="space-y-1">
          <For each={allPlayers()}>
            {(p) => (
              <div class="flex items-center justify-between p-2 bg-stone-800/50 rounded border border-brass/20 text-xs">
                <div class="flex items-center gap-2">
                  <span
                    class="w-5 h-5 rounded-full border border-white/30 shrink-0"
                    style={{ background: p.color }}
                  />
                  <span class={`${p.id === player.id ? 'text-amber-200 font-bold' : 'text-amber-200/80'} truncate`}>
                    {p.name}
                    {p.id === player.id && <span class="ml-1 text-amber-400/70">(你)</span>}
                  </span>
                </div>
                <span class="text-amber-300/80 font-mono text-[10px]">
                  💰{p.wealth}
                </span>
              </div>
            )}
          </For>
        </div>
      </div>

      <div class="mb-4">
        <div class="text-xs text-amber-300 font-bold mb-2 border-b border-brass/40 pb-1">
          🤝 同盟
        </div>
        <div class="space-y-1">
          <Show
            when={player.alliances.length > 0}
            fallback={<div class="text-xs text-amber-200/40">暂无同盟</div>}
          >
            <For each={player.alliances}>
              {(allianceId) => {
                const ally = store.gameState?.players.find((p) => p.id === allianceId);
                return (
                  <div class="flex items-center gap-2 p-1.5 bg-stone-800/50 rounded text-xs">
                    <span
                      class="w-4 h-4 rounded-full border border-white/20"
                      style={{ background: ally?.color || '#666' }}
                    />
                    <span class="text-amber-200">{ally?.name || allianceId}</span>
                  </div>
                );
              }}
            </For>
          </Show>
        </div>
      </div>

      <div class="mb-4">
        <div class="text-xs text-amber-300 font-bold mb-2 border-b border-brass/40 pb-1">
          🚁 我的飞艇
        </div>
        <div class="space-y-1 max-h-40 overflow-y-auto scrollbar-steampunk">
          <For each={playerAirships()}>
            {(ship) => (
              <button
                onClick={() => store.setSelectedAirship(ship.id)}
                class={`w-full text-left p-2 rounded border text-xs transition-colors ${
                  store.selectedAirshipId === ship.id
                    ? 'bg-amber-700/40 border-amber-400'
                    : 'bg-stone-800/50 border-brass/30 hover:border-brass/60'
                }`}
              >
                <div class="flex items-center justify-between">
                  <span class="font-bold text-amber-200 truncate">{ship.name}</span>
                  {ship.status === 'battling' && <span class="text-red-400 text-[10px]">⚔️</span>}
                </div>
                <div class="text-[10px] text-amber-200/60 mt-0.5 flex justify-between">
                  <span>HP: {ship.hp}/{ship.max_hp}</span>
                  <span>
                    ({ship.position.x},{ship.position.y})
                  </span>
                </div>
              </button>
            )}
          </For>
        </div>
      </div>

      <div class="pt-2 border-t border-brass/30 space-y-2">
        <button
          onClick={() => {
            store.leaveRoom();
            props.onLeaveHome();
          }}
          class="w-full text-xs py-1.5 px-3 bg-red-800/70 hover:bg-red-700 text-red-100 rounded border border-red-600/50"
        >
          🏳️ 离开游戏
        </button>
      </div>
    </div>
  );
};

const OrdersPanel: Component = () => {
  const store = useGameStore();
  const [pendingOrders, setPendingOrders] = createSignal<Order[]>([]);
  const [orderType, setOrderType] = createSignal<ActionType>(ActionType.MOVE);
  const [targetX, setTargetX] = createSignal<string>('');
  const [targetY, setTargetY] = createSignal<string>('');

  const selectedAirship = createMemo(() => {
    if (!store.selectedAirshipId || !store.gameState) return null;
    return store.gameState.airships.find((a) => a.id === store.selectedAirshipId) || null;
  });

  const validateCoordinate = (xStr: string, yStr: string): { valid: boolean; error?: string; x?: number; y?: number } => {
    const x = Number(xStr);
    const y = Number(yStr);
    if (isNaN(x) || isNaN(y)) {
      return { valid: false, error: '请输入有效数字' };
    }
    if (x < 0 || x >= MAP_WIDTH) {
      return { valid: false, error: `X坐标必须在 0 到 ${MAP_WIDTH - 1} 之间` };
    }
    if (y < 0 || y >= MAP_HEIGHT) {
      return { valid: false, error: `Y坐标必须在 0 到 ${MAP_HEIGHT - 1} 之间` };
    }
    return { valid: true, x, y };
  };

  const addOrder = () => {
    const ship = selectedAirship();
    if (!ship) {
      store.addNotification('请先选择一艘飞艇');
      return;
    }

    let params = {};
    if (orderType() === ActionType.MOVE) {
      if (!targetX() || !targetY()) {
        store.addNotification('请输入目标坐标');
        return;
      }
      const validation = validateCoordinate(targetX(), targetY());
      if (!validation.valid) {
        store.addNotification(validation.error!);
        return;
      }
      params = { x: validation.x!, y: validation.y! };
    }

    const order: Order = {
      player_id: store.currentPlayer!.id,
      ship_id: ship.id,
      type: orderType(),
      params,
    };

    setPendingOrders((prev) => [...prev, order]);
    setTargetX('');
    setTargetY('');
  };

  const removeOrder = (index: number) => {
    setPendingOrders((prev) => prev.filter((_, i) => i !== index));
  };

  const submitAllOrders = async () => {
    if (pendingOrders().length === 0) {
      store.addNotification('没有待提交的指令');
      return;
    }
    await store.submitOrders(pendingOrders());
    setPendingOrders([]);
  };

  const actionLabels: Record<ActionType, { label: string; icon: string }> = {
    move: { label: '移动', icon: '🚢' },
    change_altitude: { label: '改变高度', icon: '⬆️' },
    trade: { label: '交易', icon: '💰' },
    set_toll: { label: '设卡', icon: '🛂' },
    repair: { label: '维修', icon: '🔧' },
    recruit_crew: { label: '招募', icon: '👥' },
    patrol: { label: '巡逻', icon: '🔍' },
    attack: { label: '攻击', icon: '⚔️' },
    board: { label: '登舷', icon: '🏴‍☠️' },
    retreat: { label: '撤退', icon: '🏃' },
  };

  return (
    <div class="h-48 bg-gradient-to-t from-amber-900/95 to-stone-800/95 border-t-2 border-brass p-3 shrink-0 overflow-hidden">
      <div class="flex h-full gap-3">
        <div class="flex-1 flex flex-col">
          <div class="text-xs text-amber-300 font-bold mb-2 flex items-center gap-2">
            <span>📋 指令面板</span>
            <Show when={selectedAirship()}>
              <span class="text-amber-200/60 font-normal">
                - 选中: <span class="text-amber-200">{selectedAirship()!.name}</span>
              </span>
            </Show>
          </div>

          <div class="flex items-center gap-2 mb-2">
            <select
              value={orderType()}
              onChange={(e) => setOrderType(e.currentTarget.value as ActionType)}
              class="steampunk-input text-sm py-1 w-36"
            >
              <For each={Object.entries(actionLabels)}>
                {([type, info]) => (
                  <option value={type}>{info.icon} {info.label}</option>
                )}
              </For>
            </select>

            <Show when={orderType() === ActionType.MOVE}>
              <input
                type="number"
                placeholder="X"
                value={targetX()}
                onInput={(e) => setTargetX(e.currentTarget.value)}
                class="steampunk-input text-sm py-1 w-16 text-center"
                min={0}
                max={MAP_WIDTH}
              />
              <span class="text-amber-300">,</span>
              <input
                type="number"
                placeholder="Y"
                value={targetY()}
                onInput={(e) => setTargetY(e.currentTarget.value)}
                class="steampunk-input text-sm py-1 w-16 text-center"
                min={0}
                max={MAP_HEIGHT}
              />
            </Show>

            <button
              onClick={addOrder}
              class="steampunk-button text-sm py-1 px-3"
              disabled={!selectedAirship()}
            >
              ➕ 添加
            </button>
          </div>

          <div class="flex-1 bg-stone-900/60 rounded border border-brass/30 p-2 overflow-y-auto scrollbar-steampunk">
            <Show
              when={pendingOrders().length > 0}
              fallback={<div class="text-xs text-amber-200/40 text-center py-2">暂无待提交指令</div>}
            >
              <div class="flex flex-wrap gap-1.5">
                <For each={pendingOrders()}>
                  {(order, idx) => {
                    const ship = store.gameState?.airships.find((a) => a.id === order.ship_id);
                    const actionInfo = actionLabels[order.type] || { label: order.type, icon: '📋' };
                    return (
                      <div class="flex items-center gap-1 px-2 py-1 bg-stone-700/70 rounded border border-brass/40 text-xs">
                        <span class="text-amber-300">{ship?.name?.slice(0, 6) || order.ship_id.slice(0, 6)}</span>
                        <span class="text-amber-200/70">→</span>
                        <span class="text-amber-200">{actionInfo.icon} {actionInfo.label}</span>
                        {order.params?.x !== undefined && order.params?.y !== undefined && (
                          <span class="text-amber-300 font-mono">
                            ({order.params.x},{order.params.y})
                          </span>
                        )}
                        <button
                          onClick={() => removeOrder(idx())}
                          class="ml-1 text-red-400 hover:text-red-300"
                        >
                          ×
                        </button>
                      </div>
                    );
                  }}
                </For>
              </div>
            </Show>
          </div>
        </div>

        <div class="flex flex-col gap-2 justify-end w-36 shrink-0">
          <div class="text-xs text-amber-200/60 text-center">
            待提交: <span class="text-amber-300 font-bold">{pendingOrders().length}</span> 条指令
          </div>
          <button
            onClick={() => setPendingOrders([])}
            class="text-sm py-1.5 px-3 bg-stone-700 hover:bg-stone-600 text-amber-200 rounded border border-brass/40"
          >
            🗑️ 清空
          </button>
          <button
            onClick={submitAllOrders}
            class="steampunk-button text-sm py-2"
            disabled={pendingOrders().length === 0}
          >
            ✅ 提交指令
          </button>
        </div>
      </div>
    </div>
  );
};

const GameMap: Component = () => {
  const store = useGameStore();
  const svgWidth = MAP_WIDTH * HEX_WIDTH * 0.75 + HEX_WIDTH + 20;
  const svgHeight = MAP_HEIGHT * HEX_HEIGHT + HEX_HEIGHT + 20;

  const tiles = createMemo<TileData[]>(() => {
    const result: TileData[] = [];
    for (let col = 0; col < MAP_WIDTH; col++) {
      for (let row = 0; row < MAP_HEIGHT; row++) {
        const { x, y } = hexToPixel(col, row);
        const baseFill = (col + row) % 2 === 0 ? '#1e3a5f' : '#1e4a6f';
        result.push({ col, row, x, y, fill: baseFill });
      }
    }
    return result;
  });

  const handleTileClick = (col: number, row: number) => {
    if (!store.gameState) return;

    const gridXMin = (col / MAP_WIDTH) * WORLD_MAX;
    const gridXMax = ((col + 1) / MAP_WIDTH) * WORLD_MAX;
    const gridYMin = (row / MAP_HEIGHT) * WORLD_MAX;
    const gridYMax = ((row + 1) / MAP_HEIGHT) * WORLD_MAX;

    const clickedCity = store.gameState.cities.find(
      (c) => c.position.x >= gridXMin && c.position.x < gridXMax &&
             c.position.y >= gridYMin && c.position.y < gridYMax
    );
    if (clickedCity) {
      store.setSelectedCity(clickedCity.id);
      return;
    }

    const clickedAirship = store.gameState.airships.find(
      (a) => a.position.x >= gridXMin && a.position.x < gridXMax &&
             a.position.y >= gridYMin && a.position.y < gridYMax
    );
    if (clickedAirship) {
      store.setSelectedAirship(clickedAirship.id);
      return;
    }

    store.setSelectedAirship(null);
    store.setSelectedCity(null);
  };

  return (
    <div class="flex-1 overflow-auto bg-gradient-to-b from-sky-900/50 to-slate-900/50 p-2 scrollbar-steampunk">
      <svg
        width={svgWidth}
        height={svgHeight}
        class="mx-auto"
        style={{ 'min-width': svgWidth + 'px' }}
      >
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="cityGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.5" />
            <stop offset="100%" stop-color="#fbbf24" stop-opacity="0" />
          </radialGradient>
          <marker
            id="windArrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="rgba(255,255,255,0.4)" />
          </marker>
        </defs>

        <For each={tiles()}>
          {(tile) => {
            return (
              <polygon
                class="hex-tile"
                points={hexCorners(tile.x, tile.y, HEX_SIZE)}
                fill={tile.fill}
                onClick={() => handleTileClick(tile.col, tile.row)}
                data-tile={`${tile.col},${tile.row}`}
              />
            );
          }}
        </For>

        <Show when={store.gameState}>
          <For each={store.gameState!.weather}>
            {(w) => {
              const { x, y } = worldToPixel(w.position.x, w.position.y);
              const radiusPx = w.radius * HEX_WIDTH * 0.75;
              return (
                <g>
                  <circle
                    cx={x}
                    cy={y}
                    r={radiusPx}
                    fill="rgba(255,255,255,0.08)"
                    stroke="rgba(255,255,255,0.15)"
                    stroke-width={1}
                    stroke-dasharray="4 4"
                  />
                  <text x={x} y={y + 8} text-anchor="middle" font-size={`${HEX_SIZE * 0.8}`}>
                    {WEATHER_ICONS[w.type] || '🌤️'}
                  </text>
                  <line
                    x1={x}
                    y1={y}
                    x2={x + Math.cos((w.wind_direction * Math.PI) / 180) * HEX_SIZE * 0.6}
                    y2={y + Math.sin((w.wind_direction * Math.PI) / 180) * HEX_SIZE * 0.6}
                    stroke="rgba(255,255,255,0.4)"
                    stroke-width={2}
                    marker-end="url(#windArrow)"
                  />
                </g>
              );
            }}
          </For>

          <For each={store.gameState!.waypoints}>
            {(wp: Waypoint) => {
              const { x, y } = worldToPixel(wp.position.x, wp.position.y);
              return (
                <g>
                  <circle cx={x} cy={y} r={HEX_SIZE * 0.25} fill={wp.toll_player_id ? '#854d0e' : '#44403c'} stroke="#d6d3d1" stroke-width={2} />
                  <text x={x} y={y + 5} text-anchor="middle" font-size={`${HEX_SIZE * 0.4}`} fill="#fafaf9">
                    {wp.toll_player_id ? '💰' : '📍'}
                  </text>
                </g>
              );
            }}
          </For>

          <For each={store.gameState!.cities}>
            {(city: City) => {
              const { x, y } = worldToPixel(city.position.x, city.position.y);
              const isSelected = store.selectedCityId === city.id;
              return (
                <g
                  onClick={() => store.setSelectedCity(city.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <circle cx={x} cy={y} r={HEX_SIZE * 0.85} fill="url(#cityGlow)" />
                  <circle
                    cx={x}
                    cy={y}
                    r={HEX_SIZE * 0.55}
                    fill="#92400e"
                    stroke={isSelected ? '#fcd34d' : '#fbbf24'}
                    stroke-width={isSelected ? 4 : 2.5}
                    filter={isSelected ? 'url(#glow)' : undefined}
                  />
                  <text x={x} y={y + 6} text-anchor="middle" font-size={`${HEX_SIZE * 0.55}`}>
                    🏰
                  </text>
                  <text
                    x={x}
                    y={y + HEX_SIZE * 0.85}
                    text-anchor="middle"
                    font-size="11"
                    fill="#fde68a"
                    font-weight="bold"
                    style={{
                      'paint-order': 'stroke',
                      stroke: '#1c1917',
                      'stroke-width': 3,
                    }}
                  >
                    {city.name}
                  </text>
                </g>
              );
            }}
          </For>

          <For each={store.gameState!.airships}>
            {(airship: Airship) => {
              const { x, y } = worldToPixel(airship.position.x, airship.position.y);
              const player = store.gameState!.players.find((p) => p.id === airship.player_id);
              const isSelected = store.selectedAirshipId === airship.id;
              const altitudeOffset =
                airship.altitude === AltitudeLevel.LOW ? 8 : 
                airship.altitude === AltitudeLevel.MEDIUM ? 0 : 
                airship.altitude === AltitudeLevel.HIGH ? -8 : -12;
              return (
                <g
                  onClick={() => store.setSelectedAirship(airship.id)}
                  style={{ cursor: 'pointer' }}
                  class="transition-transform"
                >
                  <ellipse
                    cx={x}
                    cy={y + 12}
                    rx={HEX_SIZE * 0.45}
                    ry={HEX_SIZE * 0.12}
                    fill="rgba(0,0,0,0.3)"
                  />
                  {isSelected && (
                    <circle
                      cx={x}
                      cy={y + altitudeOffset}
                      r={HEX_SIZE * 0.65}
                      fill="none"
                      stroke="#fcd34d"
                      stroke-width={3}
                      stroke-dasharray="6 3"
                      filter="url(#glow)"
                    >
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from={`0 ${x} ${y + altitudeOffset}`}
                        to={`360 ${x} ${y + altitudeOffset}`}
                        dur="8s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}
                  <circle
                    cx={x}
                    cy={y + altitudeOffset}
                    r={HEX_SIZE * 0.48}
                    fill={player?.color || '#666'}
                    stroke={ALTITUDE_COLORS[airship.altitude]}
                    stroke-width={2.5}
                    opacity={0.95}
                  />
                  <text
                    x={x}
                    y={y + altitudeOffset + 6}
                    text-anchor="middle"
                    font-size={`${HEX_SIZE * 0.5}`}
                  >
                    🚁
                  </text>
                  <g transform={`translate(${x - HEX_SIZE * 0.4}, ${y + altitudeOffset - HEX_SIZE * 0.65})`}>
                    <rect width={HEX_SIZE * 0.8} height={5} rx={2} fill="#292524" />
                    <rect
                      width={HEX_SIZE * 0.8 * (airship.hp / airship.max_hp)}
                      height={5}
                      rx={2}
                      fill={airship.hp / airship.max_hp > 0.5 ? '#22c55e' : airship.hp / airship.max_hp > 0.25 ? '#eab308' : '#ef4444'}
                    />
                  </g>
                  <text
                    x={x}
                    y={y + altitudeOffset + HEX_SIZE * 0.85}
                    text-anchor="middle"
                    font-size="9"
                    fill="#fef3c7"
                    font-weight="bold"
                    style={{
                      'paint-order': 'stroke',
                      stroke: '#1c1917',
                      'stroke-width': 3,
                    }}
                  >
                    {airship.name.slice(0, 6)}
                  </text>
                </g>
              );
            }}
          </For>
        </Show>
      </svg>
    </div>
  );
};

const GameBoard: Component<{ onLeaveHome: () => void }> = (props) => {
  const store = useGameStore();
  const [showModuleBuilder, setShowModuleBuilder] = createSignal(false);

  onMount(() => {
    if (!store.isConnected) {
      store.connectWebSocket(store.currentPlayer?.id).catch(() => {});
    }
  });

  const selectedAirship = createMemo(() => {
    if (!store.selectedAirshipId || !store.gameState) return null;
    return store.gameState.airships.find((a) => a.id === store.selectedAirshipId) || null;
  });

  const selectedPlayerColor = createMemo(() => {
    const ship = selectedAirship();
    if (!ship || !store.gameState) return undefined;
    return store.gameState.players.find((p) => p.id === ship.player_id)?.color;
  });

  return (
    <div class="w-full h-screen flex flex-col overflow-hidden bg-slate-950">
      <TopBar
        turn={store.gameState?.turn || 1}
        phase={store.gameState?.phase || 'orders'}
        weathers={store.gameState?.weather || []}
      />

      <div class="flex-1 flex overflow-hidden">
        <PlayerSidebar onLeaveHome={props.onLeaveHome} />

        <div class="flex-1 flex flex-col overflow-hidden">
          <GameMap />
          <OrdersPanel />
        </div>

        <div class="w-80 border-l-2 border-brass shrink-0">
          <Show
            when={selectedAirship()}
            fallback={
              <div class="h-full flex flex-col items-center justify-center p-6 text-center">
                <span class="text-6xl mb-4 opacity-50">🚁</span>
                <p class="text-amber-200/60 text-sm">
                  点击地图上的飞艇查看详情
                </p>
                <p class="text-amber-200/40 text-xs mt-2">
                  或从左侧列表中选择
                </p>
              </div>
            }
          >
            <AirshipPanel
              airship={selectedAirship()!}
              playerColor={selectedPlayerColor()}
              onClose={() => store.setSelectedAirship(null)}
              onModify={() => setShowModuleBuilder(true)}
            />
          </Show>
        </div>
      </div>

      <Show when={showModuleBuilder() && selectedAirship() && store.currentPlayer}>
        <ModuleBuilder
          airship={selectedAirship()!}
          playerWealth={store.currentPlayer!.wealth}
          onClose={() => setShowModuleBuilder(false)}
          mode="modify"
        />
      </Show>
    </div>
  );
};

export default GameBoard;
