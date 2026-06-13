# Muses 项目演进史

> 基于 202 条提交记录梳理，时间跨度 2025-07-20 至 2026-04-12（约 9 个月）。
> 本文档按"阶段（Phase）→ 目标 → 关键交付 → 代表提交"的 spec 形式组织。

## 总览（按阶段）

| 阶段 | 时间 | 主题 | 关键能力 |
|------|------|------|----------|
| P0   | 2025-07-20 ~ 2025-07-28 | 项目奠基 | Node→Python 后端迁移、CI/CD、GitHub OAuth |
| P1   | 2025-07-21 ~ 2025-07-29 | UI 与编辑器底座 | 设计系统、暗黑模式、TipTap 3.0 Notion 风格编辑器 |
| P2   | 2025-09-14 ~ 2025-09-18 | 文章生命周期 + GitHub 集成 | 三栏 Dashboard、图片托管、Notion 导入、文章删除同步 |
| P3   | 2025-09-15 ~ 2025-09-22 | 同步系统与多模型 AI | 覆盖式同步、冲突解决、多模型支持、统一接口 |
| P4   | 2025-09-23 ~ 2025-09-28 | RAG + Agent Prompt 体系 | 知识库、Action 化 prompt、Agent 内联编辑、Action 配置 |
| P5   | 2025-10-02 ~ 2025-10-15 | 编辑器精修 + 翻译/任务中心 | Markdown 快捷输入、URL 导入、异步翻译、任务追踪 |
| P6   | 2025-12-30 ~ 2025-12-31 | 共创/共读模式 | 双栏交互、聊天历史持久化、列表滚动修复 |
| P7   | 2026-04-06 | Studio 写作模式 + Dashboard-v2 | Claude Diff、选区精准编辑、文件夹树、可拖拽 Chat |
| P8   | 2026-04-07 | Google Cloud Run 上线 | Google OAuth、Cloud Run + Cloud SQL、内存调优 |
| P9   | 2026-04-12 | API 聚合化 + CI/CD 优化 | AIHubMix/OpenRouter/百炼 三聚合 provider、并行部署 |

---

## P0 · 项目奠基（2025-07-20 ~ 2025-07-28）

**目标**：完成项目骨架、统一后端到 Python、上线最小可用通路。

**关键交付**：
- 项目初始化（`d4f7b3d`：初始化 Muses 项目）
- 移除 Node.js 后端，全量切到 `backend/`（`3126474`）
- GitHub OAuth、SOCKS 代理依赖（`86bd48e`）
- 生产域名 OAuth 回调（`232fb53`、`b675e92`）
- CI/CD 与 TypeScript 编译修复（`bd24b9d`、`87300fe`）
- 服务管理与健康检查脚本（`ed9f84f`）

---

## P1 · UI 与编辑器底座（2025-07-21 ~ 2025-07-29）

**目标**：建立 Notion 风格编辑器与统一设计语言。

**关键交付**：
- 全站 UI 设计系统 + 暗黑模式（`a81b542`）
- TipTap 3.0 + Notion-style 扩展（`871907a`、`a3d2471`、`e050e14`）
- 文本选择与 Diff 查看组件（`e61055c`）
- 结构化文本处理 API（`1e340bb`）
- AI 写作风格分析（Agent）（`c0a17de`）
- 完整文章管理系统（`cdef607`、`daf0ad9`）

---

## P2 · 文章生命周期 + GitHub 集成（2025-09-14 ~ 2025-09-18）

**目标**：把"写完文章 → 发布到 GitHub"链路打通，并补齐多媒体能力。

**关键交付**：
- 三栏 Dashboard 完整布局 + 进阶编辑（`dde19f4`）
- Agent 页面左右布局重构 + 内联编辑（`45270e2`、`1455c52`）
- GitHub Personal Access Token 配置（`41a8900`）
- GitHub 图床 + 代理（`1b1d8cf`、`1592c54`）
- 多图上传 + 唯一 ID 追踪（`9a450e7`、`1763db6`）
- 拖拽/粘贴图片上传（`74b100d`）
- Notion / Wolai 导入（`81dbfb1`）
- 文章删除 + GitHub 同步（`9afa064`、`50ba8ad`、`063cfec`）
- Slash command + placeholder（`45db9ca`）

