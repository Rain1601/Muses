# scripts/

辅助脚本。常用入口仍以根目录的 `start-python.sh`、`deploy.sh` 为准；本目录主要服务于一些一次性场景（GCP 初始化、数据迁移）。

> **现状提示**：`dev.sh` / `stop.sh` / `build.sh` / `test.sh` 仍是早期 Node.js 后端时代写的（用 `pnpm dev`、杀 `ts-node`、`prisma studio` 等），在当前 Python 后端下**无法直接使用**。`setup.sh` 和 `start.sh` 部分逻辑已更新到 Python 路径，但流程仍偏老，目前推荐直接看根目录 `README.md` 的快速开始 + `./start-python.sh`。这些脚本未来要么修要么删，目前留作历史参考。

## 当前可信赖的脚本

### gcp-setup.sh — 一次性 GCP 初始化
首次部署 Cloud Run 前运行，自动完成：
- 启用 Cloud Run / Cloud SQL / Secret Manager API
- 创建 Cloud SQL 实例 `muses-db`
- 创建部署用 Service Account 并下发 JSON key
- 打印需要在 GitHub Secrets 配置的项

```bash
export GCP_PROJECT_ID="your-project" DB_PASSWORD="strong-pass"
./scripts/gcp-setup.sh
```

### migrate_local_to_remote.py — 本地 SQLite → 远端 Cloud SQL
把本地 `backend/muses.db` 里的 articles 与 agents 通过远端 API 灌入生产库。

```bash
# 1. 在生产站登录，从 localStorage 拷贝 JWT
# 2. 在本地跑：
python3 scripts/migrate_local_to_remote.py --token YOUR_JWT_TOKEN
```

## 待修复 / 历史遗留

| 脚本 | 状态 | 说明 |
|---|---|---|
| `setup.sh` | 部分能用 | 装前端依赖正常；后端段已切到 `backend/` 路径，但仍假设走 `pip install`，没有 venv 流程 |
| `start.sh` | 部分能用 | 入口逻辑已切到 Python 后端，但风格陈旧；建议直接用 `./start-python.sh` |
| `dev.sh` | ❌ | 跑的是 `cd backend && npm run dev`，对 Python 后端无效 |
| `stop.sh` | ❌ | `pkill ts-node / nodemon / prisma studio`，全是 Node 进程 |
| `build.sh` | ❌ | 期望 TypeScript backend 构建产物 |
| `test.sh` | ❌ | 跑后端的 `tsc --noEmit`，Python 后端无 ts |

如果决定保留这些脚本，应改写成 Python 版本（pytest、uvicorn、`pkill -f "python.*start.py"` 等）；如果不再用，可以直接删除。

## 推荐入口（替代上面这些）

```bash
./start-python.sh   # 一键开两窗启动前后端
./deploy.sh         # 手动部署到 Cloud Run
```

详细开发流程见根目录 `README.md` 与 `CLAUDE.md`。
