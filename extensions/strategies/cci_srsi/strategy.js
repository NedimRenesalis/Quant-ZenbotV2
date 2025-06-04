
let z = require('zero-fill')
  , n = require('numbro')
  , ema = require('../../../lib/ema')
  , srsi = require('../../../lib/srsi')
  , cci = require('../../../lib/cci')
  , Phenotypes = require('../../../lib/phenotype')

/**
 * CCI_SRSI Strategy - Optimized for High-Frequency Trading and Trend Reversals
 * 
 * This strategy is specifically tuned for SUI-USDT on Binance with ~8% intraday volatility.
 * It focuses on detecting trend reversals with multiple confirmation mechanisms and
 * implements robust risk management with a 0.4% stop loss.
 * 
 * Key features:
 * - Ultra-short timeframe (1m) for high-frequency trading
 * - Advanced trend reversal detection using CCI and SRSI
 * - Multiple confirmation mechanisms including divergence detection
 * - Robust risk management with fixed, dynamic, and trailing stop losses
 * - Dynamic parameter adjustment based on market volatility
 * - Adaptive position sizing based on risk per trade and volatility
 * - Volume-based signal filtering for higher quality entries
 * - Time-based position management to prevent stagnant trades
 * - Slippage protection for volatile market conditions
 */
module.exports = {
  name: 'cci_srsi',
  description: 'Stochastic CCI Strategy optimized for HFT and trend reversals',

  getOptions: function () {
    // Timeframe settings - Optimized for higher frequency
    this.option('period', 'period length, same as --period_length', String, '1m')
    this.option('period_length', 'period length, same as --period', String, '1m')
    this.option('min_periods', 'min. number of history periods', Number, 10)
    
    // Trend detection settings
    this.option('ema_acc', 'sideways threshold (0.2-0.4)', Number, 0.035)
    this.option('trend_detection_periods', 'number of periods for trend detection', Number, 8)
    this.option('reversal_threshold', 'threshold for reversal detection', Number, 0.3)
    
    // Indicator settings - Reduced periods for faster response
    this.option('cci_periods', 'number of CCI periods', Number, 7)
    this.option('rsi_periods', 'number of RSI periods', Number, 6)
    this.option('srsi_periods', 'number of SRSI periods', Number, 4)
    this.option('srsi_k', '%K line', Number, 3)
    this.option('srsi_d', '%D line', Number, 2)
    
    // Signal thresholds - Further relaxed for HFT frequency
    this.option('oversold_rsi', 'buy when RSI reaches or drops below this value', Number, 35)
    this.option('overbought_rsi', 'sell when RSI reaches or goes above this value', Number, 65)
    this.option('oversold_cci', 'buy when CCI reaches or drops below this value', Number, -50)
    this.option('overbought_cci', 'sell when CCI reaches or goes above this value', Number, 100)
    this.option('constant', 'constant for CCI calculation', Number, 0.015)
    
    // Risk management settings
    this.option('hft_stop_loss_pct', 'stop loss percentage for HFT', Number, 0.4)
    this.option('trailing_stop_pct', 'trailing stop loss percentage', Number, 0.2)
    this.option('profit_take_pct', 'profit taking percentage', Number, 0.6)
    this.option('max_slippage_pct', 'maximum allowed slippage percentage', Number, 0.05)
    this.option('risk_per_trade_pct', 'percentage of capital to risk per trade', Number, 0.7)
    
    // Signal confirmation settings
    this.option('confirmation_periods', 'number of periods to confirm reversal', Number, 1)
    this.option('divergence_lookback', 'number of periods to look back for divergence', Number, 5)
    
    // New features for enhanced risk management
    this.option('dynamic_stop_loss', 'enable dynamic stop loss based on volatility', Boolean, true)
    this.option('stop_loss_volatility_factor', 'factor to multiply volatility for stop loss', Number, 0.5)
    this.option('max_hold_periods', 'maximum periods to hold a position', Number, 20)
    this.option('volume_filter', 'enable volume-based signal filtering', Boolean, false)
    this.option('min_volume_factor', 'minimum volume factor for signal confirmation', Number, 1.2)
    this.option('volume_lookback', 'number of periods to look back for volume analysis', Number, 5)
    this.option('adaptive_position_sizing', 'enable adaptive position sizing', Boolean, true)
    this.option('position_size_volatility_factor', 'factor to adjust position size based on volatility', Number, 0.8)
    this.option('max_position_size_pct', 'maximum position size as percentage of capital', Number, 50)
    this.option('min_position_size_pct', 'minimum position size as percentage of capital', Number, 5)
    
    // Market condition adaptation
    this.option('market_condition_lookback', 'periods to look back for market condition analysis', Number, 30)
    this.option('trend_strength_threshold', 'threshold for strong trend detection', Number, 0.5)
    
    // Error handling settings
    this.option('recovery_tries', 'number of tries to recover from errors', Number, 3)
    
    console.log('Ultra HFT CCI_SRSI Strategy optimized for SUI-USDT trend reversals - Production Ready')
  },

  calculate: function (s) {
    try {
      // Get market trend with shorter period for HFT
      ema(s, 'trend_ema', s.options.min_periods)
      ema(s, 'long_ema', s.options.trend_detection_periods * 2) // Longer EMA for trend confirmation
      
      if (typeof s.period.trend_ema !== 'undefined' && typeof s.period.long_ema !== 'undefined') {
        s.trend = s.period.trend_ema > s.lookback[0].trend_ema ? 'up' : 'down'
        
        // Enhanced trend detection
        s.trend_strength = Math.abs((s.period.trend_ema - s.period.long_ema) / s.period.long_ema * 100)
        s.is_strong_trend = s.trend_strength > s.options.reversal_threshold
      }

      // compute Stochastic RSI
      srsi(s, 'srsi', s.options.rsi_periods, s.options.srsi_k, s.options.srsi_d)

      // compute CCI
      cci(s, 'cci', s.options.cci_periods, s.options.constant)

      if (typeof s.period.cci !== 'undefined' && typeof s.period.srsi_K !== 'undefined') {
        s.cci_fromAbove = s.period.cci < s.lookback[0]['cci']
        s.rsi_fromAbove = s.period.srsi_K < s.lookback[0]['srsi_K']
        
        // Enhanced reversal detection
        s.cci_slope = s.lookback.length >= 3 ? 
          (s.period.cci - s.lookback[2].cci) / 3 : 0
        s.srsi_slope = s.lookback.length >= 3 ? 
          (s.period.srsi_K - s.lookback[2].srsi_K) / 3 : 0
          
        // Rate of change for momentum analysis
        if (s.lookback.length >= 2) {
          s.cci_roc = ((s.period.cci - s.lookback[1].cci) / Math.abs(s.lookback[1].cci || 1)) * 100
          s.srsi_roc = ((s.period.srsi_K - s.lookback[1].srsi_K) / Math.abs(s.lookback[1].srsi_K || 1)) * 100
        }
      }

      if (s.period.trend_ema && s.lookback[0] && s.lookback[0].trend_ema) {
        s.period.acc = Math.abs((s.period.trend_ema - s.lookback[0].trend_ema) / s.lookback[0].trend_ema * 100)
      }
      
      // Track volatility for dynamic thresholds
      if (!s.volatility) {
        s.volatility = []
      }
      if (s.lookback.length > 1) {
        let priceChange = Math.abs((s.period.close - s.lookback[0].close) / s.lookback[0].close * 100)
        s.volatility.push(priceChange)
        if (s.volatility.length > 20) {
          s.volatility.shift()
        }
      }
      
      // Calculate average volatility
      if (s.volatility && s.volatility.length > 0) {
        s.avgVolatility = s.volatility.reduce((a, b) => a + b, 0) / s.volatility.length
      }
      
      // Track market conditions over longer period
      if (!s.market_conditions) {
        s.market_conditions = {
          price_history: [],
          volatility_history: [],
          trend_history: []
        }
      }
      
      // Update market condition tracking
      if (s.period.close) {
        s.market_conditions.price_history.push(s.period.close)
        if (s.market_conditions.price_history.length > s.options.market_condition_lookback) {
          s.market_conditions.price_history.shift()
        }
      }
      
      if (s.avgVolatility) {
        s.market_conditions.volatility_history.push(s.avgVolatility)
        if (s.market_conditions.volatility_history.length > s.options.market_condition_lookback) {
          s.market_conditions.volatility_history.shift()
        }
      }
      
      if (s.trend) {
        s.market_conditions.trend_history.push(s.trend)
        if (s.market_conditions.trend_history.length > s.options.market_condition_lookback) {
          s.market_conditions.trend_history.shift()
        }
      }
      
      // Analyze market conditions
      if (s.market_conditions.price_history.length > 0) {
        // Calculate overall trend strength
        const first_price = s.market_conditions.price_history[0]
        const last_price = s.market_conditions.price_history[s.market_conditions.price_history.length - 1]
        const price_change_pct = ((last_price - first_price) / first_price) * 100
        
        s.market_conditions.overall_trend = price_change_pct > 0 ? 'up' : 'down'
        s.market_conditions.trend_strength = Math.abs(price_change_pct) / s.options.market_condition_lookback
        
        // Determine if we're in a strong trend
        s.market_conditions.is_strong_trend = s.market_conditions.trend_strength > s.options.trend_strength_threshold
        
        // Calculate average volatility over the lookback period
        if (s.market_conditions.volatility_history.length > 0) {
          s.market_conditions.avg_volatility = s.market_conditions.volatility_history.reduce((a, b) => a + b, 0) / 
                                              s.market_conditions.volatility_history.length
        }
        
        // Count trend consistency
        if (s.market_conditions.trend_history.length > 0) {
          const up_count = s.market_conditions.trend_history.filter(t => t === 'up').length
          const down_count = s.market_conditions.trend_history.filter(t => t === 'down').length
          const trend_consistency = Math.max(up_count, down_count) / s.market_conditions.trend_history.length
          
          s.market_conditions.trend_consistency = trend_consistency
          s.market_conditions.is_consistent_trend = trend_consistency > 0.7 // 70% consistency
        }
      }
      
      // Volume analysis for confirmation and filtering
      if (s.lookback.length > 1 && s.period.volume && s.lookback[0].volume) {
        // Calculate volume change from previous period
        s.volume_change = (s.period.volume - s.lookback[0].volume) / s.lookback[0].volume
        s.is_volume_spike = s.volume_change > 0.5 // 50% volume increase
        
        // Track recent volume for relative volume analysis
        if (!s.recent_volumes) {
          s.recent_volumes = []
        }
        s.recent_volumes.push(s.period.volume)
        if (s.recent_volumes.length > s.options.volume_lookback) {
          s.recent_volumes.shift()
        }
        
        // Calculate average volume over lookback period
        if (s.recent_volumes.length > 0) {
          s.avg_volume = s.recent_volumes.reduce((a, b) => a + b, 0) / s.recent_volumes.length
          
          // Calculate relative volume (current volume compared to average)
          s.relative_volume = s.period.volume / s.avg_volume
          
          // Determine if volume is increasing over lookback period
          if (s.recent_volumes.length >= 3) {
            const volume_slope = (s.recent_volumes[s.recent_volumes.length - 1] - 
                                 s.recent_volumes[s.recent_volumes.length - 3]) / 3
            s.volume_increasing = volume_slope > 0
          }
        }
      }
      
      // Advanced risk management
      if (s.position && s.position.side === 'long' && s.period.close && s.position.price) {
        // Calculate current profit/loss percentage
        s.current_profit_pct = ((s.period.close - s.position.price) / s.position.price) * 100
        
        // Track highest price since entry for trailing stop
        if (!s.highest_price || s.period.high > s.highest_price) {
          s.highest_price = s.period.high
        }
        
        // Calculate trailing stop loss price
        s.trailing_stop_price = s.highest_price * (1 - s.options.trailing_stop_pct / 100)
        
        // Dynamic stop loss calculation
        if (s.options.dynamic_stop_loss && s.avgVolatility) {
          // Base stop loss on recent volatility, but never less than minimum
          const dynamic_stop_pct = Math.max(
            s.options.hft_stop_loss_pct,
            s.avgVolatility * s.options.stop_loss_volatility_factor
          )
          
          // Calculate dynamic stop loss price
          const dynamic_stop_price = s.position.price * (1 - dynamic_stop_pct / 100)
          
          // Check if dynamic stop is triggered
          if (s.period.close <= dynamic_stop_price) {
            s.signal = 'sell'
            s.stop_loss_triggered = 'dynamic'
            return
          }
        }
        
        // Fixed stop loss check
        s.stop_loss_pct = ((s.position.price - s.period.close) / s.position.price) * 100
        if (s.stop_loss_pct >= s.options.hft_stop_loss_pct) {
          s.signal = 'sell'
          s.stop_loss_triggered = 'fixed'
          return
        }
        
        // Trailing stop loss check (only if in profit)
        if (s.current_profit_pct > 0 && s.period.close < s.trailing_stop_price) {
          s.signal = 'sell'
          s.stop_loss_triggered = 'trailing'
          return
        }
        
        // Take profit check
        if (s.current_profit_pct >= s.options.profit_take_pct) {
          s.signal = 'sell'
          s.profit_taken = true
          return
        }
        
        // Time-based position management
        if (!s.hold_periods) {
          s.hold_periods = 0
        }
        s.hold_periods++
        
        // Check if max hold time reached
        if (s.hold_periods >= s.options.max_hold_periods) {
          s.signal = 'sell'
          s.time_exit = true
          return
        }
      } else {
        // Reset hold periods counter when not in position
        s.hold_periods = 0
      }
      
      // Calculate optimal position size based on risk, volatility, and market conditions
      if (s.balance && s.balance.currency) {
        // Risk amount in currency
        let risk_amount = s.balance.currency * (s.options.risk_per_trade_pct / 100)
        
        // Calculate position size based on stop loss
        if (s.period.close && s.options.hft_stop_loss_pct > 0) {
          // Base position size calculation
          s.optimal_position_size = risk_amount / (s.period.close * (s.options.hft_stop_loss_pct / 100))
          
          // Apply adaptive sizing based on volatility
          if (s.options.adaptive_position_sizing && s.avgVolatility) {
            // Normalize by expected 8% volatility
            const volatility_factor = s.avgVolatility / 8
            // Reduce position size when volatility is higher than expected
            const volatility_adjustment = Math.pow(s.options.position_size_volatility_factor, volatility_factor)
            s.optimal_position_size *= volatility_adjustment
            
            // Further adjust based on market conditions
            if (s.market_conditions && s.market_conditions.is_strong_trend) {
              // Increase position size in strong trends with consistent direction
              if (s.market_conditions.is_consistent_trend) {
                // If current trend matches overall trend, increase position size
                if (s.trend === s.market_conditions.overall_trend) {
                  s.optimal_position_size *= 1.2
                  s.position_size_adjusted = 'increased_strong_trend'
                }
              }
            }
            
            // Reduce position size in choppy markets
            if (s.market_conditions && s.market_conditions.trend_consistency < 0.5) {
              s.optimal_position_size *= 0.8
              s.position_size_adjusted = 'reduced_choppy_market'
            }
          }
          
          // Calculate position size as percentage of capital
          const position_size_pct = (s.optimal_position_size * s.period.close / s.balance.currency) * 100
          
          // Apply min/max position size constraints
          if (position_size_pct > s.options.max_position_size_pct) {
            s.optimal_position_size = (s.options.max_position_size_pct / 100) * s.balance.currency / s.period.close
            s.position_size_adjusted = 'capped_at_max'
          } else if (position_size_pct < s.options.min_position_size_pct) {
            s.optimal_position_size = (s.options.min_position_size_pct / 100) * s.balance.currency / s.period.close
            s.position_size_adjusted = 'increased_to_min'
          }
          
          // Limit to available balance
          s.optimal_position_size = Math.min(s.optimal_position_size, s.balance.currency / s.period.close)
        }
      }
      
      // Market state classification
      s.market_state = classifyMarketState(s)
    }
    catch (e) {
      if (!s.recovery_tries) s.recovery_tries = 0
      s.recovery_tries++
      
      if (s.recovery_tries <= s.options.recovery_tries) {
        console.error(`Error in calculate(), attempt ${s.recovery_tries}/${s.options.recovery_tries}: ${e.message}`)
        // Continue with default values
      } else {
        console.error(`Critical error in calculate(), max retries exceeded: ${e.message}`)
        // Reset recovery counter for next time
        s.recovery_tries = 0
      }
    }
  },

  onPeriod: function (s, cb) {
    try {
      if (!s.in_preroll && typeof s.trend !== 'undefined') {
        // Reset confirmation counter if not set
        if (s.confirmation_count === undefined) {
          s.confirmation_count = 0
        }
        
        // Reset stop loss flag
        if (s.signal !== 'sell') {
          s.stop_loss_triggered = false
          s.profit_taken = false
          s.time_exit = false
        }

        // Dynamic thresholds based on volatility
        let volatility_factor = s.avgVolatility ? (s.avgVolatility / 8) : 1 // Normalize by expected 8% volatility
        let dynamic_oversold_cci = s.options.oversold_cci * (1 + volatility_factor * 0.1)
        let dynamic_overbought_cci = s.options.overbought_cci * (1 - volatility_factor * 0.1)
        let dynamic_oversold_rsi = s.options.oversold_rsi * (1 + volatility_factor * 0.05)
        let dynamic_overbought_rsi = s.options.overbought_rsi * (1 - volatility_factor * 0.05)
        
        // Signal generation based on market state
        switch(s.market_state) {
          case 'sideways':
            handleSidewaysMarket(s, dynamic_oversold_cci, dynamic_overbought_cci, dynamic_oversold_rsi, dynamic_overbought_rsi)
            break
            
          case 'uptrend':
            handleUptrend(s, dynamic_oversold_cci, dynamic_oversold_rsi)
            break
            
          case 'downtrend':
            handleDowntrend(s, dynamic_overbought_cci, dynamic_overbought_rsi)
            break
            
          case 'volatile':
            // In highly volatile markets, be more conservative
            handleVolatileMarket(s, dynamic_oversold_cci, dynamic_overbought_cci, dynamic_oversold_rsi, dynamic_overbought_rsi)
            break
            
          default:
            // Default to sideways handling if market state is unknown
            handleSidewaysMarket(s, dynamic_oversold_cci, dynamic_overbought_cci, dynamic_oversold_rsi, dynamic_overbought_rsi)
        }
        
        // Enhanced reversal detection with divergence
        detectDivergence(s)
        
        // Volume-based signal filtering
        if (s.signal === 'buy' && s.options.volume_filter) {
          if (s.relative_volume < s.options.min_volume_factor) {
            s.signal = null // CANCELS THE SIGNAL!
          }
        }
        
        // Volume confirmation if available
        if (s.is_volume_spike && s.signal) {
          // Stronger signal with volume confirmation
          s.volume_confirmed = true
        }
        
        // Position sizing - adjust buy amount based on risk calculation
        if (s.signal === 'buy' && s.optimal_position_size) {
          s.buy_amount = s.optimal_position_size
        }
        
        // Final safety check - avoid trading during extreme volatility
        if (s.avgVolatility && s.avgVolatility > 15) { // 15% is extremely high volatility
          s.signal = null
          s.extreme_volatility = true
        }
      }
      cb()
    }
    catch (e) {
      if (!s.recovery_tries) s.recovery_tries = 0
      s.recovery_tries++
      
      if (s.recovery_tries <= s.options.recovery_tries) {
        console.error(`Error in onPeriod(), attempt ${s.recovery_tries}/${s.options.recovery_tries}: ${e.message}`)
        // Continue with default behavior
        cb()
      } else {
        console.error(`Critical error in onPeriod(), max retries exceeded: ${e.message}`)
        // Reset recovery counter for next time
        s.recovery_tries = 0
        cb()
      }
    }
  },
  
  onReport: function (s) {
    try {
      var cols = []
      if (typeof s.period.cci === 'number') {
        var color = 'grey'
        if (s.period.cci > 0) {
          color = 'green'
        }
        else if (s.period.cci < 0) {
          color = 'red'
        }
        cols.push(z(8, n(s.period.cci).format('000'), ' ')[color])
        cols.push(s.period.acc > s.options.ema_acc ? z(8, n(s.period.srsi_K).format('000'), ' ')[color] : '   -->   ')
        
        // Add HFT specific reporting
        if (s.position && s.position.side === 'long') {
          cols.push('P/L: ' + n(s.current_profit_pct).format('0.00') + '%')
          
          if (s.stop_loss_triggered) {
            cols.push('SL: ' + s.stop_loss_triggered.toUpperCase())
          } else {
            cols.push('SL@: ' + n(s.options.hft_stop_loss_pct).format('0.00') + '%')
          }
          
          if (s.trailing_stop_price) {
            cols.push('TSL@: ' + n(s.trailing_stop_price).format('0.00'))
          }
          
          if (s.hold_periods) {
            cols.push('HOLD: ' + s.hold_periods + '/' + s.options.max_hold_periods)
          }
        }
        
        if (s.market_state) {
          cols.push('MKT: ' + s.market_state.toUpperCase())
        }
        
        if (s.market_conditions && s.market_conditions.is_strong_trend) {
          cols.push('STRONG-' + s.market_conditions.overall_trend.toUpperCase())
        }
        
        if (s.reversal_detected) {
          cols.push(s.reversal_detected.toUpperCase())
        }
        
        if (s.bearish_divergence) {
          cols.push('BEAR-DIV')
        }
        if (s.bullish_divergence) {
          cols.push('BULL-DIV')
        }
        
        if (s.volume_confirmed) {
          cols.push('VOL-CONF')
        }
        
        if (s.volume_filter_applied) {
          cols.push('VOL-FILT')
          if (s.volume_filter_reason) {
            cols.push(s.volume_filter_reason.toUpperCase())
          }
        }
        
        if (s.relative_volume !== undefined) {
          cols.push('REL-VOL: ' + n(s.relative_volume).format('0.00'))
        }
        
        if (s.volume_increasing !== undefined) {
          cols.push(s.volume_increasing ? 'VOL-UP' : 'VOL-DOWN')
        }
        
        if (s.position_size_adjusted) {
          cols.push('POS-ADJ: ' + s.position_size_adjusted.toUpperCase())
        }
        
        if (s.is_strong_trend) {
          cols.push('STRONG-' + s.trend.toUpperCase())
        }
        
        if (s.slippage_avoided) {
          cols.push('SLIP-AVOID')
        }
        
        if (s.profit_taken) {
          cols.push('PROFIT-TAKE')
        }
        
        if (s.time_exit) {
          cols.push('TIME-EXIT')
        }
        
        if (s.extreme_volatility) {
          cols.push('EXTREME-VOL')
        }
      }
      else {
        cols.push('         ')
      }
      return cols
    }
    catch (e) {
      console.error(`Error in onReport(): ${e.message}`)
      return ['ERROR']
    }
  },

  phenotypes: {
    // -- common
    period_length: Phenotypes.RangePeriod(1, 120, 'm'),
    min_periods: Phenotypes.Range(1, 200),
    markdown_buy_pct: Phenotypes.RangeFloat(-1, 5),
    markup_sell_pct: Phenotypes.RangeFloat(-1, 5),
    order_type: Phenotypes.ListOption(['maker', 'taker']),
    sell_stop_pct: Phenotypes.Range0(1, 50),
    buy_stop_pct: Phenotypes.Range0(1, 50),
    profit_stop_enable_pct: Phenotypes.Range0(1, 20),
    profit_stop_pct: Phenotypes.Range(1,20),

    // -- strategy
    ema_acc: Phenotypes.RangeFloat(0, 0.5),
    cci_periods: Phenotypes.Range(1, 200),
    rsi_periods: Phenotypes.Range(1, 200),
    srsi_periods: Phenotypes.Range(1, 200),
    srsi_k: Phenotypes.Range(1, 50),
    srsi_d: Phenotypes.Range(1, 50),
    oversold_rsi: Phenotypes.Range(1, 100),
    overbought_rsi: Phenotypes.Range(1, 100),
    oversold_cci: Phenotypes.Range(-100, 100),
    overbought_cci: Phenotypes.Range(1, 100),
    constant: Phenotypes.RangeFloat(0.001, 0.05),
    hft_stop_loss_pct: Phenotypes.RangeFloat(0.1, 1.0),
    trailing_stop_pct: Phenotypes.RangeFloat(0.1, 1.0),
    profit_take_pct: Phenotypes.RangeFloat(0.5, 5.0),
    confirmation_periods: Phenotypes.Range(0, 3),
    trend_detection_periods: Phenotypes.Range(5, 20),
    reversal_threshold: Phenotypes.RangeFloat(0.1, 1.0),
    max_slippage_pct: Phenotypes.RangeFloat(0.01, 0.1),
    risk_per_trade_pct: Phenotypes.RangeFloat(0.1, 5.0),
    divergence_lookback: Phenotypes.Range(3, 10),
    recovery_tries: Phenotypes.Range(1, 5),
    dynamic_stop_loss: Phenotypes.Range(0, 1),
    stop_loss_volatility_factor: Phenotypes.RangeFloat(0.1, 1.0),
    max_hold_periods: Phenotypes.Range(5, 50),
    volume_filter: Phenotypes.Range(0, 1),
    min_volume_factor: Phenotypes.RangeFloat(1.0, 2.0),
    volume_lookback: Phenotypes.Range(3, 20),
    adaptive_position_sizing: Phenotypes.Range(0, 1),
    position_size_volatility_factor: Phenotypes.RangeFloat(0.5, 1.0),
    max_position_size_pct: Phenotypes.Range(10, 100),
    min_position_size_pct: Phenotypes.Range(1, 10),
    market_condition_lookback: Phenotypes.Range(10, 100),
    trend_strength_threshold: Phenotypes.RangeFloat(0.1, 1.0)
  }
}

