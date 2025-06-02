# Zenbot Trading Strategy ProfitCommandManual - Part 4 of 6

## Iteration 4: Production Hardening

In Iterations 1-3, we implemented core fixes, enhanced state management, and added market adaptation. In this fourth iteration, we'll focus on production hardening to make the trading strategy robust, secure, and reliable for continuous operation.

### Comprehensive Logging System

Let's implement a comprehensive logging system to track all trading activities and system events:

1. Create a new logging module:

```bash
# Create a directory for custom modules
mkdir -p lib/modules

# Create the logging module
code lib/modules/logger.js
```

2. Implement the logging module:

```javascript
// lib/modules/logger.js
const fs = require('fs')
const path = require('path')
const moment = require('moment')
const colors = require('colors')

class Logger {
  constructor(options = {}) {
    this.options = Object.assign({
      log_dir: './logs',
      log_level: 'info',  // debug, info, warn, error
      log_to_console: true,
      log_to_file: true,
      max_log_files: 30,
      exchange: 'unknown',
      pair: 'unknown',
      strategy: 'unknown',
      mode: 'unknown'
    }, options)
    
    // Create log directory if it doesn't exist
    if (this.options.log_to_file) {
      try {
        if (!fs.existsSync(this.options.log_dir)) {
          fs.mkdirSync(this.options.log_dir, { recursive: true })
        }
      } catch (error) {
        console.error(`Error creating log directory: ${error.message}`)
      }
    }
    
    // Initialize log files
    this.initLogFiles()
    
    // Log levels
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    }
    
    // Current log level
    this.currentLevel = this.levels[this.options.log_level] || 1
    
    // Log startup
    this.info('Logger initialized', {
      exchange: this.options.exchange,
      pair: this.options.pair,
      strategy: this.options.strategy,
      mode: this.options.mode,
      log_level: this.options.log_level
    })
  }
  
  initLogFiles() {
    if (!this.options.log_to_file) return
    
    const date = moment().format('YYYY-MM-DD')
    
    // Create log files for different levels
    this.logFiles = {
      debug: path.join(this.options.log_dir, `debug-${date}.log`),
      info: path.join(this.options.log_dir, `info-${date}.log`),
      warn: path.join(this.options.log_dir, `warn-${date}.log`),
      error: path.join(this.options.log_dir, `error-${date}.log`),
      combined: path.join(this.options.log_dir, `combined-${date}.log`),
      trades: path.join(this.options.log_dir, `trades-${date}.log`),
      signals: path.join(this.options.log_dir, `signals-${date}.log`),
      performance: path.join(this.options.log_dir, `performance-${date}.log`)
    }
    
    // Clean up old log files
    this.cleanupOldLogs()
  }
  
  cleanupOldLogs() {
    try {
      const files = fs.readdirSync(this.options.log_dir)
      
      // Group files by type
      const logGroups = {}
      
      files.forEach(file => {
        const match = file.match(/^([a-z]+)-\d{4}-\d{2}-\d{2}\.log$/)
        if (match) {
          const type = match[1]
          if (!logGroups[type]) {
            logGroups[type] = []
          }
          logGroups[type].push({
            file,
            path: path.join(this.options.log_dir, file),
            date: file.match(/\d{4}-\d{2}-\d{2}/)[0]
          })
        }
      })
      
      // Sort each group by date (newest first) and remove old files
      Object.keys(logGroups).forEach(type => {
        const group = logGroups[type]
        group.sort((a, b) => b.date.localeCompare(a.date))
        
        // Keep only the most recent files
        if (group.length > this.options.max_log_files) {
          group.slice(this.options.max_log_files).forEach(item => {
            fs.unlinkSync(item.path)
            this.debug(`Removed old log file: ${item.file}`)
          })
        }
      })
    } catch (error) {
      console.error(`Error cleaning up old logs: ${error.message}`)
    }
  }
  
  formatMessage(level, message, data = null) {
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss.SSS')
    let formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`
    
    if (data) {
      if (typeof data === 'object') {
        try {
          formattedMessage += ` ${JSON.stringify(data)}`
        } catch (error) {
          formattedMessage += ` [Object]`
        }
      } else {
        formattedMessage += ` ${data}`
      }
    }
    
    return formattedMessage
  }
  
  writeToFile(level, message) {
    if (!this.options.log_to_file) return
    
    try {
      // Check if date has changed and we need new log files
      const currentDate = moment().format('YYYY-MM-DD')
      if (!this.logFiles.debug.includes(currentDate)) {
        this.initLogFiles()
      }
      
      // Write to level-specific log file
      fs.appendFileSync(this.logFiles[level], message + '\n')
      
      // Write to combined log file
      fs.appendFileSync(this.logFiles.combined, message + '\n')
      
      // Write to special log files if applicable
      if (level === 'info' && message.includes('SIGNAL')) {
        fs.appendFileSync(this.logFiles.signals, message + '\n')
      }
      
      if (level === 'info' && (message.includes('BUY') || message.includes('SELL'))) {
        fs.appendFileSync(this.logFiles.trades, message + '\n')
      }
      
      if (level === 'debug' && message.includes('Performance')) {
        fs.appendFileSync(this.logFiles.performance, message + '\n')
      }
    } catch (error) {
      console.error(`Error writing to log file: ${error.message}`)
    }
  }
  
  log(level, message, data = null) {
    if (this.levels[level] < this.currentLevel) return
    
    const formattedMessage = this.formatMessage(level, message, data)
    
    // Write to console if enabled
    if (this.options.log_to_console) {
      let colorizedMessage = formattedMessage
      
      switch (level) {
        case 'debug':
          colorizedMessage = formattedMessage.gray
          break
        case 'info':
          colorizedMessage = formattedMessage.white
          break
        case 'warn':
          colorizedMessage = formattedMessage.yellow
          break
        case 'error':
          colorizedMessage = formattedMessage.red
          break
      }
      
      console.log(colorizedMessage)
    }
    
    // Write to file
    this.writeToFile(level, formattedMessage)
  }
  
  debug(message, data = null) {
    this.log('debug', message, data)
  }
  
  info(message, data = null) {
    this.log('info', message, data)
  }
  
  warn(message, data = null) {
    this.log('warn', message, data)
  }
  
  error(message, data = null) {
    this.log('error', message, data)
  }
  
  trade(action, price, size, value, reason = null) {
    this.info(`TRADE ${action.toUpperCase()}`, {
      price,
      size,
      value,
      reason
    })
  }
  
  signal(type, reason = null, confidence = null) {
    this.info(`SIGNAL ${type.toUpperCase()}`, {
      reason,
      confidence
    })
  }
  
  performance(metrics) {
    this.debug('Performance metrics', metrics)
  }
  
  // Special method for health check logging
  health(status, metrics = {}) {
    this.info(`HEALTH ${status.toUpperCase()}`, metrics)
  }
}

