import { For, Show, createSignal, createMemo, createEffect, onMount } from 'solid-js';
import { Battle, BattleAction, ShipModule, BattlePhase, ActionType, Airship } from '../types/game';
import type { Component } from 'solid-js';
import { useGameStore } from '../store/gameStore';

interface BattleScreenProps {
  battle: Battle;
  playerId: string;
  onClose: () => void;
  onSubmitAction: (action: BattleAction) => Promise<void>;
}

const BATTLE_PHASE_LABELS: Record<BattlePhase, string> = {
  initiation: '🎯 先手判定',
  ranged: '🔫 远程攻击',
  boarding: '⚔️ 登舷战斗',
  resolution: '📊 结算阶段',
  ended: '🏁 战斗结束',
};

interface ActionOption {
  type: ActionType;
  label: string;
  icon: string;
  description: string;
  phase: BattlePhase[];
  color: string;
}

const ACTION_OPTIONS: ActionOption[] = [
  {
    type: ActionType.ATTACK,
    label: '炮击',
    icon: '💥',
    description: '远程武器攻击，对船体/模块造成伤害',
    phase: [BattlePhase.RANGED],
    color: 'from-red-600 to-red-700',
  },
  {
    type: ActionType.BOARD,
    label: '登舷',
    icon: '⚔️',
    description: '派船员登上敌舰进行近身战斗',
    phase: [BattlePhase.BOARDING],
    color: 'from-purple-600 to-purple-700',
  },
  {
    type: ActionType.RETREAT,
    label: '撤退',
    icon: '🏃',
    description: '尝试脱离战斗，保存实力',
    phase: [BattlePhase.RANGED, BattlePhase.BOARDING, BattlePhase.RESOLUTION],
    color: 'from-gray-500 to-gray-600',
  },
];

