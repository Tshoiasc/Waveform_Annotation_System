# 波形标注系统 - 技术架构文档

**版本**: v1.0
**创建日期**: 2025-10-01
**技术栈**: React + TypeScript + FastAPI + MongoDB + uPlot

---

## 1. 系统架构概览

### 1.1 架构图

```mermaid
graph TB
    subgraph "前端层 Frontend"
        A[React SPA<br/>Vite + TypeScript]
        A1[路由<br/>React Router]
        A2[状态管理<br/>Zustand]
        A3[波形渲染<br/>uPlot]
        A4[UI组件<br/>shadcn/ui]
    end

    subgraph "API网关层 Gateway"
        B[Nginx<br/>反向代理 + 静态资源]
    end

    subgraph "应用层 Application"
        C[FastAPI<br/>Python 3.11+]
        C1[认证中间件<br/>JWT验证]
        C2[WebSocket服务<br/>实时协作]
        C3[H5处理服务<br/>h5py + scipy]
    end

    subgraph "数据层 Data"
        D[MongoDB<br/>文档数据库]
        D1[users集合]
        D2[event_annotations]
        D3[event_templates]
        D4[trial_metadata缓存]
        E[文件系统<br/>H5数据存储]
    end

    A -->|HTTP/WebSocket| B
    B -->|/api路由| C
    B -->|/ws路由| C2
    C --> D
    C3 --> E
    A3 -.预加载缓存.-> A2
```

---

## 2. 前端架构设计

### 2.1 技术栈选型

| 技术 | 版本 | 用途 | 选型理由 |
|------|------|------|----------|
| React | 18.3+ | UI框架 | 虚拟DOM优化、Hooks模式、生态成熟 |
| TypeScript | 5.5+ | 类型系统 | 编译时类型检查、代码可维护性 |
| Vite | 5.4+ | 构建工具 | 快速HMR、ES模块原生支持 |
| Zustand | 4.5+ | 状态管理 | 轻量级、无样板代码、React 18兼容 |
| React Router | 6.26+ | 路由管理 | 嵌套路由、Loader数据预加载 |
| uPlot | 1.6+ | 波形图表 | 高性能(百万点)、小体积(45KB) |
| shadcn/ui | - | 组件库 | Radix UI + Tailwind、可定制性强 |
| Tailwind CSS | 3.4+ | 原子化CSS | 快速开发、按需生成、体积优化 |
| @dnd-kit | 6.1+ | 拖拽库 | 无障碍支持、触控友好、模块化 |
| Axios | 1.7+ | HTTP客户端 | 拦截器、自动重试、请求取消 |

---

### 2.2 前端目录结构

