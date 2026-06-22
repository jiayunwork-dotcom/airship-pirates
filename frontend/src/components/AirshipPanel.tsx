import { For, Show, createSignal, createMemo } from 'solid-js';
import type { Airship, ShipModule, GasType, AltitudeLevel, CrewMember, CargoItem, ModuleType, CrewRole } from '../types/game';
import type { Component } from 'solid-js';
import { useGameStore } from '../store/gameStore';

interface AirshipPanelProps {
  airship: Airship;
  playerColor?: string;
  onClose?: () => void;
  onModify?: () => void;
}

const MODULE_ICONS: Record<ModuleType, string> = {
  cockpit: '🎯',
  gun_deck: '💥',
  cargo: '📦',
  engine: '⚙️',
  repair: '🔧',
  lookout: '👁️',
};

const MODULE_NAMES: Record<ModuleType, string> = {
  cockpit: '驾驶舱',
  gun_deck: '火炮甲板',
  cargo: '货舱',
  engine: '引擎',
  repair: '维修舱',
  lookout: '瞭望台',
};

const ALTITUDE_LABELS: Record<AltitudeLevel, string> = {
  low: '低空',
  medium: '中空',
  high: '高空',
  extreme: '极高',
};

const GAS_LABELS: Record<GasType, string> = {
  hydrogen: '氢气',
  helium: '氦气',
  hot_air: '热空气',
  methane: '甲烷',
};

const CREW_ROLE_NAMES: Record<CrewRole, string> = {
  captain: '船长',
  pilot: '飞行员',
  gunner: '炮手',
  engineer: '工程师',
  navigator: '航海士',
  medic: '医疗兵',
  marine: '陆战队员',
  crewman: '水手',
};

const ROLE_COLORS: Record<CrewRole, string> = {
  captain: 'bg-amber-600',
  pilot: 'bg-sky-600',
  gunner: 'bg-red-600',
  engineer: 'bg-purple-600',
  navigator: 'bg-blue-600',
  medic: 'bg-green-600',
  marine: 'bg-orange-600',
  crewman: 'bg-stone-600',
};

