# Muses 快速启动指南

> 🚀 从零到运行，30分钟搞定Muses智能文档生成平台

## 📋 准备工作清单

### 必需软件
- [ ] **Node.js** >= 18.0.0 [下载地址](https://nodejs.org/)
- [ ] **npm** (Node.js自带)
- [ ] **Git** 最新版本
- [ ] **VS Code** (推荐编辑器)

### 必需账号
- [ ] **GitHub账号** (用于OAuth登录)
- [ ] **OpenAI账号** (用于AI文档生成)

### 检查环境

```bash
# 检查Node.js版本
node --version
# 应该显示 v18.0.0 或更高版本

# 检查npm
npm --version
# Node.js自带npm，无需额外安装

# 检查Git
git --version
```

## 🔧 第一步：克隆项目

```bash
# 克隆项目到本地
git clone https://github.com/Rain1601/Muses.git
cd Muses

# 查看项目结构
ls -la
```

**期望结果**：看到以下目录结构
```
├── .cursor/          # 项目文档
├── backend/          # 后端代码
├── frontend/         # 前端代码
├── scripts/          # 管理脚本
└── README.md
```

## ⚙️ 第二步：一键初始化

```bash
# 运行自动化初始化脚本
./scripts/setup.sh
```

**脚本会自动完成**：
- ✅ 安装前端依赖 (frontend/node_modules)
- ✅ 安装后端依赖 (backend/node_modules)
- ✅ 生成Prisma数据库客户端
- ✅ 创建SQLite数据库
- ✅ 复制环境变量模板文件

**如果出现权限错误**：
```bash
chmod +x scripts/*.sh
./scripts/setup.sh
```

## 🔑 第三步：配置GitHub OAuth

### 3.1 创建GitHub OAuth应用

1. 访问 [GitHub Developer Settings](https://github.com/settings/developers)
2. 点击 "New OAuth App"
3. 填写应用信息：
   ```
   Application name: Muses Local Dev
   Homepage URL: http://localhost:3004
   Authorization callback URL: http://localhost:8080/api/auth/github/callback
   ```
4. 点击 "Register application"
5. 记录 `Client ID` 和 `Client Secret`

### 3.2 配置环境变量

```bash
# 编辑后端环境变量
vim backend/.env
# 或使用VS Code: code backend/.env
```

**填写以下内容**：
```env
# 应用配置
NODE_ENV=development
PORT=8080
FRONTEND_URL=http://localhost:3004

# 数据库配置
DATABASE_URL="file:./muses.db"

# JWT配置 (生成随机密钥)
JWT_SECRET=your_super_secret_jwt_key_here_please_change_this_to_random_string
JWT_EXPIRES_IN=7d

# GitHub OAuth配置 (替换为你的真实值)
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here
GITHUB_CALLBACK_URL=http://localhost:8080/api/auth/github/callback

# 文件上传配置
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads

# 数据加密 (生成32位随机字符串)
ENCRYPTION_KEY=your_32_character_encryption_key_here12345

# 限流配置
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

**⚠️ 重要提示**：
- `JWT_SECRET`: 生成强随机字符串，如：`openssl rand -base64 32`
- `ENCRYPTION_KEY`: 必须是32位字符串
- `GITHUB_CLIENT_ID` 和 `GITHUB_CLIENT_SECRET`: 替换为步骤3.1中获取的值

## 🚀 第四步：启动服务

### 方式一：自动启动（推荐）
```bash
# 同时启动前后端
./scripts/start.sh
```

### 方式二：开发模式（独立终端）
```bash
# 在两个独立终端窗口启动
./scripts/dev.sh
```

### 方式三：手动启动
```bash
# 终端1：启动后端
cd backend
npm run dev

# 终端2：启动前端
cd frontend
npm run dev
```

**期望结果**：
```
✅ 后端服务启动成功 (端口 8080)
✅ 前端服务启动成功 (端口 3000)
```

## 🧪 第五步：验证测试

### 5.1 基础连通性测试

```bash
# 测试后端API健康检查
curl http://localhost:8080/api/health
# 期望返回: {"status":"ok","timestamp":"..."}

# 测试前端页面
open http://localhost:3004
# 或在浏览器访问 http://localhost:3004
```

### 5.2 功能测试流程

1. **访问首页**
   - 打开 http://localhost:3004
   - 应该看到Muses登录页面

2. **测试GitHub登录**
   - 点击 "使用 GitHub 登录"
   - 跳转到GitHub授权页面
   - 点击 "Authorize" 授权
   - 成功后跳转到新用户引导页面

3. **配置OpenAI API Key**
   - 在引导页面输入OpenAI API Key
   - 设置默认GitHub仓库（可选）
   - 完成配置后进入工作台

4. **测试文档生成**
   - 在工作台点击 "新建文章"
   - 输入测试素材或上传文件
   - 选择或创建Agent
   - 点击 "生成文章"

## 🎯 配置OpenAI API Key

### 获取API Key
1. 访问 [OpenAI Platform](https://platform.openai.com/api-keys)
2. 登录你的OpenAI账号
3. 点击 "Create new secret key"
4. 复制生成的API Key（形如：sk-...）

### 在应用中配置
1. 启动Muses并完成GitHub登录
2. 在用户引导页面输入API Key
3. 或在设置页面更新API Key

## 🛠️ 常见问题解决

### 问题1：端口被占用
```bash
# 查找占用进程
lsof -i :3000
lsof -i :8080

# 杀死进程
kill -9 <进程ID>

# 或停止所有相关服务
./scripts/stop.sh
```

### 问题2：数据库问题
```bash
# 重置数据库
cd backend
rm -f muses.db
npm run db:push
```

### 问题3：依赖安装失败
```bash
# 清理并重新安装
rm -rf frontend/node_modules backend/node_modules
rm frontend/pnpm-lock.yaml backend/pnpm-lock.yaml
./scripts/setup.sh
```

### 问题4：GitHub OAuth回调错误
- 检查GitHub应用配置中的回调URL是否正确
- 确保环境变量中的GITHUB_CLIENT_ID和SECRET正确
- 确认端口8080可以正常访问

### 问题5：OpenAI API调用失败
- 检查API Key是否有效且有余额
- 确认网络可以访问OpenAI API
- 查看后端日志获取详细错误信息

## 🎉 成功标志

当你看到以下界面时，说明配置成功：

1. **首页** - 显示Muses登录界面
2. **登录后** - 进入用户引导或工作台
3. **工作台** - 显示快捷操作和最近文章
4. **生成测试** - 能够成功调用OpenAI生成文章

## 📚 下一步操作

✅ **基础配置完成后，你可以**：

1. **创建第一个Agent**
   - 访问 Agent管理页面
   - 配置个性化写作风格
   - 设置目标读者和语气

2. **生成第一篇文章**
   - 准备一些素材（文本、文档等）
   - 使用Agent生成文章
   - 编辑和优化内容

3. **发布到GitHub**
   - 配置目标仓库
   - 一键发布生成的文章

4. **探索高级功能**
   - 对话式生成
   - 批量处理
   - 自定义提示词

## 🔧 开发者选项

### 启用开发者工具
```bash
# 启动数据库管理界面
cd backend
npm run db:studio
# 访问 http://localhost:5555

# 查看实时日志
tail -f backend/logs/app.log
```

### 代码检查
```bash
# 运行完整测试
./scripts/test.sh

# TypeScript类型检查
cd frontend && npm run type-check
cd backend && npx tsc --noEmit
```

---

🎊 **恭喜！** 你已经成功配置并启动了Muses智能文档生成平台。

有问题？查看详细文档：
- [API文档](.cursor/api.md)
- [开发指南](.cursor/development.md) 
- [部署指南](.cursor/deployment.md) 