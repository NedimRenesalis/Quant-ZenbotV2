# Zenbot Trading Strategy ProfitCommandManual - Part 5 of 6

## Deployment and Operations

In Iterations 1-4, we implemented core fixes, enhanced state management, added market adaptation, and hardened the system for production. In this fifth part, we'll focus on deployment and operations to ensure your Zenbot trading strategy runs reliably in a production environment.

### Production Deployment

Let's create a comprehensive deployment script to set up Zenbot in a production environment:

1. Create a deployment script:

```bash
# Create the deployment script
code deploy_production.sh
```

2. Implement the deployment script:

```bash
#!/bin/bash
# Zenbot Production Deployment Script

# Configuration
ZENBOT_DIR="/opt/zenbot"
LOG_DIR="/var/log/zenbot"
STATE_DIR="/var/lib/zenbot/state"
HEALTH_DIR="/var/lib/zenbot/health"
SECURE_DIR="/var/lib/zenbot/secure"
BACKUP_DIR="/var/lib/zenbot/backups"
ZENBOT_USER="zenbot"
ZENBOT_GROUP="zenbot"

# Command line arguments
EXCHANGE=${1:-"binance"}
PAIR=${2:-"BTC-USDT"}
STRATEGY=${3:-"stddev"}
MODE=${4:-"paper"}  # Use "paper" for testing, "live" for real trading

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_message() {
  local color=$1
  local message=$2
  echo -e "${color}${message}${NC}"
}

# Function to check if command succeeded
check_success() {
  if [ $? -eq 0 ]; then
    print_message "$GREEN" "✓ Success"
  else
    print_message "$RED" "✗ Failed"
    exit 1
  fi
}

# Check if running as root
if [ "$(id -u)" != "0" ]; then
  print_message "$RED" "This script must be run as root"
  exit 1
fi

# Create zenbot user if it doesn't exist
print_message "$BLUE" "Creating zenbot user and group..."
if ! id -u $ZENBOT_USER >/dev/null 2>&1; then
  useradd -r -s /bin/false $ZENBOT_USER
  check_success
else
  print_message "$YELLOW" "User $ZENBOT_USER already exists"
fi

# Create directories
print_message "$BLUE" "Creating directories..."
mkdir -p $ZENBOT_DIR
mkdir -p $LOG_DIR
mkdir -p $STATE_DIR
mkdir -p $HEALTH_DIR
mkdir -p $SECURE_DIR
mkdir -p $BACKUP_DIR
check_success

# Set directory permissions
print_message "$BLUE" "Setting directory permissions..."
chown -R $ZENBOT_USER:$ZENBOT_GROUP $ZENBOT_DIR
chown -R $ZENBOT_USER:$ZENBOT_GROUP $LOG_DIR
chown -R $ZENBOT_USER:$ZENBOT_GROUP $STATE_DIR
chown -R $ZENBOT_USER:$ZENBOT_GROUP $HEALTH_DIR
chown -R $ZENBOT_USER:$ZENBOT_GROUP $SECURE_DIR
chown -R $ZENBOT_USER:$ZENBOT_GROUP $BACKUP_DIR
chmod -R 750 $ZENBOT_DIR
chmod -R 750 $LOG_DIR
chmod -R 750 $STATE_DIR
chmod -R 750 $HEALTH_DIR
chmod -R 750 $SECURE_DIR
chmod -R 750 $BACKUP_DIR
check_success

# Clone or update Zenbot repository
if [ -d "$ZENBOT_DIR/.git" ]; then
  print_message "$BLUE" "Updating existing Zenbot installation..."
  cd $ZENBOT_DIR
  git fetch --all
  git reset --hard origin/master
  check_success
else
  print_message "$BLUE" "Cloning Zenbot repository..."
  git clone https://github.com/DeviaVir/zenbot.git $ZENBOT_DIR
  check_success
fi

# Install dependencies
print_message "$BLUE" "Installing dependencies..."
cd $ZENBOT_DIR
npm install
check_success

# Copy configuration files
print_message "$BLUE" "Setting up configuration..."
if [ ! -f "$ZENBOT_DIR/conf.js" ]; then
  cp $ZENBOT_DIR/conf-sample.js $ZENBOT_DIR/conf.js
  check_success
else
  print_message "$YELLOW" "Configuration file already exists, not overwriting"
fi

# Create environment file
print_message "$BLUE" "Creating environment file..."
cat > $ZENBOT_DIR/.env << EOF
ZENBOT_EXCHANGE=$EXCHANGE
ZENBOT_SELECTOR=$PAIR
ZENBOT_STRATEGY=$STRATEGY
ZENBOT_MODE=$MODE
ZENBOT_SELL_STOP_PCT=0.1
ZENBOT_PROFIT_STOP_ENABLE_PCT=5
ZENBOT_PROFIT_STOP_PCT=1
ZENBOT_ENABLE_MARKET_ADAPTATION=true
ZENBOT_MARKET_ADAPTATION_STRENGTH=1.0
ZENBOT_SAVE_STATE=true
ZENBOT_STATE_DIR=$STATE_DIR
ZENBOT_LOG_LEVEL=info
ZENBOT_LOG_DIR=$LOG_DIR
ZENBOT_ENABLE_HEALTH_CHECK=true
ZENBOT_HEALTH_DIR=$HEALTH_DIR
ZENBOT_AUTO_RECOVER=true
ZENBOT_ENABLE_SECURITY=true
ZENBOT_SECURE_DIR=$SECURE_DIR
ZENBOT_ENABLE_BACKUP=true
ZENBOT_BACKUP_DIR=$BACKUP_DIR
EOF
check_success

# Set environment file permissions
chmod 600 $ZENBOT_DIR/.env
chown $ZENBOT_USER:$ZENBOT_GROUP $ZENBOT_DIR/.env

# Create systemd service file
print_message "$BLUE" "Creating systemd service..."
cat > /etc/systemd/system/zenbot.service << EOF
[Unit]
Description=Zenbot Cryptocurrency Trading Bot
After=network.target

[Service]
Type=simple
User=$ZENBOT_USER
Group=$ZENBOT_GROUP
WorkingDirectory=$ZENBOT_DIR
EnvironmentFile=$ZENBOT_DIR/.env
ExecStart=/usr/bin/node $ZENBOT_DIR/zenbot.js trade --strategy=\${ZENBOT_STRATEGY} --selector=\${ZENBOT_SELECTOR} --exchange=\${ZENBOT_EXCHANGE} --mode=\${ZENBOT_MODE} --sell_stop_pct=\${ZENBOT_SELL_STOP_PCT} --profit_stop_enable_pct=\${ZENBOT_PROFIT_STOP_ENABLE_PCT} --profit_stop_pct=\${ZENBOT_PROFIT_STOP_PCT} --enable_market_adaptation=\${ZENBOT_ENABLE_MARKET_ADAPTATION} --market_adaptation_strength=\${ZENBOT_MARKET_ADAPTATION_STRENGTH} --save_state=\${ZENBOT_SAVE_STATE} --state_dir=\${ZENBOT_STATE_DIR} --log_level=\${ZENBOT_LOG_LEVEL} --log_dir=\${ZENBOT_LOG_DIR} --enable_health_check=\${ZENBOT_ENABLE_HEALTH_CHECK} --health_dir=\${ZENBOT_HEALTH_DIR} --auto_recover=\${ZENBOT_AUTO_RECOVER} --enable_security=\${ZENBOT_ENABLE_SECURITY} --secure_dir=\${ZENBOT_SECURE_DIR} --enable_backup=\${ZENBOT_ENABLE_BACKUP} --backup_dir=\${ZENBOT_BACKUP_DIR}
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=zenbot
# Increase memory limit if needed
# LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF
check_success

# Reload systemd
print_message "$BLUE" "Reloading systemd..."
systemctl daemon-reload
check_success

# Enable service to start on boot
print_message "$BLUE" "Enabling service to start on boot..."
systemctl enable zenbot.service
check_success

# Create log rotation configuration
print_message "$BLUE" "Setting up log rotation..."
cat > /etc/logrotate.d/zenbot << EOF
$LOG_DIR/*.log {
  daily
  missingok
  rotate 14
  compress
  delaycompress
  notifempty
  create 0640 $ZENBOT_USER $ZENBOT_GROUP
  sharedscripts
  postrotate
    systemctl reload zenbot.service >/dev/null 2>&1 || true
  endscript
}
EOF
check_success

# Create monitoring script
print_message "$BLUE" "Creating monitoring script..."
cat > $ZENBOT_DIR/monitor_zenbot.sh << 'EOF'
#!/bin/bash

# Configuration
HEALTH_DIR="/var/lib/zenbot/health"
LOG_DIR="/var/log/zenbot"
ALERT_EMAIL="your-email@example.com"
HOSTNAME=$(hostname)

# Check if health files exist
if [ ! -d "$HEALTH_DIR" ]; then
  echo "Health directory not found: $HEALTH_DIR"
  exit 1
fi

# Find the most recent health file
HEALTH_FILE=$(find $HEALTH_DIR -name "*_health.json" -type f -printf "%T@ %p\n" | sort -n | tail -1 | cut -d' ' -f2-)

if [ -z "$HEALTH_FILE" ]; then
  echo "No health files found in $HEALTH_DIR"
  
  # Check if service is running
  if ! systemctl is-active --quiet zenbot.service; then
    echo "Zenbot service is not running!"
    echo "Zenbot service is not running on $HOSTNAME!" | mail -s "ALERT: Zenbot Down on $HOSTNAME" $ALERT_EMAIL
    exit 1
  fi
  
  exit 1
fi

# Get the status from the health file
STATUS=$(grep -o '"status":"[^"]*"' $HEALTH_FILE | cut -d'"' -f4)
TIMESTAMP=$(grep -o '"timestamp":[0-9]*' $HEALTH_FILE | cut -d':' -f2)
CURRENT_TIME=$(date +%s000)
TIME_DIFF=$((($CURRENT_TIME - $TIMESTAMP) / 1000))

# Check if health check is stale (more than 5 minutes old)
if [ $TIME_DIFF -gt 300 ]; then
  echo "Health check is stale (${TIME_DIFF}s old)"
  
  # Check if service is running
  if ! systemctl is-active --quiet zenbot.service; then
    echo "Zenbot service is not running!"
    echo "Zenbot service is not running on $HOSTNAME!" | mail -s "ALERT: Zenbot Down on $HOSTNAME" $ALERT_EMAIL
    exit 1
  fi
  
  echo "Zenbot health check is stale on $HOSTNAME (${TIME_DIFF}s old)" | mail -s "ALERT: Zenbot Health Check Stale on $HOSTNAME" $ALERT_EMAIL
  exit 1
fi

# Check status
if [ "$STATUS" != "healthy" ]; then
  echo "Zenbot status: $STATUS"
  
  # Get error details
  ERRORS=$(grep -o '"errors":\[.*\]' $HEALTH_FILE | sed 's/"errors":\[\(.*\)\]/\1/')
  
  # Send alert
  echo "Zenbot status is $STATUS on $HOSTNAME" | mail -s "ALERT: Zenbot Status $STATUS on $HOSTNAME" $ALERT_EMAIL
  
  # Check if service needs to be restarted
  if [ "$STATUS" = "error" ]; then
    # Check for critical errors that require restart
    if echo "$ERRORS" | grep -q "signal_processing\|state_corruption"; then
      echo "Critical error detected, restarting service..."
      systemctl restart zenbot.service
    fi
  fi
  
  exit 1
fi

# Check for recent trades
RECENT_TRADES=$(find $LOG_DIR -name "trades-*.log" -type f -mtime -1 | xargs grep -l "TRADE" 2>/dev/null)

if [ -z "$RECENT_TRADES" ]; then
  echo "No recent trades found in the last 24 hours"
  echo "No recent trades found on $HOSTNAME in the last 24 hours" | mail -s "WARNING: No Recent Zenbot Trades on $HOSTNAME" $ALERT_EMAIL
fi

echo "Zenbot status: $STATUS (${TIME_DIFF}s ago)"
exit 0
EOF
check_success

# Make monitoring script executable
chmod +x $ZENBOT_DIR/monitor_zenbot.sh
chown $ZENBOT_USER:$ZENBOT_GROUP $ZENBOT_DIR/monitor_zenbot.sh

# Set up cron job for monitoring
print_message "$BLUE" "Setting up cron job for monitoring..."
(crontab -l 2>/dev/null; echo "*/5 * * * * $ZENBOT_DIR/monitor_zenbot.sh >> $LOG_DIR/monitoring.log 2>&1") | crontab -
check_success

# Create backup script
print_message "$BLUE" "Creating backup script..."
cat > $ZENBOT_DIR/backup_zenbot.sh << 'EOF'
#!/bin/bash

# Configuration
ZENBOT_DIR="/opt/zenbot"
BACKUP_DIR="/var/lib/zenbot/backups"
CONFIG_BACKUP_DIR="$BACKUP_DIR/configs"
STATE_BACKUP_DIR="$BACKUP_DIR/state"
LOG_BACKUP_DIR="$BACKUP_DIR/logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup directories if they don't exist
mkdir -p $CONFIG_BACKUP_DIR
mkdir -p $STATE_BACKUP_DIR
mkdir -p $LOG_BACKUP_DIR

# Backup configuration files
echo "Backing up configuration files..."
cp $ZENBOT_DIR/conf.js $CONFIG_BACKUP_DIR/conf_$TIMESTAMP.js
cp $ZENBOT_DIR/.env $CONFIG_BACKUP_DIR/env_$TIMESTAMP
cp $ZENBOT_DIR/extensions/strategies/stddev/strategy.js $CONFIG_BACKUP_DIR/strategy_$TIMESTAMP.js
cp $ZENBOT_DIR/lib/engine.js $CONFIG_BACKUP_DIR/engine_$TIMESTAMP.js
cp $ZENBOT_DIR/commands/trade.js $CONFIG_BACKUP_DIR/trade_$TIMESTAMP.js

# Backup state files
echo "Backing up state files..."
tar -czf $STATE_BACKUP_DIR/state_$TIMESTAMP.tar.gz -C /var/lib/zenbot state/

# Backup log files
echo "Backing up log files..."
tar -czf $LOG_BACKUP_DIR/logs_$TIMESTAMP.tar.gz -C /var/log/zenbot .

# Backup entire installation
echo "Backing up entire installation..."
tar -czf $BACKUP_DIR/zenbot_full_$TIMESTAMP.tar.gz -C /opt zenbot

# Keep only the last 7 full backups
echo "Cleaning up old backups..."
ls -t $BACKUP_DIR/zenbot_full_*.tar.gz | tail -n +8 | xargs -r rm

# Keep only the last 30 config backups
ls -t $CONFIG_BACKUP_DIR/conf_*.js | tail -n +31 | xargs -r rm
ls -t $CONFIG_BACKUP_DIR/env_* | tail -n +31 | xargs -r rm
ls -t $CONFIG_BACKUP_DIR/strategy_*.js | tail -n +31 | xargs -r rm
ls -t $CONFIG_BACKUP_DIR/engine_*.js | tail -n +31 | xargs -r rm
ls -t $CONFIG_BACKUP_DIR/trade_*.js | tail -n +31 | xargs -r rm

# Keep only the last 14 state backups
ls -t $STATE_BACKUP_DIR/state_*.tar.gz | tail -n +15 | xargs -r rm

# Keep only the last 7 log backups
ls -t $LOG_BACKUP_DIR/logs_*.tar.gz | tail -n +8 | xargs -r rm

echo "Backup completed successfully!"
echo "Backup files are stored in $BACKUP_DIR"
EOF
check_success

# Make backup script executable
chmod +x $ZENBOT_DIR/backup_zenbot.sh
chown $ZENBOT_USER:$ZENBOT_GROUP $ZENBOT_DIR/backup_zenbot.sh

# Set up cron job for backup
print_message "$BLUE" "Setting up cron job for backup..."
(crontab -l 2>/dev/null; echo "0 0 * * * $ZENBOT_DIR/backup_zenbot.sh >> $LOG_DIR/backup.log 2>&1") | crontab -
check_success

# Create restore script
print_message "$BLUE" "Creating restore script..."
cat > $ZENBOT_DIR/restore_zenbot.sh << 'EOF'
#!/bin/bash

# Configuration
ZENBOT_DIR="/opt/zenbot"
BACKUP_DIR="/var/lib/zenbot/backups"
STATE_DIR="/var/lib/zenbot/state"
LOG_DIR="/var/log/zenbot"
ZENBOT_USER="zenbot"
ZENBOT_GROUP="zenbot"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_message() {
  local color=$1
  local message=$2
  echo -e "${color}${message}${NC}"
}

# Check if running as root
if [ "$(id -u)" != "0" ]; then
  print_message "$RED" "This script must be run as root"
  exit 1
fi

# Check if backup file is provided
if [ -z "$1" ]; then
  print_message "$RED" "Usage: $0 <backup_file>"
  print_message "$YELLOW" "Available backups:"
  ls -la $BACKUP_DIR/zenbot_full_*.tar.gz
  exit 1
fi

BACKUP_FILE=$1

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
  print_message "$RED" "Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Stop Zenbot service
print_message "$BLUE" "Stopping Zenbot service..."
systemctl stop zenbot.service
print_message "$GREEN" "✓ Success"

# Backup current installation
print_message "$BLUE" "Backing up current installation..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
tar -czf $BACKUP_DIR/zenbot_pre_restore_$TIMESTAMP.tar.gz -C /opt zenbot
print_message "$GREEN" "✓ Success"

# Restore from backup
print_message "$BLUE" "Restoring from backup: $BACKUP_FILE"
rm -rf $ZENBOT_DIR/*
tar -xzf $BACKUP_FILE -C /opt
print_message "$GREEN" "✓ Success"

# Set permissions
print_message "$BLUE" "Setting permissions..."
chown -R $ZENBOT_USER:$ZENBOT_GROUP $ZENBOT_DIR
chmod -R 750 $ZENBOT_DIR
print_message "$GREEN" "✓ Success"

# Start Zenbot service
print_message "$BLUE" "Starting Zenbot service..."
systemctl start zenbot.service
print_message "$GREEN" "✓ Success"

print_message "$GREEN" "Restore completed successfully!"
EOF
check_success

# Make restore script executable
chmod +x $ZENBOT_DIR/restore_zenbot.sh
chown $ZENBOT_USER:$ZENBOT_GROUP $ZENBOT_DIR/restore_zenbot.sh

# Create rollback state script
print_message "$BLUE" "Creating rollback state script..."
cat > $ZENBOT_DIR/rollback_state.sh << 'EOF'
#!/bin/bash

# Configuration
STATE_DIR="/var/lib/zenbot/state"
BACKUP_DIR="/var/lib/zenbot/backups/state"
ZENBOT_USER="zenbot"
ZENBOT_GROUP="zenbot"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_message() {
  local color=$1
  local message=$2
  echo -e "${color}${message}${NC}"
}

# Check if running as root
if [ "$(id -u)" != "0" ]; then
  print_message "$RED" "This script must be run as root"
  exit 1
fi

# List available state backups
if [ -z "$1" ]; then
  print_message "$YELLOW" "Usage: $0 <state_backup_file>"
  print_message "$YELLOW" "Available state backups:"
  ls -la $BACKUP_DIR/state_*.tar.gz
  exit 1
fi

STATE_BACKUP=$1

# Check if state backup exists
if [ ! -f "$STATE_BACKUP" ]; then
  print_message "$RED" "State backup file not found: $STATE_BACKUP"
  exit 1
fi

# Stop Zenbot service
print_message "$BLUE" "Stopping Zenbot service..."
systemctl stop zenbot.service
print_message "$GREEN" "✓ Success"

# Backup current state
print_message "$BLUE" "Backing up current state..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
tar -czf $BACKUP_DIR/state_pre_rollback_$TIMESTAMP.tar.gz -C /var/lib/zenbot state/
print_message "$GREEN" "✓ Success"

# Restore state from backup
print_message "$BLUE" "Restoring state from backup: $STATE_BACKUP"
rm -rf $STATE_DIR/*
mkdir -p $STATE_DIR
tar -xzf $STATE_BACKUP -C /var/lib/zenbot
print_message "$GREEN" "✓ Success"

# Set permissions
print_message "$BLUE" "Setting permissions..."
chown -R $ZENBOT_USER:$ZENBOT_GROUP $STATE_DIR
chmod -R 750 $STATE_DIR
print_message "$GREEN" "✓ Success"

# Start Zenbot service
print_message "$BLUE" "Starting Zenbot service..."
systemctl start zenbot.service
print_message "$GREEN" "✓ Success"

print_message "$GREEN" "State rollback completed successfully!"
EOF
check_success

# Make rollback state script executable
chmod +x $ZENBOT_DIR/rollback_state.sh
chown $ZENBOT_USER:$ZENBOT_GROUP $ZENBOT_DIR/rollback_state.sh

# Final message
print_message "$GREEN" "Zenbot deployment completed successfully!"
print_message "$YELLOW" "To start Zenbot, run: systemctl start zenbot.service"
print_message "$YELLOW" "To check status, run: systemctl status zenbot.service"
print_message "$YELLOW" "To view logs, run: journalctl -u zenbot.service -f"
print_message "$YELLOW" "To monitor health, run: $ZENBOT_DIR/monitor_zenbot.sh"
print_message "$YELLOW" "To backup, run: $ZENBOT_DIR/backup_zenbot.sh"
print_message "$YELLOW" "To restore, run: $ZENBOT_DIR/restore_zenbot.sh <backup_file>"
print_message "$YELLOW" "To rollback state, run: $ZENBOT_DIR/rollback_state.sh <state_backup_file>"
```

