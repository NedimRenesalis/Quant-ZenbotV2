# Zenbot Trading Strategy ProfitCommandManual - Part 3 of 6

## Iteration 3: Market Adaptation

In Iterations 1 and 2, we implemented core fixes and enhanced state management. In this third iteration, we'll focus on market adaptation to make the trading strategy more responsive to changing market conditions and improve race condition handling.

### Optimizing Market Adaptation

Let's implement a market adaptation system that can detect different market conditions and adjust trading parameters accordingly:

1. Open `extensions/strategies/stddev/strategy.js` in VS Code:

```bash
code extensions/strategies/stddev/strategy.js
```

2. Add market condition detection functions:

```javascript
// Add to strategy.js - new market condition detection functions
function detectMarketCondition(s) {
  // Initialize market condition tracking if not exists
  if (!s.market_condition) {
    s.market_condition = {
      type: 'unknown',
      confidence: 0,
      duration: 0,
      last_change: 0,
      history: []
    }
  }
  
  // Ensure we have enough data
  if (s.lookback.length < 30) {
    return s.market_condition
  }
  
  // Get recent price data
  let prices = s.lookback.slice(0, 30).map(period => period.close).reverse()
  
  // Calculate metrics for market condition detection
  let metrics = calculateMarketMetrics(prices)
  
  // Determine market condition based on metrics
  let condition = classifyMarketCondition(metrics)
  
  // Update market condition tracking
  if (condition.type !== s.market_condition.type) {
    // Market condition changed
    s.market_condition.last_change = s.period.latest_trade_time
    s.market_condition.duration = 0
    s.market_condition.history.push({
      type: s.market_condition.type,
      duration: s.market_condition.duration,
      end_time: s.period.latest_trade_time
    })
    
    // Keep history to a reasonable size
    if (s.market_condition.history.length > 10) {
      s.market_condition.history.shift()
    }
    
    // Log market condition change
    console.log((`\nMarket condition changed from ${s.market_condition.type} to ${condition.type} (confidence: ${condition.confidence.toFixed(2)})\n`).cyan)
  } else {
    // Same market condition, increase duration
    s.market_condition.duration++
  }
  
  // Update current market condition
  s.market_condition.type = condition.type
  s.market_condition.confidence = condition.confidence
  
  return s.market_condition
}

function calculateMarketMetrics(prices) {
  // Calculate various metrics to determine market condition
  let metrics = {}
  
  // Calculate price changes
  let changes = []
  for (let i = 1; i < prices.length; i++) {
    changes.push((prices[i] - prices[i-1]) / prices[i-1])
  }
  
  // Calculate directional movement
  let up_moves = changes.filter(change => change > 0).length
  let down_moves = changes.filter(change => change < 0).length
  metrics.direction_ratio = up_moves / (up_moves + down_moves)
  
  // Calculate trend strength
  let start_price = prices[0]
  let end_price = prices[prices.length - 1]
  metrics.overall_change = (end_price - start_price) / start_price
  
  // Calculate volatility
  let sum = changes.reduce((a, b) => a + b, 0)
  let mean = sum / changes.length
  let variance = changes.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / changes.length
  metrics.volatility = Math.sqrt(variance)
  
  // Calculate range as percentage of average price
  let max_price = Math.max(...prices)
  let min_price = Math.min(...prices)
  let avg_price = prices.reduce((a, b) => a + b, 0) / prices.length
  metrics.range_pct = (max_price - min_price) / avg_price
  
  // Calculate momentum
  let momentum = 0
  for (let i = 0; i < changes.length; i++) {
    momentum += changes[i] * (i + 1) // Weight recent changes more heavily
  }
  metrics.momentum = momentum / ((changes.length * (changes.length + 1)) / 2) // Normalize
  
  return metrics
}

function classifyMarketCondition(metrics) {
  // Classify market condition based on metrics
  let condition = {
    type: 'unknown',
    confidence: 0
  }
  
  // Trending up
  let trending_up_score = 0
  trending_up_score += metrics.direction_ratio > 0.6 ? 0.3 : 0
  trending_up_score += metrics.overall_change > 0.01 ? 0.3 : 0
  trending_up_score += metrics.momentum > 0.001 ? 0.4 : 0
  
  // Trending down
  let trending_down_score = 0
  trending_down_score += metrics.direction_ratio < 0.4 ? 0.3 : 0
  trending_down_score += metrics.overall_change < -0.01 ? 0.3 : 0
  trending_down_score += metrics.momentum < -0.001 ? 0.4 : 0
  
  // Ranging
  let ranging_score = 0
  ranging_score += metrics.direction_ratio > 0.4 && metrics.direction_ratio < 0.6 ? 0.3 : 0
  ranging_score += Math.abs(metrics.overall_change) < 0.01 ? 0.3 : 0
  ranging_score += Math.abs(metrics.momentum) < 0.001 ? 0.4 : 0
  
  // Volatile
  let volatile_score = 0
  volatile_score += metrics.volatility > 0.005 ? 0.5 : 0
  volatile_score += metrics.range_pct > 0.03 ? 0.5 : 0
  
  // Determine the highest scoring condition
  let scores = [
    { type: 'trending_up', score: trending_up_score },
    { type: 'trending_down', score: trending_down_score },
    { type: 'ranging', score: ranging_score },
    { type: 'volatile', score: volatile_score }
  ]
  
  scores.sort((a, b) => b.score - a.score)
  
  // Set the highest scoring condition
  condition.type = scores[0].score > 0.5 ? scores[0].type : 'unknown'
  condition.confidence = scores[0].score
  
  return condition
}
```

