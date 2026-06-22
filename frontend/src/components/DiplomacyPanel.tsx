import { For, Show, createMemo, createSignal } from 'solid-js';
import { useGameStore } from '../store/gameStore';
import type { Component } from 'solid-js';
import type { Alliance, Player } from '../types/game';

const TRUST_LEVEL_INFO = {
  1: { name: '基础同盟', color: 'text-emerald-400', description: '共享位置视野' },
  2: { name: '贸易协定', color: 'text-amber-400', description: '共享航路哨站收益' },
  3: { name: '联合指挥', color: 'text-purple-400', description: '可建议盟友航向' },
};

const DiplomacyPanel: Component = () => {
  const store = useGameStore();
  const [selectedTab, setSelectedTab] = createSignal<'alliances' | 'invites' | 'invite'>('alliances');

  const playerAlliances = createMemo(() => {
    if (!store.currentPlayer || !store.gameState) return [];
    const playerId = store.currentPlayer.id;
    return store.gameState.alliances.filter(
      (a) => a.active && (a.player_a_id === playerId || a.player_b_id === playerId)
    );
  });

  const pendingInvites = createMemo(() => {
    if (!store.currentPlayer || !store.gameState) return [];
    return store.gameState.pending_invites.filter(
      (inv) => inv.to_player_id === store.currentPlayer!.id
    );
  });

  const otherPlayers = createMemo(() => {
    if (!store.currentPlayer || !store.gameState) return [];
    const playerId = store.currentPlayer.id;
    const allyIds = new Set(store.currentPlayer.alliances);
    const invitedIds = new Set(
      store.gameState.pending_invites
        .filter((inv) => inv.from_player_id === playerId)
        .map((inv) => inv.to_player_id)
    );
    return store.gameState.players.filter(
      (p) => p.id !== playerId && !allyIds.has(p.id) && !invitedIds.has(p.id)
    );
  });

  const getAllyInfo = (alliance: Alliance): Player | undefined => {
    if (!store.gameState || !store.currentPlayer) return undefined;
    const allyId =
      alliance.player_a_id === store.currentPlayer.id
        ? alliance.player_b_id
        : alliance.player_a_id;
    return store.gameState.players.find((p) => p.id === allyId);
  };

  const getTrustInfo = (level: number) => {
    return TRUST_LEVEL_INFO[level as keyof typeof TRUST_LEVEL_INFO] || TRUST_LEVEL_INFO[1];
  };

  const handleAcceptInvite = (inviteId: string) => {
    store.respondInvite(inviteId, true);
  };

  const handleRejectInvite = (inviteId: string) => {
    store.respondInvite(inviteId, false);
  };

  const handleInvitePlayer = (playerId: string) => {
    store.inviteAlliance(playerId);
  };

  const handleDissolveAlliance = (allyId: string) => {
    if (confirm('确定要解散联盟吗？')) {
      store.dissolveAlliance(allyId);
    }
  };

  return (
    <div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div class="bg-gradient-to-b from-amber-900/95 to-stone-800/95 border-2 border-brass rounded-lg shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div class="flex items-center justify-between p-4 border-b border-brass/40">
          <h2 class="text-xl font-bold text-amber-200 flex items-center gap-2">
            🤝 外交中心
          </h2>
          <button
            onClick={() => store.setShowDiplomacyPanel(false)}
            class="text-amber-300 hover:text-amber-100 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div class="flex border-b border-brass/30">
          <button
            onClick={() => setSelectedTab('alliances')}
            class={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
              selectedTab() === 'alliances'
                ? 'bg-amber-700/40 text-amber-200 border-b-2 border-amber-400'
                : 'text-amber-300/70 hover:text-amber-200 hover:bg-amber-700/20'
            }`}
          >
            我的联盟
          </button>
          <button
            onClick={() => setSelectedTab('invites')}
            class={`flex-1 py-2 px-4 text-sm font-medium transition-colors relative ${
              selectedTab() === 'invites'
                ? 'bg-amber-700/40 text-amber-200 border-b-2 border-amber-400'
                : 'text-amber-300/70 hover:text-amber-200 hover:bg-amber-700/20'
            }`}
          >
            待处理邀请
            {pendingInvites().length > 0 && (
              <span class="absolute top-1 right-2 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {pendingInvites().length}
              </span>
            )}
          </button>
          <button
            onClick={() => setSelectedTab('invite')}
            class={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
              selectedTab() === 'invite'
                ? 'bg-amber-700/40 text-amber-200 border-b-2 border-amber-400'
                : 'text-amber-300/70 hover:text-amber-200 hover:bg-amber-700/20'
            }`}
          >
            发起邀请
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-steampunk">
          <Show when={selectedTab() === 'alliances'}>
            <Show
              when={playerAlliances().length > 0}
              fallback={
                <div class="text-center py-12">
                  <span class="text-5xl mb-4 block">🏳️</span>
                  <p class="text-amber-200/60 text-sm">暂无联盟</p>
                  <p class="text-amber-200/40 text-xs mt-2">
                    与其他玩家建立联盟以获得战略优势
                  </p>
                </div>
              }
            >
              <For each={playerAlliances()}>
                {(alliance) => {
                  const ally = getAllyInfo(alliance);
                  const trustInfo = getTrustInfo(alliance.trust_level);
                  const duration = (store.gameState?.turn || 0) - alliance.created_at_turn;
                  return (
                    <div class="bg-stone-800/60 rounded-lg border border-brass/30 p-4">
                      <div class="flex items-center gap-3 mb-3">
                        <span
                          class="w-10 h-10 rounded-full border-2 border-white/30"
                          style={{ background: ally?.color || '#666' }}
                        />
                        <div class="flex-1">
                          <div class="font-bold text-amber-200">
                            {ally?.name || '未知玩家'}
                          </div>
                          <div class={`text-xs font-medium ${trustInfo.color}`}>
                            ⭐ 信任等级 {alliance.trust_level} - {trustInfo.name}
                          </div>
                        </div>
                      </div>

                      <div class="space-y-2 text-sm">
                        <div class="flex justify-between">
                          <span class="text-amber-200/60">持续回合</span>
                          <span class="text-amber-300 font-mono">{duration} 回合</span>
                        </div>
                        <div class="flex justify-between">
                          <span class="text-amber-200/60">无背叛回合</span>
                          <span class="text-emerald-400 font-mono">
                            {alliance.turns_without_betrayal} 回合
                          </span>
                        </div>
                        <div class="flex justify-between">
                          <span class="text-amber-200/60">可用权限</span>
                          <span class="text-amber-300 text-xs">{trustInfo.description}</span>
                        </div>
                      </div>

                      {alliance.trust_level < 3 && (
                        <div class="mt-3 text-xs text-amber-200/50">
                          距离下次升级还需 {3 - (alliance.turns_without_betrayal % 3)} 回合
                        </div>
                      )}

                      {ally && (
                        <button
                          onClick={() => handleDissolveAlliance(ally.id)}
                          class="mt-3 w-full text-xs py-1.5 px-3 bg-red-800/50 hover:bg-red-700/60 text-red-200 rounded border border-red-600/40 transition-colors"
                        >
                          💔 解散联盟
                        </button>
                      )}
                    </div>
                  );
                }}
              </For>
            </Show>
          </Show>

          <Show when={selectedTab() === 'invites'}>
            <Show
              when={pendingInvites().length > 0}
              fallback={
                <div class="text-center py-12">
                  <span class="text-5xl mb-4 block">📭</span>
                  <p class="text-amber-200/60 text-sm">暂无待处理邀请</p>
                </div>
              }
            >
              <For each={pendingInvites()}>
                {(invite) => (
                  <div class="bg-stone-800/60 rounded-lg border border-brass/30 p-4">
                    <div class="flex items-center gap-3 mb-3">
                      <span class="text-3xl">📨</span>
                      <div class="flex-1">
                        <div class="font-bold text-amber-200">
                          {invite.from_player_name}
                        </div>
                        <div class="text-xs text-amber-200/60">
                          向你发送了联盟邀请
                        </div>
                      </div>
                    </div>

                    <div class="text-xs text-amber-200/50 mb-3">
                      第 {invite.created_at_turn} 回合发出 · 5 回合后过期
                    </div>

                    <div class="flex gap-2">
                      <button
                        onClick={() => handleAcceptInvite(invite.id)}
                        class="flex-1 py-2 px-3 bg-emerald-700/70 hover:bg-emerald-600/80 text-emerald-100 rounded border border-emerald-500/50 text-sm font-medium transition-colors"
                      >
                        ✅ 接受
                      </button>
                      <button
                        onClick={() => handleRejectInvite(invite.id)}
                        class="flex-1 py-2 px-3 bg-red-800/50 hover:bg-red-700/60 text-red-200 rounded border border-red-600/40 text-sm font-medium transition-colors"
                      >
                        ❌ 拒绝
                      </button>
                    </div>
                  </div>
                )}
              </For>
            </Show>
          </Show>

          <Show when={selectedTab() === 'invite'}>
            <p class="text-xs text-amber-200/60 mb-3">
              选择一位玩家发送联盟邀请
            </p>
            <Show
              when={otherPlayers().length > 0}
              fallback={
                <div class="text-center py-12">
                  <span class="text-5xl mb-4 block">👥</span>
                  <p class="text-amber-200/60 text-sm">没有可邀请的玩家</p>
                </div>
              }
            >
              <div class="space-y-2">
                <For each={otherPlayers()}>
                  {(player) => (
                    <div class="flex items-center justify-between bg-stone-800/60 rounded-lg border border-brass/30 p-3">
                      <div class="flex items-center gap-2">
                        <span
                          class="w-8 h-8 rounded-full border border-white/30"
                          style={{ background: player.color }}
                        />
                        <div>
                          <div class="text-sm font-medium text-amber-200">
                            {player.name}
                          </div>
                          <div class="text-xs text-amber-200/50">
                            财富: 💰{player.wealth}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleInvitePlayer(player.id)}
                        class="py-1.5 px-3 bg-amber-700/70 hover:bg-amber-600/80 text-amber-100 rounded border border-amber-500/50 text-xs font-medium transition-colors"
                      >
                        📨 邀请
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </div>

        <div class="p-3 border-t border-brass/30 bg-stone-900/50">
          <div class="text-xs text-amber-200/50 space-y-1">
            <p>💡 联盟建立时信任等级为 1，每连续 3 回合无背叛行为升一级</p>
            <p>⚠️ 攻击盟友或劫掠盟友商船视为背叛，联盟立即解散</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiplomacyPanel;