---

## P3 · 同步系统与多模型 AI（2025-09-15 ~ 2025-09-22）

**目标**：双向同步可靠化；AI 从单 provider 升级到多模型可选。

**关键交付**：
- 后端覆盖式同步（`26bdb65`）+ 前端冲突解决面板（`af9cdc7`、`5038d9f`）
- 同步历史追踪（`4e04613`）
- GitHub 同步路径策略（创建时间 → 首次同步时间）（`9c35bcd`、`843df0f`）
- 多模型 AI 后端支持（`7ecb4db`）+ DB schema 升级（`4984dc3`）
- 编辑器内模型选择 UI（`b6c373e`）
- 设置页模型配置（`198ace7`）
- 统一 AI 接口（OpenAI / Anthropic / Google）（`ff09c90`）
- 二级文本操作交互（`a400b70`）

---

## P4 · RAG + Agent Prompt 体系（2025-09-23 ~ 2025-09-28）

**目标**：Agent 从"模板填充"升级到可配置 Action + 知识库召回。

**关键交付**：
- 简化 RAG 知识库（chunker → embedder → retriever → storage）（`0d6cc9c`）
- task-specific prompt 系统（`784ded9`），随后拆分为独立 action 文件（`9bd1fee`）
- prompt 系统架构重新设计（`39fa697`）
- Action 配置管理系统（`188d9ef`）+ Actions API 端点（`0ee5b47`）
- Agent 内联编辑（`a704cb0`）
- 个性化配置系统（类 CLAUDE.md）（`bea6270`）
- Agent 执行日志（`1940358`）
- Bilibili 视频扩展（`9b37373`）
- 图片可调整大小 + 对齐（`6e3c317`）
- AI 服务接入 Action 配置（`54ba8a8`）

---

## P5 · 编辑器精修 + 翻译/任务中心（2025-10-02 ~ 2025-10-15）

**目标**：完善 Notion 体验细节；增加跨语言/异步能力。

**关键交付**：
- Notion 风格 Markdown 列表快捷输入（`e8ef3a9`）
- 代码块手动语言切换（`f9d984e`）+ Markdown 语法支持（`059baf1`）
- 表格样式系列修复（`8055ff9`、`8f958ae`、`a7fcca7` 等多次迭代）
- URL 导入 + HTML→Markdown 自动转换（`f580898`、`fc204dd`）
- AI 模型配置更新到最新（`6538ff2`）
- 后端任务追踪器（`b00072c`）
- 异步翻译 API（`1a7750f`）+ 前端任务中心（`a08bdd7`、`1a6b904`）
- GitHub 文章下架（`38a3a2f`）

---

## P6 · 共创 / 共读模式（2025-12-30 ~ 2025-12-31）

**目标**：从"独立写作"扩展到"AI 协同写作"与"边读边记"。

**关键交付**：
- 共创模式 + 共读模式（`b62f213`）
- 共创/共读 与 AI 辅助互斥（`1cbc226`）
- 文本采纳交互优化（`d3da509`）
- 自动保存导致列表滚动跳转的彻底修复（多次迭代：`4c13de8` → `a086d13` → `bf17936` → `5d55a75`）
- 自动保存定时器闭包问题（`a7694c7`）
- 共创模式空白文章重复创建修复（`d04a9cc`）
- Git 提交规范文档（`092a4b4`）+ 共创/共读文档（`f29f4cf`）

**调试印记**：本阶段有约 15 次围绕"自动保存 + 列表滚动 + UI 重渲染"的连续迭代，最终通过"使用文章 ID 锚点 + 本地局部更新"方案彻底解决。

---

## P7 · Studio 写作模式 + Dashboard-v2（2026-04-06）

**目标**：以 Cursor 风格重塑 AI 写作工作流；本地文件系统级工作区。

