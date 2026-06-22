import { For, Show, createSignal, createMemo } from 'solid-js';
import type { BattleReport, BattleActionRecord } from '../types/game';
import type { Component } from 'solid-js';
import { useGameStore } from '../store/gameStore';

const ACTION_ICONS: Record<string, string> = {
  attack: '💥',
  fire: '🔥',
  fire_damage: '🔥',
  fire_extinguish: '🧯',
  smoke_screen: '💨',
  smoke_dissipate: '💨',
  board: '⚔️',
  board_initiate: '🏴‍☠️',
  board_repelled: '🛡️',
  capture: '⚓',
  sink: '💀',
  balloon_destroyed: '🎈',
  retreat: '🏃',
  retreat_fail: '❌',
  deflect: '🛡️',
};

const RESULT_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  sink: { label: '击沉', icon: '💀', color: 'text-red-400' },
  capture: { label: '俘获', icon: '⚓', color: 'text-purple-400' },
  victory: { label: '胜利', icon: '🏆', color: 'text-green-400' },
  draw: { label: '平局', icon: '🤝', color: 'text-gray-400' },
  ongoing: { label: '进行中', icon: '⚔️', color: 'text-amber-400' },
};

const MODULE_LABELS: Record<string, string> = {
  balloon: '气囊',
  cockpit: '舰桥',
  gun_deck: '炮甲板',
  engine: '引擎',
  cargo: '货舱',
  any: '船体',
};

const CATEGORY_STYLES: Record<string, { border: string; bg: string; text: string }> = {
  attack: { border: 'border-red-500', bg: 'bg-red-900/30', text: 'text-red-300' },
  defense: { border: 'border-blue-500', bg: 'bg-blue-900/30', text: 'text-blue-300' },
  neutral: { border: 'border-gray-500', bg: 'bg-gray-900/30', text: 'text-gray-300' },
};

const ActionRecordItem: Component<{
  record: BattleActionRecord;
  index: number;
}> = (props) => {
  const icon = createMemo(() => ACTION_ICONS[props.record.action_type] || '📋');
  const catStyle = createMemo(() => CATEGORY_STYLES[props.record.category] || CATEGORY_STYLES.neutral);
  const moduleLabel = createMemo(() => MODULE_LABELS[props.record.target_module] || props.record.target_module);

  const description = createMemo(() => {
    const r = props.record;
    if (r.action_type === 'attack' && !r.hit) {
      if (r.special_effect === 'smoke_screen_miss') return `${r.attacker_ship_name} 攻击被烟幕遮挡！`;
      if (r.special_effect === 'deflect') return `${r.defender_ship_name} 偏转了攻击！`;
      return `${r.attacker_ship_name} 攻击未命中 ${r.defender_ship_name}`;
    }
    if (r.action_type === 'attack' && r.hit) {
      return `${r.attacker_ship_name} → ${r.defender_ship_name} 的${moduleLabel()}，造成 ${r.damage} 伤害`;
    }
    if (r.action_type === 'fire' || r.action_type === 'fire_damage') {
      return `${r.defender_ship_name} 的气囊着火！受到 ${r.damage} 燃烧伤害`;
    }
    if (r.action_type === 'fire_extinguish') {
      return `${r.defender_ship_name} 的船员扑灭了火灾！`;
    }
    if (r.action_type === 'smoke_screen') {
      return `${r.attacker_ship_name} 释放了烟幕！`;
    }
    if (r.action_type === 'smoke_dissipate') {
      return '烟幕消散';
    }
    if (r.action_type === 'board_initiate') {
      return `${r.attacker_ship_name} 发起登舷！`;
    }
    if (r.action_type === 'board') {
      return `登舷战斗 ${r.special_effect}`;
    }
    if (r.action_type === 'capture') {
      return `${r.attacker_ship_name} 俘获了 ${r.defender_ship_name}！`;
    }
    if (r.action_type === 'board_repelled') {
      return `${r.defender_ship_name} 成功抵御了登舷！`;
    }
    if (r.action_type === 'sink') {
      return `${r.defender_ship_name} 被击沉！`;
    }
    if (r.action_type === 'balloon_destroyed') {
      return `${r.defender_ship_name} 的气囊被摧毁！`;
    }
    if (r.action_type === 'retreat') {
      return `${r.attacker_ship_name} 成功撤退`;
    }
    if (r.action_type === 'retreat_fail') {
      return `${r.attacker_ship_name} 撤退失败！`;
    }
    return `${r.attacker_ship_name || '系统'} → ${r.defender_ship_name || ''} ${r.special_effect || r.action_type}`;
  });

  return (
    <div
      class={`flex items-start gap-2 p-2 rounded border-l-4 ${catStyle().border} ${catStyle().bg} transition-all duration-300`}
      style={{ 'animation-delay': `${props.index * 50}ms` }}
    >
      <span class="text-lg shrink-0 mt-0.5">{icon()}</span>
      <div class="flex-1 min-w-0">
        <div class={`text-xs ${catStyle().text}`}>
          <span class="opacity-60 font-mono mr-1">回合{props.record.turn}</span>
          {description()}
        </div>
        <Show when={props.record.damage > 0 && props.record.hit}>
          <div class="mt-1 h-1.5 bg-stone-700 rounded-full overflow-hidden max-w-[120px]">
            <div
              class="h-full bg-red-500 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (props.record.damage / 100) * 100)}%`,
              }}
            />
          </div>
        </Show>
      </div>
    </div>
  );
};