module.exports = Logger
```

3. Integrate the logger into the engine:

```bash
# Open engine.js
code lib/engine.js
```

4. Add logger initialization to the engine:

```javascript
// In engine.js - add at the top with other requires
const Logger = require('./modules/logger')

// In engine.js - modify the engine function
function engine (s, conf) {
  var so = s.options
  
  // Initialize logger
  s.logger = new Logger({
    log_dir: so.log_dir || './logs',
    log_level: so.log_level || 'info',
    log_to_console: so.log_to_console !== false,
    log_to_file: so.log_to_file !== false,
    max_log_files: so.max_log_files || 30,
    exchange: so.exchange,
    pair: so.selector,
    strategy: so.strategy,
    mode: so.mode
  })
  
  // Call state initialization function
  initializeState()
  
  // ... rest of the function ...
}
```

5. Replace console.log calls with logger calls throughout the engine:

```javascript
// Example replacements in engine.js

// Replace:
console.log(('\nsell stop triggered at ' + formatPercent(s.last_trade_worth) + ' trade worth\n').red)

// With:
s.logger.info('Sell stop triggered', {
  worth: formatPercent(s.last_trade_worth),
  price: s.period.close,
  stop: s.sell_stop
})

// Replace:
console.error((`\nError in period processing: ${periodError.message}\n`).red)

// With:
s.logger.error('Error in period processing', {
  message: periodError.message,
  stack: periodError.stack
})
```

6. Add configuration options for logging:

```bash
# Open conf.js
code conf.js
```

Add the following parameters:

```javascript
// In conf.js - add to the appropriate section
c.log_level = process.env.ZENBOT_LOG_LEVEL || 'info'
c.log_dir = process.env.ZENBOT_LOG_DIR || './logs'
c.log_to_console = process.env.ZENBOT_LOG_TO_CONSOLE !== 'false'
c.log_to_file = process.env.ZENBOT_LOG_TO_FILE !== 'false'
c.max_log_files = process.env.ZENBOT_MAX_LOG_FILES ? parseInt(process.env.ZENBOT_MAX_LOG_FILES) : 30
```

7. Add command line options for logging:

```bash
# Open trade.js
code commands/trade.js
```

Add the following options:

```javascript
// In trade.js - add to the appropriate section
.option('--log_level <level>', 'log level (debug, info, warn, error)', String, conf.log_level)
.option('--log_dir <dir>', 'directory to store log files', String, conf.log_dir)
.option('--log_to_console <true/false>', 'log to console', String, conf.log_to_console)
.option('--log_to_file <true/false>', 'log to file', String, conf.log_to_file)
.option('--max_log_files <n>', 'maximum number of log files to keep', Number, conf.max_log_files)
```

### Enhanced Error Recovery and Resilience

Let's implement enhanced error recovery and resilience:

1. Create a health check module:

```bash
# Create the health check module
code lib/modules/health.js
```

2. Implement the health check module:

```javascript
// lib/modules/health.js
const fs = require('fs')
const path = require('path')
const os = require('os')

class HealthCheck {
  constructor(options = {}) {
    this.options = Object.assign({
      enabled: true,
      check_interval: 60000, // 1 minute
      health_dir: './health',
      exchange: 'unknown',
      pair: 'unknown',
      strategy: 'unknown',
      auto_recover: true
    }, options)
    
    this.lastCheck = Date.now()
    this.status = 'starting'
    this.metrics = {}
    this.errors = []
    this.warnings = []
    
    // Create health directory if it doesn't exist
    if (this.options.enabled) {
      try {
        if (!fs.existsSync(this.options.health_dir)) {
          fs.mkdirSync(this.options.health_dir, { recursive: true })
        }
      } catch (error) {
        console.error(`Error creating health directory: ${error.message}`)
      }
    }
    
    // Start health check interval
    if (this.options.enabled) {
      this.startHealthCheck()
    }
  }
  
  startHealthCheck() {
    this.interval = setInterval(() => {
      this.check()
    }, this.options.check_interval)
    
    // Ensure the interval doesn't keep the process alive
    this.interval.unref()
  }
  
  stopHealthCheck() {
    if (this.interval) {
      clearInterval(this.interval)
    }
  }
  