3. Add adaptive parameter adjustment based on market conditions:

```javascript
// Add to strategy.js - new adaptive parameter adjustment function
function adjustParametersForMarketCondition(s) {
  // Default parameters
  let params = {
    sell_threshold: -0.1,
    buy_threshold: 0.1,
    signal_persistence_required: 1,
    stop_loss_pct: s.options.sell_stop_pct || 0.1,
    profit_take_pct: s.options.profit_stop_pct || 1.0
  }
  
  // Adjust based on market condition
  switch (s.market_condition.type) {
    case 'trending_up':
      // In uptrend, be more aggressive with buys, less with sells
      params.buy_threshold = 0.05
      params.sell_threshold = -0.15
      params.signal_persistence_required = 1
      params.stop_loss_pct = (s.options.sell_stop_pct || 0.1) * 1.2 // Wider stop loss
      params.profit_take_pct = (s.options.profit_stop_pct || 1.0) * 1.5 // Higher profit target
      break
      
    case 'trending_down':
      // In downtrend, be more conservative with buys, more aggressive with sells
      params.buy_threshold = 0.2
      params.sell_threshold = -0.05
      params.signal_persistence_required = 2 // Require more confirmation for buys
      params.stop_loss_pct = (s.options.sell_stop_pct || 0.1) * 0.8 // Tighter stop loss
      params.profit_take_pct = (s.options.profit_stop_pct || 1.0) * 0.8 // Lower profit target
      break
      
    case 'ranging':
      // In ranging market, use moderate settings
      params.buy_threshold = 0.1
      params.sell_threshold = -0.1
      params.signal_persistence_required = 1
      params.stop_loss_pct = s.options.sell_stop_pct || 0.1
      params.profit_take_pct = s.options.profit_stop_pct || 1.0
      break
      
    case 'volatile':
      // In volatile market, be more conservative overall
      params.buy_threshold = 0.15
      params.sell_threshold = -0.15
      params.signal_persistence_required = 2 // Require more confirmation
      params.stop_loss_pct = (s.options.sell_stop_pct || 0.1) * 1.5 // Wider stop loss
      params.profit_take_pct = (s.options.profit_stop_pct || 1.0) * 0.7 // Lower profit target
      break
      
    default:
      // Unknown market condition, use defaults
      break
  }
  
  // Apply confidence factor - adjust parameters based on confidence
  if (s.market_condition.confidence < 0.7) {
    // Lower confidence, move parameters closer to defaults
    let confidence_factor = s.market_condition.confidence / 0.7
    
    params.buy_threshold = params.buy_threshold * confidence_factor + 0.1 * (1 - confidence_factor)
    params.sell_threshold = params.sell_threshold * confidence_factor + (-0.1) * (1 - confidence_factor)
    params.signal_persistence_required = Math.round(params.signal_persistence_required * confidence_factor + 1 * (1 - confidence_factor))
    params.stop_loss_pct = params.stop_loss_pct * confidence_factor + (s.options.sell_stop_pct || 0.1) * (1 - confidence_factor)
    params.profit_take_pct = params.profit_take_pct * confidence_factor + (s.options.profit_stop_pct || 1.0) * (1 - confidence_factor)
  }
  
  // Store the adjusted parameters
  s.adjusted_params = params
  
  // Log parameter adjustments if debug logging is enabled
  if (s.options.debug_log && s.period.latest_trade_time % 10 === 0) {
    debug.msg(`Market condition: ${s.market_condition.type} (${s.market_condition.confidence.toFixed(2)}), ` +
      `Adjusted parameters: buy=${params.buy_threshold.toFixed(2)}, sell=${params.sell_threshold.toFixed(2)}, ` +
      `persistence=${params.signal_persistence_required}, stop=${params.stop_loss_pct.toFixed(2)}%, profit=${params.profit_take_pct.toFixed(2)}%`)
  }
  
  return params
}
```

