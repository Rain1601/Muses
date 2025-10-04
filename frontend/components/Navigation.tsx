import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useUserStore } from '@/store/user';
import { useAIAssistantStore } from '@/store/aiAssistant';
import { ThemeToggle } from '@/components/theme-toggle';
import { TaskCenter } from '@/components/TaskCenter';
import { Sparkles, ClipboardList } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Navigation() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useUserStore();
  const { isEnabled: aiAssistantEnabled, toggleEnabled: toggleAIAssistant } = useAIAssistantStore();
  const [isTaskCenterOpen, setIsTaskCenterOpen] = useState(false);
  const [hasRunningTasks, setHasRunningTasks] = useState(false);

  // 添加 Cmd+O 快捷键支持
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'o') {
        event.preventDefault();
        toggleAIAssistant();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleAIAssistant]);

  // 检查是否有运行中的任务
  useEffect(() => {
    const checkRunningTasks = () => {
      try {
        const storedTasks = localStorage.getItem('muses_tasks');
        if (storedTasks) {
          const tasks = JSON.parse(storedTasks);
          const running = tasks.some((t: any) => t.status === 'pending' || t.status === 'running');
          setHasRunningTasks(running);
        } else {
          setHasRunningTasks(false);
        }
      } catch (error) {
        console.error('Failed to check running tasks:', error);
      }
    };

    checkRunningTasks();
    const interval = setInterval(checkRunningTasks, 2000);
    return () => clearInterval(interval);
  }, []);

  if (!user) return null;

  const navItems = [
    { href: '/dashboard', label: '工作台' },
    { href: '/agents', label: 'Agent管理' },
    { href: '/personalization', label: '个性化配置' },
    { href: '/settings', label: '设置' },
  ];

  const handleArticleClick = (articleId: string) => {
    setIsTaskCenterOpen(false);
    router.push(`/dashboard?article=${articleId}`);
  };

  return (
    <>
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm transition-colors duration-300">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/dashboard" className="flex items-center space-x-3 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/30 dark:from-primary/30 dark:to-accent/40 flex items-center justify-center transition-all duration-200 group-hover:from-primary/30 group-hover:to-accent/40 dark:group-hover:from-primary/40 dark:group-hover:to-accent/50 shadow-sm">
                <img
                  src="/materials/images/icons/feather-brown.svg"
                  alt="Muses"
                  className="w-5 h-5"
                />
              </div>
              <span className="text-xl font-semibold text-foreground">Muses</span>
            </Link>
            <nav className="flex space-x-6">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    pathname.startsWith(item.href) && (item.href !== '/dashboard' || pathname === '/dashboard')
                      ? 'text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  }
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleAIAssistant}
              className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-300 ${
                aiAssistantEnabled
                  ? 'bg-primary text-primary-foreground shadow-md hover:shadow-lg hover:bg-primary/90 border border-primary'
                  : 'bg-muted/50 hover:bg-muted border border-border text-muted-foreground hover:text-foreground hover:border-primary/50'
              }`}
              title={aiAssistantEnabled ? 'AI辅助：开启 (Cmd+O 切换)' : 'AI辅助：关闭 (Cmd+O 开启)'}
            >
              <Sparkles className={`w-4 h-4 transition-all duration-300 ${
                aiAssistantEnabled
                  ? ''
                  : 'hover:scale-110'
              }`} />
            </button>

            {/* 任务中心按钮 */}
            <button
              onClick={() => setIsTaskCenterOpen(true)}
              className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-muted/50 hover:bg-muted border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all duration-300"
              title="任务中心"
            >
              <ClipboardList className="w-4 h-4" />
              {hasRunningTasks && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              )}
            </button>

            <ThemeToggle />
            <span className="text-sm text-muted-foreground">
              {user.username}
            </span>
            {user.avatarUrl && (
              <img
                src={user.avatarUrl}
                alt={user.username}
                className="w-8 h-8 rounded-full transition-all duration-200 hover:scale-105"
              />
            )}
            <button
              onClick={logout}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              退出
            </button>
          </div>
        </div>
      </div>
      </header>

      {/* 任务中心对话框 */}
      <TaskCenter
        isOpen={isTaskCenterOpen}
        onClose={() => setIsTaskCenterOpen(false)}
        onArticleClick={handleArticleClick}
      />
    </>
  );
}