3. Make the deployment script executable:

```bash
chmod +x deploy_production.sh
```

### Monitoring Script

Let's create a comprehensive monitoring script to monitor the health of your Zenbot trading system:

1. Create a monitoring script:

```bash
# Create the monitoring script
code monitor_zenbot.sh
```

2. Implement the monitoring script:

```bash
#!/bin/bash
# Zenbot Monitoring Script

# Configuration
HEALTH_DIR="/var/lib/zenbot/health"
LOG_DIR="/var/log/zenbot"
STATE_DIR="/var/lib/zenbot/state"
ALERT_EMAIL="your-email@example.com"
HOSTNAME=$(hostname)
SLACK_WEBHOOK_URL=""  # Set this to your Slack webhook URL if you want Slack notifications

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_message() {
  local color=$1
  local message=$2
  echo -e "${color}${message}${NC}"
}

# Function to send email alert
send_email_alert() {
  local subject=$1
  local message=$2
  
  if [ -n "$ALERT_EMAIL" ]; then
    echo "$message" | mail -s "$subject" $ALERT_EMAIL
  fi
}

# Function to send Slack alert
send_slack_alert() {
  local message=$1
  local color=$2  # good (green), warning (yellow), danger (red)
  
  if [ -n "$SLACK_WEBHOOK_URL" ]; then
    curl -s -X POST -H 'Content-type: application/json' \
      --data "{\"attachments\":[{\"color\":\"$color\",\"title\":\"Zenbot Alert on $HOSTNAME\",\"text\":\"$message\"}]}" \
      $SLACK_WEBHOOK_URL > /dev/null
  fi
}

# Check if health directory exists
if [ ! -d "$HEALTH_DIR" ]; then
  print_message "$RED" "Health directory not found: $HEALTH_DIR"
  send_email_alert "ALERT: Zenbot Health Directory Missing on $HOSTNAME" "Health directory not found: $HEALTH_DIR"
  send_slack_alert "Health directory not found: $HEALTH_DIR" "danger"
  exit 1
fi

# Find the most recent health file
HEALTH_FILE=$(find $HEALTH_DIR -name "*_health.json" -type f -printf "%T@ %p\n" | sort -n | tail -1 | cut -d' ' -f2-)

if [ -z "$HEALTH_FILE" ]; then
  print_message "$RED" "No health files found in $HEALTH_DIR"
  
  # Check if service is running
  if ! systemctl is-active --quiet zenbot.service; then
    print_message "$RED" "Zenbot service is not running!"
    send_email_alert "ALERT: Zenbot Down on $HOSTNAME" "Zenbot service is not running on $HOSTNAME!"
    send_slack_alert "Zenbot service is not running!" "danger"
    exit 1
  fi
  
  send_email_alert "ALERT: No Zenbot Health Files on $HOSTNAME" "No health files found in $HEALTH_DIR"
  send_slack_alert "No health files found in $HEALTH_DIR" "danger"
  exit 1
fi

# Get the status from the health file
STATUS=$(grep -o '"status":"[^"]*"' $HEALTH_FILE | cut -d'"' -f4)
TIMESTAMP=$(grep -o '"timestamp":[0-9]*' $HEALTH_FILE | cut -d':' -f2)
CURRENT_TIME=$(date +%s000)
TIME_DIFF=$((($CURRENT_TIME - $TIMESTAMP) / 1000))

# Check if health check is stale (more than 5 minutes old)
if [ $TIME_DIFF -gt 300 ]; then
  print_message "$YELLOW" "Health check is stale (${TIME_DIFF}s old)"
  
  # Check if service is running
  if ! systemctl is-active --quiet zenbot.service; then
    print_message "$RED" "Zenbot service is not running!"
    send_email_alert "ALERT: Zenbot Down on $HOSTNAME" "Zenbot service is not running on $HOSTNAME!"
    send_slack_alert "Zenbot service is not running!" "danger"
    exit 1
  fi
  
  send_email_alert "ALERT: Zenbot Health Check Stale on $HOSTNAME" "Zenbot health check is stale on $HOSTNAME (${TIME_DIFF}s old)"
  send_slack_alert "Health check is stale (${TIME_DIFF}s old)" "warning"
  exit 1
fi

# Check status
if [ "$STATUS" != "healthy" ]; then
  print_message "$YELLOW" "Zenbot status: $STATUS"
  
  # Get error details
  ERRORS=$(grep -o '"errors":\[.*\]' $HEALTH_FILE | sed 's/"errors":\[\(.*\)\]/\1/')
  
  # Send alert
  send_email_alert "ALERT: Zenbot Status $STATUS on $HOSTNAME" "Zenbot status is $STATUS on $HOSTNAME\n\nErrors: $ERRORS"
  send_slack_alert "Status: $STATUS\nErrors: $ERRORS" "danger"
  
  # Check if service needs to be restarted
  if [ "$STATUS" = "error" ]; then
    # Check for critical errors that require restart
    if echo "$ERRORS" | grep -q "signal_processing\|state_corruption"; then
      print_message "$RED" "Critical error detected, restarting service..."
      systemctl restart zenbot.service
      send_email_alert "ALERT: Zenbot Restarted on $HOSTNAME" "Zenbot was automatically restarted due to critical errors"
      send_slack_alert "Zenbot was automatically restarted due to critical errors" "danger"
    fi
  fi
  
  exit 1
fi

# Check for recent trades
RECENT_TRADES=$(find $LOG_DIR -name "trades-*.log" -type f -mtime -1 | xargs grep -l "TRADE" 2>/dev/null)

if [ -z "$RECENT_TRADES" ]; then
  print_message "$YELLOW" "No recent trades found in the last 24 hours"
  send_email_alert "WARNING: No Recent Zenbot Trades on $HOSTNAME" "No recent trades found on $HOSTNAME in the last 24 hours"
  send_slack_alert "No recent trades found in the last 24 hours" "warning"
fi

# Check system resources
CPU_LOAD=$(uptime | awk -F'[a-z]:' '{ print $2}' | awk -F',' '{ print $1}' | tr -d ' ')
MEMORY_USED=$(free -m | awk 'NR==2{printf "%.1f%%", $3*100/$2 }')
DISK_USED=$(df -h / | awk 'NR==2{print $5}')

print_message "$GREEN" "Zenbot status: $STATUS (${TIME_DIFF}s ago)"
print_message "$BLUE" "System resources:"
print_message "$BLUE" "  CPU load: $CPU_LOAD"
print_message "$BLUE" "  Memory used: $MEMORY_USED"
print_message "$BLUE" "  Disk used: $DISK_USED"

# Check for high resource usage
if (( $(echo "$CPU_LOAD > 2.0" | bc -l) )); then
  print_message "$YELLOW" "High CPU load detected: $CPU_LOAD"
  send_email_alert "WARNING: High CPU Load on $HOSTNAME" "High CPU load detected on $HOSTNAME: $CPU_LOAD"
  send_slack_alert "High CPU load detected: $CPU_LOAD" "warning"
fi

if (( $(echo "$MEMORY_USED > 90.0" | bc -l) )); then
  print_message "$YELLOW" "High memory usage detected: $MEMORY_USED"
  send_email_alert "WARNING: High Memory Usage on $HOSTNAME" "High memory usage detected on $HOSTNAME: $MEMORY_USED"
  send_slack_alert "High memory usage detected: $MEMORY_USED" "warning"
fi

if (( $(echo "${DISK_USED%\%} > 90.0" | bc -l) )); then
  print_message "$YELLOW" "High disk usage detected: $DISK_USED"
  send_email_alert "WARNING: High Disk Usage on $HOSTNAME" "High disk usage detected on $HOSTNAME: $DISK_USED"
  send_slack_alert "High disk usage detected: $DISK_USED" "warning"
fi

# Check state files
STATE_FILES=$(find $STATE_DIR -type f -name "*.json" | wc -l)
if [ "$STATE_FILES" -eq 0 ]; then
  print_message "$YELLOW" "No state files found in $STATE_DIR"
  send_email_alert "WARNING: No Zenbot State Files on $HOSTNAME" "No state files found in $STATE_DIR on $HOSTNAME"
  send_slack_alert "No state files found in $STATE_DIR" "warning"
fi

# Check for errors in logs
RECENT_ERRORS=$(find $LOG_DIR -name "error-*.log" -type f -mtime -1 | xargs grep -l "ERROR" 2>/dev/null)
if [ -n "$RECENT_ERRORS" ]; then
  ERROR_COUNT=$(find $LOG_DIR -name "error-*.log" -type f -mtime -1 | xargs grep "ERROR" 2>/dev/null | wc -l)
  print_message "$YELLOW" "Found $ERROR_COUNT errors in logs in the last 24 hours"
  
  if [ "$ERROR_COUNT" -gt 10 ]; then
    send_email_alert "WARNING: Multiple Zenbot Errors on $HOSTNAME" "Found $ERROR_COUNT errors in logs in the last 24 hours on $HOSTNAME"
    send_slack_alert "Found $ERROR_COUNT errors in logs in the last 24 hours" "warning"
  fi
fi

# All checks passed
print_message "$GREEN" "All monitoring checks passed"
exit 0
```