/**
 * Helper function to classify market state
 */
function classifyMarketState(s) {
  // Default to sideways if we can't determine
  if (!s.period || !s.period.acc || !s.avgVolatility) {
    return 'sideways'
  }
  
  // Check for high volatility first
  if (s.avgVolatility > 10) { // 10% is very high volatility
    return 'volatile'
  }
  
  // Check for sideways market
  if (s.period.acc < s.options.ema_acc) {
    return 'sideways'
  }
  
  // Check for trend direction
  if (s.trend === 'up') {
    return 'uptrend'
  } else if (s.trend === 'down') {
    return 'downtrend'
  }
  
  // Default fallback
  return 'sideways'
}

/**
 * Handle signal generation in sideways markets
 */
function handleSidewaysMarket(s, dynamic_oversold_cci, dynamic_overbought_cci, dynamic_oversold_rsi, dynamic_overbought_rsi) {
  // Buy signal
  if (s.period.cci <= dynamic_oversold_cci && s.period.srsi_K <= dynamic_oversold_rsi) {
    if (!s.cci_fromAbove && !s.rsi_fromAbove) {
      // Check for reversal pattern - CCI starting to turn up
      if (s.cci_slope > 0) {
        s.confirmation_count++
        if (s.confirmation_count >= s.options.confirmation_periods) {
          // Check for excessive slippage risk
          if (checkSlippageRisk(s)) {
            s.signal = 'buy'
            s.confirmation_count = 0
            s.reversal_detected = 'bullish'
            s.highest_price = s.period.high // Initialize highest price for trailing stop
          }
        }
      } else {
        s.confirmation_count = 0
      }
    } else {
      s.confirmation_count = 0
    }
  }
  // Sell signal
  else if (s.period.cci >= dynamic_overbought_cci && s.period.srsi_K >= dynamic_overbought_rsi) {
    if (s.cci_fromAbove || s.rsi_fromAbove) {
      // Check for reversal pattern - CCI starting to turn down
      if (s.cci_slope < 0) {
        // Check for excessive slippage risk
        if (checkSlippageRisk(s)) {
          s.signal = 'sell'
          s.confirmation_count = 0
          s.reversal_detected = 'bearish'
        }
      }
    }
  }
  else {
    // No clear signal, maintain confirmation count
  }
}

