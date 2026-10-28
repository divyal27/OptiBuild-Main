from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.core.config import settings
from backend.app.api.v1.auth import router as auth_router
from backend.app.api.v1.users import router as users_router
from backend.app.api.v1.projects import router as projects_router
from backend.app.api.v1.schedule import router as schedule_router
from backend.app.api.v1.benchmark import router as benchmark_router
from backend.app.api.v1.optimizer import router as optimizer_router
from backend.app.api.v1.wbs import router as wbs_router
from backend.app.api.v1.rera_parser import router as rera_router
from backend.app.api.v1.materials import router as materials_router
from backend.app.api.v1.dashboard import router as dashboard_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Penalty-Aware Construction Scheduling & Resource Optimization Engine",
    version="1.0.0",
    docs_url="/docs",
    openapi_url="/openapi.json",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(users_router, prefix=settings.API_V1_STR)
app.include_router(projects_router, prefix=settings.API_V1_STR)
app.include_router(schedule_router, prefix=settings.API_V1_STR)
app.include_router(benchmark_router, prefix=settings.API_V1_STR)
app.include_router(optimizer_router, prefix=settings.API_V1_STR)
app.include_router(wbs_router, prefix=settings.API_V1_STR)
app.include_router(rera_router, prefix=settings.API_V1_STR)
app.include_router(materials_router, prefix=settings.API_V1_STR)
app.include_router(dashboard_router, prefix=settings.API_V1_STR)

# Ensure database tables exist automatically on startup
from backend.app.db.session import engine, Base
import backend.app.db.models  # noqa: F401

if engine:
    try:
        Base.metadata.create_all(bind=engine)
        from backend.app.db.seed import auto_seed_if_empty
        auto_seed_if_empty()
    except Exception as _e:
        print(f"[Warning] Startup initialization failed: {_e}")



@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": "OptiBuild Backend Engine",
        "version": "1.0.0",
    }