```
frontend/
├── src/
│   ├── main.tsx                    # 应用入口
│   ├── App.tsx                     # 根组件
│   ├── routes/                     # 路由配置
│   │   ├── index.tsx
│   │   └── ProtectedRoute.tsx     # 认证路由守卫
│   ├── pages/                      # 页面组件
│   │   ├── LoginPage.tsx
│   │   ├── WorkspacePage.tsx      # 主工作区
│   │   └── SettingsPage.tsx
│   ├── components/                 # UI组件
│   │   ├── FileList/              # 文件列表组件
│   │   │   ├── FileList.tsx
│   │   │   └── FileListItem.tsx
│   │   ├── TrialList/             # Trial列表组件
│   │   │   ├── TrialList.tsx
│   │   │   └── TrialThumbnail.tsx
│   │   ├── WaveformViewer/        # 波形查看器
│   │   │   ├── WaveformChart.tsx  # uPlot封装
│   │   │   ├── TimelineRuler.tsx  # 横向刻度条
│   │   │   ├── AnnotationLayer.tsx # 标注点图层
│   │   │   └── MaskLayer.tsx       # 彩色Mask图层
│   │   ├── EventConfigModal/      # 事件配置器
│   │   │   ├── PhaseLibrary.tsx   # 阶段库
│   │   │   └── SequenceBuilder.tsx # 序列构建器
│   │   └── ui/                    # shadcn/ui组件
│   │       ├── button.tsx
│   │       ├── dialog.tsx
│   │       └── ...
│   ├── hooks/                      # 自定义Hooks
│   │   ├── useWaveformData.ts     # 波形数据加载
│   │   ├── useAnnotations.ts      # 标注CRUD
│   │   ├── useZoomHistory.ts      # 缩放历史
│   │   └── useWebSocket.ts        # WebSocket连接
│   ├── stores/                     # Zustand状态管理
│   │   ├── authStore.ts           # 用户认证状态
│   │   ├── workspaceStore.ts      # 工作区状态
│   │   └── annotationStore.ts     # 标注数据状态
│   ├── services/                   # API服务层
│   │   ├── api.ts                 # Axios实例配置
│   │   ├── authService.ts
│   │   ├── fileService.ts
│   │   └── annotationService.ts
│   ├── types/                      # TypeScript类型定义
│   │   ├── waveform.ts
│   │   ├── annotation.ts
│   │   └── user.ts
│   └── utils/                      # 工具函数
│       ├── waveformProcessor.ts   # 波形数据处理
│       ├── colorPalette.ts        # 颜色方案
│       └── keyboardShortcuts.ts   # 快捷键管理
├── public/                         # 静态资源
├── index.html
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

---

### 2.3 核心模块设计

#### 2.3.1 状态管理架构 (Zustand)

**authStore** - 用户认证状态
```typescript
interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;

  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}
```

**workspaceStore** - 工作区状态
```typescript
interface WorkspaceStore {
  // 当前选中
  selectedFileId: string | null;
  selectedTrialIndex: number | null;

  // 视图状态
  zoomHistory: ZoomState[];
  currentZoomIndex: number;

  // UI状态
  activePhaseMode: string | null; // 当前激活的标注阶段
  showRuler: boolean;
  showMask: boolean;

  // 操作方法
  selectFile: (fileId: string) => void;
  selectTrial: (trialIndex: number) => void;
  pushZoomState: (state: ZoomState) => void;
  undoZoom: () => void;
  redoZoom: () => void;
  setActivePhase: (phaseId: string) => void;
}
```

**annotationStore** - 标注数据状态
```typescript
interface AnnotationStore {
  // 标注数据
  annotations: Annotation[];
  currentTemplate: EventTemplate | null;

  // 操作方法
  addAnnotation: (phase: string, timestamp: number) => Promise<void>;
  deleteAnnotation: (annotationId: string) => Promise<void>;
  updateAnnotation: (annotationId: string, timestamp: number) => Promise<void>;
  loadAnnotations: (fileId: string, trialIndex: number) => Promise<void>;
  saveAnnotations: () => Promise<void>;

  // 衍生状态 (计算属性)
  get derivedEvents(): Event[]; // 自动推导的事件范围
}
```

---

#### 2.3.2 波形可视化架构 (uPlot)

**WaveformChart组件结构**
```typescript
interface WaveformChartProps {
  rawWaveform: { timestamps: number[], values: number[] };
  filteredWaveform: { timestamps: number[], values: number[] };
  annotations: Annotation[];
  onAnnotationAdd: (timestamp: number) => void;
  onZoomChange: (xMin: number, xMax: number, yMin: number, yMax: number) => void;
}

