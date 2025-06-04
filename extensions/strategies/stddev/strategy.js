/**
 * Enhanced Standard Deviation Strategy with Auto Buy at Startup
 * 
 * This strategy is an advanced implementation of the standard deviation strategy
 * that incorporates multi-timeframe trend analysis, volume integration, adaptive
 * position sizing, and a weighted scoring system for improved buy signal timing.
 * 
 * Added feature: Automatic buy at startup when in paper trading mode
 * 
 * Iteration 3 improvements:
 * - Simplified state machine with fewer states
 * - Improved mutex handling with timeout-based release
 * - Enhanced configuration validation with fallbacks
 * - Comprehensive inline documentation
 * - Performance optimization with reduced memory usage
 */

var z = require("zero-fill")
  , stats = require("stats-lite")
  , math = require("mathjs")
  , ema = require("../../../lib/ema")
  , Phenotypes = require("../../../lib/phenotype")
  , debug = require("../../../lib/debug")

// Simplified state machine with fewer states
const AUTO_BUY_STATES = {
  INIT: "init",              // Initial state
  WAITING: "waiting",        // Waiting for required periods
  EXECUTING: "executing",    // Buy signal sent
  MONITORING: "monitoring",  // Monitoring execution
  COMPLETED: "completed",    // Successfully completed
  FAILED: "failed"           // Failed to execute
};

// Error types for auto buy
const AUTO_BUY_ERRORS = {
  DATABASE: "database_error",
  TIMEOUT: "timeout_error",
  BALANCE: "balance_error",
  EXECUTION: "execution_error",
  VALIDATION: "validation_error"
};

