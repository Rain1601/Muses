# 贡献指南

感谢你对 Muses 项目的关注！我们欢迎各种形式的贡献。

## 如何贡献

### 报告问题

1. 在 [Issues](https://github.com/yourusername/muses/issues) 页面搜索是否已有相似问题
2. 如果没有，创建新的 Issue
3. 使用清晰的标题和描述
4. 提供重现步骤和环境信息

### 提交代码

1. Fork 项目到你的账号
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 开发环境设置

```bash
# 1. 克隆仓库
git clone https://github.com/yourusername/muses.git
cd muses

# 2. 安装依赖
./scripts/setup.sh

# 3. 配置环境变量
cp backend/.env.example backend/.env
# 编辑 .env 文件

# 4. 启动开发环境
./scripts/dev.sh
```

## 代码规范

### TypeScript 规范

- 使用严格模式
- 明确类型定义
- 避免 any 类型
- 使用接口定义数据结构

### 命名规范

- 文件名：kebab-case
- 组件名：PascalCase
- 函数名：camelCase
- 常量名：UPPER_SNAKE_CASE

### Git 提交规范

使用语义化提交信息：

```
feat: 添加新功能
fix: 修复问题
docs: 文档更新
style: 代码格式调整
refactor: 代码重构
test: 测试相关
chore: 构建/工具相关
```

示例：
```
feat: 添加批量文章生成功能
fix: 修复登录重定向问题
docs: 更新 API 文档
```

## 项目结构

```
muses/
├── frontend/          # Next.js 前端
│   ├── app/          # 页面和路由
│   ├── components/   # React 组件
│   ├── lib/          # 工具函数
│   └── store/        # 状态管理
├── backend/          # Express 后端
│   ├── src/
│   │   ├── routes/   # API 路由
│   │   ├── services/ # 业务逻辑
│   │   ├── middleware/ # 中间件
│   │   └── utils/    # 工具函数
│   └── prisma/       # 数据库模型
└── docs/             # 文档
```

## 测试

运行测试：

```bash
# 类型检查
./scripts/test.sh

# 运行特定测试
cd frontend && pnpm test
cd backend && pnpm test
```

## 文档

- 代码中添加必要的注释
- 更新相关文档
- 提供使用示例

## 审查流程

1. 自动化检查（CI/CD）
2. 代码审查
3. 测试验证
4. 合并到主分支

## 社区准则

- 尊重所有贡献者
- 建设性的讨论
- 耐心解答问题
- 分享知识和经验

## 获取帮助

- 查看 [文档](./docs)
- 在 Issues 中提问
- 加入社区讨论

## 许可证

贡献的代码将遵循项目的 MIT 许可证。

再次感谢你的贡献！🎉