  check() {
    try {
      // Update status
      this.lastCheck = Date.now()
      
      // Collect system metrics
      this.metrics = {
        timestamp: this.lastCheck,
        uptime: process.uptime(),
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
          process: process.memoryUsage()
        },
        cpu: os.loadavg(),
        errors: this.errors.length,
        warnings: this.warnings.length
      }
      
      // Determine status
      if (this.errors.length > 0) {
        this.status = 'error'
      } else if (this.warnings.length > 0) {
        this.status = 'warning'
      } else {
        this.status = 'healthy'
      }
      
      // Write health file
      this.writeHealthFile()
      
      // Auto-recovery if needed
      if (this.options.auto_recover && this.status === 'error') {
        this.recover()
      }
      
      // Clear old errors and warnings
      this.cleanErrors()
    } catch (error) {
      console.error(`Error in health check: ${error.message}`)
    }
  }
  
  writeHealthFile() {
    try {
      const healthFile = path.join(
        this.options.health_dir,
        `${this.options.exchange}_${this.options.pair}_health.json`
      )
      
      const healthData = {
        status: this.status,
        timestamp: this.lastCheck,
        exchange: this.options.exchange,
        pair: this.options.pair,
        strategy: this.options.strategy,
        metrics: this.metrics,
        errors: this.errors,
        warnings: this.warnings
      }
      
      fs.writeFileSync(healthFile, JSON.stringify(healthData, null, 2))
    } catch (error) {
      console.error(`Error writing health file: ${error.message}`)
    }
  }
  
  addError(error) {
    this.errors.push({
      timestamp: Date.now(),
      message: error.message || 'Unknown error',
      stack: error.stack,
      context: error.context || 'unknown'
    })
    
    // Trigger immediate health check
    this.check()
  }
  
  addWarning(warning) {
    this.warnings.push({
      timestamp: Date.now(),
      message: warning.message || 'Unknown warning',
      context: warning.context || 'unknown'
    })
  }
  
  cleanErrors() {
    // Keep only errors from the last hour
    const oneHourAgo = Date.now() - (60 * 60 * 1000)
    this.errors = this.errors.filter(error => error.timestamp > oneHourAgo)
    this.warnings = this.warnings.filter(warning => warning.timestamp > oneHourAgo)
  }
  
  recover() {
    // Implement recovery logic based on error types
    const latestError = this.errors[this.errors.length - 1]
    
    if (latestError) {
      console.log(`Attempting to recover from error: ${latestError.message}`)
      
      // Add recovery logic here based on error context
      switch (latestError.context) {
        case 'signal_processing':
          // Reset signal processing state
          if (this.onRecover) {
            this.onRecover('reset_signals')
          }
          break
          
        case 'order_execution':
          // Cancel pending orders
          if (this.onRecover) {
            this.onRecover('cancel_orders')
          }
          break
          
        case 'state_corruption':
          // Reset state
          if (this.onRecover) {
            this.onRecover('reset_state')
          }
          break
          
        default:
          // Generic recovery
          if (this.onRecover) {
            this.onRecover('generic')
          }
          break
      }
    }
  }
  
  setRecoveryHandler(handler) {
    this.onRecover = handler
  }
}

module.exports = HealthCheck
```

3. Integrate the health check module into the engine:

```bash
# Open engine.js
code lib/engine.js
```

4. Add health check initialization to the engine:

```javascript
// In engine.js - add at the top with other requires
const HealthCheck = require('./modules/health')

// In engine.js - modify the engine function
function engine (s, conf) {
  var so = s.options
  
  // Initialize logger
  s.logger = new Logger({
    log_dir: so.log_dir || './logs',
    log_level: so.log_level || 'info',
    log_to_console: so.log_to_console !== false,
    log_to_file: so.log_to_file !== false,
    max_log_files: so.max_log_files || 30,
    exchange: so.exchange,
    pair: so.selector,
    strategy: so.strategy,
    mode: so.mode
  })
  
  // Initialize health check
  s.healthCheck = new HealthCheck({
    enabled: so.enable_health_check !== false,
    check_interval: so.health_check_interval || 60000,
    health_dir: so.health_dir || './health',
    exchange: so.exchange,
    pair: so.selector,
    strategy: so.strategy,
    auto_recover: so.auto_recover !== false
  })
  
  // Set recovery handler
  s.healthCheck.setRecoveryHandler(function(action) {
    s.logger.warn(`Recovery action triggered: ${action}`)
    
    switch (action) {
      case 'reset_signals':
        s.signal = null
        s.acted_on_stop = false
        s.signal_persistence = 0
        s.signal_processing_mutex = false
        s.logger.info('Reset signal processing state')
        break
        
      case 'cancel_orders':
        if (s.buy_order) {
          cancelOrder(s.buy_order, function() {
            s.buy_order = null
            s.logger.info('Cancelled pending buy order')
          })
        }
        
        if (s.sell_order) {
          cancelOrder(s.sell_order, function() {
            s.sell_order = null
            s.logger.info('Cancelled pending sell order')
          })
        }
        break
        
      case 'reset_state':
        s.logger.warn('Resetting state due to corruption')
        initializeState()
        break
        
      case 'generic':
        s.logger.info('Performing generic recovery')
        s.signal = null
        s.acted_on_stop = false
        s.signal_persistence = 0
        s.signal_processing_mutex = false
        break
    }
  })
  
  // Call state initialization function
  initializeState()
  
  // ... rest of the function ...
}
```

5. Add error handling with health check integration:

```javascript
// In engine.js - modify the recoverFromError function
function recoverFromError(context, error) {
  s.logger.error(`Recovering from error in ${context}`, {
    message: error.message || 'Unknown error',
    stack: error.stack
  })
  
  // Add error to health check
  if (s.healthCheck) {
    error.context = context
    s.healthCheck.addError(error)
  }
  
  // Reset critical state variables to allow recovery
  s.signal = null
  s.acted_on_stop = false
  s.signal_persistence = 0
  s.signal_processing_mutex = false
  
  // Clear any pending orders
  if (s.buy_order) {
    s.logger.warn('Cancelling pending buy order due to error')
    cancelOrder(s.buy_order, function() {
      s.buy_order = null
    })
  }
  
  if (s.sell_order) {
    s.logger.warn('Cancelling pending sell order due to error')
    cancelOrder(s.sell_order, function() {
      s.sell_order = null
    })
  }
  
  // Emit error event for external handling
  eventBus.emit('error', {
    context: context,
    error: error,
    time: now()
  })
  
  // Return to a safe state
  return true
}
```

6. Add configuration options for health check:

```bash
# Open conf.js
code conf.js
```

Add the following parameters:

```javascript
// In conf.js - add to the appropriate section
c.enable_health_check = process.env.ZENBOT_ENABLE_HEALTH_CHECK !== 'false'
c.health_check_interval = process.env.ZENBOT_HEALTH_CHECK_INTERVAL ? parseInt(process.env.ZENBOT_HEALTH_CHECK_INTERVAL) : 60000
c.health_dir = process.env.ZENBOT_HEALTH_DIR || './health'
c.auto_recover = process.env.ZENBOT_AUTO_RECOVER !== 'false'
```

7. Add command line options for health check:

```bash
# Open trade.js
code commands/trade.js
```

Add the following options:

```javascript
// In trade.js - add to the appropriate section
.option('--enable_health_check <true/false>', 'enable health check', String, conf.enable_health_check)
.option('--health_check_interval <ms>', 'health check interval in milliseconds', Number, conf.health_check_interval)
.option('--health_dir <dir>', 'directory to store health check files', String, conf.health_dir)
.option('--auto_recover <true/false>', 'enable automatic recovery from errors', String, conf.auto_recover)
```

### Security Enhancements

Let's implement security enhancements to protect the trading system:

1. Create a security module:

```bash
# Create the security module
code lib/modules/security.js
```

2. Implement the security module:

```javascript
// lib/modules/security.js
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

