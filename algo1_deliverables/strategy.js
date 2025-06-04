/**
 * Algo1 Strategy - Price Action Pattern Recognition System for HFT
 * 
 * This strategy implements a sophisticated price action pattern recognition system
 * based on the analysis of the "Price Action Pattern Recognition System" document.
 * It is designed for high-frequency trading and focuses on identifying specific
 * market patterns that indicate potential reversal points.
 * 
 * Key Features:
 * - Detects three primary price decline patterns: flash crashes, post-stagnation declines, and unsteady declines
 * - Implements dynamic risk management based on market regime analysis
 * - Provides robust error handling and performance optimization for live trading
 * - Includes comprehensive trade statistics tracking and reporting
 * 
 * @version 1.0.0
 * @author Manus AI
 */

// ======================================================================
// CUSTOM INDICATOR IMPLEMENTATIONS
// ======================================================================

/**
 * Custom ATR (Average True Range) implementation with performance optimization and error resilience
 * 
 * @param {Object} s - Strategy state object
 * @param {Number} period - Period for ATR calculation
 * @returns {Number} - Calculated ATR value
 */
function calculateATR(s, period) {
  if (!s.lookback || s.lookback.length < period) return;
  
  try {
    // Performance optimization: Only recalculate if we have new data
    if (s._last_atr_time === s.period.time) {
      return s.period.atr;
    }
    
    // Calculate True Range for current period
    let tr = 0;
    if (s.lookback.length >= 1) {
      const prevClose = s.lookback[0].close;
      const high = s.period.high;
      const low = s.period.low;
      
      // Validate inputs to prevent NaN results
      if (isNaN(high) || isNaN(low) || isNaN(prevClose)) {
        throw new Error('Invalid price data for ATR calculation');
      }
      
      const tr1 = Math.abs(high - low);
      const tr2 = Math.abs(high - prevClose);
      const tr3 = Math.abs(low - prevClose);
      
      tr = Math.max(tr1, tr2, tr3);
    } else {
      tr = s.period.high - s.period.low; // First period
    }
    
    // Validate TR calculation
    if (isNaN(tr) || tr < 0) {
      throw new Error('Invalid TR calculation result');
    }
    
    // Initialize ATR or calculate using EMA
    if (!s.period.atr) {
      s.period.atr = tr;
    } else {
      // Use EMA formula for ATR: ATR = ((period-1) * prevATR + TR) / period
      s.period.atr = ((period - 1) * s.lookback[0].atr + tr) / period;
    }
    
    // Validate final ATR value
    if (isNaN(s.period.atr) || s.period.atr < 0) {
      throw new Error('Invalid ATR calculation result');
    }
    
    // Mark as calculated for this period
    s._last_atr_time = s.period.time;
    
    return s.period.atr;
  } catch (error) {
    // Fallback if calculation fails
    if (s.lookback && s.lookback[0] && s.lookback[0].atr && !isNaN(s.lookback[0].atr)) {
      s.period.atr = s.lookback[0].atr;
    } else if (tr > 0) {
      s.period.atr = tr;
    } else {
      // Last resort fallback - use a small default value
      s.period.atr = (s.period.close || 1) * 0.001; // 0.1% of price as default ATR
    }
    
    trackError(s, 'calculation', 'ATR calculation error: ' + error.message);
    return s.period.atr;
  }
}

/**
 * Custom MACD (Moving Average Convergence Divergence) implementation
 * with performance optimization and error resilience
 * 
 * @param {Object} s - Strategy state object
 * @param {Number} fastPeriod - Fast EMA period
 * @param {Number} slowPeriod - Slow EMA period
 * @param {Number} signalPeriod - Signal line period
 */
function calculateMACD(s, fastPeriod, slowPeriod, signalPeriod) {
  try {
    // Performance optimization: Only recalculate if we have new data
    if (s._last_macd_time === s.period.time) {
      return;
    }
    
    // Validate inputs
    if (isNaN(s.period.close)) {
      throw new Error('Invalid close price for MACD calculation');
    }
    
    // Calculate fast EMA
    if (!s.period.ema_fast) {
      s.period.ema_fast = s.period.close;
    } else if (s.lookback[0] && s.lookback[0].ema_fast) {
      // EMA = Price(t) * k + EMA(y) * (1 – k)
      // where k = 2 / (N + 1)
      const k_fast = 2 / (fastPeriod + 1);
      s.period.ema_fast = s.period.close * k_fast + s.lookback[0].ema_fast * (1 - k_fast);
    }
    
    // Calculate slow EMA
    if (!s.period.ema_slow) {
      s.period.ema_slow = s.period.close;
    } else if (s.lookback[0] && s.lookback[0].ema_slow) {
      const k_slow = 2 / (slowPeriod + 1);
      s.period.ema_slow = s.period.close * k_slow + s.lookback[0].ema_slow * (1 - k_slow);
    }
    
    // Validate EMA calculations
    if (isNaN(s.period.ema_fast) || isNaN(s.period.ema_slow)) {
      throw new Error('Invalid EMA calculation result');
    }
    
    // Calculate MACD line
    if (s.period.ema_fast && s.period.ema_slow) {
      s.period.macd = s.period.ema_fast - s.period.ema_slow;
    }
    
    // Calculate signal line (EMA of MACD)
    if (s.period.macd) {
      if (!s.period.macd_signal) {
        s.period.macd_signal = s.period.macd;
      } else if (s.lookback[0] && s.lookback[0].macd_signal) {
        const k_signal = 2 / (signalPeriod + 1);
        s.period.macd_signal = s.period.macd * k_signal + s.lookback[0].macd_signal * (1 - k_signal);
      }
    }
    
    // Calculate histogram
    if (s.period.macd && s.period.macd_signal) {
      s.period.macd_histogram = s.period.macd - s.period.macd_signal;
    }
    
    // Validate final MACD values
    if (isNaN(s.period.macd) || isNaN(s.period.macd_signal) || isNaN(s.period.macd_histogram)) {
      throw new Error('Invalid MACD calculation result');
    }
    
    // Mark as calculated for this period
    s._last_macd_time = s.period.time;
  } catch (error) {
    // Fallback if calculation fails
    if (s.lookback && s.lookback[0]) {
      s.period.macd = s.lookback[0].macd;
      s.period.macd_signal = s.lookback[0].macd_signal;
      s.period.macd_histogram = s.lookback[0].macd_histogram;
    } else {
      // Initialize with zeros if no previous values
      s.period.macd = 0;
      s.period.macd_signal = 0;
      s.period.macd_histogram = 0;
    }
    
    trackError(s, 'calculation', 'MACD calculation error: ' + error.message);
  }
}

// ======================================================================
// MARKET ANALYSIS FUNCTIONS
// ======================================================================

/**
 * Detects the current market regime (volatility, trend, liquidity)
 * to adapt strategy parameters to changing market conditions
 * 
 * @param {Object} s - Strategy state object
 * @returns {Object} - Market regime object with volatility, trend, and liquidity properties
 */
function detectMarketRegime(s) {
  try {
    // Performance optimization: Only recalculate every few periods
    if (s._last_regime_time === s.period.time || 
        (s._last_regime_time && s.period.time - s._last_regime_time < s.options.regime_update_interval * 60 * 1000)) {
      return s.market_regime;
    }
    
    // Initialize regime if not present
    if (!s.market_regime) {
      s.market_regime = {
        volatility: 'normal', // 'low', 'normal', 'high'
        trend: 'neutral',     // 'bullish', 'bearish', 'neutral'
        liquidity: 'normal'   // 'low', 'normal', 'high'
      };
    }
    
    // Volatility Regime Detection
    if (s.lookback.length >= 20) {
      // Calculate average ATR over the last 20 periods
      let sum_atr = 0;
      let count_atr = 0;
      
      for (let i = 0; i < 20; i++) {
        if (i < s.lookback.length && s.lookback[i].atr && !isNaN(s.lookback[i].atr)) {
          sum_atr += s.lookback[i].atr;
          count_atr++;
        }
      }
      
      if (count_atr > 0) {
        const avg_atr = sum_atr / count_atr;
        
        // Compare current ATR to average
        if (s.period.atr > avg_atr * 1.5) {
          s.market_regime.volatility = 'high';
        } else if (s.period.atr < avg_atr * 0.7) {
          s.market_regime.volatility = 'low';
        } else {
          s.market_regime.volatility = 'normal';
        }
      }
    }
    
    // Trend Regime Detection
    if (s.period.adx && !isNaN(s.period.adx)) {
      if (s.period.adx > 30) {
        // Strong trend
        if (s.period.is_upward) {
          s.market_regime.trend = 'bullish';
        } else if (s.period.is_downward) {
          s.market_regime.trend = 'bearish';
        }
      } else if (s.period.adx < 20) {
        // Weak trend
        s.market_regime.trend = 'neutral';
      }
    }
    
    // Liquidity Regime Detection (using volume as a proxy)
    if (s.lookback.length >= 20 && s.period.volume && !isNaN(s.period.volume)) {
      let sum_volume = 0;
      let count_volume = 0;
      
      for (let i = 0; i < 20; i++) {
        if (i < s.lookback.length && s.lookback[i].volume && !isNaN(s.lookback[i].volume)) {
          sum_volume += s.lookback[i].volume;
          count_volume++;
        }
      }
      
      if (count_volume > 0) {
        const avg_volume = sum_volume / count_volume;
        
        if (s.period.volume > avg_volume * 1.5) {
          s.market_regime.liquidity = 'high';
        } else if (s.period.volume < avg_volume * 0.7) {
          s.market_regime.liquidity = 'low';
        } else {
          s.market_regime.liquidity = 'normal';
        }
      }
    }
    
    // Mark as calculated for this period
    s._last_regime_time = s.period.time;
  } catch (error) {
    // Fallback to default regime if detection fails
    s.market_regime = {
      volatility: 'normal',
      trend: 'neutral',
      liquidity: 'normal'
    };
    trackError(s, 'calculation', 'Market regime detection error: ' + error.message);
  }
  
  return s.market_regime;
}