const ShipDisplay: Component<{
  name: string;
  hp: number;
  maxHp: number;
  gasHp: number;
  gasMaxHp: number;
  color: string;
  morale: number;
  isAttacker: boolean;
  modules: ShipModule[];
  isGrappled: boolean;
  isCurrentTurn: boolean;
  onSelectModule?: (modType: string) => void;
  selectedModuleType?: string | null;
  showModules?: boolean;
}> = (props) => {
  const hpPercent = Math.max(0, Math.min(100, (props.hp / props.maxHp) * 100));
  const gasPercent = Math.max(0, Math.min(100, (props.gasHp / props.gasMaxHp) * 100));
  const moralePercent = Math.max(0, Math.min(100, props.morale));

  return (
    <div
      class={`flex-1 flex flex-col items-center p-4 rounded-xl border-3 transition-all ${
        props.isCurrentTurn ? 'border-amber-400 shadow-2xl shadow-amber-500/30 scale-[1.02]' : 'border-stone-700'
      }`}
      style={{
        background: `linear-gradient(180deg, ${props.color}22 0%, transparent 60%)`,
        'border-color': props.isCurrentTurn ? '#fbbf24' : undefined,
      }}
    >
      <div class="flex items-center gap-2 mb-2">
        <span
          class={`text-xs px-2 py-0.5 rounded text-white ${props.isAttacker ? 'bg-red-600' : 'bg-blue-600'}`}
        >
          {props.isAttacker ? '进攻方' : '防守方'}
        </span>
        {props.isGrappled && (
          <span class="text-xs px-2 py-0.5 rounded bg-orange-700 text-orange-100">
            🪝 接舷中
          </span>
        )}
      </div>

      <h3 class="text-xl font-bold text-amber-200 mb-3">{props.name}</h3>

      <div class="relative w-48 h-32 mb-4">
        <svg viewBox="0 0 200 120" class="w-full h-full drop-shadow-2xl" style={{ transform: props.isAttacker ? 'scaleX(-1)' : '' }}>
          <ellipse cx="100" cy="50" rx="80" ry="40" fill={props.color} stroke="#1c1917" stroke-width="2" opacity="0.9" />
          <ellipse cx="100" cy="45" rx="70" ry="30" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1" />
          <line x1="100" y1="90" x2="100" y2="60" stroke="#78350f" stroke-width="3" />
          <rect x="65" y="85" width="70" height="22" rx="5" fill="#92400e" stroke="#78350f" stroke-width="2" />
          <rect x="75" y="88" width="8" height="10" fill="#451a03" />
          <rect x="92" y="88" width="8" height="10" fill="#451a03" />
          <rect x="109" y="88" width="8" height="10" fill="#451a03" />
          <polygon points="100,30 125,55 75,55" fill="#ef4444" stroke="#7f1d1d" stroke-width="1" />
        </svg>
      </div>

      <div class="w-full max-w-xs space-y-2 mb-3">
        <div>
          <div class="flex justify-between text-xs text-amber-200/80 mb-0.5">
            <span>🛡️ 船体</span>
            <span class="font-mono">{props.hp} / {props.maxHp}</span>
          </div>
          <div class="status-bar">
            <div
              class={`status-bar-fill ${hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${hpPercent}%` }}
            />
          </div>
        </div>
        <div>
          <div class="flex justify-between text-xs text-amber-200/80 mb-0.5">
            <span>🎈 气囊</span>
            <span class="font-mono">{props.gasHp} / {props.gasMaxHp}</span>
          </div>
          <div class="status-bar">
            <div
              class={`status-bar-fill ${gasPercent > 50 ? 'bg-cyan-400' : gasPercent > 25 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${gasPercent}%` }}
            />
          </div>
        </div>
        <div>
          <div class="flex justify-between text-xs text-amber-200/80 mb-0.5">
            <span>😀 士气</span>
            <span class="font-mono">{props.morale}/100</span>
          </div>
          <div class="status-bar">
            <div
              class="status-bar-fill bg-yellow-500"
              style={{ width: `${moralePercent}%` }}
            />
          </div>
        </div>
      </div>

      <Show when={props.showModules}>
        <div class="w-full">
          <div class="text-xs text-amber-300 font-bold mb-1">
            选择攻击目标模块:
          </div>
          <div class="grid grid-cols-3 gap-1.5">
            <For each={props.modules}>
              {(mod, idx) => {
                const mHpPct = (mod.durability / mod.max_durability) * 100;
                const moduleKey = `${mod.module_type}_${idx()}`;
                const isSelected = props.selectedModuleType === moduleKey;
                return (
                  <button
                    onClick={() => props.onSelectModule?.(moduleKey)}
                    class={`p-1.5 rounded border text-left text-xs transition-all ${
                      isSelected
                        ? 'border-red-400 bg-red-900/40 ring-2 ring-red-500/50'
                        : 'border-stone-600 bg-stone-800/60 hover:border-stone-400'
                    }`}
                  >
                    <div class="font-bold text-amber-200 truncate">{mod.name}</div>
                    <div class="h-1 mt-1 bg-stone-700 rounded-full overflow-hidden">
                      <div
                        class={`h-full rounded-full ${mHpPct > 50 ? 'bg-green-500' : mHpPct > 25 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${mHpPct}%` }}
                      />
                    </div>
                  </button>
                );
              }}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
};

