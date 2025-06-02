# NewTradingPairCommandManual - SUI-USDT Integration for Zenbot

## Table of Contents
1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Project Backup and Setup](#project-backup-and-setup)
   - [3.1 Create a Backup](#31-create-a-backup)
   - [3.2 Create a Development Branch](#32-create-a-development-branch)
4. [Implementation Steps](#implementation-steps)
   - [Step 1: Analyze Zenbot Exchange Structure](#step-1-analyze-zenbot-exchange-structure)
   - [Step 2: Update Binance Products List](#step-2-update-binance-products-list)
     - [Option A: Automated Update (Recommended)](#option-a-automated-update-recommended)
     - [Option B: Manual Update](#option-b-manual-update)
   - [Step 3: Update Configuration Files](#step-3-update-configuration-files)
   - [Step 4: Test the Integration](#step-4-test-the-integration)
   - [Step 5: Commit Your Changes](#step-5-commit-your-changes)
5. [Configuration Options](#configuration-options)
   - [5.1 Basic Configuration](#51-basic-configuration)
   - [5.2 Strategy Configuration](#52-strategy-configuration)
   - [5.3 Advanced Options](#53-advanced-options)
6. [Testing and Validation](#testing-and-validation)
   - [6.1 Paper Trading Test](#61-paper-trading-test)
   - [6.2 Backtesting](#62-backtesting)
   - [6.3 Validation Checklist](#63-validation-checklist)
   - [6.4 Monitoring Output](#64-monitoring-output)
7. [Troubleshooting](#troubleshooting)
   - [7.1 Common Issues](#71-common-issues)
   - [7.2 Debugging Techniques](#72-debugging-techniques)
   - [7.3 Rollback Procedure](#73-rollback-procedure)
8. [VS Code and Augment Code Integration](#vs-code-and-augment-code-integration)
   - [8.1 Useful Extensions](#81-useful-extensions)
   - [8.2 Keyboard Shortcuts](#82-keyboard-shortcuts)
   - [8.3 Augment Code Assistance](#83-augment-code-assistance)
   - [8.4 VS Code Tasks for Zenbot](#84-vs-code-tasks-for-zenbot)
9. [Performance Optimization](#performance-optimization)
   - [9.1 SUI-USDT Trading Considerations](#91-sui-usdt-trading-considerations)
   - [9.2 Strategy Optimization](#92-strategy-optimization)
10. [Appendix: Complete Code Files](#appendix-complete-code-files)
    - [10.1 Example SUI-USDT products.json Entry](#101-example-sui-usdt-productsjson-entry)
    - [10.2 Example Configuration](#102-example-configuration)
    - [10.3 VS Code Tasks File](#103-vs-code-tasks-file)
    - [10.4 CCXT Test Script](#104-ccxt-test-script)

## Introduction

This manual provides comprehensive, step-by-step instructions for integrating the SUI-USDT trading pair on Binance with Zenbot. SUI is officially supported on Binance, and with the proper configuration, you can add it to Zenbot for automated trading.

The integration process leverages Zenbot's modular architecture and the CCXT library, which provides standardized access to cryptocurrency exchange APIs. By following this guide, you'll be able to trade SUI-USDT on Binance through Zenbot with minimal code modifications.

## Prerequisites

Before beginning implementation, ensure you have:

- Zenbot installed and operational
- Git for version control
- Node.js v12+ and npm v6+
- VS Code with Augment Code extension
- Binance account with API keys configured with appropriate permissions
- Basic understanding of JavaScript and trading concepts

Required tools and their versions:
- Node.js v12+ 
- npm v6+
- Git v2.20+
- VS Code v1.60+
- Augment Code extension v1.0+

## Project Backup and Setup

### 3.1 Create a Backup

Always back up your critical files before making modifications to ensure you can revert changes if needed.

```bash
# Navigate to your Zenbot directory
cd /path/to/zenbot

# Create a backup directory with timestamp
mkdir -p backups/$(date +%Y%m%d)

# Copy critical files
cp -r extensions/exchanges/binance backups/$(date +%Y%m%d)/binance
cp conf.js backups/$(date +%Y%m%d)/conf.js
```

### 3.2 Create a Development Branch

Use Git to manage your changes and keep your main branch clean.

```bash
# Create and checkout a new branch
git checkout -b feature/add-sui-usdt

# Verify branch creation
git branch
```

## Implementation Steps

### Step 1: Analyze Zenbot Exchange Structure

First, let's understand how Zenbot handles exchange integrations and trading pairs.

1. Open VS Code in your Zenbot directory:
   ```bash
   code /path/to/zenbot
   ```

2. Examine the Binance exchange files:
   - `extensions/exchanges/binance/exchange.js`: Main exchange implementation
   - `extensions/exchanges/binance/products.json`: List of supported trading pairs
   - `extensions/exchanges/binance/update-products.sh`: Script to update products list

The key insight is that Zenbot uses the CCXT library to interact with exchanges, and the products.json file defines the trading pairs and their parameters. The exchange.js file dynamically loads this products list, so we only need to ensure SUI-USDT is properly defined in products.json.

### Step 2: Update Binance Products List

There are two ways to update the products list: automated (recommended) or manual.

#### Option A: Automated Update (Recommended)

The automated approach uses the update-products.sh script to fetch the latest trading pairs directly from Binance, ensuring accurate parameters.

1. Navigate to the Binance exchange directory in VS Code terminal:
   ```bash
   cd extensions/exchanges/binance
   ```

2. Make the update script executable if it isn't already:
   ```bash
   chmod +x update-products.sh
   ```

3. Run the update script:
   ```bash
   ./update-products.sh
   ```
   
   This script will:
   - Connect to Binance API
   - Fetch all available trading pairs
   - Extract parameters like minimum order size, price increment, etc.
   - Write the updated list to products.json

4. Verify that SUI-USDT was added to products.json:
   ```bash
   grep -A 10 "SUI" products.json
   ```

   You should see output similar to:
   ```json
   {
     "id": "SUIUSDT",
     "asset": "SUI",
     "currency": "USDT",
     "min_size": "0.10000000",
     "max_size": "9000000.00000000",
     "min_total": "5.00000000",
     "increment": "0.00010000",
     "asset_increment": "0.10000000",
     "label": "SUI/USDT"
   }
   ```

#### Option B: Manual Update

If you prefer to manually add SUI-USDT or if the automated script doesn't include it for some reason:

1. Open products.json in VS Code:
   ```bash
   code extensions/exchanges/binance/products.json
   ```

2. Add the SUI-USDT entry to the JSON array (make sure to add a comma after the previous entry):

```json
{
  "id": "SUIUSDT",
  "asset": "SUI",
  "currency": "USDT",
  "min_size": "0.10000000",
  "max_size": "9000000.00000000",
  "min_total": "5.00000000",
  "increment": "0.00010000",
  "asset_increment": "0.10000000",
  "label": "SUI/USDT"
}
```

Note: The values above are examples. For the most accurate values, use the automated update method or check Binance's API documentation.

### Step 3: Update Configuration Files

Now that SUI-USDT is in the products list, update your Zenbot configuration to use this trading pair:

1. Open your conf.js file in VS Code:
   ```bash
   code conf.js
   ```

2. Update or add the following configuration:

```javascript
// In conf.js
c.selector = 'binance.SUI-USDT'
c.mode = 'paper' // Use 'paper' for testing, 'live' for real trading

// API keys (required for live trading)
c.binance = {
  key: 'YOUR_API_KEY',
  secret: 'YOUR_API_SECRET'
}

// Trading parameters
c.order_type = 'maker' // or 'taker' for market orders
c.min_periods = 50
c.period = '5m' // 5-minute candles
```

3. Save the file (Ctrl+S)

### Step 4: Test the Integration

Run Zenbot in paper trading mode to test the integration:

1. Open a terminal in VS Code (Ctrl+`)
2. Run the following command:

```bash
./zenbot.sh trade binance.SUI-USDT --paper
```

If everything is configured correctly, Zenbot should start fetching SUI-USDT price data from Binance and simulate trades based on your strategy.

3. Observe the output to ensure SUI-USDT data is being fetched correctly:

```
fetching pre-roll data...
pre-roll complete.
2025-05-24 15:30:00 | binance.SUI-USDT | 3.6600 | 0 0 0
```

### Step 5: Commit Your Changes

Once you've verified that the integration works, commit your changes to the Git repository:

```bash
# Add the modified files
git add extensions/exchanges/binance/products.json
git add conf.js

# Commit the changes
git commit -m "Add SUI-USDT trading pair support"

# Push to your remote repository (optional)
git push origin feature/add-sui-usdt
```

## Configuration Options

### 5.1 Basic Configuration

These are the essential parameters for trading SUI-USDT:

```javascript
c.selector = 'binance.SUI-USDT'
c.mode = 'paper' // or 'live'
c.order_type = 'maker' // or 'taker'
c.period = '5m' // Time period for candles: 1m, 5m, 15m, 1h, etc.
```

### 5.2 Strategy Configuration

Choose and configure a trading strategy:

```javascript
c.strategy = 'macd' // or any other strategy

// MACD strategy settings
c.macd_settings = {
  fast_period: 12,
  slow_period: 26,
  signal_period: 9,
  up_trend_threshold: 0,
  down_trend_threshold: 0
}

// RSI strategy settings
c.rsi_settings = {
  period: 14,
  oversold_rsi: 30,
  overbought_rsi: 70
}

// SMA strategy settings
c.sma_settings = {
  period: 10,
  trend_interval: 30
}
```

### 5.3 Advanced Options

Fine-tune your trading with these advanced options:

```javascript
// Trade size
c.currency_capital = 1000 // Amount of USDT to use
c.asset_capital = 0 // Amount of SUI to use
c.buy_pct = 99 // Percentage of currency_capital to use for buying
c.sell_pct = 99 // Percentage of asset_capital to use for selling

// Risk management
c.max_slippage_pct = 5 // Maximum acceptable slippage
c.profit_stop_enable_pct = 1 // Enable trailing stop when profit reaches 1%
c.profit_stop_pct = 0.5 // Sell if price drops 0.5% from highest point after profit_stop_enable_pct reached
c.max_sell_loss_pct = 5 // Maximum acceptable loss on sell
c.max_buy_loss_pct = 5 // Maximum acceptable loss on buy

// Trading behavior
c.sell_stop_pct = 2 // Stop loss percentage
c.buy_stop_pct = 2 // Stop loss percentage for short positions
c.markdown_buy_pct = 0.5 // Markdown from current price for limit buy orders
c.markup_sell_pct = 0.5 // Markup from current price for limit sell orders
c.order_adjust_time = 5000 // Time in ms to adjust orders
c.order_poll_time = 5000 // Time in ms to poll order status
```

## Testing and Validation

### 6.1 Paper Trading Test

Start with paper trading to validate your setup without risking real funds:

```bash
# Basic paper trading
./zenbot.sh trade binance.SUI-USDT --paper

# Paper trading with specific strategy and period
./zenbot.sh trade binance.SUI-USDT --strategy=macd --period=5m --paper

# Paper trading with debug output
./zenbot.sh trade binance.SUI-USDT --debug --paper

# Paper trading with specific capital
./zenbot.sh trade binance.SUI-USDT --currency_capital=1000 --paper
```

### 6.2 Backtesting

Before live trading, backtest your strategy with historical SUI-USDT data:

```bash
# Basic backtest for the last 14 days
./zenbot.sh sim binance.SUI-USDT --days=14

# Backtest with specific strategy and period
./zenbot.sh sim binance.SUI-USDT --strategy=macd --period=5m --days=14

# Backtest with HTML report
./zenbot.sh sim binance.SUI-USDT --days=14 --filename=sui_backtest_report.html

# Optimize strategy parameters
./zenbot.sh sim binance.SUI-USDT --strategy=macd --days=14 --optimize
```

The HTML report will provide detailed performance metrics including:
- Total profit/loss
- Number of trades
- Win/loss ratio
- Average trade duration
- Maximum drawdown

### 6.3 Validation Checklist

Use this checklist to ensure your integration is complete and working:

- [ ] SUI-USDT entry is correctly added to products.json
- [ ] Configuration is updated to use binance.SUI-USDT
- [ ] Paper trading successfully fetches SUI-USDT price data
- [ ] Buy and sell orders are placed correctly in paper trading
- [ ] Backtesting completes without errors
- [ ] API connectivity is verified
- [ ] Minimum order sizes are respected
- [ ] Price and quantity increments are respected
- [ ] Strategy parameters are optimized for SUI-USDT
- [ ] No error messages appear during normal operation

### 6.4 Monitoring Output

When running Zenbot with SUI-USDT, you should see output like this:

```
2025-05-24 15:30:00 | binance.SUI-USDT | 3.6600 | 0 0 0
2025-05-24 15:35:00 | binance.SUI-USDT | 3.6700 | 0 0 0
2025-05-24 15:40:00 | binance.SUI-USDT | buy | 3.6600 | 273.22 SUI | $999.99
...
2025-05-24 15:45:00 | binance.SUI-USDT | 3.7000 | +1.09% | 273.22 SUI | $1010.91
...
2025-05-24 15:50:00 | binance.SUI-USDT | sell | 3.7200 | 273.22 SUI | $1016.38
```

## Troubleshooting

### 7.1 Common Issues

1. **Pair Not Found**
   - Error: `cannot trade binance.SUI-USDT: exchange not implemented`
   - Solution: 
     - Verify SUI-USDT is correctly added to products.json
     - Check the selector format is correct (binance.SUI-USDT)
     - Ensure products.json is properly formatted JSON (no trailing commas)

2. **API Errors**
   - Error: `Binance API is down! unable to call getBalance`
   - Solution: 
     - Check your Binance API keys have the correct permissions
     - Verify your IP is whitelisted in Binance API settings
     - Ensure your system time is synchronized (NTP)

3. **Order Size Issues**
   - Error: `MIN_NOTIONAL` or `LOT_SIZE`
   - Solution: 
     - Adjust your trade size to meet Binance's minimum requirements for SUI-USDT
     - Check the min_size and min_total values in products.json
     - Increase your currency_capital setting

4. **Rate Limit Exceeded**
   - Error: `binance {"code":-1003,"msg":"Too many requests"}`
   - Solution: 
     - Increase the period length (e.g., from 1m to 5m)
     - Add delay between API calls
     - Reduce the frequency of order adjustments

5. **Time Synchronization Errors**
   - Error: `Error: binance {"code":-1021,"msg":"Timestamp for this request was 1000ms ahead of the server's time."}`
   - Solution:
     - Synchronize your system clock
     - Update the CCXT library: `npm update ccxt`

### 7.2 Debugging Techniques

1. **Enable Debug Mode**
   ```bash
   ./zenbot.sh trade binance.SUI-USDT --debug --paper
   ```

2. **Check Products List**
   ```bash
   grep -A 10 "SUI" extensions/exchanges/binance/products.json
   ```

3. **Verify API Connectivity**
   ```bash
   curl -X GET "https://api.binance.com/api/v3/ticker/price?symbol=SUIUSDT"
   ```

4. **Monitor Zenbot Logs**
   ```bash
   tail -f logs/zenbot.log
   ```

5. **Test CCXT Directly**
   Create a test script to verify CCXT can access SUI-USDT (see Appendix for full script):
   ```bash
   node test-sui.js
   ```

### 7.3 Rollback Procedure

If you encounter issues and need to revert changes:

```bash
# Restore from backup
cp -r backups/YYYYMMDD/binance extensions/exchanges/
cp backups/YYYYMMDD/conf.js .

# Or revert git changes
git checkout -- extensions/exchanges/binance/
git checkout -- conf.js

# If you need to completely revert the branch
git checkout main
git branch -D feature/add-sui-usdt
```

## VS Code and Augment Code Integration

### 8.1 Useful Extensions

- **ESLint**: For JavaScript linting
- **GitLens**: For Git integration and history
- **JSON Tools**: For formatting and validating JSON files
- **Augment Code**: For AI-assisted development
- **REST Client**: For testing API endpoints directly in VS Code
- **Node.js Extension Pack**: Collection of extensions for Node.js development

### 8.2 Keyboard Shortcuts

- **Ctrl+P**: Quick file open
- **Ctrl+F**: Find in file
- **Ctrl+Shift+F**: Find in all files
- **Alt+Up/Down**: Move line up/down
- **Ctrl+/**: Toggle comment
- **Ctrl+K Ctrl+C**: Add line comment
- **Ctrl+K Ctrl+U**: Remove line comment
- **Ctrl+`**: Open/close integrated terminal
- **Ctrl+Shift+P**: Command palette

### 8.3 Augment Code Assistance

Augment Code can help with:

1. **Code Analysis**: Select the exchange.js file and ask Augment Code to explain how trading pairs are handled
2. **Debugging Help**: When encountering errors, ask Augment Code for troubleshooting suggestions
3. **Configuration Assistance**: Get help with optimal strategy parameters for SUI-USDT
4. **Code Generation**: Generate custom strategy modifications for SUI-USDT trading

Example prompts:
- "Analyze this error message from Zenbot and suggest solutions: [paste error]"
- "Help me optimize these MACD parameters for volatile assets like SUI"
- "Generate a custom strategy for SUI-USDT based on RSI and volume"
- "Explain how Zenbot's trailing stop mechanism works"

### 8.4 VS Code Tasks for Zenbot

Create a `.vscode/tasks.json` file to add Zenbot commands as VS Code tasks:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Update Binance Products",
      "type": "shell",
      "command": "cd ${workspaceFolder}/extensions/exchanges/binance && ./update-products.sh",
      "problemMatcher": []
    },
    {
      "label": "Paper Trade SUI-USDT",
      "type": "shell",
      "command": "${workspaceFolder}/zenbot.sh trade binance.SUI-USDT --paper",
      "problemMatcher": []
    },
    {
      "label": "Backtest SUI-USDT",
      "type": "shell",
      "command": "${workspaceFolder}/zenbot.sh sim binance.SUI-USDT --days=14 --filename=sui_backtest.html",
      "problemMatcher": []
    },
    {
      "label": "Optimize SUI-USDT Strategy",
      "type": "shell",
      "command": "${workspaceFolder}/zenbot.sh sim binance.SUI-USDT --strategy=macd --days=14 --optimize",
      "problemMatcher": []
    },
    {
      "label": "Debug SUI-USDT Trading",
      "type": "shell",
      "command": "${workspaceFolder}/zenbot.sh trade binance.SUI-USDT --debug --paper",
      "problemMatcher": []
    }
  ]
}
```

To run these tasks:
1. Press Ctrl+Shift+P
2. Type "Tasks: Run Task"
3. Select the desired task from the list

## Performance Optimization

### 9.1 SUI-USDT Trading Considerations

SUI is a relatively new cryptocurrency with specific characteristics to consider:

1. **Volatility**: SUI can be more volatile than established cryptocurrencies, so consider:
   - Using wider stop-loss settings
   - Implementing trailing stops
   - Trading with smaller position sizes

2. **Liquidity**: While SUI-USDT has good liquidity on Binance, consider:
   - Checking the order book depth before large trades
   - Using maker orders to avoid slippage
   - Setting reasonable slippage protection

3. **Market Hours**: Unlike traditional markets, SUI trades 24/7, but activity may vary:
   - Consider using time-based filters in your strategy
   - Be aware of increased volatility during major announcements
   - Monitor trading volume to identify optimal trading periods

### 9.2 Strategy Optimization

Optimize your strategy for SUI-USDT trading:

1. **Period Selection**:
   - Shorter periods (1m, 5m) capture more trades but may generate false signals
   - Longer periods (15m, 1h) may miss short-term opportunities but reduce noise
   - Consider using multiple timeframes for confirmation

2. **Parameter Tuning**:
   - Use backtesting to optimize strategy parameters
   - Consider the `--optimize` flag with backtesting to find optimal settings
   - Example: `./zenbot.sh sim binance.SUI-USDT --strategy=macd --days=14 --optimize`

3. **Custom Strategies**:
   - Consider creating a custom strategy for SUI-USDT
   - Combine multiple indicators (e.g., RSI, MACD, and Volume)
   - Implement market-specific logic based on SUI's behavior

## Appendix: Complete Code Files

### 10.1 Example SUI-USDT products.json Entry

```json
{
  "id": "SUIUSDT",
  "asset": "SUI",
  "currency": "USDT",
  "min_size": "0.10000000",
  "max_size": "9000000.00000000",
  "min_total": "5.00000000",
  "increment": "0.00010000",
  "asset_increment": "0.10000000",
  "label": "SUI/USDT"
}
```

### 10.2 Example Configuration

```javascript
// Basic configuration for SUI-USDT trading
c.selector = 'binance.SUI-USDT'
c.mode = 'paper' // Use 'paper' for testing, 'live' for real trading

// API keys (required for live trading)
c.binance = {
  key: 'YOUR_API_KEY',
  secret: 'YOUR_API_SECRET'
}

// Trading parameters
c.order_type = 'maker' // or 'taker' for market orders
c.currency_capital = 1000 // Amount of USDT to use
c.asset_capital = 0 // Amount of SUI to use
c.min_periods = 50
c.period = '5m' // 5-minute candles

// Strategy selection
c.strategy = 'macd'

// MACD strategy settings
c.macd_settings = {
  fast_period: 12,
  slow_period: 26,
  signal_period: 9,
  up_trend_threshold: 0,
  down_trend_threshold: 0
}

// Risk management
c.max_slippage_pct = 5
c.profit_stop_enable_pct = 1
c.profit_stop_pct = 0.5
c.sell_stop_pct = 2
c.buy_stop_pct = 2
c.markdown_buy_pct = 0.5
c.markup_sell_pct = 0.5
```

### 10.3 VS Code Tasks File

Create this file at `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Update Binance Products",
      "type": "shell",
      "command": "cd ${workspaceFolder}/extensions/exchanges/binance && ./update-products.sh",
      "problemMatcher": []
    },
    {
      "label": "Paper Trade SUI-USDT",
      "type": "shell",
      "command": "${workspaceFolder}/zenbot.sh trade binance.SUI-USDT --paper",
      "problemMatcher": []
    },
    {
      "label": "Backtest SUI-USDT",
      "type": "shell",
      "command": "${workspaceFolder}/zenbot.sh sim binance.SUI-USDT --days=14 --filename=sui_backtest.html",
      "problemMatcher": []
    },
    {
      "label": "Optimize SUI-USDT Strategy",
      "type": "shell",
      "command": "${workspaceFolder}/zenbot.sh sim binance.SUI-USDT --strategy=macd --days=14 --optimize",
      "problemMatcher": []
    },
    {
      "label": "Debug SUI-USDT Trading",
      "type": "shell",
      "command": "${workspaceFolder}/zenbot.sh trade binance.SUI-USDT --debug --paper",
      "problemMatcher": []
    }
  ]
}
```

### 10.4 CCXT Test Script

Create this file as `test-sui.js` to verify CCXT can access SUI-USDT:

```javascript
// test-sui.js
const ccxt = require('ccxt');

async function testSUI() {
  const binance = new ccxt.binance();
  try {
    console.log('Fetching SUI/USDT ticker...');
    const ticker = await binance.fetchTicker('SUI/USDT');
    console.log('SUI/USDT Ticker:', ticker);
    
    console.log('\nFetching SUI/USDT order book...');
    const orderbook = await binance.fetchOrderBook('SUI/USDT');
    console.log('SUI/USDT Order Book (first 5 entries):');
    console.log('Asks:', orderbook.asks.slice(0, 5));
    console.log('Bids:', orderbook.bids.slice(0, 5));
    
    console.log('\nFetching SUI/USDT trading rules...');
    const markets = await binance.fetchMarkets();
    const suiMarket = markets.find(market => market.symbol === 'SUI/USDT');
    console.log('SUI/USDT Market Info:', suiMarket);
    
    if (suiMarket && suiMarket.info && suiMarket.info.filters) {
      const lotSizeFilter = suiMarket.info.filters.find(f => f.filterType === 'LOT_SIZE');
      const priceFilter = suiMarket.info.filters.find(f => f.filterType === 'PRICE_FILTER');
      const notionalFilter = suiMarket.info.filters.find(f => f.filterType === 'MIN_NOTIONAL');
      
      console.log('\nExtracted Trading Rules:');
      console.log('Minimum Quantity:', lotSizeFilter ? lotSizeFilter.minQty : 'N/A');
      console.log('Maximum Quantity:', lotSizeFilter ? lotSizeFilter.maxQty : 'N/A');
      console.log('Quantity Step:', lotSizeFilter ? lotSizeFilter.stepSize : 'N/A');
      console.log('Minimum Price:', priceFilter ? priceFilter.minPrice : 'N/A');
      console.log('Maximum Price:', priceFilter ? priceFilter.maxPrice : 'N/A');
      console.log('Price Tick Size:', priceFilter ? priceFilter.tickSize : 'N/A');
      console.log('Minimum Notional Value:', notionalFilter ? notionalFilter.minNotional : 'N/A');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testSUI();
```

Run with:
```bash
node test-sui.js
```

This script will output the exact trading parameters for SUI-USDT directly from Binance's API, which you can then use to update your products.json file.
