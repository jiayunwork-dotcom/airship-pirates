import { For, Show, createMemo, createSignal } from 'solid-js';
import { useGameStore } from '../store/gameStore';
import type { Component } from 'solid-js';
import type { Alliance, Player, JointCombatProposal, Airship } from '../types/game';
import { JointCombatStatus } from '../types/game';

const TRUST_LEVEL_INFO = {
  1: { name: '基础同盟', color: 'text-emerald-400', description: '共享位置视野' },
  2: { name: '贸易协定', color: 'text-amber-400', description: '共享航路哨站收益' },
  3: { name: '联合指挥', color: 'text-purple-400', description: '可建议航向 & 联合作战' },
};

const COMBAT_STATUS_INFO: Record<JointCombatStatus, { label: string; color: string }> = {
  [JointCombatStatus.PENDING]: { label: '待确认', color: 'text-yellow-400' },
  [JointCombatStatus.CONFIRMED]: { label: '已确认', color: 'text-blue-400' },
  [JointCombatStatus.ACTIVE]: { label: '作战中', color: 'text-red-400' },
  [JointCombatStatus.COMPLETED]: { label: '已完成', color: 'text-emerald-400' },
  [JointCombatStatus.CANCELLED]: { label: '已取消', color: 'text-stone-400' },
  [JointCombatStatus.BETRAYED]: { label: '背叛', color: 'text-red-500' },
};

