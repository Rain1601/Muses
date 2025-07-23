# 素材文件夹

这个文件夹用于存放项目相关的素材文件。

## 目录结构

```
materials/
├── images/          # 图片素材
│   ├── logos/       # 项目logo
│   ├── icons/       # 图标文件
│   └── screenshots/ # 截图素材
├── documents/       # 文档素材
│   ├── templates/   # 文档模板
│   └── examples/    # 示例文档
└── templates/       # 模板文件
    ├── markdown/    # Markdown模板
    └── configs/     # 配置文件模板
```

## 使用说明

### 图片素材
- **logos/**: 存放项目相关的logo文件
- **icons/**: 存放各种图标文件
- **screenshots/**: 存放项目截图和演示图片

### 文档素材
- **templates/**: 存放各种文档模板
- **examples/**: 存放示例文档和参考材料

### 模板文件
- **markdown/**: 存放Markdown格式的模板文件
- **configs/**: 存放配置文件模板

## 访问方式

在代码中可以通过以下方式访问这些素材：

```javascript
// 图片素材
const logoUrl = '/materials/images/logos/logo.png';

// 文档素材
const templateUrl = '/materials/documents/templates/article-template.md';

// 模板文件
const configUrl = '/materials/templates/configs/default-config.json';
```

## 注意事项

1. 所有素材文件都应该放在对应的子目录中
2. 文件名使用小写字母和连字符
3. 图片文件建议使用WebP或PNG格式
4. 文档文件使用UTF-8编码
5. 定期清理不再使用的素材文件 