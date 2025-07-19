import OpenAI from 'openai';
import { prisma } from '../index';
import { decrypt } from '../utils/encryption';

interface GenerateArticleParams {
  userId: string;
  agentId: string;
  materials: string;
  title?: string;
  requirements?: string;
}

export class AIService {
  private async getOpenAIClient(userId: string): Promise<OpenAI> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { openaiKey: true },
    });

    if (!user?.openaiKey) {
      throw new Error('OpenAI API Key not configured');
    }

    const apiKey = decrypt(user.openaiKey);
    return new OpenAI({ apiKey });
  }

  async generateArticle({
    userId,
    agentId,
    materials,
    title,
    requirements,
  }: GenerateArticleParams): Promise<{ title: string; content: string; summary: string }> {
    // 获取Agent配置
    const agent = await prisma.agent.findFirst({
      where: { id: agentId, userId },
    });

    if (!agent) {
      throw new Error('Agent not found');
    }

    // 构建系统提示词
    const systemPrompt = this.buildSystemPrompt(agent);
    
    // 构建用户提示词
    const userPrompt = this.buildUserPrompt(materials, title, requirements);

    // 调用OpenAI API
    const openai = await this.getOpenAIClient(userId);
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const response = completion.choices[0].message.content || '';
    
    // 解析响应
    const result = this.parseArticleResponse(response, title);
    
    return result;
  }

  private buildSystemPrompt(agent: any): string {
    const toneMap: Record<string, string> = {
      professional: '专业严谨',
      casual: '轻松随意',
      humorous: '幽默风趣',
      serious: '严肃认真',
    };

    const lengthMap: Record<string, string> = {
      short: '简洁精炼，控制在500字以内',
      medium: '适中详细，控制在500-1500字',
      long: '详细充分，1500字以上',
    };

    let prompt = `你是一个${agent.name}，你的任务是根据用户提供的素材生成高质量的博客文章。

你的写作特点：
- 语言：${agent.language === 'zh-CN' ? '中文' : agent.language === 'en-US' ? '英文' : '中英混合'}
- 语气：${toneMap[agent.tone] || agent.tone}
- 篇幅：${lengthMap[agent.lengthPreference] || agent.lengthPreference}`;

    if (agent.targetAudience) {
      prompt += `\n- 目标读者：${agent.targetAudience}`;
    }

    if (agent.description) {
      prompt += `\n- 特点描述：${agent.description}`;
    }

    if (agent.customPrompt) {
      prompt += `\n\n特殊要求：${agent.customPrompt}`;
    }

    prompt += `\n\n输出格式要求：
1. 文章必须是${agent.outputFormat === 'mdx' ? 'MDX' : 'Markdown'}格式
2. 包含适当的标题层级
3. 如果适合，可以包含代码块、列表、引用等元素
4. 文章结构清晰，逻辑流畅

请直接输出文章内容，不要包含其他说明。`;

    return prompt;
  }

  private buildUserPrompt(materials: string, title?: string, requirements?: string): string {
    let prompt = '请根据以下素材生成一篇博客文章：\n\n';
    
    if (title) {
      prompt += `文章标题：${title}\n\n`;
    }
    
    prompt += `素材内容：\n${materials}\n\n`;
    
    if (requirements) {
      prompt += `额外要求：${requirements}\n\n`;
    }
    
    if (!title) {
      prompt += '请为文章生成一个合适的标题。\n';
    }

    return prompt;
  }

  private parseArticleResponse(response: string, providedTitle?: string): {
    title: string;
    content: string;
    summary: string;
  } {
    // 如果响应以 # 开头，说明包含了标题
    const lines = response.trim().split('\n');
    let title = providedTitle || '未命名文章';
    let content = response;

    if (lines[0].startsWith('# ')) {
      title = lines[0].replace('# ', '').trim();
      content = lines.slice(1).join('\n').trim();
    }

    // 生成摘要（取前200个字符）
    const plainText = content.replace(/[#*`\[\]()]/g, '').trim();
    const summary = plainText.length > 200 
      ? plainText.substring(0, 200) + '...' 
      : plainText;

    return { title, content, summary };
  }

  async improveArticle(
    userId: string,
    agentId: string,
    currentContent: string,
    instructions: string
  ): Promise<string> {
    const agent = await prisma.agent.findFirst({
      where: { id: agentId, userId },
    });

    if (!agent) {
      throw new Error('Agent not found');
    }

    const systemPrompt = this.buildSystemPrompt(agent);
    const userPrompt = `请根据以下指示改进这篇文章：

当前文章内容：
${currentContent}

改进要求：
${instructions}

请直接输出改进后的完整文章内容。`;

    const openai = await this.getOpenAIClient(userId);
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    return completion.choices[0].message.content || currentContent;
  }
}

export const aiService = new AIService();