#!/bin/bash
echo "🚀 LIVE TRADING MONITOR - $(date)"
echo "=================================="

# Process status
echo "📊 Process Status:"
pm2 status | grep zenbot-live-trading

echo ""
echo "💰 Current Balance:"
./zenbot.sh balance --conf=conf.js 2>/dev/null | grep -E "(Asset|Currency|Total):"

echo ""
echo "📈 Recent Trades (Last 5):"
mongo zenbot4 --quiet --eval "
db.my_trades.find({}).sort({time: -1}).limit(5).forEach(function(trade) {
  var date = new Date(trade.time);
  var profit = trade.type === 'sell' && trade.buy_price ? 
    ((trade.price - trade.buy_price) / trade.buy_price * 100).toFixed(2) + '%' : 'N/A';
  var typeStr = trade.type.toUpperCase();
  while(typeStr.length < 4) typeStr += ' ';
  print(date.toISOString().substr(0,19) + ' | ' + typeStr + 
    ' | Price: $' + trade.price + ' | Size: ' + trade.size.toFixed(6) + ' | P/L: ' + profit);
});
"

echo ""
echo "📊 Trading Statistics (Last 24h):"
mongo zenbot4 --quiet --eval "
var yesterday = Date.now() - (24 * 60 * 60 * 1000);
var trades = db.my_trades.find({time: {\$gte: yesterday}}).toArray();
var buys = trades.filter(t => t.type === 'buy').length;
var sells = trades.filter(t => t.type === 'sell').length;
var totalFees = trades.reduce((sum, t) => sum + (t.fee || 0), 0);
print('Total trades: ' + trades.length + ' | Buys: ' + buys + ' | Sells: ' + sells);
print('Total fees: $' + totalFees.toFixed(2));
"

echo ""
echo "🔄 Process Health:"
UPTIME=$(pm2 info zenbot-live-trading 2>/dev/null | grep 'uptime' | awk '{print $3}' | head -1)
RESTARTS=$(pm2 info zenbot-live-trading 2>/dev/null | grep 'restarts' | awk '{print $3}' | head -1)
MEMORY=$(pm2 list 2>/dev/null | grep zenbot-live-trading | awk '{print $6}')
echo "Uptime: ${UPTIME:-N/A}"
echo "Restarts: ${RESTARTS:-N/A}" 
echo "Memory: ${MEMORY:-N/A}"

echo ""
echo "🛡️ Stop-Loss Activity (Last 24h):"
pm2 logs zenbot-live-trading --lines 500 2>/dev/null | grep -i "stop.*triggered" | tail -3 || echo "No stop-loss triggers found"

echo ""
echo "📝 Recent Log Activity:"
pm2 logs zenbot-live-trading --lines 3 2>/dev/null | tail -3

echo ""
echo "🎯 Quick Actions:"
echo "  pm2 logs zenbot-live-trading --lines 20  # View recent logs"
echo "  pm2 restart zenbot-live-trading          # Restart trading"
echo "  pm2 stop zenbot-live-trading             # Stop trading"
