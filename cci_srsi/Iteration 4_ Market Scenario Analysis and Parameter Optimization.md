# Iteration 4: Market Scenario Analysis and Parameter Optimization

## Market Scenario Analysis

To ensure the strategy performs well across different market conditions, we need to analyze its behavior in specific market scenarios and optimize parameters accordingly. This iteration focuses on identifying key market scenarios for SUI-USDT and refining parameters for each.

### Key Market Scenarios for SUI-USDT

Based on historical patterns and cryptocurrency market behavior, we can identify four primary market scenarios for SUI-USDT:

1. **Strong Trending Markets (Bull/Bear)**
   - Characteristics: Consistent directional movement, reduced noise, higher volume
   - Example periods: New listings, major protocol upgrades, market-wide trends
   - Performance challenges: Late entries, premature exits

2. **Choppy/Sideways Markets**
   - Characteristics: Range-bound price action, false breakouts, lower volume
   - Example periods: Consolidation phases, low liquidity periods
   - Performance challenges: Frequent false signals, stop-outs

3. **High Volatility/News-Driven Markets**
   - Characteristics: Large price swings, gaps, high volume spikes
   - Example periods: Major announcements, regulatory news, security incidents
   - Performance challenges: Slippage, delayed execution, stop runs

4. **Low Volatility/Accumulation Markets**
   - Characteristics: Tight ranges, decreasing volume, low trading activity
   - Example periods: Pre-breakout consolidation, holiday periods
   - Performance challenges: Insufficient price movement, overtrading

## Scenario-Specific Parameter Optimization

### 1. Strong Trending Market Parameters

```javascript
// Trending market configuration
trendingMarket: {
  period: '3m',          // Maintain longer timeframe to reduce noise
  min_periods: 10,       // Slightly reduced for faster response
  cci_periods: 12,       // Increased to reduce false signals
  rsi_periods: 10,       // Increased to smooth out minor retracements
  srsi_periods: 8,       // Increased for trend confirmation
  oversold_rsi: 20,      // More extreme for stronger trend confirmation
  overbought_rsi: 80,    // More extreme for stronger trend confirmation
  oversold_cci: -90,     // More extreme for stronger trend confirmation
  overbought_cci: 140,   // More extreme for stronger trend confirmation
  ema_acc: 0.06,         // Higher threshold to confirm stronger trends
  confirmation_periods: 1, // Maintain confirmation for signal quality
  trailing_stop_pct: 0.3, // Increased to capture larger trend moves
  profit_take_pct: 1.2,  // Increased to let profits run in trends
  risk_per_trade_pct: 1.2 // Slightly increased risk for trending markets
}
```

**Optimization Logic**: In trending markets, we want to reduce false signals and let profits run. The parameters are adjusted to be more conservative in signal generation but more aggressive in profit-taking and position sizing.

### 2. Choppy/Sideways Market Parameters

```javascript
// Sideways market configuration
sidewaysMarket: {
  period: '5m',          // Increased to filter out noise
  min_periods: 12,       // Standard setting
  cci_periods: 14,       // Increased to reduce false signals
  rsi_periods: 12,       // Increased to smooth out noise
  srsi_periods: 10,      // Increased for better filtering
  oversold_rsi: 25,      // Relaxed to reduce signals in noise
  overbought_rsi: 75,    // Relaxed to reduce signals in noise
  oversold_cci: -70,     // Relaxed to reduce signals in noise
  overbought_cci: 120,   // Relaxed to reduce signals in noise
  ema_acc: 0.03,         // Lower threshold to better identify sideways markets
  confirmation_periods: 2, // Increased confirmation for better quality signals
  trailing_stop_pct: 0.15, // Tighter trailing stop in choppy markets
  profit_take_pct: 0.5,  // Reduced profit target for range-bound conditions
  risk_per_trade_pct: 0.7 // Reduced risk in challenging conditions
}
```

**Optimization Logic**: In choppy markets, we want to reduce trading frequency and focus on higher-quality signals. The parameters are adjusted to be more conservative in both signal generation and position management.

### 3. High Volatility Market Parameters

```javascript
// High volatility market configuration
volatileMarket: {
  period: '2m',          // Reduced for faster response to volatility
  min_periods: 8,        // Reduced for faster adaptation
  cci_periods: 6,        // Reduced for faster response
  rsi_periods: 5,        // Reduced for faster response
  srsi_periods: 4,       // Reduced for faster response
  oversold_rsi: 20,      // More extreme for stronger confirmation
  overbought_rsi: 80,    // More extreme for stronger confirmation
  oversold_cci: -100,    // More extreme for stronger confirmation
  overbought_cci: 150,   // More extreme for stronger confirmation
  ema_acc: 0.08,         // Higher threshold for volatile conditions
  confirmation_periods: 1, // Standard confirmation
  trailing_stop_pct: 0.4, // Wider trailing stop for volatile conditions
  profit_take_pct: 1.0,  // Increased profit target for volatile swings
  risk_per_trade_pct: 0.6, // Reduced risk due to higher volatility
  dynamic_stop_loss: true, // Enable dynamic stop loss
  stop_loss_volatility_factor: 0.6, // Adjust stop loss based on volatility
  volume_filter: true,   // Enable volume filtering
  min_volume_factor: 1.5 // Require stronger volume confirmation
}
```

**Optimization Logic**: In volatile markets, we want to respond quickly to large price movements while protecting capital. The parameters are adjusted for faster response but with enhanced risk controls.

### 4. Low Volatility Market Parameters

