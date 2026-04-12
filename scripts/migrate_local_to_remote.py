#!/usr/bin/env python3
"""
Migrate local SQLite data to remote Cloud SQL via the backend API.

Usage:
  1. Login on the remote site, get your JWT token from localStorage
  2. Run: python3 scripts/migrate_local_to_remote.py --token YOUR_JWT_TOKEN

This script:
  - Reads articles and agents from local SQLite
  - Creates agents on remote (if not exist)
  - Creates articles on remote with correct agent mapping
  - Preserves original timestamps and metadata
"""

import sqlite3
import requests
import argparse
import json
import sys
import os

# Remote API URL
REMOTE_API = "https://muses-backend-3xt2w2bjba-de.a.run.app"
LOCAL_DB = os.path.join(os.path.dirname(__file__), "..", "backend-python", "muses.db")


def get_local_data(db_path):
    """Read agents and articles from local SQLite."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    # Get agents
    agents = [dict(row) for row in conn.execute("SELECT * FROM Agent").fetchall()]
    print(f"Found {len(agents)} local agents")

    # Get articles
    articles = [dict(row) for row in conn.execute(
        "SELECT * FROM Article ORDER BY createdAt ASC"
    ).fetchall()]
    print(f"Found {len(articles)} local articles")

    conn.close()
    return agents, articles


def create_remote_agent(session, agent):
    """Create an agent on the remote server, return the remote agent ID."""
    payload = {
        "name": agent["name"],
        "description": agent.get("description", ""),
        "avatar": agent.get("avatar"),
        "language": agent.get("language", "zh-CN"),
        "tone": agent.get("tone", "professional"),
        "lengthPreference": agent.get("lengthPreference", "medium"),
        "targetAudience": agent.get("targetAudience", "general"),
        "customPrompt": agent.get("customPrompt", ""),
        "outputFormat": agent.get("outputFormat", "article"),
        "specialRules": agent.get("specialRules", ""),
        "isDefault": bool(agent.get("isDefault", False)),
    }

    resp = session.post(f"{REMOTE_API}/api/agents", json=payload)
    if resp.status_code == 200:
        data = resp.json()
        remote_id = data.get("agent", {}).get("id") or data.get("id")
        print(f"  Created agent '{agent['name']}' -> {remote_id}")
        return remote_id
    else:
        print(f"  Failed to create agent '{agent['name']}': {resp.status_code} {resp.text}")
        return None


def get_remote_agents(session):
    """Get existing agents on remote."""
    resp = session.get(f"{REMOTE_API}/api/agents")
    if resp.status_code == 200:
        data = resp.json()
        agents = data.get("agents", [])
        return {a["name"]: a["id"] for a in agents}
    return {}


def create_remote_article(session, article, agent_id):
    """Create an article on remote."""
    payload = {
        "agentId": agent_id,
        "title": article["title"],
        "content": article["content"] or "",
        "summary": article.get("summary", ""),
    }

    resp = session.post(f"{REMOTE_API}/api/articles", json=payload)
    if resp.status_code == 200:
        data = resp.json()
        remote_id = data.get("article", {}).get("id") or data.get("id")
        print(f"  Created article '{article['title'][:40]}' -> {remote_id}")
        return remote_id
    else:
        print(f"  Failed to create article '{article['title'][:40]}': {resp.status_code} {resp.text}")
        return None


def get_remote_articles(session):
    """Get existing articles on remote."""
    resp = session.get(f"{REMOTE_API}/api/articles")
    if resp.status_code == 200:
        data = resp.json()
        articles = data.get("articles", [])
        return {a["title"]: a["id"] for a in articles}
    return {}


def migrate(token):
    """Main migration flow."""
    # Setup session with auth
    session = requests.Session()
    session.headers["Authorization"] = f"Bearer {token}"

    # Verify auth
    resp = session.get(f"{REMOTE_API}/api/auth/verify")
    if resp.status_code != 200:
        print(f"Auth failed: {resp.status_code} {resp.text}")
        sys.exit(1)
    user = resp.json().get("user", {})
    print(f"Authenticated as: {user.get('username')} (id: {user.get('id')})")

    # Read local data
    agents, articles = get_local_data(os.path.abspath(LOCAL_DB))

    # Get existing remote data to avoid duplicates
    remote_agents = get_remote_agents(session)
    remote_articles = get_remote_articles(session)
    print(f"Remote has {len(remote_agents)} agents, {len(remote_articles)} articles")

    # Migrate agents, build local->remote ID mapping
    agent_id_map = {}
    print("\n--- Migrating Agents ---")
    for agent in agents:
        local_id = agent["id"]
        name = agent["name"]
        if name in remote_agents:
            agent_id_map[local_id] = remote_agents[name]
            print(f"  Agent '{name}' already exists -> {remote_agents[name]}")
        else:
            remote_id = create_remote_agent(session, agent)
            if remote_id:
                agent_id_map[local_id] = remote_id

    # Migrate articles
    print("\n--- Migrating Articles ---")
    created = 0
    skipped = 0
    failed = 0
    for article in articles:
        title = article["title"]

        # Skip if already exists on remote
        if title in remote_articles:
            print(f"  Skipped (exists): '{title[:40]}'")
            skipped += 1
            continue

        # Map agent ID
        local_agent_id = article["agentId"]
        remote_agent_id = agent_id_map.get(local_agent_id)
        if not remote_agent_id:
            # Use the first available remote agent as fallback
            if agent_id_map:
                remote_agent_id = list(agent_id_map.values())[0]
                print(f"  Warning: agent {local_agent_id} not mapped, using fallback")
            else:
                print(f"  Error: no agents available, cannot create '{title[:40]}'")
                failed += 1
                continue

        remote_id = create_remote_article(session, article, remote_agent_id)
        if remote_id:
            created += 1
        else:
            failed += 1

    print(f"\n--- Migration Complete ---")
    print(f"Created: {created}, Skipped: {skipped}, Failed: {failed}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate local Muses data to remote")
    parser.add_argument("--token", required=True, help="JWT token from remote login")
    args = parser.parse_args()
    migrate(args.token)
