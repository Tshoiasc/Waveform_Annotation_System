#!/usr/bin/env python3
"""MongoDB 连接可用性测试脚本"""

from __future__ import annotations

import asyncio
import os
import sys

from motor.motor_asyncio import AsyncIOMotorClient

# 保证可以导入 app 包中的配置
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings  # noqa: E402


async def test_connection() -> bool:
    """验证 MongoDB 是否可达"""

    print("🔍 正在测试 MongoDB 连接...")
    print(f"   URI 片段: {settings.MONGODB_URI[:30]}***")
    print(f"   数据库: {settings.MONGODB_DATABASE}")

    client = AsyncIOMotorClient(settings.MONGODB_URI, serverSelectionTimeoutMS=5000)

    try:
        # 使用 ping 命令确认服务可用
        await client.admin.command("ping")
        print("✅ ping 成功，MongoDB 可达")

        # 列出可访问的数据库
        db_list = await client.list_database_names()
        print(f"📊 可访问的数据库: {db_list}")

        # 检查目标数据库的集合
        db = client[settings.MONGODB_DATABASE]
        collections = await db.list_collection_names()
        if collections:
            print(f"📁 现有集合: {collections}")
        else:
            print("📁 当前数据库为空，将在后续初始化中创建集合")

        return True
    except Exception as exc:  # pragma: no cover
        print(f"❌ MongoDB 连接失败: {exc}")
        return False
    finally:
        client.close()


if __name__ == "__main__":
    result = asyncio.run(test_connection())
    sys.exit(0 if result else 1)
