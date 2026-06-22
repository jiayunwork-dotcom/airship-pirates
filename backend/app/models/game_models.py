from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime


class AltitudeLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    EXTREME = "extreme"


class ModuleType(str, Enum):
    COCKPIT = "cockpit"
    GUN_DECK = "gun_deck"
    CARGO = "cargo"
    ENGINE = "engine"
    REPAIR = "repair"
    LOOKOUT = "lookout"


class GasType(str, Enum):
    HYDROGEN = "hydrogen"
    HELIUM = "helium"
    HOT_AIR = "hot_air"
    METHANE = "methane"


class WeatherType(str, Enum):
    CLEAR = "clear"
    WINDY = "windy"
    STORM = "storm"
    FOG = "fog"
    TURBULENCE = "turbulence"
    SANDSTORM = "sandstorm"


class ActionType(str, Enum):
    MOVE = "move"
    CHANGE_ALTITUDE = "change_altitude"
    TRADE = "trade"
    SET_TOLL = "set_toll"
    REPAIR = "repair"
    RECRUIT_CREW = "recruit_crew"
    PATROL = "patrol"
    ATTACK = "attack"
    BOARD = "board"
    RETREAT = "retreat"


class BattlePhase(str, Enum):
    INITIATION = "initiation"
    RANGED = "ranged"
    BOARDING = "boarding"
    RESOLUTION = "resolution"
    ENDED = "ended"


class JointCombatStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    BETRAYED = "betrayed"


class ShipStatus(str, Enum):
    DOCKED = "docked"
    FLYING = "flying"
    BATTLING = "battling"
    DAMAGED = "damaged"
    DISABLED = "disabled"
    DESTROYED = "destroyed"


class CityType(str, Enum):
    CAPITAL = "capital"
    TRADE_HUB = "trade_hub"
    INDUSTRIAL = "industrial"
    MINING = "mining"
    AGRICULTURAL = "agricultural"
    MILITARY = "military"
    PIRATE_HAVEN = "pirate_haven"


class CargoType(str, Enum):
    FOOD = "food"
    FUEL = "fuel"
    METALS = "metals"
    TEXTILES = "textiles"
    GEMS = "gems"
    WEAPONS = "weapons"
    LUXURIES = "luxuries"
    MEDICINE = "medicine"


class CrewRole(str, Enum):
    CAPTAIN = "captain"
    PILOT = "pilot"
    GUNNER = "gunner"
    ENGINEER = "engineer"
    NAVIGATOR = "navigator"
    MEDIC = "medic"
    MARINE = "marine"
    CREWMAN = "crewman"


class ModuleTarget(str, Enum):
    BALLOON = "balloon"
    COCKPIT = "cockpit"
    GUN_DECK = "gun_deck"
    ENGINE = "engine"
    CARGO = "cargo"
    ANY = "any"


class Position(BaseModel):
    model_config = ConfigDict(extra="allow")
    x: float = 0.0
    y: float = 0.0


class GasBalloon(BaseModel):
    model_config = ConfigDict(extra="allow")
    gas_type: GasType = GasType.HYDROGEN
    buoyancy: float = 100.0
    durability: int = 100
    max_durability: int = 100
    flammable: bool = True
    on_fire: bool = False
    fire_damage_remaining: int = 0


class ShipModule(BaseModel):
    model_config = ConfigDict(extra="allow")
    module_type: ModuleType
    name: str = ""
    weight: float = 10.0
    durability: int = 50
    max_durability: int = 50
    level: int = 1
    active: bool = True
    
    gun_count: Optional[int] = None
    gun_damage: Optional[int] = None
    cargo_capacity: Optional[int] = None
    engine_power: Optional[float] = None
    repair_rate: Optional[int] = None
    detection_range: Optional[float] = None
    crew_capacity: Optional[int] = None
    armor: Optional[int] = None


