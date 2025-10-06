#!/usr/bin/env python3
"""模板迁移脚本：统一为全局模板"""

import asyncio
import os
import sys
from datetime import datetime

from motor.motor_asyncio import AsyncIOMotorClient


# 将项目根目录加入搜索路径，便于复用应用配置
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings  # noqa: E402


async def migrate_templates_to_global() -> None:
    """将所有模板统一迁移为全局模板"""

    client = AsyncIOMotorClient(settings.MONGODB_URI)
    db = client[settings.MONGODB_DATABASE]
    collection = db["event_templates"]

    print("🔄 开始迁移模板数据...")

    try:
        now = datetime.utcnow()

        result = await collection.update_many(
            {},
            {
                "$set": {
                    "isGlobal": True,
                    "createdBy": None,
                    "updatedAt": now,
                },
                "$unset": {
                    "scope": "",
                },
            },
        )

        print(f"✅ 已更新模板文档数量: {result.modified_count}")

        global_count = await collection.count_documents({"isGlobal": True})
        print(f"📊 当前全局模板总数: {global_count}")

        print("🎉 模板迁移完成，所有模板均已统一为全局模板。")

    except Exception as exc:  # noqa: BLE001
        print(f"❌ 迁移过程中发生错误: {exc}")
        raise
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(migrate_templates_to_global())