// uPlot配置
const uPlotOptions: uPlot.Options = {
  width: containerWidth,
  height: 600,
  scales: {
    x: { time: false }, // 时间轴配置
    y: { auto: true }
  },
  series: [
    {}, // X轴(时间)
    { // 原始波形
      stroke: "rgba(156, 163, 175, 0.3)",
      width: 1,
      points: { show: false }
    },
    { // 滤波波形
      stroke: "#3B82F6",
      width: 2,
      points: { show: false }
    }
  ],
  hooks: {
    init: [initMaskLayer, initAnnotationLayer],
    setScale: [handleZoom],
    setCursor: [handleClick]
  },
  plugins: [
    maskLayerPlugin,        // 彩色Mask插件
    annotationLayerPlugin,  // 标注点插件
    rulerPlugin            // 刻度条插件
  ]
};
```

**自定义uPlot插件**

1. **maskLayerPlugin** - 彩色Mask图层
```typescript
const maskLayerPlugin: uPlot.Plugin = {
  hooks: {
    draw: (u) => {
      const ctx = u.ctx;
      const { left, top, width, height } = u.bbox;

      derivedEvents.forEach(event => {
        event.phases.forEach(phase => {
          const x1 = u.valToPos(phase.startTime, 'x');
          const x2 = u.valToPos(phase.endTime, 'x');

          ctx.fillStyle = hexToRgba(phase.color, 0.25);
          ctx.fillRect(x1, top, x2 - x1, height);
        });
      });
    }
  }
};
```

2. **annotationLayerPlugin** - 标注点图层
```typescript
const annotationLayerPlugin: uPlot.Plugin = {
  hooks: {
    draw: (u) => {
      const ctx = u.ctx;
      annotations.forEach(ann => {
        const x = u.valToPos(ann.timestamp, 'x');
        const y = u.valToPos(ann.yValue, 'y');

        // 绘制垂直线
        ctx.strokeStyle = ann.phaseColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, u.bbox.top);
        ctx.lineTo(x, u.bbox.top + u.bbox.height);
        ctx.stroke();

        // 绘制圆点
        ctx.fillStyle = ann.phaseColor;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }
};
```

---

#### 2.3.3 缩放与导航系统

**缩放历史栈设计**
```typescript
interface ZoomState {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  timestamp: number;
}

class ZoomHistoryManager {
  private history: ZoomState[] = [];
  private currentIndex: number = -1;
  private maxSize: number = 50;

  push(state: ZoomState): void {
    // 删除当前位置之后的所有历史
    this.history = this.history.slice(0, this.currentIndex + 1);

    // 添加新状态
    this.history.push(state);
    if (this.history.length > this.maxSize) {
      this.history.shift();
    } else {
      this.currentIndex++;
    }
  }

  undo(): ZoomState | null {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      return this.history[this.currentIndex];
    }
    return null;
  }

  redo(): ZoomState | null {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      return this.history[this.currentIndex];
    }
    return null;
  }
}
```

**快捷键管理**
```typescript
const keyboardShortcuts = {
  // 缩放导航
  'ctrl+z': () => workspaceStore.undoZoom(),
  'ctrl+shift+z': () => workspaceStore.redoZoom(),
  'r': () => workspaceStore.resetZoom(),

  // 标注模式切换
  '1': () => workspaceStore.setActivePhase('baseline'),
  '2': () => workspaceStore.setActivePhase('approach'),
  '3': () => workspaceStore.setActivePhase('impact'),
  '4': () => workspaceStore.setActivePhase('ringdown'),
  'escape': () => workspaceStore.setActivePhase(null),

  // Trial导航
  'arrowup': () => workspaceStore.selectPreviousTrial(),
  'arrowdown': () => workspaceStore.selectNextTrial(),

  // 标注操作
  'ctrl+s': () => annotationStore.saveAnnotations(),
  'd': () => annotationStore.deleteLastAnnotation()
};
```

---

## 3. 后端架构设计

### 3.1 技术栈选型

| 技术 | 版本 | 用途 | 选型理由 |
|------|------|------|----------|
| FastAPI | 0.110+ | Web框架 | 异步支持、自动文档、高性能 |
| Motor | 3.4+ | MongoDB驱动 | 异步IO、与FastAPI配合 |
| PyJWT | 2.8+ | JWT生成/验证 | 标准实现、安全可靠 |
| Passlib | 1.7+ | 密码哈希 | bcrypt算法、慢速哈希 |
| h5py | 3.11+ | H5文件处理 | HDF5标准实现、高效读取 |
| NumPy | 1.26+ | 数值计算 | 波形数据处理 |
| SciPy | 1.13+ | 信号处理 | 低通滤波器实现 |
| Pydantic | 2.7+ | 数据验证 | FastAPI内置、类型安全 |
| python-multipart | 0.0.9+ | 文件上传 | multipart/form-data支持 |

---

### 3.2 后端目录结构

```
backend/
├── app/
│   ├── main.py                     # FastAPI应用入口
│   ├── config.py                   # 配置管理 (环境变量)
│   ├── dependencies.py             # 依赖注入
│   ├── api/                        # API路由
│   │   ├── __init__.py
│   │   ├── auth.py                # 认证接口
│   │   ├── files.py               # 文件管理
│   │   ├── annotations.py         # 标注接口
│   │   ├── templates.py           # 模板管理
│   │   └── websocket.py           # WebSocket端点
│   ├── models/                     # Pydantic模型
│   │   ├── user.py
│   │   ├── annotation.py
│   │   └── template.py
│   ├── schemas/                    # 请求/响应Schema
│   │   ├── auth.py
│   │   ├── file.py
│   │   └── annotation.py
│   ├── services/                   # 业务逻辑层
│   │   ├── auth_service.py        # 认证逻辑
│   │   ├── h5_service.py          # H5文件处理
│   │   ├── annotation_service.py  # 标注业务逻辑
│   │   └── lock_service.py        # 悲观锁管理
│   ├── db/                         # 数据库层
│   │   ├── mongodb.py             # MongoDB连接
│   │   ├── repositories/          # 数据访问层
│   │   │   ├── user_repo.py
│   │   │   ├── annotation_repo.py
│   │   │   └── template_repo.py
│   │   └── migrations/            # 数据库迁移脚本
│   ├── middleware/                 # 中间件
│   │   ├── auth_middleware.py     # JWT验证
│   │   └── cors_middleware.py     # CORS配置
│   ├── utils/                      # 工具函数
│   │   ├── security.py            # 密码哈希、JWT生成
│   │   ├── waveform_processor.py  # 波形预处理
│   │   └── file_scanner.py        # H5文件扫描
│   └── tests/                      # 单元测试
│       ├── test_auth.py
│       ├── test_h5_service.py
│       └── test_annotations.py
├── requirements.txt
├── Dockerfile
└── docker-compose.yml
```

---

### 3.3 核心模块设计

#### 3.3.1 H5文件处理服务

**h5_service.py** - 波形数据预处理
```python
import h5py
import numpy as np
from scipy import signal
from typing import Dict, List

