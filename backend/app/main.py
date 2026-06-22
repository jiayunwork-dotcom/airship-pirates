from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.redis_client import RedisClient
from app.api.routers import router as api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await RedisClient.initialize()
    yield
    await RedisClient.close()


app = FastAPI(
    title=settings.app_name,
    description="Airship Pirates Game Backend - A multiplayer turn-based strategy game",
    version="1.0.0",
    lifespan=lifespan,
    debug=settings.debug
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "message": str(exc) if settings.debug else "An unexpected error occurred",
            "traceback": traceback.format_exc() if settings.debug else None
        },
    )


@app.get("/", tags=["health"])
async def root():
    return {
        "name": settings.app_name,
        "version": "1.0.0",
        "status": "running",
        "max_players": settings.max_players_per_room,
        "max_turns": settings.max_turns
    }


@app.get("/health", tags=["health"])
async def health_check():
    try:
        redis_client = await RedisClient.get_client()
        if redis_client:
            redis_status = await redis_client.ping()
            redis_ok = bool(redis_status)
        else:
            redis_ok = False
    except Exception:
        redis_ok = False
    
    return {
        "status": "healthy",
        "redis": "connected" if redis_ok else "disconnected",
        "app": settings.app_name
    }


app.include_router(api_router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
        log_level="info"
    )
