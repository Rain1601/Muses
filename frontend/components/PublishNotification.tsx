"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Info, ExternalLink } from "lucide-react";

export type NotificationType = "success" | "error" | "info";

interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  isRepositoryLink?: boolean;
  repositoryUrl?: string;
}

interface PublishNotificationProps {
  notifications: Notification[];
  onComplete?: () => void;
}

export function PublishNotification({ notifications, onComplete }: PublishNotificationProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (notifications.length === 0) return;

    if (currentIndex < notifications.length) {
      setIsVisible(true);
      setIsLeaving(false);

      const timer = setTimeout(() => {
        setIsLeaving(true);
        setTimeout(() => {
          setIsVisible(false);
          setCurrentIndex(prev => prev + 1);
        }, 300);
      }, 2000);

      return () => clearTimeout(timer);
    } else {
      onComplete?.();
    }
  }, [currentIndex, notifications.length, onComplete]);

  if (!isVisible || currentIndex >= notifications.length) return null;

  const currentNotification = notifications[currentIndex];

  const icons = {
    success: <CheckCircle className="w-5 h-5" />,
    error: <XCircle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />
  };

  const colors = {
    success: "bg-green-50 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
    error: "bg-red-50 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
    info: "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
  };

  const handleRepositoryClick = () => {
    if (currentNotification.repositoryUrl) {
      window.open(currentNotification.repositoryUrl, '_blank');
    }
  };

  return (
    <div
      className={`
        fixed top-4 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg max-w-md
        ${colors[currentNotification.type]}
        ${isLeaving ? 'animate-slide-out-up' : 'animate-slide-in-down'}
      `}
    >
      {icons[currentNotification.type]}
      <span className="text-sm font-medium flex-1">{currentNotification.message}</span>
      {currentNotification.isRepositoryLink && currentNotification.repositoryUrl && (
        <button
          onClick={handleRepositoryClick}
          className="ml-2 p-1 hover:bg-white/20 rounded transition-colors"
          title="打开仓库"
        >
          <ExternalLink className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export function usePublishNotification() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isActive, setIsActive] = useState(false);

  const showNotifications = (notificationList: Array<{
    message: string;
    type: NotificationType;
    isRepositoryLink?: boolean;
    repositoryUrl?: string;
  }>) => {
    const processedNotifications = notificationList.map((n, index) => ({
      id: `${Date.now()}-${index}`,
      ...n
    }));

    setNotifications(processedNotifications);
    setIsActive(true);
  };

  const handleComplete = () => {
    setIsActive(false);
    setNotifications([]);
  };

  const NotificationContainer = () => (
    isActive ? (
      <PublishNotification
        notifications={notifications}
        onComplete={handleComplete}
      />
    ) : null
  );

  return { showNotifications, NotificationContainer };
}