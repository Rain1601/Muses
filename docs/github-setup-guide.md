# GitHub仓库配置指南

## 快速开始

### 1. 创建专用仓库
为了更好地管理你的文章，建议创建一个专用的博客仓库：

```bash
# 推荐仓库名称
my-blog
my-articles  
personal-blog
tech-blog
```

### 2. 仓库结构建议

```
your-blog-repo/
├── posts/           # 文章目录
│   ├── 2024/
│   │   ├── 01/
│   │   ├── 02/
│   │   └── ...
│   └── 2023/
├── drafts/          # 草稿目录
├── assets/          # 图片等资源
├── README.md        # 仓库说明
└── .gitignore       # Git忽略文件
```

### 3. 权限说明

Muses使用GitHub OAuth认证，具有以下权限：
- ✅ 读取你的仓库列表
- ✅ 创建和更新文件
- ✅ 提交代码到仓库

**安全提示**：
- Token加密存储，不会泄露
- 只能访问你账号下的仓库
- 可以随时在GitHub设置中撤销权限

### 4. 推荐设置

#### 创建新仓库时：
1. 仓库名称：`my-blog`
2. 可见性：Public（如果想让别人看到）或Private
3. 初始化：✅ 添加README文件
4. .gitignore：无需选择
5. License：可选（如MIT）

#### 默认分支：
- 确保使用`main`分支（GitHub默认）
- Muses目前只支持推送到main分支

### 5. 高级配置（可选）

如需更精确的权限控制，可以使用Personal Access Token：

1. GitHub Settings → Developer settings → Personal access tokens
2. 创建新token，权限选择：
   - `repo` (仓库完整权限)
   - `user:email` (读取邮箱)
3. 在Muses设置中配置token

### 6. 常见问题

**Q: 我可以推送到组织仓库吗？**
A: 可以，只要你有该仓库的写入权限

**Q: 支持推送到其他分支吗？**  
A: 目前只支持main分支，计划后续支持分支选择

**Q: 文件会覆盖已有内容吗？**
A: 是的，相同路径的文件会被覆盖，建议使用时间戳命名

**Q: 如何撤销权限？**
A: GitHub Settings → Applications → Authorized OAuth Apps → 撤销Muses权限