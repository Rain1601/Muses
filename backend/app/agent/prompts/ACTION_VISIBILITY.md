# Action Visibility System 文本操作可见性系统

## 概述

Action系统采用分级管理，根据功能的成熟度和复杂度分为不同的可见性级别，实现渐进式功能发布。

## 可见性级别

### 1. CORE (核心功能)
**特点**：
- 始终对所有用户可见
- 前端工具栏默认展示
- 经过充分测试和优化的功能

**包含的Action**：
- `improve` - 改进文本：提升文本清晰度和说服力
- `explain` - 解释文本：详细解释概念和术语
- `expand` - 扩展文本：添加更多细节和例子
- `summarize` - 总结文本：提取关键要点
- `translate` - 翻译文本：翻译为其他语言

### 2. ADVANCED (高级功能)
**特点**：
- 需要用户主动开启或升级账户
- 适合有经验的用户使用
- 提供更专业的文本处理能力

**包含的Action**：
- `polish` - 润色文本：提升文采和表达（前端的rewrite映射到此）
- `simplify` - 简化文本：使文本更易理解
- `continue` - 续写文本：延续内容发展

### 3. EXPERIMENTAL (实验功能)
**特点**：
- 默认隐藏，需要特殊权限
- 正在测试和优化中的功能
- 可能会有变动或不稳定

**包含的Action**：
- `fix_grammar` - 修正语法：纠正语法和拼写错误
- `make_professional` - 专业化：转换为专业风格
- `extract_key_points` - 提取要点：识别关键信息
- `generate_outline` - 生成大纲：创建结构化大纲

### 4. HIDDEN (隐藏功能)
**特点**：
- 仅供内部使用
- 不对外暴露
- 用于测试或特殊场景

## API使用

### 获取可用Action列表

```python
# 获取基础功能（仅CORE）
GET /api/agents/actions/available?include_advanced=false&include_experimental=false

# 获取包含高级功能
GET /api/agents/actions/available?include_advanced=true&include_experimental=false

# 获取所有功能（包括实验性）
GET /api/agents/actions/available?include_advanced=true&include_experimental=true
```

### 响应示例

```json
{
  "actions": [
    {
      "id": "improve",
      "label": "改进文本",
      "icon": "✨",
      "description": "提升文本清晰度和说服力",
      "shortcut": "/improve",
      "keywords": ["improve", "gj", "改进", "优化"],
      "visibility": "core"
    }
  ],
  "total": 5
}
```

## 前端集成建议

### 1. 动态加载Action

```typescript
// 根据用户设置获取action列表
const fetchActions = async (userSettings) => {
  const params = {
    include_advanced: userSettings.enableAdvancedFeatures,
    include_experimental: userSettings.enableExperimentalFeatures
  };

  const response = await api.get('/api/agents/actions/available', { params });
  return response.data.actions;
};
```

### 2. 工具栏渲染

```typescript
// 只渲染可用的action
const TextActionToolbar = ({ availableActions }) => {
  return (
    <div className="toolbar">
      {availableActions.map(action => (
        <ToolbarButton
          key={action.id}
          icon={action.icon}
          label={action.label}
          onClick={() => handleAction(action.id)}
        />
      ))}
    </div>
  );
};
```

### 3. 快捷命令过滤

```typescript
// 根据可用action过滤快捷命令
const filterCommands = (input, availableActions) => {
  const availableIds = availableActions.map(a => a.id);
  return commands.filter(cmd => availableIds.includes(cmd.actionId));
};
```

## 配置管理

### action_config.py

配置文件位于：`app/agent/prompts/action_config.py`

主要功能：
- 定义所有action的元数据
- 管理可见性级别
- 提供别名映射（如rewrite→polish）
- 控制功能开放

### 扩展新Action

1. 在`action_prompts/`目录创建新的prompt文件
2. 在`action_config.py`中添加配置
3. 在`registry.py`中注册
4. 设置适当的可见性级别

```python
"new_action": {
    "visibility": ActionVisibility.EXPERIMENTAL,  # 先设为实验性
    "label": "新功能",
    "icon": "🆕",
    "description": "功能描述",
    "shortcut": "/new",
    "keywords": ["new", "xin"]
}
```

## 用户级别映射

建议的用户级别与功能映射：

| 用户级别 | 可用功能 |
|---------|---------|
| Basic (免费) | CORE |
| Advanced (付费) | CORE + ADVANCED |
| Premium (高级) | CORE + ADVANCED + EXPERIMENTAL |
| Admin (管理员) | ALL |

## 未来扩展

1. **A/B测试**：可以通过调整可见性级别进行功能测试
2. **渐进式发布**：新功能先设为EXPERIMENTAL，稳定后升级为ADVANCED或CORE
3. **个性化配置**：允许用户自定义工具栏显示的action
4. **使用统计**：跟踪各action的使用频率，优化默认配置

## 注意事项

1. 前端应缓存action列表，避免频繁请求
2. 后端应验证用户权限，防止未授权访问
3. 实验性功能应有明确的提示和风险说明
4. 保持向后兼容，避免突然移除功能