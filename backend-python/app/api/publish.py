from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import httpx
import base64
import time
from datetime import datetime

from ..database import get_db
from ..models import Article
from ..models.sync_history import SyncHistory
from ..dependencies import get_current_user_db
from ..utils.security import decrypt
from ..utils.exceptions import HTTPNotFoundError, HTTPValidationError

router = APIRouter()


@router.get("/repos")
async def get_repos(
    current_user = Depends(get_current_user_db)
):
    """获取GitHub仓库列表"""
    
    if not current_user.githubToken:
        raise HTTPValidationError("GitHub token not found")
    
    try:
        # 解密GitHub token
        github_token = decrypt(current_user.githubToken)
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.github.com/user/repos",
                headers={"Authorization": f"Bearer {github_token}"},
                params={"sort": "updated", "per_page": 100, "type": "all"}
            )
            
            print(f"GitHub repos response status: {response.status_code}")
            print(f"GitHub repos response: {response.text[:500]}")
            
            if response.status_code != 200:
                raise HTTPValidationError(f"Failed to fetch repositories: {response.text}")
            
            repos = response.json()
            
            # 简化仓库信息
            repo_list = [
                {
                    "id": repo["id"],
                    "name": repo["name"],
                    "full_name": repo["full_name"],
                    "private": repo["private"],
                    "html_url": repo["html_url"],
                    "description": repo.get("description", ""),
                    "updated_at": repo["updated_at"]
                }
                for repo in repos
            ]
            
            return {"repos": repo_list}
            
    except Exception as e:
        raise HTTPValidationError(f"Failed to get repositories: {str(e)}")


