# 开发指南

## 🚀 开发环境搭建

### 环境要求

- **Node.js**: >= 18.0.0
- **pnpm**: >= 8.0.0 (推荐包管理器)
- **Git**: 最新版本
- **VS Code**: 推荐IDE
- **GitHub账号**: 用于OAuth测试

### 快速开始

```bash
# 1. 克隆项目
git clone <repository-url>
cd Muses

# 2. 初始化项目
./scripts/setup.sh

# 3. 配置开发环境变量
cp backend/.env.example backend/.env
# 编辑配置文件

# 4. 启动开发环境
./scripts/dev.sh
```

### VS Code推荐配置

安装推荐扩展：

```json
// .vscode/extensions.json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-json",
    "prisma.prisma",
    "ms-vscode.vscode-eslint"
  ]
}
```

工作区设置：

```json
// .vscode/settings.json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.preferences.quote": "double",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
    ["cn\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ]
}
```

## 📁 项目结构详解

### 前端结构 (frontend/)

```
frontend/
├── app/                    # Next.js App Router
│   ├── (auth)/            # 认证相关路由组
│   ├── (dashboard)/       # 工作台路由组
│   ├── globals.css        # 全局样式
│   ├── layout.tsx         # 根布局
│   └── page.tsx           # 首页
├── components/            # 共享组件
│   ├── ui/                # 基础UI组件
│   ├── forms/             # 表单组件
│   └── layout/            # 布局组件
├── hooks/                 # 自定义Hooks
├── lib/                   # 工具库
├── store/                 # 状态管理
├── types/                 # TypeScript类型定义
└── utils/                 # 工具函数
```

### 后端结构 (backend/)

```
backend/
├── src/
│   ├── controllers/       # 控制器层
│   ├── middleware/        # 中间件
│   ├── routes/           # 路由定义
│   ├── services/         # 业务逻辑层
│   ├── utils/            # 工具函数
│   └── index.ts          # 应用入口
├── prisma/
│   └── schema.prisma     # 数据库Schema
├── uploads/              # 文件上传目录
└── logs/                 # 日志文件
```

## 🛠️ 开发工作流

### 1. 功能开发流程

```bash
# 1. 创建功能分支
git checkout -b feature/new-feature

# 2. 开发和测试
# 编写代码...

# 3. 运行测试
./scripts/test.sh

# 4. 提交代码
git add .
git commit -m "feat: add new feature"

# 5. 推送并创建PR
git push origin feature/new-feature
```

### 2. 数据库开发

```bash
# 修改schema
vim backend/prisma/schema.prisma

# 生成迁移
cd backend
npx prisma migrate dev --name "add_new_table"

# 生成客户端
pnpm db:generate

# 重置数据库(开发环境)
pnpm db:reset
```

### 3. API开发

#### 创建新的API端点

```typescript
// backend/src/routes/example.ts
import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// 请求验证Schema
const createExampleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

// GET /api/examples
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    
    const examples = await prisma.example.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ examples });
  } catch (error) {
    console.error('Get examples error:', error);
    res.status(500).json({ error: 'Failed to get examples' });
  }
});

// POST /api/examples
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const data = createExampleSchema.parse(req.body);
    const userId = req.user!.id;

    const example = await prisma.example.create({
      data: {
        ...data,
        userId,
      },
    });

    res.status(201).json({ example });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: error.errors 
      });
    }
    
    console.error('Create example error:', error);
    res.status(500).json({ error: 'Failed to create example' });
  }
});

export default router;
```

#### 注册路由

```typescript
// backend/src/index.ts
import exampleRoutes from './routes/example';

app.use('/api/examples', exampleRoutes);
```

### 4. 前端组件开发

#### 创建页面组件

