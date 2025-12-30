"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Info, AlertCircle } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose?: () => void;
}

export function Toast({ message, type = "info", duration = 3000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(() => {
        setIsVisible(false);
        onClose?.();
      }, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!isVisible) return null;

  const icons = {
    success: <CheckCircle className="w-5 h-5" />,
    error: <XCircle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />,
    warning: <AlertCircle className="w-5 h-5" />
  };

  const colors = {
    success: "bg-green-600 text-white border-green-700 dark:bg-green-700 dark:text-white dark:border-green-800",
    error: "bg-red-600 text-white border-red-700 dark:bg-red-700 dark:text-white dark:border-red-800",
    info: "bg-blue-600 text-white border-blue-700 dark:bg-blue-700 dark:text-white dark:border-blue-800",
    warning: "bg-yellow-600 text-white border-yellow-700 dark:bg-yellow-700 dark:text-white dark:border-yellow-800"
  };

  return (
    <div
      className={`
        fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-lg border shadow-xl backdrop-blur-sm
        ${colors[type]}
        ${isLeaving ? 'animate-out fade-out slide-out-to-top-2 duration-300' : 'animate-in fade-in slide-in-from-top-2 duration-300'}
      `}
    >
      {icons[type]}
      <span className="text-sm font-medium whitespace-nowrap">{message}</span>
    </div>
  );
}

// Toast Manager to handle multiple toasts
export function useToast() {
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: ToastType }>>([]);

  const showToast = (message: string, type: ToastType = "info") => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  };

  const ToastContainer = () => (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center">
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          style={{ transform: `translateY(${index * 8}px)` }}
        >
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
          />
        </div>
      ))}
    </div>
  );

  return { showToast, ToastContainer };
}