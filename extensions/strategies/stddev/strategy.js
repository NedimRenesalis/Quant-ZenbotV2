/**
 * Enhanced Standard Deviation Strategy (Iteration 3) - Execution Time Optimized
 *
 * This strategy is an advanced implementation of the standard deviation strategy
 * that incorporates multi-timeframe trend analysis, volume integration, adaptive
 * position sizing, and a weighted scoring system for improved buy signal timing.
 *
 * Core improvements over the original stddev strategy:
 * 1. Multi-factor scoring system for buy signals
 * 2. Multi-timeframe trend analysis
 * 3. Volume confirmation when available
 * 4. Adaptive position sizing
 * 5. Comprehensive error handling
 * 6. Enhanced reporting and debugging
 *
 * Execution time optimizations:
 * 1. Calculation caching
 * 2. Selective recalculation
 * 3. Memory usage optimization
 * 4. Performance monitoring
 * 5. Context binding fixes
 */

var z = require('zero-fill')
  , stats = require('stats-lite')
  , math = require('mathjs')
  , ema = require('../../../lib/ema')
  , Phenotypes = require('../../../lib/phenotype')
  , debug = require('../../../lib/debug')

module.exports = {
  name: 'stddev',
  description: 'Enhanced standard deviation strategy with advanced buy signal detection, adaptive position sizing, and execution time optimization.',

  /**
   * Define strategy options and default values
   */
  getOptions: function () {
    this.option('period', 'period length, optimized for faster simulation. Same as --period_length', String, '1m')
    this.option('period_length', 'period length, optimized for faster simulation. Same as --period', String, '1m')
    this.option('trendtrades_1', 'Trades for array 1 to be subtracted stddev and mean from', Number, 5)
    this.option('trendtrades_2', 'Trades for array 2 to be calculated stddev and mean from', Number, 30)
    this.option('min_periods', 'Minimum periods before trading', Number, 50)
    this.option('enable_adaptive_sizing', 'Enable adaptive position sizing based on signal quality', Boolean, false)
    this.option('enable_volume_integration', 'Enable volume confirmation for buy signals', Boolean, false)
    this.option('enable_weighted_scoring', 'Enable multi-factor weighted scoring system for buy signals', Boolean, false)
    this.option('debug_log', 'Enable detailed debug logging for signal generation', Boolean, false)
    // Modified calculation skipping options
    this.option('fast_execution', 'Enable execution time optimizations', Boolean, false)  // Changed from true to false
    this.option('calculation_skip_ticks', 'Number of ticks to skip between full recalculations (0 = calculate every tick)', Number, 0)  // Changed from 5 to 0
    this.option('performance_report', 'Show performance metrics in console output', Boolean, true)
  },

  /**
   * Initialize strategy state
   * @param {Object} s - Strategy state object
   */
  init: function(s) {
    // Create a reference to the strategy module
    s.ctx.strategyModule = this

    // Bind all helper methods to ensure proper 'this' context
    this.initTrends = this.initTrends.bind(this)
    this.updateTrends = this.updateTrends.bind(this)
    this.initVolume = this.initVolume.bind(this)
    this.updateVolume = this.updateVolume.bind(this)
    this.volumeConfirmsBuy = this.volumeConfirmsBuy.bind(this)
    this.calculateBuyScore = this.calculateBuyScore.bind(this)
    this.calculateBuyThreshold = this.calculateBuyThreshold.bind(this)
    this.calculatePositionSize = this.calculatePositionSize.bind(this)

    // Attach bound methods to s.ctx so they're available in the correct context when onPeriod is called
    s.ctx.initTrends = this.initTrends
    s.ctx.updateTrends = this.updateTrends
    s.ctx.initVolume = this.initVolume
    s.ctx.updateVolume = this.updateVolume
    s.ctx.volumeConfirmsBuy = this.volumeConfirmsBuy
    s.ctx.calculateBuyScore = this.calculateBuyScore
    s.ctx.calculateBuyThreshold = this.calculateBuyThreshold
    s.ctx.calculatePositionSize = this.calculatePositionSize

    // Initialize calculation cache
    s.cache = {
      tick_count: 0,
      last_calculated_tick: 0,
      last_price: 0,
      last_volume: 0,
      price_change_pct: 0
    }

    // Initialize performance monitoring
    s.performance = {
      calculation_time: 0,
      last_tick_time: 0,
      avg_tick_time: 0,
      tick_times: [],
      start_time: new Date().getTime(),
      calculations_performed: 0,
      calculations_skipped: 0
    }

    // Initialize market volatility tracking
    s.market_volatility = 0

    if (s.options.debug_log) {
      debug.msg(`Strategy initialized with fast_execution=${s.options.fast_execution}, calculation_skip_ticks=${s.options.calculation_skip_ticks}`)
    }
  },

  /**
   * Reserved for future use
   * @param {Object} s - Strategy state object
   */
  calculate: function (s) {
    // Initialize strategy state if needed
    if (!s.cache) {
      this.init(s)
    }

    // Track performance
    if (s.options.fast_execution) {
      s.performance.last_tick_time = new Date().getTime()
    }
  },

  /**
   * Main strategy logic executed on each period
   * @param {Object} s - Strategy state object
   * @param {Function} cb - Callback function
   */
  onPeriod: function (s, cb) {
    try {
      // Initialize strategy state if needed
      if (!s.cache) {
        this.init(s)
      }

      // Performance monitoring start
      const start_time = s.options.fast_execution ? new Date().getTime() : 0

      // Initialize EMA if configured
      ema(s, 'stddev', s.options.stddev)

      // Calculate market volatility based on recent price changes
      if (s.lookback.length >= 10) {
        let recent_prices = []
        for (let i = 0; i < 10; i++) {
          if (s.lookback[i] && s.lookback[i].close) {
            recent_prices.push(s.lookback[i].close)
          }
        }

        if (recent_prices.length >= 3) {
          // Calculate standard deviation of recent prices
          let sum = recent_prices.reduce((a, b) => a + b, 0)
          let mean = sum / recent_prices.length
          let variance = recent_prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recent_prices.length
          s.market_volatility = Math.sqrt(variance) / mean

          if (s.options.debug_log && s.cache.tick_count % 10 === 0) {
            debug.msg(`Market volatility: ${(s.market_volatility * 100).toFixed(2)}%`)
          }
        }
      }

      // Skip full calculation if enabled and not enough price change
      if (s.options.fast_execution && s.options.calculation_skip_ticks > 0) {
        s.cache.tick_count++

        // Calculate price change percentage regardless of tick count
        if (s.lookback[0] && s.lookback[0].close && s.cache.last_price) {
          s.cache.price_change_pct = Math.abs(s.lookback[0].close - s.cache.last_price) / s.cache.last_price
        } else {
          // If we can't calculate price change, don't skip
          s.cache.price_change_pct = 1
        }

        // Check if we should skip calculation
        if (s.cache.tick_count - s.cache.last_calculated_tick < s.options.calculation_skip_ticks) {
          // Only skip if ALL conditions are met:
          // 1. Price change is minimal (less than 0.05% - more sensitive than before)
          // 2. No active trades or signals
          // 3. Not in a high volatility period
          if (s.cache.price_change_pct < 0.0005 && !s.signal && !s.buy_order && !s.sell_order && (!s.market_volatility || s.market_volatility < 0.01)) {
            if (s.options.debug_log) {
              debug.msg(`Skipping calculation (tick ${s.cache.tick_count}, last calc: ${s.cache.last_calculated_tick}, price change: ${(s.cache.price_change_pct * 100).toFixed(3)}%)`)
            }
            s.performance.calculations_skipped++
            return cb()
          }
        }

        // Update cache for next time
        s.cache.last_calculated_tick = s.cache.tick_count
        if (s.lookback[0] && s.lookback[0].close) {
          s.cache.last_price = s.lookback[0].close
        }
        s.performance.calculations_performed++
      }

      var tl0 = []
      var tl1 = []

      // Ensure we have enough data before proceeding
      if (!s.lookback[s.options.min_periods]) {
        if (s.options.debug_log) {
          debug.msg('Not enough data yet, waiting for more periods')
        }
        return cb()
      }

      // Collect price data with error handling
      try {
        for (let i = 0; i < s.options.trendtrades_1; i++) {
          if (s.lookback[i] && s.lookback[i].close) {
            tl0.push(s.lookback[i].close)
          }
        }
        for (let i = 0; i < s.options.trendtrades_2; i++) {
          if (s.lookback[i] && s.lookback[i].close) {
            tl1.push(s.lookback[i].close)
          }
        }

        // Verify we have enough data points
        if (tl0.length < 3 || tl1.length < 3) {
          if (s.options.debug_log) {
            debug.msg(`Insufficient data points: tl0=${tl0.length}, tl1=${tl1.length}`)
          }
          return cb()
        }
      } catch (e) {
        debug.msg('Error collecting price data: ' + e.message)
        return cb()
      }

      // Calculate standard deviation without division (increased sensitivity)
      s.std0 = stats.stdev(tl0)
      s.std1 = stats.stdev(tl1)

      // Calculate means
      s.mean0 = math.mean(tl0)
      s.mean1 = math.mean(tl1)

      // Basic signals (same as original strategy)
      s.sig0 = s.std0 > s.std1 ? 'Up' : 'Down'
      s.sig1 = s.mean0 > s.mean1 ? 'Up' : 'Down'

      // Calculate signal strength metrics
      s.mean_ratio = s.mean0 / s.mean1
      s.std_ratio = s.std0 / s.std1

      // Only calculate market volatility if needed for weighted scoring
      if (s.options.enable_weighted_scoring) {
        s.market_volatility = s.std1 / s.mean1

        // Update multi-timeframe trends
        this.updateTrends(s)
      }

      // Only update volume metrics if volume integration is enabled
      if (s.options.enable_volume_integration) {
        this.updateVolume(s)
      }

      // Simple buy/sell logic when weighted scoring is disabled
      if (!s.options.enable_weighted_scoring) {
        // Sell logic (basic)
        if (s.sig1 === 'Down' && !s.signal) {  // Only set if not already set
          s.signal = 'sell'
          if (s.options.debug_log) {
            debug.msg(`SELL signal generated: mean trend down (${s.mean0.toFixed(4)} < ${s.mean1.toFixed(4)})`)
          }
        }
        // Buy logic (basic)
        else if (s.sig0 === 'Up' && s.sig1 === 'Up' && !s.signal) {  // Only set if not already set
          s.signal = 'buy'
          if (s.options.debug_log) {
            debug.msg(`BUY signal generated: both std and mean trends up`)
          }
        }
      }
      // Advanced buy/sell logic with weighted scoring
      else {
        // Signal persistence tracking
        s.buy_signals = s.buy_signals || 0

        // Calculate buy score and threshold
        let buy_score = this.calculateBuyScore(s)
        let buy_threshold = this.calculateBuyThreshold(s)

        // Store for reporting
        s.buy_score = buy_score
        s.buy_threshold = buy_threshold

        // Update persistence counter
        if (buy_score > buy_threshold * 0.8) {
          s.buy_signals++
        } else if (buy_score > buy_threshold) {
          s.buy_signals = 2 // Force immediate signal for strong scores
        } else {
          s.buy_signals = 0 // Reset counter when score is low
        }

        // Sell logic
        if (s.sig1 === 'Down' && !s.signal) {  // Only set if not already set
          s.signal = 'sell'
          if (s.options.debug_log) {
            debug.msg(`SELL signal generated: mean trend down (${s.mean0.toFixed(4)} < ${s.mean1.toFixed(4)})`)
          }
        }
        // Advanced buy logic with scoring system
        else if ((buy_score > buy_threshold || (buy_score > buy_threshold * 0.8 && s.buy_signals >= 2)) && !s.signal) {  // Only set if not already set
          s.signal = 'buy'

          // Apply adaptive position sizing if enabled
          if (s.options.enable_adaptive_sizing) {
            s.buy_pct = this.calculatePositionSize(s)
            if (s.options.debug_log) {
              debug.msg(`BUY signal with adaptive sizing: ${(s.buy_pct * 100).toFixed(0)}% position`)
            }
          } else if (s.options.debug_log) {
            debug.msg(`BUY signal generated: score=${buy_score.toFixed(1)}, threshold=${buy_threshold.toFixed(1)}`)
          }
        }
      }

      // Performance monitoring end
      if (s.options.fast_execution && start_time > 0) {
        const end_time = new Date().getTime()
        const execution_time = end_time - start_time

        // Store execution time
        s.performance.calculation_time = execution_time
        s.performance.tick_times.push(execution_time)

        // Keep only last 100 measurements
        if (s.performance.tick_times.length > 100) {
          s.performance.tick_times.shift()
        }

        // Calculate average
        if (s.performance.tick_times.length > 0) {
          s.performance.avg_tick_time = s.performance.tick_times.reduce((a, b) => a + b, 0) / s.performance.tick_times.length
        }

        // Log performance every 100 ticks
        if (s.cache.tick_count % 100 === 0 && s.options.debug_log) {
          const runtime_mins = ((new Date().getTime() - s.performance.start_time) / 60000).toFixed(1)
          const calc_pct = s.performance.calculations_performed /
            (s.performance.calculations_performed + s.performance.calculations_skipped) * 100

          debug.msg(`Performance after ${runtime_mins} mins: avg=${s.performance.avg_tick_time.toFixed(2)}ms, ` +
                   `calcs=${s.performance.calculations_performed} (${calc_pct.toFixed(1)}%), ` +
                   `skipped=${s.performance.calculations_skipped}`)
        }
      }
    } catch (err) {
      // Catch-all error handler to prevent strategy crashes
      debug.msg('Strategy execution error: ' + err.message)
      console.error('Strategy execution error:', err)
      // Always call callback to prevent hanging
      return cb()
    }

    cb()
  },

  /**
   * Initialize trend tracking data structures
   * @param {Object} s - Strategy state object
   */
  initTrends: function(s) {
    if (!s.trends) {
      s.trends = {
        short: { ema: s.mean1, direction: 'neutral', strength: 0 },
        medium: { ema: s.mean1, direction: 'neutral', strength: 0 },
        long: { ema: s.mean1, direction: 'neutral', strength: 0 }
      }
    }
  },

  /**
   * Update multi-timeframe trend indicators
   * @param {Object} s - Strategy state object
   */
  updateTrends: function(s) {
    try {
      this.initTrends(s)

      // Short-term trend (faster response)
      s.trends.short.ema = s.trends.short.ema * 0.8 + s.mean1 * 0.2
      s.trends.short.direction = s.mean1 > s.trends.short.ema ? 'up' : 'down'
      s.trends.short.strength = Math.abs(s.mean1 / s.trends.short.ema - 1) * 100

      // Medium-term trend
      s.trends.medium.ema = s.trends.medium.ema * 0.9 + s.mean1 * 0.1
      s.trends.medium.direction = s.mean1 > s.trends.medium.ema ? 'up' : 'down'
      s.trends.medium.strength = Math.abs(s.mean1 / s.trends.medium.ema - 1) * 100

      // Long-term trend (slower response)
      s.trends.long.ema = s.trends.long.ema * 0.95 + s.mean1 * 0.05
      s.trends.long.direction = s.mean1 > s.trends.long.ema ? 'up' : 'down'
      s.trends.long.strength = Math.abs(s.mean1 / s.trends.long.ema - 1) * 100

      // Calculate trend alignment score (higher when trends align)
      s.trend_alignment = 0
      if (s.trends.short.direction === 'up') s.trend_alignment++
      if (s.trends.medium.direction === 'up') s.trend_alignment++
      if (s.trends.long.direction === 'up') s.trend_alignment++

      // Calculate weighted trend strength
      s.trend_strength = (
        s.trends.short.strength * 0.5 +
        s.trends.medium.strength * 0.3 +
        s.trends.long.strength * 0.2
      )
    } catch (err) {
      debug.msg('Error updating trends: ' + err.message)
      // Fail gracefully - trends will remain at previous values
    }
  },

  /**
   * Initialize volume tracking data structures
   * @param {Object} s - Strategy state object
   */
  initVolume: function(s) {
    if (!s.volume_metrics) {
      s.volume_metrics = {
        history: [],
        avg: 0,
        rising: false,
        spike: false
      }
    }
  },

  /**
   * Update volume metrics for signal confirmation
   * @param {Object} s - Strategy state object
   */
  updateVolume: function(s) {
    try {
      this.initVolume(s)

      // Only proceed if volume data is available
      if (s.lookback[0] && s.lookback[0].volume) {
        // Skip if volume hasn't changed significantly and fast execution is enabled
        if (s.options.fast_execution && s.cache.last_volume > 0) {
          const volume_change_pct = Math.abs(s.lookback[0].volume - s.cache.last_volume) / s.cache.last_volume
          if (volume_change_pct < 0.05) { // Less than 5% change
            return
          }
        }

        // Update cache
        s.cache.last_volume = s.lookback[0].volume

        // Add current volume to history (keep last 10 periods)
        s.volume_metrics.history.unshift(s.lookback[0].volume)
        if (s.volume_metrics.history.length > 10) {
          s.volume_metrics.history.pop()
        }

        // Calculate average volume
        if (s.volume_metrics.history.length >= 3) {
          s.volume_metrics.avg = s.volume_metrics.history.slice(0, 3).reduce((a, b) => a + b, 0) / 3

          // Determine if volume is rising (current > previous)
          s.volume_metrics.rising = s.volume_metrics.history[0] > s.volume_metrics.history[1]

          // Detect volume spikes (current > 150% of average)
          s.volume_metrics.spike = s.volume_metrics.history[0] > s.volume_metrics.avg * 1.5
        }
      }
    } catch (err) {
      debug.msg('Error updating volume metrics: ' + err.message)
      // Fail gracefully - volume metrics will remain at previous values
    }
  },

  /**
   * Check if volume confirms a potential buy signal
   * @param {Object} s - Strategy state object
   * @returns {boolean} - True if volume confirms buy, or if volume data is unavailable
   */
  volumeConfirmsBuy: function(s) {
    // If volume integration is disabled, always return true
    if (!s.options.enable_volume_integration) return true

    // If volume data isn't available, don't use it as a filter
    if (!s.lookback[0] || !s.lookback[0].volume) return true

    // Volume confirmation: either rising volume or a volume spike
    return s.volume_metrics.rising || s.volume_metrics.spike
  },

  /**
   * Calculate buy signal score (0-100) based on multiple factors
   * @param {Object} s - Strategy state object
   * @returns {number} - Buy signal score from 0-100
   */
  calculateBuyScore: function(s) {
    try {
      let score = 0

      // Base score from mean trend (0-30)
      if (s.sig1 === 'Up') {
        score += 30 * Math.min(1, (s.mean_ratio - 1) * 100) // Scale by strength
      }

      // Score from standard deviation trend (0-20)
      if (s.sig0 === 'Up') {
        score += 20 * Math.min(1, (s.std_ratio - 1) * 10) // Scale by strength
      }

      // Only include these scores if weighted scoring is enabled
      if (s.options.enable_weighted_scoring) {
        // Score from trend alignment (0-15)
        score += s.trend_alignment * 5

        // Score from trend strength (0-15)
        score += Math.min(15, s.trend_strength)

        // Score from volume confirmation (0-10)
        if (s.options.enable_volume_integration && this.volumeConfirmsBuy(s)) {
          score += 10
        }

        // Score from signal persistence (0-10)
        score += Math.min(10, s.buy_signals * 5)

        // Penalty for high volatility (-20-0)
        if (s.market_volatility > 0.05) { // More than 5% volatility
          score -= Math.min(20, (s.market_volatility - 0.05) * 200)
        }
      } else {
        // Simplified scoring for basic mode
        // Add extra points if both signals are up
        if (s.sig0 === 'Up' && s.sig1 === 'Up') {
          score += 40
        }
      }

      // Ensure score is within 0-100 range
      return Math.max(0, Math.min(100, score))
    } catch (err) {
      debug.msg('Error calculating buy score: ' + err.message)
      return 0 // Default to no buy signal on error
    }
  },

  /**
   * Calculate buy threshold based on market conditions
   * @param {Object} s - Strategy state object
   * @returns {number} - Dynamic buy threshold (higher in volatile markets)
   */
  calculateBuyThreshold: function(s) {
    try {
      // Base threshold
      let threshold = 60

      // Adjust threshold based on volatility
      if (s.market_volatility > 0.03) { // More than 3% volatility
        threshold += (s.market_volatility - 0.03) * 200 // Up to +20 for 13% volatility
      }

      // Adjust threshold based on trend alignment
      if (s.trend_alignment < 2) {
        threshold += (2 - s.trend_alignment) * 5 // Up to +10 for no alignment
      }

      return threshold
    } catch (err) {
      debug.msg('Error calculating buy threshold: ' + err.message)
      return 60 // Default threshold on error
    }
  },

  /**
   * Calculate adaptive position size based on signal quality
   * @param {Object} s - Strategy state object
   * @returns {number} - Position size multiplier (0.7-1.2)
   */
  calculatePositionSize: function(s) {
    try {
      // Default position size (100%)
      let size = 1.0

      // Adjust based on buy score vs threshold
      if (s.buy_score && s.buy_threshold) {
        const score_ratio = s.buy_score / s.buy_threshold

        // Scale position size between 70% and 120% based on signal quality
        if (score_ratio < 1.1) {
          // Weaker signals: 70-100%
          size = 0.7 + (score_ratio - 1) * 3
        } else {
          // Stronger signals: 100-120%
          size = 1.0 + (score_ratio - 1.1) * 0.5
        }

        // Ensure within bounds
        size = Math.max(0.7, Math.min(1.2, size))
      }

      return size
    } catch (err) {
      debug.msg('Error calculating position size: ' + err.message)
      return 1.0 // Default to 100% on error
    }
  }
}
