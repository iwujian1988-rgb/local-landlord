# 本地房东 - 部署文档

## 环境要求

| 依赖 | 最低版本 | 说明 |
|------|---------|------|
| Node.js | >= 18.0 | 运行后端和管理后台 |
| pnpm | >= 8.0 | Monorepo 包管理器 |
| MySQL | 8.0 | 主数据库 |
| Redis | 7.0 | 缓存与会话 |
| Docker | 20+ | 可选，容器化部署 |
| 微信云托管 | - | 免备案容器部署（替代自建服务器） |

## 快速开始（本地开发）

### 1. 进入项目目录

```bash
cd local_landlord
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，修改数据库和 Redis 连接信息（本地开发可保持默认）。

### 4. 启动数据库（Docker 方式）

```bash
docker-compose -f docker/docker-compose.yml up -d
```

或手动启动 MySQL 8.0 + Redis 7。

### 5. 启动后端

```bash
pnpm dev:server
```

后端运行在 `http://localhost:3000`，API 前缀 `/api`。

### 6. 启动管理后台

```bash
pnpm dev:admin
```

管理后台运行在 `http://localhost:3001`，Vite 自动代理 `/api` 到后端。

### 7. 登录管理后台

- 地址：`http://localhost:3001`
- 默认账号：`admin`
- 默认密码：`admin123`

## 构建生产版本

```bash
# 构建后端
pnpm build:server

# 构建管理后台
pnpm build:admin
```

构建产物：
- 后端：`packages/server/dist/`
- 管理后台：`packages/admin/dist/`

## 微信云托管部署（免备案）

微信云托管是微信官方的容器化部署平台，小程序请求走微信内网，**不需要域名备案**。

**前置条件：** 微信小程序 AppID + 开通云开发 → 云托管 + 云开发数据库 MySQL

**部署步骤：**

**1. 修改 .env：**

```
UPLOAD_MODE=cloudbase
CLOUD_ENV_ID=你的云环境ID
DB_HOST=云开发MySQL内网地址
```

（COS 相关变量注释掉，Redis 可选）

**2. 构建并推送镜像：**

```bash
docker build -f docker/Dockerfile.server -t local-landlord-server .
```

在云托管控制台创建服务 → 推送镜像 → 配置环境变量 → 部署

**3. 小程序对接到云托管内网地址：**

修改 `packages/miniapp/src/services/request.ts` 的 `baseURL`

**4. 数据库初始化：**

TypeORM `synchronize:true` 自动建表；云开发 MySQL 需先在控制台创建 `local_landlord` 数据库

**5. 管理后台部署：** 云托管 Nginx 服务 或 Vercel 免费托管

## 自建服务器 Docker 部署

### 构建镜像

```bash
docker build -f docker/Dockerfile.server -t local-landlord-server .
```

### 启动全部服务

```bash
docker-compose -f docker/docker-compose.yml up -d
```

### 环境变量（Docker）

在 `docker-compose.yml` 或 `.env` 中配置：

| 变量 | 说明 | 示例 |
|------|------|------|
| DB_HOST | 数据库地址 | mysql |
| DB_PORT | 数据库端口 | 3306 |
| DB_USERNAME | 数据库用户名 | root |
| DB_PASSWORD | 数据库密码 | your_password |
| DB_DATABASE | 数据库名 | local_landlord |
| REDIS_HOST | Redis 地址 | redis |
| REDIS_PORT | Redis 端口 | 6379 |
| JWT_SECRET | JWT 签名密钥 | your_secret |
| JWT_EXPIRES_IN | Token 有效期 | 7d |
| WX_APPID | 微信小程序 AppID | wx_xxx |
| WX_SECRET | 微信小程序 Secret | your_secret |
| COS_SECRET_ID | 腾讯云 COS ID | your_id |
| COS_SECRET_KEY | 腾讯云 COS Key | your_key |
| COS_BUCKET | COS 存储桶 | your_bucket |
| COS_REGION | COS 区域 | ap-guangzhou |

## 数据库初始化

首次启动后端时，TypeORM 的 `synchronize: true` 会自动根据实体定义创建表结构（开发环境）。

生产环境建议使用 Migration：

```bash
pnpm --filter @local-landlord/server typeorm migration:run
```

## 微信小程序审核准备清单

1. [ ] 在微信公众平台注册小程序，获取 AppID
2. [ ] 配置 `.env` 中的 `WX_APPID` 和 `WX_SECRET`
3. [ ] 配置服务器域名白名单（request合法域名、uploadFile合法域名）
4. [ ] 在 `packages/miniapp/config/dev.js` 和 `prod.js` 中配置 API 地址
5. [ ] 准备 TabBar 图标素材（`assets/tab-*.png`）
6. [ ] 使用微信开发者工具打开 `packages/miniapp/dist/` 目录
7. [ ] 测试全部功能后提交审核

## 运行测试

```bash
# 运行 E2E 测试
pnpm test:e2e

# 类型检查
pnpm --filter @local-landlord/server type-check
```

## 常见问题

### 端口被占用

```bash
# Windows 查看端口占用
netstat -ano | findstr :3000

# 修改端口：编辑 .env 中的 PORT
```

### 数据库连接失败

检查 MySQL 是否启动：
```bash
docker ps | grep mysql
```

### pnpm install 失败

清除缓存重试：
```bash
pnpm store prune
rm -rf node_modules
pnpm install
```

### 云托管和自建服务器怎么选？

- 自建：需备案，独立可控，固定月费
- 云托管：免备案，微信内网直连，按量付费
- 推荐个人开发者用云托管起步

## Monorepo 项目结构

```
local_landlord/
├── packages/
│   ├── shared/      # 共享类型和常量
│   ├── server/      # NestJS 后端 API
│   ├── miniapp/     # Taro 3 小程序
│   └── admin/       # React 管理后台
├── docker/          # Docker 配置
├── docs/            # 文档
└── .github/         # CI/CD
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 小程序 | Taro 3 + React + Zustand |
| 管理后台 | React + MUI 5 + Tailwind CSS + ECharts |
| 后端 | NestJS + TypeORM + MySQL + Redis |
| 部署 | Docker + Nginx + PM2 |
| CI/CD | GitHub Actions |