3. Make the monitoring script executable:

```bash
chmod +x monitor_zenbot.sh
```

### Cron Job Setup

Let's set up cron jobs to automate monitoring and maintenance tasks:

1. Create a cron job setup script:

```bash
# Create the cron job setup script
code setup_cron_jobs.sh
```

2. Implement the cron job setup script:

```bash
#!/bin/bash
# Zenbot Cron Job Setup Script

# Configuration
ZENBOT_DIR="/opt/zenbot"
LOG_DIR="/var/log/zenbot"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_message() {
  local color=$1
  local message=$2
  echo -e "${color}${message}${NC}"
}

# Check if running as root
if [ "$(id -u)" != "0" ]; then
  print_message "$RED" "This script must be run as root"
  exit 1
fi

# Create cron job for monitoring
print_message "$BLUE" "Setting up monitoring cron job..."
cat > /etc/cron.d/zenbot-monitor << EOF
# Zenbot monitoring cron job
# Run every 5 minutes
*/5 * * * * root $ZENBOT_DIR/monitor_zenbot.sh >> $LOG_DIR/monitoring.log 2>&1
EOF
print_message "$GREEN" "✓ Success"

# Create cron job for backup
print_message "$BLUE" "Setting up backup cron job..."
cat > /etc/cron.d/zenbot-backup << EOF
# Zenbot backup cron job
# Run daily at midnight
0 0 * * * root $ZENBOT_DIR/backup_zenbot.sh >> $LOG_DIR/backup.log 2>&1
EOF
print_message "$GREEN" "✓ Success"

# Create cron job for log rotation
print_message "$BLUE" "Setting up log rotation cron job..."
cat > /etc/cron.d/zenbot-logrotate << EOF
# Zenbot log rotation cron job
# Run daily at 1 AM
0 1 * * * root /usr/sbin/logrotate /etc/logrotate.d/zenbot
EOF
print_message "$GREEN" "✓ Success"

# Create cron job for health check
print_message "$BLUE" "Setting up health check cron job..."
cat > /etc/cron.d/zenbot-health << EOF
# Zenbot health check cron job
# Run every 15 minutes
*/15 * * * * root systemctl is-active --quiet zenbot.service || systemctl restart zenbot.service >> $LOG_DIR/health.log 2>&1
EOF
print_message "$GREEN" "✓ Success"

# Set permissions
print_message "$BLUE" "Setting permissions..."
chmod 644 /etc/cron.d/zenbot-*
print_message "$GREEN" "✓ Success"

# Restart cron service
print_message "$BLUE" "Restarting cron service..."
systemctl restart cron
print_message "$GREEN" "✓ Success"

print_message "$GREEN" "Cron jobs setup completed successfully!"
```

