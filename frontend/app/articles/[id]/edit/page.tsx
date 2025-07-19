"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ProtectedRoute } from "@/components/protected-route";
import { Navbar } from "@/components/navbar";
import ReactMarkdown from "react-markdown";
import axios from "axios";

interface Article {
  id: string;
  title: string;
  content: string;
  summary?: string;
  publishStatus: string;
  agent: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export default function EditArticlePage() {
  const router = useRouter();
  const params = useParams();
  const articleId = params.id as string;

  const [article, setArticle] = useState<Article | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiInstruction, setAiInstruction] = useState("");

  useEffect(() => {
    fetchArticle();
  }, [articleId]);

  const fetchArticle = async () => {
    try {
      const response = await axios.get(`/api/articles/${articleId}`);
      const data = response.data.article;
      setArticle(data);
      setTitle(data.title);
      setContent(data.content);
    } catch (error) {
      console.error("Failed to fetch article:", error);
      router.push("/dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await axios.put(`/api/articles/${articleId}`, {
        title,
        content,
      });
      alert("保存成功");
    } catch (error) {
      alert("保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!confirm("确定要发布这篇文章吗？")) return;
    
    setIsSaving(true);
    try {
      await axios.put(`/api/articles/${articleId}`, {
        title,
        content,
        publishStatus: "published",
      });
      router.push(`/articles/${articleId}/publish`);
    } catch (error) {
      alert("发布失败");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAIImprove = async () => {
    if (!aiInstruction.trim()) {
      alert("请输入改进要求");
      return;
    }

    setIsSaving(true);
    try {
      const response = await axios.post("/api/generate/improve", {
        articleId,
        agentId: article?.agent.id,
        instructions: aiInstruction,
      });
      
      setContent(response.data.article.content);
      setAiInstruction("");
      alert("AI优化完成");
    } catch (error) {
      alert("优化失败");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!article) return null;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navbar />

        {/* 编辑器顶部工具栏 */}
        <div className="border-b bg-background sticky top-0 z-10">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Link
                  href="/dashboard"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  ← 返回
                </Link>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-xl font-bold bg-transparent border-0 focus:outline-none"
                  placeholder="文章标题"
                />
              </div>
              
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="px-3 py-1.5 text-sm border rounded-lg hover:bg-muted"
                >
                  {showPreview ? "编辑" : "预览"}
                </button>
                <button
                  onClick={() => setShowAIPanel(!showAIPanel)}
                  className="px-3 py-1.5 text-sm border rounded-lg hover:bg-muted"
                >
                  AI助手
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-1.5 text-sm border rounded-lg hover:bg-muted"
                >
                  {isSaving ? "保存中..." : "保存草稿"}
                </button>
                <button
                  onClick={handlePublish}
                  disabled={isSaving}
                  className="px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90"
                >
                  发布
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* 主编辑区 */}
            <div className="lg:col-span-3">
              {showPreview ? (
                <div className="prose prose-lg max-w-none p-6 bg-background border rounded-lg">
                  <h1>{title}</h1>
                  <ReactMarkdown>{content}</ReactMarkdown>
                </div>
              ) : (
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full h-[600px] p-6 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none font-mono"
                  placeholder="开始编写您的文章..."
                />
              )}
            </div>

            {/* 侧边栏 */}
            <div className="space-y-6">
              {/* 文章信息 */}
              <div className="p-4 border rounded-lg">
                <h3 className="font-medium mb-3">文章信息</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">使用Agent</span>
                    <div className="flex items-center space-x-2">
                      <span>{article.agent.avatar || "🤖"}</span>
                      <span>{article.agent.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">状态</span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        article.publishStatus === "published"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {article.publishStatus === "published" ? "已发布" : "草稿"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">字数</span>
                    <span>{content.length} 字</span>
                  </div>
                </div>
              </div>

              {/* AI助手面板 */}
              {showAIPanel && (
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-3">AI助手</h3>
                  <div className="space-y-3">
                    <textarea
                      value={aiInstruction}
                      onChange={(e) => setAiInstruction(e.target.value)}
                      className="w-full h-24 p-3 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      placeholder="告诉AI您想如何改进文章..."
                    />
                    <button
                      onClick={handleAIImprove}
                      disabled={isSaving}
                      className="w-full py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 text-sm"
                    >
                      {isSaving ? "优化中..." : "AI优化"}
                    </button>
                    
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>快捷指令：</p>
                      <button
                        onClick={() => setAiInstruction("请帮我优化文章结构，使逻辑更清晰")}
                        className="block w-full text-left px-2 py-1 hover:bg-muted rounded"
                      >
                        • 优化结构
                      </button>
                      <button
                        onClick={() => setAiInstruction("请帮我检查并修正语法错误")}
                        className="block w-full text-left px-2 py-1 hover:bg-muted rounded"
                      >
                        • 检查语法
                      </button>
                      <button
                        onClick={() => setAiInstruction("请帮我扩充内容，添加更多细节")}
                        className="block w-full text-left px-2 py-1 hover:bg-muted rounded"
                      >
                        • 扩充内容
                      </button>
                      <button
                        onClick={() => setAiInstruction("请帮我精简内容，保留核心观点")}
                        className="block w-full text-left px-2 py-1 hover:bg-muted rounded"
                      >
                        • 精简内容
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Markdown 语法提示 */}
              <div className="p-4 border rounded-lg">
                <h3 className="font-medium mb-3">Markdown 语法</h3>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div># 一级标题</div>
                  <div>## 二级标题</div>
                  <div>**粗体文本**</div>
                  <div>*斜体文本*</div>
                  <div>`行内代码`</div>
                  <div>```代码块```</div>
                  <div>[链接文本](URL)</div>
                  <div>![图片描述](URL)</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}