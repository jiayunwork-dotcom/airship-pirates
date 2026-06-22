import { Component, createSignal, createMemo, For, Show } from 'solid-js';
import { GameProvider, useGameStore } from './store/gameStore';
import type { City, Airship, Battle } from './types/game';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';
import BattleScreen from './components/BattleScreen';
import CityPanel from './components/CityPanel';

type ViewMode = 'home' | 'game';

const NotificationToast: Component = () => {
  const store = useGameStore();
  return (
    <div class="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <For each={store.notifications}>
        {(msg) => (
          <div class="steampunk-panel px-4 py-2 text-amber-100 shadow-lg animate-pulse-slow pointer-events-auto">
            {msg}
          </div>
        )}
      </For>
      <Show when={store.error}>
        <div class="steampunk-panel px-4 py-3 text-red-300 shadow-lg border-red-500 pointer-events-auto">
          <div class="flex items-center gap-3">
            <span class="font-bold">错误：</span>
            <span>{store.error}</span>
            <button
              onClick={store.clearError}
              class="ml-2 text-red-200 hover:text-red-100 text-xl leading-none"
            >
              ×
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
};

const ConnectionStatus: Component = () => {
  const store = useGameStore();
  return (
    <div class="fixed top-2 left-4 z-40 flex items-center gap-2 text-sm">
      <span
        class={`inline-block w-3 h-3 rounded-full ${
          store.isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
        }`}
      />
      <span class="text-amber-200">
        {store.isConnected ? '已连接' : '未连接'}
      </span>
    </div>
  );
};

const GameUI: Component = () => {
  const store = useGameStore();

  const currentCity = createMemo(() => {
    if (!store.selectedCityId || !store.gameState) return null;
    return store.gameState.cities.find((c: City) => c.id === store.selectedCityId) || null;
  });

  const currentAirship = createMemo(() => {
    if (!store.selectedAirshipId || !store.gameState) return null;
    return store.gameState.airships.find((a: Airship) => a.id === store.selectedAirshipId) || null;
  });

  const currentBattle = createMemo(() => {
    if (!store.activeBattleId || !store.gameState) return null;
    return store.gameState.battles.find((b: Battle) => b.id === store.activeBattleId) || null;
  });

  const isCityPanelOpen = createMemo(() => {
    const city = currentCity();
    const airship = currentAirship();
    if (!city || !airship) return false;
    return Math.abs(airship.position.x - city.position.x) < 30 && Math.abs(airship.position.y - city.position.y) < 30;
  });

  return (
    <>
      <Show when={isCityPanelOpen() && currentCity() && currentAirship() && store.currentPlayer}>
        <CityPanel
          city={currentCity()!}
          airship={currentAirship()!}
          playerId={store.currentPlayer!.id}
          onClose={() => store.setSelectedCity(null)}
        />
      </Show>

      <Show when={currentBattle() && store.currentPlayer}>
        <BattleScreen
          battle={currentBattle()!}
          playerId={store.currentPlayer!.id}
          onClose={() => store.setActiveBattle(null)}
          onSubmitAction={store.submitBattleAction}
        />
      </Show>
    </>
  );
};

interface GameContentProps {
  onNavigateHome: () => void;
}

const GameContentView: Component<GameContentProps> = (props) => {
  const store = useGameStore();

  return (
    <div class="w-full h-full relative min-h-screen">
      <NotificationToast />
      <ConnectionStatus />
      <Show
        when={store.gameState && store.currentRoom}
        fallback={
          <div class="w-full h-full flex items-center justify-center min-h-screen">
            <div class="steampunk-panel p-8 text-center">
              <h2 class="text-2xl text-amber-200 mb-4">游戏未开始或房间不存在</h2>
              <button class="steampunk-button" onClick={props.onNavigateHome}>
                返回大厅
              </button>
            </div>
          </div>
        }
      >
        <GameBoard onLeaveHome={props.onNavigateHome} />
      </Show>
      <GameUI />
    </div>
  );
};

interface AppContentProps {
  view: () => ViewMode;
  setView: (v: ViewMode) => void;
}

const AppContent: Component<AppContentProps> = (props) => {
  return (
    <div class="w-full h-full relative min-h-screen">
      <NotificationToast />
      <ConnectionStatus />

      <Show when={props.view() === 'home'}>
        <Lobby onNavigateToGame={() => props.setView('game')} />
      </Show>

      <Show when={props.view() === 'game'}>
        <GameContentView onNavigateHome={() => props.setView('home')} />
      </Show>

      <Show when={props.view() === 'game'}>
        <GameUI />
      </Show>
    </div>
  );
};

const App: Component = () => {
  const [view, setView] = createSignal<ViewMode>('home');

  return (
    <GameProvider>
      <AppContent view={view} setView={setView} />
    </GameProvider>
  );
};

export default App;
