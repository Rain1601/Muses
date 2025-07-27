#!/usr/bin/env node

/**
 * 简化的 Muses Webhook 服务器
 * 监听 GitHub Actions 触发的部署请求
 */

const http = require('http');
const crypto = require('crypto');
const { exec } = require('child_process');
const path = require('path');

// 配置
const PORT = process.env.WEBHOOK_PORT || 9000;
const SECRET = process.env.WEBHOOK_SECRET || 'your-webhook-secret-change-this';
const PROJECT_DIR = process.env.PROJECT_DIR || process.env.HOME + '/Muses';

console.log('🚀 Muses Webhook 服务器启动中...');
console.log(`📡 端口: ${PORT}`);
console.log(`📂 项目目录: ${PROJECT_DIR}`);
console.log(`🔒 Secret: ${SECRET ? '已配置' : '❌ 未配置'}`);

// 验证签名
function verifySignature(payload, signature, secret) {
    if (!signature) return false;
    
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
    
    const actualSignature = signature.replace('sha256=', '');
    
    return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(actualSignature)
    );
}

// 执行部署
function runDeployment() {
    return new Promise((resolve, reject) => {
        const deployScript = path.join(PROJECT_DIR, 'scripts', 'mac-mini-deploy.sh');
        
        console.log('🔧 开始执行部署...');
        console.log(`📜 脚本路径: ${deployScript}`);
        
        // 给脚本执行权限
        exec(`chmod +x "${deployScript}"`, (chmodError) => {
            if (chmodError) {
                console.error('❌ 无法设置脚本权限:', chmodError);
                reject(chmodError);
                return;
            }
            
            // 执行部署脚本
            exec(`"${deployScript}" deploy`, {
                cwd: PROJECT_DIR,
                timeout: 600000, // 10分钟超时
                maxBuffer: 1024 * 1024 * 10 // 10MB buffer
            }, (error, stdout, stderr) => {
                console.log('📋 部署脚本输出:');
                console.log(stdout);
                
                if (stderr) {
                    console.log('⚠️  错误输出:');
                    console.log(stderr);
                }
                
                if (error) {
                    console.error('❌ 部署失败:', error.message);
                    reject(error);
                } else {
                    console.log('✅ 部署成功完成');
                    resolve(stdout);
                }
            });
        });
    });
}

// 创建服务器
const server = http.createServer(async (req, res) => {
    // 设置 CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Hub-Signature-256, X-GitHub-Event');
    
    // 处理 OPTIONS 请求
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // 健康检查端点
    if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: 'muses-webhook-server',
            project_dir: PROJECT_DIR
        }));
        return;
    }
    
    // Webhook 端点
    if (req.method === 'POST' && req.url === '/webhook') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', async () => {
            try {
                console.log('📨 收到 webhook 请求');
                
                // 获取头部信息
                const signature = req.headers['x-hub-signature-256'];
                const githubEvent = req.headers['x-github-event'];
                
                console.log(`🎯 事件类型: ${githubEvent}`);
                console.log(`🔏 签名: ${signature ? '已提供' : '未提供'}`);
                
                // 验证签名
                if (!verifySignature(body, signature, SECRET)) {
                    console.log('❌ 签名验证失败');
                    res.writeHead(401);
                    res.end('Unauthorized - Invalid signature');
                    return;
                }
                
                console.log('✅ 签名验证通过');
                
                // 解析请求体
                let payload;
                try {
                    payload = JSON.parse(body);
                } catch (parseError) {
                    console.error('❌ JSON 解析失败:', parseError);
                    res.writeHead(400);
                    res.end('Bad Request - Invalid JSON');
                    return;
                }
                
                // 检查是否为 main 分支的 push 事件
                const ref = payload.ref;
                const repository = payload.repository?.full_name;
                const pusher = payload.pusher?.name;
                
                console.log(`📂 仓库: ${repository}`);
                console.log(`🌿 分支: ${ref}`);
                console.log(`👤 推送者: ${pusher}`);
                
                if (githubEvent === 'push' && ref === 'refs/heads/main') {
                    console.log('🎯 检测到 main 分支更新，开始部署...');
                    
                    // 异步执行部署
                    runDeployment()
                        .then((result) => {
                            console.log('🎉 部署完成:', result);
                        })
                        .catch((error) => {
                            console.error('💥 部署失败:', error);
                        });
                    
                    res.writeHead(200);
                    res.end('Deployment triggered successfully');
                } else {
                    console.log('⏭️  忽略此事件');
                    res.writeHead(200);
                    res.end('Event ignored');
                }
                
            } catch (error) {
                console.error('💥 处理请求时出错:', error);
                res.writeHead(500);
                res.end('Internal Server Error');
            }
        });
        
        return;
    }
    
    // 手动部署端点
    if (req.method === 'POST' && req.url === '/deploy') {
        console.log('🔧 收到手动部署请求');
        
        try {
            await runDeployment();
            res.writeHead(200);
            res.end('Manual deployment completed successfully');
        } catch (error) {
            console.error('💥 手动部署失败:', error);
            res.writeHead(500);
            res.end('Manual deployment failed: ' + error.message);
        }
        return;
    }
    
    // 404
    res.writeHead(404);
    res.end('Not Found');
});

// 启动服务器
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🎉 Webhook 服务器已启动!`);
    console.log(`🌐 访问地址: http://localhost:${PORT}`);
    console.log(`\n可用端点:`);
    console.log(`  📡 POST /webhook - GitHub webhook 接收端点`);
    console.log(`  🔧 POST /deploy  - 手动触发部署`);
    console.log(`  ❤️  GET  /health  - 服务健康检查`);
    console.log(`\n🔧 手动部署测试:`);
    console.log(`  curl -X POST http://localhost:${PORT}/deploy`);
    console.log(`\n❤️  健康检查测试:`);
    console.log(`  curl http://localhost:${PORT}/health`);
});

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('\n👋 收到终止信号，正在关闭服务器...');
    server.close(() => {
        console.log('✅ 服务器已关闭');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\n👋 收到中断信号，正在关闭服务器...');
    server.close(() => {
        console.log('✅ 服务器已关闭');
        process.exit(0);
    });
});

// 错误处理
process.on('uncaughtException', (error) => {
    console.error('💥 未捕获异常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 未处理的 Promise 拒绝:', reason);
});