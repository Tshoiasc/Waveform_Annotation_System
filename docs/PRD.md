# 波形标注系统 - 产品需求文档 (PRD)

**项目名称**: Web-Based Waveform Annotation System
**版本**: v1.0
**创建日期**: 2025-10-01
**状态**: 需求已确认，待开发

---

## 1. 项目概述

### 1.1 项目背景
当前使用Python脚本 `annotate_h5_waveform.py` 进行波形标注，存在以下痛点：
- 单机运行，无法支持团队协作
- 标注数据分散在本地文件，难以集中管理
- 缺乏标注进度可视化和质量控制机制

### 1.2 产品目标
构建一个**专业、美观、交互感强**的Web波形标注系统，支持：
- 云端多用户协作标注
- 集中化数据管理与进度追踪
- 灵活的事件序列配置
- 高效的波形浏览与缩放交互

### 1.3 核心价值
- **效率提升**: 团队协作 + 快捷键操作，标注效率提升50%+
- **数据安全**: 集中化MongoDB存储，标注结果实时保存
- **质量保障**: 进度可视化 + 悲观锁机制，避免重复劳动和数据冲突

---

## 2. 用户角色与权限

| 角色 | 权限 | 典型场景 |
|------|------|----------|
| **管理员 (Admin)** | 创建全局事件模板、管理用户 | 实验室负责人 |
| **标注员 (Annotator)** | 标注波形、创建私有模板 | 研究生、助理 |
| **查看者 (Viewer)** | 仅查看标注结果 | 合作者、审核人员 |

---

## 3. 功能需求

### 3.1 三栏式布局结构

```
┌─────────────────────────────────────────────────────────────────────┐
│  导航栏: Logo | 用户信息 | 事件序列配置入口                           │
├───────────┬───────────┬────────────────────────────────────────────┤
│  第一列   │  第二列   │           工作区 (Workspace)               │
│  文件列表 │ Trial列表 │  ┌────────────────────────────────────┐   │
│           │           │  │ 横向刻度条 (Timeline Ruler)        │   │
│  📁 exp01 │ ▶ Trial 1 │  ├────────────────────────────────────┤   │
│  📁 exp02 │   Trial 2 │  │ 波形图 (uPlot)                     │   │
│  📁 exp03 │   Trial 3 │  │ - 原始波形 (灰色半透明)             │   │
│           │   ...     │  │ - 滤波波形 (主色)                  │   │
│  进度:    │           │  │ - 子事件边界点 (彩色垂直线)         │   │
│  ▓▓▓▓░ 60% │ 缩略图   │  │ - 彩色Mask (已标注区域)            │   │
│           │  ⚡⚡⚡   │  └────────────────────────────────────┘   │
│           │  进度:    │                                            │
│           │  ▓▓░ 40%  │  快捷键提示: [1] Baseline [2] Approach... │
└───────────┴───────────┴────────────────────────────────────────────┘
```

---

### 3.2 核心功能模块

#### 📂 **Module 1: 文件与Trial管理** (优先级P0)

**3.2.1 文件列表 (第一列)**
- **数据源**: `dataset/` 目录下的H5文件
- **显示内容**:
  - 文件夹/文件树形结构
  - 标注进度条 + 百分比 (如: `▓▓▓▓░ 60%`)
  - 彩色标签:
    - 🟢 已完成 (100%)
    - 🟡 进行中 (1%-99%)
    - ⚪ 未开始 (0%)
  - 已标注事件数量 (如: `12/20 events`)
- **交互**:
  - 点击文件 → 加载所有Trials到第二列
  - 支持搜索/筛选 (按文件名、标注状态)

**3.2.2 Trial列表 (第二列)**
- **显示内容**:
  - Trial编号 + 缩略图 (降采样到100点)
  - 缩略图叠加层:
    - 波形轮廓 (灰色)
    - 标注进度条 (彩色横条，但不显示具体阶段细节)
  - 标注进度: `▓▓░ 40%`
- **交互**:
  - 点击Trial → 加载完整波形到工作区
  - 双击 → 快速跳转到第一个未标注事件
  - 右键菜单: 标记为已完成/重置标注

