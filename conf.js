var c = module.exports = {}

// mongo configuration
c.mongo = {}
c.mongo.db = 'zenbot4'
c.mongo.host = 'localhost'
c.mongo.port = 27017
c.mongo.connectionString = 'mongodb://localhost:27017/zenbot4'

// The following is not needed when c.mongo.connectionString is provided:
// c.mongo.host = 'localhost'
// c.mongo.port = 27017
// c.mongo.username = null
// c.mongo.password = null
c.mongo.replicaSet = null
c.mongo.authMechanism = null

// default selector. only used if omitting [selector] argument from a command.
c.selector = process.env.ZENBOT_DEFAULT_SELECTOR || 'binance.BTC-USDT'
// name of default trade strategy
c.strategy = process.env.ZENBOT_DEFAULT_STRATEGY || 'stddev'

// Exchange API keys:
// to enable Binance trading, enter your API credentials:
c.binance = {}
c.binance.key = process.env.ZENBOT_BINANCE_API_KEY || ''
c.binance.secret = process.env.ZENBOT_BINANCE_SECRET || ''
c.binance.timeout = 5000

// Optional stop-order triggers:

// sell if price drops below this % of bought price (0 to disable)
c.sell_stop_pct = process.env.ZENBOT_SELL_STOP_PCT || 0.1
// buy if price surges above this % of sold price (0 to disable)
c.buy_stop_pct = process.env.ZENBOT_BUY_STOP_PCT || -0.3
// enable trailing sell stop when reaching this % profit (0 to disable)
c.profit_stop_enable_pct = process.env.ZENBOT_PROFIT_STOP_ENABLE_PCT || 10
// maintain a trailing stop this % below the high-water mark of profit
c.profit_stop_pct = process.env.ZENBOT_PROFIT_STOP_PCT || 50

// Order execution rules:

// avoid trading at a slippage above this pct
c.max_slippage_pct = process.env.ZENBOT_MAX_SLIPPAGE_PCT || 0.01
// buy with this % of currency balance (WARNING : sim won't work properly if you set this value to 100)
c.buy_pct = process.env.ZENBOT_BUY_PCT || 99
// sell with this % of asset balance (WARNING : sim won't work properly if you set this value to 100)
c.sell_pct = process.env.ZENBOT_SELL_PCT || 99
// ms to adjust non-filled order after
c.order_adjust_time = process.env.ZENBOT_ORDER_ADJUST_TIME || 900
// avoid selling at a loss below this pct set to 0 to ensure selling at a higher price...
c.max_sell_loss_pct = process.env.ZENBOT_MAX_SELL_LOSS_PCT || 30
// avoid buying at a loss above this pct set to 0 to ensure buying at a lower price...
c.max_buy_loss_pct = process.env.ZENBOT_MAX_BUY_LOSS_PCT || 30
// ms to poll order status
c.order_poll_time = process.env.ZENBOT_ORDER_POLL_TIME || 900
// ms to wait for settlement (after an order cancel)
c.wait_for_settlement = process.env.ZENBOT_WAIT_FOR_SETTLEMENT || 500
// % to mark down buy price for orders
c.markdown_buy_pct = process.env.ZENBOT_MARKDOWN_BUY_PCT || 0
// % to mark up sell price for orders
c.markup_sell_pct = process.env.ZENBOT_MARKUP_SELL_PCT || 0
// become a market taker (high fees) or a market maker (low fees)
c.order_type = process.env.ZENBOT_ORDER_TYPE || 'maker'
// when supported by the exchange, use post only type orders.
c.post_only = process.env.ZENBOT_POST_ONLY || false
// use separated fee currency such as binance's BNB.
c.use_fee_asset = process.env.ZENBOT_USE_FEE_ASSET || true

// Misc options:

// default # days for backfill and sim commands
c.days = process.env.ZENBOT_DAYS || 1
// defaults to a high number of lookback periods
c.keep_lookback_periods = process.env.ZENBOT_KEEP_LOOKBACK_PERIODS || 50
// ms to poll new trades at
c.poll_trades = process.env.ZENBOT_POLL_TRADES || 500
// amount of currency to start simulations with
c.currency_capital = process.env.ZENBOT_CURRENCY_CAPITAL || 1000
// amount of asset to start simulations with
c.asset_capital = process.env.ZENBOT_ASSET_CAPITAL || 0
// for sim, reverse time at the end of the graph, normalizing buy/hold to 0
c.symmetrical = process.env.ZENBOT_SYMMETRICAL || false
// number of periods to calculate RSI at
c.rsi_periods = process.env.ZENBOT_RSI_PERIODS || 14
// period to record balances for stats
c.balance_snapshot_period = process.env.ZENBOT_BALANCE_SNAPSHOT_PERIOD || '5m'
// avg. amount of slippage to apply to sim trades
c.avg_slippage_pct = process.env.ZENBOT_AVG_SLIPPAGE_PCT || 0.045
// time to leave an order open, default to 1 day (this feature is not supported on all exchanges, currently: GDAX)
c.cancel_after = process.env.ZENBOT_CANCEL_AFTER || 'day'
// load and use previous trades for stop-order triggers and loss protection (live/paper mode only)
c.use_prev_trades = process.env.ZENBOT_USE_PREV_TRADES || false
// minimum number of previous trades to load if use_prev_trades is enabled, set to 0 to disable and use trade time in>
c.min_prev_trades = process.env.ZENBOT_MIN_PREV_TRADES || 0

// Calculation skipping options:
// enable execution time optimizations
c.fast_execution = process.env.ZENBOT_FAST_EXECUTION === 'true'
// number of ticks to skip between full recalculations (0 = calculate every tick)
c.calculation_skip_ticks = process.env.ZENBOT_CALCULATION_SKIP_TICKS ? parseInt(process.env.ZENBOT_CALCULATION_SKIP_TICKS) : 0

// output
c.output = {}

// REST API
c.output.api = {}
c.output.api.on = process.env.ZENBOT_API_ENABLE || true
c.output.api.ip = process.env.ZENBOT_API_IP || '0.0.0.0' // IPv4 or IPv6 address to listen on, uses all available interfaces if >
c.output.api.port = process.env.ZENBOT_API_PORT || 17365
