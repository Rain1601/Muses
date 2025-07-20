module.exports = {
  apps: [
    {
      name: 'muses-backend',
      script: './backend/dist/index.js',
      cwd: './backend',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 8080
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true,
      max_memory_restart: '500M',
      watch: false,
      autorestart: true,
      restart_delay: 5000,
    },
    {
      name: 'muses-frontend',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: './frontend',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_file: './logs/frontend-combined.log',
      time: true,
      max_memory_restart: '500M',
      watch: false,
      autorestart: true,
      restart_delay: 5000,
    }
  ],

  // 部署配置（可选）
  deploy: {
    production: {
      user: 'deploy',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:yourusername/muses.git',
      path: '/var/www/muses',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};