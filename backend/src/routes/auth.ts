import { Router } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';
import { z } from 'zod';

const router = Router();

// GitHub OAuth配置
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// 验证schema
const githubCallbackSchema = z.object({
  code: z.string(),
});

// GitHub OAuth URL
router.get('/github', (req, res) => {
  const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/github/callback`;
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${redirectUri}&scope=repo,user:email`;
  res.redirect(githubAuthUrl);
});

// GitHub OAuth回调
router.get('/github/callback', async (req, res) => {
  try {
    const { code } = githubCallbackSchema.parse(req.query);

    // 1. 使用code换取access token
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
      },
      {
        headers: {
          Accept: 'application/json',
        },
      }
    );

    const { access_token } = tokenResponse.data;

    if (!access_token) {
      throw new Error('Failed to get access token');
    }

    // 2. 使用access token获取用户信息
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const githubUser = userResponse.data;

    // 3. 获取用户邮箱（可能需要额外请求）
    let email = githubUser.email;
    if (!email) {
      const emailResponse = await axios.get('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });
      const primaryEmail = emailResponse.data.find((e: any) => e.primary);
      email = primaryEmail?.email;
    }

    // 4. 创建或更新用户
    const { encrypt } = await import('../utils/encryption');
    const encryptedToken = encrypt(access_token);
    
    const user = await prisma.user.upsert({
      where: { githubId: githubUser.id.toString() },
      update: {
        username: githubUser.login,
        email,
        avatarUrl: githubUser.avatar_url,
        githubToken: encryptedToken,
      },
      create: {
        githubId: githubUser.id.toString(),
        username: githubUser.login,
        email,
        avatarUrl: githubUser.avatar_url,
        githubToken: encryptedToken,
      },
    });

    // 5. 生成JWT token
    const token = jwt.sign(
      { userId: user.id, githubId: user.githubId },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    // 6. 重定向到前端，带上token
    const isNewUser = !user.openaiKey;
    const redirectPath = isNewUser ? '/onboarding' : '/dashboard';
    res.redirect(`${FRONTEND_URL}${redirectPath}?token=${token}`);
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    res.redirect(`${FRONTEND_URL}/login?error=auth_failed`);
  }
});

// 验证token
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        hasOpenAIKey: !!user.openaiKey,
      },
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// 登出
router.post('/logout', (req, res) => {
  // 前端会清除token
  res.json({ success: true });
});

export default router;