const BattleScreen: Component<BattleScreenProps> = (props) => {
  const store = useGameStore();
  const [selectedAction, setSelectedAction] = createSignal<ActionType | null>(null);
  const [selectedTargetModule, setSelectedTargetModule] = createSignal<string | null>(null);
  const [power, setPower] = createSignal(100);
  const [logRef, setLogRef] = createSignal<HTMLDivElement | null>(null);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [view, setView] = createSignal<'combat' | 'boarding'>('combat');

  const attackerShip = createMemo<Airship | undefined>(() => {
    return store.gameState?.airships.find((a) => a.id === props.battle.ship_a_id);
  });

  const defenderShip = createMemo<Airship | undefined>(() => {
    return store.gameState?.airships.find((a) => a.id === props.battle.ship_b_id);
  });

  const isAttacker = createMemo(() => attackerShip()?.player_id === props.playerId);
  const isDefender = createMemo(() => defenderShip()?.player_id === props.playerId);
  const isParticipant = createMemo(() => isAttacker() || isDefender());

  const currentTurnPlayerId = createMemo(() => {
    const attacker = attackerShip();
    const defender = defenderShip();
    if (!attacker || !defender) return null;
    return props.battle.turn % 2 === 1 ? attacker.player_id : defender.player_id;
  });

  const isMyTurn = createMemo(() => currentTurnPlayerId() === props.playerId);

  const isGrappled = createMemo(() => props.battle.phase === BattlePhase.BOARDING);

  const availableActions = createMemo(() => {
    return ACTION_OPTIONS.filter((a) => a.phase.includes(props.battle.phase));
  });

  createEffect(() => {
    if (logRef()) {
      logRef()!.scrollTop = logRef()!.scrollHeight;
    }
  });

  onMount(() => {
    if (props.battle.phase === BattlePhase.BOARDING) {
      setView('boarding');
    }
  });

  const handleSubmit = async () => {
    if (!selectedAction() || !isParticipant() || !isMyTurn()) return;

    const action: BattleAction = {
      type: selectedAction()!,
      target_module: selectedTargetModule() ? selectedTargetModule()!.split('_')[0] as any : null,
      weapon_type: null,
      target_ship_id: isAttacker() ? defenderShip()?.id || null : attackerShip()?.id || null,
      params: { power: power() },
    };

    setIsSubmitting(true);
    try {
      await props.onSubmitAction(action);
      setSelectedAction(null);
      setSelectedTargetModule(null);
      setPower(100);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div class="modal-overlay z-[100]">
      <div class="steampunk-panel w-[95vw] max-w-6xl p-0 overflow-hidden flex flex-col max-h-[95vh]">
        <div class="bg-gradient-to-r from-red-900 via-amber-900 to-blue-900 p-4 border-b-2 border-brass">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-2xl font-bold text-amber-100 flex items-center gap-3">
                ⚔️ 激烈海战
                <span class="text-sm font-normal bg-red-700/80 px-2 py-0.5 rounded">
                  {BATTLE_PHASE_LABELS[props.battle.phase]}
                </span>
              </h2>
              <div class="text-sm text-amber-200/80 mt-1 flex items-center gap-4">
                <span>回合: <span class="font-bold font-mono text-amber-300">{props.battle.turn}</span></span>
                <span>
                  当前:
                  <span class={`font-bold ml-1 ${isMyTurn() ? 'text-green-400' : 'text-amber-300'}`}>
                    {isMyTurn() ? '你的回合' : '对方回合'}
                  </span>
                </span>
                {isGrappled() && (
                  <span class="text-orange-300">🪝 已接舷</span>
                )}
              </div>
            </div>
            <div class="flex items-center gap-2">
              <Show when={props.battle.phase === BattlePhase.BOARDING}>
                <button
                  onClick={() => setView(view() === 'combat' ? 'boarding' : 'combat')}
                  class="steampunk-button text-sm py-1"
                >
                  {view() === 'combat' ? '🏴‍☠️ 查看登舷' : '🚁 返回战斗'}
                </button>
              </Show>
              <button
                onClick={props.onClose}
                class="w-9 h-9 flex items-center justify-center rounded bg-stone-700/60 hover:bg-red-800 text-amber-200 text-xl transition-colors"
                title="关闭"
              >
                ×
              </button>
            </div>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto scrollbar-steampunk p-4">
          <Show when={view() === 'combat'}>
            <div class="flex items-stretch gap-4 mb-4">
              <Show when={attackerShip()}>
                <ShipDisplay
                  name={attackerShip()!.name}
                  hp={attackerShip()!.hp}
                  maxHp={attackerShip()!.max_hp}
                  gasHp={attackerShip()!.gas_balloon.durability}
                  gasMaxHp={attackerShip()!.gas_balloon.max_durability}
                  morale={props.battle.ship_a_morale}
                  color="#ef4444"
                  isAttacker={true}
                  modules={attackerShip()!.modules}
                  isGrappled={isGrappled()}
                  isCurrentTurn={isAttacker() && isMyTurn()}
                />
              </Show>

              <div class="flex flex-col items-center justify-center px-2 shrink-0">
                <div class="text-5xl mb-2 animate-pulse">VS</div>
                <div class="text-4xl animate-bounce">💥</div>
              </div>

              <Show when={defenderShip()}>
                <ShipDisplay
                  name={defenderShip()!.name}
                  hp={defenderShip()!.hp}
                  maxHp={defenderShip()!.max_hp}
                  gasHp={defenderShip()!.gas_balloon.durability}
                  gasMaxHp={defenderShip()!.gas_balloon.max_durability}
                  morale={props.battle.ship_b_morale}
                  color="#3b82f6"
                  isAttacker={false}
                  modules={defenderShip()!.modules}
                  isGrappled={isGrappled()}
                  isCurrentTurn={isDefender() && isMyTurn()}
                  showModules={
                    isParticipant() &&
                    isMyTurn() &&
                    selectedAction() === ActionType.ATTACK
                  }
                  selectedModuleType={selectedTargetModule()}
                  onSelectModule={(modType) => setSelectedTargetModule(modType)}
                />
              </Show>
            </div>

            <Show when={isParticipant()}>
              <div class="steampunk-panel p-4 mb-4">
                <h3 class="text-amber-300 font-bold mb-3 flex items-center gap-2">
                  🎯 选择战斗行动
                </h3>
                <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                  <For each={availableActions()}>
                    {(action) => {
                      const isSelected = selectedAction() === action.type;
                      return (
                        <button
                          onClick={() => setSelectedAction(isSelected ? null : action.type)}
                          disabled={!isMyTurn()}
                          class={`p-3 rounded-lg border-2 text-left transition-all ${
                            isSelected
                              ? 'border-amber-400 bg-amber-900/40 ring-2 ring-amber-400/50'
                              : 'border-stone-600 bg-stone-800/60 hover:border-brass/70'
                          } ${!isMyTurn() ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <div class="flex items-center gap-2 mb-1">
                            <span class="text-2xl">{action.icon}</span>
                            <span class="font-bold text-amber-200">{action.label}</span>
                          </div>
                          <p class="text-xs text-amber-200/70">{action.description}</p>
                        </button>
                      );
                    }}
                  </For>
                </div>

                <Show when={selectedAction()}>
                  <div class="flex flex-wrap items-center gap-4 p-3 bg-stone-900/60 rounded-lg border border-brass/30">
                    <div class="flex-1 min-w-[200px]">
                      <div class="flex justify-between text-xs text-amber-200/80 mb-1">
                        <span>⚡ 攻击强度</span>
                        <span class="font-mono text-amber-300">{power()}%</span>
                      </div>
                      <input
                        type="range"
                        min={25}
                        max={100}
                        value={power()}
                        onInput={(e) => setPower(Number(e.currentTarget.value))}
                        class="w-full accent-brass"
                      />
                    </div>
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting() || !isMyTurn()}
                      class="steampunk-button bg-gradient-to-b from-red-600 to-red-700 border-red-500 hover:from-red-500 hover:to-red-600 text-lg"
                    >
                      {isSubmitting() ? '执行中...' : `⚡ 执行 ${ACTION_OPTIONS.find(a => a.type === selectedAction())?.label || ''}`}
                    </button>
                  </div>
                </Show>

                <Show when={!isMyTurn()}>
                  <div class="text-center py-3 text-amber-200/70 animate-pulse">
                    ⏳ 等待对方行动...
                  </div>
                </Show>
              </div>
            </Show>
          </Show>

          <Show when={view() === 'boarding'}>
            <div class="steampunk-panel p-4 mb-4">
              <h3 class="text-xl font-bold text-amber-300 mb-4 flex items-center gap-2">
                🏴‍☠️ 登舷战斗 - 船舱争夺战
              </h3>
              <div class="grid md:grid-cols-2 gap-4">
                <div class="p-3 bg-stone-800/50 rounded-lg border border-red-900/50">
                  <div class="text-red-300 font-bold mb-3 flex items-center gap-2">
                    <span class="w-3 h-3 rounded-full bg-red-500" />
                    {attackerShip()?.name || '进攻方'} - 登船队
                  </div>
                  <div class="grid grid-cols-3 gap-2">
                    <For each={['舰桥', '货舱', '动力室', '船员舱', '弹药库', '气囊室']}>
                      {(room, i) => (
                        <div
                          class={`p-3 rounded border text-center text-xs ${
                            i() % 3 === 0
                              ? 'bg-red-900/40 border-red-500/50'
                              : 'bg-stone-800/60 border-stone-600/50'
                          }`}
                        >
                          <div class="text-lg mb-1">
                            {room === '舰桥' ? '🎯' : room === '货舱' ? '📦' : room === '动力室' ? '⚙️' : room === '船员舱' ? '🛏️' : room === '弹药库' ? '💣' : '🎈'}
                          </div>
                          <div class="text-amber-200 font-bold">{room}</div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>

                <div class="p-3 bg-stone-800/50 rounded-lg border border-blue-900/50">
                  <div class="text-blue-300 font-bold mb-3 flex items-center gap-2">
                    <span class="w-3 h-3 rounded-full bg-blue-500" />
                    {defenderShip()?.name || '防守方'} - 守卫队
                  </div>
                  <div class="grid grid-cols-3 gap-2">
                    <For each={['舰桥', '货舱', '动力室', '船员舱', '弹药库', '气囊室']}>
                      {(room, i) => (
                        <div
                          class={`p-3 rounded border text-center text-xs ${
                            i() % 2 === 1
                              ? 'bg-blue-900/40 border-blue-500/50'
                              : 'bg-stone-800/60 border-stone-600/50'
                          }`}
                        >
                          <div class="text-lg mb-1">
                            {room === '舰桥' ? '🎯' : room === '货舱' ? '📦' : room === '动力室' ? '⚙️' : room === '船员舱' ? '🛏️' : room === '弹药库' ? '💣' : '🎈'}
                          </div>
                          <div class="text-amber-200 font-bold">{room}</div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </div>
            </div>
          </Show>

          <div class="steampunk-panel p-4">
            <h3 class="text-amber-300 font-bold mb-3 flex items-center gap-2">
              📜 战斗日志
            </h3>
            <div
              ref={setLogRef}
              class="h-40 overflow-y-auto scrollbar-steampunk space-y-1.5 text-sm"
            >
              <For each={props.battle.log}>
                {(entry, idx) => (
                  <div
                    class="p-2 bg-stone-900/60 rounded border-l-4 border-stone-500"
                  >
                    <div class="flex items-center gap-2 text-xs text-amber-200/50 mb-0.5">
                      <span>回合 {idx() + 1}</span>
                    </div>
                    <div class="text-amber-100">
                      {entry}
                    </div>
                  </div>
                )}
              </For>
              <Show when={props.battle.log.length === 0}>
                <div class="text-center text-amber-200/40 py-8">
                  战斗即将开始...
                </div>
              </Show>
            </div>
          </div>
        </div>

        <Show when={props.battle.phase === BattlePhase.ENDED}>
          <div class="bg-gradient-to-r from-amber-800 to-amber-900 p-4 border-t-2 border-brass text-center">
            <div class="text-2xl font-bold text-amber-100 mb-2">
              🏁 战斗结束！
            </div>
            <button
              onClick={props.onClose}
              class="steampunk-button text-lg"
            >
              返回战场
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default BattleScreen;
