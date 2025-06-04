# Algo1meta Command Manual

## Overview

Algo1meta is a sophisticated meta-strategy for Zenbot that combines three distinct price action pattern detection approaches:

1. **Flash Crash Pattern** - Detects rapid price declines with specific characteristics
2. **Post-Stagnation Pattern** - Identifies declines following periods of low volatility
3. **Unsteady Decline Pattern** - Recognizes longer-term declines with mixed candle patterns

The strategy runs all three pattern detections in parallel, evaluates their confidence scores and market conditions, then makes intelligent trading decisions based on the combined analysis.

## Installation

### Step 1: Copy Strategy Files

```bash
# Create the strategy directory if it doesn't exist
mkdir -p /path/to/zenbot/extensions/strategies/algo1meta

# Copy the strategy.js file
cp algo1meta/strategy.js /path/to/zenbot/extensions/strategies/algo1meta/
```

### Step 2: Update Configuration

Replace your existing `conf.js` file with the provided version, or manually add the Algo1meta configuration section:

```bash
# Option 1: Replace the entire conf.js file
cp conf.js /path/to/zenbot/conf.js

# Option 2: Manually add the Algo1meta section to your existing conf.js
# (See the "Configuration Options" section below)
```

## Usage

### Basic Usage

```bash
# Run simulation with default settings
./zenbot.js sim --strategy algo1meta

# Run live trading with default settings
./zenbot.js trade --strategy algo1meta
```

### Pattern-Specific Usage

#### Flash Crash Pattern

```bash
./zenbot.js sim --strategy algo1meta \
  --flash_crash.enabled true \
  --flash_crash.flash_crash_pct 2.0 \
  --flash_crash.consecutive_red_candles 3 \
  --flash_crash.stop_loss_pct 1.2 \
  --flash_crash.profit_target_pct 2.5
```

#### Post-Stagnation Pattern

```bash
./zenbot.js sim --strategy algo1meta \
  --post_stagnation.enabled true \
  --post_stagnation.stagnation_threshold 0.08 \
  --post_stagnation.recovery_threshold 0.6 \
  --post_stagnation.stop_loss_pct 1.8 \
  --post_stagnation.profit_target_pct 1.8
```

#### Unsteady Decline Pattern

```bash
./zenbot.js sim --strategy algo1meta \
  --unsteady_decline.enabled true \
  --unsteady_decline.adx_threshold 22 \
  --unsteady_decline.ema_short 6 \
  --unsteady_decline.ema_medium 10 \
  --unsteady_decline.ema_long 15 \
  --unsteady_decline.stop_loss_pct 1.7 \
  --unsteady_decline.profit_target_pct 2.2
```

### Meta-Decision Mode Selection

```bash
# Use best confidence mode (default)
./zenbot.js sim --strategy algo1meta --meta.decision_mode best_confidence

# Use regime-based mode
./zenbot.js sim --strategy algo1meta --meta.decision_mode regime_based
```

## Configuration Options

### Meta-Strategy Options

| Option | Description | Default |
|--------|-------------|---------|
| `meta.decision_mode` | Meta-decision mode (`best_confidence`, `regime_based`) | `best_confidence` |
| `meta.min_confidence_threshold` | Minimum confidence score to trade any pattern | `6` |
| `meta.min_confidence_difference` | Min confidence diff for 'best_confidence' mode | `1.5` |
| `meta.enable_regime_filter` | Enable market regime filtering for patterns | `true` |
| `meta.position_size_scaling` | Scale position size based on pattern confidence | `true` |
| `meta.trend_adx_threshold` | ADX threshold for trend detection in regime | `25` |
| `meta.regime_update_interval` | Minutes between market regime updates | `15` |

### Flash Crash Pattern Options

| Option | Description | Default |
|--------|-------------|---------|
| `flash_crash.enabled` | Enable Flash Crash pattern detection | `true` |
| `flash_crash.flash_crash_pct` | Percentage decline for flash crash | `2.0` |
| `flash_crash.flash_crash_duration` | Max candles for flash crash | `3` |
| `flash_crash.consecutive_red_candles` | Consecutive red candles for flash crash | `3` |
| `flash_crash.rsi_oversold` | RSI level for flash crash confirmation | `30` |
| `flash_crash.stop_loss_pct` | Stop loss % for flash crash trades | `1.2` |
| `flash_crash.profit_target_pct` | Profit target % for flash crash trades | `2.5` |

### Post-Stagnation Pattern Options