**数据流**:
```mermaid
graph LR
    A[点击文件] --> B[GET /api/files/{file_id}/trials]
    B --> C[返回所有Trials元数据 + 缩略图]
    C --> D[渲染Trial列表]
    E[点击Trial] --> F[GET /api/files/{file_id}/trials/{trial_id}/waveform]
    F --> G[返回预处理后的完整波形]
    G --> H[渲染工作区波形图]
```

---

#### 🎨 **Module 2: 波形可视化与交互** (优先级P0)

**3.2.3 横向刻度条 (Timeline Ruler)**
- **位置**: 波形图上方
- **显示内容**:
  - 时间刻度 (单位: 秒)
  - 子事件边界点 (彩色圆点)
    - Baseline: 🔵 蓝色
    - Approach: 🟢 绿色
    - Impact: 🔴 红色
    - Ringdown: 🟣 紫色
- **交互**:
  - 点击刻度条 → 波形图跳转到对应时间
  - 鼠标悬停 → 显示精确时间戳

**3.2.4 波形图 (基于 uPlot)**
- **图层叠加** (从底到顶):
  1. 彩色Mask层 (已标注区域，opacity: 0.25)
  2. 原始波形 (灰色，opacity: 0.3)
  3. 滤波波形 (主色，lineWidth: 2)
  4. 子事件边界点 (彩色垂直线 + 圆点)
  5. 十字准星 (鼠标跟随)

- **缩放交互**:
  - 滚轮: 以鼠标位置为中心缩放X轴
  - Shift + 滚轮: 仅缩放Y轴
  - Cmd/Ctrl + 滚轮: 仅缩放X轴
  - 双指触控板: 支持多点触控缩放

- **缩放历史记录**:
  - 数据结构: `Stack<{xMin, xMax, yMin, yMax}>`
  - 快捷键:
    - `Ctrl+Z`: 回退视图
    - `Ctrl+Shift+Z`: 前进视图
  - UI: 左上角面包屑 (如: `主视图 > 5-10s > 7-8s`)

**3.2.5 标注操作**
- **当前阶段模式**: 顶部显示当前激活阶段 (如: `🔵 Baseline模式`)
- **快捷键切换**:
  - `1-9`: 切换阶段模式 (Baseline=1, Approach=2...)
  - `Esc`: 取消标注模式
- **点击标注**:
  - 点击波形图 → 在当前激活阶段模式下添加标注点
  - 显示实时反馈: 闪烁动画 + 音效提示
- **删除标注**:
  - 右键点击边界点 → 删除该标注
  - 快捷键: `D` (Delete最近标注点)

**3.2.6 事件范围自动提示**
- **逻辑**: 根据事件序列配置，自动将连续的子事件标注点组合为事件
- **可视化**: 波形图上显示半透明绿色边框 (不保存到数据库)
- **示例**:
  ```
  [Baseline点@2.1s] + [Approach点@2.5s] + [Impact点@3.0s] + [Ringdown点@3.8s]
  → 自动生成事件提示框: Event #1 [2.1s - 3.8s]
  ```

---

#### ⚙️ **Module 3: 事件序列配置器** (优先级P1)

**3.2.7 可视化拖拽配置**
- **入口**: 顶部导航栏 "⚙️ 配置事件序列" 按钮
- **弹窗布局**:
  ```
  ┌──────────────────────────────────────────┐
  │  事件序列配置器                          │
  ├──────────────────────────────────────────┤
  │  📌 模板选择:                            │
  │  [全局模板▼] [我的模板▼] [+ 新建模板]  │
  ├──────────────────────────────────────────┤
  │  阶段库 (拖拽添加):                      │
  │  🔵 Baseline  🟢 Approach               │
  │  🔴 Impact    🟣 Ringdown               │
  │  🟡 Custom... [+ 新建阶段]              │
  ├──────────────────────────────────────────┤
  │  当前序列:                               │
  │  ┌───┐   ┌───┐   ┌───┐   ┌───┐        │
  │  │🔵 │ → │🟢 │ → │🔴 │ → │🟣 │        │
  │  │ 1 │   │ 2 │   │ 3 │   │ 4 │        │
  │  └───┘   └───┘   └───┘   └───┘        │
  │  (拖动调整顺序 | 点击编辑 | 删除)       │
  ├──────────────────────────────────────────┤
  │  [取消]  [保存为私有模板]  [保存并应用] │
  └──────────────────────────────────────────┘
  ```

