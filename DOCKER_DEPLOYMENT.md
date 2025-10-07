# Docker 部署指南

本项目是一个基于 React + FastAPI + MongoDB 的波形标注系统，支持完整的 Docker 容器化部署。

## 🏗️ 项目架构

```
waveform-annotation/
├── frontend/           # React 前端 (Vite + TypeScript)
│   ├── Dockerfile     # 前端容器配置
│   ├── nginx.conf     # Nginx 配置
│   └── .dockerignore  # Docker 忽略文件
├── backend/           # FastAPI 后端
│   ├── Dockerfile     # 后端容器配置
│   └── .dockerignore  # Docker 忽略文件
├── dataset/           # 数据集目录
├── mongo-init/        # MongoDB 初始化脚本
└── docker-compose.yml # Docker Compose 配置
```

## 📦 服务组件

### 1. MongoDB 数据库 (mongodb)
- **镜像**: mongo:7.0
- **端口**: 27018:27017
- **数据持久化**: mongo_data volume
- **初始化**: 通过 mongo-init 目录自动初始化

### 2. FastAPI 后端 (backend)
- **构建**: ./backend/Dockerfile
- **端口**: 8000:8000
- **功能**: API 服务、数据处理、用户认证
- **依赖**: MongoDB, 外部 Redis

### 3. React 前端 (frontend)
- **构建**: ./frontend/Dockerfile (多阶段构建)
- **端口**: 3000:80
- **服务器**: Nginx
- **功能**: 用户界面、波形可视化

## 🚀 快速开始

### 前置要求
- Docker 20.0+
- Docker Compose 2.0+
- 至少 4GB 可用内存
- 至少 10GB 可用磁盘空间

### 1. 环境变量配置

创建 `.env` 文件（可选，有默认值）：

```bash
# JWT 密钥（生产环境必须修改）
JWT_SECRET_KEY=your-super-secret-jwt-key-change-in-production

# 数据库配置（已在 docker-compose.yml 中配置）
MONGODB_URI=mongodb://mongodb:Qq1970251968@mongodb:27017/waveform-annotation-system

# Redis 配置（使用云端 Redis）
REDIS_URL=redis://:Qq1970251968@117.50.201.9:26739
```

### 2. 构建并启动所有服务

```bash
# 构建镜像并启动服务
docker-compose up --build

# 后台运行
docker-compose up -d --build
```

### 3. 访问应用

- **前端界面**: http://localhost:3000
- **后端 API**: http://localhost:8000
- **API 文档**: http://localhost:8000/docs
- **MongoDB**: localhost:27018

## 🛠️ 开发模式

### 仅启动数据库服务
```bash
docker-compose up mongodb -d
```

### 本地开发前端
```bash
cd frontend
npm install
npm run dev  # 前端开发服务器: http://localhost:5173
```

### 本地开发后端
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 📊 服务监控

### 查看服务状态
```bash
docker-compose ps
```

### 查看日志
```bash
# 查看所有服务日志
docker-compose logs

# 查看特定服务日志
docker-compose logs frontend
docker-compose logs backend
docker-compose logs mongodb
```

### 进入容器
```bash
# 进入后端容器
docker-compose exec backend bash

# 进入前端容器
docker-compose exec frontend sh

# 进入数据库容器
docker-compose exec mongodb mongosh
```

## 🔧 配置说明

### 前端配置 (frontend/nginx.conf)
- 支持 React Router 客户端路由
- 启用 Gzip 压缩
- 静态资源缓存策略
- 安全头设置

### 后端配置
- 环境变量:
  - `MONGODB_URI`: MongoDB 连接字符串
  - `REDIS_URL`: Redis 连接字符串
  - `JWT_SECRET_KEY`: JWT 签名密钥
  - `H5_DATA_PATH`: 数据集路径
  - `CORS_ORIGINS`: 允许的跨域来源

### 数据持久化
- MongoDB 数据: `mongo_data` volume
- 数据集文件: `./dataset` 目录挂载为只读

## 🚀 生产部署

### 1. 生产环境变量
```bash
# 必须修改的配置
JWT_SECRET_KEY="your-production-jwt-secret-key"

# 推荐使用独立的 Redis 实例
REDIS_URL="redis://your-production-redis:6379"
```

### 2. 安全配置
- 修改数据库密码
- 使用强 JWT 密钥
- 配置防火墙规则
- 启用 HTTPS (需要反向代理)

### 3. 性能优化
- 调整容器资源限制
- 配置数据库索引
- 启用应用缓存
- 使用 CDN 加速静态资源

### 4. 反向代理配置 (Nginx)
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://localhost:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🛠️ 故障排查

### 常见问题

1. **端口冲突**
   ```bash
   # 检查端口占用
   lsof -i :3000
   lsof -i :8000
   lsof -i :27018
   ```

2. **内存不足**
   ```bash
   # 检查内存使用
   docker stats
   ```

3. **数据库连接失败**
   ```bash
   # 检查 MongoDB 日志
   docker-compose logs mongodb

   # 测试数据库连接
   docker-compose exec backend python -c "from app.database import get_database; print(get_database().list_collection_names())"
   ```

4. **构建失败**
   ```bash
   # 清理 Docker 缓存
   docker system prune -a

   # 重新构建
   docker-compose build --no-cache
   ```

### 日志级别调整
- 开发环境: `DEBUG`
- 生产环境: `INFO` 或 `WARNING`

## 🔄 更新部署

### 1. 更新代码
```bash
git pull origin main
```

### 2. 重新构建并部署
```bash
# 停止服务
docker-compose down

# 重新构建并启动
docker-compose up --build -d
```

### 3. 数据库迁移
```bash
# 如果有数据库迁移
docker-compose exec backend python -m app.database.migrate
```

## 📋 维护命令

```bash
# 停止所有服务
docker-compose down

# 停止并删除数据卷（谨慎使用！）
docker-compose down -v

# 查看资源使用
docker-compose top

# 备份 MongoDB 数据
docker-compose exec mongodb mongodump --archive=/tmp/backup.archive
docker cp $(docker-compose ps -q mongodb):/tmp/backup.archive ./backup.archive

# 恢复 MongoDB 数据
docker cp ./backup.archive $(docker-compose ps -q mongodb):/tmp/backup.archive
docker-compose exec mongodb mongorestore --archive=/tmp/backup.archive
```

## 🎯 性能监控

建议添加监控工具：
- **Prometheus + Grafana**: 应用性能监控
- **ELK Stack**: 日志聚合分析
- **cAdvisor**: 容器资源监控

---

## 📞 技术支持

如遇到部署问题，请检查：
1. Docker 和 Docker Compose 版本
2. 系统资源（内存、磁盘空间）
3. 网络连接和端口占用
4. 日志文件中的错误信息