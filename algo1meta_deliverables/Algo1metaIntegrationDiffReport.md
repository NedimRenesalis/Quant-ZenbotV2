# Algo1meta Integration Diff Report

This document details all changes required to integrate the Algo1meta strategy into the Quant-ZenbotV2-algo codebase.

## Files Added

### 1. `/extensions/strategies/algo1meta/strategy.js`

**Purpose**: Main strategy implementation file for Algo1meta.

**Description**: This file contains the complete implementation of the Algo1meta strategy, including:
- Three pattern detection modules (Flash Crash, Post-Stagnation, Unsteady Decline)
- Meta-decision logic for selecting the best pattern
- Market regime detection
- Risk management and position sizing
- Reporting and visualization

## Files Modified

### 1. `/conf.js`

**Changes**:
- Added Algo1meta as the default strategy: `c.strategy = process.env.ZENBOT_DEFAULT_STRATEGY || 'algo1meta'`
- Added complete Algo1meta configuration section:
  ```javascript
  // Algo1meta specific options
  c.algo1meta = {}
  // Meta-strategy options
  c.algo1meta.decision_mode = process.env.ZENBOT_ALGO1META_DECISION_MODE || 'best_confidence'
  c.algo1meta.min_confidence_threshold = process.env.ZENBOT_ALGO1META_MIN_CONFIDENCE_THRESHOLD || 6
  c.algo1meta.min_confidence_difference = process.env.ZENBOT_ALGO1META_MIN_CONFIDENCE_DIFFERENCE || 1.5
  c.algo1meta.enable_regime_filter = process.env.ZENBOT_ALGO1META_ENABLE_REGIME_FILTER === 'true'
  c.algo1meta.position_size_scaling = process.env.ZENBOT_ALGO1META_POSITION_SIZE_SCALING === 'true'
  c.algo1meta.trend_adx_threshold = process.env.ZENBOT_ALGO1META_TREND_ADX_THRESHOLD || 25
  c.algo1meta.regime_update_interval = process.env.ZENBOT_ALGO1META_REGIME_UPDATE_INTERVAL || 15
  
  // Flash Crash Pattern options
  c.algo1meta.flash_crash = {}
  c.algo1meta.flash_crash.enabled = process.env.ZENBOT_ALGO1META_FLASH_CRASH_ENABLED === 'true' || true
  c.algo1meta.flash_crash.flash_crash_pct = process.env.ZENBOT_ALGO1META_FLASH_CRASH_PCT || 2.0
  c.algo1meta.flash_crash.consecutive_red_candles = process.env.ZENBOT_ALGO1META_FLASH_CRASH_RED_CANDLES || 3
  c.algo1meta.flash_crash.rsi_oversold = process.env.ZENBOT_ALGO1META_FLASH_CRASH_RSI_OVERSOLD || 30
  c.algo1meta.flash_crash.stop_loss_pct = process.env.ZENBOT_ALGO1META_FLASH_CRASH_STOP_LOSS_PCT || 1.2
  c.algo1meta.flash_crash.profit_target_pct = process.env.ZENBOT_ALGO1META_FLASH_CRASH_PROFIT_TARGET_PCT || 2.5
  
  // Post-Stagnation Pattern options
  c.algo1meta.post_stagnation = {}
  c.algo1meta.post_stagnation.enabled = process.env.ZENBOT_ALGO1META_POST_STAGNATION_ENABLED === 'true' || true
  c.algo1meta.post_stagnation.stagnation_threshold = process.env.ZENBOT_ALGO1META_POST_STAGNATION_THRESHOLD || 0.08
  c.algo1meta.post_stagnation.recovery_threshold = process.env.ZENBOT_ALGO1META_POST_STAGNATION_RECOVERY_THRESHOLD || 0.6
  c.algo1meta.post_stagnation.min_decline_pct = process.env.ZENBOT_ALGO1META_POST_STAGNATION_MIN_DECLINE_PCT || 5.0
  c.algo1meta.post_stagnation.stop_loss_pct = process.env.ZENBOT_ALGO1META_POST_STAGNATION_STOP_LOSS_PCT || 1.8
  c.algo1meta.post_stagnation.profit_target_pct = process.env.ZENBOT_ALGO1META_POST_STAGNATION_PROFIT_TARGET_PCT || 1.8
  
  // Unsteady Decline Pattern options
  c.algo1meta.unsteady_decline = {}
  c.algo1meta.unsteady_decline.enabled = process.env.ZENBOT_ALGO1META_UNSTEADY_DECLINE_ENABLED === 'true' || true
  c.algo1meta.unsteady_decline.lookback_candles = process.env.ZENBOT_ALGO1META_UNSTEADY_DECLINE_LOOKBACK_CANDLES || 24
  c.algo1meta.unsteady_decline.min_decline_pct = process.env.ZENBOT_ALGO1META_UNSTEADY_DECLINE_MIN_DECLINE_PCT || 4.5
  c.algo1meta.unsteady_decline.max_decline_pct = process.env.ZENBOT_ALGO1META_UNSTEADY_DECLINE_MAX_DECLINE_PCT || 5.5
  c.algo1meta.unsteady_decline.min_up_candle_ratio = process.env.ZENBOT_ALGO1META_UNSTEADY_DECLINE_MIN_UP_CANDLE_RATIO || 0.3
  c.algo1meta.unsteady_decline.adx_threshold = process.env.ZENBOT_ALGO1META_UNSTEADY_DECLINE_ADX_THRESHOLD || 22
  c.algo1meta.unsteady_decline.ema_short = process.env.ZENBOT_ALGO1META_UNSTEADY_DECLINE_EMA_SHORT || 6
  c.algo1meta.unsteady_decline.ema_medium = process.env.ZENBOT_ALGO1META_UNSTEADY_DECLINE_EMA_MEDIUM || 10
  c.algo1meta.unsteady_decline.ema_long = process.env.ZENBOT_ALGO1META_UNSTEADY_DECLINE_EMA_LONG || 15
  c.algo1meta.unsteady_decline.stop_loss_pct = process.env.ZENBOT_ALGO1META_UNSTEADY_DECLINE_STOP_LOSS_PCT || 1.7
  c.algo1meta.unsteady_decline.profit_target_pct = process.env.ZENBOT_ALGO1META_UNSTEADY_DECLINE_PROFIT_TARGET_PCT || 2.2
  
  // General risk management options
  c.algo1meta.position_size_pct = process.env.ZENBOT_ALGO1META_POSITION_SIZE_PCT || 10
  c.algo1meta.max_open_positions = process.env.ZENBOT_ALGO1META_MAX_OPEN_POSITIONS || 1
  c.algo1meta.max_daily_trades = process.env.ZENBOT_ALGO1META_MAX_DAILY_TRADES || 5
  c.algo1meta.trailing_stop_pct = process.env.ZENBOT_ALGO1META_TRAILING_STOP_PCT || 1.0
  c.algo1meta.trailing_stop_activation_pct = process.env.ZENBOT_ALGO1META_TRAILING_STOP_ACTIVATION_PCT || 1.0
  c.algo1meta.debug = process.env.ZENBOT_ALGO1META_DEBUG === 'true'
  c.algo1meta.log_trades = process.env.ZENBOT_ALGO1META_LOG_TRADES === 'true' || true
  ```

