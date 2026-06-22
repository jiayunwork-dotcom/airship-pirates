import { For, Show, createSignal, createMemo } from 'solid-js';
import type { City, Airship, TradeGood, CargoType } from '../types/game';
import type { Component } from 'solid-js';
import { useGameStore } from '../store/gameStore';

interface CityPanelProps {
  city: City;
  airship: Airship | undefined | null;
  playerId: string;
  onClose: () => void;
}

const CREW_ROLES = [
  { role: 'captain', label: '船长', cost: 500, icon: '🎖️', desc: '提升全船属性' },
  { role: 'gunner', label: '炮手', cost: 200, icon: '💂', desc: '提高炮击伤害' },
  { role: 'crewman', label: '水手', cost: 100, icon: '⛵', desc: '提升航行速度' },
  { role: 'engineer', label: '工程师', cost: 250, icon: '🔧', desc: '自动修复船体' },
  { role: 'medic', label: '医疗兵', cost: 200, icon: '💉', desc: '治疗受伤船员' },
];

const CARGO_TYPE_NAMES: Record<CargoType, string> = {
  food: '食物',
  fuel: '燃料',
  metals: '金属',
  textiles: '纺织品',
  gems: '宝石',
  weapons: '武器',
  luxuries: '奢侈品',
  medicine: '药品',
};

const CITY_TYPE_NAMES: Record<string, string> = {
  capital: '首都',
  trade_hub: '贸易中心',
  industrial: '工业城市',
  mining: '矿业城市',
  agricultural: '农业城市',
  military: '军事要塞',
  pirate_haven: '海盗据点',
};

