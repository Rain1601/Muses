# Muses 架构设计文档

## 系统架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                         用户浏览器                            │
│                    Next.js 前端应用 (3000)                    │
└──────────────────────────┬──────────────────────────────────┘
                          │ HTTP/WebSocket
┌──────────────────────────┴──────────────────────────────────┐
│                    Express 后端 API (8080)                   │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────────┐    │
│  │   路由层    │  │   中间件     │  │    服务层        │    │
│  │            │  │             │  │                  │    │
│  │ - Auth     │  │ - 认证      │  │ - AI Service    │    │
│  │ - User     │  │ - 限流      │  │ - GitHub Service│    │
│  │ - Articles │  │ - 错误处理   │  │ - File Service  │    │
│  │ - Agents   │  │ - 日志      │  │                  │    │
│  └────────────┘  └─────────────┘  └──────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                          │
           ┌──────────────┼──────────────┐
           │              │              │
    ┌──────┴──────┐ ┌────┴────┐ ┌──────┴──────┐
    │   SQLite    │ │  缓存   │ │   文件系统   │
    │  (Prisma)   │ │(node-cache)│ │  (uploads)  │
    └─────────────┘ └─────────┘ └─────────────┘
                          │
           ┌──────────────┼──────────────┐
           │              │              │
    ┌──────┴──────┐ ┌────┴────┐ ┌──────┴──────┐
    │  OpenAI API │ │GitHub API│ │   其他 API   │
    └─────────────┘ └─────────┘ └─────────────┘
```

## 技术栈详情

### 前端技术栈

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS + Shadcn/ui
- **状态管理**: Zustand
- **数据获取**: TanStack Query (React Query)
- **表单处理**: React Hook Form + Zod
- **Markdown**: React Markdown

### 后端技术栈

- **运行时**: Node.js 18+
- **框架**: Express.js
- **语言**: TypeScript
- **ORM**: Prisma
- **数据库**: SQLite (可迁移到 PostgreSQL)
- **缓存**: Node-cache
- **认证**: JWT + GitHub OAuth
- **文件处理**: Multer
- **AI集成**: OpenAI SDK

## 核心模块设计

### 1. 认证模块

```typescript
// 认证流程
1. 用户点击 GitHub 登录
2. 重定向到 GitHub OAuth
3. GitHub 回调带 code
4. 后端用 code 换取 access_token
5. 获取用户信息并创建/更新用户
6. 生成 JWT token
7. 前端保存 token 并跳转
```

### 2. Agent 系统

Agent 是系统的核心概念，代表不同的 AI 写作助手：

```typescript
interface Agent {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  
  // 写作风格配置
  language: Language;
  tone: Tone;
  lengthPreference: LengthPreference;
  targetAudience?: string;
  
  // 高级配置
  customPrompt?: string;
  outputFormat: OutputFormat;
  specialRules?: Record<string, any>;
}
```

### 3. 文章生成流程

```
1. 素材准备
   ├── 文件上传 -> 解析内容
   ├── 直接输入文本
   └── 对话记录

2. AI 生成
   ├── 构建系统提示词（基于 Agent 配置）
   ├── 构建用户提示词（素材 + 要求）
   ├── 调用 OpenAI API
   └── 解析响应

3. 后处理
   ├── 提取标题和摘要
   ├── 格式化 Markdown
   └── 保存到数据库
```

### 4. 发布系统

```typescript
// 发布流程
1. 用户选择目标仓库
2. 设置文件路径
3. 构建文件内容（添加 frontmatter）
4. 调用 GitHub API 创建/更新文件
5. 更新文章状态
6. 返回 GitHub URL
```

## 数据模型

### 核心实体关系

```
User (1) ─── (n) Agent
  │               │
  └───── (n) Article (n) ─── (1)
          │
          └─── 发布信息
```

### 数据库设计原则

1. **用户隔离**: 所有查询都基于 userId
2. **软删除**: 重要数据不直接删除
3. **加密存储**: 敏感信息（API Key、Token）加密
4. **审计日志**: 记录关键操作

## 安全设计

### 1. 认证与授权

- JWT 有效期 7 天
- Token 存储在 localStorage
- 每个请求验证 userId

### 2. 数据加密

```typescript
// 加密敏感数据
- OpenAI API Key
- GitHub Access Token
- 使用 AES-256-GCM 算法
```

### 3. 输入验证

- 使用 Zod 进行运行时验证
- 文件上传类型和大小限制
- SQL 注入防护（Prisma）

### 4. 限流策略

- 基于 IP 的限流
- 15分钟窗口，最多100次请求
- 白名单机制

## 性能优化

### 1. 缓存策略

```typescript
// 缓存键设计
CacheKeys = {
  USER: (id) => `user:${id}`,
  AGENT: (id) => `agent:${id}`,
  ARTICLE: (id) => `article:${id}`,
  USER_AGENTS: (userId) => `user_agents:${userId}`,
  USER_ARTICLES: (userId) => `user_articles:${userId}`,
}

// 缓存时间
- 用户信息: 10分钟
- Agent列表: 10分钟  
- 文章列表: 5分钟
```

### 2. 数据库优化

- 适当的索引设计
- 分页查询
- 预加载关联数据

### 3. 前端优化

- 代码分割
- 图片懒加载
- 服务端渲染（SSR）
- 静态生成（SSG）

## 扩展性设计

### 1. 微服务化

系统可以拆分为：
- 认证服务
- 文章服务
- AI 生成服务
- 发布服务

### 2. 消息队列

对于耗时操作：
- 文章生成
- 批量发布
- 数据导出

### 3. 多租户

- 基于 subdomain
- 独立数据库
- 资源隔离

## 监控与运维

### 1. 日志体系

```typescript
// 日志级别
- error: 错误日志
- warn: 警告日志
- info: 普通日志
- debug: 调试日志

// 日志内容
- 请求日志
- 错误堆栈
- 性能指标
- 业务日志
```

### 2. 健康检查

- `/api/health` 端点
- 数据库连接检查
- 外部服务可用性

### 3. 备份策略

- 数据库每日备份
- 上传文件增量备份
- 配置文件版本控制

## 开发流程

### 1. 环境管理

- development: 本地开发
- staging: 预发布测试
- production: 生产环境

### 2. 代码规范

- ESLint 配置
- Prettier 格式化
- TypeScript 严格模式
- Git commit 规范

### 3. 测试策略

- 单元测试（规划中）
- 集成测试（规划中）
- E2E 测试（规划中）

## 未来规划

### 短期目标

1. WebSocket 实时通信
2. 批量文章生成
3. 定时发布功能
4. 更多文件格式支持

### 长期目标

1. 多平台发布
2. 团队协作
3. AI 模型选择
4. 插件系统
5. 移动端支持