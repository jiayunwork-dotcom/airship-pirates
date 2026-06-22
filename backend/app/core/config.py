from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Airship Pirates Backend"
    debug: bool = False
    
    redis_url: str = "redis://localhost:6379/0"
    redis_key_prefix: str = "airship_pirates"
    
    max_players_per_room: int = 6
    min_players_per_room: int = 4
    max_turns: int = 30
    
    default_ship_hp: int = 100
    default_ship_morale: int = 80
    default_player_wealth: int = 5000
    default_player_reputation: int = 50
    
    movement_base_speed: float = 10.0
    altitude_speed_modifier: float = 0.1
    wind_base_strength: float = 5.0
    
    battle_base_damage: int = 10
    cannon_damage_multiplier: float = 1.5
    harpoon_damage_multiplier: float = 1.2
    incendiary_damage_multiplier: float = 0.8
    incendiary_dot_damage: int = 5
    smoke_screen_miss_chance: float = 0.5
    
    trade_base_price_multiplier: float = 1.0
    supply_demand_sensitivity: float = 0.3
    
    weather_change_interval: int = 3
    weather_forecast_turns: int = 1
    
    toll_default_percentage: float = 0.05
    toll_max_percentage: float = 0.2
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