class H5Service:
    def __init__(self, data_root: str = "/data/dataset"):
        self.data_root = data_root

    def scan_files(self) -> List[Dict]:
        """扫描dataset目录下所有H5文件"""
        h5_files = []
        for root, dirs, files in os.walk(self.data_root):
            for file in files:
                if file.endswith('.h5'):
                    rel_path = os.path.relpath(
                        os.path.join(root, file),
                        self.data_root
                    )
                    h5_files.append({
                        "fileId": rel_path,
                        "fullPath": os.path.join(root, file)
                    })
        return h5_files

    def load_trial_metadata(self, file_path: str, trial_index: int) -> Dict:
        """加载Trial元数据和缩略图"""
        with h5py.File(file_path, 'r') as f:
            trial_key = f"trial_{trial_index}"
            if trial_key not in f:
                raise ValueError(f"Trial {trial_index} not found")

            raw_data = f[trial_key]['data'][:]
            timestamps = f[trial_key]['timestamps'][:]

            # 生成缩略图 (降采样到100点)
            downsample_factor = len(raw_data) // 100
            thumbnail = {
                "timestamps": timestamps[::downsample_factor].tolist(),
                "values": raw_data[::downsample_factor].tolist()
            }

            return {
                "trialIndex": trial_index,
                "duration": timestamps[-1] - timestamps[0],
                "sampleRate": len(timestamps) / (timestamps[-1] - timestamps[0]),
                "dataPoints": len(raw_data),
                "thumbnail": thumbnail
            }

    def preprocess_waveform(self, file_path: str, trial_index: int) -> Dict:
        """完整波形预处理 (参考annotate_h5_waveform.py)"""
        with h5py.File(file_path, 'r') as f:
            trial_key = f"trial_{trial_index}"
            raw_data = f[trial_key]['data'][:]
            timestamps = f[trial_key]['timestamps'][:]

        # 1. 时间轴重建 (模拟100ms分块采样)
        reconstructed_timestamps = self._reconstruct_timestamps(
            raw_data,
            buffer_size=0.1,
            fs=1000
        )

        # 2. 30Hz低通滤波
        filtered_data = self._lowpass_filter(
            raw_data,
            cutoff=30.0,
            fs=1000,
            order=4
        )

        # 3. 拐点预提取 (可选)
        keypoints = self._extract_keypoints(filtered_data)

        return {
            "raw": {
                "timestamps": reconstructed_timestamps.tolist(),
                "values": raw_data.tolist()
            },
            "filtered": {
                "timestamps": reconstructed_timestamps.tolist(),
                "values": filtered_data.tolist()
            },
            "keypoints": keypoints.tolist()
        }

    def _lowpass_filter(self, data: np.ndarray, cutoff: float,
                        fs: float, order: int) -> np.ndarray:
        """巴特沃斯低通滤波器"""
        nyquist = 0.5 * fs
        normal_cutoff = cutoff / nyquist
        b, a = signal.butter(order, normal_cutoff, btype='low', analog=False)
        return signal.filtfilt(b, a, data)

    def _reconstruct_timestamps(self, data: np.ndarray,
                                 buffer_size: float, fs: float) -> np.ndarray:
        """重建非均匀时间轴 (模拟分块采样)"""
        n_samples = len(data)
        buffer_samples = int(buffer_size * fs)
        timestamps = []

        for i in range(0, n_samples, buffer_samples):
            chunk_size = min(buffer_samples, n_samples - i)
            chunk_timestamps = np.linspace(
                i / fs,
                (i + chunk_size) / fs,
                chunk_size
            )
            timestamps.extend(chunk_timestamps)

        return np.array(timestamps)

    def _extract_keypoints(self, data: np.ndarray,
                           min_distance: int = 3) -> np.ndarray:
        """提取拐点 (斜率突变点)"""
        dy = np.diff(data)

        # MAD自适应阈值
        mad = np.median(np.abs(dy - np.median(dy)))
        threshold = np.percentile(np.abs(dy), 75) + 1.5 * mad

        # 检测突变点
        keypoints = np.where(np.abs(dy) >= threshold)[0]

        # 最小距离去重
        if len(keypoints) > 0:
            filtered = [keypoints[0]]
            for kp in keypoints[1:]:
                if kp - filtered[-1] >= min_distance:
                    filtered.append(kp)
            return np.array(filtered)

        return np.array([])
