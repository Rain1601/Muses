"""
后台任务跟踪系统
用于跟踪长时间运行的异步任务（如文章翻译）
"""

from typing import Dict, Any, Optional
from datetime import datetime
import uuid
from enum import Enum


class TaskStatus(str, Enum):
    """任务状态"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class TaskTracker:
    """任务跟踪器（内存存储）"""

    # 使用类变量存储所有任务
    _tasks: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def create_task(cls, task_type: str, **metadata) -> str:
        """
        创建新任务

        Args:
            task_type: 任务类型（如 'translate_article'）
            **metadata: 任务相关的元数据

        Returns:
            任务ID
        """
        task_id = str(uuid.uuid4())
        cls._tasks[task_id] = {
            "id": task_id,
            "type": task_type,
            "status": TaskStatus.PENDING,
            "progress": 0,
            "total": 0,
            "current_step": None,
            "result": None,
            "error": None,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            **metadata
        }
        return task_id

    @classmethod
    def update_task(
        cls,
        task_id: str,
        status: Optional[TaskStatus] = None,
        progress: Optional[int] = None,
        total: Optional[int] = None,
        current_step: Optional[str] = None,
        result: Optional[Any] = None,
        error: Optional[str] = None,
        **extra_data
    ):
        """更新任务状态"""
        if task_id not in cls._tasks:
            raise ValueError(f"Task {task_id} not found")

        task = cls._tasks[task_id]

        if status is not None:
            task["status"] = status
        if progress is not None:
            task["progress"] = progress
        if total is not None:
            task["total"] = total
        if current_step is not None:
            task["current_step"] = current_step
        if result is not None:
            task["result"] = result
        if error is not None:
            task["error"] = error

        task["updated_at"] = datetime.now().isoformat()
        task.update(extra_data)

    @classmethod
    def get_task(cls, task_id: str) -> Optional[Dict[str, Any]]:
        """获取任务信息"""
        return cls._tasks.get(task_id)

    @classmethod
    def delete_task(cls, task_id: str):
        """删除任务"""
        if task_id in cls._tasks:
            del cls._tasks[task_id]

    @classmethod
    def cleanup_old_tasks(cls, max_age_hours: int = 24):
        """清理旧任务"""
        from datetime import timedelta
        now = datetime.now()
        cutoff = now - timedelta(hours=max_age_hours)

        to_delete = []
        for task_id, task in cls._tasks.items():
            created_at = datetime.fromisoformat(task["created_at"])
            if created_at < cutoff:
                to_delete.append(task_id)

        for task_id in to_delete:
            del cls._tasks[task_id]

        return len(to_delete)


# 全局任务跟踪器实例
task_tracker = TaskTracker()
