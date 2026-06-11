# Muses 技术难点突破记录

> 重点记录系统开发中的关键技术挑战，按「问题 → 结果 → 方法」结构组织。

---

## 1. 选区精准编辑 — AI 只改选中部分，不替换全文

### 问题（难点）

Studio/Dashboard 中用户选中一段文字让 AI 修改时，Diff 显示全文被替换（+1 -150），而不是只修改选中部分。根本原因：编辑器选区是**纯文本**，但文章内容是 **Markdown**，两者无法匹配。例如选区拿到的是 `Title`（纯文本），但 Markdown 里是 `# Title`，`indexOf()` 必然失败。

### 结果（之前 → 之后）

| | 之前 | 之后 |
|---|---|---|
| Diff 显示 | 全文删除 + 全文新增（+1 -150） | 仅选中部分的差异（+3 -1） |
| Accept 行为 | 整篇文章被替换 | 选中部分精准替换，其余内容不变 |
| AI Prompt | 返回完整文章（不可靠） | 只返回选中部分的修改（轻量、准确） |

### 方法（思路 + 方法）

**核心思路**：让 Agent 只处理选中片段，前端负责合并回全文。

1. **选区 Markdown 化**：用 ProseMirror `DOMSerializer.fromSchema()` 将选区 Slice 序列化为 HTML，再用 Turndown 转为 Markdown。这样选区的 Markdown 和全文的 Markdown 来自**同一个 Turndown pipeline**，保证格式一致。

2. **后端 Prompt 分流**：`studio.py` 根据 `has_selection` 切换两套 prompt：
   - 有选区 → `<article_edit>` 只包含选中部分修改后的内容
   - 无选区 → `<article_edit>` 包含完整文章

3. **前端精准合并**：`acceptChange()` 时用 `currentMd.indexOf(selectionMd)` 定位选区在全文中的位置，替换为 AI 返回的新内容。因为两者都来自 Turndown，`indexOf` 匹配有保证。

**关键代码路径**：
- `frontend/app/dashboard/page.tsx` — `handleSelectionChange()` + `handleArticleEdit()` + `acceptChange()`
- `backend-python/app/api/studio.py` — `has_selection` prompt 分流
- `frontend/lib/tiptap-extensions/SelectionPersistence.ts` — 选区持久化 Extension

---

## 2. 选区持久化 — 编辑器失焦后保持蓝色高亮

### 问题（难点）

TipTap/ProseMirror 编辑器在失焦（blur）时会清除原生选区高亮。当用户按 ⌘K 跳到 Chat 输入框时，编辑器中的选中文字高亮消失，用户失去视觉反馈，无法确认哪段文字正在被 AI 处理。

### 结果（之前 → 之后）

| | 之前 | 之后 |
|---|---|---|
| 编辑器失焦 | 选区高亮消失 | 蓝色 Decoration 高亮保持 |
| ⌘K 交互 | 需要记住选了什么 | 选区始终可见，Chat 显示行数 |
| 重新聚焦 | 选区丢失 | 自动恢复真实选区 |

### 方法（思路 + 方法）

**用 ProseMirror Decoration 替代原生选区**：

1. 创建 TipTap Extension `SelectionPersistence`，内置 ProseMirror Plugin
2. **blur 事件**：读取当前 `selection.from/to`，创建 `Decoration.inline()` 添加 `.selection-decoration` class（蓝色背景），通过 Plugin State 存储 DecorationSet
3. **focus 事件**：从 DecorationSet 读取 `from/to`，用 `TextSelection.create()` 恢复真实选区，然后清除 Decoration
4. 暴露 `persistSelection()` / `clearPersistedSelection()` 工具函数供外部调用（⌘K 快捷键、发送消息后清除）

**关键设计**：Decoration 是 ProseMirror 的「视图层装饰」，不修改文档内容，跟随文档变更自动 map 位置。

---

## 3. Agent 多模型统一接口

### 问题（难点）

系统需要同时支持 OpenAI、Anthropic Claude、Google Gemini 三家 AI 模型，每家 SDK 的接口格式、流式响应协议、错误处理都不同。Agent 配置的 model 字段可能指向任何一家，需要统一的调用入口。

### 结果（之前 → 之后）

| | 之前 | 之后 |
|---|---|---|
| 模型支持 | 仅 OpenAI | OpenAI + Claude + Gemini |
| 切换成本 | 改代码 | Agent 配置选模型，运行时自动路由 |
| 流式输出 | 各模型格式不同 | 统一 SSE 格式输出到前端 |

### 方法（思路 + 方法）