class CrewMember(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    name: str
    role: CrewRole = CrewRole.CREWMAN
    skill: int = 50
    health: int = 100
    morale: int = 80


class Cargo(BaseModel):
    model_config = ConfigDict(extra="allow")
    type: CargoType
    amount: int = 0
    base_value: int = 0


class Player(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    name: str
    wealth: int = 5000
    reputation: int = 50
    fleet_ids: List[str] = Field(default_factory=list)
    alliances: List[str] = Field(default_factory=list)
    city_reputations: Dict[str, int] = Field(default_factory=dict)
    ready: bool = False
    color: str = "#3498db"
    score: int = 0
    traitor_debuff_turns: int = 0
    suggested_headings: Dict[str, Dict[str, Any]] = Field(default_factory=dict)


class Airship(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    name: str
    player_id: str
    gas_balloon: GasBalloon = Field(default_factory=GasBalloon)
    modules: List[ShipModule] = Field(default_factory=list)
    crew: Dict[str, CrewMember] = Field(default_factory=dict)
    position: Position = Field(default_factory=Position)
    altitude: AltitudeLevel = AltitudeLevel.MEDIUM
    heading: float = 0.0
    speed: float = 0.0
    target_position: Optional[Position] = None
    target_altitude: Optional[AltitudeLevel] = None
    status: ShipStatus = ShipStatus.DOCKED
    hp: int = 100
    max_hp: int = 100
    morale: int = 80
    cargo: List[Cargo] = Field(default_factory=list)
    current_city_id: Optional[str] = None
    in_battle_id: Optional[str] = None
    effects: List[Dict[str, Any]] = Field(default_factory=list)


class TradeGood(BaseModel):
    model_config = ConfigDict(extra="allow")
    type: CargoType
    supply: int = 0
    demand: int = 0
    buy_price: int = 0
    sell_price: int = 0


class City(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    name: str
    type: CityType = CityType.TRADE_HUB
    position: Position = Field(default_factory=Position)
    trade_goods: List[TradeGood] = Field(default_factory=list)
    demands: List[CargoType] = Field(default_factory=list)
    patrol_strength: int = 10
    connections: List[str] = Field(default_factory=list)
    controller_player_id: Optional[str] = None
    tax_rate: float = 0.05
    garrison: int = 50


class Waypoint(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    from_city: str
    to_city: str
    position: Position = Field(default_factory=Position)
    toll_player_id: Optional[str] = None
    toll_amount: int = 0
    controlled: bool = False


class Weather(BaseModel):
    model_config = ConfigDict(extra="allow")
    type: WeatherType = WeatherType.CLEAR
    intensity: float = 0.0
    position: Position = Field(default_factory=Position)
    radius: float = 50.0
    wind_direction: float = 0.0
    wind_speed: float = 0.0


class BattleActionRecord(BaseModel):
    model_config = ConfigDict(extra="allow")
    turn: int = 0
    action_type: str = "attack"
    attacker_ship_id: str = ""
    attacker_ship_name: str = ""
    defender_ship_id: str = ""
    defender_ship_name: str = ""
    target_module: str = ""
    damage: int = 0
    hit: bool = True
    special_effect: str = ""
    category: str = "attack"


class BattleReport(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str = ""
    battle_id: str = ""
    attacker_ship_id: str = ""
    attacker_ship_name: str = ""
    attacker_player_id: str = ""
    defender_ship_id: str = ""
    defender_ship_name: str = ""
    defender_player_id: str = ""
    result: str = ""
    winner_player_id: Optional[str] = None
    winner_ship_name: str = ""
    duration_turns: int = 0
    action_records: List[BattleActionRecord] = Field(default_factory=list)
    is_sink: bool = False
    is_capture: bool = False
    turn_number: int = 0
    is_joint_combat: bool = False
    attacker_b_ship_id: str = ""
    attacker_b_ship_name: str = ""
    attacker_b_player_id: str = ""
    loot_split: Dict[str, int] = Field(default_factory=dict)


class Alliance(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    player_a_id: str
    player_b_id: str
    trust_level: int = 1
    turns_without_betrayal: int = 0
    created_at_turn: int = 0
    active: bool = True


class PendingInvite(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    from_player_id: str
    from_player_name: str
    to_player_id: str
    created_at_turn: int = 0


class JointCombatProposal(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    proposer_id: str
    ally_id: str
    target_player_id: str
    attack_turn: int = 0
    status: JointCombatStatus = JointCombatStatus.PENDING
    proposer_ship_id: str = ""
    ally_ship_id: str = ""
    target_ship_id: str = ""
    created_at_turn: int = 0


class WaypointPassRecord(BaseModel):
    model_config = ConfigDict(extra="allow")
    waypoint_id: str
    passing_player_id: str
    passing_ship_name: str
    turn: int = 0


class BattleAction(BaseModel):
    model_config = ConfigDict(extra="allow")
    type: ActionType
    target_module: Optional[ModuleTarget] = ModuleTarget.ANY
    weapon_type: Optional[str] = None
    target_ship_id: Optional[str] = None
    params: Dict[str, Any] = Field(default_factory=dict)


class Battle(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    ship_a_id: str
    ship_b_id: str
    phase: BattlePhase = BattlePhase.INITIATION
    turn: int = 0
    attacker_actions: List[BattleAction] = Field(default_factory=list)
    defender_actions: List[BattleAction] = Field(default_factory=list)
    log: List[str] = Field(default_factory=list)
    winner: Optional[str] = None
    ship_a_morale: int = 80
    ship_b_morale: int = 80
    ship_a_boarded: bool = False
    ship_b_boarded: bool = False
    smoke_screen_active: bool = False
    smoke_screen_turns: int = 0
    is_joint_combat: bool = False
    ship_c_id: Optional[str] = None
    ship_c_morale: int = 80
    ship_c_actions: List[BattleAction] = Field(default_factory=list)
    defender_facing: str = "port"
    attacker_a_damage_total: int = 0
    attacker_b_damage_total: int = 0


class Order(BaseModel):
    model_config = ConfigDict(extra="allow")
    player_id: str
    ship_id: str
    type: ActionType
    params: Dict[str, Any] = Field(default_factory=dict)


class GameState(BaseModel):
    model_config = ConfigDict(extra="allow")
    room_id: str
    players: List[Player] = Field(default_factory=list)
    airships: List[Airship] = Field(default_factory=list)
    cities: List[City] = Field(default_factory=list)
    waypoints: List[Waypoint] = Field(default_factory=list)
    weather: List[Weather] = Field(default_factory=list)
    forecast: List[Weather] = Field(default_factory=list)
    turn: int = 0
    max_turns: int = 30
    phase: str = "lobby"
    battles: List[Battle] = Field(default_factory=list)
    pending_orders: List[Order] = Field(default_factory=list)
    winner: Optional[str] = None
    scores: Dict[str, int] = Field(default_factory=dict)
    event_log: List[str] = Field(default_factory=list)
    battle_reports: List[BattleReport] = Field(default_factory=list)
    alliances: List[Alliance] = Field(default_factory=list)
    pending_invites: List[PendingInvite] = Field(default_factory=list)
    waypoint_pass_records: List[WaypointPassRecord] = Field(default_factory=list)
    joint_combat_proposals: List[JointCombatProposal] = Field(default_factory=list)
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class RoomCreateRequest(BaseModel):
    room_id: str
    player_count: int = 4


class JoinRoomRequest(BaseModel):
    player_id: str
    player_name: str
    color: Optional[str] = None


class OrdersSubmitRequest(BaseModel):
    player_id: str
    orders: List[Order]


class BattleActionsSubmitRequest(BaseModel):
    player_id: str
    battle_id: str
    actions: List[BattleAction]


class InviteAllianceRequest(BaseModel):
    player_id: str
    target_player_id: str


class RespondInviteRequest(BaseModel):
    player_id: str
    invite_id: str
    accept: bool


class DissolveAllianceRequest(BaseModel):
    player_id: str
    ally_player_id: str


class SuggestHeadingRequest(BaseModel):
    player_id: str
    ally_player_id: str
    ship_id: str
    target_position: Dict[str, float]


class JointCombatProposalRequest(BaseModel):
    player_id: str
    ally_player_id: str
    target_player_id: str
    attack_turn: int
    proposer_ship_id: str = ""
    ally_ship_id: str = ""
    target_ship_id: str = ""


class JointCombatConfirmRequest(BaseModel):
    player_id: str
    proposal_id: str
    accept: bool = True
