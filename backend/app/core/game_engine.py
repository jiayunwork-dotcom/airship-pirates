import math
import random
import uuid
from typing import List, Dict, Optional, Tuple
from app.models.game_models import (
    GameState, Player, Airship, City, Waypoint, Weather, Battle, BattleAction,
    Order, GasBalloon, ShipModule, CrewMember, Cargo, TradeGood, Position,
    AltitudeLevel, ModuleType, GasType, WeatherType, ActionType, BattlePhase,
    ShipStatus, CityType, CargoType, CrewRole, ModuleTarget,
    BattleActionRecord, BattleReport, Alliance, PendingInvite, WaypointPassRecord,
    JointCombatProposal, JointCombatStatus
)
from app.core.config import settings


def _generate_id() -> str:
    return str(uuid.uuid4())[:8]


def _distance(a: Position, b: Position) -> float:
    return math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)


def _move_toward(current: Position, target: Position, speed: float) -> Position:
    dist = _distance(current, target)
    if dist <= speed or dist == 0:
        return Position(x=target.x, y=target.y)
    ratio = speed / dist
    return Position(
        x=current.x + (target.x - current.x) * ratio,
        y=current.y + (target.y - current.y) * ratio
    )


def _create_cities() -> List[City]:
    city_configs = [
        ("Aethermoor", CityType.CAPITAL, 500, 500),
        ("Ironspire", CityType.INDUSTRIAL, 150, 200),
        ("Verdant Reach", CityType.AGRICULTURAL, 800, 150),
        ("Cinderfall", CityType.MINING, 100, 800),
        ("Goldenshore", CityType.TRADE_HUB, 900, 600),
        ("Stormwatch", CityType.MILITARY, 300, 900),
        ("Cloudrest", CityType.TRADE_HUB, 600, 300),
        ("Skull Harbor", CityType.PIRATE_HAVEN, 450, 700),
        ("Sunspire", CityType.CAPITAL, 200, 500),
        ("Windhaven", CityType.TRADE_HUB, 750, 850),
    ]
    
    cities = []
    all_goods = list(CargoType)
    
    for idx, (name, city_type, x, y) in enumerate(city_configs):
        city_id = f"city_{idx + 1}"
        trade_goods = []
        available_goods = random.sample(all_goods, k=min(5, len(all_goods)))
        demands = random.sample([g for g in all_goods if g not in available_goods], k=min(3, len(all_goods) - len(available_goods)))
        
        for good_type in available_goods:
            base_price = random.randint(50, 500)
            supply = random.randint(50, 200)
            demand = random.randint(10, 60)
            ratio = supply / max(demand, 1)
            buy_price = int(base_price * (0.7 + ratio * 0.3))
            sell_price = int(base_price * (1.3 - min(ratio * 0.3, 0.5)))
            trade_goods.append(TradeGood(
                type=good_type,
                supply=supply,
                demand=demand,
                buy_price=buy_price,
                sell_price=sell_price
            ))
        
        connections = []
        for j in range(len(city_configs)):
            if j != idx:
                other_x, other_y = city_configs[j][2], city_configs[j][3]
                dist = math.sqrt((x - other_x) ** 2 + (y - other_y) ** 2)
                if dist < 400:
                    connections.append(f"city_{j + 1}")
        
        cities.append(City(
            id=city_id,
            name=name,
            type=city_type,
            position=Position(x=float(x), y=float(y)),
            trade_goods=trade_goods,
            demands=demands,
            patrol_strength=random.randint(5, 25) if city_type != CityType.MILITARY else random.randint(25, 50),
            connections=connections,
            tax_rate=0.05,
            garrison=random.randint(30, 100)
        ))
    
    return cities


def _create_waypoints(cities: List[City]) -> List[Waypoint]:
    waypoints = []
    wp_idx = 0
    seen_pairs = set()
    
    for city in cities:
        for conn_id in city.connections:
            pair = tuple(sorted([city.id, conn_id]))
            if pair in seen_pairs:
                continue
            seen_pairs.add(pair)
            
            target_city = next((c for c in cities if c.id == conn_id), None)
            if not target_city:
                continue
                
            mid_x = (city.position.x + target_city.position.x) / 2
            mid_y = (city.position.y + target_city.position.y) / 2
            
            waypoints.append(Waypoint(
                id=f"waypoint_{wp_idx}",
                from_city=city.id,
                to_city=conn_id,
                position=Position(x=mid_x, y=mid_y),
                toll_amount=0
            ))
            wp_idx += 1
    
    return waypoints


def _create_default_airship(player_id: str, name: str, start_pos: Position, city_id: str) -> Airship:
    ship_id = f"ship_{player_id}_{_generate_id()}"
    
    gas_types = [GasType.HYDROGEN, GasType.HELIUM, GasType.HOT_AIR, GasType.METHANE]
    gas_type = random.choice(gas_types)
    
    balloon_configs = {
        GasType.HYDROGEN: (120.0, 90, True),
        GasType.HELIUM: (100.0, 110, False),
        GasType.HOT_AIR: (80.0, 80, False),
        GasType.METHANE: (110.0, 85, True),
    }
    buoyancy, max_dur, flammable = balloon_configs[gas_type]
    
    modules = [
        ShipModule(
            module_type=ModuleType.COCKPIT,
            name="Command Cockpit",
            weight=15.0,
            durability=80,
            max_durability=80,
            level=1,
            crew_capacity=4,
            armor=5
        ),
        ShipModule(
            module_type=ModuleType.GUN_DECK,
            name="Main Gun Deck",
            weight=25.0,
            durability=70,
            max_durability=70,
            level=1,
            gun_count=4,
            gun_damage=15,
            crew_capacity=8
        ),
        ShipModule(
            module_type=ModuleType.CARGO,
            name="Standard Cargo Bay",
            weight=10.0,
            durability=60,
            max_durability=60,
            level=1,
            cargo_capacity=100
        ),
        ShipModule(
            module_type=ModuleType.ENGINE,
            name="Propulsion Engine",
            weight=30.0,
            durability=65,
            max_durability=65,
            level=1,
            engine_power=15.0
        ),
        ShipModule(
            module_type=ModuleType.REPAIR,
            name="Workshop Module",
            weight=12.0,
            durability=55,
            max_durability=55,
            level=1,
            repair_rate=10
        ),
        ShipModule(
            module_type=ModuleType.LOOKOUT,
            name="Crow's Nest",
            weight=5.0,
            durability=40,
            max_durability=40,
            level=1,
            detection_range=80.0,
            crew_capacity=2
        ),
    ]
    
    crew = {}
    roles = [
        (CrewRole.CAPTAIN, 1, 80),
        (CrewRole.PILOT, 1, 70),
        (CrewRole.GUNNER, 2, 65),
        (CrewRole.ENGINEER, 1, 60),
        (CrewRole.NAVIGATOR, 1, 65),
        (CrewRole.MEDIC, 1, 60),
        (CrewRole.MARINE, 4, 70),
        (CrewRole.CREWMAN, 5, 50),
    ]
    
    crew_idx = 0
    names = ["James", "William", "Elizabeth", "Sarah", "Thomas", "Anne", "Robert", "Catherine",
             "Edward", "Margaret", "Henry", "Mary", "George", "Charlotte", "Richard", "Emma"]
    
    for role, count, skill_base in roles:
        for _ in range(count):
            cid = f"crew_{ship_id}_{crew_idx}"
            crew[cid] = CrewMember(
                id=cid,
                name=random.choice(names),
                role=role,
                skill=random.randint(skill_base - 15, skill_base + 15),
                health=100,
                morale=random.randint(70, 90)
            )
            crew_idx += 1
    
    return Airship(
        id=ship_id,
        name=name,
        player_id=player_id,
        gas_balloon=GasBalloon(
            gas_type=gas_type,
            buoyancy=buoyancy,
            durability=max_dur,
            max_durability=max_dur,
            flammable=flammable
        ),
        modules=modules,
        crew=crew,
        position=Position(x=start_pos.x, y=start_pos.y),
        current_city_id=city_id,
        status=ShipStatus.DOCKED,
        hp=100,
        max_hp=100,
        morale=80
    )


def _create_weather(cities: List[City]) -> Tuple[List[Weather], List[Weather]]:
    weather_types = list(WeatherType)
    current = []
    forecast = []
    
    for _ in range(3):
        wtype = random.choice(weather_types)
        intensity = random.uniform(0.3, 1.0)
        city = random.choice(cities)
        offset_x = random.uniform(-150, 150)
        offset_y = random.uniform(-150, 150)
        
        w = Weather(
            type=wtype,
            intensity=intensity,
            position=Position(
                x=city.position.x + offset_x,
                y=city.position.y + offset_y
            ),
            radius=random.uniform(60, 150),
            wind_direction=random.uniform(0, 360),
            wind_speed=random.uniform(0, 20) * intensity
        )
        current.append(w)
    
    for _ in range(2):
        wtype = random.choice(weather_types)
        intensity = random.uniform(0.2, 0.9)
        city = random.choice(cities)
        offset_x = random.uniform(-150, 150)
        offset_y = random.uniform(-150, 150)
        
        w = Weather(
            type=wtype,
            intensity=intensity,
            position=Position(
                x=city.position.x + offset_x,
                y=city.position.y + offset_y
            ),
            radius=random.uniform(50, 130),
            wind_direction=random.uniform(0, 360),
            wind_speed=random.uniform(0, 18) * intensity
        )
        forecast.append(w)
    
    return current, forecast


def initialize_game(room_id: str, player_count: int) -> GameState:
    player_count = max(settings.min_players_per_room, min(player_count, settings.max_players_per_room))
    
    cities = _create_cities()
    waypoints = _create_waypoints(cities)
    current_weather, forecast = _create_weather(cities)
    
    game_state = GameState(
        room_id=room_id,
        players=[],
        airships=[],
        cities=cities,
        waypoints=waypoints,
        weather=current_weather,
        forecast=forecast,
        turn=0,
        max_turns=settings.max_turns,
        phase="lobby",
        battles=[],
        pending_orders=[],
        winner=None,
        scores={},
        event_log=[f"Game room {room_id} created. Waiting for {player_count} players..."]
    )
    
    return game_state


def assign_player_to_game(state: GameState, player_id: str, player_name: str, color: str = "#3498db") -> GameState:
    colors = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6", "#1abc9c"]
    
    player = Player(
        id=player_id,
        name=player_name,
        wealth=settings.default_player_wealth,
        reputation=settings.default_player_reputation,
        fleet_ids=[],
        alliances=[],
        city_reputations={city.id: 50 for city in state.cities},
        ready=False,
        color=color if color else colors[len(state.players) % len(colors)],
        score=0
    )
    state.players.append(player)
    
    start_city = random.choice([c for c in state.cities if c.type in [CityType.CAPITAL, CityType.TRADE_HUB]])
    ship_name = f"{player_name}'s Reaver"
    airship = _create_default_airship(player_id, ship_name, start_city.position, start_city.id)
    state.airships.append(airship)
    player.fleet_ids.append(airship.id)
    
    state.event_log.append(f"Player {player_name} joined the game. Starting at {start_city.name}")
    
    return state


def _resolve_single_movement(airship: Airship, order: Order, state: GameState) -> Airship:
    if airship.status in [ShipStatus.DESTROYED, ShipStatus.DISABLED, ShipStatus.BATTLING]:
        return airship
    
    params = order.params
    
    if "target_position" in params:
        target = Position(**params["target_position"])
        airship.target_position = target
        airship.status = ShipStatus.FLYING
        airship.current_city_id = None
    
    if "target_altitude" in params:
        airship.target_altitude = AltitudeLevel(params["target_altitude"])
    
    if airship.target_altitude and airship.altitude != airship.target_altitude:
        airship.altitude = airship.target_altitude
        airship.target_altitude = None
        state.event_log.append(f"Ship {airship.name} changed altitude to {airship.altitude.value}")
    
    if airship.target_position and airship.status == ShipStatus.FLYING:
        engine_mod = next((m for m in airship.modules if m.module_type == ModuleType.ENGINE and m.active), None)
        base_speed = settings.movement_base_speed
        if engine_mod and engine_mod.engine_power:
            base_speed += engine_mod.engine_power * 0.3
        
        altitude_modifiers = {
            AltitudeLevel.LOW: 0.8,
            AltitudeLevel.MEDIUM: 1.0,
            AltitudeLevel.HIGH: 1.2,
            AltitudeLevel.EXTREME: 1.5,
        }
        speed = base_speed * altitude_modifiers.get(airship.altitude, 1.0)
        
        total_weight = sum(m.weight for m in airship.modules)
        buoyancy = airship.gas_balloon.buoyancy
        if total_weight > buoyancy:
            speed *= 0.6
        
        airship.position = _move_toward(airship.position, airship.target_position, speed)
        airship.speed = speed
        
        for city in state.cities:
            if _distance(airship.position, city.position) < 30:
                airship.current_city_id = city.id
                airship.status = ShipStatus.DOCKED
                airship.target_position = None
                airship.position = Position(x=city.position.x, y=city.position.y)
                state.event_log.append(f"Ship {airship.name} docked at {city.name}")
                break
        
        for wp in state.waypoints:
            if _distance(airship.position, wp.position) < 20:
                if wp.toll_player_id and wp.toll_player_id != airship.player_id:
                    if _handle_waypoint_toll_for_ally(state, airship, wp):
                        state.event_log.append(f"Ship {airship.name} passed through allied waypoint {wp.id} (no toll)")
                    else:
                        toll = wp.toll_amount
                        payer = next((p for p in state.players if p.id == airship.player_id), None)
                        receiver = next((p for p in state.players if p.id == wp.toll_player_id), None)
                        if payer and receiver and payer.wealth >= toll:
                            payer.wealth -= toll
                            receiver.wealth += toll
                            state.event_log.append(f"Ship {airship.name} paid toll of {toll} at waypoint {wp.id}")
    
    return airship


