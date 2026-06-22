import sys
sys.path.insert(0, r'e:\seed\require\task0618\task20-airship-pirates\airship-pirates\backend')

try:
    from app.core.game_engine import initialize_game
    print('✓ game_engine import OK')
    
    result = initialize_game('TEST56', 4)
    print(f'✓ initialize_game OK, room_id={result.room_id}, cities={len(result.cities)}, waypoints={len(result.waypoints)}')
    
    from app.models.game_models import GameState
    d = result.model_dump(mode='json')
    r2 = GameState(**d)
    print(f'✓ Serialize/Deserialize OK')
    
except Exception as e:
    import traceback
    print(f'✗ ERROR: {e}')
    traceback.print_exc()