```

---

#### 3.3.2 悲观锁服务

**lock_service.py** - Redis实现的分布式锁
```python
import redis
from datetime import datetime, timedelta
from typing import Optional

class LockService:
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.lock_prefix = "trial_lock:"
        self.default_ttl = 1800  # 30分钟

    def acquire_lock(self, file_id: str, trial_index: int,
                     user_id: str, username: str) -> bool:
        """尝试获取Trial锁"""
        lock_key = f"{self.lock_prefix}{file_id}:{trial_index}"

        # 检查是否已被锁定
        existing_lock = self.redis.get(lock_key)
        if existing_lock:
            lock_data = json.loads(existing_lock)
            if lock_data['user_id'] != user_id:
                return False  # 已被其他用户锁定

        # 设置锁
        lock_data = {
            "user_id": user_id,
            "username": username,
            "locked_at": datetime.utcnow().isoformat()
        }
        self.redis.setex(
            lock_key,
            self.default_ttl,
            json.dumps(lock_data)
        )
        return True

    def release_lock(self, file_id: str, trial_index: int,
                     user_id: str) -> bool:
        """释放Trial锁"""
        lock_key = f"{self.lock_prefix}{file_id}:{trial_index}"

        # 验证锁的所有者
        existing_lock = self.redis.get(lock_key)
        if existing_lock:
            lock_data = json.loads(existing_lock)
            if lock_data['user_id'] == user_id:
                self.redis.delete(lock_key)
                return True
        return False

    def extend_lock(self, file_id: str, trial_index: int,
                    user_id: str) -> bool:
        """延长锁有效期 (心跳保活)"""
        lock_key = f"{self.lock_prefix}{file_id}:{trial_index}"

        existing_lock = self.redis.get(lock_key)
        if existing_lock:
            lock_data = json.loads(existing_lock)
            if lock_data['user_id'] == user_id:
                self.redis.expire(lock_key, self.default_ttl)
                return True
        return False

    def get_lock_info(self, file_id: str, trial_index: int) -> Optional[Dict]:
        """获取锁信息"""
        lock_key = f"{self.lock_prefix}{file_id}:{trial_index}"
        lock_data = self.redis.get(lock_key)

        if lock_data:
            data = json.loads(lock_data)
            ttl = self.redis.ttl(lock_key)
            data['remaining_seconds'] = ttl
            return data
        return None
