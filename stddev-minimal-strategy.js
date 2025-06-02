var c = module.exports = {}

// Core settings
c.strategy = 'stddev-minimal'  // Use our new minimal strategy
c.selector = 'binance.BTC-USDT'
c.period = '15m'
c.min_periods = 10

// Exchange API keys
c.binance = {}
c.binance.key = process.env.ZENBOT_BINANCE_API_KEY || 'SC2lFZ9YFgSgVUo33ku1La08jXWpfZULxu2eMR0RYvlHVfBhLb7umNOxKiry6THu'
c.binance.secret = process.env.ZENBOT_BINANCE_SECRET || 'yAq1dk5zbLvgArRLAPkgdGfQvChz1Ezgg5yl8wb3TO2ok5EsXBGi1n5rP0apdFes'

// MongoDB configuration
c.mongo = {}
c.mongo.db = 'zenbot4'
c.mongo.host = 'localhost'
c.mongo.port = 27017

// Basic settings
c.currency_capital = 1000
c.asset_capital = 0
c.order_type = 'maker'
c.buy_pct = 50
c.sell_pct = 50

// Strategy-specific settings
c.trendtrades_1 = 5
c.trendtrades_2 = 10