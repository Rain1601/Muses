import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { githubService } from '../services/github';
import { prisma } from '../index';

const router = Router();

// 获取用户的GitHub仓库列表
router.get('/repos', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const repos = await githubService.getUserRepos(userId);
    
    res.json({ repos });
  } catch (error) {
    console.error('Get repos error:', error);
    res.status(500).json({ error: '获取仓库列表失败' });
  }
});

// 发布文章到GitHub
const publishSchema = z.object({
  articleId: z.string(),
  repoUrl: z.string().url(),
  filePath: z.string(),
  commitMessage: z.string().optional(),
});

router.post('/github', authenticate, async (req: AuthRequest, res) => {
  try {
    const data = publishSchema.parse(req.body);
    const userId = req.user!.id;

    // 获取文章信息
    const article = await prisma.article.findFirst({
      where: {
        id: data.articleId,
        userId,
      },
    });

    if (!article) {
      return res.status(404).json({ error: '文章不存在' });
    }

    // 生成默认提交信息
    const commitMessage = data.commitMessage || `Add article: ${article.title}`;

    // 发布到GitHub
    const result = await githubService.publishArticle({
      userId,
      articleId: data.articleId,
      repoUrl: data.repoUrl,
      filePath: data.filePath,
      commitMessage,
    });

    if (result.success) {
      res.json({
        success: true,
        url: result.url,
      });
    } else {
      res.status(400).json({
        error: result.error || '发布失败',
      });
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: '参数错误', details: error.errors });
    }
    console.error('Publish error:', error);
    res.status(500).json({ error: '发布失败' });
  }
});

// 获取发布历史
router.get('/history/:articleId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { articleId } = req.params;
    const userId = req.user!.id;

    const article = await prisma.article.findFirst({
      where: {
        id: articleId,
        userId,
      },
      select: {
        publishStatus: true,
        publishedAt: true,
        githubUrl: true,
        repoPath: true,
      },
    });

    if (!article) {
      return res.status(404).json({ error: '文章不存在' });
    }

    res.json({ publishInfo: article });
  } catch (error) {
    console.error('Get publish history error:', error);
    res.status(500).json({ error: '获取发布历史失败' });
  }
});

export default router;