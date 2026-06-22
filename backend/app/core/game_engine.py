import math
import random
import uuid
from typing import List, Dict, Optional, Tuple
from app.models.game_models import (
    GameState, Player, Airship, City, Waypoint, Weather, Battle, BattleAction,
    Order, GasBalloon, ShipModule, CrewMember, Cargo, TradeGood, Position,
    AltitudeLevel, ModuleType, GasType, WeatherType, ActionType, BattlePhase,
    ShipStatus, CityType, CargoType, CrewRole, ModuleTarget
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
                
                if attacker_order or (dist < 25 and ship_a.player_id not in ship_b.in_battle_id if ship_b.in_battle_id else True):
                    player_a = next((p for p in state.players if p.id == ship_a.player_id), None)
                    player_b = next((p for p in state.players if p.id == ship_b.player_id), None)
                    
                    if player_a and player_b and (player_a.id not in player_b.alliances):
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


def _apply_damage(ship: Airship, damage: int, target: ModuleTarget, state: GameState, battle: Battle) -> None:
    defense = _calculate_defense(ship)
    actual_damage = int(damage * (1 - min(defense, 0.6)))
    
    if actual_damage <= 0:
        battle.log.append(f"{ship.name} deflects the attack!")
        return
    
    if target == ModuleTarget.BALLOON:
        ship.gas_balloon.durability = max(0, ship.gas_balloon.durability - actual_damage)
        ship.hp = max(0, ship.hp - int(actual_damage * 0.3))
        battle.log.append(f"Direct hit to {ship.name}'s balloon! -{actual_damage} durability")
        if ship.gas_balloon.durability <= 0:
            ship.hp = 0
            battle.log.append(f"{ship.name}'s balloon has been destroyed!")
    elif target == ModuleTarget.COCKPIT:
        cockpit = next((m for m in ship.modules if m.module_type == ModuleType.COCKPIT), None)
        if cockpit:
            cockpit.durability = max(0, cockpit.durability - actual_damage)
            ship.hp = max(0, ship.hp - int(actual_damage * 0.5))
            battle.log.append(f"Command cockpit hit! -{actual_damage} damage")
    elif target == ModuleTarget.GUN_DECK:
        gun_decks = [m for m in ship.modules if m.module_type == ModuleType.GUN_DECK and m.durability > 0]
        if gun_decks:
            target_deck = random.choice(gun_decks)
            target_deck.durability = max(0, target_deck.durability - actual_damage)
            ship.hp = max(0, ship.hp - int(actual_damage * 0.4))
            battle.log.append(f"Gun deck hit! -{actual_damage} damage")
    elif target == ModuleTarget.ENGINE:
        engine = next((m for m in ship.modules if m.module_type == ModuleType.ENGINE), None)
        if engine:
            engine.durability = max(0, engine.durability - actual_damage)
            ship.hp = max(0, ship.hp - int(actual_damage * 0.4))
            battle.log.append(f"Engine hit! -{actual_damage} damage")
    elif target == ModuleTarget.CARGO:
        cargo_mod = next((m for m in ship.modules if m.module_type == ModuleType.CARGO), None)
        if cargo_mod:
            cargo_mod.durability = max(0, cargo_mod.durability - actual_damage)
            if ship.cargo:
                lost = random.randint(0, min(actual_damage, len(ship.cargo)))
                if lost > 0:
                    ship.cargo = ship.cargo[:-lost]
                    battle.log.append(f"Cargo hit! Lost {lost} cargo units")
    else:
        target_pool = [m for m in ship.modules if m.durability > 0]
        if target_pool:
            hit_mod = random.choice(target_pool)
            hit_mod.durability = max(0, hit_mod.durability - actual_damage)
        ship.hp = max(0, ship.hp - actual_damage)
        battle.log.append(f"{ship.name} takes -{actual_damage} damage")
    
    if ship.hp <= 0:
        ship.status = ShipStatus.DESTROYED
        battle.log.append(f"{ship.name} has been destroyed!")


def _resolve_boarding(ship_attacker: Airship, ship_defender: Airship, battle: Battle, state: GameState) -> None:
    attack_marines = [c for c in ship_attacker.crew.values() if c.role == CrewRole.MARINE and c.health > 20]
    defend_marines = [c for c in ship_defender.crew.values() if c.role == CrewRole.MARINE and c.health > 20]
    attack_crewmen = [c for c in ship_attacker.crew.values() if c.role == CrewRole.CREWMAN and c.health > 20]
    defend_crewmen = [c for c in ship_defender.crew.values() if c.role == CrewRole.CREWMAN and c.health > 20]
    
    attack_power = sum(c.skill for c in attack_marines) * 1.5 + sum(c.skill for c in attack_crewmen) * 0.5
    attack_power += ship_attacker.morale * 0.2
    defend_power = sum(c.skill for c in defend_marines) * 1.5 + sum(c.skill for c in defend_crewmen) * 0.5
    defend_power += ship_defender.morale * 0.2
    
    battle.log.append(f"Boarding action! Attackers: {len(attack_marines)} marines, Defenders: {len(defend_marines)} marines")
    
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
    
    battle.turn += 1
    
    if battle.smoke_screen_turns > 0:
        battle.smoke_screen_turns -= 1
        if battle.smoke_screen_turns == 0:
            battle.smoke_screen_active = False
            battle.log.append("Smoke screen dissipates")
    
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
                return
            else:
                battle.log.append(f"{ship_a.name} failed to retreat!")
                ship_a.morale = max(0, ship_a.morale - 10)
        elif action.type == ActionType.BOARD:
            battle.ship_a_boarded = True
            battle.phase = BattlePhase.BOARDING
            battle.log.append(f"{ship_a.name} moves to board {ship_b.name}")
    
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
                return
            else:
                battle.log.append(f"{ship_b.name} failed to retreat!")
                ship_b.morale = max(0, ship_b.morale - 10)
    
    if battle.phase == BattlePhase.RANGED:
        for action in attacker_actions:
            if action.type == ActionType.ATTACK:
                if battle.smoke_screen_active and random.random() < settings.smoke_screen_miss_chance:
                    battle.log.append(f"{ship_a.name}'s attack misses due to smoke screen!")
                    continue
                
                damage = _calculate_ship_attack_power(ship_a, action)
                target = action.target_module or ModuleTarget.ANY
                _apply_damage(ship_b, damage, target, state, battle)
                
                if action.weapon_type == "incendiary" and ship_b.gas_balloon.flammable:
                    if random.random() < 0.3:
                        ship_b.gas_balloon.on_fire = True
                        ship_b.gas_balloon.fire_damage_remaining = settings.incendiary_dot_damage * 3
                        battle.log.append(f"{ship_b.name}'s balloon catches fire!")
        
        for action in defender_actions:
            if action.type == ActionType.ATTACK:
                if battle.smoke_screen_active and random.random() < settings.smoke_screen_miss_chance:
                    battle.log.append(f"{ship_b.name}'s attack misses due to smoke screen!")
                    continue
                
                damage = _calculate_ship_attack_power(ship_b, action)
                target = action.target_module or ModuleTarget.ANY
                _apply_damage(ship_a, damage, target, state, battle)
                
                if action.weapon_type == "incendiary" and ship_a.gas_balloon.flammable:
                    if random.random() < 0.3:
                        ship_a.gas_balloon.on_fire = True
                        ship_a.gas_balloon.fire_damage_remaining = settings.incendiary_dot_damage * 3
                        battle.log.append(f"{ship_a.name}'s balloon catches fire!")
            
            if action.type == ActionType.ATTACK and action.params.get("smoke_screen"):
                battle.smoke_screen_active = True
                battle.smoke_screen_turns = 2
                battle.log.append(f"{ship_b.name} deploys smoke screen!")
        
        for action in attacker_actions:
            if action.type == ActionType.ATTACK and action.params.get("smoke_screen"):
                battle.smoke_screen_active = True
                battle.smoke_screen_turns = 2
                battle.log.append(f"{ship_a.name} deploys smoke screen!")
    
    for ship in [ship_a, ship_b]:
        if ship.gas_balloon.on_fire and ship.gas_balloon.fire_damage_remaining > 0:
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
        if battle.ship_a_boarded:
            _resolve_boarding(ship_a, ship_b, battle, state)
        else:
            _resolve_boarding(ship_b, ship_a, battle, state)
    
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
                    else:
                        battle.defender_actions.append(action)
    
    active_battles = [b for b in state.battles if b.phase != BattlePhase.ENDED]
    for battle in active_battles:
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
    resolve_encounters(state)
    resolve_battles(state)
    resolve_trade(state)
    resolve_weather(state)
    resolve_events(state)
    
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
    
    return state


def check_all_players_ready(state: GameState) -> bool:
    if not state.players:
        return False
    return all(p.ready for p in state.players)


def start_game(state: GameState) -> GameState:
    state.phase = "orders"
    state.turn = 0
    state.event_log.append("Game started! Submit your orders for turn 1.")
    return state