4. Modify the `onPeriod` function to use market adaptation:

```javascript
// Modify strategy.js - onPeriod function
onPeriod: function(s, cb) {
  // Start performance tracking
  let start_time = new Date().getTime()
  
  // Detect market condition and adjust parameters
  if (s.options.enable_market_adaptation) {
    detectMarketCondition(s)
    adjustParametersForMarketCondition(s)
  }
  
  // ... existing calculation skipping logic ...
  
  // Calculate standard deviation and mean
  this.updateTrends(s)
  
  // ... existing signal generation logic ...
  
  // Apply adjusted parameters if market adaptation is enabled
  if (s.options.enable_market_adaptation && s.adjusted_params) {
    // Modify signal generation thresholds based on market condition
    if (s.sig1 === 'Down' && s.mean_diff < s.adjusted_params.sell_threshold && !s.signal) {
      s.signal = 'sell'
      if (s.options.debug_log) {
        debug.msg(`SELL signal generated: mean trend down (${s.mean0.toFixed(4)} < ${s.mean1.toFixed(4)}), ` +
          `diff: ${s.mean_diff.toFixed(4)}, threshold: ${s.adjusted_params.sell_threshold.toFixed(4)}`)
      }
    }
    else if (s.sig0 === 'Up' && s.sig1 === 'Up' && s.mean_diff > s.adjusted_params.buy_threshold && !s.signal) {
      s.signal = 'buy'
      if (s.options.debug_log) {
        debug.msg(`BUY signal generated: both std and mean trends up, ` +
          `diff: ${s.mean_diff.toFixed(4)}, threshold: ${s.adjusted_params.buy_threshold.toFixed(4)}`)
      }
    }
    
    // Set required signal persistence based on market condition
    if (s.signal) {
      s.signal_persistence_required = s.adjusted_params.signal_persistence_required
      if (s.options.debug_log) {
        debug.msg(`Signal persistence required: ${s.signal_persistence_required}`)
      }
    }
  }
  
  // ... rest of the function ...
  
  // End performance tracking
  let end_time = new Date().getTime()
  s.performance.calculation_time = end_time - start_time
  
  cb()
}
```

5. Add market adaptation options to the strategy:

```javascript
// Modify strategy.js - getOptions function
getOptions: function () {
  this.option('period', 'period length, optimized for faster simulation. Same as --period_length', String, '1m')
  this.option('period_length', 'period length, optimized for faster simulation. Same as --period', String, '1m')
  this.option('trendtrades_1', 'Trades for array 1 to be subtracted stddev and mean from', Number, 5)
  this.option('trendtrades_2', 'Trades for array 2 to be calculated stddev and mean from', Number, 30)
  this.option('min_periods', 'Minimum periods before trading', Number, 50)
  this.option('enable_adaptive_sizing', 'Enable adaptive position sizing based on signal quality', Boolean, false)
  this.option('enable_volume_integration', 'Enable volume confirmation for buy signals', Boolean, false)
  this.option('enable_weighted_scoring', 'Enable multi-factor weighted scoring system for buy signals', Boolean, false)
  this.option('enable_market_adaptation', 'Enable market condition detection and parameter adaptation', Boolean, true)  // Added option
  this.option('debug_log', 'Enable detailed debug logging for signal generation', Boolean, false)
  this.option('fast_execution', 'Enable execution time optimizations', Boolean, false)
  this.option('calculation_skip_ticks', 'Number of ticks to skip between full recalculations (0 = calculate every tick)', Number, 0)
  this.option('performance_report', 'Show performance metrics in console output', Boolean, true)
},
```

6. Open `conf.js` and add configuration parameters for market adaptation:

```bash
code conf.js
```

Add the following parameters:

```javascript
// In conf.js - add to the appropriate section
c.enable_market_adaptation = process.env.ZENBOT_ENABLE_MARKET_ADAPTATION === 'true'
c.market_adaptation_strength = process.env.ZENBOT_MARKET_ADAPTATION_STRENGTH ? parseFloat(process.env.ZENBOT_MARKET_ADAPTATION_STRENGTH) : 1.0
```

7. Open `commands/trade.js` and add command line options for market adaptation:

```bash
code commands/trade.js
```

Add the following options:

```javascript
// In trade.js - add to the appropriate section
.option('--enable_market_adaptation <true/false>', 'enable market condition detection and parameter adaptation', String, conf.enable_market_adaptation)
.option('--market_adaptation_strength <n>', 'strength of parameter adaptation (0.0-2.0)', Number, conf.market_adaptation_strength)
```

### Improved Race Condition Handling

Let's enhance the race condition handling to ensure proper coordination between signals:

1. Open `lib/engine.js` and update the signal processing logic:

```javascript
// Enhanced implementation in engine.js - withOnPeriod function
function withOnPeriod (trade, period_id, cb) {
  if (!clock && so.mode !== 'live' && so.mode !== 'paper') clock = lolex.install({ shouldAdvanceTime: false, now: trade.time })

  // Clear any stale signals at the beginning of each period
  if (s.signal && s.last_signal_time && (trade.time - s.last_signal_time) > (so.period_length * 2)) {
    console.log((`\nClearing stale ${s.signal} signal from ${moment(s.last_signal_time).format('YYYY-MM-DD HH:mm:ss')}\n`).yellow)
    s.signal = null
    s.acted_on_stop = false
  }

  updatePeriod(trade)
  if (!s.in_preroll) {
    if (so.mode !== 'live')
      s.exchange.processTrade(trade)

    if (!so.manual) {
      // Use a mutex to prevent race conditions in signal processing
      if (!s.signal_processing_mutex) {
        s.signal_processing_mutex = true
        
        try {
          // Check for stop loss conditions first
          let stop_result = executeStop(true)
          
          // Stop signals always take precedence over strategy signals
          if (stop_result.triggered) {
            s.last_signal_time = trade.time
            s.signal_source = 'stop'
            s.signal_reason = stop_result.reason
            
            // Log detailed stop information
            if (s.options.debug_log) {
              debug.msg(`Stop triggered: ${stop_result.type}, reason: ${stop_result.reason}`)
            }
          }

          if (clock) {
            var diff = trade.time - now()

            // Allow some catch-up if trades are too far apart. Don't want all calls happening at the same time
            while (diff > 5000) {
              clock.tick(5000)
              diff -= 5000
            }
            clock.tick(diff)
          }

          // Process signals with priority handling
          if (s.signal) {
            // Track signal source for analytics
            if (!s.signal_source) {
              s.signal_source = 'strategy'
            }
            
            // Add signal persistence during high volatility or based on market condition
            let persistence_required = 1
            
            if (s.signal_persistence_required) {
              persistence_required = s.signal_persistence_required
            } else if (s.market_volatility && s.market_volatility > 0.02) {
              persistence_required = 2
            }
            
            if (persistence_required > 1) {
              // For high volatility or specific market conditions, require signal persistence
              if (!s.signal_persistence) {
                s.signal_persistence = 1
                
                if (s.options.debug_log) {
                  debug.msg(`Requiring signal persistence: ${persistence_required} (current: ${s.signal_persistence})`)
                }
                
                // Don't execute yet, wait for persistence
                if (s.signal_persistence < persistence_required) {
                  s.last_signal_time = trade.time
                  s.signal_processing_mutex = false
                  cb()
                  return
                }
              } else {
                // Increment persistence counter if same signal type
                if (s.last_signal === s.signal) {
                  s.signal_persistence++
                  
                  if (s.options.debug_log) {
                    debug.msg(`Signal persistence increased: ${s.signal_persistence}/${persistence_required}`)
                  }
                  
                  // Execute if persistence threshold reached
                  if (s.signal_persistence >= persistence_required) {
                    executeSignal(s.signal)
                    s.signal = null
                    s.signal_persistence = 0
                    s.signal_source = null
                    s.signal_reason = null
                  } else {
                    // Not enough persistence yet
                    s.last_signal_time = trade.time
                    s.signal_processing_mutex = false
                    cb()
                    return
                  }
                } else {
                  // Signal changed, reset persistence
                  s.signal_persistence = 1
                  s.last_signal = s.signal
                  s.last_signal_time = trade.time
                  s.signal_processing_mutex = false
                  cb()
                  return
                }
              }
            } else {
              // Normal volatility, execute signal immediately
              executeSignal(s.signal)
              s.signal = null
              s.signal_persistence = 0
              s.signal_source = null
              s.signal_reason = null
            }
          }
        } catch (error) {
          console.error((`\nError in signal processing: ${error.message}\n`).red)
          s.debug.last_error = {
            time: now(),
            message: error.message,
            context: 'signal_processing'
          }
        } finally {
          // Always release the mutex
          s.signal_processing_mutex = false
        }
      } else {
        // Mutex is locked, skip this cycle
        if (s.options.debug_log) {
          debug.msg(`Signal processing mutex locked, skipping this cycle`)
        }
      }
    }
  }
  s.last_period_id = period_id
  cb()
}
```

2. Add a synchronized signal processing function:

```javascript
// Add to engine.js - new synchronizeSignalProcessing function
function synchronizeSignalProcessing() {
  // Reset mutex if it's been locked for too long
  if (s.signal_processing_mutex && s.last_mutex_time) {
    let mutex_duration = now() - s.last_mutex_time
    
    // If mutex has been locked for more than 5 seconds, force reset
    if (mutex_duration > 5000) {
      console.error((`\nForce resetting signal processing mutex after ${mutex_duration}ms\n`).red)
      s.signal_processing_mutex = false
      s.debug.last_warning = {
        time: now(),
        message: `Force reset signal processing mutex after ${mutex_duration}ms`,
        context: 'mutex_timeout'
      }
    }
  }
  
  // Update mutex timestamp if locked
  if (s.signal_processing_mutex) {
    s.last_mutex_time = now()
  }
}
```

3. Add mutex initialization to the state initialization function:

```javascript
// Add to engine.js - initializeState function
function initializeState() {
  // ... existing initialization code ...
  
  // Signal processing synchronization
  s.signal_processing_mutex = false
  s.last_mutex_time = null
  s.signal_persistence_required = 1
  
  // ... rest of the function ...
}
```

### Testing and Validating Changes - Iteration 3

After implementing these changes, let's create a test script to validate them:

```bash
# Create a test configuration file for Iteration 3
cp conf.js conf.test.iteration3.js

# Open the test configuration in VS Code
code conf.test.iteration3.js
```

In VS Code, modify the test configuration to include the following settings:

```javascript
// In conf.test.iteration3.js - modify the following settings
c.mode = 'paper'  // Use paper trading for testing
c.debug = true    // Enable detailed logging
c.sell_stop_pct = 0.1  // Set a tight stop loss for testing
c.buy_stop_pct = 0.1   // Set a tight buy stop for testing
c.profit_stop_enable_pct = 5  // Enable profit taking at 5%
c.profit_stop_pct = 1  // Set a 1% trailing stop
c.fast_execution = false  // Disable calculation skipping by default
c.calculation_skip_ticks = 0  // Calculate every tick
c.save_state = true  // Enable state persistence
c.state_dir = './state_test'  // Use a test directory for state files
c.enable_market_adaptation = true  // Enable market adaptation
c.market_adaptation_strength = 1.0  // Set market adaptation strength
```

Create a shell script to automate testing:

```bash
# Create a test script for Iteration 3
cat > test_iteration3_comprehensive.sh << 'EOF'
#!/bin/bash

# Comprehensive test script for Zenbot Iteration 3
echo "Starting Zenbot Iteration 3 comprehensive testing..."

# Setup
mkdir -p ./state_test
echo "Created state directory for testing"

# Test 1: Market Condition Detection
echo "Test 1: Market Condition Detection"
echo "Running with market adaptation enabled..."
./zenbot.sh sim --conf=conf.test.iteration3.js --strategy=stddev --paper --enable_market_adaptation=true --debug_log=true --days=14 > test3_1_results.log
echo "Check test3_1_results.log for market condition detection"
grep "Market condition" test3_1_results.log
echo ""

# Test 2: Parameter Adaptation
echo "Test 2: Parameter Adaptation"
echo "Running with parameter adaptation..."
./zenbot.sh sim --conf=conf.test.iteration3.js --strategy=stddev --paper --enable_market_adaptation=true --market_adaptation_strength=1.0 --debug_log=true --days=7 > test3_2_results.log
echo "Check test3_2_results.log for parameter adaptation"
grep "Adjusted parameters" test3_2_results.log
echo ""

# Test 3: Signal Persistence
echo "Test 3: Signal Persistence"
echo "Running with signal persistence..."
./zenbot.sh sim --conf=conf.test.iteration3.js --strategy=stddev --paper --enable_market_adaptation=true --debug_log=true --days=5 > test3_3_results.log
echo "Check test3_3_results.log for signal persistence"
grep "Signal persistence" test3_3_results.log
echo ""

# Test 4: Race Condition Handling
echo "Test 4: Race Condition Handling"
echo "Running with race condition handling..."
./zenbot.sh sim --conf=conf.test.iteration3.js --strategy=stddev --paper --debug_log=true --days=3 > test3_4_results.log
echo "Check test3_4_results.log for mutex handling"
grep "mutex" test3_4_results.log
echo ""

# Test 5: Integration Test
echo "Test 5: Integration Test"
echo "Running with all enhancements enabled..."
./zenbot.sh sim --conf=conf.test.iteration3.js --strategy=stddev --paper --sell_stop_pct=0.1 --profit_stop_enable_pct=5 --profit_stop_pct=1 --enable_market_adaptation=true --market_adaptation_strength=1.0 --debug_log=true --save_state=true --days=30 > test3_5_results.log
echo "Check test3_5_results.log for overall behavior"
echo ""

# Test 6: Performance Comparison
echo "Test 6: Performance Comparison"
echo "Comparing performance with Iteration 2..."
./zenbot.sh sim --conf=conf.test.iteration3.js --strategy=stddev --paper --sell_stop_pct=0.1 --profit_stop_enable_pct=5 --profit_stop_pct=1 --enable_market_adaptation=true --market_adaptation_strength=1.0 --days=30 --analyze > iteration3_performance.log
echo "Check iteration3_performance.log for performance metrics"
echo ""

# Test 7: Stress Test
echo "Test 7: Stress Test"
echo "Running with high frequency data..."
./zenbot.sh sim --conf=conf.test.iteration3.js --strategy=stddev --paper --period=1m --debug_log=true --days=3 > test3_7_results.log
echo "Check test3_7_results.log for performance under stress"
echo ""

echo "Testing complete. Review the log files for detailed results."
EOF

# Make the test script executable
chmod +x test_iteration3_comprehensive.sh
```