class Security {
  constructor(options = {}) {
    this.options = Object.assign({
      enabled: true,
      encryption_key: process.env.ZENBOT_ENCRYPTION_KEY || this.generateRandomKey(),
      secure_dir: './secure'
    }, options)
    
    // Create secure directory if it doesn't exist
    if (this.options.enabled) {
      try {
        if (!fs.existsSync(this.options.secure_dir)) {
          fs.mkdirSync(this.options.secure_dir, { recursive: true })
        }
      } catch (error) {
        console.error(`Error creating secure directory: ${error.message}`)
      }
    }
    
    // Save encryption key if generated
    if (this.options.enabled && !process.env.ZENBOT_ENCRYPTION_KEY) {
      this.saveEncryptionKey()
    }
  }
  
  generateRandomKey() {
    return crypto.randomBytes(32).toString('hex')
  }
  
  saveEncryptionKey() {
    try {
      const keyFile = path.join(this.options.secure_dir, '.encryption_key')
      fs.writeFileSync(keyFile, this.options.encryption_key)
      fs.chmodSync(keyFile, 0o600) // Restrict permissions to owner only
      console.log(`Generated new encryption key and saved to ${keyFile}`)
    } catch (error) {
      console.error(`Error saving encryption key: ${error.message}`)
    }
  }
  
  encrypt(data) {
    if (!this.options.enabled) return data
    
    try {
      const iv = crypto.randomBytes(16)
      const cipher = crypto.createCipheriv(
        'aes-256-cbc',
        Buffer.from(this.options.encryption_key.slice(0, 32), 'hex'),
        iv
      )
      
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex')
      encrypted += cipher.final('hex')
      
      return {
        iv: iv.toString('hex'),
        data: encrypted
      }
    } catch (error) {
      console.error(`Encryption error: ${error.message}`)
      return data
    }
  }
  
  decrypt(encryptedData) {
    if (!this.options.enabled || !encryptedData.iv || !encryptedData.data) return encryptedData
    
    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-cbc',
        Buffer.from(this.options.encryption_key.slice(0, 32), 'hex'),
        Buffer.from(encryptedData.iv, 'hex')
      )
      
      let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      
      return JSON.parse(decrypted)
    } catch (error) {
      console.error(`Decryption error: ${error.message}`)
      return null
    }
  }
  
  secureStore(key, data) {
    if (!this.options.enabled) return false
    
    try {
      const encrypted = this.encrypt(data)
      const filePath = path.join(this.options.secure_dir, `${key}.enc`)
      
      fs.writeFileSync(filePath, JSON.stringify(encrypted))
      fs.chmodSync(filePath, 0o600) // Restrict permissions to owner only
      
      return true
    } catch (error) {
      console.error(`Error storing secure data: ${error.message}`)
      return false
    }
  }
  
  secureRetrieve(key) {
    if (!this.options.enabled) return null
    
    try {
      const filePath = path.join(this.options.secure_dir, `${key}.enc`)
      
      if (!fs.existsSync(filePath)) {
        return null
      }
      
      const encrypted = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      return this.decrypt(encrypted)
    } catch (error) {
      console.error(`Error retrieving secure data: ${error.message}`)
      return null
    }
  }
  
  secureDelete(key) {
    if (!this.options.enabled) return false
    
    try {
      const filePath = path.join(this.options.secure_dir, `${key}.enc`)
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
      
      return true
    } catch (error) {
      console.error(`Error deleting secure data: ${error.message}`)
      return false
    }
  }
  
  hashApiKey(apiKey) {
    return crypto.createHash('sha256').update(apiKey || '').digest('hex')
  }
}

