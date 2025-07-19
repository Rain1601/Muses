# 前端架构文档

## 🏗️ 架构概览

Muses前端采用Next.js 14的App Router架构，配合TypeScript和现代React生态系统，打造高性能的用户界面。

## 📦 技术栈详解

### 核心框架
- **Next.js 14**: 基于App Router的React全栈框架
- **TypeScript**: 类型安全的JavaScript超集
- **React 18**: 支持并发特性的用户界面库

### 样式系统
- **Tailwind CSS**: 原子化CSS框架
- **Shadcn/ui**: 基于Radix UI的组件库
- **CVA**: 组件变体管理
- **clsx**: 条件类名组合工具

### 状态管理
- **Zustand**: 轻量级状态管理库
- **TanStack Query**: 服务端状态管理和缓存

### 工具库
- **Axios**: HTTP客户端
- **React Hook Form**: 表单状态管理
- **React Markdown**: Markdown渲染
- **Zod**: 运行时类型验证

## 📁 目录结构详解

```
frontend/
├── app/                    # Next.js App Router
│   ├── globals.css        # 全局样式
│   ├── layout.tsx         # 根布局组件
│   ├── page.tsx           # 首页
│   ├── agents/            # Agent管理页面
│   │   ├── page.tsx       # Agent列表
│   │   ├── new/           # 创建Agent
│   │   └── [id]/          # Agent详情/编辑
│   ├── articles/          # 文章管理页面
│   │   ├── page.tsx       # 文章列表
│   │   ├── new/           # 创建文章
│   │   └── [id]/          # 文章详情/编辑
│   ├── dashboard/         # 工作台
│   ├── onboarding/        # 用户引导
│   └── settings/          # 设置页面
├── components/            # 可复用组件
│   ├── navbar.tsx        # 导航栏
│   ├── protected-route.tsx # 路由保护
│   └── providers.tsx     # 上下文提供者
├── lib/                   # 工具库
│   └── auth.ts           # 认证相关工具
├── store/                 # 状态管理
│   └── user.ts           # 用户状态
├── next.config.js         # Next.js配置
├── tailwind.config.ts     # Tailwind配置
└── tsconfig.json         # TypeScript配置
```

## 🎯 页面架构

### 路由设计

| 路径 | 组件 | 功能 |
|------|------|------|
| `/` | `app/page.tsx` | 首页/登录页 |
| `/dashboard` | `app/dashboard/page.tsx` | 用户工作台 |
| `/onboarding` | `app/onboarding/page.tsx` | 新用户引导 |
| `/agents` | `app/agents/page.tsx` | Agent列表 |
| `/agents/new` | `app/agents/new/page.tsx` | 创建Agent |
| `/agents/[id]/edit` | `app/agents/[id]/edit/page.tsx` | 编辑Agent |
| `/articles` | `app/articles/page.tsx` | 文章列表 |
| `/articles/new` | `app/articles/new/page.tsx` | 创建文章 |
| `/articles/[id]/edit` | `app/articles/[id]/edit/page.tsx` | 编辑文章 |
| `/articles/[id]/publish` | `app/articles/[id]/publish/page.tsx` | 发布文章 |
| `/settings` | `app/settings/page.tsx` | 用户设置 |

### 页面组件结构

```tsx
// 典型页面组件结构
export default function PageComponent() {
  return (
    <ProtectedRoute>          {/* 路由保护 */}
      <div className="min-h-screen bg-background">
        <Navbar />            {/* 导航栏 */}
        <main className="container mx-auto px-4 py-8">
          {/* 页面内容 */}
        </main>
      </div>
    </ProtectedRoute>
  );
}
```

## 🔧 核心组件

### 1. ProtectedRoute (路由保护)

```tsx
// components/protected-route.tsx
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, checkAuth } = useUserStore();
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) return <LoadingSpinner />;
  
  if (!user) {
    router.push('/');
    return null;
  }

  return <>{children}</>;
}
```

**功能**:
- 检查用户认证状态
- 未认证用户重定向到登录页
- 显示加载状态

### 2. Navbar (导航栏)

```tsx
// components/navbar.tsx
export function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useUserStore();

  const navItems = [
    { href: "/dashboard", label: "工作台" },
    { href: "/agents", label: "Agent管理" },
    { href: "/articles", label: "文章列表" },
    { href: "/settings", label: "设置" },
  ];

  return (
    <header className="border-b bg-background">
      {/* 导航内容 */}
    </header>
  );
}
```

**功能**:
- 响应式导航菜单
- 当前页面高亮
- 用户信息显示
- 登出功能

### 3. Providers (上下文提供者)

```tsx
// components/providers.tsx
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        cacheTime: 10 * 60 * 1000,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

## 🗃️ 状态管理

### Zustand User Store

```tsx
// store/user.ts
interface UserState {
  user: User | null;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  isLoading: true,
  