```

---

#### 3.3.3 WebSocket实时协作

**websocket.py** - 实时状态同步
```python
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Set
import json

class ConnectionManager:
    def __init__(self):
        # {user_id: Set[WebSocket]}
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def broadcast(self, message: dict, exclude_user: str = None):
        """广播消息给所有用户 (可选排除某用户)"""
        for user_id, connections in self.active_connections.items():
            if user_id == exclude_user:
                continue
            for connection in connections:
                try:
                    await connection.send_json(message)
                except:
                    pass

    async def send_to_user(self, user_id: str, message: dict):
        """发送消息给特定用户"""
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except:
                    pass

manager = ConnectionManager()

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(websocket, user_id)

    try:
        while True:
            # 接收客户端消息
            data = await websocket.receive_json()
            event_type = data.get('type')

            if event_type == 'trial_lock':
                # 广播Trial锁定事件
                await manager.broadcast({
                    "type": "trial_locked",
                    "fileId": data['fileId'],
                    "trialIndex": data['trialIndex'],
                    "lockedBy": user_id
                }, exclude_user=user_id)

            elif event_type == 'trial_unlock':
                # 广播Trial解锁事件
                await manager.broadcast({
                    "type": "trial_unlocked",
                    "fileId": data['fileId'],
                    "trialIndex": data['trialIndex']
                })

            elif event_type == 'annotation_update':
                # 广播标注更新 (用于刷新进度统计)
                await manager.broadcast({
                    "type": "annotation_updated",
                    "fileId": data['fileId'],
                    "trialIndex": data['trialIndex'],
                    "progress": data['progress']
                }, exclude_user=user_id)

            elif event_type == 'heartbeat':
                # 心跳响应
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
```

---

## 4. 数据库设计

### 4.1 MongoDB索引优化

```javascript
// users集合索引
db.users.createIndex({ username: 1 }, { unique: true })
db.users.createIndex({ email: 1 }, { unique: true })

// event_annotations集合索引
db.event_annotations.createIndex(
  { fileId: 1, trialIndex: 1 },
  { unique: true }
)
db.event_annotations.createIndex({ userId: 1 })
db.event_annotations.createIndex({ status: 1 })
db.event_annotations.createIndex({ lockedBy: 1, lockedAt: 1 })

// event_templates集合索引
db.event_templates.createIndex({ isGlobal: 1 })
db.event_templates.createIndex({ createdBy: 1 })

// trial_metadata集合索引
db.trial_metadata.createIndex({ fileId: 1, trialIndex: 1 }, { unique: true })
```

---

### 4.2 数据库连接管理

**mongodb.py** - Motor异步连接
```python
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

class Database:
    client: AsyncIOMotorClient = None

db = Database()

async def get_database():
    return db.client[settings.MONGODB_DATABASE]

