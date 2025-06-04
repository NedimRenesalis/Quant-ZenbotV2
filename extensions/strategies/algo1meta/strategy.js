/**
 * Algo1meta Strategy - Meta-Strategy for Price Action Pattern Recognition System
 * 
 * This meta-strategy combines three distinct price action pattern detection approaches:
 * 1. Flash Crash Pattern - Rapid price declines with specific characteristics
 * 2. Post-Stagnation Pattern - Declines following periods of low volatility
 * 3. Unsteady Decline Pattern - Longer-term declines with mixed candle patterns
 * 
 * The strategy runs all three pattern detections in parallel, evaluates their confidence scores
 * and market conditions, then makes intelligent trading decisions based on the combined analysis.
 * 
 * @version 1.4.0
 * @author Manus AI
 */

// ======================================================================
// DEPENDENCIES
// ======================================================================

var z = require("zero-fill");
var n = require("numbro");
var ema = require("../../../lib/ema");
var rsi = require("../../../lib/rsi");
var stddev = require("../../../lib/stddev");
var Phenotypes = require("../../../lib/phenotype");
var bollingerBands = require("../../../lib/bollinger");
var adx = require("../../../lib/adx");

// ======================================================================
// HELPER FUNCTIONS
// ======================================================================

/**
 * Custom ATR (Average True Range) implementation with performance optimization
 * @param {Object} s - Strategy state object
 * @param {Number} period - Period for ATR calculation
 * @returns {Number} - Calculated ATR value
 */
function calculateATR(s, period) {
  if (!s.lookback || s.lookback.length < period) return s.period.atr || 0;
  try {
    // Cache check for performance
    if (s._last_atr_time === s.period.time) return s.period.atr;
    
    let tr = 0;
    const high = s.period.high;
    const low = s.period.low;
    const prevClose = s.lookback[0] ? s.lookback[0].close : s.period.open;
    
    if (isNaN(high) || isNaN(low) || isNaN(prevClose)) throw new Error("Invalid price data for ATR");
    
    tr = Math.max(Math.abs(high - low), Math.abs(high - prevClose), Math.abs(low - prevClose));
    if (isNaN(tr) || tr < 0) throw new Error("Invalid TR result");
    
    const prevATR = s.lookback[0] && !isNaN(s.lookback[0].atr) ? s.lookback[0].atr : tr;
    s.period.atr = ((period - 1) * prevATR + tr) / period;
    
    if (isNaN(s.period.atr) || s.period.atr < 0) throw new Error("Invalid ATR result");
    
    s._last_atr_time = s.period.time;
    return s.period.atr;
  } catch (error) {
    // Fallback logic
    s.period.atr = (s.lookback[0] && s.lookback[0].atr && !isNaN(s.lookback[0].atr)) ? 
                   s.lookback[0].atr : (s.period.close || 1) * 0.001;
    trackError(s, "calculation", "ATR error: " + error.message);
    return s.period.atr;
  }
}

/**
 * Custom MACD (Moving Average Convergence Divergence) implementation
 * @param {Object} s - Strategy state object
 * @param {Number} fastPeriod - Fast EMA period
 * @param {Number} slowPeriod - Slow EMA period
 * @param {Number} signalPeriod - Signal line period
 */
function calculateMACD(s, fastPeriod, slowPeriod, signalPeriod) {
  try {
    // Cache check for performance
    if (s._last_macd_time === s.period.time) return;
    
    if (isNaN(s.period.close)) throw new Error("Invalid close price for MACD");
    
    const prevEmaFast = s.lookback[0] && !isNaN(s.lookback[0].ema_fast) ? s.lookback[0].ema_fast : s.period.close;
    const prevEmaSlow = s.lookback[0] && !isNaN(s.lookback[0].ema_slow) ? s.lookback[0].ema_slow : s.period.close;
    const prevMacdSignal = s.lookback[0] && !isNaN(s.lookback[0].macd_signal) ? s.lookback[0].macd_signal : 0;

    const k_fast = 2 / (fastPeriod + 1);
    s.period.ema_fast = s.period.close * k_fast + prevEmaFast * (1 - k_fast);
    
    const k_slow = 2 / (slowPeriod + 1);
    s.period.ema_slow = s.period.close * k_slow + prevEmaSlow * (1 - k_slow);
    
    if (isNaN(s.period.ema_fast) || isNaN(s.period.ema_slow)) throw new Error("Invalid EMA result");
    
    s.period.macd = s.period.ema_fast - s.period.ema_slow;
    
    if (isNaN(s.period.macd)) throw new Error("Invalid MACD line result");

    const k_signal = 2 / (signalPeriod + 1);
    const currentMacdSignal = (s.lookback[0] && s.lookback[0].macd_signal !== undefined) ? 
                              prevMacdSignal : s.period.macd;
    s.period.macd_signal = s.period.macd * k_signal + currentMacdSignal * (1 - k_signal);
    
    s.period.macd_histogram = s.period.macd - s.period.macd_signal;

    s._last_macd_time = s.period.time;
  } catch (error) {
    // Fallback logic
    s.period.macd = (s.lookback[0] && s.lookback[0].macd) ? s.lookback[0].macd : 0;
    s.period.macd_signal = (s.lookback[0] && s.lookback[0].macd_signal) ? s.lookback[0].macd_signal : 0;
    s.period.macd_histogram = (s.lookback[0] && s.lookback[0].macd_histogram) ? s.lookback[0].macd_histogram : 0;
    trackError(s, "calculation", "MACD error: " + error.message);
  }
}

