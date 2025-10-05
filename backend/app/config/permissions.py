ALL_PERMISSIONS = {
    "users.view": {"description": "查看用户列表", "category": "用户管理"},
    "users.create": {"description": "创建用户", "category": "用户管理"},
    "users.update": {"description": "更新用户", "category": "用户管理"},
    "users.delete": {"description": "删除用户", "category": "用户管理"},
    "files.view": {"description": "查看文件", "category": "文件管理"},
    "files.upload": {"description": "上传文件", "category": "文件管理"},
    "files.delete": {"description": "删除文件", "category": "文件管理"},
    "annotations.view": {"description": "查看标注", "category": "标注管理"},
    "annotations.create": {"description": "创建标注", "category": "标注管理"},
    "annotations.update": {"description": "更新标注", "category": "标注管理"},
    "annotations.delete": {"description": "删除标注", "category": "标注管理"},
    "annotations.export": {"description": "导出标注", "category": "标注管理"},
    "templates.view": {"description": "查看模板", "category": "模板管理"},
    "templates.create": {"description": "创建模板", "category": "模板管理"},
    "templates.update": {"description": "更新模板", "category": "模板管理"},
    "templates.delete": {"description": "删除模板", "category": "模板管理"},
    "roles.view": {"description": "查看角色", "category": "角色管理"},
    "roles.create": {"description": "创建角色", "category": "角色管理"},
    "roles.update": {"description": "更新角色", "category": "角色管理"},
    "roles.delete": {"description": "删除角色", "category": "角色管理"},
    "system.settings": {"description": "系统设置", "category": "系统管理"},
    "system.logs": {"description": "系统日志", "category": "系统管理"},
}

ROLE_PRESETS = {
    "admin": list(ALL_PERMISSIONS.keys()),
    "annotator": [
        "files.view",
        "annotations.view",
        "annotations.create",
        "annotations.update",
        "templates.view",
    ],
    "user": [
        "files.view",
        "annotations.view",
    ],
}
