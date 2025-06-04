# Algo1 Command Manual

## Overview

Algo1 is a sophisticated high-frequency trading strategy for Zenbot based on the Price Action Pattern Recognition System. This strategy identifies specific market patterns that indicate potential reversal points and executes trades accordingly.

## Key Features

- **Pattern Recognition**: Detects three primary price decline patterns:
  - Flash crashes (2-2.5% rapid declines)
  - Post-stagnation declines with failed recovery attempts
  - Unsteady long-lasting declines (5% drop over 2-5 hours)

- **Dynamic Risk Management**: Adjusts position sizing, stop-loss, and profit targets based on market conditions

- **Market Regime Analysis**: Adapts to changing market volatility, trend strength, and liquidity

- **Error Resilience**: Includes robust error handling and fallback mechanisms for production trading

## Installation

1. Unzip the Quant-ZenbotV2-algo.zip file (if not already done)
2. Copy the `algo1` strategy folder to the Zenbot extensions/strategies directory:
   ```
   cp -r /path/to/algo1 /path/to/Quant-ZenbotV2/extensions/strategies/
   ```
3. Update the conf.js file to include Algo1 configuration (already done in the provided conf.js)

## Configuration

The following configuration options are available for Algo1 in conf.js:

```javascript
c.algo1 = {}
c.algo1.adx_threshold = process.env.ZENBOT_ALGO1_ADX_THRESHOLD || 25
c.algo1.flash_crash_pct = process.env.ZENBOT_ALGO1_FLASH_CRASH_PCT || 2.5
c.algo1.recovery_threshold = process.env.ZENBOT_ALGO1_RECOVERY_THRESHOLD || 0.5
c.algo1.pattern_confidence_threshold = process.env.ZENBOT_ALGO1_PATTERN_CONFIDENCE_THRESHOLD || 6
c.algo1.stop_loss_pct = process.env.ZENBOT_ALGO1_STOP_LOSS_PCT || 1.5
c.algo1.profit_target_pct = process.env.ZENBOT_ALGO1_PROFIT_TARGET_PCT || 2.0
c.algo1.trailing_stop_pct = process.env.ZENBOT_ALGO1_TRAILING_STOP_PCT || 1.0
c.algo1.position_size_pct = process.env.ZENBOT_ALGO1_POSITION_SIZE_PCT || 10
c.algo1.max_daily_trades = process.env.ZENBOT_ALGO1_MAX_DAILY_TRADES || 5
c.algo1.enable_regime_filter = process.env.ZENBOT_ALGO1_ENABLE_REGIME_FILTER === 'true'
c.algo1.debug = process.env.ZENBOT_ALGO1_DEBUG === 'true'
```

You can also set these options via environment variables or command-line parameters.

## Usage

### Basic Usage

To run Algo1 with default settings:

```bash
./zenbot.js sim --strategy algo1
```

### With Custom Parameters

```bash
./zenbot.js sim --strategy algo1 --algo1_flash_crash_pct 3.0 --algo1_stop_loss_pct 2.0
```

### Backtesting

```bash
./zenbot.js backfill binance.BTC-USDT
./zenbot.js sim --strategy algo1 --selector binance.BTC-USDT
```

### Paper Trading

```bash
./zenbot.js trade --strategy algo1 --paper
```

### Live Trading

```bash
./zenbot.js trade --strategy algo1
```