/**
 * Calculates dynamic risk parameters based on current market regime
 * to adapt position sizing, stop loss, and profit targets
 * 
 * @param {Object} s - Strategy state object
 * @returns {Object} - Dynamic risk parameters
 */
function calculateDynamicRisk(s) {
  try {
    // Performance optimization: Only recalculate if market regime changed
    if (s._last_risk_regime === JSON.stringify(s.market_regime)) {
      return s._cached_dynamic_risk;
    }
    
    // Base risk parameters
    let stop_loss_pct = s.options.stop_loss_pct;
    let profit_target_pct = s.options.profit_target_pct;
    let position_size_pct = s.options.position_size_pct;
    
    // Validate inputs
    if (isNaN(stop_loss_pct) || isNaN(profit_target_pct) || isNaN(position_size_pct)) {
      throw new Error('Invalid risk parameters');
    }
    
    // Adjust based on volatility regime
    if (s.market_regime.volatility === 'high') {
      // Wider stops, higher targets, smaller position sizes in high volatility
      stop_loss_pct *= 1.3;
      profit_target_pct *= 1.5;
      position_size_pct *= 0.7;
    } else if (s.market_regime.volatility === 'low') {
      // Tighter stops, lower targets, larger position sizes in low volatility
      stop_loss_pct *= 0.8;
      profit_target_pct *= 0.8;
      position_size_pct *= 1.2;
    }
    
    // Adjust based on trend regime
    if (s.market_regime.trend === 'bullish' && s.period.is_upward) {
      // More aggressive in aligned trend direction
      profit_target_pct *= 1.2;
      position_size_pct *= 1.1;
    } else if (s.market_regime.trend === 'bearish' && s.period.is_downward) {
      // More aggressive in aligned trend direction
      profit_target_pct *= 1.2;
      position_size_pct *= 1.1;
    } else if (s.market_regime.trend !== 'neutral') {
      // More conservative in counter-trend
      stop_loss_pct *= 0.9;
      position_size_pct *= 0.9;
    }
    
    // Adjust based on liquidity regime
    if (s.market_regime.liquidity === 'low') {
      // More conservative in low liquidity
      position_size_pct *= 0.8;
    }
    
    // Ensure values stay within reasonable bounds
    stop_loss_pct = Math.min(Math.max(stop_loss_pct, 0.5), 5.0);
    profit_target_pct = Math.min(Math.max(profit_target_pct, 1.0), 10.0);
    position_size_pct = Math.min(Math.max(position_size_pct, 5.0), 20.0);
    
    // Validate final values
    if (isNaN(stop_loss_pct) || isNaN(profit_target_pct) || isNaN(position_size_pct)) {
      throw new Error('Invalid calculated risk parameters');
    }
    
    // Cache the results
    s._last_risk_regime = JSON.stringify(s.market_regime);
    s._cached_dynamic_risk = {
      stop_loss_pct: stop_loss_pct,
      profit_target_pct: profit_target_pct,
      position_size_pct: position_size_pct
    };
    
    return s._cached_dynamic_risk;
  } catch (error) {
    // Fallback to default risk parameters if calculation fails
    trackError(s, 'risk_management', 'Dynamic risk calculation error: ' + error.message);
    return {
      stop_loss_pct: s.options.stop_loss_pct,
      profit_target_pct: s.options.profit_target_pct,
      position_size_pct: s.options.position_size_pct
    };
  }
}

/**
 * Detects price action patterns based on the Price Action Pattern Recognition System
 * Identifies flash crashes, recovery attempts, post-stagnation declines, and unsteady declines
 * 
 * @param {Object} s - Strategy state object
 */
function detectPriceActionPatterns(s) {
  try {
    // Performance optimization: Only recalculate if we have new data
    if (s._last_pattern_time === s.period.time) {
      return;
    }
    
    // Flash Crash Detection
    s.period.flash_crash = false;
    if (s.lookback.length >= s.options.flash_crash_duration) {
      // Validate inputs
      if (isNaN(s.period.close) || isNaN(s.lookback[0].close)) {
        throw new Error('Invalid price data for flash crash detection');
      }
      
      let price_change_pct = ((s.period.close - s.lookback[0].close) / s.lookback[0].close) * 100;
      let consecutive_red = 0;
      
      // Count consecutive red candles
      for (let i = 0; i < Math.min(s.options.consecutive_red_candles, s.lookback.length); i++) {
        if (i === 0) {
          // Current candle
          if (s.period.close < s.period.open) {
            consecutive_red++;
          }
        } else if (s.lookback[i-1].close < s.lookback[i-1].open) {
          consecutive_red++;
        } else {
          break;
        }
      }
      
      // Check for volume spike
      let volume_spike = false;
      if (s.period.volume && s.lookback[0].volume && 
          !isNaN(s.period.volume) && !isNaN(s.lookback[0].volume)) {
        volume_spike = s.period.volume > s.lookback[0].volume * 1.5;
      }
      
      // Flash crash criteria: significant price drop + consecutive red candles + (optional) volume spike
      s.period.flash_crash = price_change_pct <= -s.options.flash_crash_pct && 
                            consecutive_red >= s.options.consecutive_red_candles;
      
      // Add volume spike as a bonus factor for confidence calculation
      s.period.has_volume_spike = volume_spike;
      
      // Enhanced flash crash detection - check for acceleration in price decline
      if (s.lookback.length >= 3 && !isNaN(s.lookback[2].close)) {
        let recent_decline = ((s.period.close - s.lookback[0].close) / s.lookback[0].close) * 100;
        let previous_decline = ((s.lookback[0].close - s.lookback[2].close) / s.lookback[2].close) * 100;
        
        // If recent decline is accelerating compared to previous decline, increase confidence
        s.period.accelerating_decline = recent_decline < previous_decline * 1.5;
      }
    }
    
    // Recovery Attempt Detection
    s.period.recovery_attempt = false;
    s.period.failed_recovery = false;
    
    if (s.lookback.length >= 3) {
      // Validate inputs
      if (isNaN(s.period.low) || isNaN(s.lookback[0].low) || isNaN(s.lookback[1].low)) {
        throw new Error('Invalid price data for recovery attempt detection');
      }
      
      let recent_low = Math.min(s.period.low, s.lookback[0].low, s.lookback[1].low);
      let bounce_pct = ((s.period.close - recent_low) / recent_low) * 100;
      
      s.period.recovery_attempt = bounce_pct >= s.options.recovery_threshold;
      
      // Detect failed recovery attempts (bounce followed by new low)
      if (s.lookback.length >= 5) {
        for (let i = 1; i < 4; i++) {
          if (i+1 < s.lookback.length && 
              s.lookback[i].recovery_attempt && 
              s.lookback[i-1].low < s.lookback[i].low) {
            s.period.failed_recovery = true;
            break;
          }
        }
      }
      
      // Enhanced recovery detection - check for volume confirmation
      if (s.period.recovery_attempt && s.period.volume && s.lookback[0].volume && 
          !isNaN(s.period.volume) && !isNaN(s.lookback[0].volume)) {
        s.period.volume_confirmed_recovery = s.period.volume > s.lookback[0].volume * 1.2;
      }
    }
    
    // Post-Stagnation Decline Detection
    s.period.post_stagnation_decline = false;
    if (s.lookback.length >= 5) {
      let had_stagnation = false;
      let stagnation_end_idx = -1;
      
      // Find the end of the most recent stagnation period
      for (let i = 1; i < 5; i++) {
        if (i < s.lookback.length && s.lookback[i].is_stagnation && !s.lookback[i-1].is_stagnation) {
          stagnation_end_idx = i-1;
          had_stagnation = true;
          break;
        }
      }
      
      // Check for decline after stagnation
      if (had_stagnation && stagnation_end_idx >= 0) {
        // Validate inputs
        if (isNaN(s.period.close) || isNaN(s.lookback[stagnation_end_idx].close)) {
          throw new Error('Invalid price data for post-stagnation decline detection');
        }
        
        let decline_pct = ((s.period.close - s.lookback[stagnation_end_idx].close) / s.lookback[stagnation_end_idx].close) * 100;
        s.period.post_stagnation_decline = decline_pct <= -5.0;
        
        // Enhanced stagnation detection - check for volume breakout
        if (s.period.post_stagnation_decline && s.period.volume && 
            s.lookback[stagnation_end_idx].volume && 
            !isNaN(s.period.volume) && !isNaN(s.lookback[stagnation_end_idx].volume)) {
          s.period.stagnation_volume_breakout = s.period.volume > s.lookback[stagnation_end_idx].volume * 1.5;
        }
      }
    }
    
    // Unsteady Long Lasting Decline Pattern (from Price Action PDF)
    s.period.unsteady_decline = false;
    if (s.lookback.length >= 24) { // Check for 2-5 hour decline (assuming 5m candles)
      // Validate inputs
      if (isNaN(s.period.close) || isNaN(s.lookback[24].close)) {
        throw new Error('Invalid price data for unsteady decline detection');
      }
      
      let start_idx = 24; // 2 hours (24 5-min candles)
      let decline_pct = ((s.period.close - s.lookback[start_idx].close) / s.lookback[start_idx].close) * 100;
      
      // Check for overall decline of around 5%
      if (decline_pct <= -4.5 && decline_pct >= -5.5) {
        // Check for unsteady nature (mix of up and down candles)
        let up_candles = 0;
        let down_candles = 0;
        
        for (let i = 0; i < start_idx; i++) {
          if (i < s.lookback.length) {
            if (i === 0) {
              // Current candle
              if (s.period.close > s.period.open) {
                up_candles++;
              } else {
                down_candles++;
              }
            } else {
              if (s.lookback[i-1].close > s.lookback[i-1].open) {
                up_candles++;
              } else {
                down_candles++;
              }
            }
          }
        }
        
        // Unsteady decline has a mix of up and down candles (not all down)
        s.period.unsteady_decline = down_candles > up_candles && up_candles >= start_idx * 0.3;
      }
    }
    
    // Mark as calculated for this period
    s._last_pattern_time = s.period.time;
  } catch (error) {
    // Fallback if pattern detection fails
    trackError(s, 'pattern_detection', 'Pattern detection error: ' + error.message);
    
    // Maintain previous pattern states if available
    if (s.lookback && s.lookback[0]) {
      s.period.flash_crash = s.lookback[0].flash_crash || false;
      s.period.recovery_attempt = s.lookback[0].recovery_attempt || false;
      s.period.post_stagnation_decline = s.lookback[0].post_stagnation_decline || false;
      s.period.unsteady_decline = s.lookback[0].unsteady_decline || false;
    } else {
      // Initialize with defaults if no previous values
      s.period.flash_crash = false;
      s.period.recovery_attempt = false;
      s.period.post_stagnation_decline = false;
      s.period.unsteady_decline = false;
    }
  }
}

