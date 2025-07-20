# Muses 实操手册 (Cookbook)

> 🍳 30分钟从零搭建AI文档生成平台 - 亲测可用的操作流程

## 🏁 5分钟快速体验

```bash
# 1. 克隆并进入项目
git clone https://github.com/Rain1601/Muses.git && cd Muses

# 2. 一键初始化
./scripts/setup.sh

# 3. 配置环境变量 (编辑backend/.env文件)
cp backend/.env.example backend/.env

# 4. 启动服务
./scripts/start.sh
```

然后在浏览器访问 http://localhost:3000 🎉

## 📝 详细操作流程

### Step 1: 环境检查 (2分钟)

```bash
# 检查必要软件
node --version    # 需要 >= 18.0.0
npm --version     # 自带的npm即可
git --version
```

### Step 2: 项目初始化 (5分钟)

```bash
# 克隆项目
git clone https://github.com/Rain1601/Muses.git
cd Muses

# 执行初始化脚本
chmod +x scripts/*.sh  # 如果权限不足
./scripts/setup.sh

# 验证初始化结果
ls backend/node_modules frontend/node_modules
# 应该看到两个目录存在
```

### Step 3: GitHub OAuth配置 (10分钟)

#### 3.1 创建GitHub应用
1. 打开 https://github.com/settings/developers
2. 点击 "New OAuth App"
3. 填写信息：
   ```
   名称: Muses-Local
   首页: http://localhost:3000  
   回调: http://localhost:8080/api/auth/github/callback
   ```
4. 复制 Client ID 和 Client Secret

#### 3.2 配置环境变量

```bash
# 编辑配置文件
code backend/.env  # 或使用其他编辑器

# 必填项 (替换xxx为实际值)
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
JWT_SECRET=any_long_random_string_here_123456789
ENCRYPTION_KEY=must_be_exactly_32_characters_123

# 其他保持默认即可
```

### Step 4: 启动服务 (3分钟)

```bash
# 方式一：一键启动（同一终端）
./scripts/start.sh

# 方式二：分别启动（推荐开发时使用）
# 终端1:
cd backend && npm run dev

# 终端2:  
cd frontend && npm run dev
```

**成功标志**：
- 后端: 看到 "Server running on port 8080"
- 前端: 看到 "ready - started server on 0.0.0.0:3000"

### Step 5: 功能验证 (10分钟)

#### 5.1 基础测试
```bash
# 测试后端健康状态
curl http://localhost:8080/api/health
# 返回: {"status":"ok","timestamp":"..."}

# 访问前端
open http://localhost:3000
```

#### 5.2 完整流程测试

1. **登录测试**
   - 访问 http://localhost:3000
   - 点击 "使用 GitHub 登录"
   - 授权后回到引导页面 ✅

2. **配置OpenAI** 
   - 在引导页输入OpenAI API Key (sk-xxx)
   - 点击下一步进入工作台 ✅

3. **生成测试**
   - 点击 "新建文章"
   - 输入测试内容: "介绍一下JavaScript的async/await语法"
   - 选择Agent，点击 "生成文章"
   - 等待生成完成 ✅

## 🛠️ 常见问题一键解决

```bash
# 端口占用
./scripts/stop.sh && ./scripts/start.sh

# 依赖问题
rm -rf */node_modules */pnpm-lock.yaml && ./scripts/setup.sh

# 数据库问题  
cd backend && rm -f muses.db && npm run db:push

# 权限问题
chmod +x scripts/*.sh

# 查看日志
cd backend && npm run dev  # 查看详细错误信息
```

## 🎯 获取OpenAI API Key

### 方法一：官方申请
1. 访问 https://platform.openai.com/api-keys
2. 登录OpenAI账号
3. 点击 "Create new secret key"
4. 复制API Key (sk-开头)

### 方法二：测试用途
如果只是测试功能，可以：
1. 跳过OpenAI配置
2. 查看界面和其他功能
3. 文档生成会显示错误提示

## 📚 实用操作示例

### 创建你的第一个Agent

```markdown
名称: 技术博客助手
描述: 专门用于技术文章写作的AI助手
语气: 专业严谨
篇幅: 详细充分  
目标读者: 程序员和技术爱好者
自定义提示: 请包含代码示例和最佳实践建议
```

### 测试素材示例

```markdown
# 素材内容
今天学习了React Hooks，特别是useState和useEffect。
useState用于管理组件状态，useEffect用于处理副作用。
需要注意useEffect的依赖数组，避免无限循环。

# 额外要求  
请重点说明useState和useEffect的使用场景，
并提供实际的代码示例。
```

### 发布到GitHub示例

```markdown
仓库: https://github.com/yourname/blog
路径: posts/react-hooks-guide.md
提交信息: "添加React Hooks使用指南"
```

## 🔧 开发者工具

```bash
# 查看数据库
cd backend && npm run db:studio
# 访问 http://localhost:5555

# 实时日志
tail -f backend/logs/app.log

# 代码检查
./scripts/test.sh

# 构建生产版本
./scripts/build.sh
```

## 🚀 部署到服务器

```bash
# 构建项目
./scripts/build.sh

# 复制dist目录到服务器
scp -r dist/ user@server:/opt/muses/

# 服务器上启动
cd /opt/muses
pm2 start ecosystem.config.js
```

## 📱 项目结构速览

```
Muses/
├── frontend/           # React前端
│   ├── app/           # 页面组件
│   ├── components/    # 共享组件  
│   └── store/         # 状态管理
├── backend/           # Node.js后端
│   ├── src/routes/    # API路由
│   ├── src/services/  # 业务逻辑
│   └── prisma/        # 数据库配置
├── scripts/           # 管理脚本
│   ├── setup.sh      # 初始化
│   ├── start.sh      # 启动服务
│   └── build.sh      # 构建部署
└── .cursor/          # 项目文档
```

## 🎉 成功验收标准

当你能够完成以下操作时，说明配置成功：

- [ ] ✅ 前端页面正常显示
- [ ] ✅ GitHub登录正常工作  
- [ ] ✅ 用户引导页面可访问
- [ ] ✅ 工作台显示正常
- [ ] ✅ Agent创建功能正常
- [ ] ✅ 文章生成功能正常 (需要OpenAI Key)
- [ ] ✅ 文件上传功能正常
- [ ] ✅ 数据库存储正常

## 💡 实用小贴士

1. **开发时推荐**：使用 `./scripts/dev.sh` 在独立终端启动
2. **生产部署**：使用 `./scripts/build.sh` 构建优化版本  
3. **故障排查**：先运行 `./scripts/test.sh` 检查环境
4. **数据备份**：定期备份 `backend/muses.db` 文件
5. **安全配置**：生产环境务必修改所有默认密钥

---

🎊 **恭喜！** 按照以上步骤，你已经成功搭建了自己的AI文档生成平台！

💬 **遇到问题？** 查看 [详细文档](.cursor/QUICKSTART.md) 或 [开发指南](.cursor/development.md) 