module.exports = Security
```

3. Integrate the security module into the engine:

```bash
# Open engine.js
code lib/engine.js
```

4. Add security initialization to the engine:

```javascript
// In engine.js - add at the top with other requires
const Security = require('./modules/security')

// In engine.js - modify the engine function
function engine (s, conf) {
  var so = s.options
  
  // Initialize security
  s.security = new Security({
    enabled: so.enable_security !== false,
    encryption_key: process.env.ZENBOT_ENCRYPTION_KEY,
    secure_dir: so.secure_dir || './secure'
  })
  
  // Initialize logger
  s.logger = new Logger({
    log_dir: so.log_dir || './logs',
    log_level: so.log_level || 'info',
    log_to_console: so.log_to_console !== false,
    log_to_file: so.log_to_file !== false,
    max_log_files: so.max_log_files || 30,
    exchange: so.exchange,
    pair: so.selector,
    strategy: so.strategy,
    mode: so.mode
  })
  
  // ... rest of the function ...
}
```

5. Modify the state persistence functions to use encryption:

```javascript
// In engine.js - modify the saveState function
function saveState() {
  if (!so.save_state) return
  
  // Create a state object with only the essential data
  let state = {
    last_signal: s.last_signal,
    last_signal_time: s.last_signal_time,
    acted_on_stop: s.acted_on_stop,
    buy_stop: s.buy_stop,
    sell_stop: s.sell_stop,
    profit_stop: s.profit_stop,
    profit_stop_high: s.profit_stop_high,
    market_volatility: s.market_volatility,
    performance: s.performance,
    last_trade_worth: s.last_trade_worth,
    version: '2.0.0' // State format version
  }
  
  // Save to file
  try {
    let stateDir = path.resolve(so.state_dir || './state')
    let stateKey = `${so.exchange.toLowerCase()}_${so.selector.toLowerCase()}_state`
    
    // Ensure directory exists
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true })
    }
    
    // Use security module if available and enabled
    if (s.security && so.enable_security) {
      s.security.secureStore(stateKey, state)
      s.logger.debug(`Encrypted state saved to secure storage`)
    } else {
      let stateFile = path.resolve(stateDir, `${stateKey}.json`)
      fs.writeFileSync(stateFile, JSON.stringify(state, null, 2))
      s.logger.debug(`State saved to ${stateFile}`)
    }
  } catch (error) {
    s.logger.error(`Error saving state`, { message: error.message })
  }
}

// In engine.js - modify the loadState function
function loadState() {
  if (!so.save_state) return false
  
  try {
    let stateDir = path.resolve(so.state_dir || './state')
    let stateKey = `${so.exchange.toLowerCase()}_${so.selector.toLowerCase()}_state`
    let state = null
    
    // Use security module if available and enabled
    if (s.security && so.enable_security) {
      state = s.security.secureRetrieve(stateKey)
      if (state) {
        s.logger.info(`Decrypted state loaded from secure storage`)
      }
    } else {
      let stateFile = path.resolve(stateDir, `${stateKey}.json`)
      
      if (!fs.existsSync(stateFile)) {
        s.logger.debug(`No state file found at ${stateFile}`)
        return false
      }
      
      state = JSON.parse(fs.readFileSync(stateFile, 'utf8'))
      s.logger.info(`State loaded from ${stateFile}`)
    }
    
    if (!state) {
      return false
    }
    
    // Check version compatibility
    if (!state.version || state.version !== '2.0.0') {
      s.logger.warn(`State file version mismatch, ignoring saved state`)
      return false
    }
    
    // Restore state
    s.last_signal = state.last_signal
    s.last_signal_time = state.last_signal_time
    s.acted_on_stop = state.acted_on_stop
    s.buy_stop = state.buy_stop
    s.sell_stop = state.sell_stop
    s.profit_stop = state.profit_stop
    s.profit_stop_high = state.profit_stop_high
    s.market_volatility = state.market_volatility
    s.performance = state.performance
    s.last_trade_worth = state.last_trade_worth
    
    return true
  } catch (error) {
    s.logger.error(`Error loading state`, { message: error.message })
    return false
  }
}
```

6. Add configuration options for security:

```bash
# Open conf.js
code conf.js
```

Add the following parameters:

```javascript
// In conf.js - add to the appropriate section
c.enable_security = process.env.ZENBOT_ENABLE_SECURITY !== 'false'
c.secure_dir = process.env.ZENBOT_SECURE_DIR || './secure'
```

7. Add command line options for security:

```bash
# Open trade.js
code commands/trade.js
```

Add the following options:

```javascript
// In trade.js - add to the appropriate section
.option('--enable_security <true/false>', 'enable security features', String, conf.enable_security)
.option('--secure_dir <dir>', 'directory to store secure files', String, conf.secure_dir)
```

### Backup and Rollback Strategies

Let's implement backup and rollback strategies:

1. Create a backup module:

```bash
# Create the backup module
code lib/modules/backup.js
```

2. Implement the backup module:

```javascript
// lib/modules/backup.js
const fs = require('fs')
const path = require('path')
const child_process = require('child_process')

class Backup {
  constructor(options = {}) {
    this.options = Object.assign({
      enabled: true,
      backup_dir: './backups',
      max_backups: 10,
      backup_interval: 86400000, // 24 hours
      include_logs: true,
      include_state: true,
      include_health: true,
      include_secure: false
    }, options)
    
    // Create backup directory if it doesn't exist
    if (this.options.enabled) {
      try {
        if (!fs.existsSync(this.options.backup_dir)) {
          fs.mkdirSync(this.options.backup_dir, { recursive: true })
        }
      } catch (error) {
        console.error(`Error creating backup directory: ${error.message}`)
      }
    }
    
    // Start backup interval
    if (this.options.enabled && this.options.backup_interval > 0) {
      this.startBackupInterval()
    }
  }
  