/**
 * Handle signal generation in uptrends
 */
function handleUptrend(s, dynamic_oversold_cci, dynamic_oversold_rsi) {
  if (s.period.cci <= dynamic_oversold_cci && s.period.srsi_K <= dynamic_oversold_rsi) {
    if (!s.cci_fromAbove && !s.rsi_fromAbove) {
      // In uptrend, we want quick entries on dips
      s.confirmation_count++
      if (s.confirmation_count >= s.options.confirmation_periods) {
        // Check for excessive slippage risk
        if (checkSlippageRisk(s)) {
          s.signal = 'buy'
          s.confirmation_count = 0
          s.reversal_detected = 'bullish_pullback'
          s.highest_price = s.period.high // Initialize highest price for trailing stop
        }
      }
    } else {
      s.confirmation_count = 0
    }
  }
}

/**
 * Handle signal generation in downtrends
 */
function handleDowntrend(s, dynamic_overbought_cci, dynamic_overbought_rsi) {
  if (s.period.cci >= dynamic_overbought_cci && s.period.srsi_K >= dynamic_overbought_rsi) {
    if (s.cci_fromAbove || s.rsi_fromAbove) {
      // Check for excessive slippage risk
      if (checkSlippageRisk(s)) {
        s.signal = 'sell'
        s.confirmation_count = 0
        s.reversal_detected = 'bearish_bounce'
      }
    }
  }
}

