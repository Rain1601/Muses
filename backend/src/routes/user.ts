import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { encrypt } from '../utils/encryption';
import { cache, CacheKeys } from '../utils/cache';

const router = Router();

// 更新用户设置的验证schema
const updateSettingsSchema = z.object({
  openaiKey: z.string().optional(),
  defaultRepoUrl: z.string().url().optional().or(z.literal('')),
  language: z.string().optional(),
  theme: z.string().optional(),
});

// 获取当前用户信息
router.get('/profile', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        settings: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        hasOpenAIKey: !!user.openaiKey,
        defaultRepoUrl: user.defaultRepoUrl,
        settings: user.settings,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ error: 'Failed to get user profile' });
  }
});

// 更新用户设置
router.post('/settings', authenticate, async (req: AuthRequest, res) => {
  try {
    const data = updateSettingsSchema.parse(req.body);
    const userId = req.user!.id;

    // 准备更新数据
    const updateData: any = {};
    
    if (data.openaiKey) {
      // 加密OpenAI Key
      updateData.openaiKey = encrypt(data.openaiKey);
    }
    
    if (data.defaultRepoUrl !== undefined) {
      updateData.defaultRepoUrl = data.defaultRepoUrl || null;
    }

    // 更新用户信息
    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    // 如果有语言或主题设置，更新或创建用户设置
    if (data.language || data.theme) {
      await prisma.userSettings.upsert({
        where: { userId },
        create: {
          userId,
          language: data.language || 'zh-CN',
          theme: data.theme || 'light',
        },
        update: {
          ...(data.language && { language: data.language }),
          ...(data.theme && { theme: data.theme }),
        },
      });
    }

    // 清除缓存
    cache.del(CacheKeys.USER(userId));

    return res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        hasOpenAIKey: !!user.openaiKey,
        defaultRepoUrl: user.defaultRepoUrl,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Update settings error:', error);
    return res.status(500).json({ error: 'Failed to update settings' });
  }
});

// 验证OpenAI Key
router.post('/verify-openai-key', authenticate, async (req: AuthRequest, res) => {
  try {
    const { openaiKey } = z.object({ openaiKey: z.string() }).parse(req.body);
    
    // 这里可以添加实际的OpenAI API验证逻辑
    // 例如尝试调用一个简单的API来验证key是否有效
    console.log('Verifying OpenAI key:', openaiKey.substring(0, 10) + '...');
    
    return res.json({ valid: true });
  } catch (error) {
    return res.status(400).json({ error: 'Invalid OpenAI Key' });
  }
});

export default router;