const BattleReportDetail: Component<{
  report: BattleReport;
  onBack: () => void;
  playerId: string;
}> = (props) => {
  const store = useGameStore();

  const attackerPlayer = createMemo(() => {
    return store.gameState?.players.find(p => p.id === props.report.attacker_player_id);
  });

  const defenderPlayer = createMemo(() => {
    return store.gameState?.players.find(p => p.id === props.report.defender_player_id);
  });

  const resultInfo = createMemo(() => RESULT_LABELS[props.report.result] || RESULT_LABELS.ongoing);

  const totalDamageToAttacker = createMemo(() => {
    return props.report.action_records
      .filter(r => r.defender_ship_id === props.report.attacker_ship_id && r.damage > 0)
      .reduce((sum, r) => sum + r.damage, 0);
  });

  const totalDamageToDefender = createMemo(() => {
    return props.report.action_records
      .filter(r => r.defender_ship_id === props.report.defender_ship_id && r.damage > 0)
      .reduce((sum, r) => sum + r.damage, 0);
  });

  const maxDamage = createMemo(() => {
    return Math.max(totalDamageToAttacker(), totalDamageToDefender(), 1);
  });

  return (
    <div class="flex flex-col h-full">
      <div class="flex items-center gap-2 mb-3">
        <button
          onClick={props.onBack}
          class="text-amber-200 hover:text-amber-100 text-sm flex items-center gap-1 shrink-0"
        >
          ← 返回列表
        </button>
        <div class="h-4 w-px bg-brass/40" />
        <span class="text-amber-300 font-bold text-sm truncate">
          战报详情
        </span>
      </div>

      <div class="p-3 bg-stone-900/60 rounded-lg border border-brass/30 mb-3">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span
              class="w-3 h-3 rounded-full shrink-0"
              style={{ background: attackerPlayer()?.color || '#ef4444' }}
            />
            <span class="text-red-300 text-sm font-bold truncate max-w-[80px]">
              {props.report.attacker_ship_name}
            </span>
          </div>
          <span class="text-amber-200/60 text-xs">VS</span>
          <div class="flex items-center gap-2">
            <span class="text-blue-300 text-sm font-bold truncate max-w-[80px]">
              {props.report.defender_ship_name}
            </span>
            <span
              class="w-3 h-3 rounded-full shrink-0"
              style={{ background: defenderPlayer()?.color || '#3b82f6' }}
            />
          </div>
        </div>
        <div class="flex items-center justify-center gap-2 mb-2">
          <span class={`font-bold text-sm ${resultInfo().color}`}>
            {resultInfo().icon} {resultInfo().label}
          </span>
          <span class="text-amber-200/50 text-xs">|</span>
          <span class="text-amber-200/70 text-xs">持续 {props.report.duration_turns} 回合</span>
          <Show when={props.report.winner_ship_name}>
            <span class="text-amber-200/50 text-xs">|</span>
            <span class="text-amber-300 text-xs">胜者: {props.report.winner_ship_name}</span>
          </Show>
        </div>

        <div class="grid grid-cols-2 gap-3 mt-3">
          <div class="text-center">
            <div class="text-[10px] text-red-300/70 mb-1">对敌伤害</div>
            <div class="text-red-400 font-bold font-mono text-sm">{totalDamageToDefender()}</div>
            <div class="h-1.5 bg-stone-700 rounded-full overflow-hidden mt-1">
              <div
                class="h-full bg-red-500 rounded-full transition-all duration-500"
                style={{ width: `${(totalDamageToDefender() / maxDamage()) * 100}%` }}
              />
            </div>
          </div>
          <div class="text-center">
            <div class="text-[10px] text-blue-300/70 mb-1">承受伤害</div>
            <div class="text-blue-400 font-bold font-mono text-sm">{totalDamageToAttacker()}</div>
            <div class="h-1.5 bg-stone-700 rounded-full overflow-hidden mt-1">
              <div
                class="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${(totalDamageToAttacker() / maxDamage()) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto scrollbar-steampunk space-y-1.5 min-h-0">
        <For each={props.report.action_records}>
          {(record, idx) => (
            <ActionRecordItem record={record} index={idx()} />
          )}
        </For>
        <Show when={props.report.action_records.length === 0}>
          <div class="text-center text-amber-200/40 py-6 text-sm">
            暂无行动记录
          </div>
        </Show>
      </div>
    </div>
  );
};

