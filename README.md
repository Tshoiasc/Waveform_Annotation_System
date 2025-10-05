# 波形标注系统

Web端科研数据标注平台 - 支持多用户协作的H5波形数据标注工具

## 📚 项目文档

- [PRD - 产品需求文档](./docs/PRD.md)
- [ARCHITECTURE - 技术架构文档](./docs/ARCHITECTURE.md)
- [ROADMAP - 实施路线图](./docs/ROADMAP.md)

## 🚀 快速开始

### 前提条件

- Node.js 18+
- Python 3.11+
- Docker & Docker Compose

### 前端开发

```bash
cd frontend
npm install
npm run dev
```

访问: http://localhost:5173

### 后端开发

```bash
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env

# 启动服务
uvicorn app.main:app --reload
```

访问: http://localhost:8000/docs

### Docker部署

```bash
# 启动所有服务 (MongoDB + Redis + Backend)
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

## 📁 项目结构

```
waveform-annotation-system/
├── frontend/              # 前端 (React + TypeScript + Vite)
│   ├── src/
│   │   ├── components/   # UI组件
│   │   ├── pages/        # 页面组件
│   │   ├── hooks/        # 自定义Hooks
│   │   ├── stores/       # Zustand状态管理
│   │   ├── services/     # API服务层
│   │   ├── types/        # TypeScript类型
│   │   └── utils/        # 工具函数
│   ├── package.json
│   └── vite.config.ts
├── backend/               # 后端 (FastAPI + Python)
│   ├── app/
│   │   ├── api/          # API路由
│   │   ├── models/       # Pydantic模型
│   │   ├── schemas/      # 请求/响应Schema
│   │   ├── services/     # 业务逻辑层
│   │   ├── db/           # 数据库层
│   │   ├── middleware/   # 中间件
│   │   └── utils/        # 工具函数
│   ├── requirements.txt
│   └── Dockerfile
├── dataset/               # H5数据文件 (挂载目录)
├── docs/                  # 项目文档
├── mongo-init/            # MongoDB初始化脚本
├── docker-compose.yml     # Docker Compose配置
└── README.md
```

## 🛠️ 技术栈

### 前端
- **框架**: React 18 + TypeScript
- **构建**: Vite
- **状态管理**: Zustand
- **路由**: React Router v6
- **UI库**: Tailwind CSS + shadcn/ui
- **波形渲染**: uPlot
- **拖拽**: @dnd-kit
- **HTTP**: Axios

### 后端
- **框架**: FastAPI
- **数据库**: MongoDB (Motor)
- **缓存**: Redis
- **认证**: JWT (PyJWT)
- **密码**: Passlib (bcrypt)
- **数据处理**: h5py + NumPy + SciPy

### 基础设施
- **容器**: Docker + Docker Compose
- **数据库**: MongoDB 7.0
- **缓存**: Redis 7

## 📦 功能特性

### Phase 1: 基础波形浏览 ✅
- [x] H5文件扫描与列表展示
- [x] Trial缩略图生成
- [x] uPlot高性能波形渲染
- [x] 滚轮缩放 + Shift/Cmd定向缩放
- [x] 缩放历史记录 (Ctrl+Z/Ctrl+Shift+Z)

### Phase 2: 事件序列配置器 ⏳
- [ ] 拖拽式阶段配置
- [ ] 全局模板 + 私有模板
- [ ] 快捷键绑定 (数字键1-9)

### Phase 3: 标注功能 ⏳
- [ ] 点击添加标注点
- [ ] 标注点可视化 (彩色边界线)
- [ ] 彩色Mask图层 (已标注区域)
- [ ] 标注进度统计

### Phase 4: 多用户协作 ⏳
- [ ] JWT用户认证
- [ ] Redis悲观锁机制
- [ ] WebSocket实时同步

### Phase 5: 质量检查 ⏳
- [ ] 自动质量检测规则
- [ ] 质量报告生成

## 🔧 开发命令

### 前端
```bash
npm run dev       # 启动开发服务器
npm run build     # 构建生产版本
npm run preview   # 预览生产构建
npm run lint      # 代码检查
```

### 后端
```bash
uvicorn app.main:app --reload  # 启动开发服务器
pytest                         # 运行测试
```

### Docker
```bash
docker-compose up -d          # 启动所有服务
docker-compose logs backend   # 查看后端日志
docker-compose restart        # 重启服务
docker-compose down -v        # 停止并删除数据卷
```

## 📝 开发进度

- [x] Phase 0: 项目初始化 (已完成)
- [ ] Phase 1: 基础波形浏览 (Week 1-2)
- [ ] Phase 2: 事件序列配置器 (Week 3)
- [ ] Phase 3: 标注功能 (Week 4)
- [ ] Phase 4: 多用户协作 (Week 5-6)
- [ ] Phase 5: 质量检查 (Week 6)
- [ ] Phase 6: 测试与部署 (Week 7)

## 🤝 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 License

MIT License

## 📞 联系方式

项目问题和建议请提交到 [Issues](https://github.com/your-org/waveform-annotation/issues)

---

**项目状态**: 🟢 开发中 | **当前版本**: v0.1.0
# Waveform_Annotation_System
