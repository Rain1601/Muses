import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { aiService } from '../services/ai';
import { prisma } from '../index';
import { cache, CacheKeys } from '../utils/cache';

const router = Router();

// 生成文章的验证schema
const generateArticleSchema = z.object({
  agentId: z.string(),
  materials: z.string().min(1),
  title: z.string().optional(),
  requirements: z.string().optional(),
  saveAsDraft: z.boolean().default(true),
});

// 从素材生成文章
router.post('/article', authenticate, async (req: AuthRequest, res) => {
  try {
    const data = generateArticleSchema.parse(req.body);
    const userId = req.user!.id;

    // 验证用户是否配置了OpenAI Key
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { openaiKey: true },
    });

    if (!user?.openaiKey) {
      return res.status(400).json({ 
        error: '请先配置OpenAI API Key',
        code: 'OPENAI_KEY_MISSING' 
      });
    }

    // 生成文章
    const result = await aiService.generateArticle({
      userId,
      agentId: data.agentId,
      materials: data.materials,
      title: data.title,
      requirements: data.requirements,
    });

    // 如果需要保存为草稿
    let article = null;
    if (data.saveAsDraft) {
      article = await prisma.article.create({
        data: {
          userId,
          agentId: data.agentId,
          title: result.title,
          content: result.content,
          summary: result.summary,
          publishStatus: 'draft',
          sourceFiles: JSON.stringify({ materials: data.materials }),
        },
        include: {
          agent: true,
        },
      });

      // 清除缓存
      cache.del(CacheKeys.USER_ARTICLES(userId));
    }

    return res.json({
      success: true,
      article: article || result,
      generated: result,
    });
  } catch (error: any) {
    console.error('Generate article error:', error);
    
    if (error.message === 'OpenAI API Key not configured') {
      return res.status(400).json({ 
        error: '请先配置OpenAI API Key',
        code: 'OPENAI_KEY_MISSING' 
      });
    }
    
    if (error.message === 'Agent not found') {
      return res.status(404).json({ error: 'Agent不存在' });
    }
    
    return res.status(500).json({ 
      error: '文章生成失败，请稍后重试',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 改进文章
const improveArticleSchema = z.object({
  articleId: z.string(),
  agentId: z.string(),
  instructions: z.string().min(1),
});

router.post('/improve', authenticate, async (req: AuthRequest, res) => {
  try {
    const data = improveArticleSchema.parse(req.body);
    const userId = req.user!.id;

    // 获取文章
    const article = await prisma.article.findFirst({
      where: {
        id: data.articleId,
        userId,
      },
    });

    if (!article) {
      return res.status(404).json({ error: '文章不存在' });
    }

    // 改进文章
    const improvedContent = await aiService.improveArticle(
      userId,
      data.agentId,
      article.content,
      data.instructions
    );

    // 更新文章
    const updatedArticle = await prisma.article.update({
      where: { id: data.articleId },
      data: {
        content: improvedContent,
        agentId: data.agentId,
      },
      include: {
        agent: true,
      },
    });

    // 清除缓存
    cache.del(CacheKeys.ARTICLE(data.articleId));

    return res.json({
      success: true,
      article: updatedArticle,
    });
  } catch (error: any) {
    console.error('Improve article error:', error);
    return res.status(500).json({ 
      error: '文章改进失败，请稍后重试',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 对话式生成
const chatGenerateSchema = z.object({
  agentId: z.string(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })),
  saveAsDraft: z.boolean().default(false),
});

router.post('/chat', authenticate, async (req: AuthRequest, res) => {
  try {
    const data = chatGenerateSchema.parse(req.body);
    const userId = req.user!.id;

    // 将对话历史转换为素材
    const materials = data.messages
      .map(msg => `${msg.role === 'user' ? '用户' : 'AI'}: ${msg.content}`)
      .join('\n\n');

    // 生成文章
    const result = await aiService.generateArticle({
      userId,
      agentId: data.agentId,
      materials,
      requirements: '基于以上对话内容生成一篇完整的博客文章',
    });

    // 如果需要保存为草稿
    let article = null;
    if (data.saveAsDraft) {
      article = await prisma.article.create({
        data: {
          userId,
          agentId: data.agentId,
          title: result.title,
          content: result.content,
          summary: result.summary,
          publishStatus: 'draft',
          metadata: JSON.stringify({ chatHistory: data.messages }),
        },
        include: {
          agent: true,
        },
      });

      // 清除缓存
      cache.del(CacheKeys.USER_ARTICLES(userId));
    }

    return res.json({
      success: true,
      article: article || result,
      generated: result,
    });
  } catch (error: any) {
    console.error('Chat generate error:', error);
    return res.status(500).json({ 
      error: '文章生成失败，请稍后重试',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;