const BattleReportSummary: Component<{
  report: BattleReport;
  onClick: () => void;
  playerId: string;
}> = (props) => {
  const store = useGameStore();

  const isRelated = createMemo(() => {
    return props.report.attacker_player_id === props.playerId ||
           props.report.defender_player_id === props.playerId;
  });

  const resultInfo = createMemo(() => RESULT_LABELS[props.report.result] || RESULT_LABELS.ongoing);

  const attackerPlayer = createMemo(() => {
    return store.gameState?.players.find(p => p.id === props.report.attacker_player_id);
  });

  const defenderPlayer = createMemo(() => {
    return store.gameState?.players.find(p => p.id === props.report.defender_player_id);
  });

  const playerWon = createMemo(() => {
    return props.report.winner_player_id === props.playerId;
  });

  const borderClass = createMemo(() => {
    if (props.report.is_sink || props.report.is_capture) {
      return 'ring-2 ring-yellow-500/70 border-yellow-500/50';
    }
    if (playerWon()) {
      return 'border-green-500/30';
    }
    return 'border-brass/30';
  });

  return (
    <button
      onClick={props.onClick}
      class={`w-full text-left p-2.5 bg-stone-900/60 rounded-lg border ${borderClass()} hover:bg-stone-800/80 transition-all duration-200 relative overflow-hidden`}
    >
      <Show when={props.report.is_sink || props.report.is_capture}>
        <div class="absolute top-0 right-0 bg-yellow-500/20 text-yellow-400 text-[9px] px-1.5 py-0.5 rounded-bl font-bold">
          {props.report.is_sink ? '💀 击沉' : '⚓ 俘获'}
        </div>
      </Show>

      <div class="flex items-center gap-1.5 mb-1.5">
        <span
          class="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ background: attackerPlayer()?.color || '#ef4444' }}
        />
        <span class="text-red-300 text-xs font-bold truncate max-w-[70px]">
          {props.report.attacker_ship_name}
        </span>
        <span class="text-amber-200/40 text-[10px]">vs</span>
        <span class="text-blue-300 text-xs font-bold truncate max-w-[70px]">
          {props.report.defender_ship_name}
        </span>
        <span
          class="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ background: defenderPlayer()?.color || '#3b82f6' }}
        />
      </div>

      <div class="flex items-center justify-between">
        <span class={`text-xs font-bold ${resultInfo().color}`}>
          {resultInfo().icon} {resultInfo().label}
        </span>
        <span class="text-[10px] text-amber-200/50">
          {props.report.duration_turns}回合 · 第{props.report.turn_number}轮
        </span>
      </div>

      <Show when={isRelated()}>
        <div class="mt-1">
          <span class={`text-[10px] px-1.5 py-0.5 rounded ${playerWon() ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'}`}>
            {playerWon() ? '✓ 胜方' : '✗ 败方'}
          </span>
        </div>
      </Show>
    </button>
  );
};