const StatusBar: Component<{
  value: number;
  max: number;
  label: string;
  color: string;
  icon?: string;
}> = (props) => {
  const percent = Math.max(0, Math.min(100, (props.value / props.max) * 100));
  return (
    <div>
      <div class="flex items-center justify-between text-xs text-amber-200/80 mb-1">
        <span>
          {props.icon && <span class="mr-1">{props.icon}</span>}
          {props.label}
        </span>
        <span class="font-mono">{props.value} / {props.max}</span>
      </div>
      <div class="status-bar">
        <div
          class={`status-bar-fill ${props.color}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

const ModuleCard: Component<{ module: ShipModule; index: number }> = (props) => {
  const [showDetail, setShowDetail] = createSignal(false);
  const hpPercent = (props.module.durability / props.module.max_durability) * 100;
  const isDamaged = hpPercent < 50;

  return (
    <div
      class={`relative p-2 rounded border-2 cursor-pointer transition-all
        ${isDamaged ? 'border-red-500 bg-red-900/20' : 'border-brass/50 bg-stone-800/60'}
        hover:border-brass hover:bg-stone-700/60`}
      onClick={() => setShowDetail(!showDetail())}
      title={props.module.name}
    >
      <div class="flex flex-col items-center gap-1">
        <span class="text-2xl">{MODULE_ICONS[props.module.module_type] || '❓'}</span>
        <span class="text-[10px] text-amber-200 font-semibold truncate w-full text-center">
          {props.module.name}
        </span>
        <span class="text-[9px] text-amber-200/60">Lv.{props.module.level}</span>
      </div>
      <div class="mt-1 h-1 bg-stone-700 rounded-full overflow-hidden">
        <div
          class={`h-full rounded-full ${hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500'}`}
          style={{ width: `${hpPercent}%` }}
        />
      </div>
      <Show when={showDetail()}>
        <div class="absolute top-full left-0 right-0 mt-1 p-2 bg-stone-900/95 border border-brass rounded z-20 text-xs">
          <div class="font-bold text-amber-300 mb-1">{props.module.name}</div>
          <div class="text-amber-200/80 space-y-0.5">
            <div>类型: {MODULE_NAMES[props.module.module_type]}</div>
            <div>重量: {props.module.weight}</div>
            {props.module.gun_damage !== undefined && <div>伤害: {props.module.gun_damage}</div>}
            {props.module.detection_range !== undefined && <div>探测: {props.module.detection_range}</div>}
            {props.module.cargo_capacity !== undefined && <div>容量: {props.module.cargo_capacity}</div>}
            {props.module.engine_power !== undefined && <div>动力: {props.module.engine_power}</div>}
            {props.module.repair_rate !== undefined && <div>维修: {props.module.repair_rate}</div>}
          </div>
        </div>
      </Show>
    </div>
  );
};

const CrewCard: Component<{ crew: CrewMember }> = (props) => {
  const hpPercent = (props.crew.health / 100) * 100;
  const role = props.crew.role;
  return (
    <div class={`p-2 rounded border ${ROLE_COLORS[role]}/30 border-white/20`}>
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs font-bold text-amber-100">{props.crew.name}</span>
        <span class={`text-[10px] px-1.5 py-0.5 rounded text-white ${ROLE_COLORS[role]}`}>
          {CREW_ROLE_NAMES[role]}
        </span>
      </div>
      <div class="flex items-center gap-2 text-[10px] text-amber-200/80">
        <div class="flex-1 h-1 bg-stone-700 rounded-full overflow-hidden">
          <div
            class={`h-full ${hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${hpPercent}%` }}
          />
        </div>
        <span>HP {props.crew.health}/100</span>
      </div>
      <div class="flex gap-2 mt-1 text-[9px] text-amber-200/60">
        <span>技能: {props.crew.skill}</span>
        <span>士气: {props.crew.morale}</span>
      </div>
    </div>
  );
};

const CargoItemCard: Component<{ cargo: CargoItem }> = (props) => {
  const totalValue = props.cargo.amount * props.cargo.base_value;
  return (
    <div class="flex items-center justify-between p-2 bg-stone-800/50 rounded border border-brass/30">
      <div class="flex items-center gap-2">
        <span class="text-lg">📦</span>
        <div>
          <div class="text-sm font-semibold text-amber-200">{props.cargo.type}</div>
          <div class="text-[10px] text-amber-200/60">
            单价: {props.cargo.base_value} 金币
          </div>
        </div>
      </div>
      <div class="text-right text-xs">
        <div class="text-amber-300 font-mono">×{props.cargo.amount}</div>
        <div class="text-amber-400">价值: {totalValue}</div>
      </div>
    </div>
  );
};

const AirshipPanel: Component<AirshipPanelProps> = (props) => {
  const [activeTab, setActiveTab] = createSignal<'stats' | 'modules' | 'crew' | 'cargo'>('stats');

  const player = () => useGameStore().currentPlayer;
  const isOwnAirship = () => props.airship.player_id === player()?.id;

  const crewList = createMemo(() => Object.values(props.airship.crew));

  const currentCargoWeight = createMemo(() => {
    return props.airship.cargo.reduce((sum, c) => sum + c.amount, 0);
  });

  const maxCargoWeight = createMemo(() => {
    return props.airship.modules
      .filter((m) => m.module_type === 'cargo')
      .reduce((sum, m) => sum + (m.cargo_capacity || 0), 0);
  });

  return (
    <div class="steampunk-panel p-4 w-full h-full flex flex-col overflow-hidden">
      <div class="flex items-start justify-between mb-4 pb-3 border-b border-brass">
        <div class="flex items-start gap-3">
          <div
            class="w-10 h-10 rounded-full border-2 flex items-center justify-center text-2xl shrink-0"
            style={{ 'border-color': props.playerColor || '#b58863' }}
          >
            🚁
          </div>
          <div>
            <h3 class="text-xl font-bold text-amber-300 flex items-center gap-2">
              {props.airship.name}
              {props.airship.status === 'battling' && (
                <span class="text-xs px-2 py-0.5 bg-red-700 rounded text-red-100 animate-pulse">
                  ⚔️ 战斗中
                </span>
              )}
            </h3>
            <div class="text-xs text-amber-200/70 mt-0.5">
              坐标: ({props.airship.position.x}, {props.airship.position.y})
            </div>
          </div>
        </div>
        <div class="flex gap-1">
          <Show when={isOwnAirship() && props.onModify}>
            <button
              onClick={props.onModify}
              class="text-xs px-2 py-1 bg-purple-700 hover:bg-purple-600 rounded text-white"
              title="改装飞艇"
            >
              🔧 改装
            </button>
          </Show>
          <Show when={props.onClose}>
            <button
              onClick={props.onClose}
              class="text-amber-200 hover:text-amber-400 text-xl leading-none w-7 h-7 flex items-center justify-center"
            >
              ×
            </button>
          </Show>
        </div>
      </div>

      <div class="flex gap-1 mb-3">
        {(['stats', 'modules', 'crew', 'cargo'] as const).map((tab) => (
          <button
            onClick={() => setActiveTab(tab)}
            class={`flex-1 py-1.5 text-xs font-bold rounded transition-colors ${
              activeTab() === tab
                ? 'bg-brass text-stone-900'
                : 'bg-stone-700/60 text-amber-200 hover:bg-stone-700'
            }`}
          >
            {tab === 'stats' && '📊 状态'}
            {tab === 'modules' && '⚙️ 模块'}
            {tab === 'crew' && '👥 船员'}
            {tab === 'cargo' && '📦 货物'}
          </button>
        ))}
      </div>

      <div class="flex-1 overflow-y-auto scrollbar-steampunk pr-1">
        <Show when={activeTab() === 'stats'}>
          <div class="space-y-3">
            <StatusBar
              value={props.airship.hp}
              max={props.airship.max_hp}
              label="船体耐久"
              color="bg-green-500"
              icon="🛡️"
            />
            <StatusBar
              value={props.airship.gas_balloon.durability}
              max={props.airship.gas_balloon.max_durability}
              label={`气囊 (${GAS_LABELS[props.airship.gas_balloon.gas_type]})`}
              color={props.airship.gas_balloon.gas_type === 'hydrogen' ? 'bg-pink-500' : 'bg-cyan-400'}
              icon="🎈"
            />
            <StatusBar
              value={props.airship.morale}
              max={100}
              label="士气"
              color="bg-yellow-500"
              icon="😀"
            />

            <div class="grid grid-cols-2 gap-2 pt-2">
              <div class="p-2 bg-stone-800/50 rounded border border-brass/30">
                <div class="text-[10px] text-amber-200/60">飞行速度</div>
                <div class="text-lg font-bold text-amber-300">
                  ⚡ {props.airship.speed}
                </div>
              </div>
              <div class="p-2 bg-stone-800/50 rounded border border-brass/30">
                <div class="text-[10px] text-amber-200/60">飞行高度</div>
                <div class="text-lg font-bold text-amber-300">
                  ☁️ {ALTITUDE_LABELS[props.airship.altitude]}
                </div>
              </div>
              <div class="p-2 bg-stone-800/50 rounded border border-brass/30">
                <div class="text-[10px] text-amber-200/60">载货</div>
                <div class="text-lg font-bold text-amber-300">
                  📦 {currentCargoWeight()}/{maxCargoWeight()}
                </div>
              </div>
              <div class="p-2 bg-stone-800/50 rounded border border-brass/30">
                <div class="text-[10px] text-amber-200/60">浮力</div>
                <div class="text-lg font-bold text-amber-300">
                  🎈 {props.airship.gas_balloon.buoyancy}
                </div>
              </div>
            </div>
          </div>
        </Show>

        <Show when={activeTab() === 'modules'}>
          <div>
            <div class="text-xs text-amber-200/70 mb-2">
              装备模块 ({props.airship.modules.length}/6)
            </div>
            <div class="grid grid-cols-3 gap-2">
              <For each={props.airship.modules}>
                {(mod, idx) => <ModuleCard module={mod} index={idx()} />}
              </For>
              <For each={Array.from({ length: Math.max(0, 6 - props.airship.modules.length) })}>
                {() => (
                  <div class="p-2 rounded border-2 border-dashed border-brass/30 bg-stone-900/30 flex flex-col items-center justify-center min-h-[72px]">
                    <span class="text-2xl opacity-30">➕</span>
                    <span class="text-[10px] text-amber-200/40 mt-1">空槽位</span>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>

        <Show when={activeTab() === 'crew'}>
          <div>
            <div class="text-xs text-amber-200/70 mb-2">
              船员 ({crewList().length})
            </div>
            <Show
              when={crewList().length > 0}
              fallback={
                <div class="text-center text-amber-200/50 py-4 text-sm">
                  暂无船员
                </div>
              }
            >
              <div class="space-y-2">
                <For each={crewList()}>
                  {(c) => <CrewCard crew={c} />}
                </For>
              </div>
            </Show>
          </div>
        </Show>

        <Show when={activeTab() === 'cargo'}>
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs text-amber-200/70">
                货物清单
              </span>
              <span class="text-xs font-mono text-amber-300">
                载重: {currentCargoWeight()}/{maxCargoWeight()}
              </span>
            </div>
            <Show
              when={props.airship.cargo.length > 0}
              fallback={
                <div class="text-center text-amber-200/50 py-6 text-sm">
                  货舱空空如也
                </div>
              }
            >
              <div class="space-y-2">
                <For each={props.airship.cargo}>
                  {(c) => <CargoItemCard cargo={c} />}
                </For>
              </div>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default AirshipPanel;