Run the test script and verify the enhancements:

```bash
# Run the test script
./test_iteration3_comprehensive.sh

# Check for market condition detection
grep "Market condition" test3_1_results.log

# Check for parameter adaptation
grep "Adjusted parameters" test3_2_results.log

# Check for signal persistence
grep "Signal persistence" test3_3_results.log

# Check for mutex handling
grep "mutex" test3_4_results.log

# Check overall performance
./zenbot.sh sim --conf=conf.test.iteration3.js --strategy=stddev --paper --sell_stop_pct=0.1 --profit_stop_enable_pct=5 --profit_stop_pct=1 --enable_market_adaptation=true --market_adaptation_strength=1.0 --days=30 --analyze
```

If all tests pass, commit the changes:

```bash
# Add the modified files to the staging area
git add lib/engine.js extensions/strategies/stddev/strategy.js conf.js commands/trade.js

# Commit the changes
git commit -m "Iteration 3: Optimized market adaptation and improved race condition handling"
```

### Running in Production

To run the fixed version in production:

```bash
# Run with paper trading first to verify everything works
./zenbot.sh trade --strategy=stddev --paper --sell_stop_pct=0.1 --profit_stop_enable_pct=5 --profit_stop_pct=1 --enable_market_adaptation=true --market_adaptation_strength=1.0 --save_state=true

# When satisfied, run in live mode
./zenbot.sh trade --strategy=stddev --sell_stop_pct=0.1 --profit_stop_enable_pct=5 --profit_stop_pct=1 --enable_market_adaptation=true --market_adaptation_strength=1.0 --save_state=true
```

### Troubleshooting

If you encounter issues:

1. Check the log files for error messages
2. Verify that all code changes were applied correctly
3. Ensure the configuration parameters are set correctly
4. Try running with `--debug_log=true` for more detailed logging
5. Check the state files in the state directory for any corruption
6. If market adaptation is causing issues, try reducing the adaptation strength with `--market_adaptation_strength=0.5`

### Performance Tuning

To optimize performance:

1. Adjust the calculation skipping parameters:
   ```bash
   ./zenbot.sh trade --strategy=stddev --fast_execution=true --calculation_skip_ticks=3
   ```

2. Adjust the market adaptation strength:
   ```bash
   ./zenbot.sh trade --strategy=stddev --enable_market_adaptation=true --market_adaptation_strength=0.8
   ```

3. Adjust the signal persistence requirements:
   ```bash
   # This is controlled automatically by market adaptation, but you can influence it by adjusting market_adaptation_strength
   ```

4. Adjust the stop loss and profit taking parameters:
   ```bash
   ./zenbot.sh trade --strategy=stddev --sell_stop_pct=0.15 --profit_stop_enable_pct=4 --profit_stop_pct=0.8
   ```

This completes Part 3 of the ProfitCommandManual, covering market adaptation and race condition handling improvements for your Zenbot trading strategy. In Part 4, we'll continue with production hardening and comprehensive logging.