/**
 * Calculates confidence scores for detected price action patterns
 * to determine which patterns are most reliable for trading
 * 
 * @param {Object} s - Strategy state object
 */
function calculatePatternConfidence(s) {
  try {
    // Performance optimization: Only recalculate if patterns changed
    if (s._last_confidence_time === s.period.time) {
      return;
    }
    
    // Pattern Confidence Scoring (1-10 scale)
    s.period.pattern_confidence = 0;
    
    // Flash Crash Pattern Confidence
    if (s.period.flash_crash) {
      let flash_crash_score = 0;
      
      // Price decline magnitude
      if (!isNaN(s.period.close) && !isNaN(s.lookback[0].close)) {
        let decline_pct = ((s.period.close - s.lookback[0].close) / s.lookback[0].close) * 100;
        flash_crash_score += Math.min(4, Math.abs(decline_pct) / s.options.flash_crash_pct * 4);
      }
      
      // Volume confirmation
      if (s.period.has_volume_spike) {
        flash_crash_score += 2;
      }
      
      // Volatility confirmation
      if (!isNaN(s.period.atr) && !isNaN(s.lookback[0].atr) && s.period.atr > s.lookback[0].atr * 1.2) {
        flash_crash_score += 1;
      }
      
      // RSI confirmation
      if (!isNaN(s.period.rsi) && s.period.rsi < 30) {
        flash_crash_score += 1;
      }
      
      // MACD confirmation
      if (!isNaN(s.period.macd_histogram) && !isNaN(s.lookback[0].macd_histogram) && 
          s.period.macd_histogram < 0 && s.period.macd_histogram < s.lookback[0].macd_histogram) {
        flash_crash_score += 1;
      }
      
      // ADX confirmation (strong trend)
      if (!isNaN(s.period.adx) && s.period.adx > 30) {
        flash_crash_score += 1;
      }
      
      // Accelerating decline confirmation
      if (s.period.accelerating_decline) {
        flash_crash_score += 1;
      }
      
      // Market regime adjustment
      if (s.market_regime.volatility === 'high' && s.market_regime.trend === 'bearish') {
        flash_crash_score += 1; // Ideal conditions for flash crash
      } else if (s.market_regime.volatility === 'low') {
        flash_crash_score -= 1; // Less likely in low volatility
      }
      
      s.period.pattern_confidence = Math.min(10, Math.max(0, flash_crash_score));
    }
    
    // Post-Stagnation Decline Pattern Confidence
    if (s.period.post_stagnation_decline) {
      let stagnation_score = 5;
      
      // Failed recovery attempts increase confidence
      if (s.period.failed_recovery) {
        stagnation_score += 2;
      }
      
      // BB width confirmation (narrow BBs during stagnation)
      if (s.lookback.length >= 3) {
        let avg_bb_width = 0;
        let count = 0;
        for (let i = 0; i < 3; i++) {
          if (i < s.lookback.length && s.lookback[i].bb_width && !isNaN(s.lookback[i].bb_width)) {
            avg_bb_width += s.lookback[i].bb_width;
            count++;
          }
        }
        if (count > 0) {
          avg_bb_width /= count;
          if (avg_bb_width < s.options.stagnation_threshold) {
            stagnation_score += 1;
          }
        }
      }
      
      // ADX confirmation (weak trend during stagnation, stronger after)
      if (!isNaN(s.period.adx) && s.lookback.length >= 3 && !isNaN(s.lookback[2].adx) && 
          s.period.adx > 25 && s.lookback[2].adx < 20) {
        stagnation_score += 1;
      }
      
      // Volume increase after stagnation
      if (s.period.stagnation_volume_breakout) {
        stagnation_score += 2;
      } else if (!isNaN(s.period.volume) && s.lookback.length >= 3 && !isNaN(s.lookback[2].volume)) {
        if (s.period.volume > s.lookback[2].volume * 1.3) {
          stagnation_score += 1;
        }
      }
      
      // Market regime adjustment
      if (s.market_regime.volatility === 'low' && s.market_regime.trend === 'neutral') {
        stagnation_score += 1; // Ideal conditions for stagnation pattern
      } else if (s.market_regime.volatility === 'high') {
        stagnation_score -= 1; // Less reliable in high volatility
      }
      
      s.period.pattern_confidence = Math.max(s.period.pattern_confidence, Math.min(10, Math.max(0, stagnation_score)));
    }
    
    // Unsteady Long Lasting Decline Pattern Confidence
    if (s.period.unsteady_decline) {
      let unsteady_score = 5;
      
      // Check for RSI divergence (price making lower lows but RSI making higher lows)
      if (s.lookback.length >= 12 && !isNaN(s.period.rsi) && !isNaN(s.lookback[12].rsi) && 
          !isNaN(s.period.close) && !isNaN(s.lookback[12].close)) {
        let price_change = ((s.period.close - s.lookback[12].close) / s.lookback[12].close) * 100;
        let rsi_change = s.period.rsi - s.lookback[12].rsi;
        
        if (price_change < 0 && rsi_change > 0) {
          unsteady_score += 2; // Bullish divergence
        }
      }
      
      // Check for decreasing volume during decline (exhaustion)
      if (s.lookback.length >= 12 && !isNaN(s.period.volume) && !isNaN(s.lookback[12].volume)) {
        if (s.period.volume < s.lookback[12].volume * 0.8) {
          unsteady_score += 1;
        }
      }
      
      // Check for narrowing Bollinger Bands (potential reversal)
      if (s.lookback.length >= 6 && !isNaN(s.period.bb_width) && !isNaN(s.lookback[6].bb_width)) {
        if (s.period.bb_width < s.lookback[6].bb_width * 0.9) {
          unsteady_score += 1;
        }
      }
      
      // Market regime adjustment
      if (s.market_regime.volatility === 'normal' && s.market_regime.trend === 'bearish') {
        unsteady_score += 1; // Ideal conditions for unsteady decline
      }
      
      s.period.pattern_confidence = Math.max(s.period.pattern_confidence, Math.min(10, Math.max(0, unsteady_score)));
    }
    
    // Mark as calculated for this period
    s._last_confidence_time = s.period.time;
  } catch (error) {
    // Fallback if confidence calculation fails
    trackError(s, 'pattern_detection', 'Pattern confidence calculation error: ' + error.message);
    
    // Use previous confidence if available
    if (s.lookback && s.lookback[0] && s.lookback[0].pattern_confidence && !isNaN(s.lookback[0].pattern_confidence)) {
      s.period.pattern_confidence = s.lookback[0].pattern_confidence;
    } else {
      s.period.pattern_confidence = 0;
    }
  }
}

