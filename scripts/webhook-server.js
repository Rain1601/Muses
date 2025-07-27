#!/usr/bin/env node

/**
 * Muses Webhook 部署服务
 * 监听 GitHub webhook，自动触发部署
 */

const express = require('express');
const crypto = require('crypto');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.WEBHOOK_PORT || 9000;
const SECRET = process.env.WEBHOOK_SECRET || 'your-webhook-secret';
const PROJECT_DIR = process.env.PROJECT_DIR || '/path/to/Muses';

app.use(express.json());

// 验证 webhook 签名
function verifySignature(payload, signature) {
    const computedSignature = crypto
        .createHmac('sha256', SECRET)
        .update(payload)
        .digest('hex');
    
    return crypto.timingSafeEqual(
        Buffer.from(`sha256=${computedSignature}`),
        Buffer.from(signature)
    );
}

// 执行部署脚本
function runDeployment() {
    return new Promise((resolve, reject) => {
        const deployScript = path.join(PROJECT_DIR, 'scripts', 'deploy.sh');
        
        console.log('🚀 开始执行部署脚本...');
        
        exec(`chmod +x ${deployScript} && ${deployScript}`, {
            cwd: PROJECT_DIR,
            timeout: 600000, // 10分钟超时
        }, (error, stdout, stderr) => {
            if (error) {
                console.error('❌ 部署失败:', error);
                reject(error);
            } else {
                console.log('✅ 部署成功');
                console.log('标准输出:', stdout);
                if (stderr) console.log('标准错误:', stderr);
                resolve(stdout);
            }
        });
    });
}

// GitHub webhook 端点
app.post('/webhook', async (req, res) => {
    const signature = req.headers['x-hub-signature-256'];
    const payload = JSON.stringify(req.body);
    
    // 验证签名
    if (!verifySignature(payload, signature)) {
        console.log('❌ Webhook 签名验证失败');
        return res.status(401).send('Unauthorized');
    }
    
    const event = req.headers['x-github-event'];
    const { ref, repository, pusher } = req.body;
    
    console.log(`📨 收到 ${event} 事件`);
    console.log(`分支: ${ref}`);
    console.log(`仓库: ${repository?.full_name}`);
    console.log(`推送者: ${pusher?.name}`);
    
    // 只处理 main 分支的 push 事件
    if (event === 'push' && ref === 'refs/heads/main') {
        console.log('🎯 检测到 main 分支更新，开始部署...');
        
        try {
            await runDeployment();
            res.status(200).send('Deployment triggered successfully');
        } catch (error) {
            console.error('部署过程中出错:', error);
            res.status(500).send('Deployment failed');
        }
    } else {
        console.log('⏭️  忽略此事件');
        res.status(200).send('Event ignored');
    }
});

// 健康检查端点
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'muses-webhook-server'
    });
});

// 手动触发部署端点
app.post('/deploy', async (req, res) => {
    const { token } = req.body;
    
    // 简单的 token 验证
    if (token !== SECRET) {
        return res.status(401).send('Unauthorized');
    }
    
    console.log('🔧 手动触发部署...');
    
    try {
        await runDeployment();
        res.status(200).send('Manual deployment triggered successfully');
    } catch (error) {
        console.error('手动部署失败:', error);
        res.status(500).send('Manual deployment failed');
    }
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`🎉 Muses Webhook 服务已启动`);
    console.log(`📡 监听端口: ${PORT}`);
    console.log(`📂 项目目录: ${PROJECT_DIR}`);
    console.log(`🔒 Secret: ${SECRET ? '已配置' : '未配置'}`);
    console.log(`\n可用端点:`);
    console.log(`  POST /webhook - GitHub webhook`);
    console.log(`  POST /deploy  - 手动部署`);
    console.log(`  GET  /health  - 健康检查`);
});

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('👋 收到终止信号，正在关闭服务器...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('👋 收到中断信号，正在关闭服务器...');
    process.exit(0);
});