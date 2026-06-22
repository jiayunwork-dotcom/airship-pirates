import { For, Show, createSignal, createMemo } from 'solid-js';
import { GasType, ModuleType } from '../types/game';
import type { Airship } from '../types/game';
import type { Component } from 'solid-js';

interface ModuleBuilderProps {
  airship?: Airship;
  playerWealth: number;
  onClose: () => void;
  mode?: 'build' | 'modify';
}

interface ModuleTemplate {
  type: ModuleType;
  name: string;
  description: string;
  icon: string;
  cost: number;
  weight: number;
  stats: {
    gun_damage?: number;
    detection_range?: number;
    cargo_capacity?: number;
    engine_power?: number;
    armor?: number;
    repair_rate?: number;
    crew_capacity?: number;
  };
}

const GAS_OPTIONS: Array<{
  type: GasType;
  name: string;
  icon: string;
  cost: number;
  buoyancy: number;
  max_durability: number;
  desc: string;
  color: string;
}> = [
  {
    type: GasType.HYDROGEN,
    name: '氢气气囊',
    icon: '🎈',
    cost: 2000,
    buoyancy: 120,
    max_durability: 80,
    desc: '浮力强但易燃，被击中时可能爆炸',
    color: 'from-pink-500 to-pink-700',
  },
  {
    type: GasType.HELIUM,
    name: '氦气气囊',
    icon: '🎈',
    cost: 4000,
    buoyancy: 100,
    max_durability: 100,
    desc: '安全性高，不会燃烧，但浮力稍低',
    color: 'from-cyan-400 to-cyan-600',
  },
];

const MODULE_TEMPLATES: ModuleTemplate[] = [
  {
    type: ModuleType.COCKPIT,
    name: '驾驶舱',
    description: '飞艇控制中心，配备专业导航员和驾驶员',
    icon: '🎛️',
    cost: 1200,
    weight: 15,
    stats: { crew_capacity: 3 },
  },
  {
    type: ModuleType.GUN_DECK,
    name: '火炮甲板',
    description: '重型炮台，对敌方船体和模块造成巨大伤害',
    icon: '💥',
    cost: 800,
    weight: 20,
    stats: { gun_damage: 25, detection_range: 5 },
  },
  {
    type: ModuleType.CARGO,
    name: '扩展货舱',
    description: '增加货物存储空间，提升运载能力',
    icon: '📦',
    cost: 300,
    weight: 5,
    stats: { cargo_capacity: 50 },
  },
  {
    type: ModuleType.ENGINE,
    name: '蒸汽推进器',
    description: '增强动力，显著提升航行速度',
    icon: '⚙️',
    cost: 1000,
    weight: 25,
    stats: { engine_power: 2 },
  },
  {
    type: ModuleType.REPAIR,
    name: '维修舱',
    description: '配备维修设备和医疗设施，持续修复船体',
    icon: '🔧',
    cost: 600,
    weight: 10,
    stats: { repair_rate: 10, armor: 10 },
  },
  {
    type: ModuleType.LOOKOUT,
    name: '瞭望台',
    description: '高空观测点，扩大视野范围和侦测距离',
    icon: '🔭',
    cost: 400,
    weight: 6,
    stats: { detection_range: 8 },
  },
];

const SLOT_COUNT = 6;

