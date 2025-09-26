import sys
import uuid
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app.models.muses_config import ConfigTemplate
from app.models import *  # 确保所有模型都被导入

# 创建所有表
from app.database import create_tables
create_tables()

def create_default_templates(db: Session):
    """创建默认的配置模板"""

    templates = [
        {
            "name": "技术博客写作配置",
            "description": "适合技术类博客和教程的写作配置",
            "category": "content-type",
            "template_content": """# 个人写作档案

## 专业领域
- 软件开发
- 前端/后端技术
- 系统架构

## 目标读者
- 技术开发者
- 初中级工程师
- 技术爱好者

## 写作风格偏好
- 语气: 专业但友好
- 文章长度: 中等 (1500-3000字)
- 结构偏好: 问题解决型
- 代码示例: 必要且详细

## 常用模板

### 技术教程模板
1. 问题背景和场景描述
2. 技术方案分析
3. 具体实现步骤（含代码）
4. 测试和验证
5. 总结和最佳实践

### 技术分享模板
1. 技术背景介绍
2. 核心概念解释
3. 实际应用案例
4. 优缺点分析
5. 推荐使用场景

## 写作规则
- 使用清晰的标题层级
- 代码需要语法高亮
- 包含实际可运行的示例
- 提供相关资源链接

## 个人品牌声音
- 注重实战经验分享
- 强调代码质量和最佳实践
- 鼓励读者动手实践""",
            "is_system": True
        },
        {
            "name": "产品评测配置",
            "description": "适合产品分析和评测类文章的写作配置",
            "category": "content-type",
            "template_content": """# 个人写作档案

## 专业领域
- 产品分析
- 用户体验
- 市场趋势

## 目标读者
- 产品经理
- 创业者
- 对产品感兴趣的用户

## 写作风格偏好
- 语气: 客观中立，偶尔幽默
- 文章长度: 中长 (2000-4000字)
- 结构偏好: 分析评测型
- 数据支撑: 重要

## 常用模板

### 产品评测模板
1. 产品背景介绍
2. 核心功能体验
3. 优点分析
4. 不足之处
5. 竞品对比
6. 使用建议和总结

### 行业分析模板
1. 行业现状概述
2. 主要玩家分析
3. 发展趋势预测
4. 机会与挑战
5. 投资价值评估

## 写作规则
- 保持客观公正
- 使用数据支撑论点
- 包含实际使用截图
- 提供多角度分析

## 个人品牌声音
- 深度思考产品背后的逻辑
- 关注用户真实需求
- 提供可行的改进建议""",
            "is_system": True
        },
        {
            "name": "个人随笔配置",
            "description": "适合个人思考和生活感悟类文章",
            "category": "writing-style",
            "template_content": """# 个人写作档案

## 专业领域
- 个人成长
- 生活感悟
- 读书笔记

## 目标读者
- 寻求灵感的读者
- 对生活有思考的人
- 志同道合的朋友

## 写作风格偏好
- 语气: 真诚温暖
- 文章长度: 灵活 (800-2000字)
- 结构偏好: 故事叙述型
- 情感表达: 真实自然

## 常用模板

### 生活感悟模板
1. 触发思考的事件
2. 个人的观察和体会
3. 深入的思考分析
4. 获得的启发
5. 对读者的分享

### 读书笔记模板
1. 书籍基本信息
2. 核心观点摘录
3. 个人理解和思考
4. 与生活的联系
5. 推荐理由

## 写作规则
- 真实表达个人感受
- 避免说教语气
- 适当引用名言佳句
- 保持积极正向

## 个人品牌声音
- 善于观察生活细节
- 乐于分享成长经验
- 传递正能量和希望""",
            "is_system": True
        },
        {
            "name": "学术论文配置",
            "description": "适合学术研究和论文写作",
            "category": "content-type",
            "template_content": """# 个人写作档案

## 专业领域
- 学术研究
- 科学论文
- 研究报告

## 目标读者
- 学术研究者
- 研究生和博士生
- 专业领域专家

## 写作风格偏好
- 语气: 严谨学术
- 文章长度: 长文 (5000字以上)
- 结构偏好: 学术规范型
- 引用规范: 严格

## 常用模板

### 研究论文模板
1. 摘要 (Abstract)
2. 引言 (Introduction)
3. 文献综述 (Literature Review)
4. 研究方法 (Methodology)
5. 结果分析 (Results)
6. 讨论 (Discussion)
7. 结论 (Conclusion)
8. 参考文献 (References)

### 实验报告模板
1. 实验目的
2. 理论背景
3. 实验设计
4. 数据收集
5. 结果分析
6. 结论和建议

## 写作规则
- 遵循学术写作规范
- 准确引用参考文献
- 使用专业术语
- 数据真实可靠
- 逻辑严密清晰

## 个人品牌声音
- 追求学术严谨性
- 注重创新性贡献
- 强调研究的实际意义""",
            "is_system": True
        },
        {
            "name": "营销文案配置",
            "description": "适合营销推广和文案创作",
            "category": "writing-style",
            "template_content": """# 个人写作档案

## 专业领域
- 营销策划
- 品牌推广
- 内容营销

## 目标读者
- 潜在客户
- 品牌粉丝
- 行业从业者

## 写作风格偏好
- 语气: 吸引力强，有说服力
- 文章长度: 短中 (500-1500字)
- 结构偏好: 营销转化型
- 行动号召: 明确

## 常用模板

### 产品营销模板
1. 痛点引入
2. 解决方案介绍
3. 产品特点展示
4. 用户案例分享
5. 限时优惠
6. 行动号召

### 品牌故事模板
1. 品牌起源
2. 核心价值观
3. 发展历程
4. 成功案例
5. 未来愿景

## 写作规则
- 标题吸引眼球
- 开头快速抓住注意力
- 使用社会证据
- 创造紧迫感
- 清晰的CTA

## 个人品牌声音
- 了解用户心理
- 善于讲故事
- 数据驱动决策""",
            "is_system": True
        }
    ]

    # 检查是否已存在系统模板
    existing = db.query(ConfigTemplate).filter(ConfigTemplate.is_system == True).first()
    if existing:
        print("系统模板已存在，跳过创建")
        return

    # 创建模板
    for template_data in templates:
        template = ConfigTemplate(
            id=str(uuid.uuid4()),
            **template_data
        )
        db.add(template)

    db.commit()
    print(f"成功创建 {len(templates)} 个系统模板")

if __name__ == "__main__":
    db = SessionLocal()
    try:
        create_default_templates(db)
    finally:
        db.close()