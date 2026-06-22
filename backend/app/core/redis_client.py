import json
import asyncio
from typing import Optional, Any, Dict
from redis.asyncio import Redis, ConnectionPool
from app.core.config import settings


class RedisClient:
    _instance: Optional["RedisClient"] = None
    _pool: Optional[ConnectionPool] = None
    _client: Optional[Redis] = None
    _initialized: bool = False
    _in_memory_store: Dict[str, Any] = {}

    def __new__(cls) -> "RedisClient":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @classmethod
    async def initialize(cls) -> None:
        if cls._initialized:
            return
        try:
            cls._pool = ConnectionPool.from_url(
                settings.redis_url,
                max_connections=50,
                decode_responses=True
            )
            cls._client = Redis(connection_pool=cls._pool)
            await cls._client.ping()
            cls._initialized = True
        except Exception as e:
            print(f"Warning: Could not connect to Redis: {e}")
            print("Falling back to in-memory storage")
            cls._client = None
            cls._pool = None
            cls._initialized = True

    @classmethod
    async def get_client(cls) -> Optional[Redis]:
        if not cls._initialized:
            await cls.initialize()
        return cls._client

    @classmethod
    def get_key(cls, room_id: str, suffix: str = "") -> str:
        if suffix:
            return f"{settings.redis_key_prefix}:{room_id}:{suffix}"
        return f"{settings.redis_key_prefix}:{room_id}"

    @classmethod
    async def set_json(cls, key: str, value: Any, expire: Optional[int] = None) -> None:
        if not cls._initialized:
            await cls.initialize()
        json_str = json.dumps(value, default=str)
        if cls._client is not None:
            try:
                await cls._client.set(key, json_str, ex=expire)
                return
            except Exception:
                pass
        cls._in_memory_store[key] = json_str

    @classmethod
    async def get_json(cls, key: str) -> Optional[Any]:
        if not cls._initialized:
            await cls.initialize()
        data = None
        if cls._client is not None:
            try:
                data = await cls._client.get(key)
            except Exception:
                data = None
        if data is None:
            data = cls._in_memory_store.get(key)
        if data:
            return json.loads(data)
        return None

    @classmethod
    async def delete(cls, key: str) -> None:
        if not cls._initialized:
            await cls.initialize()
        if cls._client is not None:
            try:
                await cls._client.delete(key)
            except Exception:
                pass
        if key in cls._in_memory_store:
            del cls._in_memory_store[key]

    @classmethod
    async def close(cls) -> None:
        if cls._client is not None:
            try:
                await cls._client.close()
            except Exception:
                pass
            cls._client = None
        if cls._pool is not None:
            try:
                await cls._pool.disconnect()
            except Exception:
                pass
            cls._pool = None
        cls._initialized = False


async def get_redis() -> Optional[Redis]:
    return await RedisClient.get_client()
