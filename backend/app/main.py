from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db import connect_to_mongo, close_mongo_connection
from app.api import files, annotations, templates
from app.middleware import AuthMiddleware

app = FastAPI(
    title="波形标注系统 API",
    description="Web端科研数据标注平台后端服务",
    version="1.0.0"
)

# 认证中间件
app.add_middleware(AuthMiddleware)

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
    ],  # 前端开发服务器
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(files.router)
app.include_router(annotations.router)
app.include_router(templates.router)

# 启动事件：连接数据库
@app.on_event("startup")
async def startup_event():
    await connect_to_mongo()

# 关闭事件：断开数据库连接
@app.on_event("shutdown")
async def shutdown_event():
    await close_mongo_connection()

@app.get("/")
async def root():
    return {
        "message": "波形标注系统 API",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