**关键交付**：
- Studio 写作模式：Claude 对话 + 实时 Diff + Accept/Reject（`e6e078d`）
- Studio API 文件夹支持 + 写作 system prompt 优化（`7b2bb69`）
- Dashboard-v2 三栏：文件夹树 + 编辑器 + 可拖拽 Chat（`363cb69`）
- ChatPanel Cursor 风格重写 + `<article_edit>` Diff 集成（`7151470`）
- TipTap 扩展：选区持久化 + 行号 gutter（`875743e`、`35d4954`）
- FloatingTOC 组件（`ee73fed`）
- Dashboard-v2 内联 Settings 面板（`7d323fe`）
- 选区精准编辑：Diff 只对比选中部分而非全文（`1a76199`）
- 全站 Logo 替换为手绘笔 + 笔记本（`fd6cc5d`）

---

## P8 · Google Cloud Run 上线（2026-04-07）

**目标**：从本地/Mac mini 迁到 GCP，建立公网生产环境。

**关键交付**：
- Cloud Run 部署 + Google OAuth 登录（`7ffa81b`）
- 多次依赖修复：`anthropic` + `google-generativeai`（`40b9e02`）、`chromadb` 冲突放宽（`37e1cb8`）、`beautifulsoup4`/`html2text`/`numpy`（`22d6532`）
- 内存策略：512Mi → 1Gi → 2Gi，单 worker（`1504433`、`0558968`）
- LOG_LEVEL 大小写崩溃（`c3538dc`）
- 前端构建：tsconfig target → es2017（`4a74895`）、跳过 TS/ESLint（`734d229`）
- CI/CD YAML 参数传递重构（`3b8b1a2`）
- SVG 手绘动画 CSS Modules 兼容（`9b8e5eb`）

---

## P9 · API 聚合化 + CI/CD 优化（2026-04-12）

**目标**：简化 AI provider 模型；缩短 CI/CD 反馈周期。

**关键交付**：
- **AI provider 聚合化**（`bf83d84`）—— 把 OpenAI/Claude/Gemini 各自密钥替换为 3 个聚合 API（AIHubMix / OpenRouter / 百炼），全部走 OpenAI 兼容 SDK + 自定义 `base_url`。`unified_ai.py` 从 ~295 行简化到一条代码路径。User 模型新增 `aihubmixKey`/`openrouterKey`/`bailianKey`，旧字段保留做迁移。
- CI/CD 并行部署 + 路径过滤 + Docker cache（`f4c8ea8`）
- Dashboard 未登录跳登录页（`df56f2d`）
- Dashboard DB 文章保存按钮（`c6c9414`）
- 暗色背景下编辑器文字不可见 + 迁移脚本（`7e715d6`）
- checkAuth 统一 URL token 处理（`6d0ce32`）

---

## 关键架构演进线索

1. **后端语言**：Node.js → Python (FastAPI)（P0 完成）
2. **编辑器**：原生 textarea → TipTap 3.0 + Notion 风格扩展矩阵（P1 → P4 持续扩展）
3. **AI 接入**：单 OpenAI → 多 provider 直连（OpenAI/Anthropic/Google）→ 3 聚合 API 单一代码路径（P3 → P9）
4. **写作模式**：单文章 → 共创/共读双栏 → Studio 文件系统工作区（P6 → P7）
5. **Prompt 体系**：模板字符串 → task-specific → Action 化 + 个性化配置（P4 完成）
6. **部署**：本地脚本 → Mac mini → Google Cloud Run + Cloud SQL（P8 完成）
7. **同步**：手动 GitHub push → 覆盖式双向同步 + 冲突解决 + 历史追踪（P3 完成）

---

## 维护建议

- 新阶段应以"目标 + 关键交付 + 代表 commit hash"的相同结构追加；尽量在阶段结束时一次性整理，避免漏项。
- 重大架构切换（如 P9 的 provider 聚合）应单列"演进线索"小节，便于后续 onboarding。
- 单点 bug 修复不进入本文档；只记录形成阶段性主题的修复链（如 P6 的滚动位置）。