async def connect_to_mongo():
    """启动时建立连接"""
    db.client = AsyncIOMotorClient(
        settings.MONGODB_URI,
        maxPoolSize=50,
        minPoolSize=10
    )
    print("✅ Connected to MongoDB")

async def close_mongo_connection():
    """关闭时释放连接"""
    db.client.close()
    print("❌ MongoDB connection closed")
```

---

## 5. 部署架构

### 5.1 Docker Compose配置

```yaml
version: '3.8'

services:
  # MongoDB数据库
  mongodb:
    image: mongo:7.0
    container_name: waveform-mongodb
    restart: always
    ports:
      - "27018:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: mongodb
      MONGO_INITDB_ROOT_PASSWORD: Qq1970251968
      MONGO_INITDB_DATABASE: waveform-annotation-system
    volumes:
      - mongo_data:/data/db
      - ./mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js:ro
    networks:
      - waveform-net

  # Redis缓存 (锁服务)
  redis:
    image: redis:7-alpine
    container_name: waveform-redis
    restart: always
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - waveform-net

  # FastAPI后端
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: waveform-backend
    restart: always
    ports:
      - "8000:8000"
    environment:
      MONGODB_URI: mongodb://mongodb:Qq1970251968@mongodb:27017/waveform-annotation-system
      REDIS_URL: redis://redis:6379/0
      JWT_SECRET_KEY: ${JWT_SECRET_KEY}
      H5_DATA_PATH: /data/dataset
    volumes:
      - ./dataset:/data/dataset:ro  # 只读挂载H5数据
      - ./backend:/app
    depends_on:
      - mongodb
      - redis
    networks:
      - waveform-net

  # Nginx反向代理
  nginx:
    image: nginx:alpine
    container_name: waveform-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./frontend/dist:/usr/share/nginx/html:ro
    depends_on:
      - backend
    networks:
      - waveform-net

volumes:
  mongo_data:
  redis_data:

networks:
  waveform-net:
    driver: bridge