**阶段属性编辑**:
- 名称: 自定义文本 (如: "Baseline", "接触阶段")
- 颜色: 色板选择器 (16种预设颜色)
- 快捷键: 自动分配数字键 1-9 (可手动修改)

**模板管理**:
- **全局模板**: 仅管理员可创建/编辑，所有用户可见
- **私有模板**: 个人创建，仅自己可见
- **默认模板**: 新用户首次登录时自动应用系统默认模板

---

#### 📊 **Module 4: 标注状态统计** (优先级P2)

**3.2.8 进度仪表盘**
- **位置**: 文件列表上方可折叠区域
- **内容**:
  - 总体进度环形图 (已标注/总数)
  - 各文件标注进度对比柱状图
  - 标注热力图 (按日期显示标注活动)
  - Top标注员排行榜

**3.2.9 标注统计API**
```typescript
GET /api/stats/overview
Response: {
  totalFiles: 15,
  annotatedFiles: 9,
  totalEvents: 450,
  annotatedEvents: 270,
  progressByUser: [
    {userId: "xxx", username: "张三", eventCount: 120},
    ...
  ]
}
```

---

#### 👥 **Module 5: 多用户协作** (优先级P3)

**3.2.10 悲观锁机制**
- **加锁时机**: 用户点击Trial加载波形时
- **锁定逻辑**:
  ```python
  # FastAPI伪代码
  @app.get("/api/files/{file_id}/trials/{trial_id}/waveform")
  async def get_waveform(file_id, trial_id, user_id):
      lock = await trial_locks.get(f"{file_id}:{trial_id}")
      if lock and lock.user_id != user_id:
          return {
              "status": "locked",
              "lockedBy": lock.username,
              "lockedAt": lock.timestamp,
              "message": f"该Trial正在被 {lock.username} 标注中"
          }
      await trial_locks.set(f"{file_id}:{trial_id}", {
          "user_id": user_id,
          "username": current_user.username,
          "timestamp": now()
      }, expire=1800)  # 30分钟自动释放
      return waveform_data
  ```

- **解锁时机**:
  - 用户点击其他Trial
  - 用户登出
  - 30分钟无操作自动释放

**3.2.11 锁定状态展示**
- Trial列表中显示 🔒 图标 + 锁定者用户名
- 鼠标悬停显示锁定时间和剩余时长
- 管理员可强制解锁 (需确认)

---

#### ✅ **Module 6: 标注质量检查** (优先级P4)

**3.2.12 自动检测规则**
1. **阶段顺序异常**: 检测是否符合事件序列配置
2. **时长异常**:
   - 阶段时长过短 (如Impact<50ms)
   - 阶段时长过长 (如Baseline>10s)
3. **缺失阶段**: 事件中缺少必需阶段
4. **时间重叠**: 多个事件的时间范围重叠

**3.2.13 质量报告**
```typescript
GET /api/files/{file_id}/trials/{trial_id}/quality-check
Response: {
  status: "warning",
  issues: [
    {
      type: "duration_anomaly",
      severity: "medium",
      message: "Impact阶段时长仅30ms (建议>50ms)",
      location: {eventIndex: 2, phase: "Impact"}
    },
    ...
  ]
}
```

---

## 4. 数据模型

### 4.1 MongoDB Collections

#### Collection: `users`
```typescript
{
  _id: ObjectId,
  username: string,           // 唯一用户名
  email: string,
  passwordHash: string,       // bcrypt加密
  role: "admin" | "annotator" | "viewer",
  preferences: {
    defaultTemplateId: ObjectId,  // 默认事件模板
    theme: "light" | "dark"
  },
  createdAt: Date,
  lastLogin: Date
}
```

