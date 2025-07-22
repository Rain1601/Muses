from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import httpx
import base64
from datetime import datetime

from ..database import get_db
from ..models import Article
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


@router.post("/github")
async def publish_to_github(
    request: dict,
    current_user = Depends(get_current_user_db),
    db: Session = Depends(get_db)
):
    """发布文章到GitHub"""
    
    article_id = request.get("articleId")
    repo_url = request.get("repoUrl") 
    file_path = request.get("filePath")
    commit_message = request.get("commitMessage", "Add new article")
    
    if not all([article_id, repo_url, file_path]):
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
        # repo_url格式: https://github.com/owner/repo
        repo_parts = repo_url.rstrip('/').split('/')
        owner = repo_parts[-2]
        repo = repo_parts[-1]
        
        # 准备文件内容
        # 如果文件路径以.html结尾，直接使用HTML内容
        if file_path.endswith('.html'):
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
            article.publishStatus = "published"
            article.publishedAt = datetime.utcnow()
            article.githubUrl = github_url
            article.repoPath = file_path
            
            db.commit()
            
            return {
                "success": True,
                "url": github_url
            }
            
    except Exception as e:
        db.rollback()
        raise HTTPValidationError(f"Failed to publish to GitHub: {str(e)}")


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