@router.post("/github/batch")
async def publish_batch_to_github(
    request: dict,
    current_user = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """批量发布文章和图片到GitHub"""

    start_time = time.time()
    article_id = request.get("articleId")
    repo_url = request.get("repoUrl")
    files = request.get("files", [])  # [{"path": "...", "content": "...", "encoding": "utf-8|base64"}]
    commit_message = request.get("commitMessage", "Add new article")

    if not all([article_id, repo_url, files]):
        raise HTTPValidationError("Missing required parameters")

    # 获取文章
    article = db.query(Article).filter(
        Article.id == article_id,
        Article.userId == current_user.id
    ).first()

    if not article:
        raise HTTPNotFoundError("Article not found")

    if not current_user.githubToken:
        raise HTTPValidationError("GitHub token not found")

    try:
        # 解密GitHub token
        github_token = decrypt(current_user.githubToken)

        # 解析仓库信息
        repo_parts = repo_url.rstrip('/').split('/')
        owner = repo_parts[-2]
        repo = repo_parts[-1]

        async with httpx.AsyncClient() as client:
            success_files = []
            failed_files = []

            # 按顺序上传每个文件
            for file_info in files:
                file_path = file_info.get("path")
                file_content = file_info.get("content")
                encoding = file_info.get("encoding", "utf-8")

                try:
                    # 如果是base64编码，直接使用；否则先编码
                    if encoding == "base64":
                        content_encoded = file_content
                    else:
                        content_encoded = base64.b64encode(file_content.encode('utf-8')).decode('utf-8')

                    # 检查文件是否已存在
                    check_response = await client.get(
                        f"https://api.github.com/repos/{owner}/{repo}/contents/{file_path}",
                        headers={"Authorization": f"token {github_token}"}
                    )

                    # 准备提交数据
                    commit_data = {
                        "message": commit_message,
                        "content": content_encoded,
                        "branch": "main"
                    }

                    # 如果文件已存在，需要提供sha
                    if check_response.status_code == 200:
                        existing_file = check_response.json()
                        commit_data["sha"] = existing_file["sha"]

                    # 提交文件
                    commit_response = await client.put(
                        f"https://api.github.com/repos/{owner}/{repo}/contents/{file_path}",
                        headers={"Authorization": f"token {github_token}"},
                        json=commit_data
                    )

                    if commit_response.status_code in [200, 201]:
                        success_files.append(file_path)
                    else:
                        failed_files.append({
                            "path": file_path,
                            "error": f"HTTP {commit_response.status_code}: {commit_response.text}"
                        })

                except Exception as e:
                    failed_files.append({
                        "path": file_path,
                        "error": str(e)
                    })

            # 如果主文件（index.md）上传成功，更新文章状态
            main_file_uploaded = any("index.md" in path for path in success_files)
            if main_file_uploaded:
                main_file_path = next(path for path in success_files if "index.md" in path)
                github_url = f"{repo_url}/blob/main/{main_file_path}"
                article.publishStatus = "published"
                article.publishedAt = datetime.utcnow()
                article.githubUrl = github_url
                article.repoPath = main_file_path

                # 更新同步状态
                article.syncStatus = "synced"
                if not article.firstSyncAt:
                    article.firstSyncAt = datetime.utcnow()
                article.lastSyncAt = datetime.utcnow()
                article.syncCount = str(int(article.syncCount or "0") + 1)

                # 创建同步历史记录
                sync_record = SyncHistory(
                    articleId=article_id,
                    userId=current_user.id,
                    syncType="publish_to_github",
                    syncDirection="local_to_github",
                    syncStatus="success",
                    hasChanges="true",
                    syncDuration=int((time.time() - start_time) * 1000),
                    githubUrl=github_url,
                    repoPath=main_file_path,
                    fileSize=len(success_files)
                )
                db.add(sync_record)

                db.commit()

            return {
                "success": len(failed_files) == 0,
                "message": f"上传完成：{len(success_files)} 个文件成功，{len(failed_files)} 个文件失败",
                "success_files": success_files,
                "failed_files": failed_files,
                "github_url": f"{repo_url}/blob/main/{success_files[0]}" if success_files else None
            }

    except Exception as e:
        db.rollback()
        raise HTTPValidationError(f"Failed to publish to GitHub: {str(e)}")


@router.post("/github")
async def publish_to_github(
    request: dict,
    current_user = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """发布文章到GitHub（保持向后兼容）"""

    start_time = time.time()
    article_id = request.get("articleId")
    repo_url = request.get("repoUrl")
    file_path = request.get("filePath")
    commit_message = request.get("commitMessage", "Add new article")
    custom_content = request.get("content")  # 可选：直接传递的内容

    if not all([article_id, repo_url]):
        raise HTTPValidationError("Missing required parameters")

    # 获取文章
    article = db.query(Article).filter(
        Article.id == article_id,
        Article.userId == current_user.id
    ).first()

    if not article:
        raise HTTPNotFoundError("Article not found")

    # 如果文章已经发布过，使用已保存的路径；否则使用提供的路径
    if article.repoPath:
        file_path = article.repoPath
        commit_message = request.get("commitMessage", f"Update article: {article.title}")
    else:
        if not file_path:
            raise HTTPValidationError("filePath is required for first-time publishing")
        commit_message = request.get("commitMessage", f"Add new article: {article.title}")
    
    if not current_user.githubToken:
        raise HTTPValidationError("GitHub token not found")
    
    try:
        # 解密GitHub token
        github_token = decrypt(current_user.githubToken)
        
        # 解析仓库信息
        # repo_url格式: https://github.com/owner/repo
        repo_parts = repo_url.rstrip('/').split('/')
        owner = repo_parts[-2]
        repo = repo_parts[-1]
        
        # 准备文件内容
        # 如果提供了自定义内容，使用自定义内容
        if custom_content:
            file_content = custom_content
        # 如果文件路径以.html结尾，直接使用HTML内容
        elif file_path.endswith('.html'):
            file_content = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{article.title}</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        }}
        h1, h2, h3, h4, h5, h6 {{
            margin-top: 24px;
            margin-bottom: 16px;
        }}
        code {{
            background-color: #f4f4f4;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace;
        }}
        pre {{
            background-color: #f4f4f4;
            padding: 16px;
            border-radius: 6px;
            overflow-x: auto;
        }}
        blockquote {{
            border-left: 4px solid #ddd;
            margin: 0;
            padding-left: 16px;
            color: #666;
        }}
    </style>
