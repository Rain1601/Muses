# API 接口文档

## 🔗 基础信息

- **基础URL**: `http://localhost:8080/api`
- **认证方式**: JWT Token (Bearer Token)
- **数据格式**: JSON

## 🔐 认证接口

### GitHub OAuth登录
```http
GET /auth/github
```
重定向到GitHub OAuth页面

### OAuth回调
```http
GET /auth/github/callback?code={code}
```
处理GitHub OAuth回调，返回JWT token

### 获取当前用户
```http
GET /auth/me
Authorization: Bearer {token}
```

**响应示例**:
```json
{
  "user": {
    "id": "user_id",
    "username": "github_username",
    "email": "user@example.com",
    "avatarUrl": "https://github.com/avatar.jpg"
  }
}
```

## 👤 用户管理

### 获取用户资料
```http
GET /user/profile
Authorization: Bearer {token}
```

### 更新用户设置
```http
POST /user/settings
Authorization: Bearer {token}
Content-Type: application/json

{
  "openaiKey": "sk-xxx",
  "defaultRepoUrl": "https://github.com/user/repo",
  "language": "zh-CN",
  "theme": "light"
}
```

## 🤖 Agent管理

### 获取用户的所有Agent
```http
GET /agents
Authorization: Bearer {token}
```

**响应示例**:
```json
{
  "agents": [
    {
      "id": "agent_id",
      "name": "技术博客助手",
      "description": "专门用于技术文章写作",
      "avatar": "🤖",
      "language": "zh-CN",
      "tone": "professional",
      "lengthPreference": "medium",
      "targetAudience": "程序员",
      "isDefault": true,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### 创建新Agent
```http
POST /agents
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Agent名称",
  "description": "Agent描述",
  "avatar": "🤖",
  "language": "zh-CN",
  "tone": "professional",
  "lengthPreference": "medium",
  "targetAudience": "目标读者",
  "customPrompt": "自定义提示词",
  "outputFormat": "markdown",
  "isDefault": false
}
```

### 更新Agent
```http
PUT /agents/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "更新后的名称",
  "tone": "casual"
}
```

### 删除Agent
```http
DELETE /agents/{id}
Authorization: Bearer {token}
```

## 📝 文章管理

### 获取用户文章列表
```http
GET /articles?page=1&limit=10&status=all
Authorization: Bearer {token}
```

**查询参数**:
- `page`: 页码 (默认: 1)
- `limit`: 每页数量 (默认: 10)
- `status`: 状态筛选 (draft|published|all)

### 获取单篇文章
```http
GET /articles/{id}
Authorization: Bearer {token}
```

### 更新文章
```http
PUT /articles/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "文章标题",
  "content": "Markdown内容",
  "summary": "文章摘要"
}
```

### 删除文章
```http
DELETE /articles/{id}
Authorization: Bearer {token}
```

## 🎯 文章生成

### 从素材生成文章
```http
POST /generate/article
Authorization: Bearer {token}
Content-Type: application/json

{
  "agentId": "agent_id",
  "materials": "素材内容",
  "title": "可选的标题",
  "requirements": "额外要求",
  "saveAsDraft": true
}
```

**响应示例**:
```json
{
  "success": true,
  "article": {
    "id": "article_id",
    "title": "生成的标题",
    "content": "# 生成的Markdown内容",
    "summary": "文章摘要"
  }
}
```

### 对话式生成
```http
POST /generate/chat
Authorization: Bearer {token}
Content-Type: application/json

{
  "agentId": "agent_id",
  "messages": [
    {
      "role": "user",
      "content": "用户消息"
    },
    {
      "role": "assistant",
      "content": "AI回复"
    }
  ],
  "saveAsDraft": false
}
```

### 优化现有文章
```http
POST /generate/improve
Authorization: Bearer {token}
Content-Type: application/json

{
  "articleId": "article_id",
  "improvements": "优化要求"
}
```

## 📁 文件上传

### 上传文件
```http
POST /upload/file
Authorization: Bearer {token}
Content-Type: multipart/form-data

file: [文件数据]
```

**支持格式**: PDF, MD, TXT, DOC, DOCX
**文件大小限制**: 10MB

**响应示例**:
```json
{
  "success": true,
  "file": {
    "id": "file_id",
    "originalName": "document.pdf",
    "size": 1024000,
    "type": ".pdf"
  }
}
```

### 解析文件内容
```http
POST /upload/parse
Authorization: Bearer {token}
Content-Type: application/json

{
  "fileId": "file_id"
}
```

**响应示例**:
```json
{
  "success": true,
  "content": "解析出的文本内容",
  "wordCount": 1500
}
```

## 🚀 发布管理

### 发布到GitHub
```http
POST /publish/github
Authorization: Bearer {token}
Content-Type: application/json

{
  "articleId": "article_id",
  "repoUrl": "https://github.com/user/blog",
  "path": "posts/my-article.md",
  "commitMessage": "Add new article"
}
```

### 获取发布历史
```http
GET /publish/history
Authorization: Bearer {token}
```

## ❌ 错误响应

所有API在发生错误时会返回统一格式：

```json
{
  "error": "错误描述",
  "code": "ERROR_CODE",
  "details": "详细错误信息(仅开发环境)"
}
```

**常见错误码**:
- `UNAUTHORIZED`: 未认证或token无效
- `FORBIDDEN`: 权限不足
- `NOT_FOUND`: 资源不存在
- `VALIDATION_ERROR`: 请求参数验证失败
- `OPENAI_KEY_MISSING`: 未配置OpenAI API Key
- `RATE_LIMIT_EXCEEDED`: 请求频率超限

## 🛡️ 安全说明

1. **认证**: 所有API都需要有效的JWT token
2. **权限**: 用户只能访问自己的数据
3. **加密**: 敏感信息（如API密钥）会加密存储
4. **限流**: 实施请求频率限制
5. **验证**: 严格的输入参数验证 