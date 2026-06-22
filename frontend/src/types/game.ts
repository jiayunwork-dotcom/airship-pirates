export enum AltitudeLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  EXTREME = 'extreme',
}

export enum ModuleType {
  COCKPIT = 'cockpit',
  GUN_DECK = 'gun_deck',
  CARGO = 'cargo',
  ENGINE = 'engine',
  REPAIR = 'repair',
  LOOKOUT = 'lookout',
}

export enum GasType {
  HYDROGEN = 'hydrogen',
  HELIUM = 'helium',
  HOT_AIR = 'hot_air',
  METHANE = 'methane',
}

export enum WeatherType {
  CLEAR = 'clear',
  WINDY = 'windy',
  STORM = 'storm',
  FOG = 'fog',
  TURBULENCE = 'turbulence',
  SANDSTORM = 'sandstorm',
}

export enum ActionType {
  MOVE = 'move',
  CHANGE_ALTITUDE = 'change_altitude',
  TRADE = 'trade',
  SET_TOLL = 'set_toll',
  REPAIR = 'repair',
  RECRUIT_CREW = 'recruit_crew',
  PATROL = 'patrol',
  ATTACK = 'attack',
  BOARD = 'board',
  RETREAT = 'retreat',
}

export enum BattlePhase {
  INITIATION = 'initiation',
  RANGED = 'ranged',
  BOARDING = 'boarding',
  RESOLUTION = 'resolution',
  ENDED = 'ended',
}

export enum ShipStatus {
  DOCKED = 'docked',
  FLYING = 'flying',
  BATTLING = 'battling',
  DAMAGED = 'damaged',
  DISABLED = 'disabled',
  DESTROYED = 'destroyed',
}

export enum CityType {
  CAPITAL = 'capital',
  TRADE_HUB = 'trade_hub',
  INDUSTRIAL = 'industrial',
  MINING = 'mining',
  AGRICULTURAL = 'agricultural',
  MILITARY = 'military',
  PIRATE_HAVEN = 'pirate_haven',
}

export enum CargoType {
  FOOD = 'food',
  FUEL = 'fuel',
  METALS = 'metals',
  TEXTILES = 'textiles',
  GEMS = 'gems',
  WEAPONS = 'weapons',
  LUXURIES = 'luxuries',
  MEDICINE = 'medicine',
}

export enum CrewRole {
  CAPTAIN = 'captain',
  PILOT = 'pilot',
  GUNNER = 'gunner',
  ENGINEER = 'engineer',
  NAVIGATOR = 'navigator',
  MEDIC = 'medic',
  MARINE = 'marine',
  CREWMAN = 'crewman',
}

export enum ModuleTarget {
  BALLOON = 'balloon',
  COCKPIT = 'cockpit',
  GUN_DECK = 'gun_deck',
  ENGINE = 'engine',
  CARGO = 'cargo',
  ANY = 'any',
}

export interface Position {
  x: number;
  y: number;
}

export interface GasBalloon {
  gas_type: GasType;
  buoyancy: number;
  durability: number;
  max_durability: number;
  flammable: boolean;
  on_fire?: boolean;
  fire_damage_remaining?: number;
}

export interface ShipModule {
  module_type: ModuleType;
  name: string;
  weight: number;
  durability: number;
  max_durability: number;
  level: number;
  active: boolean;
  gun_count?: number;
  gun_damage?: number;
  cargo_capacity?: number;
  engine_power?: number;
  repair_rate?: number;
  detection_range?: number;
  crew_capacity?: number;
  armor?: number;
}

export interface CrewMember {
  id: string;
  name: string;
  role: CrewRole;
  skill: number;
  health: number;
  morale: number;
}

export interface CargoItem {
  type: CargoType;
  amount: number;
  base_value: number;
}

export interface Player {
  id: string;
  name: string;
  wealth: number;
  reputation: number;
  fleet_ids: string[];
  alliances: string[];
  city_reputations: Record<string, number>;
  ready: boolean;
  color: string;
  score: number;
}

