#!/bin/bash

# Zenbot SUI-USDT Paper Trading Monitor Script
echo "📊 Zenbot SUI-USDT Paper Trading Monitor"
echo "========================================"

# Check if paper trading process is running
if pm2 list | grep -q "zenbot-paper-sui.*online"; then
    echo "✅ Paper trading process is RUNNING"
else
    echo "❌ Paper trading process is NOT RUNNING"
    echo "Start it with: ./start-paper-sui.sh"
    exit 1
fi

echo ""
echo "💰 Current Paper Trading Balance:"
echo "--------------------------------"
./zenbot.sh balance --conf=conf-paper-sui.js --paper 2>/dev/null || echo "Unable to fetch balance"

echo ""
echo "📈 Recent Trades (Last 5):"
echo "-------------------------"
mongo zenbot4 --quiet --eval "
db.my_trades.find({selector: 'binance.SUI-USDT'}).sort({time: -1}).limit(5).forEach(function(trade) {
  var date = new Date(trade.time);
  var profit = trade.type === 'sell' ? ((trade.price - trade.buy_price) / trade.buy_price * 100).toFixed(2) + '%' : 'N/A';
  print(date.toISOString() + ' | ' + trade.type.toUpperCase() + ' | Price: $' + trade.price + ' | Size: ' + trade.size + ' | Profit: ' + profit);
});
"

echo ""
echo "📊 Trading Statistics:"
echo "--------------------"
mongo zenbot4 --quiet --eval "
var trades = db.my_trades.find({selector: 'binance.SUI-USDT'}).toArray();
if (trades.length > 0) {
  var buys = trades.filter(t => t.type === 'buy').length;
  var sells = trades.filter(t => t.type === 'sell').length;
  var profits = 0, losses = 0;
  var totalProfit = 0;
  
  for (var i = 0; i < trades.length; i++) {
    if (trades[i].type === 'sell' && trades[i].buy_price) {
      var profit = (trades[i].price - trades[i].buy_price) / trades[i].buy_price;
      totalProfit += profit;
      if (profit > 0) profits++; else losses++;
    }
  }
  
  print('Total Trades: ' + trades.length);
  print('Buys: ' + buys + ' | Sells: ' + sells);
  print('Profitable Sells: ' + profits + ' | Loss Sells: ' + losses);
  if (sells > 0) {
    print('Win Rate: ' + (profits / sells * 100).toFixed(2) + '%');
    print('Total Return: ' + (totalProfit * 100).toFixed(2) + '%');
  }
} else {
  print('No trades found yet');
}
"

echo ""
echo "🔄 Process Status:"
echo "----------------"
pm2 status zenbot-paper-sui

echo ""
echo "📝 Recent Log Entries (Last 10 lines):"
echo "-------------------------------------"
tail -n 10 logs/paper-sui-combined.log 2>/dev/null || echo "No logs found yet"

echo ""
echo "🕐 Last Updated: $(date)"
echo ""
echo "Commands:"
echo "  ./monitor-paper-sui.sh     # Run this monitor again"
echo "  pm2 logs zenbot-paper-sui  # View live logs"
echo "  pm2 monit                  # Real-time PM2 monitor"