/**
 * Handle signal generation in volatile markets
 */
function handleVolatileMarket(s, dynamic_oversold_cci, dynamic_overbought_cci, dynamic_oversold_rsi, dynamic_overbought_rsi) {
  // In volatile markets, we need stronger confirmation
  // Buy signal - more conservative
  if (s.period.cci <= dynamic_oversold_cci * 1.1 && s.period.srsi_K <= dynamic_oversold_rsi * 1.1) {
    if (!s.cci_fromAbove && !s.rsi_fromAbove) {
      // Need stronger confirmation in volatile markets
      if (s.cci_slope > 0 && s.srsi_slope > 0) {
        s.confirmation_count++
        if (s.confirmation_count >= s.options.confirmation_periods + 1) { // Extra confirmation period
          // Check for excessive slippage risk with tighter threshold
          if (checkSlippageRisk(s, s.options.max_slippage_pct * 0.8)) {
            s.signal = 'buy'
            s.confirmation_count = 0
            s.reversal_detected = 'bullish_volatile'
            s.highest_price = s.period.high // Initialize highest price for trailing stop
          }
        }
      } else {
        s.confirmation_count = 0
      }
    } else {
      s.confirmation_count = 0
    }
  }
  // Sell signal - more conservative
  else if (s.period.cci >= dynamic_overbought_cci * 0.9 && s.period.srsi_K >= dynamic_overbought_rsi * 0.9) {
    if (s.cci_fromAbove || s.rsi_fromAbove) {
      // Need stronger confirmation in volatile markets
      if (s.cci_slope < 0 && s.srsi_slope < 0) {
        // Check for excessive slippage risk with tighter threshold
        if (checkSlippageRisk(s, s.options.max_slippage_pct * 0.8)) {
          s.signal = 'sell'
          s.confirmation_count = 0
          s.reversal_detected = 'bearish_volatile'
        }
      }
    }
  }
}

