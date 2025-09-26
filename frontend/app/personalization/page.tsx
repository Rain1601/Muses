"use client";

import { useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/protected-route";
import Navigation from "@/components/Navigation";
import { useUserStore } from "@/store/user";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  Plus,
  Edit2,
  Trash2,
  Save,
  History,
  CheckCircle,
  FileText,
  Settings,
  Copy,
  Download,
  Upload,
  Star,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface MusesConfig {
  id: string;
  name: string;
  description?: string;
  content: string;
  config_type: "user" | "agent" | "template";
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface ConfigTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string;
  template_content: string;
  is_system: boolean;
  usage_count: number;
}

export default function PersonalizationPage() {
  const { user } = useUserStore();
  const { toast } = useToast();
  const [configs, setConfigs] = useState<MusesConfig[]>([]);
  const [templates, setTemplates] = useState<ConfigTemplate[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<MusesConfig | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("configs");

  // 新建配置表单
  const [newConfig, setNewConfig] = useState({
    name: "",
    description: "",
    config_type: "user" as const,
  });

  useEffect(() => {
    fetchConfigs();
    fetchTemplates();
  }, []);

  const fetchConfigs = async () => {
    try {
      setIsLoading(true);
      const response = await api.get("/api/muses-configs");
      setConfigs(response.data);

      // 如果有活跃配置，自动选中
      const activeConfig = response.data.find((c: MusesConfig) => c.is_active);
      if (activeConfig) {
        setSelectedConfig(activeConfig);
        setEditingContent(activeConfig.content);
      } else if (response.data.length > 0) {
        setSelectedConfig(response.data[0]);
        setEditingContent(response.data[0].content);
      }
    } catch (error) {
      console.error("Failed to fetch configs:", error);
      toast({
        title: "加载失败",
        description: "无法加载配置列表",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await api.get("/api/config-templates");
      setTemplates(response.data);
    } catch (error) {
      console.error("Failed to fetch templates:", error);
    }
  };

  const handleCreateConfig = async () => {
    try {
      const defaultContent = `# 个人写作档案

## 专业领域
- [请填写您的专业领域]

## 目标读者
- [请描述您的目标读者群体]

## 写作风格偏好
- 语气: [专业/轻松/幽默]
- 文章长度: [短文/中等/长文]
- 结构偏好: [问题解决型/故事叙述型/列表总结型]

## 常用模板
### 技术教程模板
1. 问题背景
2. 解决方案
3. 实现步骤
4. 总结反思

## 个人品牌声音
- 独特观点: [您的独特见解]
- 价值主张: [您希望传达的核心价值]
`;

      const response = await api.post("/api/muses-configs", {
        ...newConfig,
        content: defaultContent,
      });

      setConfigs([response.data, ...configs]);
      setSelectedConfig(response.data);
      setEditingContent(response.data.content);
      setShowCreateDialog(false);
      setNewConfig({ name: "", description: "", config_type: "user" });

      toast({
        title: "创建成功",
        description: "配置已创建",
      });
    } catch (error) {
      console.error("Failed to create config:", error);
      toast({
        title: "创建失败",
        description: "无法创建配置",
        variant: "destructive",
      });
    }
  };

  const handleSaveConfig = async () => {
    if (!selectedConfig) return;

    try {
      setIsSaving(true);
      await api.put(`/api/muses-configs/${selectedConfig.id}`, {
        content: editingContent,
      });

      // 更新本地状态
      setConfigs(configs.map(c =>
        c.id === selectedConfig.id
          ? { ...c, content: editingContent, updated_at: new Date().toISOString() }
          : c
      ));

      toast({
        title: "保存成功",
        description: "配置已更新",
      });
    } catch (error) {
      console.error("Failed to save config:", error);
      toast({
        title: "保存失败",
        description: "无法保存配置",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleActivateConfig = async (configId: string) => {
    try {
      await api.post(`/api/muses-configs/${configId}/activate`);

      // 更新本地状态
      setConfigs(configs.map(c => ({
        ...c,
        is_active: c.id === configId,
      })));

      toast({
        title: "激活成功",
        description: "配置已激活",
      });
    } catch (error) {
      console.error("Failed to activate config:", error);
      toast({
        title: "激活失败",
        description: "无法激活配置",
        variant: "destructive",
      });
    }
  };

  const handleDeleteConfig = async (configId: string) => {
    if (!confirm("确定要删除这个配置吗？")) return;

    try {
      await api.delete(`/api/muses-configs/${configId}`);

      setConfigs(configs.filter(c => c.id !== configId));
      if (selectedConfig?.id === configId) {
        setSelectedConfig(null);
        setEditingContent("");
      }

      toast({
        title: "删除成功",
        description: "配置已删除",
      });
    } catch (error) {
      console.error("Failed to delete config:", error);
      toast({
        title: "删除失败",
        description: "无法删除配置",
        variant: "destructive",
      });
    }
  };

  const handleUseTemplate = async (template: ConfigTemplate) => {
    setEditingContent(template.template_content);
    setShowTemplateDialog(false);

    // 记录模板使用
    try {
      await api.post(`/api/config-templates/${template.id}/use`);
    } catch (error) {
      console.error("Failed to record template usage:", error);
    }

    toast({
      title: "模板已应用",
      description: "您可以基于此模板进行修改",
    });
  };

  const handleExportConfig = () => {
    if (!selectedConfig) return;

    const dataStr = JSON.stringify(selectedConfig, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `muses-config-${selectedConfig.name}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "导出成功",
      description: "配置已导出",
    });
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navigation />

        <main className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">个性化配置</h1>
            <p className="text-muted-foreground">
              管理您的MUSES写作配置，定制AI生成内容的风格和偏好
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="configs">我的配置</TabsTrigger>
              <TabsTrigger value="templates">配置模板</TabsTrigger>
              <TabsTrigger value="guide">使用指南</TabsTrigger>
            </TabsList>

            <TabsContent value="configs">
              <div className="grid grid-cols-12 gap-6">
                {/* 配置列表 */}
                <div className="col-span-3">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">配置列表</CardTitle>
                      <Button
                        size="sm"
                        onClick={() => setShowCreateDialog(true)}
                        className="w-full"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        新建配置
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {isLoading ? (
                        <div className="text-center py-4 text-muted-foreground">
                          加载中...
                        </div>
                      ) : configs.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground">
                          暂无配置
                        </div>
                      ) : (
                        configs.map((config) => (
                          <div
                            key={config.id}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                              selectedConfig?.id === config.id
                                ? "border-primary bg-primary/5"
                                : "border-border hover:bg-muted/50"
                            }`}
                            onClick={() => {
                              setSelectedConfig(config);
                              setEditingContent(config.content);
                            }}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-medium">{config.name}</div>
                                {config.description && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {config.description}
                                  </div>
                                )}
                                <div className="flex items-center gap-2 mt-2">
                                  {config.is_active && (
                                    <span className="inline-flex items-center text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      活跃
                                    </span>
                                  )}
                                  {config.is_default && (
                                    <span className="inline-flex items-center text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                      默认
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* 编辑器 */}
                <div className="col-span-9">
                  {selectedConfig ? (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle>{selectedConfig.name}</CardTitle>
                            {selectedConfig.description && (
                              <CardDescription className="mt-1">
                                {selectedConfig.description}
                              </CardDescription>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {!selectedConfig.is_active && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleActivateConfig(selectedConfig.id)}
                              >
                                <Star className="w-4 h-4 mr-2" />
                                激活
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleExportConfig}
                            >
                              <Download className="w-4 h-4 mr-2" />
                              导出
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowTemplateDialog(true)}
                            >
                              <FileText className="w-4 h-4 mr-2" />
                              使用模板
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteConfig(selectedConfig.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <Textarea
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                            className="min-h-[500px] font-mono text-sm"
                            placeholder="在此编辑您的MUSES配置..."
                          />
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-muted-foreground">
                              支持Markdown格式 | 最后更新: {new Date(selectedConfig.updated_at).toLocaleString()}
                            </div>
                            <Button
                              onClick={handleSaveConfig}
                              disabled={isSaving || editingContent === selectedConfig.content}
                            >
                              {isSaving ? (
                                <>
                                  <Save className="w-4 h-4 mr-2 animate-spin" />
                                  保存中...
                                </>
                              ) : (
                                <>
                                  <Save className="w-4 h-4 mr-2" />
                                  保存配置
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="py-12">
                        <div className="text-center text-muted-foreground">
                          <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>选择一个配置进行编辑，或创建新的配置</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="templates">
              <div className="grid grid-cols-3 gap-4">
                {templates.map((template) => (
                  <Card key={template.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{template.name}</CardTitle>
                          {template.category && (
                            <span className="inline-block mt-2 text-xs bg-muted px-2 py-1 rounded">
                              {template.category}
                            </span>
                          )}
                        </div>
                        {template.is_system && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            系统
                          </span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{template.description}</p>
                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          使用 {template.usage_count} 次
                        </span>
                        <Button
                          size="sm"
                          onClick={() => handleUseTemplate(template)}
                        >
                          使用模板
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="guide">
              <Card>
                <CardHeader>
                  <CardTitle>MUSES配置使用指南</CardTitle>
                </CardHeader>
                <CardContent className="prose max-w-none">
                  <div className="space-y-6">
                    <section>
                      <h3 className="text-lg font-semibold mb-3">什么是MUSES配置？</h3>
                      <p className="text-muted-foreground">
                        MUSES配置是您的个性化写作档案，它帮助AI更好地理解您的写作风格、偏好和需求。
                        通过配置文件，您可以定义专业领域、目标读者、写作风格、常用模板等信息。
                      </p>
                    </section>

                    <section>
                      <h3 className="text-lg font-semibold mb-3">配置结构说明</h3>
                      <div className="space-y-2">
                        <div className="p-3 bg-muted rounded-lg">
                          <h4 className="font-medium">个人写作档案</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            包含您的专业领域、目标读者、写作经验等基本信息
                          </p>
                        </div>
                        <div className="p-3 bg-muted rounded-lg">
                          <h4 className="font-medium">内容偏好设置</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            定义文章类型、长度、结构和写作风格偏好
                          </p>
                        </div>
                        <div className="p-3 bg-muted rounded-lg">
                          <h4 className="font-medium">模板和结构库</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            预定义常用的文章结构和开头结尾模式
                          </p>
                        </div>
                        <div className="p-3 bg-muted rounded-lg">
                          <h4 className="font-medium">个人品牌声音</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            独特观点、价值主张和个人故事背景
                          </p>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h3 className="text-lg font-semibold mb-3">最佳实践</h3>
                      <ul className="space-y-2 text-muted-foreground">
                        <li className="flex items-start">
                          <span className="mr-2">•</span>
                          保持配置内容的更新，确保反映您最新的写作需求
                        </li>
                        <li className="flex items-start">
                          <span className="mr-2">•</span>
                          为不同类型的写作任务创建多个配置
                        </li>
                        <li className="flex items-start">
                          <span className="mr-2">•</span>
                          使用具体的例子和详细的描述，帮助AI更好地理解您的意图
                        </li>
                        <li className="flex items-start">
                          <span className="mr-2">•</span>
                          定期导出备份重要配置，避免数据丢失
                        </li>
                      </ul>
                    </section>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>

        {/* 创建配置对话框 */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建新配置</DialogTitle>
              <DialogDescription>
                创建一个新的MUSES配置文件
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="config-name">配置名称</Label>
                <Input
                  id="config-name"
                  value={newConfig.name}
                  onChange={(e) => setNewConfig({ ...newConfig, name: e.target.value })}
                  placeholder="例如：技术博客写作配置"
                />
              </div>
              <div>
                <Label htmlFor="config-description">描述（可选）</Label>
                <Textarea
                  id="config-description"
                  value={newConfig.description}
                  onChange={(e) => setNewConfig({ ...newConfig, description: e.target.value })}
                  placeholder="简要描述这个配置的用途"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="config-type">配置类型</Label>
                <Select
                  value={newConfig.config_type}
                  onValueChange={(value) => setNewConfig({ ...newConfig, config_type: value as "user" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">用户配置</SelectItem>
                    <SelectItem value="agent">Agent配置</SelectItem>
                    <SelectItem value="template">模板配置</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                取消
              </Button>
              <Button onClick={handleCreateConfig} disabled={!newConfig.name}>
                创建
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 模板选择对话框 */}
        <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>选择配置模板</DialogTitle>
              <DialogDescription>
                选择一个模板作为起点，您可以基于模板进行修改
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="p-4 border rounded-lg cursor-pointer hover:bg-muted/50"
                  onClick={() => handleUseTemplate(template)}
                >
                  <div className="font-medium">{template.name}</div>
                  {template.description && (
                    <div className="text-sm text-muted-foreground mt-1">
                      {template.description}
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    {template.category && (
                      <span className="text-xs bg-muted px-2 py-1 rounded">
                        {template.category}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      使用 {template.usage_count} 次
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
}