const BattleReportPanel: Component = () => {
  const store = useGameStore();
  const [isCollapsed, setIsCollapsed] = createSignal(true);
  const [selectedReportId, setSelectedReportId] = createSignal<string | null>(null);
  const [filterMine, setFilterMine] = createSignal(false);

  const reports = createMemo(() => {
    if (!store.gameState?.battle_reports) return [];
    return [...store.gameState.battle_reports].reverse().slice(0, 5);
  });

  const filteredReports = createMemo(() => {
    const pid = store.currentPlayer?.id;
    if (!pid) return reports();
    if (!filterMine()) return reports();
    return reports().filter(
      r => r.attacker_player_id === pid || r.defender_player_id === pid
    );
  });

  const selectedReport = createMemo(() => {
    const id = selectedReportId();
    if (!id || !store.gameState?.battle_reports) return null;
    return store.gameState.battle_reports.find(r => r.id === id) || null;
  });

  const hasReports = createMemo(() => reports().length > 0);
  const newReportCount = createMemo(() => reports().length);

  const playerId = createMemo(() => store.currentPlayer?.id || '');

  return (
    <Show when={hasReports()}>
      <div
        class="fixed bottom-4 right-4 z-30 transition-all duration-300 ease-in-out"
        style={{
          'max-width': isCollapsed() ? '200px' : '380px',
          'max-height': isCollapsed() ? '48px' : '520px',
        }}
      >
        <Show when={isCollapsed()}>
          <button
            onClick={() => setIsCollapsed(false)}
            class="flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-xl transition-all duration-300 hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, rgba(120,53,15,0.95), rgba(68,64,60,0.95))',
              border: '2px solid #b58863',
            }}
          >
            <span class="text-lg">📜</span>
            <span class="text-amber-200 font-bold text-sm">最近战报</span>
            <span class="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
              {newReportCount()}
            </span>
          </button>
        </Show>

        <Show when={!isCollapsed()}>
          <div
            class="rounded-lg shadow-2xl overflow-hidden flex flex-col"
            style={{
              'max-height': '520px',
              background: 'linear-gradient(180deg, rgba(120,53,15,0.95), rgba(41,37,36,0.98))',
              border: '2px solid #b58863',
            }}
          >
            <div class="flex items-center justify-between px-3 py-2 border-b border-brass/40">
              <div class="flex items-center gap-2">
                <span class="text-lg">📜</span>
                <span class="text-amber-200 font-bold text-sm">最近战报</span>
              </div>
              <div class="flex items-center gap-2">
                <button
                  onClick={() => setFilterMine(!filterMine())}
                  class={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                    filterMine()
                      ? 'border-amber-400 bg-amber-800/50 text-amber-200'
                      : 'border-stone-600 bg-stone-700/50 text-amber-200/50 hover:text-amber-200/80'
                  }`}
                >
                  {filterMine() ? '👤 仅我的' : '👥 全部'}
                </button>
                <button
                  onClick={() => {
                    setIsCollapsed(true);
                    setSelectedReportId(null);
                  }}
                  class="text-amber-200/60 hover:text-amber-200 text-lg leading-none"
                >
                  ×
                </button>
              </div>
            </div>

            <div class="flex-1 overflow-y-auto scrollbar-steampunk p-2 min-h-0" style={{ 'max-height': '460px' }}>
              <Show
                when={!selectedReport()}
                fallback={
                  <BattleReportDetail
                    report={selectedReport()!}
                    onBack={() => setSelectedReportId(null)}
                    playerId={playerId()}
                  />
                }
              >
                <div class="space-y-2">
                  <For each={filteredReports()}>
                    {(report) => (
                      <BattleReportSummary
                        report={report}
                        onClick={() => setSelectedReportId(report.id)}
                        playerId={playerId()}
                      />
                    )}
                  </For>
                  <Show when={filteredReports().length === 0}>
                    <div class="text-center text-amber-200/40 py-6 text-sm">
                      {filterMine() ? '没有与你相关的战报' : '暂无战报'}
                    </div>
                  </Show>
                </div>
              </Show>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  );
};

export default BattleReportPanel;