</head>
<body>
    <h1>{article.title}</h1>
    {article.content}
</body>
</html>"""
        else:
            # 如果是Markdown文件，仍然使用原始格式
            file_content = f"""# {article.title}

{article.content}
"""
        
        # Base64编码内容
        content_encoded = base64.b64encode(file_content.encode('utf-8')).decode('utf-8')
        
        async with httpx.AsyncClient() as client:
            # 检查文件是否已存在
            check_response = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/contents/{file_path}",
                headers={"Authorization": f"token {github_token}"}
            )
            
            # 准备提交数据
            commit_data = {
                "message": commit_message,
                "content": content_encoded,
                "branch": "main"  # 默认使用main分支
            }
            
            # 如果文件已存在，需要提供sha
            if check_response.status_code == 200:
                existing_file = check_response.json()
                commit_data["sha"] = existing_file["sha"]
            
            # 提交文件
            commit_response = await client.put(
                f"https://api.github.com/repos/{owner}/{repo}/contents/{file_path}",
                headers={"Authorization": f"token {github_token}"},
                json=commit_data
            )
            
            if commit_response.status_code not in [200, 201]:
                raise HTTPValidationError("Failed to publish to GitHub")
            
            # 更新文章发布状态
            github_url = f"{repo_url}/blob/main/{file_path}"
            result = commit_response.json()

            article.publishStatus = "published"
            article.publishedAt = datetime.utcnow()
            article.githubUrl = github_url
            article.repoPath = file_path
            article.githubSha = result.get("content", {}).get("sha")  # 保存GitHub文件的SHA值

            # 更新同步状态
            article.syncStatus = "synced"
            if not article.firstSyncAt:
                article.firstSyncAt = datetime.utcnow()
            article.lastSyncAt = datetime.utcnow()
            article.syncCount = str(int(article.syncCount or "0") + 1)

            # 创建同步历史记录
            sync_record = SyncHistory(
                articleId=article_id,
                userId=current_user.id,
                syncType="publish_to_github",
                syncDirection="local_to_github",
                syncStatus="success",
                hasChanges="true",
                syncDuration=int((time.time() - start_time) * 1000),
                githubSha=article.githubSha,
                githubUrl=github_url,
                repoPath=file_path,
                fileSize=len(file_content)
            )
            db.add(sync_record)

            db.commit()
            
            return {
                "success": True,
                "url": github_url
            }
            
    except Exception as e:
        db.rollback()
        raise HTTPValidationError(f"Failed to publish to GitHub: {str(e)}")


@router.delete("/github/{article_id}")
async def unpublish_from_github(
    article_id: str,
    current_user = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """从GitHub下架文章（删除文件）"""

    start_time = time.time()

    # 获取文章
    article = db.query(Article).filter(
        Article.id == article_id,
        Article.userId == current_user.id
    ).first()

    if not article:
        raise HTTPNotFoundError("Article not found")

    if not article.githubUrl or not article.repoPath:
        raise HTTPValidationError("Article has not been published to GitHub")

    if not current_user.githubToken:
        raise HTTPValidationError("GitHub token not found")

    try:
        # 解密GitHub token
        github_token = decrypt(current_user.githubToken)

        # 从 githubUrl 解析仓库信息
        # githubUrl格式: https://github.com/owner/repo/blob/main/path/to/file
        repo_url_parts = article.githubUrl.split('/blob/')[0]
        repo_parts = repo_url_parts.rstrip('/').split('/')
        owner = repo_parts[-2]
        repo = repo_parts[-1]

        async with httpx.AsyncClient() as client:
            deleted_files = []
            failed_files = []

            # 删除主文件（index.md）
            try:
                # 首先获取文件信息以获取 SHA
                check_response = await client.get(
                    f"https://api.github.com/repos/{owner}/{repo}/contents/{article.repoPath}",
                    headers={"Authorization": f"token {github_token}"}
                )

                if check_response.status_code == 200:
                    file_info = check_response.json()
                    file_sha = file_info["sha"]

                    # 删除文件
                    delete_response = await client.delete(
                        f"https://api.github.com/repos/{owner}/{repo}/contents/{article.repoPath}",
                        headers={"Authorization": f"token {github_token}"},
                        json={
                            "message": f"下架文章: {article.title}",
                            "sha": file_sha,
                            "branch": "main"
                        }
                    )

                    if delete_response.status_code in [200, 204]:
                        deleted_files.append(article.repoPath)
                    else:
                        failed_files.append({
                            "path": article.repoPath,
                            "error": f"HTTP {delete_response.status_code}: {delete_response.text}"
                        })
                else:
                    failed_files.append({
                        "path": article.repoPath,
                        "error": "File not found on GitHub"
                    })

            except Exception as e:
                failed_files.append({
                    "path": article.repoPath,
                    "error": str(e)
                })

            # 如果文章在文件夹中，尝试删除整个文件夹（包括图片）
            # 提取文件夹路径（去掉 index.md）
            if "/index.md" in article.repoPath:
                folder_path = article.repoPath.replace("/index.md", "")

                try:
                    # 获取文件夹内容
                    folder_response = await client.get(
                        f"https://api.github.com/repos/{owner}/{repo}/contents/{folder_path}",
                        headers={"Authorization": f"token {github_token}"}
                    )

                    if folder_response.status_code == 200:
                        folder_contents = folder_response.json()

                        # 删除文件夹中的其他文件（如图片）
                        for item in folder_contents:
                            if item["path"] != article.repoPath:  # 跳过已删除的主文件
                                try:
                                    delete_response = await client.delete(
                                        f"https://api.github.com/repos/{owner}/{repo}/contents/{item['path']}",
                                        headers={"Authorization": f"token {github_token}"},
                                        json={
                                            "message": f"下架文章: {article.title}",
                                            "sha": item["sha"],
                                            "branch": "main"
                                        }
                                    )

                                    if delete_response.status_code in [200, 204]:
                                        deleted_files.append(item["path"])

                                except Exception as e:
                                    # 忽略单个文件删除失败
                                    pass

                except Exception as e:
                    # 文件夹可能不存在或已被删除，继续执行
                    pass

            # 更新文章状态为草稿
            article.publishStatus = "draft"
            article.syncStatus = "unsynced"
            article.githubUrl = None
            # repoPath 保留，以便重新发布时可以使用相同路径

            # 创建同步历史记录
            sync_record = SyncHistory(
                articleId=article_id,
                userId=current_user.id,
                syncType="unpublish_from_github",
                syncDirection="github_to_local",
                syncStatus="success" if not failed_files else "partial_success",
                hasChanges="true",
                syncDuration=int((time.time() - start_time) * 1000),
                repoPath=article.repoPath,
                fileSize=len(deleted_files)
            )
            db.add(sync_record)

            db.commit()

            return {
                "success": len(failed_files) == 0,
                "message": f"下架完成：删除了 {len(deleted_files)} 个文件" + (f"，{len(failed_files)} 个文件失败" if failed_files else ""),
                "deleted_files": deleted_files,
                "failed_files": failed_files
            }

    except Exception as e:
        db.rollback()
        raise HTTPValidationError(f"Failed to unpublish from GitHub: {str(e)}")


@router.get("/history/{article_id}")
async def get_publish_history(
    article_id: str,
    current_user = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """获取发布历史"""

    article = db.query(Article).filter(
        Article.id == article_id,
        Article.userId == current_user.id
    ).first()

    if not article:
        raise HTTPNotFoundError("Article not found")

    return {
        "publishInfo": {
            "publishStatus": article.publishStatus,
            "publishedAt": article.publishedAt.isoformat() if article.publishedAt else None,
            "githubUrl": article.githubUrl,
            "repoPath": article.repoPath
        }
    }