3. Make the cron job setup script executable:

```bash
chmod +x setup_cron_jobs.sh
```

### Service Configuration

Let's create a systemd service configuration for Zenbot:

1. Create a service configuration script:

```bash
# Create the service configuration script
code setup_service.sh
```

2. Implement the service configuration script:

```bash
#!/bin/bash
# Zenbot Service Configuration Script

# Configuration
ZENBOT_DIR="/opt/zenbot"
ZENBOT_USER="zenbot"
ZENBOT_GROUP="zenbot"
EXCHANGE=${1:-"binance"}
PAIR=${2:-"BTC-USDT"}
STRATEGY=${3:-"stddev"}
MODE=${4:-"paper"}  # Use "paper" for testing, "live" for real trading

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_message() {
  local color=$1
  local message=$2
  echo -e "${color}${message}${NC}"
}

# Check if running as root
if [ "$(id -u)" != "0" ]; then
  print_message "$RED" "This script must be run as root"
  exit 1
fi

# Create systemd service file
print_message "$BLUE" "Creating systemd service..."
cat > /etc/systemd/system/zenbot.service << EOF
[Unit]
Description=Zenbot Cryptocurrency Trading Bot
After=network.target

[Service]
Type=simple
User=$ZENBOT_USER
Group=$ZENBOT_GROUP
WorkingDirectory=$ZENBOT_DIR
EnvironmentFile=$ZENBOT_DIR/.env
ExecStart=/usr/bin/node $ZENBOT_DIR/zenbot.js trade --strategy=\${ZENBOT_STRATEGY} --selector=\${ZENBOT_SELECTOR} --exchange=\${ZENBOT_EXCHANGE} --mode=\${ZENBOT_MODE} --sell_stop_pct=\${ZENBOT_SELL_STOP_PCT} --profit_stop_enable_pct=\${ZENBOT_PROFIT_STOP_ENABLE_PCT} --profit_stop_pct=\${ZENBOT_PROFIT_STOP_PCT} --enable_market_adaptation=\${ZENBOT_ENABLE_MARKET_ADAPTATION} --market_adaptation_strength=\${ZENBOT_MARKET_ADAPTATION_STRENGTH} --save_state=\${ZENBOT_SAVE_STATE} --state_dir=\${ZENBOT_STATE_DIR} --log_level=\${ZENBOT_LOG_LEVEL} --log_dir=\${ZENBOT_LOG_DIR} --enable_health_check=\${ZENBOT_ENABLE_HEALTH_CHECK} --health_dir=\${ZENBOT_HEALTH_DIR} --auto_recover=\${ZENBOT_AUTO_RECOVER} --enable_security=\${ZENBOT_ENABLE_SECURITY} --secure_dir=\${ZENBOT_SECURE_DIR} --enable_backup=\${ZENBOT_ENABLE_BACKUP} --backup_dir=\${ZENBOT_BACKUP_DIR}
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=zenbot
# Increase memory limit if needed
# LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF
print_message "$GREEN" "✓ Success"

# Create environment file
print_message "$BLUE" "Creating environment file..."
cat > $ZENBOT_DIR/.env << EOF
ZENBOT_EXCHANGE=$EXCHANGE
ZENBOT_SELECTOR=$PAIR
ZENBOT_STRATEGY=$STRATEGY
ZENBOT_MODE=$MODE
ZENBOT_SELL_STOP_PCT=0.1
ZENBOT_PROFIT_STOP_ENABLE_PCT=5
ZENBOT_PROFIT_STOP_PCT=1
ZENBOT_ENABLE_MARKET_ADAPTATION=true
ZENBOT_MARKET_ADAPTATION_STRENGTH=1.0
ZENBOT_SAVE_STATE=true
ZENBOT_STATE_DIR=/var/lib/zenbot/state
ZENBOT_LOG_LEVEL=info
ZENBOT_LOG_DIR=/var/log/zenbot
ZENBOT_ENABLE_HEALTH_CHECK=true
ZENBOT_HEALTH_DIR=/var/lib/zenbot/health
ZENBOT_AUTO_RECOVER=true
ZENBOT_ENABLE_SECURITY=true
ZENBOT_SECURE_DIR=/var/lib/zenbot/secure
ZENBOT_ENABLE_BACKUP=true
ZENBOT_BACKUP_DIR=/var/lib/zenbot/backups
EOF
print_message "$GREEN" "✓ Success"

# Set environment file permissions
chmod 600 $ZENBOT_DIR/.env
chown $ZENBOT_USER:$ZENBOT_GROUP $ZENBOT_DIR/.env

# Reload systemd
print_message "$BLUE" "Reloading systemd..."
systemctl daemon-reload
print_message "$GREEN" "✓ Success"

# Enable service to start on boot
print_message "$BLUE" "Enabling service to start on boot..."
systemctl enable zenbot.service
print_message "$GREEN" "✓ Success"

print_message "$GREEN" "Service configuration completed successfully!"
print_message "$YELLOW" "To start Zenbot, run: systemctl start zenbot.service"
print_message "$YELLOW" "To check status, run: systemctl status zenbot.service"
print_message "$YELLOW" "To view logs, run: journalctl -u zenbot.service -f"
```

