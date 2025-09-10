module.exports = {
  apps: [{
    name: 'khs-backup',
    script: './index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '100M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/error.log',
    out_file: './logs/output.log',
    log_file: './logs/combined.log',
    time: true,
    cron_restart: '0 0 * * *', // Daily restart at midnight for stability
  }]
};