const TabButton: Component<{
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  disabled?: boolean;
}> = (props) => (
  <button
    onClick={props.onClick}
    disabled={props.disabled}
    class={`flex-1 py-2 px-3 text-sm font-bold rounded-t-lg transition-all ${
      props.active
        ? 'bg-stone-800 text-amber-300 border-b-2 border-amber-400'
        : 'bg-stone-900/60 text-amber-200/70 hover:bg-stone-800/60 hover:text-amber-200'
    } ${props.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
  >
    <span class="mr-1">{props.icon}</span>
    {props.label}
  </button>
);

const CityPanel: Component<CityPanelProps> = (props) => {
  const store = useGameStore();
  const [activeTab, setActiveTab] = createSignal<'trade' | 'repair' | 'recruit' | 'build'>('trade');
  const [tradeMap, setTradeMap] = createSignal<Record<string, number>>({});
  const [repairAmount, setRepairAmount] = createSignal(1);
  const [recruitCount, setRecruitCount] = createSignal(1);
  const [selectedRole, setSelectedRole] = createSignal('crewman');
  const [processing, setProcessing] = createSignal(false);

  const currentCargoMap = createMemo(() => {
    const map: Record<string, number> = {};
    if (!props.airship) return map;
    for (const c of props.airship.cargo || []) {
      map[c.type] = (map[c.type] || 0) + c.amount;
    }
    return map;
  });

  const maxCargoWeight = createMemo(() => {
    if (!props.airship) return 0;
    return (props.airship.modules || [])
      .filter((m) => m.module_type === 'cargo')
      .reduce((sum, m) => sum + (m.cargo_capacity || 0), 0);
  });

  const currentCargoWeight = createMemo(() => {
    if (!props.airship) return 0;
    return (props.airship.cargo || []).reduce((sum, c) => sum + c.amount, 0);
  });

  const remainingCargoSpace = createMemo(() => {
    return maxCargoWeight() - currentCargoWeight();
  });

  const setTradeQty = (goodType: string, qty: number) => {
    setTradeMap((prev) => ({ ...prev, [goodType]: Math.max(0, qty) }));
  };

  const getTradeQty = (goodType: string) => tradeMap()[goodType] || 0;

  const tradeTotals = createMemo(() => {
    let buyCost = 0;
    let sellIncome = 0;
    let weightDelta = 0;
    for (const good of props.city.trade_goods) {
      const qty = getTradeQty(good.type);
      if (qty > 0) {
        buyCost += qty * good.buy_price;
        weightDelta += qty;
      } else if (qty < 0) {
        const absQty = Math.abs(qty);
        const available = currentCargoMap()[good.type] || 0;
        const actual = Math.min(absQty, available);
        sellIncome += actual * good.sell_price;
        weightDelta -= actual;
      }
    }
    return { buyCost, sellIncome, net: sellIncome - buyCost, weightDelta };
  });

  const canTrade = createMemo(() => {
    const t = tradeTotals();
    if (t.net > 0) return true;
    return (store.currentPlayer?.wealth || 0) >= Math.abs(t.net) && t.weightDelta <= remainingCargoSpace();
  });

  const repairCostPerPoint = 10;
  const maxRepair = props.airship ? props.airship.max_hp - props.airship.hp : 0;
  const repairCost = repairAmount() * repairCostPerPoint;

  const handleTrade = async () => {
    if (processing()) return;
    setProcessing(true);
    try {
      store.addNotification('交易完成！');
      setTradeMap({});
    } catch (e: any) {
      store.addNotification(e.message || '交易失败');
    } finally {
      setProcessing(false);
    }
  };

  const handleRepair = async () => {
    if (processing() || repairAmount() <= 0) return;
    setProcessing(true);
    try {
      store.addNotification(`修复了 ${repairAmount()} 点耐久`);
      setRepairAmount(1);
    } catch (e: any) {
      store.addNotification(e.message || '维修失败');
    } finally {
      setProcessing(false);
    }
  };

  const handleRecruit = async () => {
    if (processing() || recruitCount() <= 0) return;
    setProcessing(true);
    try {
      const roleInfo = CREW_ROLES.find(r => r.role === selectedRole());
      store.addNotification(`招募了 ${recruitCount()} 名${roleInfo?.label || '船员'}`);
    } catch (e: any) {
      store.addNotification(e.message || '招募失败');
    } finally {
      setProcessing(false);
    }
  };

  const repairHpPercent = props.airship ? (props.airship.hp / props.airship.max_hp) * 100 : 100;

  return (
    <div class="modal-overlay">
      <div class="modal-content w-[90vw] max-w-3xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <div class="bg-gradient-to-r from-amber-800 via-yellow-800 to-amber-900 p-4 border-b-2 border-brass">
          <div class="flex items-start justify-between">
            <div class="flex items-start gap-4">
              <div class="text-5xl">🏰</div>
              <div>
                <h2 class="text-2xl font-bold text-amber-100">{props.city.name}</h2>
                <div class="text-amber-200/80 text-sm mt-0.5">
                  🏴 类型: <span class="font-bold">{CITY_TYPE_NAMES[props.city.type] || props.city.type}</span>
                </div>
                <p class="text-amber-200/70 text-sm mt-2 max-w-md">
                  {props.city.type === 'trade_hub' ? '繁华的贸易中心，商贾云集，各种商品琳琅满目。' :
                   props.city.type === 'capital' ? '宏伟的首都城市，政治与经济的中心。' :
                   props.city.type === 'pirate_haven' ? '海盗们的秘密据点，危险与机遇并存。' :
                   '一座天空之城，水手们的歇脚之地。'}
                </p>
              </div>
            </div>
            <div class="text-right">
              <div class="text-sm text-amber-200/70">💰 当前财富</div>
              <div class="text-2xl font-bold text-amber-300 font-mono">
                {(store.currentPlayer?.wealth || 0).toLocaleString()}
              </div>
              <button
                onClick={props.onClose}
                class="mt-3 w-9 h-9 flex items-center justify-center rounded bg-stone-700/60 hover:bg-red-800 text-amber-200 text-xl transition-colors"
              >
                ×
              </button>
            </div>
          </div>
        </div>

        <div class="flex border-b-2 border-brass bg-stone-900/50 px-4 gap-1">
          <TabButton active={activeTab() === 'trade'} onClick={() => setActiveTab('trade')} icon="💰" label="交易" />
          <TabButton
            active={activeTab() === 'repair'}
            onClick={() => setActiveTab('repair')}
            icon="🔧"
            label="维修"
          />
          <TabButton
            active={activeTab() === 'recruit'}
            onClick={() => setActiveTab('recruit')}
            icon="👥"
            label="招募"
          />
          <TabButton
            active={activeTab() === 'build'}
            onClick={() => setActiveTab('build')}
            icon="⚒️"
            label="建造"
          />
        </div>

        <div class="flex-1 overflow-y-auto scrollbar-steampunk p-5">
          <Show when={activeTab() === 'trade'}>
            <div class="space-y-4">
              <Show when={!props.airship} fallback={
                <>
                  <div class="flex items-center justify-between">
                    <h3 class="text-lg font-bold text-amber-300 flex items-center gap-2">
                      📦 商品清单
                    </h3>
                    <div class="text-sm text-amber-200/70">
                      货舱剩余: <span class="font-bold text-amber-300">{remainingCargoSpace()}</span> / {maxCargoWeight()}
                    </div>
                  </div>
                </>
              }>
                <div class="steampunk-panel p-6 text-center">
                  <div class="text-4xl mb-3 opacity-40">🚁</div>
                  <div class="text-amber-200 text-lg mb-2">请先选择一艘飞艇</div>
                  <div class="text-amber-200/60 text-sm">点击左侧列表或地图上的飞艇选中后，再来城市进行贸易</div>
                </div>
              </Show>
              <Show when={props.airship}>

              <div class="space-y-2">
                <For each={props.city.trade_goods}>
                  {(good: TradeGood) => {
                    const owned = currentCargoMap()[good.type] || 0;
                    const qty = getTradeQty(good.type);
                    const isBuy = qty > 0;
                    const isSell = qty < 0;
                    const goodName = CARGO_TYPE_NAMES[good.type] || good.type;

                    return (
                      <div class={`p-3 rounded-lg border-2 transition-all ${
                        isBuy ? 'border-green-500/50 bg-green-900/10' :
                        isSell ? 'border-red-500/50 bg-red-900/10' :
                        'border-stone-700 bg-stone-800/50'
                      }`}>
                        <div class="flex items-center justify-between mb-2">
                          <div class="flex items-center gap-3">
                            <span class="text-2xl">📦</span>
                            <div>
                              <div class="font-bold text-amber-200">{goodName}</div>
                              <div class="text-xs text-amber-200/60">
                                库存: {good.supply} | 你有: {owned}
                              </div>
                            </div>
                          </div>
                          <div class="flex items-center gap-3 text-sm">
                            <div class="text-green-400 font-mono">
                              买: {good.buy_price}💰
                            </div>
                            <div class="text-amber-300 font-mono">
                              卖: {good.sell_price}💰
                            </div>
                          </div>
                        </div>

                        <div class="flex items-center gap-3">
                          <button
                            onClick={() => setTradeQty(good.type, qty - 1)}
                            disabled={owned <= 0 && qty <= 0}
                            class="w-8 h-8 rounded bg-red-700/80 hover:bg-red-600 disabled:opacity-40 text-white font-bold"
                          >
                            -
                          </button>

                          <div class="flex-1 flex items-center justify-center gap-2">
                            <span class="text-xs text-amber-200/60">出售</span>
                            <input
                              type="number"
                              value={qty}
                              onInput={(e) => setTradeQty(good.type, Number(e.currentTarget.value))}
                              class="w-20 text-center steampunk-input py-1 text-sm"
                            />
                            <span class="text-xs text-amber-200/60">购买</span>
                          </div>

                          <button
                            onClick={() => setTradeQty(good.type, qty + 1)}
                            disabled={good.supply <= 0 && qty >= 0}
                            class="w-8 h-8 rounded bg-green-700/80 hover:bg-green-600 disabled:opacity-40 text-white font-bold"
                          >
                            +
                          </button>

                          <div class="text-right w-24">
                            <Show when={isBuy}>
                              <div class="text-xs text-red-300">
                                -{(qty * good.buy_price).toLocaleString()}💰
                              </div>
                            </Show>
                            <Show when={isSell}>
                              <div class="text-xs text-green-300">
                                +{(Math.abs(qty) * good.sell_price).toLocaleString()}💰
                              </div>
                            </Show>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>

              <div class="p-4 bg-stone-900/60 rounded-lg border border-brass/40">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div class="space-y-1 text-sm">
                    <Show when={tradeTotals().buyCost > 0}>
                      <div class="text-red-300">
                        购买支出: <span class="font-mono font-bold">-{tradeTotals().buyCost.toLocaleString()}</span>💰
                      </div>
                    </Show>
                    <Show when={tradeTotals().sellIncome > 0}>
                      <div class="text-green-300">
                        出售收入: <span class="font-mono font-bold">+{tradeTotals().sellIncome.toLocaleString()}</span>💰
                      </div>
                    </Show>
                    <div class="text-amber-200">
                      货舱变化: <span class={`font-mono font-bold ${tradeTotals().weightDelta >= 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                        {tradeTotals().weightDelta >= 0 ? '+' : ''}{tradeTotals().weightDelta}
                      </span>
                    </div>
                    <div class={`text-lg font-bold ${tradeTotals().net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      净额: {tradeTotals().net >= 0 ? '+' : ''}{tradeTotals().net.toLocaleString()}💰
                    </div>
                  </div>
                  <button
                    onClick={handleTrade}
                    disabled={!canTrade() || processing()}
                    class="steampunk-button text-lg px-6"
                  >
                    {processing() ? '交易中...' : '✅ 确认交易'}
                  </button>
                </div>
              </div>
              </Show>
            </div>
          </Show>

          <Show when={activeTab() === 'repair'}>
            <div class="space-y-4">
              <h3 class="text-lg font-bold text-amber-300 flex items-center gap-2">
                🔧 飞艇维修
              </h3>

              <Show when={!props.airship}>
                <div class="steampunk-panel p-6 text-center">
                  <div class="text-4xl mb-3 opacity-40">🚁</div>
                  <div class="text-amber-200 text-lg mb-2">请先选择一艘飞艇</div>
                  <div class="text-amber-200/60 text-sm">点击左侧列表或地图上的飞艇选中后，再来城市进行维修</div>
                </div>
              </Show>

              <Show when={props.airship}>
                <div class="p-4 bg-stone-800/60 rounded-lg border border-brass/40">
                  <div class="flex items-center justify-between mb-3">
                    <span class="text-amber-200 font-bold">{props.airship!.name}</span>
                    <span class="font-mono text-amber-300">
                      {props.airship!.hp} / {props.airship!.max_hp} HP
                    </span>
                  </div>
                  <div class="h-6 bg-stone-700 rounded-full overflow-hidden">
                    <div
                      class={`h-full transition-all duration-300 ${repairHpPercent > 50 ? 'bg-green-500' : repairHpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${repairHpPercent}%` }}
                    />
                  </div>
                  <div class="mt-2 text-xs text-amber-200/60">
                    损坏程度: {repairHpPercent < 25 ? '严重损坏' : repairHpPercent < 50 ? '中度损坏' : repairHpPercent < 75 ? '轻微损坏' : '状态良好'}
                  </div>
                </div>

                <Show when={maxRepair > 0}>
                  <div class="p-4 bg-stone-800/60 rounded-lg border border-brass/40">
                    <div class="flex items-center justify-between mb-3">
                      <div class="text-amber-200/80">
                        维修数量: <span class="font-bold text-xl text-amber-300 font-mono">{repairAmount()}</span> HP
                      </div>
                      <div class="text-xs text-amber-200/60">
                        (每HP {repairCostPerPoint}💰)
                      </div>
                    </div>

                    <div class="flex items-center gap-3 mb-3">
                      <button
                        onClick={() => setRepairAmount(Math.max(1, repairAmount() - 10))}
                        class="steampunk-button py-1 px-3 text-sm"
                      >
                        -10
                      </button>
                      <input
                        type="range"
                        min={1}
                        max={maxRepair}
                        value={repairAmount()}
                        onInput={(e) => setRepairAmount(Number(e.currentTarget.value))}
                        class="flex-1 accent-amber-500"
                      />
                      <button
                        onClick={() => setRepairAmount(Math.min(maxRepair, repairAmount() + 10))}
                        class="steampunk-button py-1 px-3 text-sm"
                      >
                        +10
                      </button>
                    </div>

                    <div class="flex gap-2 mb-4">
                      <button onClick={() => setRepairAmount(Math.max(1, Math.floor(maxRepair * 0.25)))} class="steampunk-button py-1 text-xs flex-1">25%</button>
                      <button onClick={() => setRepairAmount(Math.max(1, Math.floor(maxRepair * 0.5)))} class="steampunk-button py-1 text-xs flex-1">50%</button>
                      <button onClick={() => setRepairAmount(Math.max(1, Math.floor(maxRepair * 0.75)))} class="steampunk-button py-1 text-xs flex-1">75%</button>
                      <button onClick={() => setRepairAmount(maxRepair)} class="steampunk-button py-1 text-xs flex-1">全部</button>
                    </div>

                    <div class="flex items-center justify-between p-3 bg-stone-900/60 rounded-lg border border-brass/30">
                      <div>
                        <div class="text-sm text-amber-200/70">维修费用</div>
                        <div class="text-xl font-bold text-red-400 font-mono">
                          -{repairCost.toLocaleString()}💰
                        </div>
                      </div>
                      <button
                        onClick={handleRepair}
                        disabled={processing() || (store.currentPlayer?.wealth || 0) < repairCost}
                        class="steampunk-button text-lg bg-gradient-to-b from-green-600 to-green-700 border-green-500 hover:from-green-500 hover:to-green-600"
                      >
                        {processing() ? '维修中...' : '🔧 立即维修'}
                      </button>
                    </div>
                  </div>
                </Show>

                <Show when={maxRepair === 0}>
                  <div class="text-center p-8 text-green-400">
                    <div class="text-5xl mb-3">✨</div>
                    <div class="text-xl font-bold">飞艇状态完美，无需维修！</div>
                  </div>
                </Show>
              </Show>
            </div>
          </Show>

          <Show when={activeTab() === 'recruit'}>
            <div class="space-y-4">
              <h3 class="text-lg font-bold text-amber-300 flex items-center gap-2">
                👥 船员招募
              </h3>

              <div class="grid gap-3">
                <For each={CREW_ROLES}>
                  {(role) => (
                    <div
                      onClick={() => setSelectedRole(role.role)}
                      class={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedRole() === role.role
                          ? 'border-amber-400 bg-amber-900/20 ring-2 ring-amber-400/30'
                          : 'border-stone-700 bg-stone-800/50 hover:border-stone-500'
                      }`}
                    >
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-3">
                          <span class="text-3xl">{role.icon}</span>
                          <div>
                            <div class="font-bold text-amber-200">{role.label}</div>
                            <div class="text-xs text-amber-200/60">{role.desc}</div>
                          </div>
                        </div>
                        <div class="text-right">
                          <div class="text-lg font-bold text-amber-300 font-mono">
                            {role.cost}💰
                          </div>
                          <div class="text-xs text-amber-200/50">/人</div>
                        </div>
                      </div>
                    </div>
                  )}
                </For>
              </div>

              <div class="p-4 bg-stone-800/60 rounded-lg border border-brass/40">
                <div class="flex items-center justify-between mb-3">
                  <div class="text-amber-200/80">
                    招募数量: <span class="font-bold text-xl text-amber-300 font-mono">{recruitCount()}</span> 名
                  </div>
                </div>
                <div class="flex items-center gap-3 mb-4">
                  <button
                    onClick={() => setRecruitCount(Math.max(1, recruitCount() - 1))}
                    class="w-10 h-10 rounded bg-stone-700 hover:bg-stone-600 text-xl font-bold"
                  >
                    -
                  </button>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={recruitCount()}
                    onInput={(e) => setRecruitCount(Number(e.currentTarget.value))}
                    class="flex-1 accent-amber-500"
                  />
                  <button
                    onClick={() => setRecruitCount(Math.min(10, recruitCount() + 1))}
                    class="w-10 h-10 rounded bg-stone-700 hover:bg-stone-600 text-xl font-bold"
                  >
                    +
                  </button>
                </div>

                <div class="flex items-center justify-between p-3 bg-stone-900/60 rounded-lg border border-brass/30">
                  <div>
                    <div class="text-sm text-amber-200/70">
                      招募 {recruitCount()} 名{CREW_ROLES.find(r => r.role === selectedRole())?.label || '船员'} 总费用
                    </div>
                    <div class="text-xl font-bold text-red-400 font-mono">
                      -{(recruitCount() * CREW_ROLES.find(r => r.role === selectedRole())!.cost).toLocaleString()}💰
                    </div>
                  </div>
                  <button
                    onClick={handleRecruit}
                    disabled={processing() || (store.currentPlayer?.wealth || 0) < recruitCount() * CREW_ROLES.find(r => r.role === selectedRole())!.cost}
                    class="steampunk-button text-lg bg-gradient-to-b from-purple-600 to-purple-700 border-purple-500 hover:from-purple-500 hover:to-purple-600"
                  >
                    {processing() ? '招募中...' : '📜 立即招募'}
                  </button>
                </div>
              </div>
            </div>
          </Show>

          <Show when={activeTab() === 'build'}>
            <div class="space-y-4">
              <h3 class="text-lg font-bold text-amber-300 flex items-center gap-2">
                ⚒️ 飞艇建造与改装
              </h3>

              <div class="p-6 text-center bg-stone-800/60 rounded-lg border border-brass/40">
                <div class="text-6xl mb-4">🚁</div>
                <h4 class="text-xl font-bold text-amber-200 mb-2">飞艇工坊</h4>
                <p class="text-amber-200/70 mb-4 max-w-md mx-auto">
                  在此建造全新的飞艇，或改装现有装备。<br/>
                  选择合适的气囊与模块，打造你的专属战舰！
                </p>
                <button class="steampunk-button text-lg">
                  🔨 打开建造界面
                </button>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default CityPanel;