3. Make the service configuration script executable:

```bash
chmod +x setup_service.sh
```

### Log Rotation

Let's set up log rotation to manage log files:

1. Create a log rotation configuration script:

```bash
# Create the log rotation configuration script
code setup_logrotate.sh
```

2. Implement the log rotation configuration script:

```bash
#!/bin/bash
# Zenbot Log Rotation Configuration Script

# Configuration
LOG_DIR="/var/log/zenbot"
ZENBOT_USER="zenbot"
ZENBOT_GROUP="zenbot"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_message() {
  local color=$1
  local message=$2
  echo -e "${color}${message}${NC}"
}

# Check if running as root
if [ "$(id -u)" != "0" ]; then
  print_message "$RED" "This script must be run as root"
  exit 1
fi

# Create log rotation configuration
print_message "$BLUE" "Creating log rotation configuration..."
cat > /etc/logrotate.d/zenbot << EOF
$LOG_DIR/*.log {
  daily
  missingok
  rotate 14
  compress
  delaycompress
  notifempty
  create 0640 $ZENBOT_USER $ZENBOT_GROUP
  sharedscripts
  postrotate
    systemctl reload zenbot.service >/dev/null 2>&1 || true
  endscript
}
EOF
print_message "$GREEN" "✓ Success"

# Test log rotation configuration
print_message "$BLUE" "Testing log rotation configuration..."
logrotate -d /etc/logrotate.d/zenbot
print_message "$GREEN" "✓ Success"

print_message "$GREEN" "Log rotation configuration completed successfully!"
```

