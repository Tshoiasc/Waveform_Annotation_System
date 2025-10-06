#!/usr/bin/env python3
"""
Migration Script: Add annotations.annotate permission to existing roles

This script updates the database to add the new 'annotations.annotate' permission
to admin and annotator roles.
"""
import asyncio
import sys
import os


# 将父目录加入路径，便于脚本直接复用应用配置
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from datetime import datetime

from motor.motor_asyncio import AsyncIOMotorClient

from app.config import settings
from app.config.permissions import ROLE_PRESETS


async def update_annotation_permissions():
    """将 annotations.annotate 权限添加到管理员和标注员角色"""

    client = AsyncIOMotorClient(settings.MONGODB_URI)
    db = client[settings.MONGODB_DATABASE]

    print("🔄 开始更新标注权限...")

    try:
        roles_collection = db["roles"]

        print("\n📝 更新管理员角色...")
        admin_result = await roles_collection.update_one(
            {"name": "admin"},
            {
                "$set": {
                    "permissions": ROLE_PRESETS["admin"],
                    "updated_at": datetime.utcnow(),
                }
            },
        )

        if admin_result.modified_count > 0:
            print("✅ 管理员角色已更新")
        else:
            admin_role = await roles_collection.find_one({"name": "admin"})
            if admin_role and "annotations.annotate" in admin_role.get("permissions", []):
                print("ℹ️  管理员角色已包含该权限")
            else:
                print("⚠️  管理员角色未找到或更新失败")

        print("\n📝 更新标注员角色...")
        annotator_result = await roles_collection.update_one(
            {"name": "annotator"},
            {
                "$set": {
                    "permissions": ROLE_PRESETS["annotator"],
                    "updated_at": datetime.utcnow(),
                }
            },
        )

        if annotator_result.modified_count > 0:
            print("✅ 标注员角色已更新")
        else:
            annotator_role = await roles_collection.find_one({"name": "annotator"})
            if annotator_role and "annotations.annotate" in annotator_role.get("permissions", []):
                print("ℹ️  标注员角色已包含该权限")
            else:
                print("⚠️  标注员角色未找到或更新失败")

        print("\n🔍 验证更新结果...")
        admin_role = await roles_collection.find_one({"name": "admin"})
        annotator_role = await roles_collection.find_one({"name": "annotator"})
        user_role = await roles_collection.find_one({"name": "user"})

        print("\n📊 当前角色权限状态:")
        print(
            "  管理员 (admin): annotations.annotate 权限 ✅"
            if admin_role and "annotations.annotate" in admin_role.get("permissions", [])
            else "  管理员 (admin): ❌"
        )
        print(
            "  标注员 (annotator): annotations.annotate 权限 ✅"
            if annotator_role and "annotations.annotate" in annotator_role.get("permissions", [])
            else "  标注员 (annotator): ❌"
        )
        print(
            "  普通用户 (user): 无 annotations.annotate 权限 ✅"
            if user_role and "annotations.annotate" not in user_role.get("permissions", [])
            else "  普通用户 (user): ⚠️"
        )

        print("\n🎉 权限更新完成!")
        print("\n💡 提示:")
        print("  - 管理员和标注员现在拥有 'annotations.annotate' 权限")
        print("  - 普通用户仅能查看标注，无法执行标注操作")
        print("  - 已登录用户需要重新登录以获取更新后的权限")

    except Exception as exc:  # noqa: BLE001
        print(f"\n❌ 更新失败: {exc}")
        raise
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(update_annotation_permissions())