/**
 * Detects the current market regime (volatility, trend, liquidity)
 * @param {Object} s - Strategy state object
 * @returns {Object} - Market regime object
 */
function detectMarketRegime(s) {
  try {
    // Cache check for performance
    if (s._last_regime_time === s.period.time || 
        (s._last_regime_time && s.period.time - s._last_regime_time < s.options.meta.regime_update_interval * 60 * 1000)) {
      return s.market_regime || { volatility: "normal", trend: "neutral", liquidity: "normal" };
    }
    
    // Initialize regime if not present
    if (!s.market_regime) s.market_regime = { volatility: "normal", trend: "neutral", liquidity: "normal" };
    
    // Volatility (using ATR)
    if (s.lookback.length >= 20 && s.period.atr && !isNaN(s.period.atr)) {
      let sum_atr = 0, count_atr = 0;
      for (let i = 0; i < 20; i++) {
        if (i < s.lookback.length && s.lookback[i].atr && !isNaN(s.lookback[i].atr)) { 
          sum_atr += s.lookback[i].atr; 
          count_atr++; 
        }
      }
      if (count_atr > 0) {
        const avg_atr = sum_atr / count_atr;
        if (s.period.atr > avg_atr * 1.5) s.market_regime.volatility = "high";
        else if (s.period.atr < avg_atr * 0.7) s.market_regime.volatility = "low";
        else s.market_regime.volatility = "normal";
      }
    }
    
    // Trend (using ADX and EMAs)
    if (s.period.adx && !isNaN(s.period.adx)) {
      if (s.period.adx > s.options.meta.trend_adx_threshold) {
        if (s.period.ema_fast > s.period.ema_slow) s.market_regime.trend = "bullish";
        else if (s.period.ema_fast < s.period.ema_slow) s.market_regime.trend = "bearish";
        else s.market_regime.trend = "neutral";
      } else {
        s.market_regime.trend = "neutral";
      }
    } else {
       s.market_regime.trend = "neutral";
    }
    
    // Liquidity (using Volume)
    if (s.lookback.length >= 20 && s.period.volume && !isNaN(s.period.volume)) {
      let sum_volume = 0, count_volume = 0;
      for (let i = 0; i < 20; i++) {
        if (i < s.lookback.length && s.lookback[i].volume && !isNaN(s.lookback[i].volume)) { 
          sum_volume += s.lookback[i].volume; 
          count_volume++; 
        }
      }
      if (count_volume > 0) {
        const avg_volume = sum_volume / count_volume;
        if (s.period.volume > avg_volume * 1.5) s.market_regime.liquidity = "high";
        else if (s.period.volume < avg_volume * 0.7) s.market_regime.liquidity = "low";
        else s.market_regime.liquidity = "normal";
      }
    }
    
    s._last_regime_time = s.period.time;
  } catch (error) {
    // Fallback to default regime
    s.market_regime = { volatility: "normal", trend: "neutral", liquidity: "normal" };
    trackError(s, "calculation", "Market regime error: " + error.message);
  }
  return s.market_regime;
}

/**
 * Tracks errors for monitoring and debugging
 * @param {Object} s - Strategy state object
 * @param {String} error_type - Type of error
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
  
  if (error_type === "calculation") s.error_stats.calculation_errors++;
  else if (error_type === "pattern_detection") s.error_stats.pattern_detection_errors++;
  else if (error_type === "risk_management") s.error_stats.risk_management_errors++;
  
  s.error_stats.last_error_time = new Date().getTime();
  s.error_stats.last_error_message = error_message;
  
  if (s.options.debug) console.error("Algo1meta " + error_type + " error: " + error_message);
}

// ======================================================================
// PATTERN DETECTION FUNCTIONS
// ======================================================================

/**
 * Detects Flash Crash pattern and calculates confidence
 * @param {Object} s - Strategy state object
 * @param {Object} config - Pattern-specific configuration
 * @returns {Object} - Pattern detection result
 */