// ======================================================================
// SYSTEM MANAGEMENT FUNCTIONS
// ======================================================================

/**
 * Performs memory cleanup to prevent memory leaks during long-running sessions
 * 
 * @param {Object} s - Strategy state object
 */
function cleanupMemory(s) {
  try {
    // Only run cleanup periodically to avoid overhead
    if (!s._last_cleanup_time || s.period.time - s._last_cleanup_time > 3600000) { // 1 hour
      // Reset calculation caches that are no longer needed
      if (s._calculation_caches && s._calculation_caches.length > 100) {
        s._calculation_caches = s._calculation_caches.slice(-50); // Keep only the most recent 50 entries
      }
      
      // Clean up any large temporary data structures
      if (s._temp_data) {
        s._temp_data = {};
      }
      
      // Reset error counters periodically
      if (s.error_stats) {
        s.error_stats.calculation_errors = 0;
        s.error_stats.pattern_detection_errors = 0;
        s.error_stats.risk_management_errors = 0;
      }
      
      s._last_cleanup_time = s.period.time;
      
      if (s.options.debug) {
        console.log('Memory cleanup performed at ' + new Date(s.period.time).toISOString());
      }
    }
  } catch (error) {
    if (s.options.debug) console.error('Memory cleanup error:', error.message);
  }
}

/**
 * Determines whether to skip calculations in fast execution mode
 * to improve performance during backtesting
 * 
 * @param {Object} s - Strategy state object
 * @returns {Boolean} - Whether to skip calculations
 */
function shouldSkipCalculation(s) {
  if (!s.options.fast_execution) return false;
  
  // Skip calculations based on skip_ticks setting
  if (s.options.calculation_skip_ticks > 0) {
    if (!s.skip_tick_counter) s.skip_tick_counter = 0;
    
    s.skip_tick_counter++;
    if (s.skip_tick_counter < s.options.calculation_skip_ticks) {
      return true;
    } else {
      s.skip_tick_counter = 0;
      return false;
    }
  }
  
  return false;
}

/**
 * Initializes strategy state variables
 * 
 * @param {Object} s - Strategy state object
 */
function initializeState(s) {
  if (!s._algo1_initialized) {
    // Initialize state tracking variables
    s.open_positions = 0;
    s.in_position = false;
    s.flash_crash_entry = false;
    s.stagnation_entry = false;
    s.unsteady_decline_entry = false;
    s.trailing_stop_active = false;
    
    // Initialize performance optimization caches
    s._last_atr_time = null;
    s._last_macd_time = null;
    s._last_regime_time = null;
    s._last_pattern_time = null;
    s._last_confidence_time = null;
    s._last_cleanup_time = null;
    s._last_risk_regime = null;
    s._cached_dynamic_risk = null;
    s._calculation_caches = [];
    s._temp_data = {};
    
    // Initialize daily trade tracking
    s.daily_trades = {
      count: 0,
      date: new Date().toDateString()
    };
    
    // Initialize market regime
    s.market_regime = {
      volatility: 'normal',
      trend: 'neutral',
      liquidity: 'normal'
    };
    
    // Initialize trade statistics
    s.trade_stats = {
      total_trades: 0,
      winning_trades: 0,
      losing_trades: 0,
      total_profit_pct: 0,
      max_drawdown: 0,
      avg_trade_duration: 0
    };
    
    // Initialize error tracking
    s.error_stats = {
      calculation_errors: 0,
      pattern_detection_errors: 0,
      risk_management_errors: 0,
      last_error_time: null,
      last_error_message: null
    };
    
    // Mark as initialized
    s._algo1_initialized = true;
    
    if (s.options.debug) {
      console.log('Algo1 strategy initialized at ' + new Date().toISOString());
    }
  }
}

/**
 * Updates trade statistics for performance tracking and reporting
 * 
 * @param {Object} s - Strategy state object
 * @param {Boolean} is_win - Whether the trade was profitable
 * @param {Number} profit_pct - Profit percentage
 * @param {Number} duration_ms - Trade duration in milliseconds
 */
function updateTradeStats(s, is_win, profit_pct, duration_ms) {
  if (!s.trade_stats) {
    s.trade_stats = {
      total_trades: 0,
      winning_trades: 0,
      losing_trades: 0,
      total_profit_pct: 0,
      max_drawdown: 0,
      avg_trade_duration: 0
    };
  }
  
  s.trade_stats.total_trades++;
  
  if (is_win) {
    s.trade_stats.winning_trades++;
  } else {
    s.trade_stats.losing_trades++;
  }
  
  s.trade_stats.total_profit_pct += profit_pct;
  
  // Update max drawdown if this is a loss
  if (!is_win && -profit_pct > s.trade_stats.max_drawdown) {
    s.trade_stats.max_drawdown = -profit_pct;
  }
  
  // Update average trade duration
  const total_duration = s.trade_stats.avg_trade_duration * (s.trade_stats.total_trades - 1) + duration_ms;
  s.trade_stats.avg_trade_duration = total_duration / s.trade_stats.total_trades;
  
  // Log trade statistics periodically
  if (s.trade_stats.total_trades % 10 === 0 && (s.options.mode !== 'sim' || s.options.verbose)) {
    const win_rate = (s.trade_stats.winning_trades / s.trade_stats.total_trades) * 100;
    const avg_profit = s.trade_stats.total_profit_pct / s.trade_stats.total_trades;
    
    console.log('\nTrade Statistics:');
    console.log('Total Trades: ' + s.trade_stats.total_trades);
    console.log('Win Rate: ' + win_rate.toFixed(2) + '%');
    console.log('Average Profit: ' + avg_profit.toFixed(2) + '%');
    console.log('Max Drawdown: ' + s.trade_stats.max_drawdown.toFixed(2) + '%');
    console.log('Average Duration: ' + (s.trade_stats.avg_trade_duration / (60 * 1000)).toFixed(2) + ' minutes\n');
  }
}

/**
 * Tracks errors for monitoring and automatic trading pause
 * 
 * @param {Object} s - Strategy state object
 * @param {String} error_type - Type of error (calculation, pattern_detection, risk_management)
 * @param {String} error_message - Error message
 */
function trackError(s, error_type, error_message) {
  if (!s.error_stats) {
    s.error_stats = {
      calculation_errors: 0,
      pattern_detection_errors: 0,
      risk_management_errors: 0,
      last_error_time: null,
      last_error_message: null
    };
  }
  
  // Increment appropriate error counter
  if (error_type === 'calculation') {
    s.error_stats.calculation_errors++;
  } else if (error_type === 'pattern_detection') {
    s.error_stats.pattern_detection_errors++;
  } else if (error_type === 'risk_management') {
    s.error_stats.risk_management_errors++;
  }
  
  // Update last error info
  s.error_stats.last_error_time = new Date().getTime();
  s.error_stats.last_error_message = error_message;
  
  // Log error if debugging is enabled
  if (s.options.debug) {
    console.error('Algo1 ' + error_type + ' error: ' + error_message);
  }
  
  // If too many errors occur in a short time, consider disabling trading temporarily
  if (s.options.auto_pause_on_errors) {
    const recent_errors = s.error_stats.calculation_errors + 
                         s.error_stats.pattern_detection_errors + 
                         s.error_stats.risk_management_errors;
    
    if (recent_errors > 10 && !s._trading_paused) {
      s._trading_paused = true;
      s._trading_pause_until = new Date().getTime() + 15 * 60 * 1000; // Pause for 15 minutes
      
      if (s.options.debug || s.options.verbose) {
        console.error('Too many errors detected, trading paused for 15 minutes');
      }
    }
  }
}

/**
 * Checks if trading should be paused due to excessive errors
 * 
 * @param {Object} s - Strategy state object
 * @returns {Boolean} - Whether trading is currently paused
 */
