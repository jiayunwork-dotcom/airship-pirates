import json
import asyncio
from typing import Dict, Optional, Any
from fastapi import WebSocket, WebSocketDisconnect
from app.models.game_models import GameState


class WebSocketManager:
    _instance: Optional["WebSocketManager"] = None
    _lock: asyncio.Lock = asyncio.Lock()

    def __new__(cls) -> "WebSocketManager":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._rooms = {}
        return cls._instance

    def __init__(self) -> None:
        if not hasattr(self, '_rooms'):
            self._rooms: Dict[str, Dict[str, WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: str, player_id: str) -> bool:
        await websocket.accept()
        async with self._lock:
            if room_id not in self._rooms:
                self._rooms[room_id] = {}
            self._rooms[room_id][player_id] = websocket
        return True

    async def disconnect(self, room_id: str, player_id: str) -> None:
        async with self._lock:
            if room_id in self._rooms:
                if player_id in self._rooms[room_id]:
                    del self._rooms[room_id][player_id]
                if not self._rooms[room_id]:
                    del self._rooms[room_id]

    async def broadcast(self, room_id: str, message: Any) -> None:
        if room_id not in self._rooms:
            return
        
        message_str = message if isinstance(message, str) else json.dumps(message, default=str, ensure_ascii=False)
        
        disconnected = []
        async with self._lock:
            connections = dict(self._rooms.get(room_id, {}))
        
        for player_id, ws in connections.items():
            try:
                await ws.send_text(message_str)
            except (WebSocketDisconnect, RuntimeError):
                disconnected.append(player_id)
            except Exception:
                disconnected.append(player_id)
        
        if disconnected:
            async with self._lock:
                if room_id in self._rooms:
                    for pid in disconnected:
                        if pid in self._rooms[room_id]:
                            del self._rooms[room_id][pid]
                    if not self._rooms[room_id]:
                        del self._rooms[room_id]

    async def send_private(self, room_id: str, player_id: str, message: Any) -> bool:
        if room_id not in self._rooms or player_id not in self._rooms.get(room_id, {}):
            return False
        
        message_str = message if isinstance(message, str) else json.dumps(message, default=str, ensure_ascii=False)
        
        try:
            async with self._lock:
                ws = self._rooms[room_id].get(player_id)
            if ws:
                await ws.send_text(message_str)
                return True
        except (WebSocketDisconnect, RuntimeError):
            await self.disconnect(room_id, player_id)
        except Exception:
            pass
        return False

    async def broadcast_state(self, room_id: str, state: GameState) -> None:
        state_dict = state.model_dump()
        message = {
            "type": "state_update",
            "data": state_dict,
            "turn": state.turn,
            "phase": state.phase
        }
        await self.broadcast(room_id, message)

    async def broadcast_event(self, room_id: str, event_type: str, data: Any = None) -> None:
        message = {
            "type": "event",
            "event_type": event_type,
            "data": data,
            "timestamp": asyncio.get_event_loop().time()
        }
        await self.broadcast(room_id, message)

    async def send_turn_notification(self, room_id: str, turn: int) -> None:
        await self.broadcast_event(room_id, "turn_start", {"turn": turn})

    async def send_battle_notification(self, room_id: str, battle_id: str, ship_a: str, ship_b: str) -> None:
        await self.broadcast_event(room_id, "battle_started", {
            "battle_id": battle_id,
            "ship_a": ship_a,
            "ship_b": ship_b
        })

    async def send_player_notification(self, room_id: str, player_id: str, notification: str) -> None:
        await self.send_private(room_id, player_id, {
            "type": "notification",
            "message": notification
        })

    def get_connected_players(self, room_id: str) -> list:
        if room_id not in self._rooms:
            return []
        return list(self._rooms[room_id].keys())

    def is_player_connected(self, room_id: str, player_id: str) -> bool:
        return room_id in self._rooms and player_id in self._rooms[room_id]


ws_manager = WebSocketManager()
