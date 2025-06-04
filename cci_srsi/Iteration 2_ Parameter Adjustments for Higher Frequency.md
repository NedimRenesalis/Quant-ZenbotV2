# Iteration 2: Parameter Adjustments for Higher Frequency

## Current Parameter Analysis

The current strategy is configured for moderate-frequency trading with a 3-minute timeframe. Key parameters affecting trading frequency include:

### Timeframe Parameters
- `period: '3m'` - Current candle timeframe
- `min_periods: 12` - Lookback window (36 minutes total)

### Signal Generation Parameters
- `cci_periods: 10` - CCI calculation periods
- `rsi_periods: 8` - RSI calculation periods
- `srsi_periods: 6` - SRSI calculation periods
- `confirmation_periods: 1` - Required confirmation periods

### Threshold Parameters
- `oversold_rsi: 22` - RSI oversold threshold
- `overbought_rsi: 78` - RSI overbought threshold
- `oversold_cci: -80` - CCI oversold threshold
- `overbought_cci: 130` - CCI overbought threshold
- `ema_acc: 0.045` - Sideways market threshold

## Proposed Parameter Adjustments for Higher Frequency

To increase trading frequency while maintaining reasonable signal quality, I recommend the following parameter adjustments:

### 1. Timeframe Reduction
```javascript
// Original
this.option('period', 'period length, same as --period_length', String, '3m')
this.option('min_periods', 'min. number of history periods', Number, 12)

// Proposed
this.option('period', 'period length, same as --period_length', String, '1m')
this.option('min_periods', 'min. number of history periods', Number, 10)
```

**Rationale**: Reducing the timeframe from 3m to 1m will triple the number of candles analyzed, significantly increasing potential trading opportunities. Reducing min_periods from 12 to 10 maintains a reasonable lookback window (10 minutes) while allowing faster signal generation.

### 2. Indicator Period Reduction
```javascript
// Original
this.option('cci_periods', 'number of CCI periods', Number, 10)
this.option('rsi_periods', 'number of RSI periods', Number, 8)
this.option('srsi_periods', 'number of SRSI periods', Number, 6)

// Proposed
this.option('cci_periods', 'number of CCI periods', Number, 7)
this.option('rsi_periods', 'number of RSI periods', Number, 6)
this.option('srsi_periods', 'number of SRSI periods', Number, 4)
```

**Rationale**: Reducing indicator periods makes them more responsive to recent price action, generating signals more frequently. The reduction is calibrated to maintain reasonable signal quality while increasing sensitivity.

### 3. Threshold Adjustments
```javascript
// Original
this.option('oversold_rsi', 'buy when RSI reaches or drops below this value', Number, 22)
this.option('overbought_rsi', 'sell when RSI reaches or goes above this value', Number, 78)
this.option('oversold_cci', 'buy when CCI reaches or drops below this value', Number, -80)
this.option('overbought_cci', 'sell when CCI reaches or goes above this value', Number, 130)

// Proposed
this.option('oversold_rsi', 'buy when RSI reaches or drops below this value', Number, 25)
this.option('overbought_rsi', 'sell when RSI reaches or goes above this value', Number, 75)
this.option('oversold_cci', 'buy when CCI reaches or drops below this value', Number, -70)
this.option('overbought_cci', 'sell when CCI reaches or goes above this value', Number, 120)
```

**Rationale**: Slightly relaxing the threshold values will allow signals to trigger more frequently. The adjustments are moderate to avoid excessive false signals while increasing trading opportunities.

### 4. Confirmation Requirements
```javascript
// Original
this.option('confirmation_periods', 'number of periods to confirm reversal', Number, 1)

// Proposed
this.option('confirmation_periods', 'number of periods to confirm reversal', Number, 0)
```

**Rationale**: Removing the confirmation period requirement allows signals to trigger immediately when conditions are met, rather than waiting for additional confirmation. This significantly increases trading frequency but may reduce signal quality.

### 5. Market State Classification
```javascript
// Original
this.option('ema_acc', 'sideways threshold (0.2-0.4)', Number, 0.045)

// Proposed
this.option('ema_acc', 'sideways threshold (0.2-0.4)', Number, 0.035)
```

**Rationale**: Lowering the sideways threshold makes the strategy more likely to classify the market as trending rather than sideways, potentially generating more signals in markets with lower volatility.

### 6. Execution Parameters
```javascript
// Original
c.order_adjust_time = process.env.ZENBOT_ORDER_ADJUST_TIME || 200
c.order_poll_time = process.env.ZENBOT_ORDER_POLL_TIME || 200
c.wait_for_settlement = process.env.ZENBOT_WAIT_FOR_SETTLEMENT || 100

// Proposed
c.order_adjust_time = process.env.ZENBOT_ORDER_ADJUST_TIME || 100
c.order_poll_time = process.env.ZENBOT_ORDER_POLL_TIME || 100
c.wait_for_settlement = process.env.ZENBOT_WAIT_FOR_SETTLEMENT || 50
```

**Rationale**: Reducing order management times allows for faster trade execution and position management, supporting higher trading frequency.

## Expected Impact on Performance Metrics

### Trade Frequency
- **Original Estimate**: 15-25 trades per day
- **New Estimate with Adjustments**: 40-60 trades per day
  - 1-minute timeframe provides 1440 candles per day (3x more than 3m)
  - Relaxed thresholds and reduced confirmation increase signal generation
  - Faster execution parameters reduce time between trades

### Win Rate
- **Original Estimate**: 55-60%
- **New Estimate with Adjustments**: 50-55%
  - Reduced indicator periods and relaxed thresholds may generate more false signals
  - Shorter timeframe introduces more market noise
  - Removal of confirmation period reduces signal quality

### Maximum Drawdown
- **Original Estimate**: 4-6% of account
- **New Estimate with Adjustments**: 6-8% of account
  - Higher trading frequency increases exposure to consecutive losses
  - Reduced signal quality may lead to more stop-outs
  - Shorter timeframe increases susceptibility to market noise

### Sharpe Ratio
- **Original Estimate**: 1.2-1.5 daily
- **New Estimate with Adjustments**: 1.0-1.3 daily
  - Higher trading frequency may increase total returns
  - Reduced win rate and increased drawdown affect risk-adjusted performance
  - More consistent trading activity could stabilize returns

## Risk Mitigation for Higher Frequency

To mitigate the increased risks from higher frequency trading, consider implementing:

1. **Dynamic Position Sizing**: Reduce position size for higher frequency trading
   ```javascript
   this.option('risk_per_trade_pct', 'percentage of capital to risk per trade', Number, 0.7)
   ```

2. **Tighter Profit Taking**: Adjust profit targets for shorter timeframe
   ```javascript
   this.option('profit_take_pct', 'profit taking percentage', Number, 0.6)
   ```

3. **Enhanced Filtering**: Add volume-based filtering to reduce false signals
   ```javascript
   this.option('min_volume_factor', 'minimum volume factor for signal confirmation', Number, 1.2)
   ```

## Conclusion for Iteration 2

The proposed parameter adjustments would significantly increase trading frequency from 15-25 to 40-60 trades per day, primarily through timeframe reduction, indicator period adjustments, and relaxed thresholds. However, this comes with trade-offs in signal quality and potential drawdown.

The next iteration will focus on refining these parameter adjustments based on potential market scenarios and developing a backtesting framework to validate these expectations.