function isTradingPaused(s) {
  if (s._trading_paused) {
    if (new Date().getTime() > s._trading_pause_until) {
      // Resume trading after pause period
      s._trading_paused = false;
      
      // Reset error counters
      if (s.error_stats) {
        s.error_stats.calculation_errors = 0;
        s.error_stats.pattern_detection_errors = 0;
        s.error_stats.risk_management_errors = 0;
      }
      
      if (s.options.debug || s.options.verbose) {
        console.log('Trading resumed after error-induced pause');
      }
      
      return false;
    }
    return true;
  }
  return false;
}

/**
 * Validates price data to prevent errors in calculations
 * 
 * @param {Object} s - Strategy state object
 * @returns {Boolean} - Whether price data is valid
 */
function validatePriceData(s) {
  try {
    // Check for invalid price data
    if (isNaN(s.period.close) || isNaN(s.period.open) || isNaN(s.period.high) || isNaN(s.period.low)) {
      trackError(s, 'calculation', 'Invalid price data detected');
      return false;
    }
    
    // Check for zero or negative prices
    if (s.period.close <= 0 || s.period.open <= 0 || s.period.high <= 0 || s.period.low <= 0) {
      trackError(s, 'calculation', 'Zero or negative price data detected');
      return false;
    }
    
    // Check for high-low relationship
    if (s.period.high < s.period.low) {
      trackError(s, 'calculation', 'High price less than low price');
      return false;
    }
    
    // Check for extreme price movements (potential data errors)
    if (s.lookback && s.lookback.length > 0 && !isNaN(s.lookback[0].close)) {
      const price_change_pct = Math.abs((s.period.close - s.lookback[0].close) / s.lookback[0].close) * 100;
      if (price_change_pct > 50) { // 50% change in one period is suspicious
        trackError(s, 'calculation', 'Extreme price movement detected: ' + price_change_pct.toFixed(2) + '%');
        return false;
      }
    }
    
    return true;
  } catch (error) {
    trackError(s, 'calculation', 'Price data validation error: ' + error.message);
    return false;
  }
}

// ======================================================================
// ZENBOT INTEGRATION
// ======================================================================

var z = require('zero-fill')
  , n = require('numbro')
  , ema = require('../../../lib/ema')
  , rsi = require('../../../lib/rsi')
  , stddev = require('../../../lib/stddev')
  , Phenotypes = require('../../../lib/phenotype')
  , bollingerBands = require('../../../lib/bollinger')
  , adx = require('../../../lib/adx')