const ModuleBuilder: Component<ModuleBuilderProps> = (props) => {
  const [mode] = createSignal(props.mode || (props.airship ? 'modify' : 'build'));
  const [selectedGas, setSelectedGas] = createSignal<GasType>(
    props.airship?.gas_balloon.gas_type || GasType.HYDROGEN
  );
  const [selectedModules, setSelectedModules] = createSignal<(ModuleTemplate | null)[]>(
    props.airship
      ? props.airship.modules.map(
          (m) => MODULE_TEMPLATES.find((t) => t.type === m.module_type) || null
        ).concat(Array(Math.max(0, SLOT_COUNT - props.airship.modules.length)).fill(null))
      : Array(SLOT_COUNT).fill(null)
  );
  const [shipName, setShipName] = createSignal(props.airship?.name || '新飞艇');
  const [activeCategory, setActiveCategory] = createSignal<string>('all');
  const [selectedSlotIndex, setSelectedSlotIndex] = createSignal<number | null>(null);
  const [processing] = createSignal(false);

  const gasOption = createMemo(() => GAS_OPTIONS.find((g) => g.type === selectedGas())!);

  const totalModuleWeight = createMemo(() =>
    selectedModules().reduce((sum, m) => sum + (m ? m.weight : 0), 0)
  );

  const baseBuoyancy = createMemo(() => gasOption().buoyancy);

  const netBuoyancy = createMemo(() => baseBuoyancy() - totalModuleWeight() - 30);

  const isOverloaded = createMemo(() => netBuoyancy() <= 0);

  const totalCost = createMemo(() => {
    let cost = 0;
    if (mode() === 'build') {
      cost += gasOption().cost;
      cost += 1500;
    }
    for (const m of selectedModules()) {
      if (m) cost += m.cost;
    }
    return cost;
  });

  const canAfford = createMemo(() => props.playerWealth >= totalCost());

  const usedSlots = createMemo(() => selectedModules().filter((m) => m !== null).length);

  const categories = createMemo(() => {
    const cats = new Set<string>();
    cats.add('all');
    for (const m of MODULE_TEMPLATES) {
      if (m.stats.gun_damage) cats.add('weapon');
      else if (m.stats.cargo_capacity || m.stats.engine_power) cats.add('utility');
      else cats.add('defense');
    }
    return Array.from(cats);
  });

  const filteredModules = createMemo(() => {
    if (activeCategory() === 'all') return MODULE_TEMPLATES;
    return MODULE_TEMPLATES.filter((m) => {
      if (activeCategory() === 'weapon') return !!m.stats.gun_damage;
      if (activeCategory() === 'utility') return !!m.stats.cargo_capacity || !!m.stats.engine_power || m.type === ModuleType.COCKPIT || m.type === ModuleType.LOOKOUT;
      if (activeCategory() === 'defense') return !!m.stats.armor || !!m.stats.repair_rate || m.type === ModuleType.REPAIR;
      return false;
    });
  });

  const setModule = (slotIndex: number, module: ModuleTemplate | null) => {
    setSelectedModules((prev) => {
      const next = [...prev];
      next[slotIndex] = module;
      return next;
    });
    setSelectedSlotIndex(null);
  };

  const removeModule = (slotIndex: number) => {
    setModule(slotIndex, null);
  };

  const categoryLabel = (cat: string) => {
    switch (cat) {
      case 'all': return '全部';
      case 'weapon': return '⚔️ 武器';
      case 'utility': return '📦 功能';
      case 'defense': return '🛡️ 防御';
      default: return cat;
    }
  };

  return (
    <div class="modal-overlay z-[90]">
      <div class="modal-content w-[95vw] max-w-5xl p-0 overflow-hidden flex flex-col max-h-[95vh]">
        <div class="bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-900 p-4 border-b-2 border-brass">
          <div class="flex items-start justify-between">
            <div class="flex items-start gap-4">
              <div class="text-5xl animate-float">🛠️</div>
              <div>
                <h2 class="text-2xl font-bold text-amber-100">
                  {mode() === 'build' ? '⚒️ 建造新飞艇' : '🔧 改装飞艇'}
                </h2>
                <p class="text-amber-200/70 text-sm mt-1">
                  {mode() === 'build'
                    ? '配置你的第一艘海盗飞艇，征服天空！'
                    : '调整模块配置，优化你的战斗飞艇'}
                </p>
              </div>
            </div>
            <div class="flex items-start gap-4">
              <div class="text-right">
                <div class="text-sm text-amber-200/70">💰 当前财富</div>
                <div class="text-xl font-bold text-amber-300 font-mono">
                  {props.playerWealth.toLocaleString()}
                </div>
                <div class="mt-2 pt-2 border-t border-brass/30">
                  <div class="text-sm text-amber-200/70">总造价</div>
                  <div class={`text-2xl font-bold font-mono ${canAfford() ? 'text-green-400' : 'text-red-400'}`}>
                    {totalCost().toLocaleString()}💰
                  </div>
                </div>
              </div>
              <button
                onClick={props.onClose}
                class="w-9 h-9 flex items-center justify-center rounded bg-stone-700/60 hover:bg-red-800 text-amber-200 text-xl transition-colors"
              >
                ×
              </button>
            </div>
          </div>
        </div>

        <div class="flex-1 overflow-hidden flex">
          <div class="flex-1 overflow-y-auto scrollbar-steampunk p-5 space-y-5">
            <Show when={mode() === 'build'}>
              <div class="steampunk-panel p-4">
                <h3 class="text-lg font-bold text-amber-300 mb-3 flex items-center gap-2">
                  🚁 飞艇命名
                </h3>
                <input
                  type="text"
                  value={shipName()}
                  onInput={(e) => setShipName(e.currentTarget.value)}
                  placeholder="给你的飞艇起个响亮的名字..."
                  class="steampunk-input w-full text-lg"
                  maxlength={20}
                />
              </div>
            </Show>

            <div class="steampunk-panel p-4">
              <h3 class="text-lg font-bold text-amber-300 mb-3 flex items-center gap-2">
                🎈 选择气囊类型
              </h3>
              <div class="grid md:grid-cols-2 gap-4">
                <For each={GAS_OPTIONS}>
                  {(opt) => {
                    const isSelected = selectedGas() === opt.type;
                    return (
                      <button
                        onClick={() => setSelectedGas(opt.type)}
                        class={`p-4 rounded-xl border-3 text-left transition-all ${
                          isSelected
                            ? 'border-amber-400 ring-2 ring-amber-400/40 scale-[1.02]'
                            : 'border-stone-600 hover:border-stone-400'
                        }`}
                        style={{
                          background: isSelected
                            ? 'linear-gradient(180deg, rgba(251,191,36,0.15) 0%, rgba(28,25,23,0.5) 100%)'
                            : 'linear-gradient(180deg, rgba(68,64,60,0.5) 0%, rgba(28,25,23,0.5) 100%)',
                        }}
                      >
                        <div class="flex items-center gap-3 mb-2">
                          <div
                            class={`w-14 h-14 rounded-full flex items-center justify-center text-3xl bg-gradient-to-br ${opt.color} shadow-lg`}
                          >
                            {opt.icon}
                          </div>
                          <div>
                            <div class="font-bold text-amber-200 text-lg">{opt.name}</div>
                            <div class="text-amber-300 font-mono text-sm">{opt.cost.toLocaleString()}💰</div>
                          </div>
                        </div>
                        <p class="text-xs text-amber-200/70 mb-3">{opt.desc}</p>
                        <div class="grid grid-cols-2 gap-2 text-xs">
                          <div class="p-2 bg-stone-900/50 rounded">
                            <div class="text-amber-200/60">最大耐久</div>
                            <div class="font-bold text-green-400">{opt.max_durability} HP</div>
                          </div>
                          <div class="p-2 bg-stone-900/50 rounded">
                            <div class="text-amber-200/60">基础浮力</div>
                            <div class="font-bold text-cyan-400">+{opt.buoyancy}</div>
                          </div>
                        </div>
                      </button>
                    );
                  }}
                </For>
              </div>
            </div>

            <div class="steampunk-panel p-4">
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-lg font-bold text-amber-300 flex items-center gap-2">
                  ⚙️ 装备模块 ({usedSlots()}/{SLOT_COUNT} 槽位)
                </h3>
                <div class="flex gap-1">
                  <For each={categories()}>
                    {(cat) => (
                      <button
                        onClick={() => setActiveCategory(cat)}
                        class={`px-3 py-1 text-xs rounded transition-colors ${
                          activeCategory() === cat
                            ? 'bg-amber-600 text-stone-900 font-bold'
                            : 'bg-stone-700/60 text-amber-200/80 hover:bg-stone-700'
                        }`}
                      >
                        {categoryLabel(cat)}
                      </button>
                    )}
                  </For>
                </div>
              </div>

              <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                <For each={filteredModules()}>
                  {(mod) => (
                    <div
                      draggable={true}
                      class={`p-3 rounded-lg border-2 cursor-grab active:cursor-grabbing transition-all bg-stone-800/60 ${
                        selectedSlotIndex() !== null
                          ? 'border-green-500/50 hover:border-green-400 hover:scale-105'
                          : 'border-stone-600 hover:border-brass/60'
                      }`}
                      onClick={() => {
                        if (selectedSlotIndex() !== null) {
                          setModule(selectedSlotIndex()!, mod);
                        }
                      }}
                    >
                      <div class="flex items-center gap-2 mb-1">
                        <span class="text-2xl">{mod.icon}</span>
                        <div class="flex-1 min-w-0">
                          <div class="font-bold text-amber-200 text-sm truncate">{mod.name}</div>
                          <div class="text-amber-300 text-xs font-mono">{mod.cost}💰</div>
                        </div>
                      </div>
                      <p class="text-[10px] text-amber-200/60 mb-2 line-clamp-2">
                        {mod.description}
                      </p>
                      <div class="space-y-0.5 text-[10px]">
                        <div class="flex justify-between">
                          <span class="text-amber-200/50">重量:</span>
                          <span class="text-yellow-400 font-bold">{mod.weight}</span>
                        </div>
                        {mod.stats.gun_damage && (
                          <div class="flex justify-between">
                            <span class="text-amber-200/50">伤害:</span>
                            <span class="text-red-400 font-bold">{mod.stats.gun_damage}</span>
                          </div>
                        )}
                        {mod.stats.detection_range && (
                          <div class="flex justify-between">
                            <span class="text-amber-200/50">射程:</span>
                            <span class="text-blue-400 font-bold">{mod.stats.detection_range}</span>
                          </div>
                        )}
                        {mod.stats.cargo_capacity && (
                          <div class="flex justify-between">
                            <span class="text-amber-200/50">容量:</span>
                            <span class="text-green-400 font-bold">+{mod.stats.cargo_capacity}</span>
                          </div>
                        )}
                        {mod.stats.engine_power && (
                          <div class="flex justify-between">
                            <span class="text-amber-200/50">速度:</span>
                            <span class="text-cyan-400 font-bold">+{mod.stats.engine_power}</span>
                          </div>
                        )}
                        {mod.stats.armor && (
                          <div class="flex justify-between">
                            <span class="text-amber-200/50">护甲:</span>
                            <span class="text-purple-400 font-bold">+{mod.stats.armor}</span>
                          </div>
                        )}
                        {mod.stats.repair_rate && (
                          <div class="flex justify-between">
                            <span class="text-amber-200/50">修复:</span>
                            <span class="text-pink-400 font-bold">+{mod.stats.repair_rate}/回合</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </div>

          <div class="w-80 bg-stone-900/60 border-l-2 border-brass p-4 flex flex-col overflow-y-auto scrollbar-steampunk shrink-0">
            <h3 class="text-lg font-bold text-amber-300 mb-3 text-center border-b border-brass/40 pb-2">
              🏗️ 配置预览
            </h3>

            <div class="flex justify-center mb-4">
              <div class="relative">
                <div class="text-7xl animate-float">🚁</div>
                <div
                  class={`absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-lg bg-gradient-to-br ${gasOption().color} shadow-lg border-2 border-white/30`}
                >
                  {gasOption().icon}
                </div>
              </div>
            </div>

            <div class="text-center mb-4">
              <div class="font-bold text-xl text-amber-200">
                {shipName() || '未命名飞艇'}
              </div>
              <div class="text-xs text-amber-200/50 mt-0.5">
                {gasOption().name}
              </div>
            </div>

            <div class="mb-4">
              <div class="text-xs text-amber-300 font-bold mb-2 text-center">
                模块槽位
              </div>
              <div class="grid grid-cols-3 gap-2">
                <For each={selectedModules()}>
                  {(mod, index) => {
                    const isSelected = selectedSlotIndex() === index();
                    return (
                      <div
                        onClick={() => setSelectedSlotIndex(isSelected ? null : index())}
                        class={`aspect-square rounded-lg border-2 flex flex-col items-center justify-center cursor-pointer transition-all p-1 ${
                          mod
                            ? isSelected
                              ? 'border-red-400 bg-red-900/20 scale-105'
                              : 'border-brass/60 bg-stone-800/80 hover:border-amber-400'
                            : isSelected
                            ? 'border-green-400 bg-green-900/20 animate-pulse scale-105'
                            : 'border-dashed border-stone-600 bg-stone-900/40 hover:border-brass/60'
                        }`}
                      >
                        <Show when={mod} fallback={
                          <div class="text-center">
                            <div class="text-xl opacity-40">➕</div>
                            <div class="text-[9px] text-amber-200/40">槽位{index() + 1}</div>
                          </div>
                        }>
                          <div class="text-center w-full">
                            <div class="text-xl">{mod!.icon}</div>
                            <div class="text-[9px] text-amber-200 truncate w-full">{mod!.name}</div>
                          </div>
                        </Show>
                      </div>
                    );
                  }}
                </For>
              </div>
              <Show when={selectedSlotIndex() !== null}>
                <button
                  onClick={() => {
                    const idx = selectedSlotIndex();
                    if (idx !== null && selectedModules()[idx]) {
                      removeModule(idx);
                    }
                  }}
                  class="mt-2 w-full text-xs py-1 rounded bg-red-800/60 hover:bg-red-700 text-red-100 border border-red-600/50"
                  disabled={!selectedModules()[selectedSlotIndex()!]}
                >
                  🗑️ 移除选中模块
                </button>
              </Show>
            </div>

            <div class="space-y-2 mb-4 p-3 bg-stone-800/60 rounded-lg border border-brass/30">
              <div class="flex items-center justify-between text-xs">
                <span class="text-cyan-400">🎈 气囊浮力:</span>
                <span class="font-mono font-bold text-cyan-400">+{baseBuoyancy()}</span>
              </div>
              <div class="flex items-center justify-between text-xs">
                <span class="text-yellow-400">⚖️ 模块重量:</span>
                <span class="font-mono font-bold text-yellow-400">-{totalModuleWeight()}</span>
              </div>
              <div class="flex items-center justify-between text-xs">
                <span class="text-amber-200/60">🏗️ 船体自重:</span>
                <span class="font-mono text-amber-200/60">-30</span>
              </div>
              <div class="h-px bg-brass/30 my-1" />
              <div class="flex items-center justify-between text-sm">
                <span class="text-amber-200 font-bold">📊 净浮力:</span>
                <span
                  class={`font-mono font-bold ${isOverloaded() ? 'text-red-400 animate-pulse' : 'text-green-400'}`}
                >
                  {isOverloaded() ? '' : '+'}{netBuoyancy()}
                </span>
              </div>
            </div>

            <Show when={isOverloaded()}>
              <div class="mb-4 p-3 bg-red-900/40 border-2 border-red-500 rounded-lg text-center">
                <div class="text-2xl mb-1">⚠️</div>
                <div class="text-red-300 text-sm font-bold">超载警告！</div>
                <div class="text-red-200/70 text-xs mt-1">
                  减少模块重量或更换氢气气囊
                </div>
              </div>
            </Show>

            <div class="space-y-2 mb-4">
              <div class="p-3 bg-stone-800/60 rounded-lg border border-brass/30">
                <div class="flex items-center justify-between">
                  <span class="text-sm text-amber-200/80">总造价</span>
                  <span class={`text-xl font-bold font-mono ${canAfford() ? 'text-green-400' : 'text-red-400'}`}>
                    {totalCost().toLocaleString()}💰
                  </span>
                </div>
                <div class="flex items-center justify-between mt-1 text-xs">
                  <span class="text-amber-200/60">剩余财富</span>
                  <span class="font-mono text-amber-300">
                    {(props.playerWealth - totalCost()).toLocaleString()}💰
                  </span>
                </div>
              </div>
            </div>

            <div class="mt-auto space-y-2 pt-4 border-t border-brass/30">
              <button
                disabled={!canAfford() || isOverloaded() || processing() || (mode() === 'build' && !shipName().trim())}
                class="steampunk-button w-full text-lg bg-gradient-to-b from-green-600 to-green-700 border-green-500 hover:from-green-500 hover:to-green-600 disabled:from-gray-600 disabled:to-gray-700 disabled:border-gray-500"
              >
                {processing()
                  ? '处理中...'
                  : mode() === 'build'
                  ? '🚀 开始建造'
                  : '✅ 确认改装'}
              </button>
              <button
                onClick={props.onClose}
                class="w-full text-sm py-2 px-3 bg-stone-700 hover:bg-stone-600 text-amber-200 rounded border border-brass/40"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModuleBuilder;
