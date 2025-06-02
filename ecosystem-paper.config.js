module.exports = {
  apps: [
    {
      name: 'zenbot-paper-sui',
      script: '/home/crypto/Quant-ZenbotV2/zenbot.sh',
      args: 'trade --conf=conf-paper-sui.js --paper',
      cwd: '/home/crypto/Quant-ZenbotV2',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      env: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--max-old-space-size=2048'
      },
      error_file: './logs/paper-sui-error.log',
      out_file: './logs/paper-sui-out.log',
      log_file: './logs/paper-sui-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      kill_timeout: 5000,
      restart_delay: 1000,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'zenbot-backfill-sui',
      script: '/home/crypto/Quant-ZenbotV2/zenbot.sh',
      args: 'backfill binance.SUI-USDT --days=1',
      cwd: '/home/crypto/Quant-ZenbotV2',
      instances: 1,
      autorestart: false,
      watch: false,
      cron_restart: '0 */6 * * *',  // Backfill every 6 hours
      env: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--max-old-space-size=1024'
      },
      error_file: './logs/backfill-sui-error.log',
      out_file: './logs/backfill-sui-out.log',
      log_file: './logs/backfill-sui-combined.log',
      time: true
    }
  ]
}