function detectFlashCrashPattern(s, config) {
  let pattern = { 
    detected: false, 
    confidence: 0, 
    stop_loss_pct: config.stop_loss_pct, 
    profit_target_pct: config.profit_target_pct,
    name: "flash_crash"
  };
  
  if (!config.enabled || s.lookback.length < config.flash_crash_duration) return pattern;
  
  try {
    const current_close = s.period.close;
    const prev_close = s.lookback[0].close;
    
    if (isNaN(current_close) || isNaN(prev_close)) throw new Error("Invalid price data for flash crash");
    
    let price_change_pct = ((current_close - prev_close) / prev_close) * 100;
    
    // Count consecutive red candles
    let consecutive_red = 0;
    for (let i = 0; i < Math.min(config.consecutive_red_candles, s.lookback.length + 1); i++) {
      const candle = (i === 0) ? s.period : s.lookback[i-1];
      if (candle && candle.close < candle.open) consecutive_red++;
      else break;
    }
    
    // Check for volume spike
    let volume_spike = false;
    if (s.period.volume && s.lookback[0] && s.lookback[0].volume && 
        !isNaN(s.period.volume) && !isNaN(s.lookback[0].volume)) {
      volume_spike = s.period.volume > s.lookback[0].volume * 1.5;
    }
    
    // Pattern detection criteria
    pattern.detected = price_change_pct <= -config.flash_crash_pct && 
                       consecutive_red >= config.consecutive_red_candles;
    
    if (pattern.detected) {
      // Confidence Calculation
      pattern.confidence = Math.min(4, Math.abs(price_change_pct) / config.flash_crash_pct * 4);
      
      if (volume_spike) pattern.confidence += 2;
      
      if (s.period.atr && s.lookback[0] && s.lookback[0].atr && 
          s.period.atr > s.lookback[0].atr * 1.2) {
        pattern.confidence += 1; // Increased volatility
      }
      
      if (s.period.rsi && s.period.rsi < config.rsi_oversold) {
        pattern.confidence += 1; // RSI confirmation
      }
      
      if (s.market_regime.volatility === "high" && s.market_regime.trend === "bearish") {
        pattern.confidence += 1; // Favorable regime
      }
      
      pattern.confidence = Math.min(10, Math.max(0, pattern.confidence));
      
      // Add pattern-specific metadata
      pattern.metadata = {
        price_change_pct: price_change_pct,
        consecutive_red: consecutive_red,
        volume_spike: volume_spike
      };
    }
  } catch (error) {
    trackError(s, "pattern_detection", "Flash Crash error: " + error.message);
    pattern.detected = false;
    pattern.confidence = 0;
  }
  
  return pattern;
}

/**
 * Detects Post-Stagnation pattern and calculates confidence
 * @param {Object} s - Strategy state object
 * @param {Object} config - Pattern-specific configuration
 * @returns {Object} - Pattern detection result
 */
function detectPostStagnationPattern(s, config) {
  let pattern = { 
    detected: false, 
    confidence: 0, 
    stop_loss_pct: config.stop_loss_pct, 
    profit_target_pct: config.profit_target_pct,
    name: "post_stagnation"
  };
  
  if (!config.enabled || s.lookback.length < 5) return pattern;
  
  try {
    // Look for end of stagnation period
    let had_stagnation = false, stagnation_end_idx = -1;
    for (let i = 1; i < 5; i++) {
      if (i < s.lookback.length && s.lookback[i].is_stagnation && 
          s.lookback[i-1] && !s.lookback[i-1].is_stagnation) {
        stagnation_end_idx = i-1;
        had_stagnation = true;
        break;
      }
    }
    
    if (had_stagnation && stagnation_end_idx >= 0) {
      const stagnation_end_close = s.lookback[stagnation_end_idx].close;
      
      if (isNaN(s.period.close) || isNaN(stagnation_end_close)) {
        throw new Error("Invalid price data for post-stagnation");
      }
      
      let decline_pct = ((s.period.close - stagnation_end_close) / stagnation_end_close) * 100;
      
      // Check for a bounce attempt after the decline
      let recovery_attempt = false;
      if (s.lookback.length >= 3) {
        let recent_low = Math.min(s.period.low, s.lookback[0].low, s.lookback[1].low);
        if (!isNaN(recent_low)) {
           let bounce_pct = ((s.period.close - recent_low) / recent_low) * 100;
           recovery_attempt = bounce_pct >= config.recovery_threshold;
        }
      }
      
      pattern.detected = decline_pct <= -config.min_decline_pct && recovery_attempt;
      
      if (pattern.detected) {
        // Confidence Calculation
        pattern.confidence = 5; // Base score
        
        // Add confidence based on BB width during stagnation
        if (s.lookback.length >= 3) {
          let avg_bb_width = 0, count = 0;
          for (let i = stagnation_end_idx; i < stagnation_end_idx + 3 && i < s.lookback.length; i++) {
             if (s.lookback[i] && s.lookback[i].bb_width && !isNaN(s.lookback[i].bb_width)) { 
               avg_bb_width += s.lookback[i].bb_width; 
               count++; 
             }
          }
          if (count > 0) { 
            avg_bb_width /= count; 
            if (avg_bb_width < config.stagnation_threshold) pattern.confidence += 1; 
          }
        }
        
        if (s.market_regime.volatility === "low" && s.market_regime.trend === "neutral") {
          pattern.confidence += 1; // Favorable regime
        }
        
        pattern.confidence = Math.min(10, Math.max(0, pattern.confidence));
        
        // Add pattern-specific metadata
        pattern.metadata = {
          decline_pct: decline_pct,
          stagnation_end_idx: stagnation_end_idx,
          recovery_attempt: recovery_attempt
        };
      }
    }
  } catch (error) {
    trackError(s, "pattern_detection", "Post-Stagnation error: " + error.message);
    pattern.detected = false;
    pattern.confidence = 0;
  }
  
  return pattern;
}