3. Make the log rotation configuration script executable:

```bash
chmod +x setup_logrotate.sh
```

### Backup Procedures

Let's create a comprehensive backup script:

1. Create a backup script:

```bash
# Create the backup script
code backup_zenbot.sh
```

2. Implement the backup script:

```bash
#!/bin/bash
# Zenbot Backup Script

# Configuration
ZENBOT_DIR="/opt/zenbot"
BACKUP_DIR="/var/lib/zenbot/backups"
CONFIG_BACKUP_DIR="$BACKUP_DIR/configs"
STATE_BACKUP_DIR="$BACKUP_DIR/state"
LOG_BACKUP_DIR="$BACKUP_DIR/logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REMOTE_BACKUP_SERVER=""  # Set this to your remote backup server if available
REMOTE_BACKUP_USER=""    # Set this to your remote backup user if available
REMOTE_BACKUP_DIR=""     # Set this to your remote backup directory if available

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_message() {
  local color=$1
  local message=$2
  echo -e "${color}${message}${NC}"
}

# Create backup directories if they don't exist
print_message "$BLUE" "Creating backup directories..."
mkdir -p $CONFIG_BACKUP_DIR
mkdir -p $STATE_BACKUP_DIR
mkdir -p $LOG_BACKUP_DIR
print_message "$GREEN" "✓ Success"

# Backup configuration files
print_message "$BLUE" "Backing up configuration files..."
cp $ZENBOT_DIR/conf.js $CONFIG_BACKUP_DIR/conf_$TIMESTAMP.js
cp $ZENBOT_DIR/.env $CONFIG_BACKUP_DIR/env_$TIMESTAMP
cp $ZENBOT_DIR/extensions/strategies/stddev/strategy.js $CONFIG_BACKUP_DIR/strategy_$TIMESTAMP.js
cp $ZENBOT_DIR/lib/engine.js $CONFIG_BACKUP_DIR/engine_$TIMESTAMP.js
cp $ZENBOT_DIR/commands/trade.js $CONFIG_BACKUP_DIR/trade_$TIMESTAMP.js
print_message "$GREEN" "✓ Success"

# Backup state files
print_message "$BLUE" "Backing up state files..."
tar -czf $STATE_BACKUP_DIR/state_$TIMESTAMP.tar.gz -C /var/lib/zenbot state/
print_message "$GREEN" "✓ Success"

# Backup log files
print_message "$BLUE" "Backing up log files..."
tar -czf $LOG_BACKUP_DIR/logs_$TIMESTAMP.tar.gz -C /var/log/zenbot .
print_message "$GREEN" "✓ Success"

# Backup entire installation
print_message "$BLUE" "Backing up entire installation..."
tar -czf $BACKUP_DIR/zenbot_full_$TIMESTAMP.tar.gz -C /opt zenbot
print_message "$GREEN" "✓ Success"

# Copy to remote server if configured
if [ -n "$REMOTE_BACKUP_SERVER" ] && [ -n "$REMOTE_BACKUP_USER" ] && [ -n "$REMOTE_BACKUP_DIR" ]; then
  print_message "$BLUE" "Copying backup to remote server..."
  scp $BACKUP_DIR/zenbot_full_$TIMESTAMP.tar.gz $REMOTE_BACKUP_USER@$REMOTE_BACKUP_SERVER:$REMOTE_BACKUP_DIR/
  
  if [ $? -eq 0 ]; then
    print_message "$GREEN" "✓ Success"
  else
    print_message "$RED" "✗ Failed to copy backup to remote server"
  fi
fi

# Keep only the last 7 full backups
print_message "$BLUE" "Cleaning up old backups..."
ls -t $BACKUP_DIR/zenbot_full_*.tar.gz | tail -n +8 | xargs -r rm

# Keep only the last 30 config backups
ls -t $CONFIG_BACKUP_DIR/conf_*.js | tail -n +31 | xargs -r rm
ls -t $CONFIG_BACKUP_DIR/env_* | tail -n +31 | xargs -r rm
ls -t $CONFIG_BACKUP_DIR/strategy_*.js | tail -n +31 | xargs -r rm
ls -t $CONFIG_BACKUP_DIR/engine_*.js | tail -n +31 | xargs -r rm
ls -t $CONFIG_BACKUP_DIR/trade_*.js | tail -n +31 | xargs -r rm

# Keep only the last 14 state backups
ls -t $STATE_BACKUP_DIR/state_*.tar.gz | tail -n +15 | xargs -r rm

# Keep only the last 7 log backups
ls -t $LOG_BACKUP_DIR/logs_*.tar.gz | tail -n +8 | xargs -r rm
print_message "$GREEN" "✓ Success"

print_message "$GREEN" "Backup completed successfully!"
print_message "$YELLOW" "Backup files are stored in $BACKUP_DIR"
```

