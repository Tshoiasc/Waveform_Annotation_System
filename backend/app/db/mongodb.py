from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import settings

class Database:
    client: AsyncIOMotorClient = None
    db: AsyncIOMotorDatabase = None

database = Database()

async def get_database() -> AsyncIOMotorDatabase:
    """获取数据库实例 (用于依赖注入)"""
    return database.db

async def connect_to_mongo():
    """连接到MongoDB"""
    try:
        database.client = AsyncIOMotorClient(
            settings.MONGODB_URI,
            maxPoolSize=50,
            minPoolSize=10,
            serverSelectionTimeoutMS=5000
        )
        database.db = database.client[settings.MONGODB_DATABASE]

        # 测试连接
        await database.db.command("ping")
        print(f"✅ Connected to MongoDB: {settings.MONGODB_DATABASE}")
    except Exception as e:
        print(f"❌ Failed to connect to MongoDB: {e}")
        raise

async def close_mongo_connection():
    """关闭MongoDB连接"""
    if database.client:
        database.client.close()
        print("❌ MongoDB connection closed")