  login: () => {
    window.location.href = '/api/auth/github';
  },
  
  logout: async () => {
    await auth.logout();
    set({ user: null });
  },
  
  checkAuth: async () => {
    try {
      const user = await auth.getUser();
      set({ user, isLoading: false });
    } catch {
      set({ user: null, isLoading: false });
    }
  },
  
  setUser: (user) => set({ user }),
}));
```

**特点**:
- 简洁的API设计
- 类型安全
- 自动持久化
- 响应式更新

## 🎨 样式系统

### Tailwind配置

```js
// tailwind.config.ts
module.exports = {
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        // 更多自定义颜色...
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
```

### CSS变量系统

```css
/* app/globals.css */
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;
  --primary-foreground: 210 40% 98%;
  /* 更多CSS变量... */
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* 暗色主题变量... */
}
```

## 📡 数据流管理

### API调用模式

```tsx
// 使用自定义Hook的模式
function useArticles() {
  return useQuery({
    queryKey: ['articles'],
    queryFn: async () => {
      const response = await axios.get('/api/articles');
      return response.data.articles;
    },
  });
}

// 在组件中使用
function ArticlesPage() {
  const { data: articles, isLoading, error } = useArticles();
  
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  
  return (
    <div>
      {articles.map(article => (
        <ArticleCard key={article.id} article={article} />
      ))}
    </div>
  );
}
```

### 表单处理模式

```tsx
// 使用React Hook Form
function CreateAgentForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<AgentFormData>({
    resolver: zodResolver(agentSchema),
  });

  const onSubmit = async (data: AgentFormData) => {
    try {
      await axios.post('/api/agents', data);
      router.push('/agents');
    } catch (error) {
      // 错误处理
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input 
        {...register('name')} 
        placeholder="Agent名称"
      />
      {errors.name && <span>{errors.name.message}</span>}
      {/* 更多表单字段... */}
    </form>
  );
}
```

## 🔄 组件复用模式

### 复合组件模式

```tsx
// Card组件系统
const Card = ({ children, className, ...props }) => (
  <div className={cn("rounded-lg border bg-card", className)} {...props}>
    {children}
  </div>
);

const CardHeader = ({ children, className, ...props }) => (
  <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props}>
    {children}
  </div>
);

const CardContent = ({ children, className, ...props }) => (
  <div className={cn("p-6 pt-0", className)} {...props}>
    {children}
  </div>
);

// 使用示例
<Card>
  <CardHeader>
    <CardTitle>Agent配置</CardTitle>
  </CardHeader>
  <CardContent>
    <AgentForm />
  </CardContent>
</Card>
```

## 🚀 性能优化

### 代码分割

```tsx
// 动态导入大型组件
const MarkdownEditor = dynamic(() => import('@/components/markdown-editor'), {
  loading: () => <EditorSkeleton />,
  ssr: false,
});
```

### 图片优化

```tsx
// 使用Next.js Image组件
import Image from 'next/image';

<Image
  src={user.avatarUrl}
  alt={`${user.username}的头像`}
  width={40}
  height={40}
  className="rounded-full"
/>
```

### 缓存策略

```tsx
// TanStack Query缓存配置
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,    // 5分钟内不重新请求
      cacheTime: 10 * 60 * 1000,   // 10分钟后清除缓存
      retry: 1,                    // 失败重试1次
    },
  },
});
```

## 🧪 开发指南

### 开发环境启动

```bash
cd frontend
pnpm dev
```

### 代码规范

```bash
# 类型检查
pnpm type-check

# 代码格式化
pnpm lint

# 构建检查
pnpm build
```

### 调试技巧

1. **React DevTools**: 检查组件状态和Props
2. **TanStack Query DevTools**: 查看查询状态和缓存
3. **浏览器开发者工具**: 网络请求和性能分析

## 📱 响应式设计

### 断点系统

```css
/* Tailwind断点 */
sm: 640px    /* 小屏设备 */
md: 768px    /* 平板设备 */
lg: 1024px   /* 笔记本电脑 */
xl: 1280px   /* 台式机 */
2xl: 1536px  /* 大屏显示器 */
```

### 响应式组件示例

```tsx
<div className="
  grid 
  grid-cols-1 
  md:grid-cols-2 
  lg:grid-cols-3 
  gap-4
">
  {/* 响应式网格布局 */}
</div>
```

## 🔮 未来规划

### 计划功能
- [ ] 主题切换系统
- [ ] 多语言国际化
- [ ] PWA支持
- [ ] 离线编辑功能
- [ ] 实时协作编辑
- [ ] 富文本编辑器

### 技术升级
- [ ] React 19特性集成
- [ ] Next.js 15升级
- [ ] 新的并发特性利用
- [ ] 性能监控集成 