1. **UnifiedAI 抽象层**（`app/services/unified_ai.py`）：统一的 `generate()` 和 `stream_generate()` 接口，内部根据 model ID 前缀路由到对应 SDK
2. **ModelFactory**：从 `models_config.py` 的模型注册表查找配置，实例化对应的 client
3. **Agent → Model 映射**：每个 Agent 的 `customPrompt` + `tone` + `targetAudience` 构建 system message，model ID 决定调用哪家 API
4. **流式统一**：所有模型的流式响应都转换为 `{type: "text", content: "..."}` SSE 格式

---

## 4. Studio Chat — 文件上下文感知的 AI 对话

### 问题（难点）

写作场景中 AI 需要感知当前编辑的文件内容，但不能每次都把全文发给模型（token 浪费），也不能完全不发（AI 没有上下文）。同时 AI 的回复需要区分「对话」和「编辑操作」两种模式。

### 结果（之前 → 之后）

| | 之前 | 之后 |
|---|---|---|
| AI 上下文 | 无文件感知 | 自动注入当前文件 + 选区 |
| 回复格式 | 纯文本 | 对话 vs `<article_edit>` 标签自动分流 |
| 编辑应用 | 手动复制粘贴 | Diff view + Accept/Reject 一键操作 |

### 方法（思路 + 方法）

1. **System Prompt 动态构建**（`studio.py`）：
   - 基础写作风格 prompt（固定）
   - 当前文件内容注入（如果 `req.filename` 存在）
   - 选区注入（如果 `req.selection` 存在）
   - 回复格式指令根据有无选区切换

2. **`<article_edit>` 标签协议**：AI 在需要修改文章时，将修改内容包在 `<article_edit>` 标签中。前端流式接收时实时剥离标签显示文本，完成后提取标签内容触发 Diff view。

3. **AIHubMix 聚合 API**：通过 `aihubmix.com/v1` 统一入口调用 Claude Sonnet，避免直接管理 Anthropic SDK，简化部署和 key 管理。

---

## 5. WebSocket 文件监听 + Diff 引擎

### 问题（难点）

Studio 模式下，用户可能用外部工具（如 Claude Code CLI）直接修改 workspace 文件。前端需要实时感知文件变化，计算 diff，并提供 Accept/Reject UI。

### 结果（之前 → 之后）

| | 之前 | 之后 |
|---|---|---|
| 外部修改 | 需要刷新页面 | WebSocket 实时推送 diff |
| Diff 展示 | 无 | 结构化 hunk + 行级增删标注 |
| 冲突处理 | 覆盖丢失 | 快照对比 + Accept/Reject |

### 方法（思路 + 方法）

1. **快照机制**：WebSocket 连接时对 workspace 所有 `.md` 文件取快照，每 500ms 轮询比对
2. **Diff 引擎**：用 Python `difflib.unified_diff()` 计算 unified diff，解析为结构化 `{hunks: [{header, changes: [{type, content}]}]}`
3. **前端 DiffView**：接收结构化 diff 渲染行级对比，支持 ⌘Enter Accept / Esc Reject
4. **快照更新**：Accept 后调用 `POST /snapshot/{filepath}` 更新快照，防止重复触发 diff

---

## 6. Google Cloud Run 部署 — SQLite → PostgreSQL + 无状态化

### 问题（难点）

本地开发使用 SQLite（单文件数据库）+ 本地文件系统（workspace、uploads），Cloud Run 是无状态容器，文件系统临时且不持久。OAuth 回调 URL、CORS origin、API endpoint 都硬编码为 localhost。

### 结果（之前 → 之后）

| | 之前 | 之后 |
|---|---|---|
| 数据库 | SQLite 单文件 | Cloud SQL PostgreSQL + 连接池 |
| 配置 | 硬编码 localhost | 环境变量驱动，支持多环境 |
| 部署 | 手动启动 python start.py | Docker 镜像 + `deploy.sh` 一键部署 |
| Studio | 依赖 ~/muses-workspace | 条件注册，生产环境可关闭 |
| 密钥 | 硬编码在代码中 | 环境变量 / Secret Manager |

### 方法（思路 + 方法）

1. **数据库层**：`database.py` 根据 `DATABASE_URL` 前缀自动切换 SQLite/PostgreSQL 配置，PostgreSQL 加连接池（`pool_size=5, pool_pre_ping=True`）
2. **配置中心化**：`config.py` 新增 `backend_url`、`aihubmix_api_key`、`enable_studio`，所有硬编码 URL 改读 settings
3. **CORS 动态化**：`frontend_url` 支持逗号分隔多 origin，TrustedHost 添加 `*.run.app`
4. **Docker 多阶段构建**：前端 Next.js standalone 模式，后端 python-slim + uvicorn workers
5. **部署自动化**：`deploy.sh` 按序构建后端 → 获取 URL → 构建前端（注入 API URL）→ 更新后端 CORS