const DiplomacyPanel: Component = () => {
  const store = useGameStore();
  const [selectedTab, setSelectedTab] = createSignal<'alliances' | 'invites' | 'invite' | 'joint_combat'>('alliances');
  const [proposeTargetAlly, setProposeTargetAlly] = createSignal<string>('');
  const [proposeTargetPlayer, setProposeTargetPlayer] = createSignal<string>('');
  const [proposeAttackTurn, setProposeAttackTurn] = createSignal<number>(0);

  const currentTurn = createMemo(() => store.gameState?.turn || 0);

  const playerAlliances = createMemo(() => {
    if (!store.currentPlayer || !store.gameState) return [];
    const playerId = store.currentPlayer.id;
    return store.gameState.alliances.filter(
      (a) => a.active && (a.player_a_id === playerId || a.player_b_id === playerId)
    );
  });

  const tier3Alliances = createMemo(() => {
    return playerAlliances().filter((a) => a.trust_level >= 3);
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

  const enemyPlayers = createMemo(() => {
    if (!store.currentPlayer || !store.gameState) return [];
    const playerId = store.currentPlayer.id;
    const allyIds = new Set(store.currentPlayer.alliances);
    return store.gameState.players.filter(
      (p) => p.id !== playerId && !allyIds.has(p.id)
    );
  });

  const incomingJCProposals = createMemo(() => {
    if (!store.currentPlayer || !store.gameState) return [] as JointCombatProposal[];
    const pid = store.currentPlayer.id;
    return store.gameState.joint_combat_proposals.filter(
      (p) => p.ally_id === pid && p.status === JointCombatStatus.PENDING
    );
  });

  const activeJCProposals = createMemo(() => {
    if (!store.currentPlayer || !store.gameState) return [] as JointCombatProposal[];
    const pid = store.currentPlayer.id;
    return store.gameState.joint_combat_proposals.filter(
      (p) =>
        (p.proposer_id === pid || p.ally_id === pid) &&
        [JointCombatStatus.CONFIRMED, JointCombatStatus.ACTIVE, JointCombatStatus.COMPLETED, JointCombatStatus.BETRAYED, JointCombatStatus.CANCELLED].includes(p.status)
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

  const getPlayerInfo = (playerId: string): Player | undefined => {
    return store.gameState?.players.find((p) => p.id === playerId);
  };

  const getShipInfo = (shipId: string): Airship | undefined => {
    return store.gameState?.airships.find((a) => a.id === shipId);
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

  const handleConfirmJointCombat = (proposalId: string) => {
    store.confirmJointCombat(proposalId, true);
  };

  const handleRejectJointCombat = (proposalId: string) => {
    if (confirm('确定要拒绝这个联合作战提案吗？')) {
      store.confirmJointCombat(proposalId, false);
    }
  };

  const handleProposeJointCombat = () => {
    const allyId = proposeTargetAlly();
    const targetId = proposeTargetPlayer();
    const attackTurn = proposeAttackTurn();
    if (!allyId || !targetId || attackTurn <= currentTurn()) {
      alert('请选择有效的盟友、目标玩家和进攻回合（必须大于当前回合）');
      return;
    }
    store.proposeJointCombat(allyId, targetId, attackTurn);
    setProposeTargetAlly('');
    setProposeTargetPlayer('');
    setProposeAttackTurn(0);
  };

  const combatStatusBadge = (status: JointCombatStatus) => {
    const info = COMBAT_STATUS_INFO[status];
    return (
      <span class={`text-xs font-medium px-2 py-0.5 rounded ${info.color} bg-stone-900/60`}>
        {info.label}
      </span>
    );
  };

  return (
    <div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div class="bg-gradient-to-b from-amber-900/95 to-stone-800/95 border-2 border-brass rounded-lg shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col">
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

        <div class="flex border-b border-brass/30 flex-wrap">
          <button
            onClick={() => setSelectedTab('alliances')}
            class={`flex-1 py-2 px-3 text-xs sm:text-sm font-medium transition-colors min-w-[80px] ${
              selectedTab() === 'alliances'
                ? 'bg-amber-700/40 text-amber-200 border-b-2 border-amber-400'
                : 'text-amber-300/70 hover:text-amber-200 hover:bg-amber-700/20'
            }`}
          >
            我的联盟
          </button>
          <button
            onClick={() => setSelectedTab('joint_combat')}
            class={`flex-1 py-2 px-3 text-xs sm:text-sm font-medium transition-colors relative min-w-[90px] ${
              selectedTab() === 'joint_combat'
                ? 'bg-amber-700/40 text-amber-200 border-b-2 border-amber-400'
                : 'text-amber-300/70 hover:text-amber-200 hover:bg-amber-700/20'
            }`}
          >
            ⚔️ 联合作战
            {incomingJCProposals().length > 0 && (
              <span class="absolute top-1 right-2 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {incomingJCProposals().length}
              </span>
            )}
          </button>
          <button
            onClick={() => setSelectedTab('invites')}
            class={`flex-1 py-2 px-3 text-xs sm:text-sm font-medium transition-colors relative min-w-[90px] ${
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
            class={`flex-1 py-2 px-3 text-xs sm:text-sm font-medium transition-colors min-w-[80px] ${
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

          <Show when={selectedTab() === 'joint_combat'}>
            <div class="space-y-4">
              <div class="bg-purple-900/30 rounded-lg border border-purple-500/30 p-4">
                <h3 class="text-purple-200 font-bold mb-2 flex items-center gap-2">
                  ⚔️ 发起联合作战
                </h3>
                <p class="text-xs text-purple-300/70 mb-3">
                  需要信任等级 3（联合指挥）才能发起。双方从左右舷夹击目标，命中率 +30%；登舷战时双方船员合计投入。战利品按伤害比例分配。
                </p>

                <Show
                  when={tier3Alliances().length > 0}
                  fallback={
                    <div class="text-xs text-amber-200/50 py-2">
                      暂无可联合的盟友（需要与盟友达到信任等级 3）
                    </div>
                  }
                >
                  <div class="space-y-3">
                    <div>
                      <label class="block text-xs text-amber-200/80 mb-1">选择盟友</label>
                      <select
                        value={proposeTargetAlly()}
                        onInput={(e) => setProposeTargetAlly(e.currentTarget.value)}
                        class="w-full px-3 py-2 bg-stone-900/70 border border-brass/40 rounded text-amber-200 text-sm focus:outline-none focus:border-amber-400"
                      >
                        <option value="">— 选择盟友 —</option>
                        <For each={tier3Alliances()}>
                          {(alliance) => {
                            const ally = getAllyInfo(alliance);
                            return (
                              <option value={ally?.id || ''}>
                                {ally?.name || '未知'} (信任等级 {alliance.trust_level})
                              </option>
                            );
                          }}
                        </For>
                      </select>
                    </div>

                    <div>
                      <label class="block text-xs text-amber-200/80 mb-1">选择目标玩家</label>
                      <select
                        value={proposeTargetPlayer()}
                        onInput={(e) => setProposeTargetPlayer(e.currentTarget.value)}
                        class="w-full px-3 py-2 bg-stone-900/70 border border-brass/40 rounded text-amber-200 text-sm focus:outline-none focus:border-amber-400"
                      >
                        <option value="">— 选择目标 —</option>
                        <For each={enemyPlayers()}>
                          {(player) => (
                            <option value={player.id}>
                              {player.name} (💰{player.wealth})
                            </option>
                          )}
                        </For>
                      </select>
                    </div>

                    <div>
                      <label class="block text-xs text-amber-200/80 mb-1">
                        进攻回合（当前: {currentTurn()}，建议 1~3 回合后）
                      </label>
                      <input
                        type="number"
                        min={currentTurn() + 1}
                        value={proposeAttackTurn() || currentTurn() + 1}
                        onInput={(e) => setProposeAttackTurn(parseInt(e.currentTarget.value) || 0)}
                        class="w-full px-3 py-2 bg-stone-900/70 border border-brass/40 rounded text-amber-200 text-sm focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <button
                      onClick={handleProposeJointCombat}
                      disabled={!proposeTargetAlly() || !proposeTargetPlayer()}
                      class="w-full py-2 px-4 bg-purple-700/70 hover:bg-purple-600/80 disabled:bg-stone-700/50 disabled:text-stone-400 text-purple-100 disabled:text-stone-400 rounded border border-purple-500/50 disabled:border-stone-600/30 text-sm font-medium transition-colors"
                    >
                      📡 发送联合作战提案
                    </button>
                  </div>
                </Show>
              </div>

              <Show when={incomingJCProposals().length > 0}>
                <div>
                  <h3 class="text-yellow-300 font-bold mb-2 text-sm flex items-center gap-2">
                    📬 待确认的联合作战提案
                  </h3>
                  <div class="space-y-2">
                    <For each={incomingJCProposals()}>
                      {(proposal) => {
                        const proposer = getPlayerInfo(proposal.proposer_id);
                        const target = getPlayerInfo(proposal.target_player_id);
                        return (
                          <div class="bg-stone-800/60 rounded-lg border border-yellow-500/30 p-3">
                            <div class="flex items-center justify-between mb-2">
                              <div class="flex items-center gap-2">
                                <span
                                  class="w-8 h-8 rounded-full border border-white/30"
                                  style={{ background: proposer?.color || '#666' }}
                                />
                                <div>
                                  <div class="text-sm font-bold text-amber-200">
                                    {proposer?.name || '未知玩家'}
                                  </div>
                                  <div class="text-xs text-yellow-400">邀请你联合作战</div>
                                </div>
                              </div>
                              {combatStatusBadge(proposal.status)}
                            </div>
                            <div class="text-xs space-y-1 mb-3 text-amber-200/80">
                              <div class="flex justify-between">
                                <span>🎯 目标玩家</span>
                                <span class="text-red-300 font-medium">
                                  {target?.name || '未知'}
                                </span>
                              </div>
                              <div class="flex justify-between">
                                <span>⏰ 进攻回合</span>
                                <span class="font-mono text-amber-300">
                                  第 {proposal.attack_turn} 回合
                                </span>
                              </div>
                              <div class="flex justify-between">
                                <span>📅 提出时间</span>
                                <span class="font-mono text-stone-400">
                                  第 {proposal.created_at_turn} 回合
                                </span>
                              </div>
                            </div>
                            <div class="flex gap-2">
                              <button
                                onClick={() => handleConfirmJointCombat(proposal.id)}
                                class="flex-1 py-2 px-3 bg-emerald-700/70 hover:bg-emerald-600/80 text-emerald-100 rounded border border-emerald-500/50 text-xs font-medium transition-colors"
                              >
                                ✅ 确认参战
                              </button>
                              <button
                                onClick={() => handleRejectJointCombat(proposal.id)}
                                class="flex-1 py-2 px-3 bg-red-800/50 hover:bg-red-700/60 text-red-200 rounded border border-red-600/40 text-xs font-medium transition-colors"
                              >
                                ❌ 拒绝
                              </button>
                            </div>
                          </div>
                        );
                      }}
                    </For>
                  </div>
                </div>
              </Show>

              <Show when={activeJCProposals().length > 0}>
                <div>
                  <h3 class="text-blue-300 font-bold mb-2 text-sm flex items-center gap-2">
                    📋 联合作战记录
                  </h3>
                  <div class="space-y-2">
                    <For each={activeJCProposals()}>
                      {(proposal) => {
                        const proposer = getPlayerInfo(proposal.proposer_id);
                        const ally = getPlayerInfo(proposal.ally_id);
                        const target = getPlayerInfo(proposal.target_player_id);
                        const pShip = getShipInfo(proposal.proposer_ship_id);
                        const aShip = getShipInfo(proposal.ally_ship_id);
                        const tShip = getShipInfo(proposal.target_ship_id);
                        return (
                          <div class="bg-stone-800/60 rounded-lg border border-brass/30 p-3">
                            <div class="flex items-center justify-between mb-2">
                              <div class="text-xs font-bold text-amber-200">
                                {proposer?.name} &amp; {ally?.name}
                              </div>
                              {combatStatusBadge(proposal.status)}
                            </div>
                            <div class="text-xs space-y-1 text-amber-200/80">
                              <div class="flex justify-between">
                                <span>🎯 目标</span>
                                <span class="text-red-300">{target?.name || '未知'}</span>
                              </div>
                              <div class="flex justify-between">
                                <span>🚀 进攻方飞艇</span>
                                <span class="text-amber-300">
                                  {pShip?.name || 'N/A'} + {aShip?.name || 'N/A'}
                                </span>
                              </div>
                              <div class="flex justify-between">
                                <span>🛡️ 防守方飞艇</span>
                                <span class="text-red-300">{tShip?.name || 'N/A'}</span>
                              </div>
                              <div class="flex justify-between">
                                <span>⏰ 进攻回合</span>
                                <span class="font-mono text-amber-300">
                                  第 {proposal.attack_turn} 回合
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    </For>
                  </div>
                </div>
              </Show>

              <Show when={incomingJCProposals().length === 0 && activeJCProposals().length === 0 && tier3Alliances().length === 0}>
                <div class="text-center py-8">
                  <span class="text-4xl mb-3 block">⚔️</span>
                  <p class="text-amber-200/60 text-sm">暂无联合作战</p>
                  <p class="text-amber-200/40 text-xs mt-1">
                    达到信任等级 3 后可与盟友发起联合作战
                  </p>
                </div>
              </Show>
            </div>
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
            <p>⚠️ 攻击盟友、联合作战中逃离战区视为背叛，联盟立即解散</p>
            <p>⚔️ 信任等级 3 可发起联合作战：夹击命中率 +30%，登舷战力合计</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiplomacyPanel;
