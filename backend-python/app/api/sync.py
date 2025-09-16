from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import httpx
import base64
import logging
import time
from datetime import datetime
from typing import List, Dict, Optional

from ..database import get_db
from ..models import Article
from ..models.sync_history import SyncHistory
from ..dependencies import get_current_user_db
from ..utils.security import decrypt
from ..utils.exceptions import HTTPNotFoundError, HTTPValidationError

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/status/{article_id}")
async def get_sync_status(
    article_id: str,
    current_user=Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """获取文章同步状态"""

    article = db.query(Article).filter(
        Article.id == article_id,
        Article.userId == current_user.id
    ).first()

    if not article:
        raise HTTPNotFoundError("Article not found")

    # 获取同步历史记录
    sync_history = db.query(SyncHistory).filter(
        SyncHistory.articleId == article_id
    ).order_by(SyncHistory.createdAt.desc()).limit(5).all()

    return {
        "article": {
            "id": article.id,
            "title": article.title,
            "syncStatus": article.syncStatus,
            "firstSyncAt": article.firstSyncAt.isoformat() if article.firstSyncAt else None,
            "lastSyncAt": article.lastSyncAt.isoformat() if article.lastSyncAt else None,
            "syncCount": article.syncCount,
            "githubUrl": article.githubUrl,
            "repoPath": article.repoPath,
            "localModifiedAt": article.updatedAt.isoformat(),
            "githubModifiedAt": article.githubModifiedAt.isoformat() if article.githubModifiedAt else None,
        },
        "syncHistory": [{
            "id": history.id,
            "syncType": history.syncType,
            "syncDirection": history.syncDirection,
            "syncStatus": history.syncStatus,
            "hasChanges": history.hasChanges,
            "conflictType": history.conflictType,
            "errorMessage": history.errorMessage,
            "createdAt": history.createdAt.isoformat()
        } for history in sync_history]
    }


@router.post("/pull-from-github")
async def pull_from_github(
    request: dict,
    current_user=Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """从GitHub拉取内容并覆盖本地文章"""

    article_id = request.get("articleId")
    repo_url = request.get("repoUrl", "https://github.com/Rain1601/rain.blog.repo")
    force_overwrite = request.get("forceOverwrite", False)  # 强制覆盖

    if not article_id:
        raise HTTPValidationError("Missing articleId")

    start_time = time.time()

    # 获取文章
    article = db.query(Article).filter(
        Article.id == article_id,
        Article.userId == current_user.id
    ).first()

    if not article:
        raise HTTPNotFoundError("Article not found")

    if not current_user.githubToken:
        raise HTTPValidationError("GitHub token not found")

    if not article.repoPath:
        raise HTTPValidationError("Article not linked to GitHub file")

    try:
        # 解密GitHub token
        github_token = decrypt(current_user.githubToken)

        # 解析仓库信息
        repo_parts = repo_url.rstrip('/').split('/')
        owner = repo_parts[-2]
        repo = repo_parts[-1]

        logger.info(f"🔄 Starting pull from GitHub for article {article_id}")
        logger.info(f"📁 Repo: {owner}/{repo}, Path: {article.repoPath}")

        async with httpx.AsyncClient() as client:
            # 获取GitHub文件内容
            api_url = f"https://api.github.com/repos/{owner}/{repo}/contents/{article.repoPath}"

            response = await client.get(
                api_url,
                headers={"Authorization": f"token {github_token}"}
            )

            if response.status_code == 404:
                # 文件在GitHub上不存在
                sync_record = SyncHistory(
                    articleId=article_id,
                    userId=current_user.id,
                    syncType="pull_from_github",
                    syncDirection="github_to_local",
                    syncStatus="failed",
                    errorMessage="File not found on GitHub",
                    syncDuration=int((time.time() - start_time) * 1000),
                    repoPath=article.repoPath,
                    githubUrl=article.githubUrl
                )
                db.add(sync_record)
                db.commit()

                raise HTTPValidationError("File not found on GitHub")

            if response.status_code != 200:
                error_msg = f"GitHub API error: {response.status_code} - {response.text}"
                logger.error(error_msg)
                raise HTTPValidationError(error_msg)

            github_file = response.json()

            # 获取GitHub内容
            github_content = base64.b64decode(github_file["content"]).decode('utf-8')
            github_sha = github_file["sha"]
            github_modified_at = datetime.fromisoformat(github_file["updated_at"].replace('Z', '+00:00'))

            logger.info(f"📄 GitHub file size: {len(github_content)} characters")
            logger.info(f"🔑 GitHub SHA: {github_sha}")

            # 移除frontmatter，只保留文章内容
            content_without_frontmatter = github_content
            if github_content.startswith('---'):
                parts = github_content.split('---', 2)
                if len(parts) >= 3:
                    content_without_frontmatter = parts[2].strip()
                    logger.info(f"📝 Removed frontmatter, content length: {len(content_without_frontmatter)}")

            # 检查是否有冲突
            has_local_changes = article.updatedAt > (article.lastSyncAt or article.createdAt)
            has_github_changes = github_modified_at > (article.githubModifiedAt or article.createdAt)

            conflict_detected = False
            if has_local_changes and has_github_changes and not force_overwrite:
                conflict_detected = True
                logger.warning(f"⚠️ Conflict detected - local changes and GitHub changes both exist")

            # 保存同步前的内容
            content_before = article.content
            content_changed = content_before != content_without_frontmatter

            if conflict_detected:
                # 记录冲突
                sync_record = SyncHistory(
                    articleId=article_id,
                    userId=current_user.id,
                    syncType="pull_from_github",
                    syncDirection="github_to_local",
                    syncStatus="conflict",
                    contentBefore=content_before,
                    contentAfter=content_without_frontmatter,
                    hasChanges="true" if content_changed else "false",
                    conflictType="content_conflict",
                    githubSha=github_sha,
                    githubUrl=article.githubUrl,
                    repoPath=article.repoPath,
                    syncDuration=int((time.time() - start_time) * 1000),
                    fileSize=len(content_without_frontmatter)
                )
                db.add(sync_record)
                db.commit()

                return {
                    "success": False,
                    "conflict": True,
                    "message": "Content conflict detected. Local and GitHub versions both have changes.",
                    "localContent": content_before,
                    "githubContent": content_without_frontmatter,
                    "localModifiedAt": article.updatedAt.isoformat(),
                    "githubModifiedAt": github_modified_at.isoformat()
                }

            # 执行覆盖更新
            article.content = content_without_frontmatter
            article.githubSha = github_sha
            article.githubModifiedAt = github_modified_at
            article.lastSyncAt = datetime.utcnow()

            # 设置第一次同步时间（如果还没有）
            if not article.firstSyncAt:
                article.firstSyncAt = datetime.utcnow()
                article.syncCount = "1"
            else:
                current_count = int(article.syncCount or "0")
                article.syncCount = str(current_count + 1)

            article.syncStatus = "synced"

            # 记录成功的同步
            sync_record = SyncHistory(
                articleId=article_id,
                userId=current_user.id,
                syncType="pull_from_github",
                syncDirection="github_to_local",
                syncStatus="success",
                contentBefore=content_before,
                contentAfter=content_without_frontmatter,
                hasChanges="true" if content_changed else "false",
                githubSha=github_sha,
                githubUrl=article.githubUrl,
                repoPath=article.repoPath,
                syncDuration=int((time.time() - start_time) * 1000),
                fileSize=len(content_without_frontmatter)
            )
            db.add(sync_record)
            db.commit()

            logger.info(f"✅ Successfully pulled from GitHub - changes: {content_changed}")

            return {
                "success": True,
                "message": "Successfully pulled from GitHub" + (" with changes" if content_changed else " (no changes)"),
                "hasChanges": content_changed,
                "syncCount": article.syncCount,
                "firstSyncAt": article.firstSyncAt.isoformat(),
                "lastSyncAt": article.lastSyncAt.isoformat()
            }

    except Exception as e:
        db.rollback()
        error_msg = str(e)
        logger.error(f"❌ Failed to pull from GitHub: {error_msg}")

        # 记录失败的同步
        sync_record = SyncHistory(
            articleId=article_id,
            userId=current_user.id,
            syncType="pull_from_github",
            syncDirection="github_to_local",
            syncStatus="failed",
            errorMessage=error_msg,
            syncDuration=int((time.time() - start_time) * 1000),
            repoPath=article.repoPath,
            githubUrl=article.githubUrl
        )
        db.add(sync_record)
        db.commit()

        raise HTTPValidationError(f"Failed to pull from GitHub: {error_msg}")


@router.post("/resolve-conflict")
async def resolve_conflict(
    request: dict,
    current_user=Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """解决同步冲突"""

    article_id = request.get("articleId")
    resolution = request.get("resolution")  # "use_local", "use_github", "use_custom"
    custom_content = request.get("customContent")  # 自定义合并内容

    if not all([article_id, resolution]):
        raise HTTPValidationError("Missing required parameters")

    if resolution not in ["use_local", "use_github", "use_custom"]:
        raise HTTPValidationError("Invalid resolution type")

    if resolution == "use_custom" and not custom_content:
        raise HTTPValidationError("Custom content is required for custom resolution")

    article = db.query(Article).filter(
        Article.id == article_id,
        Article.userId == current_user.id
    ).first()

    if not article:
        raise HTTPNotFoundError("Article not found")

    try:
        start_time = time.time()
        content_before = article.content

        if resolution == "use_local":
            # 保持本地内容不变
            final_content = article.content
        elif resolution == "use_github":
            # 需要重新从GitHub获取最新内容
            return await pull_from_github(
                {"articleId": article_id, "forceOverwrite": True},
                current_user,
                db
            )
        else:  # use_custom
            final_content = custom_content
            article.content = final_content

        article.syncStatus = "synced"
        article.lastSyncAt = datetime.utcnow()

        # 记录冲突解决
        sync_record = SyncHistory(
            articleId=article_id,
            userId=current_user.id,
            syncType="conflict_resolved",
            syncDirection="bidirectional",
            syncStatus="success",
            contentBefore=content_before,
            contentAfter=final_content,
            hasChanges="true" if content_before != final_content else "false",
            conflictResolution=resolution,
            syncDuration=int((time.time() - start_time) * 1000)
        )
        db.add(sync_record)
        db.commit()

        return {
            "success": True,
            "message": f"Conflict resolved using {resolution}",
            "resolution": resolution,
            "hasChanges": content_before != final_content
        }

    except Exception as e:
        db.rollback()
        logger.error(f"Failed to resolve conflict: {str(e)}")
        raise HTTPValidationError(f"Failed to resolve conflict: {str(e)}")


@router.get("/history/{article_id}")
async def get_sync_history(
    article_id: str,
    limit: int = 20,
    current_user=Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """获取文章同步历史"""

    article = db.query(Article).filter(
        Article.id == article_id,
        Article.userId == current_user.id
    ).first()

    if not article:
        raise HTTPNotFoundError("Article not found")

    history = db.query(SyncHistory).filter(
        SyncHistory.articleId == article_id
    ).order_by(SyncHistory.createdAt.desc()).limit(limit).all()

    return {
        "history": [{
            "id": record.id,
            "syncType": record.syncType,
            "syncDirection": record.syncDirection,
            "syncStatus": record.syncStatus,
            "hasChanges": record.hasChanges == "true",
            "conflictType": record.conflictType,
            "conflictResolution": record.conflictResolution,
            "errorMessage": record.errorMessage,
            "syncDuration": record.syncDuration,
            "fileSize": record.fileSize,
            "createdAt": record.createdAt.isoformat()
        } for record in history]
    }