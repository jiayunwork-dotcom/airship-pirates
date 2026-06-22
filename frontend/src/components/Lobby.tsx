import { createSignal, onMount, For, Show } from 'solid-js';
import { useGameStore } from '../store/gameStore';
import type { Room } from '../types/game';
import type { Component } from 'solid-js';

interface LobbyProps {
  onNavigateToGame: () => void;
}

const Lobby: Component<LobbyProps> = (props) => {
  const store = useGameStore();

  const [playerName, setPlayerName] = createSignal('');
  const [maxPlayers, setMaxPlayers] = createSignal(4);
  const [joinRoomId, setJoinRoomId] = createSignal('');
  const [joinName, setJoinName] = createSignal('');
  const [isCreating, setIsCreating] = createSignal(false);
  const [isJoining, setIsJoining] = createSignal(false);

  onMount(async () => {
    await store.fetchRooms();
    const interval = setInterval(() => {
      if (!store.currentRoom) {
        store.fetchRooms();
      }
    }, 5000);
    () => clearInterval(interval);
  });

  onMount(() => {
    if (store.isConnected) return;
    store.connectWebSocket().catch(() => {});
  });

  const handleCreateRoom = async (e: Event) => {
    e.preventDefault();
    if (!playerName().trim()) return;
    setIsCreating(true);
    try {
      await store.createRoom(playerName().trim(), maxPlayers());
      props.onNavigateToGame();
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async (e: Event) => {
    e.preventDefault();
    if (!joinName().trim() || !joinRoomId().trim()) return;
    setIsJoining(true);
    try {
      await store.joinRoom(joinRoomId().trim().toUpperCase(), joinName().trim());
      props.onNavigateToGame();
    } finally {
      setIsJoining(false);
    }
  };

  const handleQuickJoin = async (room: Room) => {
    if (!playerName().trim() && !joinName().trim()) {
      store.addNotification('请先输入玩家名称');
      return;
    }
    const name = playerName().trim() || joinName().trim();
    setIsJoining(true);
    try {
      await store.joinRoom(room.id, name);
      props.onNavigateToGame();
    } finally {
      setIsJoining(false);
    }
  };

  const isHost = () => {
    if (!store.currentRoom || !store.currentPlayer) return false;
    return store.currentRoom.hostId === store.currentPlayer.id;
  };

  return (
    <div class="w-full min-h-screen flex flex-col items-center justify-start py-8 px-4">
      <div class="text-center mb-8">
        <h1 class="text-5xl font-bold text-amber-400 drop-shadow-lg mb-2">
          ⚓ 飞艇海盗 ⚓
        </h1>
        <p class="text-amber-200/80 text-lg">
          征服天空，建立你的海盗帝国
        </p>
      </div>

      <div class="w-full max-w-6xl grid md:grid-cols-2 gap-6">
        <div class="steampunk-panel p-6">
          <h2 class="text-2xl font-bold text-amber-300 mb-4 border-b border-brass pb-2">
            创建房间
          </h2>
          <form onSubmit={handleCreateRoom} class="space-y-4">
            <div>
              <label class="block text-amber-200 mb-1">船长姓名</label>
              <input
                type="text"
                value={playerName()}
                onInput={(e) => setPlayerName(e.currentTarget.value)}
                placeholder="请输入您的名字..."
                class="steampunk-input w-full"
                maxlength={20}
                required
              />
            </div>
            <div>
              <label class="block text-amber-200 mb-1">
                最大玩家数: {maxPlayers()} 人
              </label>
              <input
                type="range"
                min={4}
                max={6}
                value={maxPlayers()}
                onInput={(e) => setMaxPlayers(Number(e.currentTarget.value))}
                class="w-full accent-brass"
              />
              <div class="flex justify-between text-xs text-amber-200/60 mt-1">
                <span>4人</span>
                <span>6人</span>
              </div>
            </div>
            <button
              type="submit"
              class="steampunk-button w-full text-lg"
              disabled={isCreating() || !playerName().trim()}
            >
              {isCreating() ? '创建中...' : '🚀 创建新房间'}
            </button>
          </form>
        </div>

        <div class="steampunk-panel p-6">
          <h2 class="text-2xl font-bold text-amber-300 mb-4 border-b border-brass pb-2">
            加入房间
          </h2>
          <form onSubmit={handleJoinRoom} class="space-y-4">
            <div>
              <label class="block text-amber-200 mb-1">船长姓名</label>
              <input
                type="text"
                value={joinName()}
                onInput={(e) => setJoinName(e.currentTarget.value)}
                placeholder="请输入您的名字..."
                class="steampunk-input w-full"
                maxlength={20}
                required
              />
            </div>
            <div>
              <label class="block text-amber-200 mb-1">房间代码</label>
              <input
                type="text"
                value={joinRoomId()}
                onInput={(e) => setJoinRoomId(e.currentTarget.value.toUpperCase())}
                placeholder="输入房间代码..."
                class="steampunk-input w-full uppercase tracking-widest font-mono"
                maxlength={8}
                required
              />
            </div>
            <button
              type="submit"
              class="steampunk-button w-full text-lg"
              disabled={isJoining() || !joinName().trim() || !joinRoomId().trim()}
            >
              {isJoining() ? '加入中...' : '🎯 加入房间'}
            </button>
          </form>
        </div>
      </div>

      <div class="w-full max-w-6xl mt-6 steampunk-panel p-6">
        <div class="flex items-center justify-between mb-4 border-b border-brass pb-2">
          <h2 class="text-2xl font-bold text-amber-300">
            🏰 可用房间
          </h2>
          <button
            onClick={() => store.fetchRooms()}
            class="steampunk-button text-sm"
          >
            🔄 刷新列表
          </button>
        </div>

        <Show
          when={store.rooms.length > 0}
          fallback={
            <div class="text-center py-8 text-amber-200/60">
              <p class="text-lg">暂无可用房间</p>
              <p class="text-sm mt-2">创建一个新房间，或等待其他玩家创建</p>
            </div>
          }
        >
          <div class="grid gap-3 max-h-80 overflow-y-auto scrollbar-steampunk">
            <For each={store.rooms}>
              {(room) => (
                <div class="flex items-center justify-between p-4 bg-stone-800/50 rounded border border-brass/50 hover:border-brass transition-colors">
                  <div class="flex-1">
                    <div class="flex items-center gap-3 mb-1">
                      <span class="font-bold text-amber-300 text-lg">
                        {room.name}
                      </span>
                      <span class="px-2 py-0.5 bg-stone-700 rounded text-xs font-mono text-amber-200/80">
                        {room.id}
                      </span>
                      <Show when={room.started}>
                        <span class="px-2 py-0.5 bg-green-800 rounded text-xs text-green-200">
                          游戏中
                        </span>
                      </Show>
                    </div>
                    <div class="flex items-center gap-4 text-sm text-amber-200/70">
                      <span>
                        👥 {room.currentPlayers} / {room.maxPlayers}
                      </span>
                      <div class="flex items-center gap-1">
                        <For each={room.players.slice(0, 5)}>
                          {(p) => (
                            <span
                              class="w-5 h-5 rounded-full border border-stone-600"
                              style={{ background: p.color }}
                              title={p.name}
                            />
                          )}
                        </For>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleQuickJoin(room)}
                    class="steampunk-button"
                    disabled={room.started || room.currentPlayers >= room.maxPlayers || isJoining()}
                  >
                    {room.started ? '进行中' : '加入'}
                  </button>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      <Show when={store.currentRoom && !store.gameState}>
        <div class="fixed inset-0 bg-black/80 flex items-center justify-center z-40 backdrop-blur-sm">
          <div class="steampunk-panel p-8 max-w-lg w-full mx-4">
            <h2 class="text-3xl font-bold text-amber-300 mb-6 text-center border-b border-brass pb-4">
              等待房间就绪
            </h2>
            <div class="mb-6">
              <div class="flex items-center justify-between mb-3">
                <span class="text-amber-200">房间代码：</span>
                <span class="font-mono text-2xl text-amber-300 font-bold tracking-widest">
                  {store.currentRoom?.id}
                </span>
              </div>
              <div class="flex items-center justify-between mb-3">
                <span class="text-amber-200">玩家：</span>
                <span class="text-amber-100">
                  {store.currentRoom?.currentPlayers} / {store.currentRoom?.maxPlayers}
                </span>
              </div>
            </div>

            <div class="mb-6">
              <h3 class="text-lg font-bold text-amber-300 mb-3">玩家列表</h3>
              <div class="space-y-2 max-h-48 overflow-y-auto scrollbar-steampunk">
                <For each={store.currentRoom?.players}>
                  {(p) => (
                    <div class="flex items-center justify-between p-3 bg-stone-800/50 rounded border border-brass/30">
                      <div class="flex items-center gap-3">
                        <span
                          class="w-6 h-6 rounded-full border-2 border-stone-600"
                          style={{ background: p.color }}
                        />
                        <span class="text-amber-100 font-medium">{p.name}</span>
                        <Show when={p.id === store.currentPlayer?.id}>
                          <span class="text-xs px-2 py-0.5 bg-brass/30 rounded text-amber-200">
                            (你)
                          </span>
                        </Show>
                      </div>
                      <div class="flex items-center gap-2">
                        <Show when={p.ready}>
                          <span class="text-green-400 text-sm">✓ 已准备</span>
                        </Show>
                        <Show when={!p.ready}>
                          <span class="text-stone-400 text-sm">等待中...</span>
                        </Show>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>

            <div class="flex gap-4">
              <button
                onClick={() => store.setPlayerReady(true)}
                class="steampunk-button flex-1"
                disabled={store.currentPlayer?.ready}
              >
                {store.currentPlayer?.ready ? '已准备' : '✅ 准备游戏'}
              </button>
              <Show when={isHost()}>
                <button
                  onClick={() => store.startGame()}
                  class="steampunk-button flex-1 bg-green-600 hover:bg-green-500"
                  disabled={(store.currentRoom?.currentPlayers || 0) < 4}
                >
                  🚀 开始游戏
                </button>
              </Show>
              <button
                onClick={() => store.leaveRoom()}
                class="steampunk-button flex-1 bg-red-800 hover:bg-red-700"
              >
                离开房间
              </button>
            </div>
            <Show when={(store.currentRoom?.currentPlayers || 0) < 4 && isHost()}>
              <p class="text-center mt-3 text-amber-200/60 text-sm">
                至少需要 4 名玩家才能开始游戏
              </p>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default Lobby;