/**
 * Check for price-indicator divergence
 */
function detectDivergence(s) {
  if (s.lookback.length >= s.options.divergence_lookback) {
    // Price making higher high but CCI making lower high = bearish divergence
    let price_higher_high = s.period.high > Math.max(...s.lookback.slice(0, s.options.divergence_lookback).map(p => p.high))
    let cci_lower_high = s.period.cci < Math.max(...s.lookback.slice(0, s.options.divergence_lookback).map(p => p.cci || 0))
    
    if (price_higher_high && cci_lower_high && s.trend === 'up') {
      s.bearish_divergence = true
      // Strengthen sell signals during bearish divergence
      if (s.period.cci >= s.options.overbought_cci * 0.85) {
        // Check for excessive slippage risk
        if (checkSlippageRisk(s)) {
          s.signal = 'sell'
          s.reversal_detected = 'bearish_divergence'
        }
      }
    } else {
      s.bearish_divergence = false
    }
    
    // Price making lower low but CCI making higher low = bullish divergence
    let price_lower_low = s.period.low < Math.min(...s.lookback.slice(0, s.options.divergence_lookback).map(p => p.low))
    let cci_higher_low = s.period.cci > Math.min(...s.lookback.slice(0, s.options.divergence_lookback).map(p => p.cci || 0))
    
    if (price_lower_low && cci_higher_low && s.trend === 'down') {
      s.bullish_divergence = true
      // Strengthen buy signals during bullish divergence
      if (s.period.cci <= s.options.oversold_cci * 0.85) {
        s.confirmation_count++
        if (s.confirmation_count >= s.options.confirmation_periods) {
          // Check for excessive slippage risk
          if (checkSlippageRisk(s)) {
            s.signal = 'buy'
            s.confirmation_count = 0
            s.reversal_detected = 'bullish_divergence'
            s.highest_price = s.period.high // Initialize highest price for trailing stop
          }
        }
      }
    } else {
      s.bullish_divergence = false
    }
  }
}

/**
 * Check for excessive slippage risk
 */
function checkSlippageRisk(s, custom_threshold = null) {
  let threshold = custom_threshold || s.options.max_slippage_pct
  
  if (s.period.close && s.lookback[0] && s.lookback[0].close) {
    let price_volatility = Math.abs((s.period.close - s.lookback[0].close) / s.lookback[0].close * 100)
    if (price_volatility <= threshold) {
      return true
    } else {
      s.slippage_avoided = true
      return false
    }
  }
  
  // Default to true if we can't determine
  return true
}

/* Modified for Ultra HFT trend reversal trading - Production Ready */