export interface Airship {
  id: string;
  name: string;
  player_id: string;
  gas_balloon: GasBalloon;
  modules: ShipModule[];
  crew: Record<string, CrewMember>;
  position: Position;
  altitude: AltitudeLevel;
  heading: number;
  speed: number;
  target_position?: Position | null;
  target_altitude?: AltitudeLevel | null;
  status: ShipStatus;
  hp: number;
  max_hp: number;
  morale: number;
  cargo: CargoItem[];
  current_city_id?: string | null;
  in_battle_id?: string | null;
  effects: Record<string, any>[];
}

export interface TradeGood {
  type: CargoType;
  supply: number;
  demand: number;
  buy_price: number;
  sell_price: number;
}

export interface City {
  id: string;
  name: string;
  type: CityType;
  position: Position;
  trade_goods: TradeGood[];
  demands: CargoType[];
  patrol_strength: number;
  connections: string[];
  controller_player_id?: string | null;
  tax_rate: number;
  garrison: number;
}

export interface Waypoint {
  id: string;
  from_city: string;
  to_city: string;
  position: Position;
  toll_player_id?: string | null;
  toll_amount: number;
  controlled: boolean;
}

export interface Weather {
  type: WeatherType;
  intensity: number;
  position: Position;
  radius: number;
  wind_direction: number;
  wind_speed: number;
}

export interface BattleActionRecord {
  turn: number;
  action_type: string;
  attacker_ship_id: string;
  attacker_ship_name: string;
  defender_ship_id: string;
  defender_ship_name: string;
  target_module: string;
  damage: number;
  hit: boolean;
  special_effect: string;
  category: 'attack' | 'defense' | 'neutral';
}

export interface BattleReport {
  id: string;
  battle_id: string;
  attacker_ship_id: string;
  attacker_ship_name: string;
  attacker_player_id: string;
  defender_ship_id: string;
  defender_ship_name: string;
  defender_player_id: string;
  result: string;
  winner_player_id: string | null;
  winner_ship_name: string;
  duration_turns: number;
  action_records: BattleActionRecord[];
  is_sink: boolean;
  is_capture: boolean;
  turn_number: number;
}

export interface BattleAction {
  type: ActionType;
  target_module?: ModuleTarget | null;
  weapon_type?: string | null;
  target_ship_id?: string | null;
  params: Record<string, any>;
}

export interface Battle {
  id: string;
  ship_a_id: string;
  ship_b_id: string;
  phase: BattlePhase;
  turn: number;
  attacker_actions: BattleAction[];
  defender_actions: BattleAction[];
  log: string[];
  winner?: string | null;
  ship_a_morale: number;
  ship_b_morale: number;
  ship_a_boarded: boolean;
  ship_b_boarded: boolean;
  smoke_screen_active: boolean;
  smoke_screen_turns: number;
}

export interface Order {
  player_id: string;
  ship_id: string;
  type: ActionType;
  params: Record<string, any>;
}

export interface GameState {
  room_id: string;
  players: Player[];
  airships: Airship[];
  cities: City[];
  waypoints: Waypoint[];
  weather: Weather[];
  forecast: Weather[];
  turn: number;
  max_turns: number;
  phase: 'lobby' | 'orders' | 'processing' | 'battle' | 'ended';
  battles: Battle[];
  pending_orders: Order[];
  winner?: string | null;
  scores: Record<string, number>;
  event_log: string[];
  battle_reports: BattleReport[];
  created_at: string;
}

export interface RoomPlayer {
  id: string;
  name: string;
  color: string;
  ready: boolean;
}

export interface Room {
  id: string;
  name: string;
  maxPlayers: number;
  currentPlayers: number;
  players: RoomPlayer[];
  started: boolean;
  hostId: string;
  turn: number;
}

export interface WSMessage {
  type: string;
  data?: any;
  [key: string]: any;
}