/**
 * Detects Unsteady Decline pattern and calculates confidence
 * @param {Object} s - Strategy state object
 * @param {Object} config - Pattern-specific configuration
 * @returns {Object} - Pattern detection result
 */
function detectUnsteadyDeclinePattern(s, config) {
  let pattern = { 
    detected: false, 
    confidence: 0, 
    stop_loss_pct: config.stop_loss_pct, 
    profit_target_pct: config.profit_target_pct,
    name: "unsteady_decline"
  };
  
  const lookback_period = config.lookback_candles || 24; // Default 2 hours (24 * 5min)
  
  if (!config.enabled || s.lookback.length < lookback_period) return pattern;
  
  try {
    const start_close = s.lookback[lookback_period - 1].close;
    
    if (isNaN(s.period.close) || isNaN(start_close)) {
      throw new Error("Invalid price data for unsteady decline");
    }
    
    let decline_pct = ((s.period.close - start_close) / start_close) * 100;
    
    // Check for overall decline within the target range
    if (decline_pct <= -config.min_decline_pct && decline_pct >= -config.max_decline_pct) {
      let up_candles = 0, down_candles = 0;
      
      for (let i = 0; i < lookback_period; i++) {
        const candle = (i === 0) ? s.period : s.lookback[i-1];
        if (candle) {
           if (candle.close > candle.open) up_candles++;
           else if (candle.close < candle.open) down_candles++;
        }
      }
      
      // Check for unsteady nature (mix of up/down candles, not just straight down)
      pattern.detected = down_candles > up_candles && 
                         up_candles >= lookback_period * config.min_up_candle_ratio;
      
      if (pattern.detected) {
        // Confidence Calculation
        pattern.confidence = 5; // Base score
        
        // RSI divergence check
        if (s.lookback.length >= 12 && s.period.rsi && s.lookback[12] && s.lookback[12].rsi) {
          let price_change_12 = ((s.period.close - s.lookback[12].close) / s.lookback[12].close) * 100;
          let rsi_change_12 = s.period.rsi - s.lookback[12].rsi;
          if (price_change_12 < 0 && rsi_change_12 > 0) pattern.confidence += 2; // Bullish divergence
        }
        
        if (s.market_regime.volatility === "normal" && s.market_regime.trend === "bearish") {
          pattern.confidence += 1; // Favorable regime
        }
        
        pattern.confidence = Math.min(10, Math.max(0, pattern.confidence));
        
        // Add pattern-specific metadata
        pattern.metadata = {
          decline_pct: decline_pct,
          up_candles: up_candles,
          down_candles: down_candles,
          up_candle_ratio: up_candles / lookback_period
        };
      }
    }
  } catch (error) {
    trackError(s, "pattern_detection", "Unsteady Decline error: " + error.message);
    pattern.detected = false;
    pattern.confidence = 0;
  }
  
  return pattern;
}

// ======================================================================
// META-DECISION LOGIC
// ======================================================================

/**
 * Gets patterns compatible with current market regime
 * @param {Object} s - Strategy state object
 * @returns {Array} - List of compatible pattern names
 */
function getRegimeCompatiblePatterns(s) {
    const regime = s.market_regime;
    const regime_key = `${regime.volatility}-${regime.trend}`;
    
    // Pattern compatibility matrix based on market regime
    const compatibility_matrix = {
        'high-bearish': ['flash_crash', 'unsteady_decline'],
        'high-neutral': ['flash_crash'],
        'high-bullish': [], // Avoid buying dips in high-volatility uptrends
        'normal-bearish': ['unsteady_decline', 'post_stagnation'],
        'normal-neutral': ['post_stagnation'],
        'normal-bullish': [],
        'low-bearish': ['unsteady_decline'],
        'low-neutral': ['post_stagnation'],
        'low-bullish': []
    };
    
    return compatibility_matrix[regime_key] || ['flash_crash', 'post_stagnation', 'unsteady_decline'];
}

/**
 * Makes trading decision based on parallel pattern detection results
 * @param {Object} s - Strategy state object
 * @param {Object} patterns - Object containing results from each pattern detector
 * @returns {Object|null} - The selected pattern object or null if no trade
 */