| Option | Description | Default |
|--------|-------------|---------|
| `post_stagnation.enabled` | Enable Post-Stagnation pattern detection | `true` |
| `post_stagnation.stagnation_threshold` | BB width threshold for stagnation | `0.08` |
| `post_stagnation.recovery_threshold` | Minimum percentage for recovery attempt | `0.6` |
| `post_stagnation.min_decline_pct` | Min decline % after stagnation | `5.0` |
| `post_stagnation.stop_loss_pct` | Stop loss % for post-stagnation trades | `1.8` |
| `post_stagnation.profit_target_pct` | Profit target % for post-stagnation trades | `1.8` |

### Unsteady Decline Pattern Options

| Option | Description | Default |
|--------|-------------|---------|
| `unsteady_decline.enabled` | Enable Unsteady Decline pattern detection | `true` |
| `unsteady_decline.lookback_candles` | Number of candles for unsteady decline lookback | `24` |
| `unsteady_decline.min_decline_pct` | Min decline % for unsteady pattern | `4.5` |
| `unsteady_decline.max_decline_pct` | Max decline % for unsteady pattern | `5.5` |
| `unsteady_decline.min_up_candle_ratio` | Min ratio of up candles in unsteady decline | `0.3` |
| `unsteady_decline.adx_threshold` | ADX threshold for unsteady decline | `22` |
| `unsteady_decline.ema_short` | Short EMA period for unsteady decline | `6` |
| `unsteady_decline.ema_medium` | Medium EMA period for unsteady decline | `10` |
| `unsteady_decline.ema_long` | Long EMA period for unsteady decline | `15` |
| `unsteady_decline.stop_loss_pct` | Stop loss % for unsteady decline trades | `1.7` |
| `unsteady_decline.profit_target_pct` | Profit target % for unsteady decline trades | `2.2` |

### General Risk Management Options

| Option | Description | Default |
|--------|-------------|---------|
| `position_size_pct` | Percentage of available capital per trade | `10` |
| `max_open_positions` | Maximum number of open positions | `1` |
| `max_daily_trades` | Maximum number of trades per day | `5` |
| `trailing_stop_pct` | Trailing stop percentage | `1.0` |
| `trailing_stop_activation_pct` | Profit percentage to activate trailing stop | `1.0` |
| `debug` | Enable debugging output | `false` |
| `log_trades` | Log detailed trade information | `true` |

## Environment Variables

All configuration options can also be set using environment variables with the prefix `ZENBOT_ALGO1META_`. For example:

```bash
export ZENBOT_ALGO1META_DECISION_MODE=regime_based
export ZENBOT_ALGO1META_MIN_CONFIDENCE_THRESHOLD=7
export ZENBOT_ALGO1META_FLASH_CRASH_PCT=2.5
```

## Troubleshooting

### MongoDB Connection Issues

If you encounter MongoDB connection errors like:

```
MongoServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017
```

Make sure MongoDB is installed and running:

```bash
# Install MongoDB (if not already installed)
sudo apt update
sudo apt install -y mongodb

# Start MongoDB service
sudo systemctl start mongodb

# Check MongoDB status
sudo systemctl status mongodb
```

For testing without MongoDB, you can use the `--no-mongodb` flag:

```bash
./zenbot.js list-strategies --no-mongodb | grep algo1meta
```

### Strategy Not Found

If Zenbot cannot find the Algo1meta strategy, check:

1. The strategy files are in the correct location: `/path/to/zenbot/extensions/strategies/algo1meta/strategy.js`
2. The file permissions are correct: `chmod 644 /path/to/zenbot/extensions/strategies/algo1meta/strategy.js`
3. There are no syntax errors in the strategy file

## Advanced Usage

### Running Multiple Pattern Types Simultaneously

For optimal performance with all three patterns, use the meta-strategy with balanced settings:

```bash
./zenbot.js trade --strategy algo1meta \
  --flash_crash.flash_crash_pct 2.2 \
  --consecutive_red_candles 3 \
  --post_stagnation.stagnation_threshold 0.09 \
  --post_stagnation.recovery_threshold 0.55 \
  --unsteady_decline.adx_threshold 23 \
  --unsteady_decline.ema_short 6 \
  --unsteady_decline.ema_medium 9 \
  --unsteady_decline.ema_long 14 \
  --stop_loss_pct 1.5 \
  --profit_target_pct 2.2 \
  --meta.min_confidence_threshold 6
```

### Backtesting and Optimization

To find optimal parameters for your specific market conditions:

```bash
# Run a backtest over a longer period
./zenbot.js sim --strategy algo1meta --days 30

# Run genetic optimization to find best parameters
./zenbot.js sim --strategy algo1meta --days 30 --optimize
```

## Performance Monitoring

The strategy provides detailed reporting in the Zenbot console output:

- Active pattern and confidence score
- Market regime indicators
- Position status and profit percentage
- Trailing stop information

For more detailed logs, enable the debug option:

```bash
./zenbot.js trade --strategy algo1meta --debug true
```
