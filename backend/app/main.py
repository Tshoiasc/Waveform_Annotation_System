from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import annotations, auth, files, roles, templates, users
from app.config import settings
from app.db.mongodb import close_mongo_connection, connect_to_mongo
from app.middleware.auth import AuthMiddleware

app = FastAPI(title="Waveform Annotation System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(AuthMiddleware)

app.add_event_handler("startup", connect_to_mongo)
app.add_event_handler("shutdown", close_mongo_connection)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(roles.router)
app.include_router(files.router)
app.include_router(annotations.router)
app.include_router(templates.router)


@app.get("/")
async def root():
    return {"message": "Waveform Annotation System API"}


@app.get("/health")
async def health():
    return {"status": "ok"}