function makeMetaDecision(s, patterns) {
  // Convert patterns object to array for easier processing
  let candidates = [];
  for (const pattern_name in patterns) {
    const pattern = patterns[pattern_name];
    if (pattern.detected && pattern.confidence >= s.options.meta.min_confidence_threshold) {
      // Check regime compatibility if filter enabled
      let regime_compatible = true;
      if (s.options.meta.enable_regime_filter) {
        const compatible_patterns = getRegimeCompatiblePatterns(s);
        regime_compatible = compatible_patterns.includes(pattern_name);
      }
      
      if (regime_compatible) {
        candidates.push(pattern);
      }
    }
  }

  if (candidates.length === 0) {
    s.period.active_pattern = null;
    s.period.active_pattern_confidence = 0;
    return null;
  }

  // Sort candidates by confidence (descending)
  candidates.sort((a, b) => b.confidence - a.confidence);

  // Decision Mode: regime_based
  if (s.options.meta.decision_mode === "regime_based") {
      // Already filtered by compatibility, just pick the highest confidence among compatible
      const best_candidate = candidates[0];
      s.period.active_pattern = best_candidate.name;
      s.period.active_pattern_confidence = best_candidate.confidence;
      return best_candidate;
  }

  // Decision Mode: best_confidence (Default)
  const best_candidate = candidates[0];
  
  // Check if confidence is significantly higher than the next best
  if (candidates.length > 1) {
    const next_best_candidate = candidates[1];
    if (best_candidate.confidence - next_best_candidate.confidence < s.options.meta.min_confidence_difference) {
      // Confidence too close, no clear signal
      s.period.active_pattern = null;
      s.period.active_pattern_confidence = 0;
      return null;
    }
  }
  
  s.period.active_pattern = best_candidate.name;
  s.period.active_pattern_confidence = best_candidate.confidence;
  return best_candidate;
}

/**
 * Calculates position size based on pattern confidence and risk parameters
 * @param {Object} s - Strategy state object
 * @param {Object} pattern - Selected pattern object
 * @returns {Number} - Position size percentage
 */
function calculatePositionSize(s, pattern) {
  const base_size = s.options.position_size_pct;
  
  // Scale position size based on confidence if enabled
  if (s.options.meta.position_size_scaling) {
    const confidence_factor = pattern.confidence / 10; // 0.0 to 1.0
    const min_size = base_size * 0.5; // 50% of base size at minimum
    return min_size + (base_size - min_size) * confidence_factor;
  }
  
  return base_size;
}

// ======================================================================
// ZENBOT STRATEGY IMPLEMENTATION
// ======================================================================

