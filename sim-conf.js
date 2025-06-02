var c = module.exports = {}

// Strategy settings
c.strategy = 'trend_ema'
c.selector = 'binance.BTC-USDT'
c.period = '15m'
c.min_periods = 20

// Capital settings
c.currency_capital = 1000
c.asset_capital = 0

// Performance optimizations
c.keep_lookback_periods = 50
c.poll_trades = 500
c.order_adjust_time = 500
c.order_poll_time = 500
c.wait_for_settlement = 300
c.balance_snapshot_period = '5m'

// Risk management
c.sell_stop_pct = 0.5
c.buy_stop_pct = 0.5
c.profit_stop_enable_pct = 1
c.profit_stop_pct = 10