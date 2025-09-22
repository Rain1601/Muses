'use client';

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import Navigation from "@/components/Navigation";
import { useUserStore } from "@/store/user";

interface Article {
  id: string;
  title: string;
  publishStatus: string;
  githubUrl?: string;
  repoPath?: string;
  createdAt: string;
  firstSyncAt?: string;
  lastSyncAt?: string;
}

interface Repo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string;
  updated_at: string;
}

export default function PublishArticlePage() {
  const router = useRouter();
  const params = useParams();
  const { user, isLoading: userLoading } = useUserStore();
  const articleId = params.id as string;

  const [article, setArticle] = useState<Article | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [filePath, setFilePath] = useState("");
  const [commitMessage, setCommitMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{
    success?: boolean;
    url?: string;
    error?: string;
  } | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [showManualRepo, setShowManualRepo] = useState(false);
  const [manualRepoUrl, setManualRepoUrl] = useState("");

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/');
      return;
    }
    
    if (user && articleId) {
      fetchData();
    }
  }, [articleId, user, userLoading, router]);

  const fetchData = async () => {
    try {
      // 获取文章信息
      const articleRes = await api.get(`/api/articles/${articleId}`);
      const articleData = articleRes.data.article;
      setArticle(articleData);
      
      // 生成默认文件路径 - 使用首次同步时间（精确到分钟）
      // 如果文章已经有保存的路径，使用保存的路径
      if (articleData.repoPath) {
        setFilePath(articleData.repoPath);
        setCommitMessage(`Update article: ${articleData.title}`);
      } else {
        // 使用首次同步时间或当前时间生成路径（精确到日期）
        const syncDate = articleData.firstSyncAt
          ? new Date(articleData.firstSyncAt)
          : new Date(); // 如果是首次同步，使用当前时间

        const year = syncDate.getFullYear();
        const month = String(syncDate.getMonth() + 1).padStart(2, '0');
        const day = String(syncDate.getDate()).padStart(2, '0');

        const slug = articleData.title
          .toLowerCase()
          .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
          .replace(/^-|-$/g, '');

        // 文件名格式：posts/年/月/年-月-日-标题.md
        setFilePath(`posts/${year}/${month}/${year}-${month}-${day}-${slug}.md`);
        setCommitMessage(`Add article: ${articleData.title}`);
      }

      // 获取用户的仓库列表
      console.log('Fetching repos...');
      const reposRes = await api.get("/api/publish/repos");
      console.log('Repos response:', reposRes.data);
      setRepos(reposRes.data.repos || []);
      
      // 设置默认仓库
      const user = await api.get("/api/auth/verify");
      if (user.data.user.defaultRepoUrl) {
        setSelectedRepo(user.data.user.defaultRepoUrl);
      } else if (reposRes.data.repos && reposRes.data.repos.length > 0) {
        setSelectedRepo(reposRes.data.repos[0].html_url);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedRepo) {
      alert("请选择发布仓库");
      return;
    }
    
    if (!filePath.trim()) {
      alert("请输入文件路径");
      return;
    }

    setIsPublishing(true);
    setPublishResult(null);

    try {
      const response = await api.post("/api/publish/github", {
        articleId,
        repoUrl: selectedRepo,
        filePath: filePath.trim(),
        commitMessage: commitMessage.trim(),
      });

      setPublishResult({
        success: true,
        url: response.data.url,
      });
    } catch (error: any) {
      setPublishResult({
        success: false,
        error: error.response?.data?.error || "发布失败",
      });
    } finally {
      setIsPublishing(false);
    }
  };

  if (userLoading || isLoading || !article) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <Link
            href={`/articles/${articleId}`}
            className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block"
          >
            ← 返回文章
          </Link>
          <h1 className="text-2xl font-bold">发布到 GitHub</h1>
        </div>

        {article.githubUrl && (
          <div className="mb-6 p-4 bg-accent/10 border border-accent/30 rounded-lg">
            <p className="text-sm text-accent-foreground">
              这篇文章已经发布过，重新发布将覆盖原文件
            </p>
            <a
              href={article.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline"
            >
              查看已发布的文章 →
            </a>
          </div>
        )}

        <div className="space-y-6">
          {/* 选择仓库 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">
                选择仓库 *
              </label>
              <button
                onClick={fetchData}
                disabled={isLoading}
                className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
              >
                {isLoading ? '刷新中...' : '🔄 刷新列表'}
              </button>
            </div>
            <div className="mb-3 p-3 bg-accent/10 border border-accent/30 rounded-lg">
              <p className="text-sm text-accent-foreground mb-2">
                💡 <strong>推荐</strong>：创建一个专用的博客仓库来管理你的文章
              </p>
              <div className="flex gap-2 text-xs">
                <a
                  href="https://github.com/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  创建新仓库
                </a>
                <span className="text-blue-600">|</span>
                <button
                  onClick={() => setShowGuide(!showGuide)}
                  className="text-blue-600 hover:underline"
                >
                  配置指南
                </button>
              </div>
            </div>
            
            {/* 配置指南 */}
            {showGuide && (
              <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                <h3 className="font-semibold mb-3">🚀 GitHub仓库配置指南</h3>
                
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium text-blue-800">1. 创建专用仓库</h4>
                    <p className="text-gray-600">推荐仓库名：<code className="bg-gray-200 px-1 rounded">my-blog</code>、<code className="bg-gray-200 px-1 rounded">personal-blog</code>、<code className="bg-gray-200 px-1 rounded">tech-articles</code></p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-blue-800">2. 推荐目录结构</h4>
                    <pre className="bg-gray-100 p-2 rounded text-xs">
{`your-blog-repo/
├── posts/
│   ├── 2024/
│   │   ├── 01/
│   │   └── 02/
│   └── 2023/
├── drafts/
└── README.md`}
                    </pre>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-blue-800">3. 权限说明</h4>
                    <p className="text-gray-600">✅ 通过GitHub OAuth自动获取权限，无需额外配置</p>
                    <p className="text-gray-600">✅ 只能访问你账号下的仓库，安全可靠</p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-blue-800">4. 文件路径示例</h4>
                    <div className="space-y-1 text-xs">
                      <p>✅ <code className="bg-green-100 px-1 rounded">posts/2024/07/my-article.md</code></p>
                      <p>✅ <code className="bg-green-100 px-1 rounded">docs/guides/setup.md</code></p>
                      <p>✅ <code className="bg-green-100 px-1 rounded">README.md</code></p>
                      <p>❌ <code className="bg-red-100 px-1 rounded">/posts/article.md</code> (不要以/开头)</p>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => setShowGuide(false)}
                  className="mt-3 text-xs text-gray-500 hover:text-gray-700"
                >
                  收起指南 ↑
                </button>
              </div>
            )}
            
            {repos.length === 0 ? (
              <div className="p-4 border rounded-lg text-center">
                <p className="text-muted-foreground mb-3">
                  暂无可用仓库，请先创建一个GitHub仓库
                </p>
                <div className="space-y-2">
                  <a
                    href="https://github.com/new"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 text-sm"
                  >
                    创建博客仓库
                  </a>
                  <p className="text-xs text-muted-foreground">
                    建议仓库名：my-blog, personal-blog 等
                  </p>
                </div>
              </div>
            ) : (
              <select
                value={selectedRepo}
                onChange={(e) => setSelectedRepo(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">请选择仓库</option>
                {repos.map((repo) => (
                  <option key={repo.full_name} value={repo.html_url}>
                    {repo.full_name}
                  </option>
                ))}
              </select>
            )}
            
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowManualRepo(!showManualRepo)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {showManualRepo ? '隐藏' : '手动添加仓库 URL'}
              </button>
            </div>
            
            {showManualRepo && (
              <div className="mt-3">
                <input
                  type="text"
                  value={manualRepoUrl}
                  onChange={(e) => setManualRepoUrl(e.target.value)}
                  placeholder="https://github.com/username/repo-name"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (manualRepoUrl.trim()) {
                      setSelectedRepo(manualRepoUrl.trim());
                      setShowManualRepo(false);
                      setManualRepoUrl("");
                    }
                  }}
                  disabled={!manualRepoUrl.trim()}
                  className="mt-2 px-3 py-1 bg-primary text-primary-foreground text-sm rounded hover:bg-primary/90 disabled:opacity-50"
                >
                  使用此仓库
                </button>
                <p className="text-xs text-gray-500 mt-1">
                  输入完整的GitHub仓库URL，格式：https://github.com/用户名/仓库名
                </p>
              </div>
            )}
          </div>

          {/* 文件路径 */}
          <div>
            <label className="block text-sm font-medium mb-2">
              文件路径 *
            </label>
            <input
              type="text"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="例如：posts/2024/01/my-article.md"
            />
            <p className="text-xs text-muted-foreground mt-1">
              文件将保存在仓库的此路径下
            </p>
          </div>

          {/* 提交信息 */}
          <div>
            <label className="block text-sm font-medium mb-2">
              提交信息
            </label>
            <input
              type="text"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="描述这次提交的内容"
            />
          </div>

          {/* 预览信息 */}
          <div className="p-4 bg-muted rounded-lg">
            <h3 className="font-medium mb-2">发布预览</h3>
            <div className="space-y-1 text-sm">
              <div>
                <span className="text-muted-foreground">文章标题：</span>
                {article.title}
              </div>
              <div>
                <span className="text-muted-foreground">目标仓库：</span>
                {selectedRepo ? selectedRepo.replace('https://github.com/', '') : '未选择'}
              </div>
              <div>
                <span className="text-muted-foreground">文件路径：</span>
                {filePath || '未设置'}
              </div>
            </div>
          </div>

          {/* 发布结果 */}
          {publishResult && (
            <div
              className={`p-4 rounded-lg ${
                publishResult.success
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              {publishResult.success ? (
                <div>
                  <p className="text-green-800 font-medium mb-2">
                    发布成功！
                  </p>
                  <a
                    href={publishResult.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-600 hover:underline text-sm"
                  >
                    查看发布的文章 →
                  </a>
                </div>
              ) : (
                <p className="text-red-800">
                  发布失败：{publishResult.error}
                </p>
              )}
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-4">
            <button
              onClick={handlePublish}
              disabled={isPublishing || !selectedRepo || !filePath}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {isPublishing ? "发布中..." : "发布文章"}
            </button>
            <Link
              href={`/articles/${articleId}`}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-muted text-center"
            >
              返回文章
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}