```tsx
// frontend/app/examples/page.tsx
"use client";

import { useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/protected-route";
import { Navbar } from "@/components/navbar";
import { ExampleCard } from "@/components/example-card";
import { useExamples } from "@/hooks/use-examples";

export default function ExamplesPage() {
  const { data: examples, isLoading, error } = useExamples();

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorMessage error={error} />;
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navbar />
        
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold">示例管理</h1>
            <CreateExampleButton />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {examples?.map((example) => (
              <ExampleCard key={example.id} example={example} />
            ))}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
```

#### 创建自定义Hook

```tsx
// frontend/hooks/use-examples.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

export function useExamples() {
  return useQuery({
    queryKey: ['examples'],
    queryFn: async () => {
      const response = await axios.get('/api/examples');
      return response.data.examples;
    },
  });
}

export function useCreateExample() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreateExampleData) => {
      const response = await axios.post('/api/examples', data);
      return response.data.example;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['examples'] });
    },
  });
}
```

## 🧪 测试开发

### 后端测试

```typescript
// backend/src/__tests__/routes/examples.test.ts
import request from 'supertest';
import { app } from '../../index';
import { prisma } from '../../index';

describe('Examples API', () => {
  let authToken: string;

  beforeAll(async () => {
    // 设置测试用户和token
    authToken = 'test-jwt-token';
  });

  afterAll(async () => {
    // 清理测试数据
    await prisma.example.deleteMany();
  });

  describe('GET /api/examples', () => {
    it('should return user examples', async () => {
      const response = await request(app)
        .get('/api/examples')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('examples');
      expect(Array.isArray(response.body.examples)).toBe(true);
    });
  });

  describe('POST /api/examples', () => {
    it('should create a new example', async () => {
      const exampleData = {
        name: 'Test Example',
        description: 'Test Description',
      };

      const response = await request(app)
        .post('/api/examples')
        .set('Authorization', `Bearer ${authToken}`)
        .send(exampleData)
        .expect(201);

      expect(response.body.example).toMatchObject(exampleData);
    });
  });
});
```

### 前端测试

```tsx
// frontend/__tests__/components/example-card.test.tsx
import { render, screen } from '@testing-library/react';
import { ExampleCard } from '@/components/example-card';

describe('ExampleCard', () => {
  const mockExample = {
    id: '1',
    name: 'Test Example',
    description: 'Test Description',
    createdAt: '2024-01-01T00:00:00.000Z',
  };

  it('should render example information', () => {
    render(<ExampleCard example={mockExample} />);
    
    expect(screen.getByText('Test Example')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
  });
});
```

## 📏 代码规范

### TypeScript规范

```typescript
// 接口定义
interface User {
  id: string;
  username: string;
  email?: string;
}

// 类型定义
type UserStatus = 'active' | 'inactive' | 'pending';

// 函数定义
async function getUserById(id: string): Promise<User | null> {
  // 实现...
}

// 组件Props类型
interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  onClick?: () => void;
}
```

### 命名规范

```typescript
// 文件命名
user-service.ts         // kebab-case
UserCard.tsx           // PascalCase (组件)
useUserData.ts         // camelCase (hooks)

// 变量命名
const userName = 'john';           // camelCase
const MAX_RETRY_COUNT = 3;         // SCREAMING_SNAKE_CASE (常量)

// 函数命名
function getUserData() {}          // camelCase
function handleUserClick() {}      // handle + 事件名

// 组件命名
function UserCard() {}             // PascalCase
const UserList = () => {};         // PascalCase
```

### 提交信息规范

```bash
# 格式: type(scope): description

feat: add user authentication
fix: resolve database connection issue
docs: update API documentation
style: format code with prettier
refactor: restructure user service
test: add unit tests for user API
chore: update dependencies
```

## 🔧 开发工具

### 调试工具

#### 前端调试

```typescript
// 环境变量检查
console.log('Environment:', process.env.NODE_ENV);
console.log('API URL:', process.env.NEXT_PUBLIC_API_URL);

// React DevTools
// Chrome扩展: React Developer Tools

// TanStack Query DevTools
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

function App() {
  return (
    <>
      <MyApp />
      <ReactQueryDevtools initialIsOpen={false} />
    </>
  );
}
```

