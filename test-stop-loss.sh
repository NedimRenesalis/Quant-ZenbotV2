#!/bin/bash

echo "🛡️ STOP-LOSS TESTING SCRIPT"
echo "=========================="

# Function to test stop-loss in simulation
test_simulation() {
    echo "📊 Testing stop-loss in simulation mode..."
    echo "Looking for stop-loss triggers in recent market data..."
    
    # Run a short simulation
    timeout 60 NODE_OPTIONS="--max-old-space-size=4096" ./zenbot.sh sim --conf=conf.js --days=2 --strategy=stddev --silent | grep -i "stop\|triggered" || echo "No stop-loss triggers found in simulation"
}

# Function to check current live trading for stop-loss activity
check_live_trading() {
    echo ""
    echo "🔴 Checking live trading logs for stop-loss activity..."
    
    if pm2 list | grep -q "zenbot-live-trading.*online"; then
        echo "✅ Live trading is running"
        
        # Check recent logs for stop-loss triggers
        echo "Recent stop-loss activity:"
        pm2 logs zenbot-live-trading --lines 100 2>/dev/null | grep -i "stop.*triggered" | tail -5 || echo "No recent stop-loss triggers found"
        
        # Check current trade worth
        echo ""
        echo "💰 Current trading status:"
        ./zenbot.sh balance --conf=conf.js 2>/dev/null | grep -E "(Asset|Currency|Total):" || echo "Unable to fetch balance"
        
    else
        echo "❌ Live trading is not running"
    fi
}

# Function to monitor stop-loss in real-time
monitor_stop_loss() {
    echo ""
    echo "👁️ Monitoring for stop-loss triggers (press Ctrl+C to stop)..."
    echo "Watching for: 'sell stop triggered', 'profit stop triggered', 'buy stop triggered'"
    echo ""
    
    if pm2 list | grep -q "zenbot-live-trading.*online"; then
        # Monitor live logs for stop-loss triggers
        pm2 logs zenbot-live-trading 2>/dev/null | grep --line-buffered -i "stop.*triggered\|stop signal\|executeStop"
    else
        echo "❌ No live trading process to monitor"
    fi
}

# Function to verify stop-loss configuration
check_config() {
    echo ""
    echo "⚙️ Current stop-loss configuration:"
    echo "=================================="
    
    grep -E "sell_stop_pct|buy_stop_pct|profit_stop" conf.js | sed 's/^/  /'
    
    echo ""
    echo "📋 Stop-loss settings explanation:"
    echo "  sell_stop_pct: Sell if price drops this % below buy price"
    echo "  buy_stop_pct: Buy if price rises this % above sell price"  
    echo "  profit_stop_enable_pct: Enable trailing stop at this % profit"
    echo "  profit_stop_pct: Trail this % below profit high-water mark"
}

# Main menu
echo ""
echo "Choose testing option:"
echo "1) Test stop-loss in simulation"
echo "2) Check live trading for stop-loss activity"
echo "3) Monitor stop-loss in real-time"
echo "4) Check stop-loss configuration"
echo "5) Run all tests"
echo ""

read -p "Enter choice (1-5): " choice

case $choice in
    1)
        test_simulation
        ;;
    2)
        check_live_trading
        ;;
    3)
        monitor_stop_loss
        ;;
    4)
        check_config
        ;;
    5)
        check_config
        test_simulation
        check_live_trading
        echo ""
        echo "🎯 All tests completed. Use option 3 to monitor real-time."
        ;;
    *)
        echo "Invalid choice. Please run the script again."
        ;;
esac
