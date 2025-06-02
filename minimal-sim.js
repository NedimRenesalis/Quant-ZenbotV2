var c = module.exports = {}

// Minimal strategy settings
c.strategy = 'trend_ema'
c.selector = 'binance.BTC-USDT'
c.period = '15m'
c.min_periods = 10

// Capital settings
c.currency_capital = 1000
c.asset_capital = 0

// Extreme performance optimizations
c.keep_lookback_periods = 20
c.poll_trades = 100
c.order_adjust_time = 100
c.order_poll_time = 100
c.wait_for_settlement = 100
c.balance_snapshot_period = '15m'

// Disable unnecessary features
c.profit_stop_enable_pct = 0
c.sell_stop_pct = 0
c.buy_stop_pct = 0