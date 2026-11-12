# Muses × Claude Docs 重构提案

状态：范围已确认（交互 + 数据 + 后端），P1–P4 已完成（2026-11-12）。P4 偏离：正文仍存 HTML，未改 TipTap JSON（发布/翻译/导入都读 HTML，P5 需要块 id 时再议）；主 tab = Article.content，额外 tab 存 ArticleTab。dashboard-pw 原型仍引用 PromptSlot / useSlotEngine / CandidatePopover / SelectionTaskMenu，这些文件留到 P6 与原型一起删

## 1. "Artifacts 里的 doc" 是什么

指 Claude 的 **Claude Docs**（claude.ai 里的 living document artifact）。下面的模型来自其官方 docs 连接器的使用指南（`guide` topic.index / editing / tabs / comments / suggestions / sharing），是一手描述，不是猜测。

**数据模型**

| 概念 | Claude Docs 的做法 |
| --- | --- |
| Doc | 一个 project，含若干 **tab**（可排序、可嵌套为子 tab） |
| Tab 正文 | 块树：paragraph / heading / list / listItem / table·row·cell / code / quote / embed；每个块有**稳定 id** + 内容 hash `h` |
| 版本 | 每次写入 `rev+1`；可按 `sinceRev` 读增量、`atRev` 读历史、`restore` 回滚 |
| Pending 块 | 占位块，带 `intent`（"风险：可能延期的点和兜底"）；AI 先铺大纲，再逐节 `replace` 填充，用户看着它长出来 |
| Chips | 行内原子：日期、@人、下拉（每文档一个 enum）、tab 链接、embed（图表/图示） |
| 评论 | `utterance`，锚定在一段原文上（按文字 find），线程、回复、resolve；`to: claude` = 发给 Claude |
| 建议 | 修订模式：`<ins>/<del>`，一次 update = 一张卡，整卡接受/拒绝 |
| 并发 | 写入带 `ifHash`/`ifRev` 守卫；冲突时**人的编辑优先**，AI 重读后再改 |
| 分享/导出 | 组织内按查看/评论/编辑共享；导出 Word / PDF / Markdown |

**交互模型（要照抄的部分）**

1. **先骨架后内容**：一句需求 → 立刻出现标题 + 每节一个 pending 块（写着这节要写什么）→ AI 一节一节填，不是一次吐一整篇。
2. **评论即对话**：选中文字 → 评论 → @Claude；Claude 在同一线程里回复，需要改文就直接改（或出建议卡），改动和线程关联。没有单独的聊天面板。
3. **改写默认走建议**："润色/精简/改进"类请求产出修订卡，人点 ✓/✕；新增内容、明确的事实修正才直接写。
4. **只改被要求的部分**：块级 id + 守卫，AI 不重写整篇；用户同时在打字也不会被覆盖。
5. **历史可回溯**：任何版本都能看、能恢复。

## 2. 映射到 Muses 现状

| 现有模块 | 处置 | 说明 |
| --- | --- | --- |
| `NotionEditor.tsx`（TipTap） | **保留并扩展** | 引擎不换。加 BlockId、PendingBlock、CommentAnchor mark、Suggestion ins/del mark |
| `app/dashboard/page.tsx`（1800 行三栏） | **重组** | 左栏文档列表保留；中栏编辑器；右栏从"编辑历史"改为**评论/建议栏**。拆出子组件 |
| `useTextActions` → `/api/agents/text-action` | **替换** | 并入"评论给 Claude"与"建议卡"；后端 action prompts 复用 |
| `SelectionTaskMenu` / `CandidatePopover` / `useSlotEngine` / `PromptSlot`【】槽 | **替换后删除** | ⌘K 选区任务 → 评论给 Claude；【】槽 → pending 块 |
| `studio/DiffView` | **删除** | 被行内建议卡取代 |
| `EditHistoryPanel` + `useEditHistory`（localStorage） | **删除** | 被服务端版本历史 + 建议卡取代 |
| `SkillLibrary` | **保留** | 作为"让 Claude 按某技能写/改"的预设，接到大纲生成与评论 |
| `Article` 模型（HTML content） | **演进** | P1 不动；P4 起 content 改存 TipTap JSON，新增 Tab / Revision / Comment 表 |
| 发布到 GitHub（`/api/publish`, `SyncHistory`） | **保留** | 归入"导出"菜单，与 Markdown / HTML / PDF 并列 |
| `TaskCenter`, `FileImport`, `SettingsPanel` | 保留 | |
| `dashboard-cc`, `dashboard-pw` 原型路由 | 最后阶段删除 | 需你确认 |
| 分享给组织成员 | **不做** | Muses 是单用户应用；如需要再议 |

## 3. 分阶段计划

| 阶段 | 内容 | 后端改动 |
| --- | --- | --- |
| **P1 骨架 → 填充** | 编辑器加 PendingBlock 节点（显示 intent + 加载态）；"让 Claude 写"：输入主题（可选 Skill）→ 生成大纲 pending 块 → 逐节流式填充；pending 块可手动单节"重写/删除" | 新增 `POST /api/docs/outline`、`POST /api/docs/fill-section`（复用 `unified_ai`）；不改表 |
| **P2 评论线程** | 选中文字加评论，右栏显示线程，锚点高亮；@Claude → Claude 在线程里回复 | 新表 `Comment`（articleId, anchor, parentId, author, body, resolved）+ CRUD + AI 回复接口 |
| **P3 建议卡** | Suggestion mark；Claude 的改写（来自评论或 ⌘K）一律成为可接受/拒绝的卡；删除 DiffView / CandidatePopover / slot / EditHistory | text-action 返回改为 ops |
| **P4 Tabs + 版本** | Article 下多 tab；每次保存记 revision，可查看/恢复 | `ArticleTab`、`ArticleRevision` 表；content 存 JSON，迁移写进 `run_migrations()` |
| **P5 Chips + 图表 + 导出** | 日期/下拉 chip，图表块（从表格数据渲染），导出 MD / HTML / PDF | 导出接口 |
| **P6 清理** | 拆 `page.tsx`，删除原型路由与遗留代码，更新 CLAUDE.md | |

## 4. 待确认

1. 范围：只重做交互（UX），还是数据模型 + 后端一起（P4 起改表）？
2. 第一阶段：P1（骨架→填充）还是 P2（评论线程）先做？
3. 工作位置：主目录现在有大量未提交改动（DeepSeek provider、后端测试、访客模式修复、文档）。在它们之上直接做，还是先提交它们？