3. Make the backup script executable:

```bash
chmod +x backup_zenbot.sh
```

### Running in Production

To run the fixed version in production:

1. Deploy using the deployment script:

```bash
# Run the deployment script
sudo ./deploy_production.sh binance BTC-USDT stddev paper
```

2. Set up cron jobs:

```bash
# Set up cron jobs
sudo ./setup_cron_jobs.sh
```

3. Set up log rotation:

```bash
# Set up log rotation
sudo ./setup_logrotate.sh
```

4. Start the service:

```bash
# Start the service
sudo systemctl start zenbot.service
```

5. Check the service status:

```bash
# Check the service status
sudo systemctl status zenbot.service
```

6. View the logs:

```bash
# View the logs
sudo journalctl -u zenbot.service -f
```

7. Monitor the health:

```bash
# Monitor the health
sudo ./monitor_zenbot.sh
```

8. Create a backup:

```bash
# Create a backup
sudo ./backup_zenbot.sh
```

### Troubleshooting

If you encounter issues:

1. Check the service status:

```bash
sudo systemctl status zenbot.service
```

2. View the logs:

```bash
sudo journalctl -u zenbot.service -f
```

3. Check the health status:

```bash
cat /var/lib/zenbot/health/*_health.json | jq .
```

4. Check for errors in the logs:

```bash
grep -i "error" /var/log/zenbot/error-$(date +%Y-%m-%d).log | tail -n 20
```

5. Restart the service:

```bash
sudo systemctl restart zenbot.service
```

6. Restore from a backup:

```bash
sudo ./restore_zenbot.sh /var/lib/zenbot/backups/zenbot_full_YYYYMMDD_HHMMSS.tar.gz
```

7. Rollback state:

```bash
sudo ./rollback_state.sh /var/lib/zenbot/backups/state/state_YYYYMMDD_HHMMSS.tar.gz
```

This completes Part 5 of the ProfitCommandManual, covering deployment and operations for your Zenbot trading strategy. In Part 6, we'll continue with comprehensive terminal commands and troubleshooting.