## No Other Files Modified

No other files in the Zenbot codebase need to be modified. The strategy has been designed to integrate seamlessly with the existing framework by following Zenbot's plugin architecture.

## Integration Steps

1. **Create Strategy Directory**:
   ```bash
   mkdir -p /path/to/zenbot/extensions/strategies/algo1meta
   ```

2. **Copy Strategy File**:
   ```bash
   cp strategy.js /path/to/zenbot/extensions/strategies/algo1meta/
   ```

3. **Update Configuration**:
   ```bash
   cp conf.js /path/to/zenbot/
   ```

4. **Verify Installation**:
   ```bash
   cd /path/to/zenbot
   ./zenbot.js list-strategies --no-mongodb | grep algo1meta
   ```

## MongoDB Requirements

The strategy requires MongoDB for full functionality. If MongoDB is not already installed and running:

```bash
# Install MongoDB
sudo apt update
sudo apt install -y mongodb

# Start MongoDB service
sudo systemctl start mongodb

# Enable MongoDB to start on boot
sudo systemctl enable mongodb
```

## Testing Without MongoDB

For testing without MongoDB, use the `--no-mongodb` flag:

```bash
./zenbot.js list-strategies --no-mongodb | grep algo1meta
```

## Potential Issues and Solutions

### Issue: Strategy Not Found

**Solution**: Verify the strategy file is in the correct location and has the correct permissions:
```bash
ls -la /path/to/zenbot/extensions/strategies/algo1meta/strategy.js
chmod 644 /path/to/zenbot/extensions/strategies/algo1meta/strategy.js
```

### Issue: MongoDB Connection Errors

**Solution**: Check MongoDB status and restart if needed:
```bash
sudo systemctl status mongodb
sudo systemctl restart mongodb
```

### Issue: Configuration Not Applied

**Solution**: Verify the conf.js file has been properly updated and has the correct permissions:
```bash
ls -la /path/to/zenbot/conf.js
chmod 644 /path/to/zenbot/conf.js
```
