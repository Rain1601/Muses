import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { cache, CacheKeys } from '../utils/cache';

const router = Router();

// 获取文章列表
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    
    // 尝试从缓存获取
    const cacheKey = CacheKeys.USER_ARTICLES(userId);
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ articles: cached });
    }

    const articles = await prisma.article.findMany({
      where: { userId },
      include: {
        agent: {
          select: {
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20, // 最近20篇
    });

    // 缓存5分钟
    cache.set(cacheKey, articles, 300);

    res.json({ articles });
  } catch (error) {
    console.error('Get articles error:', error);
    res.status(500).json({ error: 'Failed to get articles' });
  }
});

// 获取单篇文章
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const article = await prisma.article.findFirst({
      where: {
        id,
        userId, // 确保只能访问自己的文章
      },
      include: {
        agent: true,
      },
    });

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json({ article });
  } catch (error) {
    console.error('Get article error:', error);
    res.status(500).json({ error: 'Failed to get article' });
  }
});

// 创建文章
const createArticleSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string(),
  summary: z.string().optional(),
  agentId: z.string(),
  sourceFiles: z.any().optional(),
});

router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const data = createArticleSchema.parse(req.body);
    const userId = req.user!.id;

    // 验证Agent是否属于该用户
    const agent = await prisma.agent.findFirst({
      where: {
        id: data.agentId,
        userId,
      },
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const article = await prisma.article.create({
      data: {
        ...data,
        userId,
      },
      include: {
        agent: true,
      },
    });

    // 清除缓存
    cache.del(CacheKeys.USER_ARTICLES(userId));

    res.status(201).json({ article });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Create article error:', error);
    res.status(500).json({ error: 'Failed to create article' });
  }
});

// 更新文章
const updateArticleSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  summary: z.string().optional(),
  publishStatus: z.enum(['draft', 'published', 'scheduled']).optional(),
});

router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = updateArticleSchema.parse(req.body);
    const userId = req.user!.id;

    // 验证文章是否属于该用户
    const existingArticle = await prisma.article.findFirst({
      where: { id, userId },
    });

    if (!existingArticle) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const article = await prisma.article.update({
      where: { id },
      data: {
        ...data,
        ...(data.publishStatus === 'published' && !existingArticle.publishedAt && {
          publishedAt: new Date(),
        }),
      },
      include: {
        agent: true,
      },
    });

    // 清除缓存
    cache.del(CacheKeys.USER_ARTICLES(userId));
    cache.del(CacheKeys.ARTICLE(id));

    res.json({ article });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Update article error:', error);
    res.status(500).json({ error: 'Failed to update article' });
  }
});

// 删除文章
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // 验证文章是否属于该用户
    const article = await prisma.article.findFirst({
      where: { id, userId },
    });

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    await prisma.article.delete({
      where: { id },
    });

    // 清除缓存
    cache.del(CacheKeys.USER_ARTICLES(userId));
    cache.del(CacheKeys.ARTICLE(id));

    res.json({ success: true });
  } catch (error) {
    console.error('Delete article error:', error);
    res.status(500).json({ error: 'Failed to delete article' });
  }
});

export default router;