```

---

### 5.2 Nginx配置

**nginx.conf**
```nginx
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # 日志格式
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Gzip压缩
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript
               application/json application/javascript application/xml+rss;

    # 上游服务器
    upstream backend {
        server backend:8000;
    }

    server {
        listen 80;
        server_name _;

        # 前端静态资源
        location / {
            root /usr/share/nginx/html;
            try_files $uri $uri/ /index.html;

            # 缓存策略
            location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
                expires 1y;
                add_header Cache-Control "public, immutable";
            }
        }

        # 后端API代理
        location /api {
            proxy_pass http://backend;
            proxy_http_version 1.1;

            # 超时配置
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;

            # 请求头传递
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # WebSocket代理
        location /ws {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;

            # WebSocket超时配置 (30分钟)
            proxy_read_timeout 1800s;
            proxy_send_timeout 1800s;
        }

        # 健康检查端点
        location /health {
            proxy_pass http://backend/health;
        }
    }
}
```

---

## 6. 性能优化策略

### 6.1 前端性能优化

| 优化项 | 实现方案 | 预期效果 |
|--------|----------|----------|
| 代码分割 | React.lazy() + Suspense | 首屏加载减少60% |
| 波形数据懒加载 | 按需加载Trial数据 | 内存占用减少70% |
| 虚拟滚动 | react-window (Trial列表) | 渲染性能提升80% |
| 缓存策略 | React Query + IndexedDB | 重复请求减少90% |
| Canvas优化 | OffscreenCanvas后台渲染 | 缩放响应 <100ms |
| 防抖节流 | 缩放操作防抖200ms | CPU占用减少50% |

**代码分割示例**
```typescript
// 路由懒加载
const WorkspacePage = React.lazy(() => import('./pages/WorkspacePage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));

// App.tsx
<Suspense fallback={<LoadingSpinner />}>
  <Routes>
    <Route path="/workspace" element={<WorkspacePage />} />
    <Route path="/settings" element={<SettingsPage />} />
  </Routes>
</Suspense>
```

---

### 6.2 后端性能优化

| 优化项 | 实现方案 | 预期效果 |
|--------|----------|----------|
| 缩略图预生成 | 后台任务异步生成 | 响应时间减少80% |
| 数据库查询优化 | 索引优化 + 分页查询 | 查询速度提升5x |
| 连接池管理 | MongoDB连接池=50 | 并发能力提升3x |
| Redis缓存 | 热点数据缓存 | 数据库负载减少60% |
| 异步IO | Motor + asyncio | 吞吐量提升4x |

**缓存策略示例**
```python
from functools import lru_cache
import redis

redis_client = redis.Redis(host='redis', port=6379, db=0)

async def get_trial_metadata(file_id: str, trial_index: int):
    # 1. 尝试从Redis获取
    cache_key = f"metadata:{file_id}:{trial_index}"
    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    # 2. 从MongoDB获取
    metadata = await trial_metadata_repo.find_one(
        {"fileId": file_id, "trialIndex": trial_index}
    )

    # 3. 如果MongoDB也没有,从H5文件生成
    if not metadata:
        metadata = h5_service.load_trial_metadata(file_id, trial_index)
        await trial_metadata_repo.insert_one(metadata)

    # 4. 写入Redis缓存 (1小时过期)
    redis_client.setex(cache_key, 3600, json.dumps(metadata))
    return metadata
```

---

## 7. 安全架构

### 7.1 认证与授权

**JWT Token结构**
```json
{
  "sub": "user_id_123",
  "username": "zhangsan",
  "role": "annotator",
  "exp": 1704499200,
  "iat": 1704412800
}
```

**安全中间件**
```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> User:
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.JWT_SECRET_KEY,
            algorithms=["HS256"]
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")

        user = await user_repo.find_by_id(user_id)
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Could not validate token")
```

---

### 7.2 数据安全

| 安全措施 | 实现方式 |
|----------|----------|
| 密码哈希 | bcrypt (cost factor=12) |
| Token签名 | HMAC-SHA256 |
| HTTPS强制 | Nginx自动跳转 |
| CORS限制 | 仅允许前端域名 |
| SQL注入防护 | Pydantic参数验证 |
| XSS防护 | React自动转义 + CSP |
| 敏感数据 | 环境变量存储 |

---

## 8. 监控与日志

### 8.1 日志架构

**日志级别**
- DEBUG: 开发调试信息
- INFO: 一般业务日志
- WARNING: 可恢复错误
- ERROR: 需要关注的错误
- CRITICAL: 系统级别错误

**日志配置**
```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/waveform/app.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# 使用示例
logger.info(f"User {user_id} locked trial {file_id}:{trial_index}")
logger.error(f"Failed to load H5 file: {file_path}", exc_info=True)
```

---

### 8.2 监控指标

**后端监控**
- API响应时间 (P50/P95/P99)
- 数据库查询时间
- WebSocket连接数
- 错误率 (4xx/5xx)
- 内存/CPU使用率

**前端监控**
- 首屏加载时间
- 波形渲染时间
- JavaScript错误率
- 用户操作热力图

---

## 9. 附录

### 9.1 环境变量配置

**.env示例**
```bash
# MongoDB配置
MONGODB_URI=mongodb://mongodb:Qq1970251968@localhost:27018/waveform-annotation-system

# Redis配置
REDIS_URL=redis://localhost:6379/0

# JWT配置
JWT_SECRET_KEY=your-secret-key-here-change-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRATION_DAYS=7

# H5数据路径
H5_DATA_PATH=/data/dataset

# FastAPI配置
DEBUG=false
CORS_ORIGINS=http://localhost:5173,https://yourdomain.com
```

---

### 9.2 开发工具链

| 工具 | 用途 |
|------|------|
| Vite DevServer | 前端热重载开发 |
| FastAPI /docs | 自动API文档 |
| MongoDB Compass | 数据库GUI |
| Postman | API测试 |
| React DevTools | React调试 |
| Redux DevTools | 状态调试 |

---

**文档状态**: ✅ 已完成
**下一步**: 生成实施路线图 (`ROADMAP.md`)
