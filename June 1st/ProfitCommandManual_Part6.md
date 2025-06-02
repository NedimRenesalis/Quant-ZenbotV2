# Zenbot Trading Strategy ProfitCommandManual - Part 6 of 6

## Comprehensive Terminal Commands and Troubleshooting

In this final part of the ProfitCommandManual, we'll provide a comprehensive reference for all terminal commands needed to operate, deploy, monitor, and troubleshoot your Zenbot trading system. This guide covers everything from initial setup to advanced operations and troubleshooting.

### Table of Contents

1. [Initial Setup and Configuration](#initial-setup-and-configuration)
2. [Development Environment](#development-environment)
3. [Testing Commands](#testing-commands)
4. [Backup and Recovery](#backup-and-recovery)
5. [Production Deployment](#production-deployment)
6. [Monitoring and Maintenance](#monitoring-and-maintenance)
7. [Troubleshooting](#troubleshooting)
8. [Security Best Practices](#security-best-practices)
9. [Common Operations](#common-operations)
10. [Advanced Operations](#advanced-operations)

## Initial Setup and Configuration

### System Requirements

Ensure your system meets the following requirements:

- Node.js 12.x or higher
- MongoDB 4.x or higher
- Git
- Linux-based OS (Ubuntu 18.04+ recommended)
- 2GB RAM minimum (4GB+ recommended)
- 20GB disk space minimum

### Installing Dependencies

```bash
# Update package lists
sudo apt update

# Install Node.js and npm
sudo apt install -y nodejs npm

# Install MongoDB
sudo apt install -y mongodb

# Install build essentials
sudo apt install -y build-essential git

# Install PM2 for process management
sudo npm install -g pm2

# Install forever for process management (alternative to PM2)
sudo npm install -g forever
```

### Cloning the Repository

```bash
# Clone the Zenbot repository
git clone https://github.com/DeviaVir/zenbot.git

# Navigate to the Zenbot directory
cd zenbot

# Install dependencies
npm install
```

### Basic Configuration

```bash
# Copy the sample configuration file
cp conf-sample.js conf.js

# Open the configuration file for editing
nano conf.js
```

Key configuration parameters to set:

```javascript
// Exchange configuration
c.exchange = 'binance'  // Change to your exchange
c.currency_pair = 'BTC-USDT'  // Change to your currency pair

// API credentials (use environment variables in production)
c.apiKey = process.env.ZENBOT_API_KEY || 'your-api-key'
c.apiSecret = process.env.ZENBOT_API_SECRET || 'your-api-secret'

// Trading parameters
c.strategy = 'stddev'
c.mode = 'paper'  // Change to 'live' for real trading
c.sell_stop_pct = 0.1  // 0.1% stop loss
c.profit_stop_enable_pct = 5  // Enable profit taking at 5%
c.profit_stop_pct = 1  // 1% trailing stop

// Enhanced features
c.enable_market_adaptation = true
c.market_adaptation_strength = 1.0
c.save_state = true
c.state_dir = './state'
c.enable_health_check = true
c.auto_recover = true
c.log_level = 'info'
```

### Setting Up Environment Variables

For production, use environment variables to store sensitive information:

```bash
# Create a .env file
cat > .env << 'EOF'
ZENBOT_API_KEY=your-api-key
ZENBOT_API_SECRET=your-api-secret
ZENBOT_PASSPHRASE=your-passphrase
ZENBOT_MODE=live
ZENBOT_EXCHANGE=binance
ZENBOT_SELECTOR=BTC-USDT
ZENBOT_STRATEGY=stddev
ZENBOT_SELL_STOP_PCT=0.1
ZENBOT_PROFIT_STOP_ENABLE_PCT=5
ZENBOT_PROFIT_STOP_PCT=1
ZENBOT_ENABLE_MARKET_ADAPTATION=true
ZENBOT_MARKET_ADAPTATION_STRENGTH=1.0
ZENBOT_SAVE_STATE=true
ZENBOT_STATE_DIR=/var/lib/zenbot/state
ZENBOT_ENABLE_HEALTH_CHECK=true
ZENBOT_AUTO_RECOVER=true
ZENBOT_LOG_LEVEL=info
EOF

# Secure the .env file
chmod 600 .env

# Load environment variables
source .env
```

## Development Environment

### Setting Up a Development Branch

```bash
# Create and switch to a development branch
git checkout -b zenbot-profit-improvements

# Verify you're on the new branch
git branch
```

### Installing Development Tools

```bash
# Install nodemon for development
npm install -g nodemon

# Install ESLint for code quality
npm install -g eslint

# Install debugging tools
npm install -g node-inspector
```

### Running in Development Mode

```bash
# Run with nodemon for automatic restarts
nodemon zenbot.js trade --strategy=stddev --paper --debug_log=true

# Run with Node.js debugging enabled
node --inspect zenbot.js trade --strategy=stddev --paper
```

## Testing Commands

### Running Simulations

```bash
# Basic simulation
./zenbot.sh sim --strategy=stddev --days=30

# Simulation with stop loss
./zenbot.sh sim --strategy=stddev --days=30 --sell_stop_pct=0.1

# Simulation with profit taking
./zenbot.sh sim --strategy=stddev --days=30 --sell_stop_pct=0.1 --profit_stop_enable_pct=5 --profit_stop_pct=1

# Simulation with market adaptation
./zenbot.sh sim --strategy=stddev --days=30 --sell_stop_pct=0.1 --profit_stop_enable_pct=5 --profit_stop_pct=1 --enable_market_adaptation=true

# Simulation with specific date range
./zenbot.sh sim --strategy=stddev --days=30 --start=2023-01-01

# Simulation with analysis output
./zenbot.sh sim --strategy=stddev --days=30 --analyze
```

### Running Unit Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- test/engine.test.js

# Run tests with coverage
npm run test-coverage
```

### Running Integration Tests

```bash
# Run the comprehensive test script for Iteration 1
./test_iteration1_comprehensive.sh

# Run the comprehensive test script for Iteration 2
./test_iteration2_comprehensive.sh

# Run the comprehensive test script for Iteration 3
./test_iteration3_comprehensive.sh

# Run the comprehensive test script for Iteration 4
./test_production_hardening.sh
```

## Backup and Recovery

### Backing Up Configuration

```bash
# Create a configs backup directory
mkdir -p ~/zenbot_config_backups

# Copy your current configuration files
cp conf.js ~/zenbot_config_backups/conf.js.bak
cp extensions/strategies/stddev/strategy.js ~/zenbot_config_backups/strategy.js.bak
cp lib/engine.js ~/zenbot_config_backups/engine.js.bak
cp commands/trade.js ~/zenbot_config_backups/trade.js.bak

# Verify the backups were created
ls -la ~/zenbot_config_backups/
```

### Backing Up the Entire Installation

```bash
# Navigate to the parent directory of your Zenbot installation
cd /path/to/parent/directory

# Create a timestamped backup of your entire Zenbot directory
tar -czvf zenbot_backup_$(date +%Y%m%d_%H%M%S).tar.gz zenbot/

# Verify the backup was created successfully
ls -lh zenbot_backup_*.tar.gz
```

### Backing Up State Files

```bash
# Create a state backup directory
mkdir -p ~/zenbot_state_backups

# Copy your current state files
cp -r ./state/* ~/zenbot_state_backups/

# Create a timestamped archive of state files
tar -czvf ~/zenbot_state_backups/state_backup_$(date +%Y%m%d_%H%M%S).tar.gz ./state/

# Verify the backups were created
ls -la ~/zenbot_state_backups/
```

### Restoring from Backup

```bash
# Restore configuration files
cp ~/zenbot_config_backups/conf.js.bak conf.js
cp ~/zenbot_config_backups/strategy.js.bak extensions/strategies/stddev/strategy.js
cp ~/zenbot_config_backups/engine.js.bak lib/engine.js
cp ~/zenbot_config_backups/trade.js.bak commands/trade.js

# Restore entire installation
cd /path/to/parent/directory
tar -xzvf zenbot_backup_YYYYMMDD_HHMMSS.tar.gz

# Restore state files
rm -rf ./state/*
cp -r ~/zenbot_state_backups/* ./state/
```

### Using the Automated Backup Script

```bash
# Run the backup script
./backup_zenbot.sh

# List available backups
ls -la /var/lib/zenbot/backups/

# Restore from a backup
./restore_zenbot.sh /var/lib/zenbot/backups/zenbot_full_YYYYMMDD_HHMMSS.tar.gz

# Rollback state only
./rollback_state.sh /var/lib/zenbot/backups/state/state_YYYYMMDD_HHMMSS.tar.gz
```

## Production Deployment

### Preparing for Production

```bash
# Create production directories
sudo mkdir -p /opt/zenbot
sudo mkdir -p /var/log/zenbot
sudo mkdir -p /var/lib/zenbot/state
sudo mkdir -p /var/lib/zenbot/health

# Create zenbot user
sudo useradd -r -s /bin/false zenbot

# Set directory permissions
sudo chown -R zenbot:zenbot /opt/zenbot
sudo chown -R zenbot:zenbot /var/log/zenbot
sudo chown -R zenbot:zenbot /var/lib/zenbot
sudo chmod -R 750 /opt/zenbot
sudo chmod -R 750 /var/log/zenbot
sudo chmod -R 750 /var/lib/zenbot
```

### Deploying to Production

```bash
# Run the production deployment script
sudo ./deploy_production.sh binance BTC-USDT stddev paper

# Verify the deployment
ls -la /opt/zenbot
ls -la /var/log/zenbot
ls -la /var/lib/zenbot
```

### Starting the Service

```bash
# Start the Zenbot service
sudo systemctl start zenbot.service

# Check the service status
sudo systemctl status zenbot.service

# View the service logs
sudo journalctl -u zenbot.service

# View the application logs
sudo tail -f /var/log/zenbot/combined-$(date +%Y-%m-%d).log
```

### Stopping the Service

```bash
# Stop the Zenbot service
sudo systemctl stop zenbot.service

# Restart the Zenbot service
sudo systemctl restart zenbot.service

# Reload the Zenbot service configuration
sudo systemctl reload zenbot.service
```

### Updating the Production Deployment

```bash
# Stop the service
sudo systemctl stop zenbot.service

# Back up the current installation
sudo tar -czf /opt/zenbot_backups/zenbot_pre_update_$(date +%Y%m%d_%H%M%S).tar.gz -C /opt zenbot

# Update the repository
cd /opt/zenbot
sudo -u zenbot git fetch --all
sudo -u zenbot git reset --hard origin/master

# Install dependencies
sudo -u zenbot npm install

# Start the service
sudo systemctl start zenbot.service

# Check the service status
sudo systemctl status zenbot.service
```

## Monitoring and Maintenance

### Setting Up Monitoring

```bash
# Run the monitoring script
./monitor_zenbot.sh

# Set up a cron job to run the monitoring script every 5 minutes
(crontab -l 2>/dev/null; echo "*/5 * * * * /path/to/monitor_zenbot.sh >> /var/log/zenbot_monitoring.log 2>&1") | crontab -
```

### Checking Health Status

```bash
# Check the health status
cat /var/lib/zenbot/health/*_health.json | jq .

# Check for recent errors
grep -i "error" /var/log/zenbot/error-$(date +%Y-%m-%d).log | tail -n 20

# Check for warnings
grep -i "warning" /var/log/zenbot/combined-$(date +%Y-%m-%d).log | tail -n 20
```

### Log Rotation

```bash
# Set up log rotation
sudo cat > /etc/logrotate.d/zenbot << 'EOF'
/var/log/zenbot/*.log {
  daily
  missingok
  rotate 14
  compress
  delaycompress
  notifempty
  create 0640 zenbot zenbot
  sharedscripts
  postrotate
    systemctl reload zenbot.service >/dev/null 2>&1 || true
  endscript
}
EOF

# Test log rotation
sudo logrotate -f /etc/logrotate.d/zenbot
```

### Database Maintenance

```bash
# Connect to MongoDB
mongo

# Show databases
show dbs

# Use Zenbot database
use zenbot

# Show collections
show collections

# Check trade history
db.trades.find().sort({time: -1}).limit(10)

# Backup MongoDB data
mongodump --db zenbot --out /opt/zenbot_backups/mongo_$(date +%Y%m%d_%H%M%S)

# Restore MongoDB data
mongorestore --db zenbot /opt/zenbot_backups/mongo_YYYYMMDD_HHMMSS/zenbot
```

## Troubleshooting

### Common Issues and Solutions

#### Service Won't Start

```bash
# Check service status
sudo systemctl status zenbot.service

# Check for errors in journal
sudo journalctl -u zenbot.service -n 100

# Check for errors in application logs
sudo tail -n 100 /var/log/zenbot/error-$(date +%Y-%m-%d).log

# Check file permissions
sudo ls -la /opt/zenbot
sudo ls -la /var/log/zenbot
sudo ls -la /var/lib/zenbot

# Fix permissions if needed
sudo chown -R zenbot:zenbot /opt/zenbot
sudo chown -R zenbot:zenbot /var/log/zenbot
sudo chown -R zenbot:zenbot /var/lib/zenbot
```

#### API Connection Issues

```bash
# Check network connectivity
ping api.exchange.com

# Check API credentials
grep -i "api" /var/log/zenbot/error-$(date +%Y-%m-%d).log

# Test API connection
curl -v https://api.exchange.com/v1/ping

# Update API credentials
sudo nano /opt/zenbot/conf.js
```

#### State Corruption

```bash
# Check state files
ls -la /var/lib/zenbot/state

# Backup corrupted state
sudo tar -czf /opt/zenbot_backups/corrupted_state_$(date +%Y%m%d_%H%M%S).tar.gz -C /var/lib/zenbot state

# Remove corrupted state files
sudo rm -rf /var/lib/zenbot/state/*

# Restore from backup
sudo tar -xzf /opt/zenbot_backups/state_YYYYMMDD_HHMMSS.tar.gz -C /var/lib/zenbot
```

#### Memory Issues

```bash
# Check memory usage
free -m

# Check Zenbot process memory usage
ps -o pid,user,%mem,command ax | grep zenbot

# Increase Node.js memory limit
sudo nano /etc/systemd/system/zenbot.service
# Add --max-old-space-size=4096 to the ExecStart line
# Example: ExecStart=/usr/bin/node --max-old-space-size=4096 /opt/zenbot/zenbot.js trade ...

# Reload systemd and restart service
sudo systemctl daemon-reload
sudo systemctl restart zenbot.service
```

### Debugging Tools

```bash
# Enable debug logging
sudo nano /opt/zenbot/conf.js
# Set c.debug = true and c.log_level = 'debug'

# Restart service with debug logging
sudo systemctl restart zenbot.service

# Tail debug logs
sudo tail -f /var/log/zenbot/debug-$(date +%Y-%m-%d).log

# Check for specific errors
grep -i "error" /var/log/zenbot/combined-$(date +%Y-%m-%d).log | grep -i "api"

# Check for specific warnings
grep -i "warning" /var/log/zenbot/combined-$(date +%Y-%m-%d).log | grep -i "state"
```

### Recovery Procedures

```bash
# Emergency stop
sudo systemctl stop zenbot.service

# Roll back to previous version
cd /opt/zenbot
sudo -u zenbot git reset --hard HEAD~1
sudo systemctl restart zenbot.service

# Roll back state
sudo -u zenbot ./rollback_state.sh

# Reset to clean state
sudo rm -rf /var/lib/zenbot/state/*
sudo systemctl restart zenbot.service
```

## Security Best Practices

### Securing API Keys

```bash
# Use environment variables instead of hardcoding
sudo nano /etc/systemd/system/zenbot.service
# Add environment variables
# Example:
# Environment=ZENBOT_API_KEY=your-api-key
# Environment=ZENBOT_API_SECRET=your-api-secret

# Create a secure .env file
sudo -u zenbot cat > /opt/zenbot/.env << 'EOF'
ZENBOT_API_KEY=your-api-key
ZENBOT_API_SECRET=your-api-secret
EOF

# Secure the .env file
sudo chmod 600 /opt/zenbot/.env
sudo chown zenbot:zenbot /opt/zenbot/.env

# Update service to use .env file
sudo nano /etc/systemd/system/zenbot.service
# Add EnvironmentFile=/opt/zenbot/.env

# Reload systemd
sudo systemctl daemon-reload
```

### Securing the Installation

```bash
# Restrict access to Zenbot directories
sudo chmod -R 750 /opt/zenbot
sudo chmod -R 750 /var/log/zenbot
sudo chmod -R 750 /var/lib/zenbot

# Ensure only zenbot user can access sensitive files
sudo chown -R zenbot:zenbot /opt/zenbot
sudo chown -R zenbot:zenbot /var/log/zenbot
sudo chown -R zenbot:zenbot /var/lib/zenbot

# Set up a firewall
sudo ufw enable
sudo ufw allow ssh
sudo ufw status
```

### Regular Security Audits

```bash
# Check for outdated npm packages
cd /opt/zenbot
npm audit

# Update vulnerable packages
npm audit fix

# Check file permissions
find /opt/zenbot -type f -name "*.js" -exec ls -la {} \;
find /var/lib/zenbot -type f -exec ls -la {} \;

# Check for unauthorized access
sudo grep -i "authentication failure" /var/log/auth.log
```

## Common Operations

### Checking Trade History

```bash
# View recent trades
./zenbot.sh list-trades --limit=20

# View trades for a specific date range
./zenbot.sh list-trades --start=2023-01-01 --end=2023-01-31

# Export trades to CSV
./zenbot.sh list-trades --format=csv > trades.csv

# View trade performance
./zenbot.sh list-trades --analyze
```

### Changing Trading Parameters

```bash
# Edit configuration file
nano conf.js

# Update stop loss percentage
./zenbot.sh trade --strategy=stddev --sell_stop_pct=0.2

# Update profit taking parameters
./zenbot.sh trade --strategy=stddev --profit_stop_enable_pct=3 --profit_stop_pct=0.5

# Enable/disable market adaptation
./zenbot.sh trade --strategy=stddev --enable_market_adaptation=true
```

### Switching Between Paper and Live Trading

```bash
# Switch to paper trading
./zenbot.sh trade --strategy=stddev --paper

# Switch to live trading (use with caution)
./zenbot.sh trade --strategy=stddev --paper=false
```

### Analyzing Performance

```bash
# Run a simulation with analysis
./zenbot.sh sim --strategy=stddev --days=30 --analyze

# Compare strategies
./zenbot.sh sim --strategy=stddev --days=30 --analyze > stddev_results.txt
./zenbot.sh sim --strategy=macd --days=30 --analyze > macd_results.txt
diff stddev_results.txt macd_results.txt

# Generate a performance report
./zenbot.sh sim --strategy=stddev --days=90 --analyze --markdown > performance_report.md
```

## Advanced Operations

### Custom Strategy Development

```bash
# Create a new strategy
cp -r extensions/strategies/stddev extensions/strategies/mystrategy

# Edit the strategy file
nano extensions/strategies/mystrategy/strategy.js

# Test the new strategy
./zenbot.sh sim --strategy=mystrategy --days=30 --analyze
```

### Automated Trading Scripts

```bash
# Create a trading script
cat > start_trading.sh << 'EOF'
#!/bin/bash

# Configuration
STRATEGY="stddev"
PAIR="BTC-USDT"
EXCHANGE="binance"
SELL_STOP_PCT=0.1
PROFIT_STOP_ENABLE_PCT=5
PROFIT_STOP_PCT=1
LOG_DIR="/var/log/zenbot"
STATE_DIR="/var/lib/zenbot/state"

# Ensure directories exist
mkdir -p $LOG_DIR
mkdir -p $STATE_DIR

# Start trading
./zenbot.sh trade \
  --strategy=$STRATEGY \
  --exchange=$EXCHANGE \
  --selector=$PAIR \
  --paper=false \
  --sell_stop_pct=$SELL_STOP_PCT \
  --profit_stop_enable_pct=$PROFIT_STOP_ENABLE_PCT \
  --profit_stop_pct=$PROFIT_STOP_PCT \
  --enable_market_adaptation=true \
  --save_state=true \
  --state_dir=$STATE_DIR \
  --enable_health_check=true \
  --auto_recover=true \
  --log_level=info \
  >> $LOG_DIR/trading_$(date +%Y%m%d).log 2>&1 &

echo "Trading started with PID $!"
EOF

# Make the script executable
chmod +x start_trading.sh
```

### Multi-Pair Trading

```bash
# Create a multi-pair trading script
cat > multi_pair_trading.sh << 'EOF'
#!/bin/bash

# Configuration
STRATEGY="stddev"
EXCHANGE="binance"
PAIRS=("BTC-USDT" "ETH-USDT" "LTC-USDT")
SELL_STOP_PCT=0.1
PROFIT_STOP_ENABLE_PCT=5
PROFIT_STOP_PCT=1
LOG_DIR="/var/log/zenbot"
STATE_DIR="/var/lib/zenbot/state"

# Ensure directories exist
mkdir -p $LOG_DIR
mkdir -p $STATE_DIR

# Start trading for each pair
for PAIR in "${PAIRS[@]}"
do
  echo "Starting trading for $PAIR"
  ./zenbot.sh trade \
    --strategy=$STRATEGY \
    --exchange=$EXCHANGE \
    --selector=$PAIR \
    --paper=false \
    --sell_stop_pct=$SELL_STOP_PCT \
    --profit_stop_enable_pct=$PROFIT_STOP_ENABLE_PCT \
    --profit_stop_pct=$PROFIT_STOP_PCT \
    --enable_market_adaptation=true \
    --save_state=true \
    --state_dir=$STATE_DIR/$PAIR \
    --enable_health_check=true \
    --auto_recover=true \
    --log_level=info \
    >> $LOG_DIR/trading_${PAIR}_$(date +%Y%m%d).log 2>&1 &
  
  echo "$PAIR trading started with PID $!"
  
  # Wait a bit to avoid API rate limits
  sleep 5
done
EOF

# Make the script executable
chmod +x multi_pair_trading.sh
```

### Advanced Monitoring Dashboard

```bash
# Install required packages
npm install -g pm2 pm2-web

# Start PM2 monitoring
pm2 start zenbot.js -- trade --strategy=stddev --paper=false

# Start PM2 web interface
pm2-web

# Access the web interface at http://localhost:9000
```

### Data Export and Analysis

```bash
# Export trade data to CSV
./zenbot.sh list-trades --format=csv > trades.csv

# Export simulation results to JSON
./zenbot.sh sim --strategy=stddev --days=30 --output=json > sim_results.json

# Create a Python analysis script
cat > analyze_trades.py << 'EOF'
#!/usr/bin/env python3
import pandas as pd
import matplotlib.pyplot as plt
import sys

# Load trade data
trades = pd.read_csv('trades.csv')

# Convert time to datetime
trades['time'] = pd.to_datetime(trades['time'])

# Set time as index
trades.set_index('time', inplace=True)

# Calculate cumulative profit
trades['cumulative_profit'] = trades['profit'].cumsum()

# Plot cumulative profit
plt.figure(figsize=(12, 6))
trades['cumulative_profit'].plot()
plt.title('Cumulative Profit Over Time')
plt.xlabel('Date')
plt.ylabel('Profit')
plt.grid(True)
plt.savefig('cumulative_profit.png')
plt.close()

# Print summary statistics
print("Trade Summary:")
print(f"Total trades: {len(trades)}")
print(f"Profitable trades: {len(trades[trades['profit'] > 0])}")
print(f"Loss-making trades: {len(trades[trades['profit'] < 0])}")
print(f"Total profit: {trades['profit'].sum()}")
print(f"Average profit per trade: {trades['profit'].mean()}")
print(f"Largest profit: {trades['profit'].max()}")
print(f"Largest loss: {trades['profit'].min()}")
print(f"Profit factor: {trades[trades['profit'] > 0]['profit'].sum() / abs(trades[trades['profit'] < 0]['profit'].sum())}")
EOF

# Make the script executable
chmod +x analyze_trades.py

# Run the analysis
./analyze_trades.py
```

### Advanced Configuration Options

Here are some advanced configuration options you can add to your `conf.js` file:

```javascript
// Advanced risk management
c.max_slippage_pct = 0.5  // Maximum acceptable slippage percentage
c.max_buy_loss_pct = 0.5  // Maximum acceptable loss percentage for buy orders
c.max_sell_loss_pct = 0.5  // Maximum acceptable loss percentage for sell orders
c.order_adjust_time = 5000  // Time in ms to adjust orders
c.order_poll_time = 5000  // Time in ms to poll for order completion
c.cancel_after = 180000  // Time in ms to automatically cancel orders

// Advanced market adaptation
c.market_condition_lookback = 100  // Number of periods to look back for market condition detection
c.market_volatility_threshold = 0.02  // Threshold for high volatility detection
c.market_trend_threshold = 0.01  // Threshold for trend detection

// Advanced performance optimization
c.reduce_memory_usage = true  // Enable memory usage optimization
c.max_history_lookback = 500  // Maximum number of periods to keep in memory
c.periodic_gc = true  // Enable periodic garbage collection
c.gc_interval = 300000  // Garbage collection interval in ms

// Advanced logging
c.log_trades_to_file = true  // Log trades to separate file
c.log_signals_to_file = true  // Log signals to separate file
c.log_performance_to_file = true  // Log performance metrics to separate file
```

### Advanced Troubleshooting

#### Debugging Network Issues

```bash
# Check network connectivity
ping -c 5 api.exchange.com

# Check DNS resolution
dig api.exchange.com

# Check for network latency
traceroute api.exchange.com

# Monitor network traffic
sudo tcpdump -i any host api.exchange.com -n
```

#### Debugging Memory Leaks

```bash
# Install heapdump
npm install heapdump

# Add heapdump to your code
const heapdump = require('heapdump');

// Generate heap snapshot
heapdump.writeSnapshot('/path/to/snapshot.heapsnapshot');

# Analyze heap snapshot with Chrome DevTools
```

#### Debugging Performance Issues

```bash
# Install clinic
npm install -g clinic

# Run with clinic doctor
clinic doctor -- node zenbot.js trade --strategy=stddev --paper

# Run with clinic flame
clinic flame -- node zenbot.js trade --strategy=stddev --paper

# Run with clinic bubbleprof
clinic bubbleprof -- node zenbot.js trade --strategy=stddev --paper
```

#### Advanced Log Analysis

```bash
# Create a log analysis script
cat > analyze_logs.sh << 'EOF'
#!/bin/bash

LOG_DIR="/var/log/zenbot"
DATE=$(date +%Y-%m-%d)

# Count errors by type
echo "Error counts by type:"
grep -i "error" $LOG_DIR/error-$DATE.log | awk -F'[' '{print $2}' | awk -F']' '{print $1}' | sort | uniq -c | sort -nr

# Count warnings by type
echo "Warning counts by type:"
grep -i "warning" $LOG_DIR/combined-$DATE.log | awk -F'[' '{print $2}' | awk -F']' '{print $1}' | sort | uniq -c | sort -nr

# Check for API rate limit issues
echo "API rate limit issues:"
grep -i "rate limit" $LOG_DIR/combined-$DATE.log | wc -l

# Check for connection issues
echo "Connection issues:"
grep -i "connection" $LOG_DIR/error-$DATE.log | grep -i "error" | wc -l

# Check for order execution issues
echo "Order execution issues:"
grep -i "order" $LOG_DIR/error-$DATE.log | grep -i "error" | wc -l

# Check for signal processing issues
echo "Signal processing issues:"
grep -i "signal" $LOG_DIR/error-$DATE.log | grep -i "error" | wc -l

# Check for state corruption issues
echo "State corruption issues:"
grep -i "state" $LOG_DIR/error-$DATE.log | grep -i "error" | wc -l

# Check for memory issues
echo "Memory issues:"
grep -i "memory" $LOG_DIR/error-$DATE.log | wc -l

# Check for performance issues
echo "Performance issues:"
grep -i "performance" $LOG_DIR/combined-$DATE.log | grep -i "warning" | wc -l
EOF

# Make the script executable
chmod +x analyze_logs.sh

# Run the log analysis
./analyze_logs.sh
```

## Conclusion

This comprehensive guide provides all the terminal commands and troubleshooting procedures needed to operate, deploy, monitor, and maintain your Zenbot trading system. By following these instructions, you can ensure a robust and reliable trading operation.

Remember to always test changes in a paper trading environment before deploying to live trading, and to maintain regular backups of your configuration and state files.

For additional support, refer to the Zenbot documentation and community resources:

- GitHub repository: https://github.com/DeviaVir/zenbot
- Wiki: https://github.com/DeviaVir/zenbot/wiki
- Issues: https://github.com/DeviaVir/zenbot/issues

Happy trading!
