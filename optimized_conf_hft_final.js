var c = module.exports = {}

// -- Required Options --
c.selector = 'binance.SUI-USDT'
c.mode = 'paper'
c.strategy = 'cci_srsi'

// -- General Options --
c.debug = false
c.timezone = 'UTC'
c.currency_capital = 1000
c.asset_capital = 0
c.order_type = 'maker'
c.fee_pct = 0.1
c.slippage_pct = 0.05
c.min_periods = 12
c.poll_trades = 400
c.order_poll_time = 400
c.order_adjust_time = 400
c.wait_for_settlement = 200
c.cancel_after = 600
c.sell_stop_pct = 0.4
c.buy_stop_pct = 0.4
c.profit_stop_enable_pct = 0.7
c.profit_stop_pct = 0.25
c.max_slippage_pct = 0.05
c.max_sell_loss_pct = 0.4
c.max_buy_loss_pct = 0.4
c.rsi_periods = 7
c.poll_trades = 400
c.balance_snapshot_period = '5m'

// -- Strategy Specific Options --
c.period = '1m'
c.min_periods = 12
c.cci_periods = 8
c.rsi_periods = 7
c.srsi_periods = 5
c.srsi_k = 3
c.srsi_d = 2
c.oversold_rsi = 22
c.overbought_rsi = 78
c.oversold_cci = -75
c.overbought_cci = 125
c.ema_acc = 0.04
c.confirmation_periods = 1
c.hft_stop_loss_pct = 0.4
c.trailing_stop_pct = 0.25
c.profit_take_pct = 0.7
c.risk_per_trade_pct = 0.8

// -- Advanced Features --
c.dynamic_stop_loss = true
c.stop_loss_volatility_factor = 0.6
c.volume_filter = true
c.min_volume_factor = 1.3
c.adaptive_position_sizing = true
c.position_size_volatility_factor = 0.6
c.max_hold_periods = 20
c.trend_detection_periods = 14
c.trend_strength_threshold = 0.65
c.market_condition_lookback = 50
c.trend_consistency_threshold = 0.65
c.indicator_volatility_adjustment = true
c.market_regime_detection = true
c.regime_change_threshold = 0.7
c.regime_lookback_periods = 100
c.adaptive_learning = true
c.learning_rate = 0.1
c.memory_length = 50
c.volatility_adjustment_enabled = true

// -- Execution Parameters --
c.order_adjust_time = 400
c.order_poll_time = 400
c.wait_for_settlement = 200
c.binance = {}
c.binance.timeout = 2000
c.binance.recvWindow = 8000
c.binance.adjustForTimeDifference = true
c.binance.useServerTime = true
c.binance.reconnect = true
c.binance.rate_limit = {
  max_requests_per_second: 5,
  burst_requests: 10
}

// -- Backfill Parameters --
c.backfill = {
  days: 30,
  period: '1m',
  batch_size: 1000,
  bulk_size: 100,
  rate_limit_ms: 1200,
  parallel_processes: 1,
  verify: true,
  gap_detection: true,
  gap_threshold_pct: 0.5,
  retry_attempts: 3,
  retry_delay_ms: 2000,
  optimize_db: true
}

// -- Simulation Parameters --
c.sim = {
  days: 30,
  currency_capital: 1000,
  asset_capital: 0,
  fee_pct: 0.1,
  slippage_pct: 0.05,
  min_trade: 0.001,
  buy_pct: 100,
  sell_pct: 100,
  price_format: 'native',
  keep_lookback_periods: 5000,
  verbose: true,
  performance_report: true,
  generate_charts: true
}

// -- Performance Reporting --
c.performance = {
  report_interval: '5m',
  stats_days: 30,
  enable_advanced_metrics: true,
  enable_risk_metrics: true,
  enable_trade_breakdown: true
}

// -- MongoDB Configuration --
c.mongo = {}
c.mongo.db = 'zenbot4'
c.mongo.host = 'localhost'
c.mongo.port = 27017
c.mongo.connectionString = 'mongodb://localhost:27017/zenbot4'

// -- Error Handling --
c.recovery_tries = 3
c.recovery_wait_time = 10000
c.enable_error_reporting = true
c.enable_health_checks = true
c.health_check_interval = 60000

// -- Logging --
c.log_level = 'info'
c.enable_trade_log = true
c.enable_performance_log = true
c.enable_debug_log = false