#### Collection: `event_templates`
```typescript
{
  _id: ObjectId,
  name: string,               // "标准接触实验"
  isGlobal: boolean,          // 全局模板 vs 私有模板
  createdBy: ObjectId,        // 创建者用户ID
  phases: [
    {
      id: string,             // "baseline"
      name: string,           // "Baseline"
      color: string,          // "#3B82F6"
      shortcut: string,       // "1"
      order: number           // 0, 1, 2...
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

#### Collection: `event_annotations`
```typescript
{
  _id: ObjectId,
  fileId: string,             // "dataset/exp01/contact_01.h5"
  trialIndex: number,         // 0-based trial索引
  userId: ObjectId,           // 标注者
  templateId: ObjectId,       // 使用的事件模板
  annotations: [
    {
      phaseId: string,        // 引用template.phases[].id
      timestamp: number,      // 标注点时间戳(秒)
      confidence: number      // 预留字段: 标注置信度 0-1
    }
  ],
  status: "draft" | "completed" | "reviewed",
  createdAt: Date,
  updatedAt: Date,
  lockedBy: ObjectId | null,  // 悲观锁字段
  lockedAt: Date | null
}
```

#### Collection: `trial_metadata` (缓存层)
```typescript
{
  _id: ObjectId,
  fileId: string,
  trialIndex: number,
  thumbnailData: {            // 缩略图数据 (100个采样点)
    timestamps: number[],
    values: number[]
  },
  statistics: {
    duration: number,         // 波形时长(秒)
    sampleRate: number,       // 采样率
    dataPoints: number        // 总采样点数
  },
  annotationProgress: number, // 0-100
  createdAt: Date
}
```

---

## 5. API接口设计

### 5.1 认证接口

```http
POST /api/auth/register
Request: {username, email, password}
Response: {userId, token}

POST /api/auth/login
Request: {username, password}
Response: {token, user: {id, username, role}}

POST /api/auth/logout
Headers: {Authorization: "Bearer {token}"}
Response: {success: true}
```

### 5.2 文件管理接口

```http
GET /api/files
Query: ?status=completed&search=exp01
Response: [
  {
    fileId: "dataset/exp01/contact_01.h5",
    trialCount: 25,
    progress: 60,
    annotatedEvents: 15,
    totalEvents: 25,
    status: "in_progress"
  }
]

GET /api/files/{file_id}/trials
Response: [
  {
    trialIndex: 0,
    thumbnail: {timestamps: [...], values: [...]},
    progress: 40,
    lockedBy: null
  }
]

GET /api/files/{file_id}/trials/{trial_id}/waveform
Response: {
  raw: {timestamps: [...], values: [...]},
  filtered: {timestamps: [...], values: [...]},
  annotations: [...],
  lock: {lockedBy: "张三", lockedAt: "2025-10-01T10:00:00Z"}
}
```

### 5.3 标注接口

```http
POST /api/annotations
Request: {
  fileId, trialIndex, templateId,
  annotation: {phaseId, timestamp}
}
Response: {annotationId, success: true}

DELETE /api/annotations/{annotation_id}
Response: {success: true}

PUT /api/annotations/{annotation_id}
Request: {timestamp: 3.14}
Response: {success: true}
```

### 5.4 模板接口

```http
GET /api/templates
Query: ?scope=global|private
Response: [
  {
    id, name, phases: [...], isGlobal, createdBy
  }
]

POST /api/templates
Request: {name, phases: [...], isGlobal: false}
Response: {templateId}

PUT /api/templates/{template_id}
Request: {name, phases: [...]}
Response: {success: true}
```

---

## 6. 非功能需求

### 6.1 性能要求
- **首屏加载**: <2秒 (文件列表 + 用户信息)
- **波形渲染**: 10万采样点 <500ms
- **缩放响应**: <100ms (60fps流畅体验)
- **并发支持**: 10用户同时标注

### 6.2 浏览器兼容性
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### 6.3 安全要求
- JWT Token有效期: 7天
- 密码强度: 最少8位，包含数字+字母
- HTTPS强制跳转
- CORS配置: 仅允许特定域名访问

### 6.4 数据备份
- MongoDB自动备份: 每日凌晨3点
- 保留最近30天备份
- 标注数据导出功能 (JSON/CSV格式)

---

## 7. UI/UX设计原则

### 7.1 视觉风格
- **配色方案**:
  - 主色: `#3B82F6` (蓝色)
  - 成功: `#10B981` (绿色)
  - 警告: `#F59E0B` (橙色)
  - 错误: `#EF4444` (红色)
- **字体**:
  - 标题: Inter, -apple-system
  - 正文: system-ui
  - 等宽: 'JetBrains Mono'
- **设计系统**: 参考 Tailwind CSS + shadcn/ui

