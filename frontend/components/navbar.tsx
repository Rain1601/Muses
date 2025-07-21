"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUserStore } from "@/store/user";
import { ThemeToggle } from "@/components/theme-toggle";

export function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useUserStore();

  if (!user) return null;

  const navItems = [
    { href: "/dashboard", label: "工作台" },
    { href: "/agents", label: "Agent管理" },
    { href: "/articles", label: "文章列表" },
    { href: "/settings", label: "设置" },
  ];

  return (
    <header className="border-b bg-background">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/dashboard" className="text-2xl font-bold">
              Muses
            </Link>
            <nav className="hidden md:flex space-x-6">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`transition-colors ${
                    pathname === item.href
                      ? "text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <Link
              href="/articles/new"
              className="hidden md:inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 text-sm"
            >
              新建文章
            </Link>
            <div className="flex items-center space-x-3">
              <span className="text-sm text-muted-foreground">
                {user.username}
              </span>
              {user.avatarUrl && (
                <img
                  src={user.avatarUrl}
                  alt={user.username}
                  className="w-8 h-8 rounded-full"
                />
              )}
              <button
                onClick={logout}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                退出
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}