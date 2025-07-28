# Cloudflare Tunnel 安全配置指南

## 🔒 安全最佳实践

### 1. 基础安全配置

#### Cloudflare Dashboard 安全设置

1. **SSL/TLS 配置**
   - 加密模式：完全（严格）
   - 最小 TLS 版本：1.2
   - 启用 HSTS
   - 启用 Always Use HTTPS

2. **防火墙规则**
   ```
   规则 1: 阻止非必要国家/地区
   - 表达式: (ip.geoip.country ne "CN" and ip.geoip.country ne "US")
   - 动作: 阻止
   
   规则 2: 限制 API 访问
   - 表达式: (http.host eq "api.yourdomain.com" and not http.request.uri.path matches "^/api/(auth|health)")
   - 动作: 质询 (CAPTCHA)
   
   规则 3: 保护管理界面
   - 表达式: (http.request.uri.path contains "/admin" or http.request.uri.path contains "/dashboard")
   - 动作: 阻止（或设置 IP 白名单）
   ```

3. **速率限制**
   ```
   API 路径速率限制:
   - 路径: api.yourdomain.com/api/*
   - 请求数: 100 请求/10分钟/IP
   - 动作: 阻止
   
   登录保护:
   - 路径: yourdomain.com/api/auth/*
   - 请求数: 5 请求/分钟/IP
   - 动作: 质询
   ```

### 2. Access 策略（推荐）

#### 设置 Cloudflare Access
```bash
# 保护管理界面
- 应用名称: Muses Admin
- 域名: yourdomain.com
- 路径: /admin*, /dashboard*, /settings*
- 策略: 
  - 名称: Admin Only
  - 动作: 允许
  - 规则: 电子邮件 - your-admin@email.com
```

### 3. WAF 自定义规则

```
规则 1: SQL 注入保护
- 表达式: (http.request.body contains "union select" or http.request.body contains "drop table")
- 动作: 阻止

规则 2: XSS 保护  
- 表达式: (http.request.uri.query contains "<script" or http.request.body contains "<script")
- 动作: 阻止

规则 3: 文件上传保护
- 表达式: (http.request.uri.path eq "/api/upload" and http.request.method eq "POST" and http.request.headers["content-type"][0] ne "multipart/form-data")
- 动作: 阻止
```

### 4. DDoS 保护

1. **启用 DDoS 保护**
   - 自动启用 L3/L4 DDoS 保护
   - 配置 L7 DDoS 保护阈值

2. **Bot 管理**
   - 启用 Bot Fight Mode
   - 配置 Bot 管理规则

### 5. 缓存策略

```yaml
页面规则配置:
1. API 接口 (api.yourdomain.com/api/*)
   - 缓存级别: 绕过
   - 禁用性能功能
   - 安全级别: 高

2. 静态资源 (yourdomain.com/_next/static/*)
   - 缓存级别: 缓存所有内容
   - 边缘缓存 TTL: 1个月
   - 浏览器缓存 TTL: 1天

3. 首页 (yourdomain.com/)
   - 缓存级别: 标准
   - 边缘缓存 TTL: 2小时
```

### 6. 监控和日志

#### 设置告警
1. **安全事件告警**
   - 高安全级别阻止 > 100/小时
   - DDoS 攻击检测
   - 证书过期提醒

2. **性能告警**
   - 响应时间 > 5秒
   - 错误率 > 5%
   - Tunnel 连接中断

#### 日志分析
```bash
# 查看 Cloudflare 日志
curl -X GET "https://api.cloudflare.com/client/v4/zones/ZONE_ID/logs/received" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json"
```

### 7. 本地安全配置

#### 配置文件权限
```bash
# 设置正确的文件权限
chmod 600 ~/.cloudflared/config.yml
chmod 600 ~/.cloudflared/*.json
chmod 700 ~/.cloudflared/
```

#### 启动脚本安全
```bash
# 创建安全的启动脚本
cat > ~/start-tunnel-secure.sh << 'EOF'
#!/bin/bash
set -euo pipefail

# 检查服务状态
if ! pgrep -f "uvicorn.*8080" > /dev/null; then
    echo "错误: 后端服务未运行"
    exit 1
fi

if ! pgrep -f "next.*3004" > /dev/null; then
    echo "错误: 前端服务未运行"
    exit 1
fi

# 启动 tunnel
exec cloudflared tunnel --config ~/.cloudflared/config.yml run
EOF

chmod +x ~/start-tunnel-secure.sh
```

### 8. 应急响应计划

#### 安全事件处理
1. **发现异常流量**
   ```bash
   # 临时阻止 Tunnel
   pkill cloudflared
   
   # 检查 Cloudflare 防火墙日志
   # 在 Dashboard 中添加临时阻止规则
   ```

2. **证书问题**
   ```bash
   # 重新认证
   cloudflared tunnel login
   
   # 检查证书状态
   openssl x509 -in ~/.cloudflared/cert.pem -text -noout
   ```

### 9. 定期安全检查

#### 每周检查清单
- [ ] 检查 Cloudflare 安全日志
- [ ] 验证防火墙规则有效性
- [ ] 检查 SSL 证书状态
- [ ] 更新 Cloudflared 版本

#### 每月检查清单
- [ ] 审查访问日志异常
- [ ] 测试备份和恢复流程
- [ ] 检查域名和 DNS 配置
- [ ] 更新安全策略

### 10. 备份和恢复

#### 配置备份
```bash
# 备份 Cloudflare 配置
cp -r ~/.cloudflared ~/.cloudflared.backup.$(date +%Y%m%d)

# 导出 Tunnel 配置
cloudflared tunnel info muses-tunnel > tunnel-info-backup.txt
```

#### 快速恢复
```bash
# 恢复配置
cp -r ~/.cloudflared.backup.YYYYMMDD ~/.cloudflared

# 重启 Tunnel
cloudflared tunnel --config ~/.cloudflared/config.yml run
```