module.exports = {
  name: "stddev",
  description: "Enhanced standard deviation strategy with advanced buy signal detection, adaptive position sizing, execution time optimization, and auto buy at startup for paper trading.",

  /**
   * Define strategy options and default values
   */
  getOptions: function () {
    this.option("period", "period length, optimized for faster simulation. Same as --period_length", String, "1m")
    this.option("period_length", "period length, optimized for faster simulation. Same as --period", String, "1m")
    this.option("trendtrades_1", "Trades for array 1 to be subtracted stddev and mean from", Number, 8)
    this.option("trendtrades_2", "Trades for array 2 to be calculated stddev and mean from", Number, 50)
    this.option("min_periods", "Minimum periods before trading", Number, 1)
    this.option("enable_adaptive_sizing", "Enable adaptive position sizing based on signal quality", Boolean, true)
    this.option("enable_volume_integration", "Enable volume confirmation for buy signals", Boolean, false)
    this.option("enable_weighted_scoring", "Enable multi-factor weighted scoring system for buy signals", Boolean, true)
    this.option("debug_log", "Enable detailed debug logging for signal generation", Boolean, true)
    // Modified calculation skipping options
    this.option("fast_execution", "Enable execution time optimizations", Boolean, false)
    this.option("calculation_skip_ticks", "Number of ticks to skip between full recalculations (0 = calculate every tick)", Number, 0)
    this.option("performance_report", "Show performance metrics in console output", Boolean, true)
    // Auto buy options
    this.option("auto_buy_at_start", "Automatically execute a buy at startup when in paper mode", Boolean, true)
    this.option("auto_buy_pct", "Percentage of available funds to use for auto buy", Number, 0.95)
    this.option("auto_buy_wait_periods", "Number of periods to wait before executing auto buy", Number, 3)
    this.option("auto_buy_force", "Force auto buy even if previously executed", Boolean, false)
    this.option("auto_buy_min_balance", "Minimum balance required to execute auto buy", Number, 10)
    this.option("auto_buy_check_market", "Check market conditions before auto buy", Boolean, true)
    this.option("auto_buy_min_uptrend_periods", "Minimum consecutive up periods before buying", Number, 2)
    this.option("auto_buy_max_price_change", "Maximum allowed price change percentage for auto buy", Number, 1.0)
    this.option("auto_buy_dry_run", "Simulate auto buy without executing", Boolean, false)
    this.option("auto_buy_market_type", "Market type for auto buy (auto, trending, ranging, volatile)", String, "auto")
    this.option("auto_buy_override_market_check", "Override specific market condition checks (comma-separated: all, uptrend, volatility, indicators)", String, "none")
    // Added option for immediate execution
    this.option("auto_buy_immediate", "Execute auto buy immediately without waiting for periods", Boolean, false)
    // Added options for execution verification
    this.option("auto_buy_verification_timeout", "Timeout in seconds for execution verification", Number, 300)
    this.option("auto_buy_min_balance_change", "Minimum balance change percentage to confirm execution", Number, 0.5)
  },

  /**
   * Initialize strategy state
   * @param {Object} s - Strategy state object
   */
  init: function(s) {
    // Create a reference to the strategy module
    s.ctx.strategyModule = this

    // Bind all helper methods to ensure proper "this" context
    this.initTrends = this.initTrends.bind(this)
    this.updateTrends = this.updateTrends.bind(this)
    this.initVolume = this.initVolume.bind(this)
    this.updateVolume = this.updateVolume.bind(this)
    this.volumeConfirmsBuy = this.volumeConfirmsBuy.bind(this)
    this.calculateBuyScore = this.calculateBuyScore.bind(this)
    this.calculateBuyThreshold = this.calculateBuyThreshold.bind(this)
    this.calculatePositionSize = this.calculatePositionSize.bind(this)
    
    // Bind auto buy helper methods
    this.checkAndExecuteAutoBuy = this.checkAndExecuteAutoBuy.bind(this)
    this.acquireMutex = this.acquireMutex.bind(this)
    this.releaseMutex = this.releaseMutex.bind(this)
    this.checkMutexTimeout = this.checkMutexTimeout.bind(this)
    this.checkExecutionState = this.checkExecutionState.bind(this)
    this.resetDatabaseState = this.resetDatabaseState.bind(this)
    this.updateDatabaseState = this.updateDatabaseState.bind(this)
    this.queryDatabase = this.queryDatabase.bind(this)
    this.canExecuteBuy = this.canExecuteBuy.bind(this)
    this.executeBuy = this.executeBuy.bind(this)
    this.monitorExecution = this.monitorExecution.bind(this)
    this.takeBalanceSnapshot = this.takeBalanceSnapshot.bind(this)
    this.verifyBalanceChanges = this.verifyBalanceChanges.bind(this)
    this.isMarketFavorable = this.isMarketFavorable.bind(this)
    this.validateConfiguration = this.validateConfiguration.bind(this)
    this.handleError = this.handleError.bind(this)

    // Attach bound methods to s.ctx so they're available in the correct context when onPeriod is called
    s.ctx.initTrends = this.initTrends
    s.ctx.updateTrends = this.updateTrends
    s.ctx.initVolume = this.initVolume
    s.ctx.updateVolume = this.updateVolume
    s.ctx.volumeConfirmsBuy = this.volumeConfirmsBuy
    s.ctx.calculateBuyScore = this.calculateBuyScore
    s.ctx.calculateBuyThreshold = this.calculateBuyThreshold
    s.ctx.calculatePositionSize = this.calculatePositionSize
    
    // Attach auto buy methods
    s.ctx.checkAndExecuteAutoBuy = this.checkAndExecuteAutoBuy
    s.ctx.acquireMutex = this.acquireMutex
    s.ctx.releaseMutex = this.releaseMutex
    s.ctx.checkMutexTimeout = this.checkMutexTimeout
    s.ctx.checkExecutionState = this.checkExecutionState
    s.ctx.resetDatabaseState = this.resetDatabaseState
    s.ctx.updateDatabaseState = this.updateDatabaseState
    s.ctx.queryDatabase = this.queryDatabase
    s.ctx.canExecuteBuy = this.canExecuteBuy
    s.ctx.executeBuy = this.executeBuy
    s.ctx.monitorExecution = this.monitorExecution
    s.ctx.takeBalanceSnapshot = this.takeBalanceSnapshot
    s.ctx.verifyBalanceChanges = this.verifyBalanceChanges
    s.ctx.isMarketFavorable = this.isMarketFavorable
    s.ctx.validateConfiguration = this.validateConfiguration
    s.ctx.handleError = this.handleError

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
    
    // Initialize auto buy tracking
    s.auto_buy_state = AUTO_BUY_STATES.INIT
    s.auto_buy_executed = false // In-memory flag, primarily for quick checks
    s.auto_buy_counter = 0
    s.auto_buy_execution_time = 0
    s.auto_buy_monitoring_start = 0
    s.auto_buy_config_validated = false
    s.auto_buy_lock = false // Mutex-like lock for critical sections
    s.auto_buy_lock_time = 0 // When the mutex was acquired
    s.auto_buy_lock_timeout = 10000 // Default 10 second timeout
    s.auto_buy_balance_snapshots = [] // Limited to 2 snapshots: initial and pre-execution
    s.auto_buy_last_error = null // Last error

    if (s.options.debug_log) {
      debug.msg(`Strategy initialized with fast_execution=${s.options.fast_execution}, calculation_skip_ticks=${s.options.calculation_skip_ticks}`)
      if (s.options.paper && s.options.auto_buy_at_start) {
        debug.msg(`AUTO BUY: Will execute automatic buy at startup with ${s.options.auto_buy_pct * 100}% of funds`)
        if (s.options.auto_buy_immediate) {
          debug.msg(`AUTO BUY: Immediate execution enabled, will buy as soon as possible`)
        } else {
          debug.msg(`AUTO BUY: Waiting for ${s.options.auto_buy_wait_periods} periods after min_periods=${s.options.min_periods}`)
        }
        if (s.options.auto_buy_force) {
          debug.msg(`AUTO BUY: Force mode enabled, will execute even if previously executed`)
        }
        if (s.options.auto_buy_dry_run) {
          debug.msg(`AUTO BUY: Dry run mode enabled, will simulate execution`)
        }
      }
    }
    
    // Validate configuration immediately
    this.validateConfiguration(s)
  },

  /**
   * Acquire mutex with timeout
   * @param {Object} s - Strategy state object
   * @param {Number} timeoutMs - Timeout in milliseconds
   * @returns {Boolean} True if mutex was acquired
   */
  acquireMutex: function(s, timeoutMs) {
    // If mutex is already held, return false
    if (s.auto_buy_lock) {
      return false
    }
    
    // Acquire mutex
    s.auto_buy_lock = true
    s.auto_buy_lock_time = new Date().getTime()
    s.auto_buy_lock_timeout = timeoutMs || 10000 // Default 10 second timeout
    
    return true
  },

  /**
   * Release mutex
   * @param {Object} s - Strategy state object
   */
  releaseMutex: function(s) {
    s.auto_buy_lock = false
    s.auto_buy_lock_time = 0
  },

  /**
   * Check and auto-release mutex if timeout exceeded
   * @param {Object} s - Strategy state object
   */
  checkMutexTimeout: function(s) {
    if (!s.auto_buy_lock) return
    
    const now = new Date().getTime()
    const lockTime = now - (s.auto_buy_lock_time || 0)
    
    if (lockTime > s.auto_buy_lock_timeout) {
      if (s.options.debug_log) {
        debug.msg(`AUTO BUY: Mutex timeout after ${lockTime}ms, auto-releasing`)
      }
      this.releaseMutex(s)
    }
  },

  /**
   * Check if auto buy has been executed before
   * @param {Object} s - Strategy state object
   * @returns {Promise<boolean>} True if previously executed
   */
  checkExecutionState: async function(s) {
    // If force flag is enabled, reset state and return false
    if (s.options.auto_buy_force) {
      if (s.options.debug_log) {
        debug.msg("AUTO BUY: Force flag enabled, resetting execution state")
      }
      s.auto_buy_executed = false
      
      // Reset database state
      try {
        await this.resetDatabaseState(s)
      } catch (err) {
        // Just log error but continue
        debug.msg(`AUTO BUY: Error resetting database state: ${err.message}`)
      }
      
      return false
    }
    
    // Check in-memory state first
    if (s.auto_buy_executed) {
      return true
    }
    
    // Then check database
    try {
      const result = await this.queryDatabase(s)
      s.auto_buy_executed = result
      return result
    } catch (err) {
      debug.msg(`AUTO BUY: Error checking database state: ${err.message}`)
      return false
    }
  },

  /**
   * Query database for execution state
   * @param {Object} s - Strategy state object
   * @returns {Promise<boolean>} True if previously executed
   */
  queryDatabase: async function(s) {
    if (!s.db) {
      if (s.options.debug_log) {
        debug.msg("AUTO BUY: Database not available, using in-memory state only")
      }
      return false
    }
    
    try {
      // Create a promise with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Database operation timed out")), 5000)
      })
      
      // Create the database query promise
      const queryPromise = new Promise((resolve, reject) => {
        s.db.collection("paper_auto_buy").findOne(
          { selector: s.selector },
          function(err, result) {
            if (err) {
              reject(err)
            } else {
              resolve(result)
            }
          }
        )
      })
      
      // Race the promises
      const result = await Promise.race([queryPromise, timeoutPromise])
      
      if (result && result.executed) {
        if (s.options.debug_log) {
          debug.msg("AUTO BUY: Previously executed on " + new Date(result.time).toLocaleString())
        }
        return true
      }
      
      return false
    } catch (err) {
      // Just log and return false
      if (s.options.debug_log) {
        debug.msg(`AUTO BUY: Database query error: ${err.message}`)
      }
      return false
    }
  },

  /**
   * Reset database state
   * @param {Object} s - Strategy state object
   * @returns {Promise<void>}
   */
  resetDatabaseState: async function(s) {
    if (!s.db) {
      if (s.options.debug_log) {
        debug.msg("AUTO BUY: Database not available, cannot reset state")
      }
      return
    }
    
    try {
      await new Promise((resolve, reject) => {
        s.db.collection("paper_auto_buy").deleteOne(
          { selector: s.selector },
          function(err, result) {
            if (err) {
              reject(err)
            } else {
              resolve(result)
            }
          }
        )
      })
      
      if (s.options.debug_log) {
        debug.msg("AUTO BUY: Database state reset successfully")
      }
    } catch (err) {
      if (s.options.debug_log) {
        debug.msg(`AUTO BUY: Error resetting database state: ${err.message}`)
      }
      throw err
    }
  },

  /**
   * Update database state after execution
   * @param {Object} s - Strategy state object
   * @returns {Promise<void>}
   */
  updateDatabaseState: async function(s) {
    if (!s.db) {
      if (s.options.debug_log) {
        debug.msg("AUTO BUY: Database not available, cannot update state")
      }
      return
    }
    
    try {
      const stateData = { 
        selector: s.selector,
        executed: true, 
        time: new Date().getTime(),
        price: s.period.close
      }
      
      await new Promise((resolve, reject) => {
        s.db.collection("paper_auto_buy").updateOne(
          { selector: s.selector },
          { $set: stateData },
          { upsert: true },
          function(err, result) {
            if (err) {
              reject(err)
            } else {
              resolve(result)
            }
          }
        )
      })
      
      if (s.options.debug_log) {
        debug.msg("AUTO BUY: Database state updated successfully")
      }
    } catch (err) {
      if (s.options.debug_log) {
        debug.msg(`AUTO BUY: Error updating database state: ${err.message}`)
      }
      throw err
    }
  },

  /**
   * Take a snapshot of current balance for later verification
   * @param {Object} s - Strategy state object
   * @param {String} label - Label for the snapshot
   */
  takeBalanceSnapshot: function(s, label) {
    if (!s.balance) return;
    
    const snapshot = {
      time: new Date().getTime(),
      label: label || "snapshot",
      currency: s.balance.currency,
      asset: s.balance.asset
    };
    
    // Only keep two snapshots: initial and pre-execution
    if (label === "initial") {
      s.auto_buy_balance_snapshots = [snapshot];
    } else if (label === "pre_execution") {
      if (s.auto_buy_balance_snapshots.length > 0) {
        s.auto_buy_balance_snapshots[1] = snapshot;
      } else {
        s.auto_buy_balance_snapshots.push(snapshot);
      }
    }
    
    if (s.options.debug_log) {
      debug.msg(`AUTO BUY: Balance snapshot taken (${label}): ${snapshot.currency} ${s.currency_capital}, ${snapshot.asset} ${s.asset_capital}`);
    }
    
    return snapshot;
  },

  /**
   * Verify balance changes between snapshots
   * @param {Object} s - Strategy state object
   * @returns {Object} Verification result with changes
   */
  verifyBalanceChanges: function(s) {
    if (!s.auto_buy_balance_snapshots.length || !s.balance) return null;
    
    // Get the initial snapshot
    const initialSnapshot = s.auto_buy_balance_snapshots[0];
    
    // Calculate changes
    const currencyChange = initialSnapshot.currency !== null && s.balance.currency !== null ?
      (initialSnapshot.currency - s.balance.currency) / initialSnapshot.currency : 0;
    
    const assetChange = initialSnapshot.asset !== null && s.balance.asset !== null ?
      (s.balance.asset - initialSnapshot.asset) / (initialSnapshot.asset || 1) : 0;
    
    const result = {
      currencyChange,
      assetChange,
      currencyChangePercent: currencyChange * 100,
      assetChangePercent: assetChange * 100,
      fromTime: initialSnapshot.time,
      toTime: new Date().getTime(),
      significant: Math.abs(currencyChange) > s.options.auto_buy_min_balance_change / 100 || 
                  Math.abs(assetChange) > s.options.auto_buy_min_balance_change / 100
    };
    
    if (s.options.debug_log) {
      debug.msg(`AUTO BUY: Balance verification - currency change: ${result.currencyChangePercent.toFixed(2)}%, asset change: ${result.assetChangePercent.toFixed(2)}%`);
    }
    
    return result;
  },

  /**
   * Handle errors with proper logging
   * @param {Object} s - Strategy state object
   * @param {Error} err - The error object
   * @param {String} operation - The operation that failed
   */
  handleError: function(s, err, operation) {
    // Create error object
    const errorObj = {
      time: new Date().getTime(),
      operation: operation,
      message: err.message,
      state: s.auto_buy_state
    };
    
    // Update last error
    s.auto_buy_last_error = errorObj;
    
    // Log error
    if (s.options.debug_log) {
      debug.msg(`AUTO BUY ERROR: ${err.message} during ${operation}`);
    }
  },

  /**
   * Check if buy can be executed
   * @param {Object} s - Strategy state object
   * @returns {Boolean} True if buy can be executed
   */
  canExecuteBuy: function(s) {
    // Check if we already have a position
    if (s.balance && s.balance.asset && s.balance.asset > 0) {
      if (s.options.debug_log) {
        debug.msg("AUTO BUY: Skipping auto buy, existing position detected")
      }
      return false
    }
    
    // Check if we have enough balance
    if (!s.balance || typeof s.balance.currency === "undefined") {
      if (s.options.debug_log) {
        debug.msg("AUTO BUY: Cannot determine balance, waiting for balance data")
      }
      return false
    }
    
    if (s.balance.currency < s.options.auto_buy_min_balance) {
      if (s.options.debug_log) {
        debug.msg(`AUTO BUY: Insufficient balance (${s.balance.currency.toFixed(2)} < ${s.options.auto_buy_min_balance})`)
      }
      return false
    }
    
    // Check market conditions if enabled
    if (s.options.auto_buy_check_market && !this.isMarketFavorable(s)) {
      if (s.options.debug_log) {
        debug.msg("AUTO BUY: Waiting for favorable market conditions")
      }
      return false
    }
    
    return true
  },

  /**
   * Execute buy
   * @param {Object} s - Strategy state object
   */
  executeBuy: function(s) {
    if (s.options.debug_log) {
      debug.msg("AUTO BUY: Executing automatic buy at startup (paper trading mode)")
    }
    
    if (s.options.auto_buy_dry_run) {
      // Dry run mode - simulate execution
      if (s.options.debug_log) {
        debug.msg(`AUTO BUY: DRY RUN - Would buy ${s.options.auto_buy_pct * 100}% of funds at ${s.period.close}`)
      }
      
      // Mark as completed without actually setting signal
      s.auto_buy_state = AUTO_BUY_STATES.COMPLETED
      s.auto_buy_executed = true
    } else {
      // Real execution
      s.signal = "buy"
      s.buy_pct = s.options.auto_buy_pct
      
      // Take pre-execution balance snapshot
      this.takeBalanceSnapshot(s, "pre_execution")
      
      s.auto_buy_execution_time = new Date().getTime()
    }
  },

  /**
   * Monitor execution
   * @param {Object} s - Strategy state object
   */
  monitorExecution: function(s) {
    try {
      // If we're in executing state and signal is gone, move to monitoring
      if (s.auto_buy_state === AUTO_BUY_STATES.EXECUTING && !s.signal) {
        s.auto_buy_state = AUTO_BUY_STATES.MONITORING
        s.auto_buy_monitoring_start = new Date().getTime()
        
        if (s.options.debug_log) {
          debug.msg(`AUTO BUY: Signal processed, monitoring for execution confirmation`)
        }
      }
      
      // If we're monitoring, check for balance changes
      if (s.auto_buy_state === AUTO_BUY_STATES.MONITORING) {
        // Check for balance changes
        const changes = this.verifyBalanceChanges(s)
        
        // If we detect significant changes, consider it executed
        if (changes && changes.significant) {
          s.auto_buy_state = AUTO_BUY_STATES.COMPLETED
          s.auto_buy_executed = true
          
          // Update state in database
          this.updateDatabaseState(s).catch(err => {
            debug.msg(`AUTO BUY: Error updating database: ${err.message}`)
          })
          
          if (s.options.debug_log) {
            debug.msg(`AUTO BUY: Execution confirmed via balance changes`)
            debug.msg(`AUTO BUY: Currency changed by ${changes.currencyChangePercent.toFixed(2)}%, asset changed by ${changes.assetChangePercent.toFixed(2)}%`)
          }
          
          return
        }
        
        // Check for timeout
        const currentTime = new Date().getTime()
        const monitoringTime = currentTime - s.auto_buy_monitoring_start
        
        // After monitoring timeout, assume it executed
        const timeoutSeconds = s.options.auto_buy_verification_timeout || 300
        if (monitoringTime > timeoutSeconds * 1000) {
          s.auto_buy_state = AUTO_BUY_STATES.COMPLETED
          s.auto_buy_executed = true
          
          // Update state in database
          this.updateDatabaseState(s).catch(err => {
            debug.msg(`AUTO BUY: Error updating database: ${err.message}`)
          })
          
          if (s.options.debug_log) {
            debug.msg(`AUTO BUY: Execution assumed after ${Math.round(monitoringTime/1000)}s monitoring timeout`)
          }
          
          return
        }
      }
    } catch (err) {
      this.handleError(s, err, "monitorExecution")
    }
  },

  /**
   * Check if market conditions are favorable for buying
   * @param {Object} s - Strategy state object
   * @returns {Boolean} True if market conditions are favorable
   */
  isMarketFavorable: function(s) {
    try {
      const overrides = s.options.auto_buy_override_market_check.split(",").map(o => o.trim())
      
      // Check for override
      if (overrides.includes("all")) {
        if (s.options.debug_log) {
          debug.msg("AUTO BUY: Market check overridden (all)")
        }
        return true
      }
      
      const skipUptrend = overrides.includes("uptrend")
      const skipVolatility = overrides.includes("volatility")
      const skipIndicators = overrides.includes("indicators")
      
      // If all specific checks are overridden, return true
      if (skipUptrend && skipVolatility && skipIndicators) {
        if (s.options.debug_log) {
          debug.msg("AUTO BUY: All specific market checks overridden")
        }
        return true
      }
      
      // Determine market type if set to auto
      let marketType = s.options.auto_buy_market_type
      if (marketType === "auto") {
        // Calculate market metrics
        const volatility = s.market_volatility || 0
        
        if (volatility > 1.5) {
          marketType = "volatile"
        } else if (volatility > 0.5) {
          marketType = "trending"
        } else {
          marketType = "ranging"
        }
      }
      
      // Apply market-specific checks
      if (!skipUptrend) {
        // Count consecutive up periods
        let upPeriods = 0
        for (let i = 0; i < s.options.auto_buy_min_uptrend_periods; i++) {
          if (s.lookback[i] && s.lookback[i+1] && s.lookback[i].close > s.lookback[i+1].close) {
            upPeriods++
          } else {
            break
          }
        }
        
        // Check if we have enough consecutive up periods
        if (upPeriods < s.options.auto_buy_min_uptrend_periods) {
          if (s.options.debug_log) {
            debug.msg(`AUTO BUY: Not enough consecutive up periods (${upPeriods}/${s.options.auto_buy_min_uptrend_periods})`)
          }
          return false
        }
      }
      
      if (!skipVolatility) {
        // Check for excessive price change (volatility)
        if (s.lookback[0] && s.lookback[1]) {
          const priceChange = Math.abs(s.lookback[0].close - s.lookback[1].close) / s.lookback[1].close * 100
          if (priceChange > s.options.auto_buy_max_price_change) {
            if (s.options.debug_log) {
              debug.msg(`AUTO BUY: Price change too high (${priceChange.toFixed(2)}% > ${s.options.auto_buy_max_price_change}%)`)
            }
            return false
          }
        }
      }
      
      // Check standard deviation and mean signals
      if (!skipIndicators) {
        if (s.sig0 === "Down" || s.sig1 === "Down") {
          if (s.options.debug_log) {
            debug.msg(`AUTO BUY: Market indicators not favorable (std: ${s.sig0}, mean: ${s.sig1})`)
          }
          return false
        }
      }
      
      return true
    } catch (err) {
      this.handleError(s, err, "isMarketFavorable")
      
      // Default to true on error to avoid blocking auto buy
      return true
    }
  },

  /**
   * Validate configuration with fallbacks
   * @param {Object} s - Strategy state object
   * @returns {Object} Validation result
   */
  validateConfiguration: function(s) {
    const warnings = []
    const errors = []
    
    // Validate auto_buy_pct with fallback
    if (s.options.auto_buy_pct <= 0 || s.options.auto_buy_pct > 1) {
      errors.push(`auto_buy_pct must be between 0 and 1, got ${s.options.auto_buy_pct}. Using default of 0.95.`)
      s.options.auto_buy_pct = 0.95 // Fallback to default
    }
    
    // Validate auto_buy_wait_periods with fallback
    if (s.options.auto_buy_wait_periods < 0) {
      errors.push(`auto_buy_wait_periods must be non-negative, got ${s.options.auto_buy_wait_periods}. Using default of 3.`)
      s.options.auto_buy_wait_periods = 3 // Fallback to default
    }
    
    // Validate auto_buy_min_balance with fallback
    if (s.options.auto_buy_min_balance < 0) {
      errors.push(`auto_buy_min_balance must be non-negative, got ${s.options.auto_buy_min_balance}. Using default of 10.`)
      s.options.auto_buy_min_balance = 10 // Fallback to default
    }
    
    // Validate auto_buy_min_uptrend_periods with fallback
    if (s.options.auto_buy_min_uptrend_periods < 0) {
      errors.push(`auto_buy_min_uptrend_periods must be non-negative, got ${s.options.auto_buy_min_uptrend_periods}. Using default of 2.`)
      s.options.auto_buy_min_uptrend_periods = 2 // Fallback to default
    }
    
    // Validate auto_buy_max_price_change with fallback
    if (s.options.auto_buy_max_price_change < 0) {
      errors.push(`auto_buy_max_price_change must be non-negative, got ${s.options.auto_buy_max_price_change}. Using default of 1.0.`)
      s.options.auto_buy_max_price_change = 1.0 // Fallback to default
    }
    
    // Validate auto_buy_market_type with fallback
    const validMarketTypes = ["auto", "trending", "ranging", "volatile"]
    if (!validMarketTypes.includes(s.options.auto_buy_market_type)) {
      errors.push(`auto_buy_market_type must be one of ${validMarketTypes.join(", ")}, got ${s.options.auto_buy_market_type}. Using default of "auto".`)
      s.options.auto_buy_market_type = "auto" // Fallback to default
    }
    
    // Validate auto_buy_verification_timeout with fallback
    if (s.options.auto_buy_verification_timeout <= 0) {
      errors.push(`auto_buy_verification_timeout must be positive, got ${s.options.auto_buy_verification_timeout}. Using default of 300.`)
      s.options.auto_buy_verification_timeout = 300 // Fallback to default
    }
    
    // Validate auto_buy_min_balance_change with fallback
    if (s.options.auto_buy_min_balance_change < 0) {
      errors.push(`auto_buy_min_balance_change must be non-negative, got ${s.options.auto_buy_min_balance_change}. Using default of 0.5.`)
      s.options.auto_buy_min_balance_change = 0.5 // Fallback to default
    }
    
    // Log warnings and errors
    warnings.forEach(warning => {
      debug.msg(`AUTO BUY WARNING: ${warning}`)
    })
    
    errors.forEach(error => {
      debug.msg(`AUTO BUY ERROR: ${error}`)
    })
    
    return {
      valid: true, // Always return valid since we apply fallbacks
      warnings,
      errors,
      applied_fallbacks: errors.length > 0
    }
  },

  /**
   * Async function to check and execute auto buy
   * @param {Object} s - Strategy state object
   * @returns {Promise<void>}
   */
  checkAndExecuteAutoBuy: async function(s) {
    // Add enhanced debug output at the beginning of the function
    if (s.options.debug_log) {
      debug.msg(`AUTO BUY: Current state: ${s.auto_buy_state}, executed: ${s.auto_buy_executed}, paper mode: ${s.options.paper}, auto_buy_at_start: ${s.options.auto_buy_at_start}`)
      debug.msg(`AUTO BUY: Parameters - wait_periods: ${s.options.auto_buy_wait_periods}, pct: ${s.options.auto_buy_pct}, check_market: ${s.options.auto_buy_check_market}, force: ${s.options.auto_buy_force}`)
    }
    
    // Check for mutex timeout and auto-release if needed
    this.checkMutexTimeout(s)
    
    // Acquire mutex with timeout
    if (!this.acquireMutex(s, 5000)) {
      if (s.options.debug_log) {
        debug.msg("AUTO BUY: Could not acquire mutex, skipping this cycle")
      }
      return
    }
    
    try {
      // State machine with simplified logic
      switch (s.auto_buy_state) {
        case AUTO_BUY_STATES.INIT:
          // Check if already executed
          const executed = await this.checkExecutionState(s)
          
          if (executed && !s.options.auto_buy_force) {
            s.auto_buy_state = AUTO_BUY_STATES.COMPLETED
            break
          }
          
          // Take initial balance snapshot
          this.takeBalanceSnapshot(s, "initial")
          
          // Move to waiting state
          s.auto_buy_state = AUTO_BUY_STATES.WAITING
          s.auto_buy_counter = 0
          break
          
        case AUTO_BUY_STATES.WAITING:
          // Increment counter
          s.auto_buy_counter++
          
          // Check if we've waited enough periods or immediate execution is enabled
          if (s.auto_buy_counter >= s.options.auto_buy_wait_periods || s.options.auto_buy_immediate) {
            // Check conditions before executing
            if (this.canExecuteBuy(s)) {
              // Execute buy
              this.executeBuy(s)
              s.auto_buy_state = AUTO_BUY_STATES.EXECUTING
            }
          }
          break
          
        case AUTO_BUY_STATES.EXECUTING:
        case AUTO_BUY_STATES.MONITORING:
          // Monitor execution
          this.monitorExecution(s)
          break
          
        case AUTO_BUY_STATES.COMPLETED:
        case AUTO_BUY_STATES.FAILED:
          // Nothing to do in these terminal states
          break
      }
    } catch (err) {
      this.handleError(s, err, "checkAndExecuteAutoBuy")
      s.auto_buy_state = AUTO_BUY_STATES.FAILED
    } finally {
      // Always release mutex
      this.releaseMutex(s)
    }
    
    // Add status reporting after auto buy check
    if (s.options.paper && s.options.auto_buy_at_start && s.options.debug_log) {
      debug.msg(`AUTO BUY: Status after check - state: ${s.auto_buy_state}, executed: ${s.auto_buy_executed}, counter: ${s.auto_buy_counter}`)
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
  onPeriod: async function (s, cb) {
    try {
      // Initialize strategy state if needed
      if (!s.cache) {
        this.init(s)
      }
      
      // Reset auto buy state if force flag is enabled (moved to beginning)
      if (s.options.paper && s.options.auto_buy_at_start && s.options.auto_buy_force) {
        if (s.options.debug_log) {
          debug.msg("AUTO BUY: Force flag enabled, resetting execution state at beginning of cycle")
        }
        s.auto_buy_executed = false
        s.auto_buy_state = AUTO_BUY_STATES.INIT
        
        // Reset database state immediately
        await this.resetDatabaseState(s)
      }
      
      // Auto buy at startup for paper trading
      if (s.options.paper && s.options.auto_buy_at_start && 
          s.auto_buy_state !== AUTO_BUY_STATES.COMPLETED && 
          s.auto_buy_state !== AUTO_BUY_STATES.FAILED &&
          s.lookback.length >= s.options.min_periods) {
        
        await this.checkAndExecuteAutoBuy(s)
      }

      // Performance monitoring start
      const start_time = s.options.fast_execution ? new Date().getTime() : 0

      // Initialize EMA if configured
      ema(s, "stddev", s.options.stddev)

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
          // 1. Price change is minimal (less than 0.05%)
          // 2. No active trades or signals
          // 3. Not in a high volatility period
          if (s.cache.price_change_pct < 0.0005 && !s.signal && !s.buy_order && !s.sell_order && 
              (!s.market_volatility || s.market_volatility < 0.01)) {
            if (s.options.debug_log && s.cache.tick_count % 10 === 0) {
              debug.msg(`Skipping calculation (tick ${s.cache.tick_count}, last calc: ${s.cache.last_calculated_tick}, price change: ${(s.cache.price_change_pct * 100).toFixed(3)}%)`)
            }
            s.performance.calculations_skipped++
            
            // Check for buy execution even when skipping calculations
            if (s.auto_buy_state === AUTO_BUY_STATES.EXECUTING || s.auto_buy_state === AUTO_BUY_STATES.MONITORING) {
              this.monitorExecution(s)
            }
            
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
          debug.msg("Not enough data yet, waiting for more periods")
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
        debug.msg("Error collecting price data: " + e.message)
        return cb()
      }

      // Calculate standard deviation without division (increased sensitivity)
      s.std0 = stats.stdev(tl0)
      s.std1 = stats.stdev(tl1)

      // Calculate means
      s.mean0 = math.mean(tl0)
      s.mean1 = math.mean(tl1)

      // Basic signals (same as original strategy)
      s.sig0 = s.std0 > s.std1 ? "Up" : "Down"
      s.sig1 = s.mean0 > s.mean1 ? "Up" : "Down"

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
        if (s.sig1 === "Down" && !s.signal) {  // Only set if not already set
          s.signal = "sell"
          if (s.options.debug_log) {
            debug.msg(`SELL signal generated: mean trend down (${s.mean0.toFixed(4)} < ${s.mean1.toFixed(4)})`)
          }
        }
        // Buy logic (basic)
        else if (s.sig0 === "Up" && s.sig1 === "Up" && !s.signal) {  // Only set if not already set
          s.signal = "buy"
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
        if (s.sig1 === "Down" && !s.signal) {  // Only set if not already set
          s.signal = "sell"
          if (s.options.debug_log) {
            debug.msg(`SELL signal generated: mean trend down (${s.mean0.toFixed(4)} < ${s.mean1.toFixed(4)})`)
          }
        }
        // Advanced buy logic with scoring system
        else if ((buy_score > buy_threshold || (buy_score > buy_threshold * 0.8 && s.buy_signals >= 2)) && !s.signal) {  // Only set if not already set
          s.signal = "buy"

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
      
      // Check for auto buy execution
      if (s.auto_buy_state === AUTO_BUY_STATES.EXECUTING || s.auto_buy_state === AUTO_BUY_STATES.MONITORING) {
        this.monitorExecution(s)
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
      debug.msg("Strategy execution error: " + err.message)
      console.error("Strategy execution error:", err)
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
        short: { ema: s.mean1, direction: "neutral", strength: 0 },
        medium: { ema: s.mean1, direction: "neutral", strength: 0 },
        long: { ema: s.mean1, direction: "neutral", strength: 0 }
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
      s.trends.short.direction = s.mean1 > s.trends.short.ema ? "up" : "down"
      s.trends.short.strength = Math.abs(s.mean1 / s.trends.short.ema - 1) * 100

      // Medium-term trend
      s.trends.medium.ema = s.trends.medium.ema * 0.9 + s.mean1 * 0.1
      s.trends.medium.direction = s.mean1 > s.trends.medium.ema ? "up" : "down"
      s.trends.medium.strength = Math.abs(s.mean1 / s.trends.medium.ema - 1) * 100

      // Long-term trend (slower response)
      s.trends.long.ema = s.trends.long.ema * 0.95 + s.mean1 * 0.05
      s.trends.long.direction = s.mean1 > s.trends.long.ema ? "up" : "down"
      s.trends.long.strength = Math.abs(s.mean1 / s.trends.long.ema - 1) * 100

      // Calculate trend alignment score (higher when trends align)
      s.trend_alignment = 0
      if (s.trends.short.direction === "up") s.trend_alignment++
      if (s.trends.medium.direction === "up") s.trend_alignment++
      if (s.trends.long.direction === "up") s.trend_alignment++

      // Calculate weighted trend strength
      s.trend_strength = (
        s.trends.short.strength * 0.5 +
        s.trends.medium.strength * 0.3 +
        s.trends.long.strength * 0.2
      )
    } catch (err) {
      debug.msg("Error updating trends: " + err.message)
    }
  },

  /**
   * Initialize volume tracking data structures
   * @param {Object} s - Strategy state object
   */
  initVolume: function(s) {
    if (!s.volume) {
      s.volume = {
        ema: 0,
        trend: "neutral",
        strength: 0,
        spikes: []
      }
    }
  },

  /**
   * Update volume indicators
   * @param {Object} s - Strategy state object
   */
  updateVolume: function(s) {
    try {
      this.initVolume(s)

      // Get current volume
      let current_volume = 0
      if (s.lookback[0] && s.lookback[0].volume) {
        current_volume = s.lookback[0].volume
      }

      // Initialize volume EMA if needed
      if (s.volume.ema === 0 && current_volume > 0) {
        s.volume.ema = current_volume
      }

      // Update volume EMA
      if (current_volume > 0) {
        s.volume.ema = s.volume.ema * 0.9 + current_volume * 0.1
      }

      // Determine volume trend
      s.volume.trend = current_volume > s.volume.ema * 1.5 ? "up" :
                      current_volume < s.volume.ema * 0.5 ? "down" : "neutral"

      // Calculate volume strength
      s.volume.strength = s.volume.ema > 0 ? current_volume / s.volume.ema : 0

      // Track volume spikes (last 10 periods)
      s.volume.spikes.unshift(s.volume.strength > 1.5)
      if (s.volume.spikes.length > 10) {
        s.volume.spikes.pop()
      }
    } catch (err) {
      debug.msg("Error updating volume: " + err.message)
    }
  },

  /**
   * Check if volume confirms buy signal
   * @param {Object} s - Strategy state object
   * @returns {Boolean} True if volume confirms buy
   */
  volumeConfirmsBuy: function(s) {
    try {
      if (!s.volume) return true

      // Volume spike in last 3 periods is bullish
      let recent_spike = false
      for (let i = 0; i < 3 && i < s.volume.spikes.length; i++) {
        if (s.volume.spikes[i]) {
          recent_spike = true
          break
        }
      }

      // Volume trend is up or we had a recent spike
      return s.volume.trend === "up" || recent_spike
    } catch (err) {
      debug.msg("Error in volume confirmation: " + err.message)
      return true
    }
  },

  /**
   * Calculate buy signal score based on multiple factors
   * @param {Object} s - Strategy state object
   * @returns {Number} Buy score (higher is stronger buy signal)
   */
  calculateBuyScore: function(s) {
    try {
      let score = 0

      // Base score from standard deviation and mean signals
      if (s.sig0 === "Up") score += 30
      if (s.sig1 === "Up") score += 30

      // Trend alignment bonus
      score += s.trend_alignment * 10

      // Trend strength bonus
      score += Math.min(s.trend_strength * 2, 20)

      // Volume confirmation bonus
      if (s.options.enable_volume_integration && this.volumeConfirmsBuy(s)) {
        score += 10
      }

      // Market volatility adjustment
      if (s.market_volatility > 0.02) {
        // Higher volatility requires stronger signals
        score *= (1 - Math.min(s.market_volatility * 5, 0.5))
      }

      return score
    } catch (err) {
      debug.msg("Error calculating buy score: " + err.message)
      return 0
    }
  },

  /**
   * Calculate buy threshold based on market conditions
   * @param {Object} s - Strategy state object
   * @returns {Number} Buy threshold
   */
  calculateBuyThreshold: function(s) {
    try {
      // Base threshold
      let threshold = 50

      // Adjust for market volatility
      if (s.market_volatility > 0) {
        threshold += s.market_volatility * 100
      }

      return threshold
    } catch (err) {
      debug.msg("Error calculating buy threshold: " + err.message)
      return 50
    }
  },

  /**
   * Calculate adaptive position size based on signal strength
   * @param {Object} s - Strategy state object
   * @returns {Number} Position size as decimal percentage (0-1)
   */
  calculatePositionSize: function(s) {
    try {
      if (!s.options.enable_adaptive_sizing) return 1.0

      // Base position size on signal strength
      let buy_score = s.buy_score || this.calculateBuyScore(s)
      let buy_threshold = s.buy_threshold || this.calculateBuyThreshold(s)

      // Calculate position size (50% to 100%)
      let position_size = 0.5 + 0.5 * Math.min(Math.max((buy_score - buy_threshold) / 50, 0), 1)

      return position_size
    } catch (err) {
      debug.msg("Error calculating position size: " + err.message)
      return 1.0
    }
  }
}