module.exports = {
  name: 'algo1',
  description: 'Price Action Pattern Recognition System for HFT - Detects directional movements, flash crashes, and stagnation patterns',
  
  getOptions: function () {
    this.option('period', 'period length, same as --period_length', String, '5m')
    this.option('period_length', 'period length, same as --period', String, '5m')
    this.option('min_periods', 'min. number of history periods', Number, 52)
    
    // Directional Movement Detection
    this.option('adx_period', 'period for ADX calculation', Number, 14)
    this.option('adx_threshold', 'ADX threshold for trend strength', Number, 25)
    this.option('ema_short', 'short EMA period', Number, 5)
    this.option('ema_medium', 'medium EMA period', Number, 8)
    this.option('ema_long', 'long EMA period', Number, 13)
    
    // Volatility Measurement
    this.option('bb_period', 'period for Bollinger Bands', Number, 20)
    this.option('bb_stddev', 'standard deviation for Bollinger Bands', Number, 2)
    this.option('atr_period', 'period for ATR calculation', Number, 14)
    
    // MACD Parameters
    this.option('macd_fast', 'MACD fast period', Number, 12)
    this.option('macd_slow', 'MACD slow period', Number, 26)
    this.option('macd_signal', 'MACD signal period', Number, 9)
    
    // Pattern Detection
    this.option('flash_crash_pct', 'percentage decline to identify flash crash', Number, 2.5)
    this.option('flash_crash_duration', 'max candles to consider for flash crash', Number, 3)
    this.option('stagnation_threshold', 'BB width threshold for stagnation', Number, 0.1)
    this.option('recovery_threshold', 'minimum percentage for recovery attempt', Number, 0.5)
    this.option('consecutive_red_candles', 'number of consecutive red candles for flash crash', Number, 3)
    
    // Risk Management
    this.option('pattern_confidence_threshold', 'minimum confidence score to trade pattern', Number, 6)
    this.option('stop_loss_pct', 'stop loss percentage', Number, 1.5)
    this.option('profit_target_pct', 'profit target percentage', Number, 2.0)
    this.option('max_drawdown_pct', 'maximum drawdown percentage', Number, 5)
    this.option('trailing_stop_pct', 'trailing stop percentage once in profit', Number, 1.0)
    this.option('trailing_stop_activation_pct', 'profit percentage to activate trailing stop', Number, 1.0)
    
    // Position Sizing
    this.option('position_size_pct', 'percentage of available capital to use per trade', Number, 10)
    this.option('max_open_positions', 'maximum number of open positions', Number, 1)
    this.option('max_daily_trades', 'maximum number of trades per day', Number, 5)
    
    // Market Regime Filters
    this.option('enable_regime_filter', 'enable market regime-based filtering', Boolean, true)
    this.option('min_adx_for_trend', 'minimum ADX value to consider a trend valid', Number, 20)
    this.option('max_volatility_multiplier', 'maximum volatility multiplier for entry', Number, 2.0)
    this.option('regime_update_interval', 'minutes between market regime updates', Number, 15)
    
    // RSI for oversold conditions
    this.option('oversold_rsi_periods', 'number of periods for oversold RSI', Number, 14)
    this.option('oversold_rsi', 'buy when RSI reaches this value', Number, 30)
    
    // Time-based filters
    this.option('enable_time_filter', 'enable time-based filtering', Boolean, false)
    this.option('trading_hours_only', 'only trade during specified hours', Boolean, false)
    this.option('trading_hours_start', 'trading hours start (0-23)', Number, 8)
    this.option('trading_hours_end', 'trading hours end (0-23)', Number, 20)
    
    // Performance and Debugging
    this.option('debug', 'enable debugging output', Boolean, false)
    this.option('backtesting_mode', 'optimize for backtesting performance', Boolean, false)
    this.option('fast_execution', 'enable fast execution mode for live trading', Boolean, false)
    this.option('calculation_skip_ticks', 'number of ticks to skip calculations in fast mode', Number, 0)
    this.option('log_trades', 'log detailed trade information', Boolean, true)
    this.option('save_trade_history', 'save trade history to file', Boolean, false)
    this.option('trade_history_file', 'file path for trade history', String, 'algo1_trade_history.json')
    
    // Error Handling
    this.option('error_resilience', 'enable enhanced error resilience', Boolean, true)
    this.option('auto_pause_on_errors', 'automatically pause trading on excessive errors', Boolean, true)
    this.option('validate_price_data', 'validate price data before calculations', Boolean, true)
  },
  
  calculate: function(s) {
    // Initialize strategy state if needed
    initializeState(s);
    
    // Skip calculations in fast execution mode if appropriate
    if (s.options.backtesting_mode && shouldSkipCalculation(s)) {
      return;
    }
    
    // Check if trading is paused due to errors
    if (isTradingPaused(s)) {
      return;
    }
    
    // Validate price data if enabled
    if (s.options.validate_price_data && !validatePriceData(s)) {
      return;
    }
    
    try {
      // Calculate core indicators
      ema(s, 'ema_short', s.options.ema_short)
      ema(s, 'ema_medium', s.options.ema_medium)
      ema(s, 'ema_long', s.options.ema_long)
      
      bollingerBands(s, 'bb', s.options.bb_period, s.options.bb_stddev)
      calculateATR(s, s.options.atr_period) // Use our custom ATR implementation
      calculateMACD(s, s.options.macd_fast, s.options.macd_slow, s.options.macd_signal) // Use our custom MACD implementation
      adx(s, s.options.adx_period)
      rsi(s, 'rsi', s.options.oversold_rsi_periods)
      
      // Detect market regime
      detectMarketRegime(s)
      
      // Calculate BB width for stagnation detection
      if (s.period.bb) {
        s.period.bb_width = (s.period.bb.upper - s.period.bb.lower) / s.period.bb.middle
      }
      
      // Directional Movement Classification
      if (s.period.adx && s.period.ema_short && s.period.ema_medium && s.period.ema_long) {
        // Sideways/Stagnation (→) detection
        s.period.is_stagnation = s.period.adx < 20 && s.period.bb_width < s.options.stagnation_threshold
        
        // Upward Movement (↗) detection
        s.period.is_upward = s.period.ema_short > s.period.ema_medium && 
                             s.period.ema_medium > s.period.ema_long && 
                             s.period.adx > s.options.adx_threshold
        
        // Downward Movement (↘) detection
        s.period.is_downward = s.period.ema_short < s.period.ema_medium && 
                               s.period.ema_medium < s.period.ema_long && 
                               s.period.adx > s.options.adx_threshold
      }
      
      // Detect price action patterns
      detectPriceActionPatterns(s)
      
      // Calculate pattern confidence scores
      calculatePatternConfidence(s)
      
      // Time-based filtering
      s.period.trading_allowed = true;
      if (s.options.enable_time_filter && s.options.trading_hours_only) {
        const date = new Date();
        const hour = date.getUTCHours();
        
        if (hour < s.options.trading_hours_start || hour >= s.options.trading_hours_end) {
          s.period.trading_allowed = false;
        }
      }
      
      // Daily trade limit check
      if (!s.daily_trades) {
        s.daily_trades = {
          count: 0,
          date: new Date().toDateString()
        };
      }
      
      // Reset daily trade counter if it's a new day
      const current_date = new Date().toDateString();
      if (s.daily_trades.date !== current_date) {
        s.daily_trades = {
          count: 0,
          date: current_date
        };
      }
      
      s.period.daily_trade_limit_reached = s.daily_trades.count >= s.options.max_daily_trades;
      
      // Initialize or update trailing stop if in position
      if (s.in_position && !s.trailing_stop_active && s.period.close > s.entry_price * (1 + s.options.trailing_stop_activation_pct/100)) {
        s.trailing_stop_active = true;
        s.trailing_stop = s.period.close * (1 - s.options.trailing_stop_pct/100);
        
        if (s.options.log_trades && (s.options.mode !== 'sim' || s.options.verbose)) {
          console.log(('\nTrailing stop activated at ' + n(s.trailing_stop).format('0.00000000') + 
                      ' (' + s.options.trailing_stop_pct + '% below ' + n(s.period.close).format('0.00000000') + ')\n').cyan);
        }
      }
      
      // Update trailing stop if active and price moves higher
      if (s.trailing_stop_active && s.period.close > s.trailing_stop * (1 + s.options.trailing_stop_pct/100)) {
        const old_stop = s.trailing_stop;
        s.trailing_stop = s.period.close * (1 - s.options.trailing_stop_pct/100);
        
        if (s.options.log_trades && s.options.debug && (s.options.mode !== 'sim' || s.options.verbose)) {
          console.log(('\nTrailing stop raised from ' + n(old_stop).format('0.00000000') + 
                      ' to ' + n(s.trailing_stop).format('0.00000000') + '\n').cyan);
        }
      }
      
      // Calculate dynamic risk parameters based on market regime
      s.period.dynamic_risk = calculateDynamicRisk(s);
      
      // Perform memory cleanup periodically
      cleanupMemory(s);
      
    } catch (error) {
      trackError(s, 'calculation', error.message);
      
      // Ensure critical values are set to prevent crashes
      if (!s.period.pattern_confidence) s.period.pattern_confidence = 0;
      if (!s.market_regime) {
        s.market_regime = {
          volatility: 'normal',
          trend: 'neutral',
          liquidity: 'normal'
        };
      }
    }
  },
  
  onPeriod: function (s, cb) {
    try {
      // Initialize state if needed
      initializeState(s);
      
      // Check if trading is paused due to errors
      if (isTradingPaused(s)) {
        s.signal = null;
        return cb();
      }
      
      // Entry logic
      if (!s.in_position && s.open_positions < s.options.max_open_positions && 
          s.period.trading_allowed && !s.period.daily_trade_limit_reached) {
        // Get dynamic risk parameters
        const dynamic_risk = s.period.dynamic_risk || {
          stop_loss_pct: s.options.stop_loss_pct,
          profit_target_pct: s.options.profit_target_pct,
          position_size_pct: s.options.position_size_pct
        };
        
        // Market regime filter
        let regime_allows_entry = true;
        if (s.options.enable_regime_filter) {
          // Don't enter in extremely high volatility
          if (s.market_regime.volatility === 'high' && s.period.atr > s.lookback[0].atr * s.options.max_volatility_multiplier) {
            regime_allows_entry = false;
          }
          
          // Don't enter in counter-trend moves unless it's a strong pattern
          if ((s.market_regime.trend === 'bullish' && s.period.is_downward) || 
              (s.market_regime.trend === 'bearish' && s.period.is_upward)) {
            // Only allow if pattern confidence is very high
            regime_allows_entry = s.period.pattern_confidence >= 8;
          }
          
          // Don't enter in low liquidity unless it's a very strong pattern
          if (s.market_regime.liquidity === 'low') {
            regime_allows_entry = s.period.pattern_confidence >= 9;
          }
        }
        
        // Flash Crash Entry
        if (regime_allows_entry && s.period.flash_crash && s.period.pattern_confidence >= s.options.pattern_confidence_threshold) {
          s.signal = 'buy';
          s.flash_crash_entry = true;
          s.stagnation_entry = false;
          s.unsteady_decline_entry = false;
          s.entry_price = s.period.close;
          s.entry_time = new Date().getTime();
          s.open_positions++;
          s.daily_trades.count++;
          
          // Set stop loss and profit targets using dynamic risk parameters
          s.stop = s.period.close * (1 - (dynamic_risk.stop_loss_pct / 100));
          s.profit_target = s.period.close * (1 + (dynamic_risk.profit_target_pct / 100));
          s.trailing_stop_active = false;
          
          // Calculate position size based on risk
          s.position_size = s.balance * (dynamic_risk.position_size_pct / 100);
          
          if (s.options.log_trades && (s.options.mode !== 'sim' || s.options.verbose)) {
            console.log(('\nFlash Crash pattern detected with confidence ' + s.period.pattern_confidence + 
                        ', buying at ' + n(s.period.close).format('0.00000000') + 
                        ' with stop at ' + n(s.stop).format('0.00000000') + 
                        ' and position size ' + n(s.position_size).format('0.00000000') + 
                        ' [Regime: ' + s.market_regime.volatility + '/' + s.market_regime.trend + ']\n').cyan);
          }
        }
        // Post-Stagnation Entry
        else if (regime_allows_entry && s.period.post_stagnation_decline && s.period.recovery_attempt && 
                 s.period.pattern_confidence >= s.options.pattern_confidence_threshold) {
          s.signal = 'buy';
          s.flash_crash_entry = false;
          s.stagnation_entry = true;
          s.unsteady_decline_entry = false;
          s.entry_price = s.period.close;
          s.entry_time = new Date().getTime();
          s.open_positions++;
          s.daily_trades.count++;
          
          // Set stop loss and profit targets using dynamic risk parameters
          s.stop = s.period.close * (1 - (dynamic_risk.stop_loss_pct * 1.2 / 100));
          s.profit_target = s.period.close * (1 + (dynamic_risk.profit_target_pct * 0.8 / 100));
          s.trailing_stop_active = false;
          
          // Calculate position size based on risk
          s.position_size = s.balance * (dynamic_risk.position_size_pct / 100);
          
          if (s.options.log_trades && (s.options.mode !== 'sim' || s.options.verbose)) {
            console.log(('\nPost-Stagnation pattern detected with confidence ' + s.period.pattern_confidence + 
                        ', buying at ' + n(s.period.close).format('0.00000000') + 
                        ' with stop at ' + n(s.stop).format('0.00000000') + 
                        ' and position size ' + n(s.position_size).format('0.00000000') + 
                        ' [Regime: ' + s.market_regime.volatility + '/' + s.market_regime.trend + ']\n').cyan);
          }
        }
        // Unsteady Long Lasting Decline Entry
        else if (regime_allows_entry && s.period.unsteady_decline && 
                 s.period.pattern_confidence >= s.options.pattern_confidence_threshold) {
          s.signal = 'buy';
          s.flash_crash_entry = false;
          s.stagnation_entry = false;
          s.unsteady_decline_entry = true;
          s.entry_price = s.period.close;
          s.entry_time = new Date().getTime();
          s.open_positions++;
          s.daily_trades.count++;
          
          // Set stop loss and profit targets using dynamic risk parameters
          s.stop = s.period.close * (1 - (dynamic_risk.stop_loss_pct * 1.1 / 100));
          s.profit_target = s.period.close * (1 + (dynamic_risk.profit_target_pct * 0.9 / 100));
          s.trailing_stop_active = false;
          
          // Calculate position size based on risk
          s.position_size = s.balance * (dynamic_risk.position_size_pct * 0.9 / 100);
          
          if (s.options.log_trades && (s.options.mode !== 'sim' || s.options.verbose)) {
            console.log(('\nUnsteady Decline pattern detected with confidence ' + s.period.pattern_confidence + 
                        ', buying at ' + n(s.period.close).format('0.00000000') + 
                        ' with stop at ' + n(s.stop).format('0.00000000') + 
                        ' and position size ' + n(s.position_size).format('0.00000000') + 
                        ' [Regime: ' + s.market_regime.volatility + '/' + s.market_regime.trend + ']\n').cyan);
          }
        }
        // Oversold RSI Entry (backup signal)
        else if (regime_allows_entry && s.period.rsi <= s.options.oversold_rsi && s.period.is_downward) {
          s.signal = 'buy';
          s.flash_crash_entry = false;
          s.stagnation_entry = false;
          s.unsteady_decline_entry = false;
          s.entry_price = s.period.close;
          s.entry_time = new Date().getTime();
          s.open_positions++;
          s.daily_trades.count++;
          
          // Set standard stop loss and profit targets using dynamic risk parameters
          s.stop = s.period.close * (1 - (dynamic_risk.stop_loss_pct / 100));
          s.profit_target = s.period.close * (1 + (dynamic_risk.profit_target_pct / 100));
          s.trailing_stop_active = false;
          
          // Calculate position size based on risk (smaller for RSI signals)
          s.position_size = s.balance * (dynamic_risk.position_size_pct * 0.7 / 100);
          
          if (s.options.log_trades && (s.options.mode !== 'sim' || s.options.verbose)) {
            console.log(('\nOversold RSI detected at ' + s.period.rsi + 
                        ', buying at ' + n(s.period.close).format('0.00000000') + 
                        ' with stop at ' + n(s.stop).format('0.00000000') + 
                        ' and position size ' + n(s.position_size).format('0.00000000') + 
                        ' [Regime: ' + s.market_regime.volatility + '/' + s.market_regime.trend + ']\n').cyan);
          }
        }
      }
      // Exit logic
      else if (s.in_position) {
        let exit_reason = null;
        let is_win = false;
        let profit_pct = 0;
        
        // Calculate current profit percentage
        if (s.entry_price) {
          profit_pct = ((s.period.close - s.entry_price) / s.entry_price) * 100;
          is_win = profit_pct > 0;
        }
        
        // Stop loss hit
        if (s.period.low <= s.stop) {
          s.signal = 'sell';
          exit_reason = 'Stop loss hit at ' + n(s.stop).format('0.00000000');
          is_win = false;
          profit_pct = -s.options.stop_loss_pct;
        }
        // Trailing stop hit
        else if (s.trailing_stop_active && s.period.low <= s.trailing_stop) {
          s.signal = 'sell';
          exit_reason = 'Trailing stop hit at ' + n(s.trailing_stop).format('0.00000000');
          is_win = profit_pct > 0;
        }
        // Profit target hit
        else if (s.period.high >= s.profit_target) {
          s.signal = 'sell';
          exit_reason = 'Profit target reached at ' + n(s.profit_target).format('0.00000000');
          is_win = true;
          profit_pct = s.options.profit_target_pct;
        }
        // Trend reversal exit
        else if ((s.flash_crash_entry && s.period.is_upward) || 
                 (s.stagnation_entry && s.period.is_downward) ||
                 (s.unsteady_decline_entry && s.period.is_downward && s.period.adx > 30)) {
          s.signal = 'sell';
          exit_reason = 'Trend reversal detected';
          is_win = profit_pct > 0;
        }
        // MACD crossover exit
        else if (s.period.macd_histogram && s.lookback[0] && s.lookback[0].macd_histogram) {
          // Bearish crossover (histogram goes from positive to negative)
          if (s.period.macd_histogram < 0 && s.lookback[0].macd_histogram > 0) {
            s.signal = 'sell';
            exit_reason = 'MACD bearish crossover';
            is_win = profit_pct > 0;
          }
        }
        // Time-based exit (position held too long)
        else if (s.entry_time && new Date().getTime() - s.entry_time > 24 * 60 * 60 * 1000) { // 24 hours
          // Only exit if not in significant profit
          if (s.period.close < s.entry_price * 1.05) {
            s.signal = 'sell';
            exit_reason = 'Position time limit reached';
            is_win = profit_pct > 0;
          }
        }
        // Market regime change exit
        else if (s.options.enable_regime_filter && 
                 s.market_regime.volatility === 'high' && 
                 s.market_regime.trend !== s.prev_market_regime?.trend) {
          // Exit on significant regime change in high volatility
          s.signal = 'sell';
          exit_reason = 'Market regime change detected';
          is_win = profit_pct > 0;
        }
        // Error-induced exit
        else if (s.error_stats && s.error_stats.calculation_errors > 5) {
          // Exit if too many calculation errors occur while in position
          s.signal = 'sell';
          exit_reason = 'Excessive calculation errors detected';
          is_win = profit_pct > 0;
        }
        
        // If we're exiting, update trade statistics
        if (s.signal === 'sell' && s.entry_time) {
          const duration_ms = new Date().getTime() - s.entry_time;
          updateTradeStats(s, is_win, profit_pct, duration_ms);
          
          // Save trade to history if enabled
          if (s.options.save_trade_history) {
            if (!s.trade_history) {
              s.trade_history = [];
            }
            
            s.trade_history.push({
              entry_time: new Date(s.entry_time).toISOString(),
              exit_time: new Date().toISOString(),
              entry_price: s.entry_price,
              exit_price: s.period.close,
              profit_pct: profit_pct,
              duration_ms: duration_ms,
              pattern: s.flash_crash_entry ? 'flash_crash' : 
                      s.stagnation_entry ? 'post_stagnation' : 
                      s.unsteady_decline_entry ? 'unsteady_decline' : 'oversold_rsi',
              confidence: s.entry_confidence || 0,
              exit_reason: exit_reason,
              is_win: is_win,
              market_regime: JSON.stringify(s.market_regime)
            });
            
            // Periodically save trade history to file
            if (s.trade_history.length % 10 === 0) {
              try {
                const fs = require('fs');
                fs.writeFileSync(s.options.trade_history_file, JSON.stringify(s.trade_history, null, 2));
                
                if (s.options.debug) {
                  console.log('Trade history saved to ' + s.options.trade_history_file);
                }
              } catch (error) {
                if (s.options.debug) {
                  console.error('Error saving trade history:', error.message);
                }
              }
            }
          }
        }
        
        // Log exit reason if selling
        if (s.signal === 'sell' && exit_reason && s.options.log_trades && (s.options.mode !== 'sim' || s.options.verbose)) {
          const profit_str = profit_pct > 0 ? 
                            ('+' + profit_pct.toFixed(2) + '%').green : 
                            (profit_pct.toFixed(2) + '%').red;
          
          console.log(('\n' + exit_reason + ', selling at ' + n(s.period.close).format('0.00000000') + 
                      ' with ' + profit_str + ' profit\n').yellow);
        }
      }
      
      // Update position state
      if (s.signal === 'buy') {
        s.in_position = true;
        s.entry_confidence = s.period.pattern_confidence;
      } else if (s.signal === 'sell') {
        s.in_position = false;
        s.flash_crash_entry = false;
        s.stagnation_entry = false;
        s.unsteady_decline_entry = false;
        s.trailing_stop_active = false;
        s.entry_price = null;
        s.entry_time = null;
        s.entry_confidence = null;
        s.open_positions--;
        
        // Ensure open_positions doesn't go negative
        if (s.open_positions < 0) {
          s.open_positions = 0;
        }
      }
      
      // Store current market regime for next period comparison
      s.prev_market_regime = JSON.parse(JSON.stringify(s.market_regime));
      
    } catch (error) {
      trackError(s, 'risk_management', error.message);
      // Ensure we don't leave the callback hanging
      s.signal = null;
    }
    
    cb();
  },
  
  onReport: function(s) {
    try {
      var cols = [];
      
      // Pattern type and confidence
      if (s.period.flash_crash) {
        cols.push('FLASH'.red);
      } else if (s.period.unsteady_decline) {
        cols.push('UNSTDY'.blue);
      } else if (s.period.recovery_attempt) {
        cols.push('RECOV'.green);
      } else if (s.period.post_stagnation_decline) {
        cols.push('PSTAG'.magenta);
      } else if (s.period.is_stagnation) {
        cols.push('STAG'.grey);
      } else if (s.period.is_upward) {
        cols.push('UP'.green);
      } else if (s.period.is_downward) {
        cols.push('DOWN'.red);
      } else {
        cols.push('----'.grey);
      }
      
      // Confidence score
      cols.push(z(4, n(s.period.pattern_confidence).format('0'), ' ').yellow);
      
      // Market regime
      if (s.market_regime) {
        let regime_color = 'grey';
        if (s.market_regime.volatility === 'high') {
          regime_color = 'red';
        } else if (s.market_regime.volatility === 'low') {
          regime_color = 'green';
        }
        
        cols.push(z(4, s.market_regime.volatility.substring(0, 1).toUpperCase() + 
                      s.market_regime.trend.substring(0, 1).toUpperCase(), ' ')[regime_color]);
      }
      
      // ADX and BB width
      if (s.period.adx) {
        cols.push(z(5, n(s.period.adx).format('0.0'), ' ').grey);
      }
      if (s.period.bb_width) {
        cols.push(z(6, n(s.period.bb_width).format('0.000'), ' ').grey);
      }
      
      // RSI
      if (s.period.rsi) {
        cols.push(z(5, n(s.period.rsi).format('0.0'), ' ').grey);
      }
      
      // MACD
      if (s.period.macd) {
        cols.push(z(7, n(s.period.macd).format('0.000'), ' ').grey);
      }
      
      // Position info
      if (s.in_position) {
        cols.push('POS'.green);
        
        // Show stop loss
        if (s.trailing_stop_active) {
          cols.push(z(8, 'T:' + n(s.trailing_stop).format('0.00000000'), ' ').red);
        } else {
          cols.push(z(8, 'S:' + n(s.stop).format('0.00000000'), ' ').red);
        }
        
        // Show profit percentage
        if (s.entry_price) {
          const profit_pct = ((s.period.close - s.entry_price) / s.entry_price) * 100;
          let profit_color = profit_pct >= 0 ? 'green' : 'red';
          cols.push(z(6, n(profit_pct).format('0.00') + '%', ' ')[profit_color]);
        }
      } else {
        cols.push('---'.grey);
      }
      
      // Trading allowed indicator
      if (!s.period.trading_allowed) {
        cols.push('CLOSED'.red);
      }
      
      // Daily trade limit indicator
      if (s.period.daily_trade_limit_reached) {
        cols.push('LIMIT'.red);
      }
      
      // Error status indicator
      if (s._trading_paused) {
        cols.push('PAUSED'.red);
      } else if (s.error_stats && s.error_stats.calculation_errors > 0) {
        cols.push('ERR:' + s.error_stats.calculation_errors);
      }
      
      // Trade statistics
      if (s.trade_stats && s.trade_stats.total_trades > 0) {
        const win_rate = (s.trade_stats.winning_trades / s.trade_stats.total_trades) * 100;
        cols.push(z(6, 'W:' + win_rate.toFixed(1) + '%', ' ')[win_rate >= 50 ? 'green' : 'red']);
      }
      
      return cols;
    } catch (error) {
      if (s.options.debug) {
        console.error('Error in onReport function:', error.message);
      }
      return ['ERROR'.red];
    }
  },
  
  // Zenbot integration - handle strategy initialization
  onStart: function(s) {
    try {
      // Initialize strategy state
      initializeState(s);
      
      if (s.options.debug) {
        console.log('Algo1 strategy started at ' + new Date().toISOString());
      }
      
      // Load trade history if enabled and file exists
      if (s.options.save_trade_history) {
        try {
          const fs = require('fs');
          if (fs.existsSync(s.options.trade_history_file)) {
            const history_data = fs.readFileSync(s.options.trade_history_file, 'utf8');
            s.trade_history = JSON.parse(history_data);
            
            if (s.options.debug) {
              console.log('Loaded ' + s.trade_history.length + ' trade records from history file');
            }
          }
        } catch (error) {
          if (s.options.debug) {
            console.error('Error loading trade history:', error.message);
          }
          // Initialize empty trade history if loading fails
          s.trade_history = [];
        }
      }
    } catch (error) {
      console.error('Error in onStart function:', error.message);
    }
  },
  
  // Zenbot integration - handle strategy cleanup
  onStop: function(s) {
    try {
      // Save trade history if enabled
      if (s.options.save_trade_history && s.trade_history && s.trade_history.length > 0) {
        try {
          const fs = require('fs');
          fs.writeFileSync(s.options.trade_history_file, JSON.stringify(s.trade_history, null, 2));
          
          if (s.options.debug) {
            console.log('Trade history saved to ' + s.options.trade_history_file);
          }
        } catch (error) {
          if (s.options.debug) {
            console.error('Error saving trade history:', error.message);
          }
        }
      }
      
      // Log final trade statistics
      if (s.trade_stats && s.trade_stats.total_trades > 0 && s.options.log_trades) {
        const win_rate = (s.trade_stats.winning_trades / s.trade_stats.total_trades) * 100;
        const avg_profit = s.trade_stats.total_profit_pct / s.trade_stats.total_trades;
        
        console.log('\nFinal Trade Statistics:');
        console.log('Total Trades: ' + s.trade_stats.total_trades);
        console.log('Win Rate: ' + win_rate.toFixed(2) + '%');
        console.log('Average Profit: ' + avg_profit.toFixed(2) + '%');
        console.log('Max Drawdown: ' + s.trade_stats.max_drawdown.toFixed(2) + '%');
        console.log('Average Duration: ' + (s.trade_stats.avg_trade_duration / (60 * 1000)).toFixed(2) + ' minutes\n');
      }
      
      // Log error statistics
      if (s.error_stats && s.options.debug) {
        console.log('\nError Statistics:');
        console.log('Calculation Errors: ' + s.error_stats.calculation_errors);
        console.log('Pattern Detection Errors: ' + s.error_stats.pattern_detection_errors);
        console.log('Risk Management Errors: ' + s.error_stats.risk_management_errors);
        if (s.error_stats.last_error_time) {
          console.log('Last Error: ' + new Date(s.error_stats.last_error_time).toISOString());
          console.log('Last Error Message: ' + s.error_stats.last_error_message);
        }
      }
      
      if (s.options.debug) {
        console.log('Algo1 strategy stopped at ' + new Date().toISOString());
      }
    } catch (error) {
      console.error('Error in onStop function:', error.message);
    }
  },
  
  phenotypes: {
    // -- common
    period_length: Phenotypes.RangePeriod(1, 120, 'm'),
    min_periods: Phenotypes.Range(1, 100),
    markdown_buy_pct: Phenotypes.RangeFloat(-1, 5),
    markup_sell_pct: Phenotypes.RangeFloat(-1, 5),
    order_type: Phenotypes.ListOption(['maker', 'taker']),
    sell_stop_pct: Phenotypes.Range0(1, 50),
    buy_stop_pct: Phenotypes.Range0(1, 50),
    profit_stop_enable_pct: Phenotypes.Range0(1, 20),
    profit_stop_pct: Phenotypes.Range(1, 20),
    
    // -- strategy
    adx_period: Phenotypes.Range(7, 25),
    adx_threshold: Phenotypes.Range(20, 40),
    ema_short: Phenotypes.Range(3, 15),
    ema_medium: Phenotypes.Range(5, 20),
    ema_long: Phenotypes.Range(8, 30),
    bb_period: Phenotypes.Range(10, 30),
    bb_stddev: Phenotypes.Range(1, 4),
    atr_period: Phenotypes.Range(7, 25),
    macd_fast: Phenotypes.Range(8, 16),
    macd_slow: Phenotypes.Range(20, 30),
    macd_signal: Phenotypes.Range(6, 12),
    flash_crash_pct: Phenotypes.RangeFloat(1.0, 5.0),
    flash_crash_duration: Phenotypes.Range(1, 5),
    consecutive_red_candles: Phenotypes.Range(2, 5),
    stagnation_threshold: Phenotypes.RangeFloat(0.05, 0.3),
    recovery_threshold: Phenotypes.RangeFloat(0.3, 1.0),
    pattern_confidence_threshold: Phenotypes.Range(5, 9),
    stop_loss_pct: Phenotypes.RangeFloat(0.5, 3.0),
    profit_target_pct: Phenotypes.RangeFloat(1.0, 5.0),
    max_drawdown_pct: Phenotypes.RangeFloat(3.0, 10.0),
    trailing_stop_pct: Phenotypes.RangeFloat(0.5, 3.0),
    trailing_stop_activation_pct: Phenotypes.RangeFloat(0.5, 3.0),
    position_size_pct: Phenotypes.RangeFloat(5.0, 20.0),
    max_open_positions: Phenotypes.Range(1, 3),
    max_daily_trades: Phenotypes.Range(1, 10),
    enable_regime_filter: Phenotypes.Range(0, 1),
    min_adx_for_trend: Phenotypes.Range(15, 30),
    max_volatility_multiplier: Phenotypes.RangeFloat(1.5, 3.0),
    regime_update_interval: Phenotypes.Range(5, 60),
    enable_time_filter: Phenotypes.Range(0, 1),
    trading_hours_only: Phenotypes.Range(0, 1),
    trading_hours_start: Phenotypes.Range(0, 23),
    trading_hours_end: Phenotypes.Range(0, 23),
    oversold_rsi_periods: Phenotypes.Range(7, 25),
    oversold_rsi: Phenotypes.Range(20, 40),
    debug: Phenotypes.Range(0, 1),
    backtesting_mode: Phenotypes.Range(0, 1),
    fast_execution: Phenotypes.Range(0, 1),
    calculation_skip_ticks: Phenotypes.Range(0, 5),
    log_trades: Phenotypes.Range(0, 1),
    save_trade_history: Phenotypes.Range(0, 1),
    error_resilience: Phenotypes.Range(0, 1),
    auto_pause_on_errors: Phenotypes.Range(0, 1),
    validate_price_data: Phenotypes.Range(0, 1)
  }
}