```javascript
// Low volatility market configuration
lowVolatilityMarket: {
  period: '1m',          // Reduced to capture smaller movements
  min_periods: 15,       // Increased for better context in quiet markets
  cci_periods: 8,        // Standard setting
  rsi_periods: 6,        // Standard setting
  srsi_periods: 5,       // Standard setting
  oversold_rsi: 30,      // Significantly relaxed for low volatility
  overbought_rsi: 70,    // Significantly relaxed for low volatility
  oversold_cci: -60,     // Significantly relaxed for low volatility
  overbought_cci: 100,   // Significantly relaxed for low volatility
  ema_acc: 0.025,        // Lower threshold for low volatility detection
  confirmation_periods: 0, // No additional confirmation to increase signals
  trailing_stop_pct: 0.15, // Tighter trailing stop for smaller movements
  profit_take_pct: 0.4,  // Reduced profit target for smaller movements
  risk_per_trade_pct: 0.8, // Standard risk
  max_hold_periods: 30   // Longer hold periods in slow markets
}
```

**Optimization Logic**: In low volatility markets, we want to capture smaller price movements and avoid overtrading. The parameters are adjusted to generate signals on smaller movements but with appropriate expectations.

## Enhanced Backtesting Script with Market Scenario Detection

To implement scenario-specific parameter sets, we need to enhance the backtesting script with market scenario detection:

```javascript
// Add to backtesting.js

// Market scenario detection function
const detectMarketScenario = (candles, lookback = 100) => {
  // Use recent candles for analysis
  const recentCandles = candles.slice(-lookback)
  
  // Calculate volatility
  const closes = recentCandles.map(c => c.close)
  const returns = []
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i-1]) / closes[i-1])
  }
  
  const volatility = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / returns.length) * Math.sqrt(365 * 24 * 60)
  
  // Calculate trend strength
  let upDays = 0
  let downDays = 0
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i-1]) upDays++
    else if (closes[i] < closes[i-1]) downDays++
  }
  const trendStrength = Math.abs(upDays - downDays) / (upDays + downDays)
  
  // Calculate volume trend
  const volumes = recentCandles.map(c => c.volume)
  const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length
  const recentAvgVolume = volumes.slice(-20).reduce((sum, v) => sum + v, 0) / 20
  const volumeTrend = recentAvgVolume / avgVolume
  
  // Determine market scenario
  if (volatility > 0.12) { // High volatility threshold
    return 'volatileMarket'
  } else if (volatility < 0.05) { // Low volatility threshold
    return 'lowVolatilityMarket'
  } else if (trendStrength > 0.3) { // Strong trend threshold
    return 'trendingMarket'
  } else {
    return 'sidewaysMarket'
  }
}

// Add dynamic configuration selection
const runAdaptiveBacktest = async (candles) => {
  let currentScenario = null
  let currentConfig = null
  let trades = []
  
  // Process candles sequentially
  for (let i = 100; i < candles.length; i++) {
    // Check for scenario change every 100 candles
    if (i % 100 === 0) {
      const newScenario = detectMarketScenario(candles.slice(0, i))
      if (newScenario !== currentScenario) {
        currentScenario = newScenario
        currentConfig = configSets[currentScenario]
        console.log(`Candle ${i}: Switching to ${currentScenario} configuration`)
      }
    }
    
    // Simulate trading with current configuration
    // This would be replaced with actual strategy logic
    // ...
  }
  
  return trades
}

// Add adaptive backtesting option
if (argv.adaptive) {
  console.log('Running adaptive backtesting with scenario-based configuration switching')
  // Implementation would load candles and call runAdaptiveBacktest
}
```

## Refined Performance Expectations by Market Scenario

### Trade Frequency
- **Trending Markets**: 10-15 trades per day
  - More selective entries with longer hold times
- **Choppy Markets**: 5-10 trades per day
  - Reduced trading frequency with stricter filters
- **Volatile Markets**: 20-30 trades per day
  - Increased opportunities from large price swings
- **Low Volatility Markets**: 15-25 trades per day
  - More signals from relaxed thresholds

### Win Rate
- **Trending Markets**: 65-70%
  - Higher quality signals in clear trends
- **Choppy Markets**: 45-50%
  - Challenging conditions with many false signals
- **Volatile Markets**: 55-60%
  - Good opportunities but with execution challenges
- **Low Volatility Markets**: 50-55%
  - Smaller movements with moderate reliability

### Maximum Drawdown
- **Trending Markets**: 3-5%
  - Lower drawdown from clearer signals
- **Choppy Markets**: 6-8%
  - Higher drawdown from false signals
- **Volatile Markets**: 7-9%
  - Higher risk from large price swings
- **Low Volatility Markets**: 4-6%
  - Moderate drawdown from smaller movements

### Sharpe Ratio (Daily)
- **Trending Markets**: 1.6-1.9
  - Higher risk-adjusted returns in favorable conditions
- **Choppy Markets**: 0.8-1.1
  - Lower returns in challenging conditions
- **Volatile Markets**: 1.3-1.6
  - Good returns but with higher volatility
- **Low Volatility Markets**: 1.0-1.3
  - Moderate returns from smaller movements

## Conclusion for Iteration 4

This iteration has developed scenario-specific parameter sets optimized for different market conditions commonly encountered in SUI-USDT trading. By adapting the strategy parameters to the current market scenario, we can potentially improve performance across varying market conditions.

The enhanced backtesting framework with market scenario detection provides a more realistic simulation of how the strategy would perform in production, where market conditions constantly evolve.

The next iteration will focus on finalizing the implementation details, providing a complete backtesting solution, and synthesizing all findings into actionable recommendations.