  startBackupInterval() {
    this.interval = setInterval(() => {
      this.createBackup()
    }, this.options.backup_interval)
    
    // Ensure the interval doesn't keep the process alive
    this.interval.unref()
  }
  
  stopBackupInterval() {
    if (this.interval) {
      clearInterval(this.interval)
    }
  }
  
  createBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupFile = path.join(this.options.backup_dir, `zenbot_backup_${timestamp}.tar.gz`)
      
      // Build list of directories to include
      const dirs = []
      
      if (this.options.include_logs) {
        dirs.push('./logs')
      }
      
      if (this.options.include_state) {
        dirs.push('./state')
      }
      
      if (this.options.include_health) {
        dirs.push('./health')
      }
      
      if (this.options.include_secure) {
        dirs.push('./secure')
      }
      
      // Add configuration files
      dirs.push('conf.js')
      
      // Create tar command
      const tarCommand = `tar -czf ${backupFile} ${dirs.join(' ')}`
      
      // Execute tar command
      child_process.execSync(tarCommand)
      
      console.log(`Backup created: ${backupFile}`)
      
      // Clean up old backups
      this.cleanupOldBackups()
      
      return backupFile
    } catch (error) {
      console.error(`Error creating backup: ${error.message}`)
      return null
    }
  }
  
  cleanupOldBackups() {
    try {
      const files = fs.readdirSync(this.options.backup_dir)
      
      // Filter backup files
      const backups = files
        .filter(file => file.startsWith('zenbot_backup_') && file.endsWith('.tar.gz'))
        .map(file => ({
          file,
          path: path.join(this.options.backup_dir, file),
          time: fs.statSync(path.join(this.options.backup_dir, file)).mtime.getTime()
        }))
      
      // Sort by time (newest first)
      backups.sort((a, b) => b.time - a.time)
      
      // Remove old backups
      if (backups.length > this.options.max_backups) {
        backups.slice(this.options.max_backups).forEach(backup => {
          fs.unlinkSync(backup.path)
          console.log(`Removed old backup: ${backup.file}`)
        })
      }
    } catch (error) {
      console.error(`Error cleaning up old backups: ${error.message}`)
    }
  }
  
  restoreBackup(backupFile) {
    try {
      // Verify backup file exists
      if (!fs.existsSync(backupFile)) {
        console.error(`Backup file not found: ${backupFile}`)
        return false
      }
      
      // Create a temporary directory for extraction
      const tempDir = path.join(this.options.backup_dir, 'temp_restore')
      
      // Create temp directory if it doesn't exist
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
      }
      
      // Extract backup to temp directory
      const extractCommand = `tar -xzf ${backupFile} -C ${tempDir}`
      child_process.execSync(extractCommand)
      
      console.log(`Backup extracted to ${tempDir}`)
      
      // Copy files from temp directory to their original locations
      if (this.options.include_logs && fs.existsSync(path.join(tempDir, 'logs'))) {
        this.copyDirectory(path.join(tempDir, 'logs'), './logs')
      }
      
      if (this.options.include_state && fs.existsSync(path.join(tempDir, 'state'))) {
        this.copyDirectory(path.join(tempDir, 'state'), './state')
      }
      
      if (this.options.include_health && fs.existsSync(path.join(tempDir, 'health'))) {
        this.copyDirectory(path.join(tempDir, 'health'), './health')
      }
      
      if (this.options.include_secure && fs.existsSync(path.join(tempDir, 'secure'))) {
        this.copyDirectory(path.join(tempDir, 'secure'), './secure')
      }
      
      // Copy configuration files
      if (fs.existsSync(path.join(tempDir, 'conf.js'))) {
        fs.copyFileSync(path.join(tempDir, 'conf.js'), './conf.js.restored')
        console.log(`Configuration file restored to conf.js.restored`)
      }
      
      // Clean up temp directory
      this.removeDirectory(tempDir)
      
      console.log(`Backup restored successfully`)
      return true
    } catch (error) {
      console.error(`Error restoring backup: ${error.message}`)
      return false
    }
  }
  
  copyDirectory(source, destination) {
    // Create destination directory if it doesn't exist
    if (!fs.existsSync(destination)) {
      fs.mkdirSync(destination, { recursive: true })
    }
    
    // Get all files in source directory
    const files = fs.readdirSync(source)
    
    // Copy each file
    files.forEach(file => {
      const sourcePath = path.join(source, file)
      const destPath = path.join(destination, file)
      
      if (fs.statSync(sourcePath).isDirectory()) {
        // Recursively copy subdirectories
        this.copyDirectory(sourcePath, destPath)
      } else {
        // Copy file
        fs.copyFileSync(sourcePath, destPath)
      }
    })
    
    console.log(`Copied directory ${source} to ${destination}`)
  }
  
  removeDirectory(directory) {
    if (fs.existsSync(directory)) {
      const files = fs.readdirSync(directory)
      
      files.forEach(file => {
        const filePath = path.join(directory, file)
        
        if (fs.statSync(filePath).isDirectory()) {
          // Recursively remove subdirectories
          this.removeDirectory(filePath)
        } else {
          // Remove file
          fs.unlinkSync(filePath)
        }
      })
      
      // Remove empty directory
      fs.rmdirSync(directory)
    }
  }
}

module.exports = Backup
```

3. Integrate the backup module into the engine:

```bash
# Open engine.js
code lib/engine.js
```

4. Add backup initialization to the engine:

```javascript
// In engine.js - add at the top with other requires
const Backup = require('./modules/backup')

