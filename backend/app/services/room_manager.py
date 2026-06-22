import json
import asyncio
from typing import Optional, List
from app.models.game_models import (
    GameState, Player, Order, BattleAction, BattlePhase
)
from app.core.game_engine import (
    initialize_game, assign_player_to_game, process_turn,
    check_all_players_ready, start_game
)
from app.core.redis_client import RedisClient
from app.services.websocket_manager import ws_manager
from app.core.config import settings


class RoomManager:
    _instance: Optional["RoomManager"] = None
    _lock: asyncio.Lock = asyncio.Lock()

    def __new__(cls) -> "RoomManager":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self) -> None:
        if not hasattr(self, '_processing'):
            self._processing: set = set()

    def _get_state_key(self, room_id: str) -> str:
        return RedisClient.get_key(room_id, "state")

    def _get_orders_key(self, room_id: str) -> str:
        return RedisClient.get_key(room_id, "orders")

    async def create_room(self, room_id: str, player_count: int) -> GameState:
        state = initialize_game(room_id, player_count)
        await self._save_state_to_store(state)
        return state

    async def join_room(self, room_id: str, player_id: str, player_name: str, color: Optional[str] = None) -> Optional[GameState]:
        state = await self.get_state(room_id)
        if state is None:
            return None
        
        if state.phase != "lobby":
            raise ValueError("Game already started")
        
        existing_player = next((p for p in state.players if p.id == player_id), None)
        if existing_player:
            return state
        
        if len(state.players) >= settings.max_players_per_room:
            raise ValueError("Room is full")
        
        state = assign_player_to_game(state, player_id, player_name, color or "#3498db")
        await self._save_state_to_store(state)
        await ws_manager.broadcast_state(room_id, state)
        
        return state

    async def get_state(self, room_id: str) -> Optional[GameState]:
        key = self._get_state_key(room_id)
        data = await RedisClient.get_json(key)
        if data is None:
            return None
        try:
            return GameState(**data)
        except Exception as e:
            print(f"Error deserializing game state: {e}")
            return None

    async def _save_state_to_store(self, state: GameState) -> None:
        key = self._get_state_key(state.room_id)
        state_dict = state.model_dump(mode="json")
        await RedisClient.set_json(key, state_dict, expire=86400)

    async def save_state(self, room_id: str, state: GameState) -> None:
        await self._save_state_to_store(state)

    async def set_player_ready(self, room_id: str, player_id: str, ready: bool = True) -> Optional[GameState]:
        state = await self.get_state(room_id)
        if state is None:
            return None
        
        player = next((p for p in state.players if p.id == player_id), None)
        if player is None:
            return None
        
        player.ready = ready
        await self._save_state_to_store(state)
        await ws_manager.broadcast_state(room_id, state)
        
        if state.phase == "lobby" and check_all_players_ready(state):
            if len(state.players) >= settings.min_players_per_room:
                state = start_game(state)
                await self._save_state_to_store(state)
                await ws_manager.broadcast_state(room_id, state)
                await ws_manager.broadcast_event(room_id, "game_started")
        
        return state

    async def submit_orders(self, room_id: str, player_id: str, orders: List[Order]) -> Optional[GameState]:
        state = await self.get_state(room_id)
        if state is None:
            return None
        
        if state.phase != "orders":
            raise ValueError("Not accepting orders at this phase")
        
        player = next((p for p in state.players if p.id == player_id), None)
        if player is None:
            return None
        
        state.pending_orders = [o for o in state.pending_orders if o.player_id != player_id]
        state.pending_orders.extend(orders)
        
        await self._save_state_to_store(state)
        await ws_manager.broadcast_event(room_id, "orders_submitted", {
            "player_id": player_id,
            "order_count": len(orders)
        })
        
        return state

    async def submit_battle_actions(self, room_id: str, player_id: str, battle_id: str, actions: List[BattleAction]) -> Optional[GameState]:
        state = await self.get_state(room_id)
        if state is None:
            return None
        
        battle = next((b for b in state.battles if b.id == battle_id), None)
        if battle is None:
            raise ValueError("Battle not found")
        
        if battle.phase == BattlePhase.ENDED:
            raise ValueError("Battle already ended")
        
        player_ships = [a.id for a in state.airships if a.player_id == player_id]
        
        if battle.ship_a_id in player_ships:
            battle.attacker_actions = actions
        elif battle.ship_b_id in player_ships:
            battle.defender_actions = actions
        else:
            raise ValueError("Player not involved in this battle")
        
        await self._save_state_to_store(state)
        await ws_manager.broadcast_event(room_id, "battle_actions_submitted", {
            "battle_id": battle_id,
            "player_id": player_id
        })
        
        return state

    async def process_turn(self, room_id: str) -> Optional[GameState]:
        async with self._lock:
            if room_id in self._processing:
                return None
            self._processing.add(room_id)
        
        try:
            state = await self.get_state(room_id)
            if state is None:
                return None
            
            if state.phase == "ended":
                return state
            
            state = process_turn(state)
            await self._save_state_to_store(state)
            await ws_manager.broadcast_state(room_id, state)
            
            if state.phase == "ended":
                await ws_manager.broadcast_event(room_id, "game_ended", {
                    "winner": state.winner,
                    "scores": state.scores
                })
            else:
                await ws_manager.send_turn_notification(room_id, state.turn)
            
            return state
        finally:
            self._processing.discard(room_id)

    async def delete_room(self, room_id: str) -> bool:
        state_key = self._get_state_key(room_id)
        orders_key = self._get_orders_key(room_id)
        await RedisClient.delete(state_key)
        await RedisClient.delete(orders_key)
        return True

    async def list_rooms(self) -> List[str]:
        return []

    async def kick_player(self, room_id: str, player_id: str) -> Optional[GameState]:
        state = await self.get_state(room_id)
        if state is None:
            return None
        
        state.players = [p for p in state.players if p.id != player_id]
        state.airships = [a for a in state.airships if a.player_id != player_id]
        
        for wp in state.waypoints:
            if wp.toll_player_id == player_id:
                wp.toll_player_id = None
                wp.toll_amount = 0
                wp.controlled = False
        
        for city in state.cities:
            if city.controller_player_id == player_id:
                city.controller_player_id = None
        
        state.pending_orders = [o for o in state.pending_orders if o.player_id != player_id]
        
        await self._save_state_to_store(state)
        await ws_manager.disconnect(room_id, player_id)
        await ws_manager.broadcast_state(room_id, state)
        await ws_manager.broadcast_event(room_id, "player_kicked", {"player_id": player_id})
        
        return state


room_manager = RoomManager()
