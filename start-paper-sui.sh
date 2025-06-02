#!/bin/bash

# Zenbot SUI-USDT Paper Trading Startup Script
echo "🚀 Starting Zenbot SUI-USDT Paper Trading..."

# Create logs directory if it doesn't exist
mkdir -p logs

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 is not installed. Installing PM2..."
    npm install -g pm2
fi

# Stop any existing paper trading processes
echo "🛑 Stopping existing paper trading processes..."
pm2 stop zenbot-paper-sui 2>/dev/null || true
pm2 delete zenbot-paper-sui 2>/dev/null || true

# Check MongoDB connection
echo "🔍 Checking MongoDB connection..."
if ! mongo zenbot4 --eval "db.runCommand('ping')" &>/dev/null; then
    echo "❌ MongoDB is not running or not accessible"
    echo "Please start MongoDB first: sudo systemctl start mongod"
    exit 1
fi

# Check SUI-USDT data availability
echo "📊 Checking SUI-USDT data availability..."
SUI_TRADES=$(mongo zenbot4 --quiet --eval "db.trades.find({selector: 'binance.SUI-USDT'}).count()")
if [ "$SUI_TRADES" -eq 0 ]; then
    echo "⚠️  No SUI-USDT data found. Running initial backfill..."
    ./zenbot.sh backfill binance.SUI-USDT --days=7
    echo "✅ Initial backfill completed"
else
    echo "✅ Found $SUI_TRADES SUI-USDT trades in database"
fi

# Start paper trading with PM2
echo "🎯 Starting SUI-USDT paper trading..."
pm2 start ecosystem-paper.config.js --only zenbot-paper-sui

# Start periodic backfill
echo "📈 Starting periodic backfill process..."
pm2 start ecosystem-paper.config.js --only zenbot-backfill-sui

# Save PM2 configuration
pm2 save

# Show status
echo "📋 Current PM2 status:"
pm2 status

echo ""
echo "🎉 Paper trading setup complete!"
echo ""
echo "📊 Monitor commands:"
echo "  pm2 logs zenbot-paper-sui     # View live logs"
echo "  pm2 status                    # Check process status"
echo "  pm2 monit                     # Real-time monitoring"
echo ""
echo "🛑 Stop commands:"
echo "  pm2 stop zenbot-paper-sui     # Stop paper trading"
echo "  pm2 restart zenbot-paper-sui  # Restart paper trading"
echo "  pm2 delete zenbot-paper-sui   # Remove process"
echo ""
echo "💰 Check paper trading balance:"
echo "  ./zenbot.sh balance --conf=conf-paper-sui.js --paper"
echo ""
echo "📈 View recent trades:"
echo "  mongo zenbot4 --eval \"db.my_trades.find({selector: 'binance.SUI-USDT'}).sort({time: -1}).limit(10).pretty()\""
