# 数据库设计文档

## 🗄️ 数据库概览

- **数据库类型**: SQLite3
- **ORM**: Prisma
- **文件位置**: `backend/muses.db`
- **Schema文件**: `backend/prisma/schema.prisma`

## 📊 数据模型设计

### User (用户表)

用户基础信息和第三方账号关联

```sql
CREATE TABLE User (
    id              TEXT PRIMARY KEY,           -- CUID主键
    githubId        TEXT UNIQUE NOT NULL,       -- GitHub用户ID
    username        TEXT NOT NULL,              -- GitHub用户名
    email           TEXT,                       -- 邮箱地址
    avatarUrl       TEXT,                       -- 头像URL
    openaiKey       TEXT,                       -- 加密存储的OpenAI API Key
    githubToken     TEXT,                       -- 加密存储的GitHub Token
    defaultRepoUrl  TEXT,                       -- 默认发布仓库URL
    createdAt       DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt       DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**关键字段说明**:
- `githubId`: GitHub OAuth登录后获取的唯一标识
- `openaiKey`: 使用AES加密存储，用于调用OpenAI API
- `githubToken`: 用于访问用户GitHub仓库的Token
- `defaultRepoUrl`: 用户设置的默认发布目标仓库

### UserSettings (用户设置表)

用户个性化配置信息

```sql
CREATE TABLE UserSettings (
    id          TEXT PRIMARY KEY,
    userId      TEXT UNIQUE NOT NULL,           -- 关联User.id
    language    TEXT DEFAULT 'zh-CN',           -- 界面语言
    theme       TEXT DEFAULT 'light',           -- 主题设置
    autoSave    BOOLEAN DEFAULT true,           -- 自动保存开关
    createdAt   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt   DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
);
```

### Agent (AI助手表)

自定义AI写作助手的配置信息

```sql
CREATE TABLE Agent (
    id                  TEXT PRIMARY KEY,
    userId              TEXT NOT NULL,              -- 关联User.id
    name                TEXT NOT NULL,              -- Agent名称
    description         TEXT,                       -- Agent描述
    avatar              TEXT,                       -- 头像emoji或图片
    
    -- 写作风格配置
    language            TEXT DEFAULT 'zh-CN',       -- 写作语言
    tone                TEXT DEFAULT 'professional', -- 语气风格
    lengthPreference    TEXT DEFAULT 'medium',      -- 篇幅偏好
    targetAudience      TEXT,                       -- 目标读者
    
    -- 高级配置
    customPrompt        TEXT,                       -- 自定义提示词
    outputFormat        TEXT DEFAULT 'markdown',    -- 输出格式
    specialRules        JSON,                       -- 特殊规则(JSON格式)
    
    isDefault           BOOLEAN DEFAULT false,      -- 是否为默认Agent
    createdAt           DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt           DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
);
```

**枚举值定义**:
- `tone`: professional | casual | humorous | serious
- `lengthPreference`: short | medium | long  
- `outputFormat`: markdown | mdx

**specialRules JSON结构示例**:
```json
{
  "maxTokens": 4000,
  "temperature": 0.7,
  "customInstructions": ["添加代码示例", "包含实践建议"],
  "avoidTopics": ["政治", "宗教"]
}
```

### Article (文章表)

生成的文章内容和元数据

```sql
CREATE TABLE Article (
    id              TEXT PRIMARY KEY,
    userId          TEXT NOT NULL,              -- 关联User.id
    agentId         TEXT NOT NULL,              -- 关联Agent.id
    
    title           TEXT NOT NULL,              -- 文章标题
    content         TEXT NOT NULL,              -- Markdown内容
    summary         TEXT,                       -- 文章摘要
    
    -- 发布状态
    publishStatus   TEXT DEFAULT 'draft',       -- 发布状态
    publishedAt     DATETIME,                   -- 发布时间
    githubUrl       TEXT,                       -- GitHub发布URL
    repoPath        TEXT,                       -- 仓库中的文件路径
    
    -- 元数据
    sourceFiles     JSON,                       -- 原始素材文件信息
    metadata        JSON,                       -- 其他元数据
    
    createdAt       DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt       DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE,
    FOREIGN KEY (agentId) REFERENCES Agent(id)
);
```

**publishStatus枚举**: draft | published | scheduled

**sourceFiles JSON结构示例**:
```json
{
  "materials": "原始素材文本",
  "uploadedFiles": [
    {
      "originalName": "document.pdf",
      "size": 1024000,
      "type": ".pdf",
      "parsedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**metadata JSON结构示例**:
```json
{
  "chatHistory": [...],           // 对话式生成的聊天记录
  "generationParams": {           // 生成参数
    "temperature": 0.7,
    "maxTokens": 4000
  },
  "wordCount": 1500,              // 字数统计
  "estimatedReadTime": "5分钟"     // 预估阅读时间
}
```

## 🔗 关系设计

### 主要关联关系

```
User (1) ←→ (N) Agent          # 一个用户可以有多个Agent
User (1) ←→ (1) UserSettings   # 一对一用户设置
User (1) ←→ (N) Article        # 一个用户可以有多篇文章
Agent (1) ←→ (N) Article       # 一个Agent可以生成多篇文章
```

### 级联删除策略

- **删除用户**: 自动删除其所有Agent、Article和UserSettings
- **删除Agent**: 不删除关联的Article，保留历史记录
- **删除文章**: 仅删除文章本身

## 📝 索引设计

### 性能优化索引

```sql
-- 用户查询优化
CREATE INDEX idx_user_githubId ON User(githubId);

-- Agent查询优化  
CREATE INDEX idx_agent_userId_default ON Agent(userId, isDefault);
CREATE INDEX idx_agent_userId_created ON Agent(userId, createdAt DESC);

-- 文章查询优化
CREATE INDEX idx_article_userId_status ON Article(userId, publishStatus);
CREATE INDEX idx_article_userId_created ON Article(userId, createdAt DESC);
CREATE INDEX idx_article_agentId ON Article(agentId);
```

## 🔐 数据安全

### 敏感数据加密

使用AES-256-GCM算法加密存储：
- `User.openaiKey`: OpenAI API密钥
- `User.githubToken`: GitHub访问令牌

### 数据隔离

- **用户隔离**: 所有数据通过userId进行隔离
- **权限验证**: API层面验证用户只能访问自己的数据
- **JWT认证**: 所有请求都需要有效的JWT令牌

## 🚀 数据库操作

### 常用Prisma命令

```bash
# 生成Prisma客户端
pnpm db:generate

# 同步数据库结构
pnpm db:push

# 启动数据库管理界面
pnpm db:studio

# 重置数据库
pnpm db:reset
```

### 数据库迁移

```bash
# 创建新迁移
npx prisma migrate dev --name "migration_name"

# 应用迁移到生产环境
npx prisma migrate deploy
```

## 📊 数据统计查询

### 用户数据统计

```sql
-- 用户文章数量统计
SELECT 
    u.username,
    COUNT(a.id) as articleCount,
    COUNT(CASE WHEN a.publishStatus = 'published' THEN 1 END) as publishedCount
FROM User u
LEFT JOIN Article a ON u.id = a.userId
GROUP BY u.id;

-- Agent使用频率统计
SELECT 
    ag.name,
    COUNT(ar.id) as usageCount
FROM Agent ag
LEFT JOIN Article ar ON ag.id = ar.agentId
GROUP BY ag.id
ORDER BY usageCount DESC;
```

## 🔧 维护建议

### 定期清理

1. **清理过期的临时文件**: 定期删除上传目录中的孤立文件
2. **数据库备份**: 定期备份SQLite数据库文件
3. **日志轮转**: 清理过旧的应用日志

### 性能监控

1. **慢查询监控**: 监控耗时较长的数据库查询
2. **存储空间**: 监控数据库文件大小增长
3. **并发连接**: 监控数据库连接数使用情况 