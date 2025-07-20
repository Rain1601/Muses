import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { cache, CacheKeys } from '../utils/cache';

const router = Router();

// 创建Agent的验证schema
const createAgentSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().optional(),
  avatar: z.string().optional(),
  language: z.string().default('zh-CN'),
  tone: z.enum(['professional', 'casual', 'humorous', 'serious']).default('professional'),
  lengthPreference: z.enum(['short', 'medium', 'long']).default('medium'),
  targetAudience: z.string().optional(),
  customPrompt: z.string().optional(),
  outputFormat: z.enum(['markdown', 'mdx']).default('markdown'),
  specialRules: z.any().optional(),
  isDefault: z.boolean().optional(),
});

// 获取用户的所有Agent
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    
    // 尝试从缓存获取
    const cacheKey = CacheKeys.USER_AGENTS(userId);
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ agents: cached });
    }

    const agents = await prisma.agent.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    // 缓存10分钟
    cache.set(cacheKey, agents, 600);

    return res.json({ agents });
  } catch (error) {
    console.error('Get agents error:', error);
    return res.status(500).json({ error: 'Failed to get agents' });
  }
});

// 获取单个Agent
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const agent = await prisma.agent.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    return res.json({ agent });
  } catch (error) {
    console.error('Get agent error:', error);
    return res.status(500).json({ error: 'Failed to get agent' });
  }
});

// 创建Agent
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const data = createAgentSchema.parse(req.body);
    const userId = req.user!.id;

    // 如果设置为默认，先取消其他默认Agent
    if (data.isDefault) {
      await prisma.agent.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // 如果是第一个Agent，自动设为默认
    const agentCount = await prisma.agent.count({
      where: { userId },
    });
    if (agentCount === 0) {
      data.isDefault = true;
    }

    const agent = await prisma.agent.create({
      data: {
        ...data,
        userId,
      },
    });

    // 清除缓存
    cache.del(CacheKeys.USER_AGENTS(userId));

    return res.status(201).json({ agent });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Create agent error:', error);
    return res.status(500).json({ error: 'Failed to create agent' });
  }
});

// 更新Agent
const updateAgentSchema = createAgentSchema.partial();

router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = updateAgentSchema.parse(req.body);
    const userId = req.user!.id;

    // 验证Agent是否属于该用户
    const existingAgent = await prisma.agent.findFirst({
      where: { id, userId },
    });

    if (!existingAgent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // 如果设置为默认，先取消其他默认Agent
    if (data.isDefault && !existingAgent.isDefault) {
      await prisma.agent.updateMany({
        where: { userId, isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
    }

    const agent = await prisma.agent.update({
      where: { id },
      data,
    });

    // 清除缓存
    cache.del(CacheKeys.USER_AGENTS(userId));
    cache.del(CacheKeys.AGENT(id));

    return res.json({ agent });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Update agent error:', error);
    return res.status(500).json({ error: 'Failed to update agent' });
  }
});

// 删除Agent
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // 验证Agent是否属于该用户
    const agent = await prisma.agent.findFirst({
      where: { id, userId },
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // 检查是否有使用该Agent的文章
    const articleCount = await prisma.article.count({
      where: { agentId: id },
    });

    if (articleCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete agent with existing articles',
        articleCount,
      });
    }

    await prisma.agent.delete({
      where: { id },
    });

    // 如果删除的是默认Agent，设置另一个为默认
    if (agent.isDefault) {
      const firstAgent = await prisma.agent.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      
      if (firstAgent) {
        await prisma.agent.update({
          where: { id: firstAgent.id },
          data: { isDefault: true },
        });
      }
    }

    // 清除缓存
    cache.del(CacheKeys.USER_AGENTS(userId));
    cache.del(CacheKeys.AGENT(id));

    return res.json({ success: true });
  } catch (error) {
    console.error('Delete agent error:', error);
    return res.status(500).json({ error: 'Failed to delete agent' });
  }
});

// 获取Agent预设模板
router.get('/templates/list', authenticate, async (_req: AuthRequest, res) => {
  const templates = [
    {
      id: 'tech-blogger',
      name: '技术博主',
      description: '专注于技术文章，风格严谨专业',
      config: {
        language: 'zh-CN',
        tone: 'professional',
        lengthPreference: 'medium',
        targetAudience: '技术开发者',
        customPrompt: '请以技术博主的身份撰写文章，注重代码示例和技术细节的准确性。',
      },
    },
    {
      id: 'casual-writer',
      name: '轻松写手',
      description: '风格轻松幽默，适合生活类文章',
      config: {
        language: 'zh-CN',
        tone: 'casual',
        lengthPreference: 'medium',
        targetAudience: '普通读者',
        customPrompt: '请以轻松幽默的语气撰写文章，让读者感到亲切和愉悦。',
      },
    },
    {
      id: 'academic-researcher',
      name: '学术研究者',
      description: '学术风格，注重引用和论证',
      config: {
        language: 'zh-CN',
        tone: 'serious',
        lengthPreference: 'long',
        targetAudience: '学术界人士',
        customPrompt: '请以学术研究的角度撰写文章，注重逻辑性和引用的准确性。',
      },
    },
  ];

  res.json({ templates });
});

export default router;