## Strategy Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `period` | Period length | 5m |
| `min_periods` | Minimum number of history periods | 52 |
| `adx_period` | Period for ADX calculation | 14 |
| `adx_threshold` | ADX threshold for trend strength | 25 |
| `ema_short` | Short EMA period | 5 |
| `ema_medium` | Medium EMA period | 8 |
| `ema_long` | Long EMA period | 13 |
| `bb_period` | Period for Bollinger Bands | 20 |
| `bb_stddev` | Standard deviation for Bollinger Bands | 2 |
| `atr_period` | Period for ATR calculation | 14 |
| `macd_fast` | MACD fast period | 12 |
| `macd_slow` | MACD slow period | 26 |
| `macd_signal` | MACD signal period | 9 |
| `flash_crash_pct` | Percentage decline to identify flash crash | 2.5 |
| `flash_crash_duration` | Max candles to consider for flash crash | 3 |
| `stagnation_threshold` | BB width threshold for stagnation | 0.1 |
| `recovery_threshold` | Minimum percentage for recovery attempt | 0.5 |
| `consecutive_red_candles` | Number of consecutive red candles for flash crash | 3 |
| `pattern_confidence_threshold` | Minimum confidence score to trade pattern | 6 |
| `stop_loss_pct` | Stop loss percentage | 1.5 |
| `profit_target_pct` | Profit target percentage | 2.0 |
| `max_drawdown_pct` | Maximum drawdown percentage | 5 |
| `trailing_stop_pct` | Trailing stop percentage once in profit | 1.0 |
| `trailing_stop_activation_pct` | Profit percentage to activate trailing stop | 1.0 |
| `position_size_pct` | Percentage of available capital to use per trade | 10 |
| `max_open_positions` | Maximum number of open positions | 1 |
| `max_daily_trades` | Maximum number of trades per day | 5 |
| `enable_regime_filter` | Enable market regime-based filtering | true |
| `min_adx_for_trend` | Minimum ADX value to consider a trend valid | 20 |
| `max_volatility_multiplier` | Maximum volatility multiplier for entry | 2.0 |
| `regime_update_interval` | Minutes between market regime updates | 15 |
| `oversold_rsi_periods` | Number of periods for oversold RSI | 14 |
| `oversold_rsi` | Buy when RSI reaches this value | 30 |
| `enable_time_filter` | Enable time-based filtering | false |
| `trading_hours_only` | Only trade during specified hours | false |
| `trading_hours_start` | Trading hours start (0-23) | 8 |
| `trading_hours_end` | Trading hours end (0-23) | 20 |
| `debug` | Enable debugging output | false |
| `backtesting_mode` | Optimize for backtesting performance | false |
| `fast_execution` | Enable fast execution mode for live trading | false |
| `calculation_skip_ticks` | Number of ticks to skip calculations in fast mode | 0 |
| `log_trades` | Log detailed trade information | true |
| `save_trade_history` | Save trade history to file | false |
| `trade_history_file` | File path for trade history | algo1_trade_history.json |
| `error_resilience` | Enable enhanced error resilience | true |
| `auto_pause_on_errors` | Automatically pause trading on excessive errors | true |
| `validate_price_data` | Validate price data before calculations | true |

## Integration Details

The Algo1 strategy has been integrated into the Zenbot framework with the following modifications:

1. **Added Files**:
   - `/extensions/strategies/algo1/strategy.js` - The main strategy implementation

2. **Modified Files**:
   - `/conf.js` - Updated to include Algo1 configuration options and set it as the default strategy

## Troubleshooting

### MongoDB Connection Issues

If you encounter MongoDB connection errors like:
```
MongoServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017
```

Ensure MongoDB is installed and running:
```bash
sudo apt-get install -y mongodb
sudo systemctl start mongodb
```

### Strategy Not Found

If Zenbot cannot find the Algo1 strategy, verify:
1. The strategy.js file is in the correct location: `/extensions/strategies/algo1/strategy.js`
2. The file has the correct permissions: `chmod 644 /extensions/strategies/algo1/strategy.js`

### Performance Optimization

For backtesting large datasets:
1. Enable backtesting mode: `--backtesting_mode`
2. Increase calculation skip ticks: `--calculation_skip_ticks 2`

## Advanced Usage

### Market Regime Filtering

The strategy adapts to different market conditions by analyzing:
- Volatility (using ATR)
- Trend strength (using ADX)
- Liquidity (using volume)

To disable this feature:
```bash
./zenbot.js sim --strategy algo1 --enable_regime_filter false
```

### Time-Based Filtering

Restrict trading to specific hours:
```bash
./zenbot.js sim --strategy algo1 --enable_time_filter true --trading_hours_only true --trading_hours_start 9 --trading_hours_end 17
```

### Trade History Analysis

Enable saving trade history for later analysis:
```bash
./zenbot.js trade --strategy algo1 --save_trade_history true --trade_history_file my_trades.json
```

## Performance Monitoring

The strategy reports key metrics in the console output:
- Pattern type (FLASH, UNSTDY, RECOV, PSTAG)
- Confidence score (0-10)
- Market regime indicators
- Technical indicators (ADX, BB width, RSI, MACD)
- Position status and profit percentage
- Win rate

## Recommended Settings

### For Flash Crash Trading
```bash
./zenbot.js sim --strategy algo1 --flash_crash_pct 2.0 --consecutive_red_candles 3 --stop_loss_pct 1.2 --profit_target_pct 2.5
```

### For Post-Stagnation Trading
```bash
./zenbot.js sim --strategy algo1 --stagnation_threshold 0.08 --recovery_threshold 0.6 --stop_loss_pct 1.8 --profit_target_pct 1.8
```

### For Unsteady Decline Trading
```bash
./zenbot.js sim --strategy algo1 --adx_threshold 22 --ema_short 6 --ema_medium 10 --ema_long 15 --stop_loss_pct 1.7 --profit_target_pct 2.2
```

## Conclusion

Algo1 is a sophisticated trading strategy designed for high-frequency trading based on price action patterns. It includes robust error handling, dynamic risk management, and market regime analysis to adapt to changing market conditions.

For optimal results, backtest the strategy with different parameter combinations to find settings that work best for your specific trading pair and timeframe.