module.exports = {
  name: "algo1meta",
  description: "Meta-strategy combining Flash Crash, Post-Stagnation, and Unsteady Decline patterns",

  getOptions: function () {
    this.option("period", "period length, same as --period_length", String, "1m");
    this.option("period_length", "period length, same as --period", String, "1m");
    this.option("min_periods", "min. number of history periods", Number, 252);

    // Meta Strategy Options
    this.option("meta.decision_mode", "Meta-decision mode (best_confidence, regime_based)", String, "best_confidence");
    this.option("meta.min_confidence_threshold", "Minimum confidence score to trade any pattern", Number, 6);
    this.option("meta.min_confidence_difference", "Min confidence diff for 'best_confidence' mode", Number, 1.5);
    this.option("meta.enable_regime_filter", "Enable market regime filtering for patterns", Boolean, true);
    this.option("meta.position_size_scaling", "Scale position size based on pattern confidence", Boolean, true);
    this.option("meta.trend_adx_threshold", "ADX threshold for trend detection in regime", Number, 25);
    this.option("meta.regime_update_interval", "Minutes between market regime updates", Number, 15);

    // Flash Crash Pattern Options
    this.option("flash_crash.enabled", "Enable Flash Crash pattern detection", Boolean, true);
    this.option("flash_crash.flash_crash_pct", "Percentage decline for flash crash", Number, 3.0);
    this.option("flash_crash.flash_crash_duration", "Max candles for flash crash", Number, 10);
    this.option("flash_crash.consecutive_red_candles", "Consecutive red candles for flash crash", Number, 3);
    this.option("flash_crash.rsi_oversold", "RSI level for flash crash confirmation", Number, 30);
    this.option("flash_crash.stop_loss_pct", "Stop loss % for flash crash trades", Number, 0.5);
    this.option("flash_crash.profit_target_pct", "Profit target % for flash crash trades", Number, 0.8);

    // Post-Stagnation Pattern Options
    this.option("post_stagnation.enabled", "Enable Post-Stagnation pattern detection", Boolean, true);
    this.option("post_stagnation.stagnation_threshold", "BB width threshold for stagnation", Number, 0.08);
    this.option("post_stagnation.recovery_threshold", "Minimum percentage for recovery attempt", Number, 0.6);
    this.option("post_stagnation.min_decline_pct", "Min decline % after stagnation", Number, 5.0);
    this.option("post_stagnation.stop_loss_pct", "Stop loss % for post-stagnation trades", Number, 1.8);
    this.option("post_stagnation.profit_target_pct", "Profit target % for post-stagnation trades", Number, 1.8);

    // Unsteady Decline Pattern Options
    this.option("unsteady_decline.enabled", "Enable Unsteady Decline pattern detection", Boolean, true);
    this.option("unsteady_decline.lookback_candles", "Number of candles for unsteady decline lookback", Number, 124);
    this.option("unsteady_decline.min_decline_pct", "Min decline % for unsteady pattern", Number, 4.5);
    this.option("unsteady_decline.max_decline_pct", "Max decline % for unsteady pattern", Number, 15.5);
    this.option("unsteady_decline.min_up_candle_ratio", "Min ratio of up candles in unsteady decline", Number, 0.3);
    this.option("unsteady_decline.adx_threshold", "ADX threshold for unsteady decline", Number, 22);
    this.option("unsteady_decline.ema_short", "Short EMA period for unsteady decline", Number, 30);
    this.option("unsteady_decline.ema_medium", "Medium EMA period for unsteady decline", Number, 50);
    this.option("unsteady_decline.ema_long", "Long EMA period for unsteady decline", Number, 100);
    this.option("unsteady_decline.stop_loss_pct", "Stop loss % for unsteady decline trades", Number, 0.7);
    this.option("unsteady_decline.profit_target_pct", "Profit target % for unsteady decline trades", Number, 0.4);

    // Common Indicator Options
    this.option("adx_period", "period for ADX calculation", Number, 14);
    this.option("bb_period", "period for Bollinger Bands", Number, 20);
    this.option("bb_stddev", "standard deviation for Bollinger Bands", Number, 2);
    this.option("atr_period", "period for ATR calculation", Number, 14);
    this.option("macd_fast", "MACD fast period", Number, 12);
    this.option("macd_slow", "MACD slow period", Number, 26);
    this.option("macd_signal", "MACD signal period", Number, 9);
    this.option("oversold_rsi_periods", "number of periods for oversold RSI", Number, 14);

    // General Risk & Position Sizing
    this.option("position_size_pct", "percentage of available capital per trade", Number, 95);
    this.option("max_open_positions", "maximum number of open positions", Number, 1);
    this.option("max_daily_trades", "maximum number of trades per day", Number, 100);
    this.option("trailing_stop_pct", "trailing stop percentage", Number, 0.4);
    this.option("trailing_stop_activation_pct", "profit percentage to activate trailing stop", Number, 0.4);

    // Misc
    this.option("debug", "enable debugging output", Boolean, true);
    this.option("log_trades", "log detailed trade information", Boolean, true);
  },

  calculate: function (s) {
    // Initialize state if needed
    if (!s._algo1meta_initialized) {
      s.open_positions = 0;
      s.in_position = false;
      s.daily_trades = { count: 0, date: new Date().toDateString() };
      s.market_regime = { volatility: "normal", trend: "neutral", liquidity: "normal" };
      s.error_stats = { calculation_errors: 0, pattern_detection_errors: 0, risk_management_errors: 0 };
      s._algo1meta_initialized = true;
      if (s.options.debug) console.log("Algo1meta initialized.");
    }

    try {
      // Calculate common indicators
      ema(s, "ema_fast", s.options.macd_fast); // Use MACD EMA for regime calc
      ema(s, "ema_slow", s.options.macd_slow);
      
      // Pattern-specific EMAs for unsteady decline
      ema(s, "ema_short", s.options.unsteady_decline.ema_short);
      ema(s, "ema_medium", s.options.unsteady_decline.ema_medium);
      ema(s, "ema_long", s.options.unsteady_decline.ema_long);
      
      bollingerBands(s, "bb", s.options.bb_period, s.options.bb_stddev);
      calculateATR(s, s.options.atr_period);
      calculateMACD(s, s.options.macd_fast, s.options.macd_slow, s.options.macd_signal);
      adx(s, s.options.adx_period);
      rsi(s, "rsi", s.options.oversold_rsi_periods);

      // Calculate BB width
      if (s.period.bb && s.period.bb.upper && s.period.bb.lower && s.period.bb.middle) {
         s.period.bb_width = (s.period.bb.upper - s.period.bb.lower) / s.period.bb.middle;
      } else {
         s.period.bb_width = undefined; // Handle case where BB is not ready
      }

      // Directional Movement Classification (needed for regime and patterns)
      s.period.is_stagnation = s.period.adx < 20 && 
                               s.period.bb_width && 
                               s.period.bb_width < s.options.post_stagnation.stagnation_threshold;
      
      s.period.is_upward = s.period.ema_short > s.period.ema_medium && 
                           s.period.ema_medium > s.period.ema_long && 
                           s.period.adx > s.options.meta.trend_adx_threshold;
      
      s.period.is_downward = s.period.ema_short < s.period.ema_medium && 
                             s.period.ema_medium < s.period.ema_long && 
                             s.period.adx > s.options.meta.trend_adx_threshold;
      
      // Detect market regime
      detectMarketRegime(s);

      // Run modular pattern detections
      s.patterns = {};
      s.patterns.flash_crash = detectFlashCrashPattern(s, s.options.flash_crash);
      s.patterns.post_stagnation = detectPostStagnationPattern(s, s.options.post_stagnation);
      s.patterns.unsteady_decline = detectUnsteadyDeclinePattern(s, s.options.unsteady_decline);

      // Make meta-decision
      s.selected_pattern = makeMetaDecision(s, s.patterns);

      // Daily trade limit check
      const current_date = new Date().toDateString();
      if (s.daily_trades.date !== current_date) s.daily_trades = { count: 0, date: current_date };
      s.period.daily_trade_limit_reached = s.daily_trades.count >= s.options.max_daily_trades;

    } catch (error) {
      trackError(s, "calculation", error.message);
      s.selected_pattern = null; // Reset on error
    }
  },

  onPeriod: function (s, cb) {
    try {
      // Entry logic
      if (!s.in_position && s.open_positions < s.options.max_open_positions && 
          !s.period.daily_trade_limit_reached && s.selected_pattern) {
        const active_pattern = s.selected_pattern;

        s.signal = "buy";
        s.entry_pattern = active_pattern.name;
        s.entry_price = s.period.close;
        s.entry_time = new Date().getTime();
        s.open_positions++;
        s.daily_trades.count++;

        // Apply pattern-specific risk parameters from the selected pattern object
        s.stop = s.period.close * (1 - (active_pattern.stop_loss_pct / 100));
        s.profit_target = s.period.close * (1 + (active_pattern.profit_target_pct / 100));
        s.trailing_stop_active = false;
        s.trailing_stop = undefined; // Ensure trailing stop is reset

        // Calculate position size based on confidence and risk
        const position_size_pct = calculatePositionSize(s, active_pattern);
        s.position_size = s.balance * (position_size_pct / 100);

        if (s.options.log_trades) {
          console.log(("\n" + active_pattern.name.toUpperCase() + " pattern selected (Conf: " + 
                      active_pattern.confidence.toFixed(1) +")" +
                      ", buying at " + n(s.period.close).format("0.00000000") +
                      " | Stop: " + n(s.stop).format("0.00000000") + 
                      " | Target: " + n(s.profit_target).format("0.00000000") + 
                      " | Size: " + position_size_pct.toFixed(1) + "%" + "\n").cyan);
        }
      }
      // Exit logic
      else if (s.in_position) {
        let exit_reason = null;
        
        // Update trailing stop
        if (!s.trailing_stop_active && s.period.close > s.entry_price * (1 + s.options.trailing_stop_activation_pct/100)) {
          s.trailing_stop_active = true;
          s.trailing_stop = s.period.close * (1 - s.options.trailing_stop_pct/100);
          if (s.options.debug) {
            console.log(("Trailing stop activated at " + n(s.trailing_stop).format("0.00000000")).yellow);
          }
        }
        
        // Adjust trailing stop upwards if price moves higher
        if (s.trailing_stop_active && s.period.close * (1 - s.options.trailing_stop_pct/100) > s.trailing_stop) {
           const old_stop = s.trailing_stop;
           s.trailing_stop = s.period.close * (1 - s.options.trailing_stop_pct/100);
           if (s.options.debug) {
             console.log(("Trailing stop raised from " + n(old_stop).format("0.00000000") + 
                         " to " + n(s.trailing_stop).format("0.00000000")).yellow);
           }
        }

        // Check exit conditions
        if (s.period.low <= s.stop) exit_reason = "Stop loss";
        else if (s.trailing_stop_active && s.period.low <= s.trailing_stop) exit_reason = "Trailing stop";
        else if (s.period.high >= s.profit_target) exit_reason = "Profit target";

        if (exit_reason) {
          s.signal = "sell";
          const exit_price = (exit_reason === "Stop loss") ? s.stop : 
                             (exit_reason === "Trailing stop") ? s.trailing_stop : s.profit_target;
          const profit_pct = ((exit_price - s.entry_price) / s.entry_price) * 100;
          const profit_str = profit_pct >= 0 ? ("+" + profit_pct.toFixed(2) + "%").green : (profit_pct.toFixed(2) + "%").red;
          
          if (s.options.log_trades) {
            console.log(("\n" + exit_reason + " hit, selling at ~" + n(exit_price).format("0.00000000") + 
                        " (from entry " + n(s.entry_price).format("0.00000000") + 
                        ") with " + profit_str + " profit\n").yellow);
          }
          
          // Record trade statistics
          if (!s.trade_stats) s.trade_stats = { total: 0, wins: 0, losses: 0, total_profit: 0 };
          s.trade_stats.total++;
          if (profit_pct > 0) s.trade_stats.wins++;
          else s.trade_stats.losses++;
          s.trade_stats.total_profit += profit_pct;
          
          if (s.options.debug && s.trade_stats.total % 5 === 0) {
            const win_rate = (s.trade_stats.wins / s.trade_stats.total * 100).toFixed(1);
            const avg_profit = (s.trade_stats.total_profit / s.trade_stats.total).toFixed(2);
            console.log(("\nTrade Stats: " + s.trade_stats.total + " trades, " + 
                        win_rate + "% win rate, " + avg_profit + "% avg profit\n").cyan);
          }
        }
      }

      // Update position state
      if (s.signal === "buy") s.in_position = true;
      else if (s.signal === "sell") {
        s.in_position = false;
        s.trailing_stop_active = false;
        s.trailing_stop = undefined;
        s.entry_price = null;
        s.entry_time = null;
        s.entry_pattern = null;
        s.open_positions--;
        if (s.open_positions < 0) s.open_positions = 0; // Sanity check
      }

    } catch (error) {
      trackError(s, "risk_management", error.message);
      s.signal = null; // Avoid trading on error
    }
    cb();
  },

  onReport: function (s) {
    var cols = [];
    
    // Active Pattern and Confidence
    if (s.period.active_pattern) {
      cols.push(z(6, s.period.active_pattern.substring(0, 6).toUpperCase(), " ").cyan);
      cols.push(z(4, n(s.period.active_pattern_confidence).format("0.0"), " ").yellow);
    } else {
      cols.push(z(6, "------", " ").grey);
      cols.push(z(4, "--", " ").grey);
    }
    
    // Market Regime
    if (s.market_regime) {
      let regime_color = "grey";
      if (s.market_regime.volatility === "high") regime_color = "red";
      else if (s.market_regime.volatility === "low") regime_color = "green";
      cols.push(z(4, s.market_regime.volatility.substring(0, 1).toUpperCase() + 
                s.market_regime.trend.substring(0, 1).toUpperCase(), " ")[regime_color]);
    } else {
       cols.push(z(4, "??", " ").grey);
    }
    
    // Position Status and Profit
    if (s.in_position && s.entry_price) {
      cols.push("POS".green);
      const profit_pct = ((s.period.close - s.entry_price) / s.entry_price) * 100;
      let profit_color = profit_pct >= 0 ? "green" : "red";
      cols.push(z(7, n(profit_pct).format("+0.00") + "%", " ")[profit_color]);
    } else {
      cols.push("---".grey);
      cols.push(z(7, "", " ")); // Placeholder for alignment
    }
    
    // Trailing Stop Info
    if (s.trailing_stop_active && s.trailing_stop) {
        cols.push(z(9, "TStop@" + n(s.trailing_stop).format("0.00"), " ").yellow);
    } else {
        cols.push(z(9, "", " "));
    }
    
    return cols;
  },

  phenotypes: {
    // Meta Strategy Phenotypes
    "meta.decision_mode": Phenotypes.ListOption(["best_confidence", "regime_based"]),
    "meta.min_confidence_threshold": Phenotypes.Range(5, 9),
    "meta.min_confidence_difference": Phenotypes.RangeFloat(0.5, 3.0),
    "meta.enable_regime_filter": Phenotypes.Range(0, 1),
    "meta.position_size_scaling": Phenotypes.Range(0, 1),
    "meta.trend_adx_threshold": Phenotypes.Range(20, 35),

    // Pattern-Specific Phenotypes
    "flash_crash.enabled": Phenotypes.Range(0, 1),
    "flash_crash.flash_crash_pct": Phenotypes.RangeFloat(1.0, 15.0),
    "flash_crash.consecutive_red_candles": Phenotypes.Range(2, 7),
    "flash_crash.rsi_oversold": Phenotypes.Range(20, 40),
    "flash_crash.stop_loss_pct": Phenotypes.RangeFloat(0.4, 3.0),
    "flash_crash.profit_target_pct": Phenotypes.RangeFloat(0.4, 5.0),

    "post_stagnation.enabled": Phenotypes.Range(0, 1),
    "post_stagnation.stagnation_threshold": Phenotypes.RangeFloat(0.05, 0.2),
    "post_stagnation.recovery_threshold": Phenotypes.RangeFloat(0.3, 1.0),
    "post_stagnation.min_decline_pct": Phenotypes.RangeFloat(3.0, 7.0),
    "post_stagnation.stop_loss_pct": Phenotypes.RangeFloat(0.4, 3.0),
    "post_stagnation.profit_target_pct": Phenotypes.RangeFloat(0.4, 5.0),

    "unsteady_decline.enabled": Phenotypes.Range(0, 1),
    "unsteady_decline.lookback_candles": Phenotypes.Range(12, 480),
    "unsteady_decline.min_decline_pct": Phenotypes.RangeFloat(3.0, 116.0),
    "unsteady_decline.max_decline_pct": Phenotypes.RangeFloat(0.4, 17.0),
    "unsteady_decline.min_up_candle_ratio": Phenotypes.RangeFloat(0.2, 0.5),
    "unsteady_decline.stop_loss_pct": Phenotypes.RangeFloat(0.4, 3.0),
    "unsteady_decline.profit_target_pct": Phenotypes.RangeFloat(0.4, 5.0),

    // General Risk Phenotypes
    "position_size_pct": Phenotypes.Range(5, 100),
    "trailing_stop_pct": Phenotypes.RangeFloat(0.4, 2.0),
    "trailing_stop_activation_pct": Phenotypes.RangeFloat(0.3, 2.0),
  }
};
