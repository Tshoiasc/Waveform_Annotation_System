from pydantic import BaseModel, Field, validator
from typing import List, Optional
from datetime import datetime
import re


class PhaseSchema(BaseModel):
    """事件阶段配置"""
    id: str
    name: str
    color: str  # Hex color format: #RRGGBB
    shortcut: str  # Keyboard shortcut: 1-9
    order: int  # Display order

    @validator('color')
    def validate_color(cls, v):
        if not re.match(r'^#[0-9A-Fa-f]{6}$', v):
            raise ValueError('Color must be in hex format #RRGGBB')
        return v

    @validator('shortcut')
    def validate_shortcut(cls, v):
        if v not in '123456789':
            raise ValueError('Shortcut must be a digit 1-9')
        return v


class EventTemplateModel(BaseModel):
    """事件序列模板"""
    name: str
    isGlobal: bool = Field(default=False, description="是否为全局模板")
    createdBy: Optional[str] = Field(default=None, description="创建者用户ID")
    phases: List[PhaseSchema]
    createdAt: datetime = Field(default_factory=datetime.now)
    updatedAt: datetime = Field(default_factory=datetime.now)

    @validator('phases')
    def validate_phases(cls, v):
        if len(v) == 0:
            raise ValueError('Template must have at least one phase')

        # Check shortcut uniqueness
        shortcuts = [phase.shortcut for phase in v]
        if len(shortcuts) != len(set(shortcuts)):
            raise ValueError('Phase shortcuts must be unique')

        return v


class EventTemplateCreate(BaseModel):
    """创建模板请求"""
    name: str
    isGlobal: bool = False
    phases: List[PhaseSchema]


class EventTemplateUpdate(BaseModel):
    """更新模板请求"""
    name: Optional[str] = None
    phases: Optional[List[PhaseSchema]] = None
