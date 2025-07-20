# Muses API 文档

Base URL: `http://localhost:8080/api`

## 认证

所有需要认证的接口都需要在请求头中包含 JWT token：

```
Authorization: Bearer <token>
```

## 接口列表

### 认证相关

#### GitHub OAuth 登录
```
GET /auth/github
```
重定向到 GitHub 进行 OAuth 认证

#### GitHub OAuth 回调
```
GET /auth/github/callback?code=<code>
```
GitHub OAuth 回调，处理认证并重定向到前端

#### 验证 Token
```
GET /auth/verify
Headers: Authorization: Bearer <token>
```

响应示例：
```json
{
  "user": {
    "id": "clxxxxxx",
    "username": "johndoe",
    "email": "john@example.com",
    "avatarUrl": "https://github.com/avatar.png",
    "hasOpenAIKey": true
  }
}
```

### 用户相关

#### 获取用户信息
```
GET /user/profile
Headers: Authorization: Bearer <token>
```

#### 更新用户设置
```
POST /user/settings
Headers: Authorization: Bearer <token>
Content-Type: application/json

{
  "openaiKey": "sk-...",
  "defaultRepoUrl": "https://github.com/user/blog",
  "language": "zh-CN",
  "theme": "light"
}
```

### Agent 管理

#### 获取 Agent 列表
```
GET /agents
Headers: Authorization: Bearer <token>
```

响应示例：
```json
{
  "agents": [
    {
      "id": "clxxxxxx",
      "name": "技术博主",
      "description": "专注技术文章",
      "avatar": "🤖",
      "language": "zh-CN",
      "tone": "professional",
      "lengthPreference": "medium",
      "isDefault": true,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### 创建 Agent
```
POST /agents
Headers: Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "技术博主",
  "description": "专注技术文章",
  "avatar": "🤖",
  "language": "zh-CN",
  "tone": "professional",
  "lengthPreference": "medium",
  "targetAudience": "开发者",
  "customPrompt": "注重代码示例",
  "outputFormat": "markdown",
  "isDefault": false
}
```

#### 更新 Agent
```
PUT /agents/:id
Headers: Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "新名称",
  "tone": "casual"
}
```

#### 删除 Agent
```
DELETE /agents/:id
Headers: Authorization: Bearer <token>
```

#### 获取 Agent 模板
```
GET /agents/templates/list
Headers: Authorization: Bearer <token>
```

### 文章管理

#### 获取文章列表
```
GET /articles
Headers: Authorization: Bearer <token>
```

响应示例：
```json
{
  "articles": [
    {
      "id": "clxxxxxx",
      "title": "如何使用 Next.js",
      "summary": "本文介绍...",
      "publishStatus": "draft",
      "createdAt": "2024-01-01T00:00:00Z",
      "agent": {
        "name": "技术博主",
        "avatar": "🤖"
      }
    }
  ]
}
```

#### 获取单篇文章
```
GET /articles/:id
Headers: Authorization: Bearer <token>
```

#### 创建文章
```
POST /articles
Headers: Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "文章标题",
  "content": "# 文章内容\n\n正文...",
  "summary": "摘要",
  "agentId": "clxxxxxx",
  "sourceFiles": {}
}
```

#### 更新文章
```
PUT /articles/:id
Headers: Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "新标题",
  "content": "新内容",
  "publishStatus": "published"
}
```

#### 删除文章
```
DELETE /articles/:id
Headers: Authorization: Bearer <token>
```

### 文件上传

#### 上传文件
```
POST /upload/file
Headers: Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <binary>
```

响应示例：
```json
{
  "success": true,
  "file": {
    "id": "1234567890-file.pdf",
    "originalName": "document.pdf",
    "size": 1024000,
    "type": ".pdf",
    "path": "/uploads/user-id/1234567890-file.pdf"
  }
}
```

#### 解析文件内容
```
POST /upload/parse
Headers: Authorization: Bearer <token>
Content-Type: application/json

{
  "fileId": "1234567890-file.pdf"
}
```

响应示例：
```json
{
  "success": true,
  "content": "文件内容文本...",
  "wordCount": 1500
}
```

### 文章生成

#### 从素材生成文章
```
POST /generate/article
Headers: Authorization: Bearer <token>
Content-Type: application/json

{
  "agentId": "clxxxxxx",
  "materials": "素材内容...",
  "title": "可选标题",
  "requirements": "额外要求",
  "saveAsDraft": true
}
```

响应示例：
```json
{
  "success": true,
  "article": {
    "id": "clxxxxxx",
    "title": "生成的标题",
    "content": "# 标题\n\n内容...",
    "summary": "摘要"
  }
}
```

#### 改进文章
```
POST /generate/improve
Headers: Authorization: Bearer <token>
Content-Type: application/json

{
  "articleId": "clxxxxxx",
  "agentId": "clxxxxxx",
  "instructions": "请优化文章结构"
}
```

#### 对话式生成
```
POST /generate/chat
Headers: Authorization: Bearer <token>
Content-Type: application/json

{
  "agentId": "clxxxxxx",
  "messages": [
    {"role": "user", "content": "写一篇关于..."},
    {"role": "assistant", "content": "好的，我来..."}
  ],
  "saveAsDraft": false
}
```

### 发布管理

#### 获取 GitHub 仓库列表
```
GET /publish/repos
Headers: Authorization: Bearer <token>
```

响应示例：
```json
{
  "repos": [
    {
      "name": "blog",
      "fullName": "johndoe/blog",
      "url": "https://github.com/johndoe/blog"
    }
  ]
}
```

#### 发布到 GitHub
```
POST /publish/github
Headers: Authorization: Bearer <token>
Content-Type: application/json

{
  "articleId": "clxxxxxx",
  "repoUrl": "https://github.com/johndoe/blog",
  "filePath": "posts/2024/01/my-article.md",
  "commitMessage": "Add new article"
}
```

响应示例：
```json
{
  "success": true,
  "url": "https://github.com/johndoe/blog/blob/main/posts/2024/01/my-article.md"
}
```

#### 获取发布历史
```
GET /publish/history/:articleId
Headers: Authorization: Bearer <token>
```

## 错误响应

所有接口的错误响应格式：

```json
{
  "error": "错误描述",
  "code": "ERROR_CODE",
  "details": {}
}
```

常见错误码：
- `401`: 未认证或 token 无效
- `403`: 无权限
- `404`: 资源不存在
- `400`: 请求参数错误
- `500`: 服务器内部错误

## 限流

API 使用令牌桶算法进行限流：
- 窗口时间：15分钟
- 最大请求数：100次
- 超出限制返回 `429 Too Many Requests`

## WebSocket（规划中）

用于实时功能：
- 文章生成进度
- AI 对话
- 协作编辑