// In engine.js - modify the engine function
function engine (s, conf) {
  var so = s.options
  
  // Initialize security
  s.security = new Security({
    enabled: so.enable_security !== false,
    encryption_key: process.env.ZENBOT_ENCRYPTION_KEY,
    secure_dir: so.secure_dir || './secure'
  })
  
  // Initialize logger
  s.logger = new Logger({
    log_dir: so.log_dir || './logs',
    log_level: so.log_level || 'info',
    log_to_console: so.log_to_console !== false,
    log_to_file: so.log_to_file !== false,
    max_log_files: so.max_log_files || 30,
    exchange: so.exchange,
    pair: so.selector,
    strategy: so.strategy,
    mode: so.mode
  })
  
  // Initialize backup
  s.backup = new Backup({
    enabled: so.enable_backup !== false,
    backup_dir: so.backup_dir || './backups',
    max_backups: so.max_backups || 10,
    backup_interval: so.backup_interval || 86400000, // 24 hours
    include_logs: so.backup_include_logs !== false,
    include_state: so.backup_include_state !== false,
    include_health: so.backup_include_health !== false,
    include_secure: so.backup_include_secure === true
  })
  
  // ... rest of the function ...
}
```

5. Add configuration options for backup:

```bash
# Open conf.js
code conf.js
```

Add the following parameters:

```javascript
// In conf.js - add to the appropriate section
c.enable_backup = process.env.ZENBOT_ENABLE_BACKUP !== 'false'
c.backup_dir = process.env.ZENBOT_BACKUP_DIR || './backups'
c.max_backups = process.env.ZENBOT_MAX_BACKUPS ? parseInt(process.env.ZENBOT_MAX_BACKUPS) : 10
c.backup_interval = process.env.ZENBOT_BACKUP_INTERVAL ? parseInt(process.env.ZENBOT_BACKUP_INTERVAL) : 86400000
c.backup_include_logs = process.env.ZENBOT_BACKUP_INCLUDE_LOGS !== 'false'
c.backup_include_state = process.env.ZENBOT_BACKUP_INCLUDE_STATE !== 'false'
c.backup_include_health = process.env.ZENBOT_BACKUP_INCLUDE_HEALTH !== 'false'
c.backup_include_secure = process.env.ZENBOT_BACKUP_INCLUDE_SECURE === 'true'
```

6. Add command line options for backup:

```bash
# Open trade.js
code commands/trade.js
```

Add the following options:

```javascript
// In trade.js - add to the appropriate section
.option('--enable_backup <true/false>', 'enable automatic backups', String, conf.enable_backup)
.option('--backup_dir <dir>', 'directory to store backups', String, conf.backup_dir)
.option('--max_backups <n>', 'maximum number of backups to keep', Number, conf.max_backups)
.option('--backup_interval <ms>', 'backup interval in milliseconds', Number, conf.backup_interval)
.option('--backup_include_logs <true/false>', 'include logs in backups', String, conf.backup_include_logs)
.option('--backup_include_state <true/false>', 'include state in backups', String, conf.backup_include_state)
.option('--backup_include_health <true/false>', 'include health in backups', String, conf.backup_include_health)
.option('--backup_include_secure <true/false>', 'include secure files in backups', String, conf.backup_include_secure)
```

### Graceful Shutdown

Let's implement graceful shutdown handling:

1. Add shutdown handling to the engine:

```bash
# Open engine.js
code lib/engine.js
```

2. Add shutdown handling code:

```javascript
// In engine.js - add at the bottom
function handleShutdown() {
  if (s.is_shutting_down) return
  
  s.is_shutting_down = true
  s.logger.info('Graceful shutdown initiated')
  
  // Cancel any pending orders
  if (s.buy_order) {
    s.logger.info('Cancelling pending buy order')
    cancelOrder(s.buy_order, function() {
      s.buy_order = null
    })
  }
  
  if (s.sell_order) {
    s.logger.info('Cancelling pending sell order')
    cancelOrder(s.sell_order, function() {
      s.sell_order = null
    })
  }
  
  // Save state
  if (so.save_state) {
    s.logger.info('Saving state before shutdown')
    saveState()
  }
  
  // Create backup
  if (s.backup && so.enable_backup) {
    s.logger.info('Creating backup before shutdown')
    s.backup.createBackup()
  }
  
  // Update health status
  if (s.healthCheck) {
    s.healthCheck.status = 'shutdown'
    s.healthCheck.check()
  }
  
  s.logger.info('Shutdown complete')
  
  // Allow time for async operations to complete
  setTimeout(function() {
    process.exit(0)
  }, 3000)
}

// Register shutdown handlers
process.on('SIGINT', handleShutdown)
process.on('SIGTERM', handleShutdown)
```

3. Add shutdown state to initialization:

```javascript
// In engine.js - modify the initializeState function
function initializeState() {
  // ... existing initialization code ...
  
  // Shutdown state
  s.is_shutting_down = false
  
  // ... rest of the function ...
}
```

### Testing and Validating Changes - Iteration 4

After implementing these changes, let's create a test script to validate them:

```bash
# Create a test configuration file for Iteration 4
cp conf.js conf.test.iteration4.js

# Open the test configuration in VS Code
code conf.test.iteration4.js
```

In VS Code, modify the test configuration to include the following settings:

```javascript
// In conf.test.iteration4.js - modify the following settings
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
c.log_level = 'debug'  // Set log level to debug
c.log_dir = './logs_test'  // Use a test directory for logs
c.enable_health_check = true  // Enable health check
c.health_dir = './health_test'  // Use a test directory for health checks
c.enable_security = true  // Enable security
c.secure_dir = './secure_test'  // Use a test directory for secure files
c.enable_backup = true  // Enable backup
c.backup_dir = './backups_test'  // Use a test directory for backups
c.backup_interval = 300000  // Set backup interval to 5 minutes for testing
```

Create a shell script to automate testing:

```bash
# Create a test script for Iteration 4
cat > test_production_hardening.sh << 'EOF'
#!/bin/bash

