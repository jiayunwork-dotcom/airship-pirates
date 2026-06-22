from typing import List
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Depends, Query
from app.models.game_models import (
    GameState, Order, BattleAction,
    RoomCreateRequest, JoinRoomRequest,
    OrdersSubmitRequest, BattleActionsSubmitRequest
)
from app.services.room_manager import room_manager
from app.services.websocket_manager import ws_manager
from app.core.config import settings

router = APIRouter(prefix="/api", tags=["game"])


@router.post("/rooms", response_model=GameState)
async def create_room(request: RoomCreateRequest):
    if request.player_count < settings.min_players_per_room:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum {settings.min_players_per_room} players required"
        )
    if request.player_count > settings.max_players_per_room:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {settings.max_players_per_room} players allowed"
        )
    
    existing = await room_manager.get_state(request.room_id)
    if existing:
        raise HTTPException(status_code=400, detail="Room already exists")
    
    state = await room_manager.create_room(request.room_id, request.player_count)
    return state


@router.post("/rooms/{room_id}/join", response_model=GameState)
async def join_room(room_id: str, request: JoinRoomRequest):
    state = await room_manager.get_state(room_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Room not found")
    
    try:
        state = await room_manager.join_room(
            room_id,
            request.player_id,
            request.player_name,
            request.color
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    return state


@router.get("/rooms/{room_id}/state", response_model=GameState)
async def get_game_state(room_id: str):
    state = await room_manager.get_state(room_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Room not found")
    return state


@router.post("/rooms/{room_id}/ready", response_model=GameState)
async def set_player_ready(room_id: str, player_id: str = Query(...), ready: bool = Query(True)):
    state = await room_manager.get_state(room_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Room not found")
    
    player = next((p for p in state.players if p.id == player_id), None)
    if player is None:
        raise HTTPException(status_code=404, detail="Player not found in room")
    
    state = await room_manager.set_player_ready(room_id, player_id, ready)
    return state


@router.post("/rooms/{room_id}/orders", response_model=GameState)
async def submit_orders(room_id: str, request: OrdersSubmitRequest):
    state = await room_manager.get_state(room_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Room not found")
    
    player = next((p for p in state.players if p.id == request.player_id), None)
    if player is None:
        raise HTTPException(status_code=404, detail="Player not found in room")
    
    try:
        state = await room_manager.submit_orders(
            room_id,
            request.player_id,
            request.orders
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    return state


@router.post("/rooms/{room_id}/battle_actions", response_model=GameState)
async def submit_battle_actions(room_id: str, request: BattleActionsSubmitRequest):
    state = await room_manager.get_state(room_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Room not found")
    
    battle = next((b for b in state.battles if b.id == request.battle_id), None)
    if battle is None:
        raise HTTPException(status_code=404, detail="Battle not found")
    
    player_in_battle = any(
        a.player_id == request.player_id 
        for a in state.airships 
        if a.id in [battle.ship_a_id, battle.ship_b_id]
    )
    if not player_in_battle:
        raise HTTPException(status_code=403, detail="Player not involved in this battle")
    
    try:
        state = await room_manager.submit_battle_actions(
            room_id,
            request.player_id,
            request.battle_id,
            request.actions
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    return state


@router.post("/rooms/{room_id}/process_turn", response_model=GameState)
async def process_turn_endpoint(room_id: str):
    state = await room_manager.get_state(room_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if state.phase == "ended":
        raise HTTPException(status_code=400, detail="Game already ended")
    
    state = await room_manager.process_turn(room_id)
    if state is None:
        raise HTTPException(status_code=409, detail="Turn already processing")
    
    return state


@router.get("/rooms/{room_id}/scores")
async def get_scores(room_id: str):
    state = await room_manager.get_state(room_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Room not found")
    return {
        "turn": state.turn,
        "phase": state.phase,
        "scores": state.scores,
        "winner": state.winner
    }


@router.delete("/rooms/{room_id}")
async def delete_room(room_id: str):
    state = await room_manager.get_state(room_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Room not found")
    
    success = await room_manager.delete_room(room_id)
    return {"success": success, "message": f"Room {room_id} deleted"}


@router.get("/config")
async def get_config():
    return {
        "min_players": settings.min_players_per_room,
        "max_players": settings.max_players_per_room,
        "max_turns": settings.max_turns,
        "default_wealth": settings.default_player_wealth,
        "default_reputation": settings.default_player_reputation,
        "weather_change_interval": settings.weather_change_interval,
        "weather_forecast_turns": settings.weather_forecast_turns,
    }


@router.websocket("/ws/{room_id}/{player_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, player_id: str):
    await ws_manager.connect(websocket, room_id, player_id)
    try:
        state = await room_manager.get_state(room_id)
        if state:
            state_dict = state.model_dump(mode="json")
            await ws_manager.send_private(room_id, player_id, {
                "type": "initial_state",
                "data": state_dict
            })
        
        while True:
            data = await websocket.receive_text()
            try:
                import json
                message = json.loads(data)
                msg_type = message.get("type")
                
                if msg_type == "ping":
                    await ws_manager.send_private(room_id, player_id, {
                        "type": "pong",
                        "timestamp": message.get("timestamp")
                    })
                elif msg_type == "request_state":
                    state = await room_manager.get_state(room_id)
                    if state:
                        state_dict = state.model_dump(mode="json")
                        await ws_manager.send_private(room_id, player_id, {
                            "type": "state_update",
                            "data": state_dict
                        })
                elif msg_type == "chat":
                    chat_message = message.get("message", "")
                    player_name = message.get("player_name", "Unknown")
                    await ws_manager.broadcast(room_id, {
                        "type": "chat",
                        "player_id": player_id,
                        "player_name": player_name,
                        "message": chat_message
                    })
                else:
                    await ws_manager.send_private(room_id, player_id, {
                        "type": "error",
                        "message": f"Unknown message type: {msg_type}"
                    })
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        await ws_manager.disconnect(room_id, player_id)
    except Exception:
        await ws_manager.disconnect(room_id, player_id)