#### 后端调试

```typescript
// 日志调试
import { logger } from '../utils/logger';

logger.info('User created', { userId: user.id });
logger.error('Database error', { error: error.message });

// 请求调试
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, req.body);
  next();
});

// VS Code调试配置
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Backend",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/backend/src/index.ts",
      "runtimeArgs": ["-r", "ts-node/register"],
      "env": {
        "NODE_ENV": "development"
      }
    }
  ]
}
```

### 数据库工具

```bash
# Prisma Studio
cd backend
pnpm db:studio

# 数据库查看
sqlite3 backend/muses.db
.tables
.schema User
SELECT * FROM User LIMIT 10;
```

## 🚨 常见问题解决

### 1. 端口占用

```bash
# 查找占用端口的进程
lsof -i :3000
lsof -i :8080

# 杀死进程
kill -9 <PID>

# 或者停止所有相关进程
./scripts/stop.sh
```

### 2. 数据库问题

```bash
# 数据库锁定
rm backend/muses.db
cd backend && pnpm db:push

# Prisma客户端版本不匹配
cd backend
pnpm db:generate
```

### 3. 依赖问题

```bash
# 清理node_modules
rm -rf frontend/node_modules backend/node_modules
rm frontend/pnpm-lock.yaml backend/pnpm-lock.yaml

# 重新安装
./scripts/setup.sh
```

### 4. TypeScript错误

```bash
# 重新生成类型
cd frontend && pnpm type-check
cd backend && npx tsc --noEmit

# 清理构建缓存
rm -rf frontend/.next backend/dist
```

## 📈 性能优化

### 前端优化

```typescript
// 组件懒加载
const LazyComponent = lazy(() => import('./HeavyComponent'));

// 图片优化
import Image from 'next/image';

<Image
  src="/image.jpg"
  width={500}
  height={300}
  alt="Description"
  priority // 关键图片预加载
/>

// 状态优化
const memoizedValue = useMemo(() => {
  return expensiveCalculation(data);
}, [data]);

// 回调优化
const handleClick = useCallback(() => {
  onAction(id);
}, [id, onAction]);
```

### 后端优化

```typescript
// 数据库查询优化
const users = await prisma.user.findMany({
  select: {
    id: true,
    username: true,
    // 只选择需要的字段
  },
  where: {
    active: true,
  },
  orderBy: {
    createdAt: 'desc',
  },
  take: 10, // 限制结果数量
});

// 缓存使用
import { cache } from '../utils/cache';

const cacheKey = `user:${userId}`;
let user = cache.get(cacheKey);

if (!user) {
  user = await prisma.user.findUnique({ where: { id: userId } });
  cache.set(cacheKey, user, 300); // 缓存5分钟
}
```

## 🔄 代码审查清单

### 通用检查
- [ ] 代码符合项目规范
- [ ] 没有console.log或调试代码
- [ ] 错误处理完善
- [ ] 类型定义正确
- [ ] 性能考虑合理

### 前端检查
- [ ] 组件可复用性
- [ ] 状态管理合理
- [ ] 无内存泄漏
- [ ] 响应式设计
- [ ] 无障碍性考虑

### 后端检查
- [ ] API设计RESTful
- [ ] 数据验证完整
- [ ] 权限检查到位
- [ ] 数据库操作安全
- [ ] 日志记录充分

## 📚 学习资源

### 技术文档
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Zustand Guide](https://github.com/pmndrs/zustand)

### 最佳实践
- [React Best Practices](https://react.dev/learn)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

### 项目参考
- [Next.js Examples](https://github.com/vercel/next.js/tree/canary/examples)
- [Shadcn/ui Examples](https://ui.shadcn.com/examples) 