# Comprehensive test script for Zenbot Iteration 4
echo "Starting Zenbot Iteration 4 comprehensive testing..."

# Setup
mkdir -p ./state_test
mkdir -p ./logs_test
mkdir -p ./health_test
mkdir -p ./secure_test
mkdir -p ./backups_test
echo "Created test directories"

# Test 1: Logging System
echo "Test 1: Logging System"
echo "Running with comprehensive logging..."
./zenbot.sh sim --conf=conf.test.iteration4.js --strategy=stddev --paper --log_level=debug --debug_log=true --days=1 > test4_1_results.log
echo "Check logs_test directory for log files"
ls -la ./logs_test/
echo ""

# Test 2: Health Check
echo "Test 2: Health Check"
echo "Running with health check enabled..."
./zenbot.sh sim --conf=conf.test.iteration4.js --strategy=stddev --paper --enable_health_check=true --days=1 > test4_2_results.log
echo "Check health_test directory for health files"
ls -la ./health_test/
echo ""

# Test 3: Security
echo "Test 3: Security"
echo "Running with security enabled..."
./zenbot.sh sim --conf=conf.test.iteration4.js --strategy=stddev --paper --enable_security=true --days=1 > test4_3_results.log
echo "Check secure_test directory for secure files"
ls -la ./secure_test/
echo ""

# Test 4: Backup
echo "Test 4: Backup"
echo "Running with backup enabled..."
./zenbot.sh sim --conf=conf.test.iteration4.js --strategy=stddev --paper --enable_backup=true --backup_interval=60000 --days=1 > test4_4_results.log
echo "Check backups_test directory for backup files"
ls -la ./backups_test/
echo ""

# Test 5: Error Recovery
echo "Test 5: Error Recovery"
echo "Running with error recovery..."
./zenbot.sh sim --conf=conf.test.iteration4.js --strategy=stddev --paper --auto_recover=true --days=1 > test4_5_results.log
echo "Check test4_5_results.log for error recovery messages"
grep "Recovery" test4_5_results.log
echo ""

# Test 6: Integration Test
echo "Test 6: Integration Test"
echo "Running with all enhancements enabled..."
./zenbot.sh sim --conf=conf.test.iteration4.js --strategy=stddev --paper --sell_stop_pct=0.1 --profit_stop_enable_pct=5 --profit_stop_pct=1 --enable_market_adaptation=true --market_adaptation_strength=1.0 --enable_health_check=true --enable_security=true --enable_backup=true --save_state=true --days=7 > test4_6_results.log
echo "Check test4_6_results.log for overall behavior"
echo ""

# Test 7: Performance Comparison
echo "Test 7: Performance Comparison"
echo "Comparing performance with Iteration 3..."
./zenbot.sh sim --conf=conf.test.iteration4.js --strategy=stddev --paper --sell_stop_pct=0.1 --profit_stop_enable_pct=5 --profit_stop_pct=1 --enable_market_adaptation=true --market_adaptation_strength=1.0 --days=30 --analyze > iteration4_performance.log
echo "Check iteration4_performance.log for performance metrics"
echo ""

echo "Testing complete. Review the log files for detailed results."
EOF

# Make the test script executable
chmod +x test_production_hardening.sh
```

Run the test script and verify the enhancements:

```bash
# Run the test script
./test_production_hardening.sh

# Check for log files
ls -la ./logs_test/

# Check for health files
ls -la ./health_test/

# Check for secure files
ls -la ./secure_test/

# Check for backup files
ls -la ./backups_test/

# Check overall performance
./zenbot.sh sim --conf=conf.test.iteration4.js --strategy=stddev --paper --sell_stop_pct=0.1 --profit_stop_enable_pct=5 --profit_stop_pct=1 --enable_market_adaptation=true --market_adaptation_strength=1.0 --days=30 --analyze
```

If all tests pass, commit the changes:

```bash
# Add the modified files to the staging area
git add lib/engine.js lib/modules/ conf.js commands/trade.js

# Commit the changes
git commit -m "Iteration 4: Production hardening with comprehensive logging, security, and backup"
```

### Running in Production

To run the fixed version in production:

```bash
# Run with paper trading first to verify everything works
./zenbot.sh trade --strategy=stddev --paper --sell_stop_pct=0.1 --profit_stop_enable_pct=5 --profit_stop_pct=1 --enable_market_adaptation=true --market_adaptation_strength=1.0 --save_state=true --enable_health_check=true --enable_security=true --enable_backup=true

# When satisfied, run in live mode
./zenbot.sh trade --strategy=stddev --sell_stop_pct=0.1 --profit_stop_enable_pct=5 --profit_stop_pct=1 --enable_market_adaptation=true --market_adaptation_strength=1.0 --save_state=true --enable_health_check=true --enable_security=true --enable_backup=true
```

### Troubleshooting

If you encounter issues:

1. Check the log files for error messages
2. Verify that all code changes were applied correctly
3. Ensure the configuration parameters are set correctly
4. Check the health status files for system health information
5. Try restoring from a backup if the system is in an inconsistent state
6. Use the security module to verify that sensitive data is properly protected

This completes Part 4 of the ProfitCommandManual, covering production hardening for your Zenbot trading strategy. In Part 5, we'll continue with deployment and operations.
