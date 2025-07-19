import axios from 'axios';
import { prisma } from '../index';

interface PublishParams {
  userId: string;
  articleId: string;
  repoUrl: string;
  filePath: string;
  commitMessage: string;
}

export class GitHubService {
  private async getGitHubToken(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { githubToken: true },
    });

    if (!user?.githubToken) {
      throw new Error('GitHub token not found');
    }

    const { decrypt } = await import('../utils/encryption');
    return decrypt(user.githubToken);
  }

  async publishArticle({
    userId,
    articleId,
    repoUrl,
    filePath,
    commitMessage,
  }: PublishParams): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      // 获取文章内容
      const article = await prisma.article.findFirst({
        where: { id: articleId, userId },
      });

      if (!article) {
        return { success: false, error: '文章不存在' };
      }

      // 解析仓库信息
      const repoMatch = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!repoMatch) {
        return { success: false, error: '无效的GitHub仓库URL' };
      }

      const [, owner, repo] = repoMatch;
      const token = await this.getGitHubToken(userId);

      // 构建文件内容（添加前置信息）
      const frontMatter = `---
title: ${article.title}
date: ${new Date().toISOString()}
summary: ${article.summary || ''}
---

`;
      const content = frontMatter + article.content;
      const encodedContent = Buffer.from(content).toString('base64');

      // 检查文件是否已存在
      let sha: string | undefined;
      try {
        const existingFile = await axios.get(
          `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.github.v3+json',
            },
          }
        );
        sha = existingFile.data.sha;
      } catch (error: any) {
        // 文件不存在，这是正常的
        if (error.response?.status !== 404) {
          throw error;
        }
      }

      // 创建或更新文件
      const response = await axios.put(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
        {
          message: commitMessage,
          content: encodedContent,
          sha, // 如果文件存在，需要提供sha
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      // 更新文章发布信息
      await prisma.article.update({
        where: { id: articleId },
        data: {
          publishStatus: 'published',
          publishedAt: new Date(),
          githubUrl: response.data.content.html_url,
          repoPath: filePath,
        },
      });

      return {
        success: true,
        url: response.data.content.html_url,
      };
    } catch (error: any) {
      console.error('GitHub publish error:', error);
      return {
        success: false,
        error: error.response?.data?.message || '发布失败',
      };
    }
  }

  async getUserRepos(userId: string): Promise<Array<{ name: string; fullName: string; url: string }>> {
    try {
      const token = await this.getGitHubToken(userId);
      
      const response = await axios.get('https://api.github.com/user/repos', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
        params: {
          sort: 'updated',
          per_page: 100,
        },
      });

      return response.data.map((repo: any) => ({
        name: repo.name,
        fullName: repo.full_name,
        url: repo.html_url,
      }));
    } catch (error) {
      console.error('Get repos error:', error);
      return [];
    }
  }
}

export const githubService = new GitHubService();