### 7.2 交互反馈
- **加载状态**: Skeleton屏 (避免空白页)
- **操作反馈**:
  - 成功: 绿色Toast + ✅ 图标
  - 错误: 红色Toast + ❌ 图标
  - 处理中: 转圈加载动画
- **快捷键提示**: 悬浮工具提示 (Tooltip)

### 7.3 响应式适配
- **桌面端**: 1920x1080 最佳体验
- **笔记本**: 1366x768 最小支持
- **移动端**: 暂不支持 (Phase 2考虑)

---

## 8. 里程碑与验收标准

### Phase 1: 基础波形浏览 (2周)
**功能范围**:
- 文件/Trial列表展示
- 波形图渲染 (uPlot集成)
- 缩放交互 (滚轮 + Shift/Cmd)
- 缩略图生成

**验收标准**:
- ✅ 可加载dataset目录下所有H5文件
- ✅ 波形渲染10万点 <500ms
- ✅ 缩放操作流畅无卡顿

---

### Phase 2: 事件序列配置器 (1周)
**功能范围**:
- 拖拽式配置界面
- 模板管理 (全局/私有)
- 快捷键绑定

**验收标准**:
- ✅ 可创建自定义事件序列
- ✅ 快捷键1-9切换阶段模式
- ✅ 模板保存到MongoDB

---

### Phase 3: 标注状态统计 (1周)
**功能范围**:
- 进度仪表盘
- 统计图表 (ECharts)
- 标注数据保存

**验收标准**:
- ✅ 实时显示标注进度
- ✅ 点击标注后立即保存到数据库
- ✅ 彩色Mask正确显示已标注区域

---

### Phase 4: 多用户协作 (1.5周)
**功能范围**:
- 用户认证 (JWT)
- 悲观锁机制
- 锁定状态展示

**验收标准**:
- ✅ 用户A标注Trial时，用户B看到🔒提示
- ✅ 30分钟无操作自动解锁
- ✅ 管理员可强制解锁

---

### Phase 5: 质量检查 (1周)
**功能范围**:
- 自动质量检测规则
- 质量报告生成
- 异常标注高亮提示

**验收标准**:
- ✅ 检测出时长异常、顺序错误等问题
- ✅ 质量报告以弹窗形式展示
- ✅ 标注员可选择忽略或修复问题

---

## 9. 风险与依赖

### 9.1 技术风险
- **H5文件解析性能**: 单个文件>1GB时可能加载缓慢
  - 缓解: 使用h5py分块读取 + Redis缓存
- **前端内存占用**: 同时加载多个Trial可能导致内存溢出
  - 缓解: 懒加载 + 卸载不可见Trial数据

### 9.2 依赖项
- **Python库**: h5py, numpy, scipy (预处理)
- **前端库**: React 18, uPlot, TailwindCSS
- **后端框架**: FastAPI, Motor (异步MongoDB)
- **基础设施**: MongoDB 5.0+, Redis (可选)

---

## 10. 后续迭代计划 (Phase 6+)

- **AI辅助标注**: 基于已标注数据训练模型，自动预标注
- **实时协作**: WebSocket同步显示其他用户光标和操作
- **标注历史版本**: 支持回滚到任意历史状态
- **移动端适配**: PWA渐进式Web应用
- **批量导出**: 标注结果导出为MATLAB/Python可读格式
- **质量评分系统**: 根据标注一致性评估标注员水平

---

## 附录A: 术语表

| 术语 | 定义 |
|------|------|
| **Trial** | H5文件中的单次实验记录 |
| **Event** | 一个完整的实验事件，由多个子阶段组成 |
| **Phase** | 事件的子阶段 (如Baseline, Impact) |
| **Template** | 事件序列配置模板 |
| **Mask** | 波形图上的彩色半透明覆盖层 |

---

## 附录B: 参考资料

- [uPlot文档](https://github.com/leeoniya/uPlot)
- [FastAPI文档](https://fastapi.tiangolo.com/)
- [MongoDB Motor文档](https://motor.readthedocs.io/)
- [shadcn/ui组件库](https://ui.shadcn.com/)
- [HDF5文件格式规范](https://www.hdfgroup.org/)

---

**文档维护**: 请在需求变更时及时更新本文档，确保开发团队信息同步。