def _apply_weather_effects(state: GameState) -> None:
    for airship in state.airships:
        if airship.status == ShipStatus.DESTROYED:
            continue
            
        for weather in state.weather:
            dist = _distance(airship.position, weather.position)
            if dist > weather.radius:
                continue
            
            intensity_factor = weather.intensity * (1 - dist / weather.radius)
            
            if weather.type == WeatherType.WINDY or weather.type == WeatherType.STORM:
                wind_rad = math.radians(weather.wind_direction)
                drift = weather.wind_speed * intensity_factor * 0.5
                if airship.status == ShipStatus.FLYING:
                    airship.position.x += math.cos(wind_rad) * drift
                    airship.position.y += math.sin(wind_rad) * drift
            
            if weather.type == WeatherType.STORM and airship.status == ShipStatus.FLYING:
                damage = int(8 * intensity_factor)
                if damage > 0:
                    airship.hp = max(0, airship.hp - damage)
                    airship.gas_balloon.durability = max(0, airship.gas_balloon.durability - int(damage * 0.5))
                    if airship.hp == 0:
                        airship.status = ShipStatus.DESTROYED
                        state.event_log.append(f"Ship {airship.name} destroyed in storm!")
                    elif airship.status != ShipStatus.DAMAGED:
                        airship.status = ShipStatus.DAMAGED
                        state.event_log.append(f"Ship {airship.name} took {damage} storm damage")
            
            if weather.type == WeatherType.TURBULENCE:
                morale_penalty = int(10 * intensity_factor)
                airship.morale = max(0, airship.morale - morale_penalty)
                for crew_id in airship.crew:
                    airship.crew[crew_id].morale = max(0, airship.crew[crew_id].morale - morale_penalty // 2)
            
            if weather.type == WeatherType.FOG:
                for mod in airship.modules:
                    if mod.module_type == ModuleType.LOOKOUT:
                        mod.active = False
            
            if weather.type == WeatherType.SANDSTORM and airship.status == ShipStatus.FLYING:
                damage = int(5 * intensity_factor)
                if damage > 0:
                    for mod in airship.modules:
                        mod.durability = max(0, mod.durability - int(damage * 0.3))
                    state.event_log.append(f"Ship {airship.name} suffered sandstorm abrasion")
        
        for weather in state.weather:
            if weather.type != WeatherType.FOG:
                continue
            dist = _distance(airship.position, weather.position)
            if dist > weather.radius:
                for mod in airship.modules:
                    if mod.module_type == ModuleType.LOOKOUT:
                        mod.active = True


def resolve_movement(state: GameState) -> GameState:
    orders_by_ship: Dict[str, Order] = {}
    for order in state.pending_orders:
        if order.type in [ActionType.MOVE, ActionType.CHANGE_ALTITUDE]:
            if order.ship_id not in orders_by_ship:
                orders_by_ship[order.ship_id] = order
            else:
                orders_by_ship[order.ship_id].params.update(order.params)
    
    for airship in state.airships:
        if airship.id in orders_by_ship:
            airship = _resolve_single_movement(airship, orders_by_ship[airship.id], state)
    
    _apply_weather_effects(state)
    
    return state


def _are_allies(state: GameState, player_a_id: str, player_b_id: str) -> bool:
    if player_a_id == player_b_id:
        return True
    for alliance in state.alliances:
        if not alliance.active:
            continue
        if (alliance.player_a_id == player_a_id and alliance.player_b_id == player_b_id) or \
           (alliance.player_a_id == player_b_id and alliance.player_b_id == player_a_id):
            return True
    return False


def resolve_encounters(state: GameState) -> GameState:
    active_airships = [a for a in state.airships if a.status not in [ShipStatus.DESTROYED, ShipStatus.DISABLED]]
    
    for i, ship_a in enumerate(active_airships):
        if ship_a.in_battle_id:
            continue
            
        for ship_b in active_airships[i + 1:]:
            if ship_b.in_battle_id:
                continue
            if ship_a.player_id == ship_b.player_id:
                continue
                
            dist = _distance(ship_a.position, ship_b.position)
            if dist < 40:
                attacker_order = None
                for order in state.pending_orders:
                    if (order.ship_id == ship_a.id and 
                        order.type in [ActionType.ATTACK, ActionType.BOARD] and
                        order.params.get("target_ship_id") == ship_b.id):
                        attacker_order = order
                        break
                
                are_allies_flag = _are_allies(state, ship_a.player_id, ship_b.player_id)
                
                if attacker_order and are_allies_flag:
                    _handle_betrayal(state, ship_a.player_id, ship_b.player_id, f"{ship_a.name} attacked allied ship {ship_b.name}")
                
                if attacker_order or (dist < 25 and ship_a.player_id not in ship_b.in_battle_id if ship_b.in_battle_id else True):
                    player_a = next((p for p in state.players if p.id == ship_a.player_id), None)
                    player_b = next((p for p in state.players if p.id == ship_b.player_id), None)
                    
                    if player_a and player_b and not _are_allies(state, player_a.id, player_b.id):
                        battle = Battle(
                            id=f"battle_{_generate_id()}",
                            ship_a_id=ship_a.id,
                            ship_b_id=ship_b.id,
                            phase=BattlePhase.INITIATION,
                            turn=0,
                            ship_a_morale=ship_a.morale,
                            ship_b_morale=ship_b.morale,
                            log=[f"Battle started between {ship_a.name} and {ship_b.name}!"]
                        )
                        state.battles.append(battle)
                        ship_a.in_battle_id = battle.id
                        ship_b.in_battle_id = battle.id
                        ship_a.status = ShipStatus.BATTLING
                        ship_b.status = ShipStatus.BATTLING
                        
                        if attacker_order and attacker_order.type == ActionType.BOARD:
                            battle.ship_a_boarded = True
                            battle.phase = BattlePhase.BOARDING
                            battle.log.append(f"{ship_a.name} initiates boarding!")
                        
                        state.event_log.append(f"Battle engaged: {ship_a.name} vs {ship_b.name}")
    
    return state


def _handle_betrayal(state: GameState, betrayer_id: str, victim_id: str, reason: str) -> None:
    alliance = None
    for a in state.alliances:
        if a.active and (
            (a.player_a_id == betrayer_id and a.player_b_id == victim_id) or
            (a.player_a_id == victim_id and a.player_b_id == betrayer_id)
        ):
            alliance = a
            break
    
    if not alliance:
        return
    
    alliance.active = False
    
    betrayer = next((p for p in state.players if p.id == betrayer_id), None)
    victim = next((p for p in state.players if p.id == victim_id), None)
    
    if betrayer:
        betrayer.alliances = [aid for aid in betrayer.alliances if aid != victim_id]
        betrayer.traitor_debuff_turns = 3
        betrayer.reputation = max(0, betrayer.reputation - 20)
        for city_id in betrayer.city_reputations:
            betrayer.city_reputations[city_id] = max(0, betrayer.city_reputations[city_id] - 20)
    
    if victim:
        victim.alliances = [aid for aid in victim.alliances if aid != betrayer_id]
        victim.traitor_debuff_turns = 3
        victim.reputation = max(0, victim.reputation - 10)
        for city_id in victim.city_reputations:
            victim.city_reputations[city_id] = max(0, victim.city_reputations[city_id] - 10)
    
    state.event_log.append(f"💔 BETRAYAL: {reason}")
    state.event_log.append(f"Alliance between {betrayer.name if betrayer else betrayer_id} and {victim.name if victim else victim_id} dissolved!")
    state.event_log.append(f"Both players gain 'Traitor' debuff for 3 turns.")


def _update_alliance_trust(state: GameState) -> None:
    for alliance in state.alliances:
        if not alliance.active:
            continue
        
        alliance.turns_without_betrayal += 1
        
        if alliance.turns_without_betrayal >= 3 and alliance.trust_level < 3:
            new_level = min(3, alliance.trust_level + 1)
            if new_level > alliance.trust_level:
                alliance.trust_level = new_level
                alliance.turns_without_betrayal = 0
                
                player_a = next((p for p in state.players if p.id == alliance.player_a_id), None)
                player_b = next((p for p in state.players if p.id == alliance.player_b_id), None)
                
                level_names = {1: "Basic", 2: "Trade Pact", 3: "Joint Command"}
                state.event_log.append(
                    f"🤝 Alliance trust level increased to {new_level} ({level_names.get(new_level, '')}) "
                    f"between {player_a.name if player_a else alliance.player_a_id} and "
                    f"{player_b.name if player_b else alliance.player_b_id}"
                )


def _update_traitor_debuffs(state: GameState) -> None:
    for player in state.players:
        if player.traitor_debuff_turns > 0:
            player.traitor_debuff_turns -= 1
            if player.traitor_debuff_turns == 0:
                state.event_log.append(f"ℹ️ {player.name}'s Traitor debuff has expired.")


def create_alliance_invite(state: GameState, from_player_id: str, to_player_id: str) -> Optional[PendingInvite]:
    from_player = next((p for p in state.players if p.id == from_player_id), None)
    to_player = next((p for p in state.players if p.id == to_player_id), None)
    
    if not from_player or not to_player:
        return None
    
    if _are_allies(state, from_player_id, to_player_id):
        return None
    
    existing = next(
        (inv for inv in state.pending_invites 
         if inv.from_player_id == from_player_id and inv.to_player_id == to_player_id),
        None
    )
    if existing:
        return None
    
    reverse_existing = next(
        (inv for inv in state.pending_invites 
         if inv.from_player_id == to_player_id and inv.to_player_id == from_player_id),
        None
    )
    if reverse_existing:
        return _accept_invite(state, reverse_existing.id, to_player_id)
    
    invite = PendingInvite(
        id=f"invite_{_generate_id()}",
        from_player_id=from_player_id,
        from_player_name=from_player.name,
        to_player_id=to_player_id,
        created_at_turn=state.turn
    )
    state.pending_invites.append(invite)
    state.event_log.append(f"📨 {from_player.name} sent an alliance invite to {to_player.name}")
    
    return invite


def _accept_invite(state: GameState, invite_id: str, player_id: str) -> Optional[PendingInvite]:
    invite = next((inv for inv in state.pending_invites if inv.id == invite_id), None)
    if not invite or invite.to_player_id != player_id:
        return None
    
    from_player = next((p for p in state.players if p.id == invite.from_player_id), None)
    to_player = next((p for p in state.players if p.id == invite.to_player_id), None)
    
    if not from_player or not to_player:
        return None
    
    state.pending_invites = [inv for inv in state.pending_invites if inv.id != invite_id]
    
    alliance = Alliance(
        id=f"alliance_{_generate_id()}",
        player_a_id=invite.from_player_id,
        player_b_id=invite.to_player_id,
        trust_level=1,
        turns_without_betrayal=0,
        created_at_turn=state.turn,
        active=True
    )
    state.alliances.append(alliance)
    
    from_player.alliances.append(invite.to_player_id)
    to_player.alliances.append(invite.from_player_id)
    
    state.event_log.append(f"🤝 Alliance formed between {from_player.name} and {to_player.name}!")
    
    return invite


def respond_to_invite(state: GameState, invite_id: str, player_id: str, accept: bool) -> bool:
    if accept:
        result = _accept_invite(state, invite_id, player_id)
        return result is not None
    else:
        invite = next((inv for inv in state.pending_invites if inv.id == invite_id), None)
        if not invite or invite.to_player_id != player_id:
            return False
        state.pending_invites = [inv for inv in state.pending_invites if inv.id != invite_id]
        state.event_log.append(f"❌ Alliance invite from {invite.from_player_name} was rejected")
        return True


def dissolve_alliance(state: GameState, player_id: str, ally_player_id: str) -> bool:
    alliance = None
    for a in state.alliances:
        if a.active and (
            (a.player_a_id == player_id and a.player_b_id == ally_player_id) or
            (a.player_a_id == ally_player_id and a.player_b_id == player_id)
        ):
            alliance = a
            break
    
    if not alliance:
        return False
    
    alliance.active = False
    
    player = next((p for p in state.players if p.id == player_id), None)
    ally = next((p for p in state.players if p.id == ally_player_id), None)
    
    if player:
        player.alliances = [aid for aid in player.alliances if aid != ally_player_id]
    if ally:
        ally.alliances = [aid for aid in ally.alliances if aid != player_id]
    
    state.event_log.append(f"📜 Alliance between {player.name if player else player_id} and {ally.name if ally else ally_player_id} dissolved by mutual agreement.")
    
    return True


def get_alliance(state: GameState, player_a_id: str, player_b_id: str) -> Optional[Alliance]:
    for alliance in state.alliances:
        if alliance.active and (
            (alliance.player_a_id == player_a_id and alliance.player_b_id == player_b_id) or
            (alliance.player_a_id == player_b_id and alliance.player_b_id == player_a_id)
        ):
            return alliance
    return None


def get_ally_visible_ships(state: GameState, player_id: str) -> List[Airship]:
    visible = []
    for alliance in state.alliances:
        if not alliance.active:
            continue
        if alliance.trust_level < 1:
            continue
        
        ally_id = alliance.player_b_id if alliance.player_a_id == player_id else alliance.player_a_id
        
        for ship in state.airships:
            if ship.player_id == ally_id and ship.status != ShipStatus.DESTROYED:
                visible.append(ship)
    
    return visible


def suggest_heading(state: GameState, from_player_id: str, to_player_id: str, ship_id: str, target_pos: Dict[str, float]) -> bool:
    alliance = get_alliance(state, from_player_id, to_player_id)
    if not alliance or alliance.trust_level < 3:
        return False
    
    target_player = next((p for p in state.players if p.id == to_player_id), None)
    if not target_player:
        return False
    
    target_ship = next((a for a in state.airships if a.id == ship_id and a.player_id == to_player_id), None)
    if not target_ship:
        return False
    
    from_player = next((p for p in state.players if p.id == from_player_id), None)
    
    target_player.suggested_headings[ship_id] = {
        "from_player_id": from_player_id,
        "from_player_name": from_player.name if from_player else "Unknown",
        "target_position": target_pos,
        "turn": state.turn
    }
    
    state.event_log.append(f"🧭 {from_player.name if from_player else from_player_id} suggested a heading to {target_player.name} for {target_ship.name}")
    
    return True


def _handle_waypoint_toll_for_ally(state: GameState, airship: Airship, wp: Waypoint) -> bool:
    if not wp.toll_player_id or wp.toll_player_id == airship.player_id:
        return False
    
    if _are_allies(state, airship.player_id, wp.toll_player_id):
        alliance = get_alliance(state, airship.player_id, wp.toll_player_id)
        if alliance and alliance.trust_level >= 2:
            record = WaypointPassRecord(
                waypoint_id=wp.id,
                passing_player_id=airship.player_id,
                passing_ship_name=airship.name,
                turn=state.turn
            )
            state.waypoint_pass_records.append(record)
            if len(state.waypoint_pass_records) > 50:
                state.waypoint_pass_records = state.waypoint_pass_records[-50:]
            return True
    
    return False


def resolve_alliances_turn(state: GameState) -> GameState:
    _update_alliance_trust(state)
    _update_traitor_debuffs(state)
    
    state.pending_invites = [
        inv for inv in state.pending_invites
        if state.turn - inv.created_at_turn < 5
    ]
    
    return state


def _calculate_ship_attack_power(ship: Airship, action: BattleAction) -> int:
    base_damage = settings.battle_base_damage
    gun_decks = [m for m in ship.modules if m.module_type == ModuleType.GUN_DECK and m.durability > 0]
    
    if action.type == ActionType.ATTACK:
        weapon = action.weapon_type or "cannon"
        total_damage = 0
        for deck in gun_decks:
            if deck.gun_count and deck.gun_damage:
                gd = deck.gun_damage * deck.gun_count
                if weapon == "cannon":
                    gd *= settings.cannon_damage_multiplier
                elif weapon == "harpoon":
                    gd *= settings.harpoon_damage_multiplier
                elif weapon == "incendiary":
                    gd *= settings.incendiary_damage_multiplier
                total_damage += gd
        
        gunners = [c for c in ship.crew.values() if c.role == CrewRole.GUNNER and c.health > 30]
        avg_gunnery = sum(c.skill for c in gunners) / len(gunners) if gunners else 50
        total_damage *= (avg_gunnery / 100)
        
        return int(total_damage) if total_damage > 0 else base_damage
    
    return base_damage


def _calculate_defense(ship: Airship) -> float:
    cockpit = next((m for m in ship.modules if m.module_type == ModuleType.COCKPIT), None)
    if cockpit and cockpit.armor:
        armor = cockpit.armor
    else:
        armor = 0
    
    for mod in ship.modules:
        if mod.armor:
            armor += mod.armor
    
    pilot = next((c for c in ship.crew.values() if c.role == CrewRole.PILOT), None)
    pilot_bonus = 0
    if pilot:
        pilot_bonus = pilot.skill * 0.002
    
    return (armor * 0.01) + pilot_bonus


def _apply_damage(ship: Airship, damage: int, target: ModuleTarget, state: GameState, battle: Battle,
                  attacker_ship: Airship, action_records: List[BattleActionRecord]) -> None:
    defense = _calculate_defense(ship)
    actual_damage = int(damage * (1 - min(defense, 0.6)))
    
    if actual_damage <= 0:
        battle.log.append(f"{ship.name} deflects the attack!")
        action_records.append(BattleActionRecord(
            turn=battle.turn,
            action_type="attack",
            attacker_ship_id=attacker_ship.id,
            attacker_ship_name=attacker_ship.name,
            defender_ship_id=ship.id,
            defender_ship_name=ship.name,
            target_module=target.value,
            damage=0,
            hit=False,
            special_effect="deflect",
            category="defense"
        ))
        return
    
    if target == ModuleTarget.BALLOON:
        ship.gas_balloon.durability = max(0, ship.gas_balloon.durability - actual_damage)
        ship.hp = max(0, ship.hp - int(actual_damage * 0.3))
        battle.log.append(f"Direct hit to {ship.name}'s balloon! -{actual_damage} durability")
        action_records.append(BattleActionRecord(
            turn=battle.turn, action_type="attack",
            attacker_ship_id=attacker_ship.id, attacker_ship_name=attacker_ship.name,
            defender_ship_id=ship.id, defender_ship_name=ship.name,
            target_module="balloon", damage=actual_damage, hit=True,
            special_effect="", category="attack"
        ))
        if ship.gas_balloon.durability <= 0:
            ship.hp = 0
            battle.log.append(f"{ship.name}'s balloon has been destroyed!")
            action_records.append(BattleActionRecord(
                turn=battle.turn, action_type="balloon_destroyed",
                attacker_ship_id=attacker_ship.id, attacker_ship_name=attacker_ship.name,
                defender_ship_id=ship.id, defender_ship_name=ship.name,
                target_module="balloon", damage=actual_damage, hit=True,
                special_effect="balloon_destroyed", category="attack"
            ))
    elif target == ModuleTarget.COCKPIT:
        cockpit = next((m for m in ship.modules if m.module_type == ModuleType.COCKPIT), None)
        if cockpit:
            cockpit.durability = max(0, cockpit.durability - actual_damage)
            ship.hp = max(0, ship.hp - int(actual_damage * 0.5))
            battle.log.append(f"Command cockpit hit! -{actual_damage} damage")
            action_records.append(BattleActionRecord(
                turn=battle.turn, action_type="attack",
                attacker_ship_id=attacker_ship.id, attacker_ship_name=attacker_ship.name,
                defender_ship_id=ship.id, defender_ship_name=ship.name,
                target_module="cockpit", damage=actual_damage, hit=True,
                special_effect="", category="attack"
            ))
    elif target == ModuleTarget.GUN_DECK:
        gun_decks = [m for m in ship.modules if m.module_type == ModuleType.GUN_DECK and m.durability > 0]
        if gun_decks:
            target_deck = random.choice(gun_decks)
            target_deck.durability = max(0, target_deck.durability - actual_damage)
            ship.hp = max(0, ship.hp - int(actual_damage * 0.4))
            battle.log.append(f"Gun deck hit! -{actual_damage} damage")
            action_records.append(BattleActionRecord(
                turn=battle.turn, action_type="attack",
                attacker_ship_id=attacker_ship.id, attacker_ship_name=attacker_ship.name,
                defender_ship_id=ship.id, defender_ship_name=ship.name,
                target_module="gun_deck", damage=actual_damage, hit=True,
                special_effect="", category="attack"
            ))
    elif target == ModuleTarget.ENGINE:
        engine = next((m for m in ship.modules if m.module_type == ModuleType.ENGINE), None)
        if engine:
            engine.durability = max(0, engine.durability - actual_damage)
            ship.hp = max(0, ship.hp - int(actual_damage * 0.4))
            battle.log.append(f"Engine hit! -{actual_damage} damage")
            action_records.append(BattleActionRecord(
                turn=battle.turn, action_type="attack",
                attacker_ship_id=attacker_ship.id, attacker_ship_name=attacker_ship.name,
                defender_ship_id=ship.id, defender_ship_name=ship.name,
                target_module="engine", damage=actual_damage, hit=True,
                special_effect="", category="attack"
            ))
    elif target == ModuleTarget.CARGO:
        cargo_mod = next((m for m in ship.modules if m.module_type == ModuleType.CARGO), None)
        if cargo_mod:
            cargo_mod.durability = max(0, cargo_mod.durability - actual_damage)
            lost = 0
            if ship.cargo:
                lost = random.randint(0, min(actual_damage, len(ship.cargo)))
                if lost > 0:
                    ship.cargo = ship.cargo[:-lost]
                    battle.log.append(f"Cargo hit! Lost {lost} cargo units")
            action_records.append(BattleActionRecord(
                turn=battle.turn, action_type="attack",
                attacker_ship_id=attacker_ship.id, attacker_ship_name=attacker_ship.name,
                defender_ship_id=ship.id, defender_ship_name=ship.name,
                target_module="cargo", damage=actual_damage, hit=True,
                special_effect=f"lost_{lost}_cargo" if lost > 0 else "", category="attack"
            ))
    else:
        target_pool = [m for m in ship.modules if m.durability > 0]
        if target_pool:
            hit_mod = random.choice(target_pool)
            hit_mod.durability = max(0, hit_mod.durability - actual_damage)
        ship.hp = max(0, ship.hp - actual_damage)
        battle.log.append(f"{ship.name} takes -{actual_damage} damage")
        action_records.append(BattleActionRecord(
            turn=battle.turn, action_type="attack",
            attacker_ship_id=attacker_ship.id, attacker_ship_name=attacker_ship.name,
            defender_ship_id=ship.id, defender_ship_name=ship.name,
            target_module="any", damage=actual_damage, hit=True,
            special_effect="", category="attack"
        ))
    
    if ship.hp <= 0:
        ship.status = ShipStatus.DESTROYED
        battle.log.append(f"{ship.name} has been destroyed!")
        action_records.append(BattleActionRecord(
            turn=battle.turn, action_type="sink",
            attacker_ship_id=attacker_ship.id, attacker_ship_name=attacker_ship.name,
            defender_ship_id=ship.id, defender_ship_name=ship.name,
            target_module="", damage=0, hit=True,
            special_effect="sunk", category="attack"
        ))


def _resolve_boarding(ship_attacker: Airship, ship_defender: Airship, battle: Battle, state: GameState,
                       action_records: List[BattleActionRecord]) -> None:
    attack_marines = [c for c in ship_attacker.crew.values() if c.role == CrewRole.MARINE and c.health > 20]
    defend_marines = [c for c in ship_defender.crew.values() if c.role == CrewRole.MARINE and c.health > 20]
    attack_crewmen = [c for c in ship_attacker.crew.values() if c.role == CrewRole.CREWMAN and c.health > 20]
    defend_crewmen = [c for c in ship_defender.crew.values() if c.role == CrewRole.CREWMAN and c.health > 20]
    
    attack_power = sum(c.skill for c in attack_marines) * 1.5 + sum(c.skill for c in attack_crewmen) * 0.5
    attack_power += ship_attacker.morale * 0.2
    defend_power = sum(c.skill for c in defend_marines) * 1.5 + sum(c.skill for c in defend_crewmen) * 0.5
    defend_power += ship_defender.morale * 0.2
    
    battle.log.append(f"Boarding action! Attackers: {len(attack_marines)} marines, Defenders: {len(defend_marines)} marines")
    action_records.append(BattleActionRecord(
        turn=battle.turn, action_type="board",
        attacker_ship_id=ship_attacker.id, attacker_ship_name=ship_attacker.name,
        defender_ship_id=ship_defender.id, defender_ship_name=ship_defender.name,
        target_module="", damage=0, hit=True,
        special_effect=f"boarding_attack_{len(attack_marines)}v{len(defend_marines)}", category="attack"
    ))
    
    ratio = attack_power / max(attack_power + defend_power, 1)
    
    for _ in range(3):
        if ratio > 0.5:
            casualties_def = random.randint(1, max(1, int(len(defend_marines) * 0.2 + len(defend_crewmen) * 0.1)))
            for _ in range(min(casualties_def, len(defend_marines))):
                if defend_marines:
                    m = defend_marines.pop()
                    m.health = max(0, m.health - random.randint(30, 70))
            ship_defender.morale = max(0, ship_defender.morale - 8)
        else:
            casualties_att = random.randint(1, max(1, int(len(attack_marines) * 0.2 + len(attack_crewmen) * 0.1)))
            for _ in range(min(casualties_att, len(attack_marines))):
                if attack_marines:
                    m = attack_marines.pop()
                    m.health = max(0, m.health - random.randint(30, 70))
            ship_attacker.morale = max(0, ship_attacker.morale - 8)
    
    total_attack_morale = ship_attacker.morale + sum(c.morale for c in attack_marines) / max(len(attack_marines), 1) * 0.5
    total_defend_morale = ship_defender.morale + sum(c.morale for c in defend_marines) / max(len(defend_marines), 1) * 0.5
    
    if total_attack_morale > total_defend_morale * 1.3 or not defend_marines:
        battle.winner = ship_attacker.player_id
        ship_defender.status = ShipStatus.DISABLED
        battle.log.append(f"Boarding successful! {ship_attacker.name} captures {ship_defender.name}!")
        action_records.append(BattleActionRecord(
            turn=battle.turn, action_type="capture",
            attacker_ship_id=ship_attacker.id, attacker_ship_name=ship_attacker.name,
            defender_ship_id=ship_defender.id, defender_ship_name=ship_defender.name,
            target_module="", damage=0, hit=True,
            special_effect="captured", category="attack"
        ))
        
        attacker_player = next((p for p in state.players if p.id == ship_attacker.player_id), None)
        if attacker_player:
            loot_value = 0
            for cargo in ship_defender.cargo:
                loot_value += cargo.base_value * cargo.amount
                ship_attacker.cargo.append(cargo)
            ship_defender.cargo = []
            
            defender_player = next((p for p in state.players if p.id == ship_defender.player_id), None)
            if defender_player:
                cash_loot = min(defender_player.wealth, 1000)
                defender_player.wealth -= cash_loot
                attacker_player.wealth += cash_loot
                loot_value += cash_loot
            
            attacker_player.reputation = min(100, attacker_player.reputation + 5)
            state.event_log.append(f"{ship_attacker.name} captures {ship_defender.name}, loot value: {loot_value}")
    elif total_defend_morale > total_attack_morale * 1.3:
        battle.winner = ship_defender.player_id
        battle.log.append(f"Boarding repelled! {ship_defender.name} defends successfully!")
        action_records.append(BattleActionRecord(
            turn=battle.turn, action_type="board_repelled",
            attacker_ship_id=ship_attacker.id, attacker_ship_name=ship_attacker.name,
            defender_ship_id=ship_defender.id, defender_ship_name=ship_defender.name,
            target_module="", damage=0, hit=True,
            special_effect="repelled", category="defense"
        ))
        for c in attack_marines:
            c.health = max(0, c.health - random.randint(20, 50))


def _resolve_single_battle(battle: Battle, state: GameState) -> None:
    ship_a = next((a for a in state.airships if a.id == battle.ship_a_id), None)
    ship_b = next((a for a in state.airships if a.id == battle.ship_b_id), None)
    
    if not ship_a or not ship_b:
        battle.phase = BattlePhase.ENDED
        return
    
    if ship_a.status == ShipStatus.DESTROYED:
        battle.winner = ship_b.player_id
        battle.phase = BattlePhase.ENDED
        battle.log.append(f"Battle ended: {ship_b.name} wins by default")
        return
    if ship_b.status == ShipStatus.DESTROYED:
        battle.winner = ship_a.player_id
        battle.phase = BattlePhase.ENDED
        battle.log.append(f"Battle ended: {ship_a.name} wins by default")
        return
    
    action_records: List[BattleActionRecord] = []
    
    battle.turn += 1
    
    if battle.smoke_screen_turns > 0:
        battle.smoke_screen_turns -= 1
        if battle.smoke_screen_turns == 0:
            battle.smoke_screen_active = False
            battle.log.append("Smoke screen dissipates")
            action_records.append(BattleActionRecord(
                turn=battle.turn, action_type="smoke_dissipate",
                attacker_ship_id="", attacker_ship_name="",
                defender_ship_id="", defender_ship_name="",
                target_module="", damage=0, hit=True,
                special_effect="smoke_dissipated", category="neutral"
            ))
    
    if battle.phase == BattlePhase.INITIATION:
        battle.phase = BattlePhase.RANGED
    
    attacker_actions = [a for a in battle.attacker_actions if a]
    defender_actions = [a for a in battle.defender_actions if a]
    
    for action in attacker_actions:
        if action.type == ActionType.RETREAT:
            retreat_chance = 0.4 + (ship_a.speed / 50) * 0.3
            if random.random() < retreat_chance:
                battle.phase = BattlePhase.ENDED
                ship_a.in_battle_id = None
                ship_b.in_battle_id = None
                ship_a.status = ShipStatus.FLYING if ship_a.current_city_id is None else ShipStatus.DOCKED
                ship_b.status = ShipStatus.FLYING if ship_b.current_city_id is None else ShipStatus.DOCKED
                battle.log.append(f"{ship_a.name} successfully retreats!")
                state.event_log.append(f"{ship_a.name} retreated from battle")
                action_records.append(BattleActionRecord(
                    turn=battle.turn, action_type="retreat",
                    attacker_ship_id=ship_a.id, attacker_ship_name=ship_a.name,
                    defender_ship_id=ship_b.id, defender_ship_name=ship_b.name,
                    target_module="", damage=0, hit=True,
                    special_effect="retreat_success", category="neutral"
                ))
                _finalize_battle_report(battle, state, action_records, ship_a, ship_b)
                return
            else:
                battle.log.append(f"{ship_a.name} failed to retreat!")
                ship_a.morale = max(0, ship_a.morale - 10)
                action_records.append(BattleActionRecord(
                    turn=battle.turn, action_type="retreat_fail",
                    attacker_ship_id=ship_a.id, attacker_ship_name=ship_a.name,
                    defender_ship_id=ship_b.id, defender_ship_name=ship_b.name,
                    target_module="", damage=0, hit=False,
                    special_effect="retreat_failed", category="neutral"
                ))
        elif action.type == ActionType.BOARD:
            battle.ship_a_boarded = True
            battle.phase = BattlePhase.BOARDING
            battle.log.append(f"{ship_a.name} moves to board {ship_b.name}")
            action_records.append(BattleActionRecord(
                turn=battle.turn, action_type="board_initiate",
                attacker_ship_id=ship_a.id, attacker_ship_name=ship_a.name,
                defender_ship_id=ship_b.id, defender_ship_name=ship_b.name,
                target_module="", damage=0, hit=True,
                special_effect="boarding_initiated", category="attack"
            ))
    
    for action in defender_actions:
        if action.type == ActionType.RETREAT:
            retreat_chance = 0.35 + (ship_b.speed / 50) * 0.3
            if random.random() < retreat_chance:
                battle.phase = BattlePhase.ENDED
                ship_a.in_battle_id = None
                ship_b.in_battle_id = None
                ship_a.status = ShipStatus.FLYING if ship_a.current_city_id is None else ShipStatus.DOCKED
                ship_b.status = ShipStatus.FLYING if ship_b.current_city_id is None else ShipStatus.DOCKED
                battle.log.append(f"{ship_b.name} successfully retreats!")
                state.event_log.append(f"{ship_b.name} retreated from battle")
                action_records.append(BattleActionRecord(
                    turn=battle.turn, action_type="retreat",
                    attacker_ship_id=ship_b.id, attacker_ship_name=ship_b.name,
                    defender_ship_id=ship_a.id, defender_ship_name=ship_a.name,
                    target_module="", damage=0, hit=True,
                    special_effect="retreat_success", category="neutral"
                ))
                _finalize_battle_report(battle, state, action_records, ship_a, ship_b)
                return
            else:
                battle.log.append(f"{ship_b.name} failed to retreat!")
                ship_b.morale = max(0, ship_b.morale - 10)
                action_records.append(BattleActionRecord(
                    turn=battle.turn, action_type="retreat_fail",
                    attacker_ship_id=ship_b.id, attacker_ship_name=ship_b.name,
                    defender_ship_id=ship_a.id, defender_ship_name=ship_a.name,
                    target_module="", damage=0, hit=False,
                    special_effect="retreat_failed", category="neutral"
                ))
    
    if battle.phase == BattlePhase.RANGED:
        for action in attacker_actions:
            if action.type == ActionType.ATTACK:
                if battle.smoke_screen_active and random.random() < settings.smoke_screen_miss_chance:
                    battle.log.append(f"{ship_a.name}'s attack misses due to smoke screen!")
                    action_records.append(BattleActionRecord(
                        turn=battle.turn, action_type="attack",
                        attacker_ship_id=ship_a.id, attacker_ship_name=ship_a.name,
                        defender_ship_id=ship_b.id, defender_ship_name=ship_b.name,
                        target_module=(action.target_module or ModuleTarget.ANY).value,
                        damage=0, hit=False,
                        special_effect="smoke_screen_miss", category="attack"
                    ))
                    continue
                
                damage = _calculate_ship_attack_power(ship_a, action)
                target = action.target_module or ModuleTarget.ANY
                _apply_damage(ship_b, damage, target, state, battle, ship_a, action_records)
                
                if action.weapon_type == "incendiary" and ship_b.gas_balloon.flammable:
                    if random.random() < 0.3:
                        ship_b.gas_balloon.on_fire = True
                        ship_b.gas_balloon.fire_damage_remaining = settings.incendiary_dot_damage * 3
                        battle.log.append(f"{ship_b.name}'s balloon catches fire!")
                        action_records.append(BattleActionRecord(
                            turn=battle.turn, action_type="fire",
                            attacker_ship_id=ship_a.id, attacker_ship_name=ship_a.name,
                            defender_ship_id=ship_b.id, defender_ship_name=ship_b.name,
                            target_module="balloon", damage=0, hit=True,
                            special_effect="balloon_on_fire", category="attack"
                        ))
        
        for action in defender_actions:
            if action.type == ActionType.ATTACK:
                if battle.smoke_screen_active and random.random() < settings.smoke_screen_miss_chance:
                    battle.log.append(f"{ship_b.name}'s attack misses due to smoke screen!")
                    action_records.append(BattleActionRecord(
                        turn=battle.turn, action_type="attack",
                        attacker_ship_id=ship_b.id, attacker_ship_name=ship_b.name,
                        defender_ship_id=ship_a.id, defender_ship_name=ship_a.name,
                        target_module=(action.target_module or ModuleTarget.ANY).value,
                        damage=0, hit=False,
                        special_effect="smoke_screen_miss", category="attack"
                    ))
                    continue
                
                damage = _calculate_ship_attack_power(ship_b, action)
                target = action.target_module or ModuleTarget.ANY
                _apply_damage(ship_a, damage, target, state, battle, ship_b, action_records)
                
                if action.weapon_type == "incendiary" and ship_a.gas_balloon.flammable:
                    if random.random() < 0.3:
                        ship_a.gas_balloon.on_fire = True
                        ship_a.gas_balloon.fire_damage_remaining = settings.incendiary_dot_damage * 3
                        battle.log.append(f"{ship_a.name}'s balloon catches fire!")
                        action_records.append(BattleActionRecord(
                            turn=battle.turn, action_type="fire",
                            attacker_ship_id=ship_b.id, attacker_ship_name=ship_b.name,
                            defender_ship_id=ship_a.id, defender_ship_name=ship_a.name,
                            target_module="balloon", damage=0, hit=True,
                            special_effect="balloon_on_fire", category="attack"
                        ))
            
            if action.type == ActionType.ATTACK and action.params.get("smoke_screen"):
                battle.smoke_screen_active = True
                battle.smoke_screen_turns = 2
                battle.log.append(f"{ship_b.name} deploys smoke screen!")
                action_records.append(BattleActionRecord(
                    turn=battle.turn, action_type="smoke_screen",
                    attacker_ship_id=ship_b.id, attacker_ship_name=ship_b.name,
                    defender_ship_id=ship_a.id, defender_ship_name=ship_a.name,
                    target_module="", damage=0, hit=True,
                    special_effect="smoke_deployed", category="defense"
                ))
        
        for action in attacker_actions:
            if action.type == ActionType.ATTACK and action.params.get("smoke_screen"):
                battle.smoke_screen_active = True
                battle.smoke_screen_turns = 2
                battle.log.append(f"{ship_a.name} deploys smoke screen!")
                action_records.append(BattleActionRecord(
                    turn=battle.turn, action_type="smoke_screen",
                    attacker_ship_id=ship_a.id, attacker_ship_name=ship_a.name,
                    defender_ship_id=ship_b.id, defender_ship_name=ship_b.name,
                    target_module="", damage=0, hit=True,
                    special_effect="smoke_deployed", category="defense"
                ))
    
    for ship in [ship_a, ship_b]:
        if ship.gas_balloon.on_fire and ship.gas_balloon.fire_damage_remaining > 0:
            other = ship_b if ship == ship_a else ship_a
            fd = settings.incendiary_dot_damage
            ship.gas_balloon.durability = max(0, ship.gas_balloon.durability - fd)
            ship.hp = max(0, ship.hp - fd // 2)
            ship.gas_balloon.fire_damage_remaining -= fd
            battle.log.append(f"{ship.name} takes {fd} fire damage")
            action_records.append(BattleActionRecord(
                turn=battle.turn, action_type="fire_damage",
                attacker_ship_id=other.id, attacker_ship_name=other.name,
                defender_ship_id=ship.id, defender_ship_name=ship.name,
                target_module="balloon", damage=fd, hit=True,
                special_effect="burning_dot", category="attack"
            ))
            if random.random() < 0.2:
                ship.gas_balloon.on_fire = False
                ship.gas_balloon.fire_damage_remaining = 0
                battle.log.append(f"Crew extinguishes fire on {ship.name}!")
                action_records.append(BattleActionRecord(
                    turn=battle.turn, action_type="fire_extinguish",
                    attacker_ship_id="", attacker_ship_name="",
                    defender_ship_id=ship.id, defender_ship_name=ship.name,
                    target_module="balloon", damage=0, hit=True,
                    special_effect="fire_extinguished", category="neutral"
                ))
    
    if battle.phase == BattlePhase.BOARDING:
        if battle.ship_a_boarded:
            _resolve_boarding(ship_a, ship_b, battle, state, action_records)
        else:
            _resolve_boarding(ship_b, ship_a, battle, state, action_records)
    
    if ship_a.hp <= 0:
        battle.winner = ship_b.player_id
        ship_a.status = ShipStatus.DESTROYED
        battle.phase = BattlePhase.ENDED
        battle.log.append(f"{ship_a.name} destroyed! {ship_b.name} wins!")
    elif ship_b.hp <= 0:
        battle.winner = ship_a.player_id
        ship_b.status = ShipStatus.DESTROYED
        battle.phase = BattlePhase.ENDED
        battle.log.append(f"{ship_b.name} destroyed! {ship_a.name} wins!")
    elif ship_a.morale < 20 and ship_b.morale >= 20:
        battle.winner = ship_b.player_id
        battle.phase = BattlePhase.ENDED
        battle.log.append(f"{ship_a.name} crew mutinies! {ship_b.name} wins!")
    elif ship_b.morale < 20 and ship_a.morale >= 20:
        battle.winner = ship_a.player_id
        battle.phase = BattlePhase.ENDED
        battle.log.append(f"{ship_b.name} crew mutinies! {ship_a.name} wins!")
    elif battle.turn >= 10 and battle.phase != BattlePhase.BOARDING:
        battle.phase = BattlePhase.BOARDING
        battle.log.append("Battle prolonged - closing for boarding action!")
    elif battle.winner:
        battle.phase = BattlePhase.ENDED
    
    if battle.phase == BattlePhase.ENDED:
        ship_a.in_battle_id = None
        ship_b.in_battle_id = None
        
        for ship in [ship_a, ship_b]:
            if ship.status != ShipStatus.DESTROYED and ship.status != ShipStatus.DISABLED:
                repair_mod = next((m for m in ship.modules if m.module_type == ModuleType.REPAIR and m.durability > 0), None)
                if repair_mod and repair_mod.repair_rate:
                    repair = repair_mod.repair_rate
                    ship.hp = min(ship.max_hp, ship.hp + repair // 2)
                    for mod in ship.modules:
                        mod.durability = min(mod.max_durability, mod.durability + repair // 5)
                    ship.gas_balloon.durability = min(ship.gas_balloon.max_durability, ship.gas_balloon.durability + repair // 4)
                
                if ship.current_city_id:
                    ship.status = ShipStatus.DOCKED
                else:
                    ship.status = ShipStatus.FLYING if ship.hp > ship.max_hp * 0.3 else ShipStatus.DAMAGED
        
        _finalize_battle_report(battle, state, action_records, ship_a, ship_b)


def _finalize_battle_report(battle: Battle, state: GameState, action_records: List[BattleActionRecord],
                             ship_a: Airship, ship_b: Airship) -> None:
    is_sink = ship_a.hp <= 0 or ship_b.hp <= 0
    is_capture = ship_a.status == ShipStatus.DISABLED or ship_b.status == ShipStatus.DISABLED
    
    result = "ongoing"
    if battle.winner:
        if is_sink:
            result = "sink"
        elif is_capture:
            result = "capture"
        else:
            result = "victory"
    elif battle.phase == BattlePhase.ENDED and not battle.winner:
        result = "draw"
    
    winner_ship_name = ""
    if battle.winner == ship_a.player_id:
        winner_ship_name = ship_a.name
    elif battle.winner == ship_b.player_id:
        winner_ship_name = ship_b.name
    
    report = BattleReport(
        id=f"report_{_generate_id()}",
        battle_id=battle.id,
        attacker_ship_id=ship_a.id,
        attacker_ship_name=ship_a.name,
        attacker_player_id=ship_a.player_id,
        defender_ship_id=ship_b.id,
        defender_ship_name=ship_b.name,
        defender_player_id=ship_b.player_id,
        result=result,
        winner_player_id=battle.winner,
        winner_ship_name=winner_ship_name,
        duration_turns=battle.turn,
        action_records=action_records,
        is_sink=is_sink,
        is_capture=is_capture,
        turn_number=state.turn
    )
    
    state.battle_reports.append(report)
    if len(state.battle_reports) > 20:
        state.battle_reports = state.battle_reports[-20:]


def resolve_battles(state: GameState) -> GameState:
    for order in state.pending_orders:
        if order.type in [ActionType.ATTACK, ActionType.BOARD]:
            battle_id = None
            ship_a = next((a for a in state.airships if a.id == order.ship_id), None)
            if ship_a and ship_a.in_battle_id:
                battle_id = ship_a.in_battle_id
            target_ship_id = order.params.get("target_ship_id")
            if not battle_id and target_ship_id:
                ship_b = next((a for a in state.airships if a.id == target_ship_id), None)
                if ship_b and ship_b.in_battle_id:
                    battle_id = ship_b.in_battle_id
            
            if battle_id:
                battle = next((b for b in state.battles if b.id == battle_id), None)
                if battle:
                    action = BattleAction(
                        type=order.type,
                        target_module=ModuleTarget(order.params.get("target_module", "any")),
                        weapon_type=order.params.get("weapon_type"),
                        target_ship_id=target_ship_id,
                        params=order.params
                    )
                    if battle.ship_a_id == order.ship_id:
                        battle.attacker_actions.append(action)
                    elif battle.is_joint_combat and battle.ship_c_id == order.ship_id:
                        battle.ship_c_actions.append(action)
                    else:
                        battle.defender_actions.append(action)
    
    active_battles = [b for b in state.battles if b.phase != BattlePhase.ENDED]
    for battle in active_battles:
        if battle.is_joint_combat:
            _resolve_joint_combat_battle(battle, state)
        else:
            _resolve_single_battle(battle, state)
    
    return state


def _execute_trade_order(order: Order, state: GameState) -> None:
    ship = next((a for a in state.airships if a.id == order.ship_id), None)
    if not ship or ship.status != ShipStatus.DOCKED or not ship.current_city_id:
        return
    
    city = next((c for c in state.cities if c.id == ship.current_city_id), None)
    player = next((p for p in state.players if p.id == order.player_id), None)
    if not city or not player:
        return
    
    action = order.params.get("trade_action")
    cargo_type = order.params.get("cargo_type")
    amount = order.params.get("amount", 1)
    
    if not cargo_type or not action:
        return
    
    try:
        ctype = CargoType(cargo_type)
    except ValueError:
        return
    
    good = next((g for g in city.trade_goods if g.type == ctype), None)
    
    if action == "buy":
        if not good or good.supply < amount:
            return
        price = good.buy_price * amount
        price = int(price * (1 + city.tax_rate))
        
        if city.controller_player_id and city.controller_player_id != player.id:
            controller = next((p for p in state.players if p.id == city.controller_player_id), None)
            if controller:
                tax = int(price * city.tax_rate)
                controller.wealth += tax
        
        cargo_mod = next((m for m in ship.modules if m.module_type == ModuleType.CARGO), None)
        current_cargo = sum(c.amount for c in ship.cargo)
        max_cap = cargo_mod.cargo_capacity if cargo_mod and cargo_mod.cargo_capacity else 100
        if current_cargo + amount > max_cap:
            return
        
        if player.wealth >= price:
            player.wealth -= price
            good.supply -= amount
            good.demand += amount // 2
            
            existing = next((c for c in ship.cargo if c.type == ctype), None)
            if existing:
                existing.amount += amount
            else:
                ship.cargo.append(Cargo(type=ctype, amount=amount, base_value=good.buy_price))
            
            player.city_reputations[city.id] = min(100, player.city_reputations.get(city.id, 50) + 1)
            state.event_log.append(f"{player.name} bought {amount} {ctype.value} at {city.name} for {price}")
    
    elif action == "sell":
        ship_cargo = next((c for c in ship.cargo if c.type == ctype and c.amount >= amount), None)
        if not ship_cargo:
            return
        
        if good:
            price = good.sell_price * amount
        else:
            is_demand = ctype in city.demands
            price = int(ship_cargo.base_value * (1.5 if is_demand else 0.8)) * amount
        
        price = int(price * (1 - city.tax_rate))
        
        if city.controller_player_id and city.controller_player_id != player.id:
            controller = next((p for p in state.players if p.id == city.controller_player_id), None)
            if controller:
                tax = int(price * city.tax_rate)
                controller.wealth += tax
        
        player.wealth += price
        ship_cargo.amount -= amount
        if ship_cargo.amount <= 0:
            ship.cargo = [c for c in ship.cargo if c.amount > 0]
        
        if good:
            good.supply += amount
            good.demand = max(0, good.demand - amount // 2)
        
        player.city_reputations[city.id] = min(100, player.city_reputations.get(city.id, 50) + 2)
        state.event_log.append(f"{player.name} sold {amount} {ctype.value} at {city.name} for {price}")


def _execute_toll_order(order: Order, state: GameState) -> None:
    player = next((p for p in state.players if p.id == order.player_id), None)
    ship = next((a for a in state.airships if a.id == order.ship_id), None)
    if not player or not ship:
        return
    
    wp_id = order.params.get("waypoint_id")
    toll_amount = order.params.get("toll_amount", 0)
    
    wp = next((w for w in state.waypoints if w.id == wp_id), None)
    if not wp:
        near_wps = [w for w in state.waypoints if _distance(ship.position, w.position) < 60]
        if near_wps:
            wp = near_wps[0]
    
    if wp:
        if toll_amount > 0:
            wp.toll_player_id = player.id
            wp.toll_amount = min(toll_amount, int(player.wealth * settings.toll_max_percentage))
            wp.controlled = True
            state.event_log.append(f"{player.name} set toll of {wp.toll_amount} at waypoint near {wp.from_city}-{wp.to_city}")
        elif wp.toll_player_id == player.id:
            wp.toll_player_id = None
            wp.toll_amount = 0
            wp.controlled = False
            state.event_log.append(f"{player.name} abandoned toll at waypoint")


def _execute_repair_order(order: Order, state: GameState) -> None:
    ship = next((a for a in state.airships if a.id == order.ship_id), None)
    player = next((p for p in state.players if p.id == order.player_id), None)
    if not ship or not player:
        return
    
    repair_cost = order.params.get("cost", 500)
    if player.wealth < repair_cost:
        return
    
    if ship.current_city_id:
        city = next((c for c in state.cities if c.id == ship.current_city_id), None)
        if not city:
            return
        rep_factor = 2.0
    else:
        rep_factor = 1.0
        repair_mod = next((m for m in ship.modules if m.module_type == ModuleType.REPAIR), None)
        if not repair_mod or repair_mod.durability <= 0:
            return
    
    player.wealth -= repair_cost
    repair_amount = int(repair_cost * 0.1 * rep_factor)
    
    ship.hp = min(ship.max_hp, ship.hp + repair_amount)
    ship.gas_balloon.durability = min(ship.gas_balloon.max_durability, ship.gas_balloon.durability + repair_amount // 2)
    for mod in ship.modules:
        mod.durability = min(mod.max_durability, mod.durability + repair_amount // 3)
    
    if ship.status == ShipStatus.DAMAGED and ship.hp > ship.max_hp * 0.5:
        ship.status = ShipStatus.DOCKED if ship.current_city_id else ShipStatus.FLYING
    
    state.event_log.append(f"{ship.name} repaired for {repair_cost} gold")


def _execute_recruit_order(order: Order, state: GameState) -> None:
    ship = next((a for a in state.airships if a.id == order.ship_id), None)
    player = next((p for p in state.players if p.id == order.player_id), None)
    if not ship or not player or not ship.current_city_id:
        return
    
    cost = order.params.get("cost", 200)
    role_str = order.params.get("role", CrewRole.CREWMAN.value)
    try:
        role = CrewRole(role_str)
    except ValueError:
        role = CrewRole.CREWMAN
    
    role_costs = {
        CrewRole.CAPTAIN: 1000,
        CrewRole.PILOT: 500,
        CrewRole.GUNNER: 400,
        CrewRole.ENGINEER: 450,
        CrewRole.NAVIGATOR: 400,
        CrewRole.MEDIC: 350,
        CrewRole.MARINE: 300,
        CrewRole.CREWMAN: cost,
    }
    actual_cost = role_costs.get(role, cost)
    
    if player.wealth < actual_cost:
        return
    
    player.wealth -= actual_cost
    crew_idx = len(ship.crew)
    cid = f"crew_{ship.id}_{crew_idx}"
    names = ["James", "William", "Elizabeth", "Sarah", "Thomas", "Anne", "Robert", "Catherine"]
    
    ship.crew[cid] = CrewMember(
        id=cid,
        name=random.choice(names),
        role=role,
        skill=random.randint(40, 75),
        health=100,
        morale=random.randint(70, 90)
    )
    ship.morale = min(100, ship.morale + 5)
    
    state.event_log.append(f"{player.name} recruited {role.value} for {ship.name}")


def resolve_trade(state: GameState) -> GameState:
    for order in state.pending_orders:
        if order.type == ActionType.TRADE:
            _execute_trade_order(order, state)
        elif order.type == ActionType.SET_TOLL:
            _execute_toll_order(order, state)
        elif order.type == ActionType.REPAIR:
            _execute_repair_order(order, state)
        elif order.type == ActionType.RECRUIT_CREW:
            _execute_recruit_order(order, state)
    
    for city in state.cities:
        for good in city.trade_goods:
            fluctuation = random.uniform(0.95, 1.05)
            good.buy_price = max(10, int(good.buy_price * fluctuation))
            good.sell_price = max(10, int(good.sell_price * fluctuation))
            
            if random.random() < 0.3:
                delta = random.randint(-10, 15)
                good.supply = max(0, good.supply + delta)
            if random.random() < 0.2:
                delta = random.randint(-5, 10)
                good.demand = max(0, good.demand + delta)
            
            ratio = good.supply / max(good.demand, 1)
            sensitivity = settings.supply_demand_sensitivity
            good.buy_price = int(good.buy_price * (1 - sensitivity * min(ratio - 1, 0.3)))
            good.sell_price = int(good.sell_price * (1 + sensitivity * max(1 - ratio, -0.3)))
    
    return state


def resolve_weather(state: GameState) -> GameState:
    if state.turn > 0 and state.turn % settings.weather_change_interval == 0:
        state.event_log.append("Weather patterns shifting...")
        state.weather = state.forecast if state.forecast else state.weather
        
        new_forecast = []
        weather_types = list(WeatherType)
        for _ in range(random.randint(2, 3)):
            wtype = random.choice(weather_types)
            intensity = random.uniform(0.2, 1.0)
            city = random.choice(state.cities)
            offset_x = random.uniform(-150, 150)
            offset_y = random.uniform(-150, 150)
            new_forecast.append(Weather(
                type=wtype,
                intensity=intensity,
                position=Position(x=city.position.x + offset_x, y=city.position.y + offset_y),
                radius=random.uniform(50, 150),
                wind_direction=random.uniform(0, 360),
                wind_speed=random.uniform(0, 20) * intensity
            ))
        state.forecast = new_forecast
    
    return state


def _check_morale(airship: Airship, state: GameState) -> None:
    if airship.status == ShipStatus.DESTROYED:
        return
    
    avg_crew_morale = sum(c.morale for c in airship.crew.values()) / max(len(airship.crew), 1)
    airship.morale = int((airship.morale + avg_crew_morale) / 2)
    
    if airship.morale < 20:
        state.event_log.append(f"WARNING: {airship.name} crew morale is critically low!")
    elif airship.morale < 10:
        if random.random() < 0.3:
            state.event_log.append(f"MUTINY on {airship.name}! Crew abandons ship!")
            for crew_id in list(airship.crew.keys()):
                if random.random() < 0.4:
                    del airship.crew[crew_id]
            airship.morale = 25


def _random_event(state: GameState) -> None:
    if random.random() > 0.25:
        return
    
    event_roll = random.random()
    players = [p for p in state.players if any(a.status != ShipStatus.DESTROYED for a in state.airships if a.player_id == p.id)]
    
    if not players:
        return
    
    if event_roll < 0.2:
        player = random.choice(players)
        amount = random.randint(200, 1000)
        player.wealth += amount
        state.event_log.append(f"🎁 Random Event: {player.name} found abandoned cargo worth {amount} gold!")
    
    elif event_roll < 0.35:
        player = random.choice(players)
        ship = random.choice([a for a in state.airships if a.player_id == player.id and a.status != ShipStatus.DESTROYED])
        damage = random.randint(10, 30)
        ship.hp = max(0, ship.hp - damage)
        state.event_log.append(f"⚠️ Random Event: {ship.name} suffers structural damage (-{damage} HP)")
    
    elif event_roll < 0.5:
        player = random.choice(players)
        city = random.choice(state.cities)
        rep_change = random.randint(-10, 15)
        old_rep = player.city_reputations.get(city.id, 50)
        player.city_reputations[city.id] = max(0, min(100, old_rep + rep_change))
        direction = "increased" if rep_change > 0 else "decreased"
        state.event_log.append(f"🤝 Random Event: {player.name}'s reputation in {city.name} {direction} by {abs(rep_change)}")
    
    elif event_roll < 0.65:
        player = random.choice(players)
        player.reputation = max(0, min(100, player.reputation + random.randint(-5, 10)))
        state.event_log.append(f"📰 Random Event: {player.name}'s global reputation changed!")
    
    elif event_roll < 0.8:
        active_ships = [a for a in state.airships if a.status == ShipStatus.FLYING]
        if active_ships:
            ship = random.choice(active_ships)
            bonus = random.uniform(5, 15)
            for crew_id in ship.crew:
                ship.crew[crew_id].morale = min(100, int(ship.crew[crew_id].morale + bonus))
            state.event_log.append(f"🎉 Random Event: Good times on {ship.name}, crew morale increased!")
    
    else:
        city = random.choice(state.cities)
        for good in city.trade_goods:
            price_change = random.randint(-30, 50)
            good.buy_price = max(10, good.buy_price + price_change)
            good.sell_price = max(10, good.sell_price + price_change)
        state.event_log.append(f"📈 Random Event: Market volatility at {city.name}!")


def resolve_events(state: GameState) -> GameState:
    for airship in state.airships:
        _check_morale(airship, state)
    
    _random_event(state)
    
    return state


def calculate_scores(state: GameState) -> Dict[str, int]:
    scores: Dict[str, int] = {}
    
    for player in state.players:
        score = 0
        score += player.wealth // 10
        score += player.reputation * 10
        
        total_city_rep = sum(player.city_reputations.values())
        score += total_city_rep // 2
        
        player_ships = [a for a in state.airships if a.player_id == player.id]
        for ship in player_ships:
            if ship.status != ShipStatus.DESTROYED:
                score += 100
                score += (ship.hp / ship.max_hp) * 50
                score += ship.morale * 0.5
                
                for cargo in ship.cargo:
                    score += cargo.base_value * cargo.amount // 20
                
                score += sum(m.durability for m in ship.modules) // 10
        
        controlled_waypoints = [w for w in state.waypoints if w.toll_player_id == player.id]
        score += len(controlled_waypoints) * 75
        
        controlled_cities = [c for c in state.cities if c.controller_player_id == player.id]
        score += len(controlled_cities) * 200
        
        battle_wins = sum(1 for b in state.battles if b.winner == player.id)
        score += battle_wins * 150
        
        score = int(score)
        scores[player.id] = score
        player.score = score
    
    return scores


def process_turn(state: GameState) -> GameState:
    state.turn += 1
    state.event_log.append(f"\n=== Turn {state.turn} / {state.max_turns} ===")
    state.phase = "processing"
    
    resolve_movement(state)
    resolve_joint_combat(state)
    resolve_joint_combat_betrayals(state)
    resolve_encounters(state)
    resolve_battles(state)
    _finalize_joint_combat_proposals(state)
    resolve_trade(state)
    resolve_weather(state)
    resolve_events(state)
    resolve_alliances_turn(state)
    
    state.scores = calculate_scores(state)
    
    if state.turn >= state.max_turns:
        state.phase = "ended"
        max_score = -1
        winner_id = None
        for pid, score in state.scores.items():
            if score > max_score:
                max_score = score
                winner_id = pid
        
        if winner_id:
            state.winner = winner_id
            winner = next((p for p in state.players if p.id == winner_id), None)
            if winner:
                state.event_log.append(f"🏆 Game Over! {winner.name} wins with {max_score} points!")
    else:
        state.phase = "orders"
        state.pending_orders = []
        for battle in state.battles:
            battle.attacker_actions = []
            battle.defender_actions = []
            if battle.is_joint_combat:
                battle.ship_c_actions = []
    
    return state


def check_all_players_ready(state: GameState) -> bool:
    if not state.players:
        return False
    return all(p.ready for p in state.players)


def create_joint_combat_proposal(state: GameState, proposer_id: str, ally_id: str,
                                  target_player_id: str, attack_turn: int,
                                  proposer_ship_id: str = "", ally_ship_id: str = "",
                                  target_ship_id: str = "") -> Optional[JointCombatProposal]:
    alliance = get_alliance(state, proposer_id, ally_id)
    if not alliance or alliance.trust_level < 3:
        return None

    if target_player_id == proposer_id or target_player_id == ally_id:
        return None

    target_player = next((p for p in state.players if p.id == target_player_id), None)
    if not target_player:
        return None

    if attack_turn <= state.turn:
        return None

    for p in state.joint_combat_proposals:
        if p.status in [JointCombatStatus.PENDING, JointCombatStatus.CONFIRMED, JointCombatStatus.ACTIVE]:
            if p.proposer_id == proposer_id and p.ally_id == ally_id:
                return None
            if p.proposer_id == ally_id and p.ally_id == proposer_id:
                return None

    if not proposer_ship_id:
        proposer_ship = next((a for a in state.airships if a.player_id == proposer_id and a.status not in [ShipStatus.DESTROYED, ShipStatus.DISABLED]), None)
        proposer_ship_id = proposer_ship.id if proposer_ship else ""

    if not ally_ship_id:
        ally_ship = next((a for a in state.airships if a.player_id == ally_id and a.status not in [ShipStatus.DESTROYED, ShipStatus.DISABLED]), None)
        ally_ship_id = ally_ship.id if ally_ship else ""

    if not target_ship_id:
        target_ship = next((a for a in state.airships if a.player_id == target_player_id and a.status not in [ShipStatus.DESTROYED, ShipStatus.DISABLED]), None)
        target_ship_id = target_ship.id if target_ship else ""

    proposal = JointCombatProposal(
        id=f"jc_{_generate_id()}",
        proposer_id=proposer_id,
        ally_id=ally_id,
        target_player_id=target_player_id,
        attack_turn=attack_turn,
        status=JointCombatStatus.PENDING,
        proposer_ship_id=proposer_ship_id,
        ally_ship_id=ally_ship_id,
        target_ship_id=target_ship_id,
        created_at_turn=state.turn
    )
    state.joint_combat_proposals.append(proposal)

    proposer_player = next((p for p in state.players if p.id == proposer_id), None)
    ally_player = next((p for p in state.players if p.id == ally_id), None)
    state.event_log.append(
        f"⚔️ {proposer_player.name if proposer_player else proposer_id} proposed a joint combat "
        f"against {target_player.name if target_player else target_player_id} at turn {attack_turn} "
        f"(with {ally_player.name if ally_player else ally_id})"
    )

    return proposal


def confirm_joint_combat_proposal(state: GameState, proposal_id: str, confirmer_id: str) -> Optional[JointCombatProposal]:
    proposal = next((p for p in state.joint_combat_proposals if p.id == proposal_id), None)
    if not proposal:
        return None

    if proposal.status != JointCombatStatus.PENDING:
        return None

    if proposal.ally_id != confirmer_id:
        return None

    alliance = get_alliance(state, proposal.proposer_id, proposal.ally_id)
    if not alliance or alliance.trust_level < 3:
        proposal.status = JointCombatStatus.CANCELLED
        return None

    proposal.status = JointCombatStatus.CONFIRMED

    proposer_player = next((p for p in state.players if p.id == proposal.proposer_id), None)
    ally_player = next((p for p in state.players if p.id == proposal.ally_id), None)
    target_player = next((p for p in state.players if p.id == proposal.target_player_id), None)
    state.event_log.append(
        f"✅ Joint combat confirmed! {ally_player.name if ally_player else ally_id} agreed to "
        f"attack {target_player.name if target_player else target_player_id} at turn {proposal.attack_turn}"
    )

    return proposal


def _check_joint_combat_betrayal(state: GameState, proposal: JointCombatProposal,
                                  ship_a: Airship, ship_c: Airship, ship_b: Airship) -> bool:
    betrayed = False

    if ship_a.status not in [ShipStatus.DESTROYED, ShipStatus.DISABLED]:
        if proposal.status == JointCombatStatus.ACTIVE and ship_a.in_battle_id is None:
            _handle_betrayal(state, proposal.proposer_id, proposal.ally_id,
                           f"{ship_a.name} fled the joint combat zone against {ship_b.name}")
            proposal.status = JointCombatStatus.BETRAYED
            betrayed = True
        elif proposal.status == JointCombatStatus.ACTIVE and ship_b.status != ShipStatus.DESTROYED:
            dist = _distance(ship_a.position, ship_b.position)
            if dist > 200 and ship_a.in_battle_id is None:
                _handle_betrayal(state, proposal.proposer_id, proposal.ally_id,
                               f"{ship_a.name} left the battle zone (distance: {int(dist)}) during joint combat against {ship_b.name}")
                proposal.status = JointCombatStatus.BETRAYED
                betrayed = True

    if ship_c.status not in [ShipStatus.DESTROYED, ShipStatus.DISABLED]:
        if proposal.status == JointCombatStatus.ACTIVE and ship_c.in_battle_id is None:
            _handle_betrayal(state, proposal.ally_id, proposal.proposer_id,
                           f"{ship_c.name} fled the joint combat zone against {ship_b.name}")
            proposal.status = JointCombatStatus.BETRAYED
            betrayed = True
        elif proposal.status == JointCombatStatus.ACTIVE and ship_b.status != ShipStatus.DESTROYED:
            dist = _distance(ship_c.position, ship_b.position)
            if dist > 200 and ship_c.in_battle_id is None:
                _handle_betrayal(state, proposal.ally_id, proposal.proposer_id,
                               f"{ship_c.name} left the battle zone (distance: {int(dist)}) during joint combat against {ship_b.name}")
                proposal.status = JointCombatStatus.BETRAYED
                betrayed = True

    return betrayed


def _enforce_joint_combat_engagement(state: GameState, proposal: JointCombatProposal) -> None:
    ship_a = next((a for a in state.airships if a.id == proposal.proposer_ship_id), None)
    ship_c = next((a for a in state.airships if a.id == proposal.ally_ship_id), None)
    ship_b = next((a for a in state.airships if a.id == proposal.target_ship_id), None)

    if not ship_a or not ship_c or not ship_b:
        return

    _check_joint_combat_betrayal(state, proposal, ship_a, ship_c, ship_b)


def resolve_joint_combat_betrayals(state: GameState) -> GameState:
    active_proposals = [
        p for p in state.joint_combat_proposals
        if p.status == JointCombatStatus.ACTIVE
    ]
    for proposal in active_proposals:
        _enforce_joint_combat_engagement(state, proposal)
    return state


def _resolve_joint_combat_battle(battle: Battle, state: GameState) -> None:
    ship_a = next((a for a in state.airships if a.id == battle.ship_a_id), None)
    ship_b = next((a for a in state.airships if a.id == battle.ship_b_id), None)
    ship_c = next((a for a in state.airships if a.id == battle.ship_c_id), None) if battle.ship_c_id else None

    if not ship_a or not ship_b:
        battle.phase = BattlePhase.ENDED
        return

    if ship_a.status == ShipStatus.DESTROYED and (not ship_c or ship_c.status == ShipStatus.DESTROYED):
        battle.winner = ship_b.player_id
        battle.phase = BattlePhase.ENDED
        battle.log.append(f"Battle ended: {ship_b.name} wins by default")
        return
    if ship_b.status == ShipStatus.DESTROYED:
        battle.phase = BattlePhase.ENDED
        return

    action_records: List[BattleActionRecord] = []
    battle.turn += 1

    if battle.smoke_screen_turns > 0:
        battle.smoke_screen_turns -= 1
        if battle.smoke_screen_turns == 0:
            battle.smoke_screen_active = False
            battle.log.append("Smoke screen dissipates")

    if battle.phase == BattlePhase.INITIATION:
        battle.phase = BattlePhase.RANGED

    defender_facing = battle.defender_facing

    attacker_a_actions = [a for a in battle.attacker_actions if a]
    attacker_b_actions = [a for a in battle.ship_c_actions if a]
    defender_actions = [a for a in battle.defender_actions if a]

    pincer_bonus = 0.3

    def _apply_joint_attack(attacker: Airship, defender: Airship, actions: List[BattleAction],
                            side: str, is_pincer: bool) -> int:
        total_damage_dealt = 0
        for action in actions:
            if action.type == ActionType.ATTACK:
                if battle.smoke_screen_active and random.random() < settings.smoke_screen_miss_chance:
                    battle.log.append(f"{attacker.name}'s attack misses due to smoke screen!")
                    action_records.append(BattleActionRecord(
                        turn=battle.turn, action_type="attack",
                        attacker_ship_id=attacker.id, attacker_ship_name=attacker.name,
                        defender_ship_id=defender.id, defender_ship_name=defender.name,
                        target_module=(action.target_module or ModuleTarget.ANY).value,
                        damage=0, hit=False,
                        special_effect="smoke_screen_miss", category="attack"
                    ))
                    continue

                damage = _calculate_ship_attack_power(attacker, action)
                if is_pincer and side != defender_facing:
                    damage = int(damage * (1 + pincer_bonus))
                    action.params["pincer_bonus"] = True

                target = action.target_module or ModuleTarget.ANY
                _apply_damage(defender, damage, target, state, battle, attacker, action_records)
                total_damage_dealt += damage

                if action.weapon_type == "incendiary" and defender.gas_balloon.flammable:
                    if random.random() < 0.3:
                        defender.gas_balloon.on_fire = True
                        defender.gas_balloon.fire_damage_remaining = settings.incendiary_dot_damage * 3
                        battle.log.append(f"{defender.name}'s balloon catches fire!")

            elif action.type == ActionType.RETREAT:
                retreat_chance = 0.2
                if random.random() < retreat_chance:
                    battle.phase = BattlePhase.ENDED
                    attacker.in_battle_id = None
                    attacker.status = ShipStatus.FLYING if attacker.current_city_id is None else ShipStatus.DOCKED
                    battle.log.append(f"{attacker.name} retreats from joint combat!")
                    state.event_log.append(f"{attacker.name} retreated from joint combat - BETRAYAL!")

                    proposal = None
                    for p in state.joint_combat_proposals:
                        if p.status == JointCombatStatus.ACTIVE:
                            ship_ids = {p.proposer_ship_id, p.ally_ship_id}
                            if attacker.id in ship_ids:
                                proposal = p
                                break
                    if proposal:
                        betrayer_id = proposal.proposer_id if attacker.player_id == proposal.proposer_id else proposal.ally_id
                        victim_id = proposal.ally_id if betrayer_id == proposal.proposer_id else proposal.proposer_id
                        _handle_betrayal(state, betrayer_id, victim_id,
                                       f"{attacker.name} retreated from joint combat")
                        proposal.status = JointCombatStatus.BETRAYED
                else:
                    battle.log.append(f"{attacker.name} failed to retreat!")
                    attacker.morale = max(0, attacker.morale - 10)

        return total_damage_dealt

    for action in defender_actions:
        if action.type == ActionType.ATTACK:
            if action.params.get("facing"):
                battle.defender_facing = action.params["facing"]
        elif action.type == ActionType.RETREAT:
            retreat_chance = 0.3 + (ship_b.speed / 50) * 0.2
            if random.random() < retreat_chance:
                battle.phase = BattlePhase.ENDED
                ship_a.in_battle_id = None
                ship_b.in_battle_id = None
                if ship_c:
                    ship_c.in_battle_id = None
                ship_a.status = ShipStatus.FLYING if ship_a.current_city_id is None else ShipStatus.DOCKED
                ship_b.status = ShipStatus.FLYING if ship_b.current_city_id is None else ShipStatus.DOCKED
                if ship_c:
                    ship_c.status = ShipStatus.FLYING if ship_c.current_city_id is None else ShipStatus.DOCKED
                battle.log.append(f"{ship_b.name} successfully retreats from joint combat!")
                battle.winner = f"joint_{ship_a.player_id}_{ship_c.player_id if ship_c else ''}"
                _finalize_joint_battle_report(battle, state, action_records, ship_a, ship_b, ship_c)
                return

    a_damage = _apply_joint_attack(ship_a, ship_b, attacker_a_actions, "port",
                                    is_pincer=(ship_c is not None))
    battle.attacker_a_damage_total += a_damage

    if ship_c:
        c_damage = _apply_joint_attack(ship_c, ship_b, attacker_b_actions, "starboard",
                                        is_pincer=True)
        battle.attacker_b_damage_total += c_damage

    for action in defender_actions:
        if action.type == ActionType.ATTACK:
            if battle.smoke_screen_active and random.random() < settings.smoke_screen_miss_chance:
                continue

            target_choices = [ship_a]
            if ship_c and ship_c.status not in [ShipStatus.DESTROYED, ShipStatus.DISABLED]:
                target_choices.append(ship_c)

            if action.params.get("target_ship_id") == ship_c.id and ship_c in target_choices:
                primary_target = ship_c
            elif action.params.get("target_ship_id") == ship_a.id:
                primary_target = ship_a
            else:
                primary_target = random.choice(target_choices)

            damage = _calculate_ship_attack_power(ship_b, action)
            target = action.target_module or ModuleTarget.ANY
            _apply_damage(primary_target, damage, target, state, battle, ship_b, action_records)

            if action.weapon_type == "incendiary" and primary_target.gas_balloon.flammable:
                if random.random() < 0.3:
                    primary_target.gas_balloon.on_fire = True
                    primary_target.gas_balloon.fire_damage_remaining = settings.incendiary_dot_damage * 3

        if action.type == ActionType.ATTACK and action.params.get("smoke_screen"):
            battle.smoke_screen_active = True
            battle.smoke_screen_turns = 2

    for ship in [ship_a, ship_b, ship_c]:
        if ship and ship.gas_balloon.on_fire and ship.gas_balloon.fire_damage_remaining > 0:
            fd = settings.incendiary_dot_damage
            ship.gas_balloon.durability = max(0, ship.gas_balloon.durability - fd)
            ship.hp = max(0, ship.hp - fd // 2)
            ship.gas_balloon.fire_damage_remaining -= fd
            battle.log.append(f"{ship.name} takes {fd} fire damage")
            if random.random() < 0.2:
                ship.gas_balloon.on_fire = False
                ship.gas_balloon.fire_damage_remaining = 0
                battle.log.append(f"Crew extinguishes fire on {ship.name}!")

    if battle.phase == BattlePhase.BOARDING:
        _resolve_joint_boarding(ship_a, ship_c, ship_b, battle, state, action_records)

    if ship_b.hp <= 0:
        battle.phase = BattlePhase.ENDED
        ship_b.status = ShipStatus.DESTROYED
        battle.winner = f"joint_{ship_a.player_id}_{ship_c.player_id if ship_c else ''}"
        battle.log.append(f"{ship_b.name} destroyed by joint attack!")
    elif ship_a.hp <= 0 and (not ship_c or ship_c.hp <= 0):
        battle.winner = ship_b.player_id
        battle.phase = BattlePhase.ENDED
        battle.log.append(f"Both attackers defeated! {ship_b.name} wins!")
    elif ship_b.morale < 15:
        battle.phase = BattlePhase.ENDED
        battle.winner = f"joint_{ship_a.player_id}_{ship_c.player_id if ship_c else ''}"
        battle.log.append(f"{ship_b.name} crew surrenders to the pincer attack!")
    elif battle.turn >= 12 and battle.phase != BattlePhase.BOARDING:
        battle.phase = BattlePhase.BOARDING
        battle.log.append("Joint combat prolonged - closing for boarding action!")

    if battle.phase == BattlePhase.ENDED:
        ship_a.in_battle_id = None
        ship_b.in_battle_id = None
        if ship_c:
            ship_c.in_battle_id = None

        for ship in [s for s in [ship_a, ship_b, ship_c] if s]:
            if ship.status not in [ShipStatus.DESTROYED, ShipStatus.DISABLED]:
                repair_mod = next((m for m in ship.modules if m.module_type == ModuleType.REPAIR and m.durability > 0), None)
                if repair_mod and repair_mod.repair_rate:
                    repair = repair_mod.repair_rate
                    ship.hp = min(ship.max_hp, ship.hp + repair // 2)
                if ship.current_city_id:
                    ship.status = ShipStatus.DOCKED
                else:
                    ship.status = ShipStatus.FLYING if ship.hp > ship.max_hp * 0.3 else ShipStatus.DAMAGED

        _finalize_joint_battle_report(battle, state, action_records, ship_a, ship_b, ship_c)


def _resolve_joint_boarding(ship_a: Airship, ship_c: Optional[Airship], ship_b: Airship,
                             battle: Battle, state: GameState,
                             action_records: List[BattleActionRecord]) -> None:
    attack_marines_a = [c for c in ship_a.crew.values() if c.role == CrewRole.MARINE and c.health > 20]
    attack_crewmen_a = [c for c in ship_a.crew.values() if c.role == CrewRole.CREWMAN and c.health > 20]
    attack_power_a = sum(c.skill for c in attack_marines_a) * 1.5 + sum(c.skill for c in attack_crewmen_a) * 0.5
    attack_power_a += ship_a.morale * 0.2

    attack_power_c = 0
    attack_marines_c = []
    if ship_c:
        attack_marines_c = [c for c in ship_c.crew.values() if c.role == CrewRole.MARINE and c.health > 20]
        attack_crewmen_c = [c for c in ship_c.crew.values() if c.role == CrewRole.CREWMAN and c.health > 20]
        attack_power_c = sum(c.skill for c in attack_marines_c) * 1.5 + sum(c.skill for c in attack_crewmen_c) * 0.5
        attack_power_c += ship_c.morale * 0.2

    combined_attack_power = attack_power_a + attack_power_c

    defend_marines = [c for c in ship_b.crew.values() if c.role == CrewRole.MARINE and c.health > 20]
    defend_crewmen = [c for c in ship_b.crew.values() if c.role == CrewRole.CREWMAN and c.health > 20]
    defend_power = sum(c.skill for c in defend_marines) * 1.5 + sum(c.skill for c in defend_crewmen) * 0.5
    defend_power += ship_b.morale * 0.2

    total_marines = len(attack_marines_a) + len(attack_marines_c)
    battle.log.append(f"Joint boarding! Attackers: {total_marines} marines, Defenders: {len(defend_marines)} marines")
    action_records.append(BattleActionRecord(
        turn=battle.turn, action_type="joint_board",
        attacker_ship_id=ship_a.id, attacker_ship_name=ship_a.name,
        defender_ship_id=ship_b.id, defender_ship_name=ship_b.name,
        target_module="", damage=0, hit=True,
        special_effect=f"joint_boarding_{total_marines}v{len(defend_marines)}", category="attack"
    ))

    ratio = combined_attack_power / max(combined_attack_power + defend_power, 1)

    for _ in range(3):
        if ratio > 0.5:
            casualties_def = random.randint(1, max(1, int(len(defend_marines) * 0.25 + len(defend_crewmen) * 0.1)))
            for _ in range(min(casualties_def, len(defend_marines))):
                if defend_marines:
                    m = defend_marines.pop()
                    m.health = max(0, m.health - random.randint(30, 70))
            ship_b.morale = max(0, ship_b.morale - 10)
        else:
            attacker_list = attack_marines_a if random.random() < 0.5 else attack_marines_c
            casualties_att = random.randint(1, max(1, int(len(attacker_list) * 0.2)))
            for _ in range(min(casualties_att, len(attacker_list))):
                if attacker_list:
                    m = attacker_list.pop()
                    m.health = max(0, m.health - random.randint(30, 70))
            ship_a.morale = max(0, ship_a.morale - 5)
            if ship_c:
                ship_c.morale = max(0, ship_c.morale - 5)

    total_attack_morale = ship_a.morale
    if ship_c:
        total_attack_morale = (ship_a.morale + ship_c.morale) / 2
    total_defend_morale = ship_b.morale + sum(c.morale for c in defend_marines) / max(len(defend_marines), 1) * 0.5

    if total_attack_morale > total_defend_morale * 1.3 or not defend_marines:
        battle.winner = f"joint_{ship_a.player_id}_{ship_c.player_id if ship_c else ''}"
        ship_b.status = ShipStatus.DISABLED
        battle.log.append(f"Joint boarding successful! {ship_a.name} & {ship_c.name if ship_c else ''} capture {ship_b.name}!")
        action_records.append(BattleActionRecord(
            turn=battle.turn, action_type="joint_capture",
            attacker_ship_id=ship_a.id, attacker_ship_name=ship_a.name,
            defender_ship_id=ship_b.id, defender_ship_name=ship_b.name,
            target_module="", damage=0, hit=True,
            special_effect="joint_captured", category="attack"
        ))
    elif total_defend_morale > total_attack_morale * 1.3:
        battle.winner = ship_b.player_id
        battle.log.append(f"Joint boarding repelled! {ship_b.name} defends against the pincer attack!")
        for c in attack_marines_a:
            c.health = max(0, c.health - random.randint(20, 50))
        if ship_c:
            for c in attack_marines_c:
                c.health = max(0, c.health - random.randint(20, 50))


def _finalize_joint_battle_report(battle: Battle, state: GameState,
                                   action_records: List[BattleActionRecord],
                                   ship_a: Airship, ship_b: Airship,
                                   ship_c: Optional[Airship]) -> None:
    is_sink = ship_b.hp <= 0 or ship_a.hp <= 0
    is_capture = ship_b.status == ShipStatus.DISABLED

    result = "ongoing"
    if battle.winner:
        if is_sink:
            result = "sink"
        elif is_capture:
            result = "capture"
        else:
            result = "joint_victory"
    elif battle.phase == BattlePhase.ENDED and not battle.winner:
        result = "draw"

    loot_split: Dict[str, int] = {}
    if battle.winner and is_capture:
        total_damage = battle.attacker_a_damage_total + battle.attacker_b_damage_total
        loot_value = 0
        for cargo in ship_b.cargo:
            loot_value += cargo.base_value * cargo.amount
        defender_player = next((p for p in state.players if p.id == ship_b.player_id), None)
        if defender_player:
            cash_loot = min(defender_player.wealth, 1500)
            loot_value += cash_loot
            defender_player.wealth -= cash_loot

        if total_damage > 0:
            a_share = int(loot_value * (battle.attacker_a_damage_total / total_damage))
            c_share = loot_value - a_share
        else:
            a_share = loot_value // 2
            c_share = loot_value - a_share

        proposer_player = next((p for p in state.players if p.id == ship_a.player_id), None)
        if proposer_player:
            proposer_player.wealth += a_share

        for cargo in list(ship_b.cargo):
            cargo_value = cargo.base_value * cargo.amount
            if total_damage > 0:
                a_cargo_share = max(1, int(cargo.amount * (battle.attacker_a_damage_total / total_damage)))
            else:
                a_cargo_share = cargo.amount // 2
            c_cargo_share = cargo.amount - a_cargo_share

            if a_cargo_share > 0:
                ship_a.cargo.append(Cargo(type=cargo.type, amount=a_cargo_share, base_value=cargo.base_value))
            if ship_c and c_cargo_share > 0:
                ship_c.cargo.append(Cargo(type=cargo.type, amount=c_cargo_share, base_value=cargo.base_value))

        ship_b.cargo = []

        loot_split[ship_a.player_id] = a_share
        if ship_c:
            ally_player = next((p for p in state.players if p.id == ship_c.player_id), None)
            if ally_player:
                ally_player.wealth += c_share
            loot_split[ship_c.player_id] = c_share

    elif battle.winner and is_sink:
        defender_player = next((p for p in state.players if p.id == ship_b.player_id), None)
        if defender_player:
            total_damage = battle.attacker_a_damage_total + battle.attacker_b_damage_total
            salvage = min(defender_player.wealth // 3, 500)
            defender_player.wealth -= salvage
            if total_damage > 0:
                a_share = int(salvage * (battle.attacker_a_damage_total / total_damage))
                c_share = salvage - a_share
            else:
                a_share = salvage // 2
                c_share = salvage - a_share

            proposer_player = next((p for p in state.players if p.id == ship_a.player_id), None)
            if proposer_player:
                proposer_player.wealth += a_share

            if ship_c:
                ally_player = next((p for p in state.players if p.id == ship_c.player_id), None)
                if ally_player:
                    ally_player.wealth += c_share

            loot_split[ship_a.player_id] = a_share
            if ship_c:
                loot_split[ship_c.player_id] = c_share

    winner_ship_name = ""
    if battle.winner:
        winner_ship_name = f"{ship_a.name} & {ship_c.name if ship_c else ''}"

    report = BattleReport(
        id=f"report_{_generate_id()}",
        battle_id=battle.id,
        attacker_ship_id=ship_a.id,
        attacker_ship_name=ship_a.name,
        attacker_player_id=ship_a.player_id,
        defender_ship_id=ship_b.id,
        defender_ship_name=ship_b.name,
        defender_player_id=ship_b.player_id,
        result=result,
        winner_player_id=battle.winner,
        winner_ship_name=winner_ship_name,
        duration_turns=battle.turn,
        action_records=action_records,
        is_sink=is_sink,
        is_capture=is_capture,
        turn_number=state.turn,
        is_joint_combat=True,
        attacker_b_ship_id=ship_c.id if ship_c else "",
        attacker_b_ship_name=ship_c.name if ship_c else "",
        attacker_b_player_id=ship_c.player_id if ship_c else "",
        loot_split=loot_split
    )

    state.battle_reports.append(report)
    if len(state.battle_reports) > 30:
        state.battle_reports = state.battle_reports[-30:]

    state.event_log.append(
        f"Joint combat resolved: {ship_a.name} & {ship_c.name if ship_c else ''} vs {ship_b.name} - {result}"
    )


def _finalize_joint_combat_proposals(state: GameState) -> None:
    for proposal in state.joint_combat_proposals:
        if proposal.status != JointCombatStatus.ACTIVE:
            continue
        ship_a = next((a for a in state.airships if a.id == proposal.proposer_ship_id), None)
        ship_c = next((a for a in state.airships if a.id == proposal.ally_ship_id), None)
        ship_b = next((a for a in state.airships if a.id == proposal.target_ship_id), None)
        target_destroyed = ship_b and ship_b.status == ShipStatus.DESTROYED
        all_out_of_battle = (
            (ship_a is None or ship_a.in_battle_id is None) and
            (ship_c is None or ship_c.in_battle_id is None) and
            (ship_b is None or ship_b.in_battle_id is None)
        )
        if target_destroyed or all_out_of_battle:
            proposal.status = JointCombatStatus.COMPLETED
            if target_destroyed and ship_b:
                state.event_log.append(f"✅ Joint combat against {ship_b.name} completed successfully!")
            else:
                state.event_log.append(f"ℹ️ Joint combat proposal (id={proposal.id}) finalized")


def resolve_joint_combat(state: GameState) -> GameState:
    active_proposals = [
        p for p in state.joint_combat_proposals
        if p.status == JointCombatStatus.CONFIRMED and p.attack_turn == state.turn
    ]

    for proposal in active_proposals:
        ship_a = next((a for a in state.airships if a.id == proposal.proposer_ship_id), None)
        ship_c = next((a for a in state.airships if a.id == proposal.ally_ship_id), None)
        ship_b = next((a for a in state.airships if a.id == proposal.target_ship_id), None)

        if not ship_a or not ship_c or not ship_b:
            proposal.status = JointCombatStatus.CANCELLED
            state.event_log.append(f"Joint combat cancelled - required ships not available")
            continue

        if ship_a.status in [ShipStatus.DESTROYED, ShipStatus.DISABLED]:
            proposal.status = JointCombatStatus.CANCELLED
            continue
        if ship_c.status in [ShipStatus.DESTROYED, ShipStatus.DISABLED]:
            proposal.status = JointCombatStatus.CANCELLED
            continue
        if ship_b.status in [ShipStatus.DESTROYED]:
            proposal.status = JointCombatStatus.CANCELLED
            continue

        if ship_a.in_battle_id or ship_c.in_battle_id or ship_b.in_battle_id:
            proposal.status = JointCombatStatus.CANCELLED
            state.event_log.append(f"Joint combat cancelled - one of the ships is already in battle")
            continue

        alliance = get_alliance(state, proposal.proposer_id, proposal.ally_id)
        if not alliance or not alliance.active or alliance.trust_level < 3:
            proposal.status = JointCombatStatus.CANCELLED
            state.event_log.append(f"Joint combat cancelled - alliance no longer valid")
            continue

        target_pos = ship_b.position
        dist_a = _distance(ship_a.position, target_pos)
        dist_c = _distance(ship_c.position, target_pos)

        if dist_a > 150:
            if dist_a > 300:
                proposal.status = JointCombatStatus.CANCELLED
                state.event_log.append(f"Joint combat cancelled - {ship_a.name} too far from target")
                continue
            angle = math.atan2(target_pos.y - ship_a.position.y, target_pos.x - ship_a.position.x)
            ship_a.position = Position(
                x=target_pos.x - math.cos(angle) * 60,
                y=target_pos.y - math.sin(angle) * 60
            )

        if dist_c > 150:
            if dist_c > 300:
                proposal.status = JointCombatStatus.CANCELLED
                state.event_log.append(f"Joint combat cancelled - {ship_c.name} too far from target")
                continue
            angle = math.atan2(target_pos.y - ship_c.position.y, target_pos.x - ship_c.position.x)
            ship_c.position = Position(
                x=target_pos.x - math.cos(angle) * 60,
                y=target_pos.y - math.sin(angle) * 60
            )

        battle = Battle(
            id=f"battle_{_generate_id()}",
            ship_a_id=ship_a.id,
            ship_b_id=ship_b.id,
            phase=BattlePhase.INITIATION,
            turn=0,
            ship_a_morale=ship_a.morale,
            ship_b_morale=ship_b.morale,
            log=[f"Joint combat! {ship_a.name} & {ship_c.name} attack {ship_b.name} from both flanks!"],
            is_joint_combat=True,
            ship_c_id=ship_c.id,
            ship_c_morale=ship_c.morale,
            defender_facing="port"
        )

        state.battles.append(battle)
        ship_a.in_battle_id = battle.id
        ship_b.in_battle_id = battle.id
        ship_c.in_battle_id = battle.id
        ship_a.status = ShipStatus.BATTLING
        ship_b.status = ShipStatus.BATTLING
        ship_c.status = ShipStatus.BATTLING

        proposal.status = JointCombatStatus.ACTIVE
        state.event_log.append(f"⚔️ JOINT COMBAT: {ship_a.name} & {ship_c.name} engage {ship_b.name} in pincer attack!")

    for proposal in state.joint_combat_proposals:
        if proposal.status == JointCombatStatus.CONFIRMED and proposal.attack_turn < state.turn:
            proposal.status = JointCombatStatus.CANCELLED
            state.event_log.append(f"Joint combat proposal expired (attack turn {proposal.attack_turn} passed)")

    return state


def start_game(state: GameState) -> GameState:
    state.phase = "orders"
    state.turn = 0
    state.event_log.append("Game started! Submit your orders for turn 1.")
    return state
