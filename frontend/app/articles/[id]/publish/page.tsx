"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ProtectedRoute } from "@/components/protected-route";
import { Navbar } from "@/components/navbar";
import axios from "axios";

interface Article {
  id: string;
  title: string;
  publishStatus: string;
  githubUrl?: string;
}

interface Repo {
  name: string;
  fullName: string;
  url: string;
}

export default function PublishArticlePage() {
  const router = useRouter();
  const params = useParams();
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

  useEffect(() => {
    fetchData();
  }, [articleId]);

  const fetchData = async () => {
    try {
      // 获取文章信息
      const articleRes = await axios.get(`/api/articles/${articleId}`);
      const articleData = articleRes.data.article;
      setArticle(articleData);
      
      // 生成默认文件路径
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const slug = articleData.title
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
        .replace(/^-|-$/g, '');
      setFilePath(`posts/${year}/${month}/${slug}.md`);
      setCommitMessage(`Add article: ${articleData.title}`);

      // 获取用户的仓库列表
      const reposRes = await axios.get("/api/publish/repos");
      setRepos(reposRes.data.repos);
      
      // 设置默认仓库
      const user = await axios.get("/api/user/profile");
      if (user.data.user.defaultRepoUrl) {
        setSelectedRepo(user.data.user.defaultRepoUrl);
      } else if (reposRes.data.repos.length > 0) {
        setSelectedRepo(reposRes.data.repos[0].url);
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
      const response = await axios.post("/api/publish/github", {
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

  if (isLoading || !article) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navbar />
        
        <main className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="mb-8">
            <Link
              href={`/articles/${articleId}/edit`}
              className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block"
            >
              ← 返回编辑
            </Link>
            <h1 className="text-2xl font-bold">发布到 GitHub</h1>
          </div>

          {article.githubUrl && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
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
              <label className="block text-sm font-medium mb-2">
                选择仓库 *
              </label>
              {repos.length === 0 ? (
                <div className="p-4 border rounded-lg text-center">
                  <p className="text-muted-foreground mb-2">
                    未找到可用的GitHub仓库
                  </p>
                  <a
                    href="https://github.com/new"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline text-sm"
                  >
                    创建新仓库
                  </a>
                </div>
              ) : (
                <select
                  value={selectedRepo}
                  onChange={(e) => setSelectedRepo(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">请选择仓库</option>
                  {repos.map((repo) => (
                    <option key={repo.fullName} value={repo.url}>
                      {repo.fullName}
                    </option>
                  ))}
                </select>
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
                href={`/articles/${articleId}/edit`}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-muted text-center"
              >
                返回编辑
              </Link>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}