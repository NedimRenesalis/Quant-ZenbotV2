var c = module.exports = {}

// Basic settings
c.strategy = 'stddev'
c.selector = 'binance.BTC-USDT'
c.period = '15m'
c.min_periods = 20

// Exchange API keys
c.binance = {}
c.binance.key = process.env.ZENBOT_BINANCE_API_KEY || 'SC2lFZ9YFgSgVUo33ku1La08jXWpfZULxu2eMR0RYvlHVfBhLb7umNOxKiry6THu'
c.binance.secret = process.env.ZENBOT_BINANCE_SECRET || 'yAq1dk5zbLvgArRLAPkgdGfQvChz1Ezgg5yl8wb3TO2ok5EsXBGi1n5rP0apdFes'
c.binance.timeout = 5000  // Added timeout setting from conf.js

// Memory optimization settings
c.keep_lookback_periods = 30  // Reduced from 50 in conf.js for faster performance
c.currency_capital = 1000
c.asset_capital = 0

// High-frequency trading optimizations
c.poll_trades = 100  // Reduced from 500 for higher frequency
c.order_adjust_time = 100  // Reduced from 900 for higher frequency
c.order_poll_time = 100  // Reduced from 900 for higher frequency
c.wait_for_settlement = 100  // Reduced from 500 for higher frequency

// Order execution settings
c.buy_pct = 99
c.sell_pct = 99
c.markdown_buy_pct = 0
c.markup_sell_pct = 0
c.order_type = 'taker'  // Using taker orders for immediate execution
c.max_slippage_pct = 0.01
c.post_only = false
c.use_fee_asset = true

// Risk management
c.sell_stop_pct = 0.1
c.buy_stop_pct = -0.3
c.profit_stop_enable_pct = 10
c.profit_stop_pct = 50
c.max_sell_loss_pct = 30
c.max_buy_loss_pct = 30

// Strategy-specific settings for high frequency
c.trendtrades_1 = 5
c.trendtrades_2 = 20
c.fast_execution = true
c.calculation_skip_ticks = 1  // Reduced from 2 to calculate more often for high frequency

// Disable advanced features
c.enable_adaptive_sizing = false
c.enable_volume_integration = false
c.enable_weighted_scoring = false
c.debug_log = false  // Disable debug logging for better performance

// Misc settings
c.days = 1
c.balance_snapshot_period = '5m'
c.avg_slippage_pct = 0.045
c.cancel_after = 'day'
c.use_prev_trades = false
c.min_prev_trades = 0

// MongoDB settings (added from conf.js)
c.mongo = {}
c.mongo.db = 'zenbot4'
c.mongo.host = 'localhost'
c.mongo.port = 27017
c.mongo.connectionString = 'mongodb://localhost:27017/zenbot4'
c.mongo.replicaSet = null
c.mongo.authMechanism = null

// Output API settings (added from conf.js)
c.output = {}
c.output.api = {}
c.output.api.on = true
c.output.api.ip = '0.0.0.0'
c.output.api.port = 17365
