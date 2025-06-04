#!/usr/bin/env node
/**
 * SUI-USDT Backtesting Backfill Script - Final Production Version
 * 
 * This script is designed to efficiently backfill historical SUI-USDT trading data
 * for use with the high-frequency trading strategy in Quant-ZenbotV2.
 * 
 * Features:
 * - Optimized specifically for SUI-USDT pair on Binance
 * - Configurable date ranges and time periods
 * - Progress tracking and resumability
 * - MongoDB storage compatible with Zenbot simulation
 * - Enhanced logging and error handling
 * - Rate limiting to prevent API bans
 * - Performance optimization for large datasets
 * - Memory management for long-running processes
 * - Bulk database operations for improved performance
 * - Automatic simulation after backfill (optional)
 * - Parallel processing for faster backfilling
 * - Data integrity verification
 * - Automatic recovery from network errors
 * - Compatible with HFT strategy configuration
 */

const tb = require('timebucket');
const crypto = require('crypto');
const moment = require('moment');
const colors = require('colors');
const minimist = require('minimist');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const readline = require('readline');
const objectifySelector = require('./lib/objectify-selector');
const collectionService = require('./lib/services/collection-service');

// Set up logging
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  VERBOSE: 4
};

// Logger setup
const logger = {
  level: LOG_LEVELS.INFO,
  logFile: null,
  fileStream: null,

  setLevel(level) {
    this.level = level;
  },

  setLogFile(filePath) {
    this.logFile = filePath;
    if (this.fileStream) {
      this.fileStream.end();
    }
    this.fileStream = fs.createWriteStream(filePath, { flags: 'a' });
  },

  log(level, message, data = null) {
    if (level > this.level) return;

    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss.SSS');
    let logMessage = `[${timestamp}] `;

    switch (level) {
      case LOG_LEVELS.ERROR:
        logMessage += 'ERROR: '.red;
        break;
      case LOG_LEVELS.WARN:
        logMessage += 'WARN:  '.yellow;
        break;
      case LOG_LEVELS.INFO:
        logMessage += 'INFO:  '.green;
        break;
      case LOG_LEVELS.DEBUG:
        logMessage += 'DEBUG: '.cyan;
        break;
      case LOG_LEVELS.VERBOSE:
        logMessage += 'VERB:  '.gray;
        break;
    }

    logMessage += message;

    // Output to console
    console.log(logMessage);

    // Add data if present
    if (data) {
      const dataStr = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
      if (level <= LOG_LEVELS.WARN) {
        console.log(dataStr);
      } else if (level === LOG_LEVELS.DEBUG) {
        console.log(dataStr.cyan);
      } else if (level === LOG_LEVELS.VERBOSE) {
        console.log(dataStr.gray);
      }
    }

    // Write to log file if configured
    if (this.fileStream) {
      const cleanMessage = colors.stripColors(logMessage);
      this.fileStream.write(cleanMessage + '\n');
      if (data) {
        const dataStr = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
        this.fileStream.write(colors.stripColors(dataStr) + '\n');
      }
    }
  },

  error(message, data = null) {
    this.log(LOG_LEVELS.ERROR, message, data);
  },

  warn(message, data = null) {
    this.log(LOG_LEVELS.WARN, message, data);
  },

  info(message, data = null) {
    this.log(LOG_LEVELS.INFO, message, data);
  },

  debug(message, data = null) {
    this.log(LOG_LEVELS.DEBUG, message, data);
  },

  verbose(message, data = null) {
    this.log(LOG_LEVELS.VERBOSE, message, data);
  },

  // Progress bar
  progressBar: {
    width: 40,
    current: 0,
    total: 100,
    lastUpdate: 0,
    active: false,

    start(total = 100) {
      this.total = total;
      this.current = 0;
      this.active = true;
      this.lastUpdate = 0;
      this.update(0);
    },

    update(current) {
      if (!this.active) return;
      
      // Throttle updates to avoid console spam
      const now = Date.now();
      if (current !== this.total && now - this.lastUpdate < 500) return;
      this.lastUpdate = now;
      
      this.current = current;
      const percent = Math.min(100, Math.floor((current / this.total) * 100));
      const filled = Math.floor((this.width * percent) / 100);
      const empty = this.width - filled;
      
      const filledBar = '█'.repeat(filled);
      const emptyBar = '░'.repeat(empty);
      
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
      
      process.stdout.write(`Progress: [${filledBar}${emptyBar}] ${percent}% (${current}/${this.total})`);
      
      if (current >= this.total) {
        process.stdout.write('\n');
        this.active = false;
      }
    },

    stop() {
      if (this.active) {
        process.stdout.write('\n');
        this.active = false;
      }
    }
  }
};

// Default configuration
let conf = {};
try {
  conf = require('./conf');
} catch (e) {
  logger.warn('Could not load conf.js, using defaults');
  conf = {
    days: 14,
    selector: 'binance.SUI-USDT',
    mongo: {
      host: 'localhost',
      port: 27017,
      db: 'zenbot4'
    }
  };
}

// Use connection string if available
if (conf.mongo && conf.mongo.connectionString) {
  logger.info(`Using MongoDB connection string: ${conf.mongo.connectionString}`);
} else if (!conf.mongo) {
  conf.mongo = {
    connectionString: 'mongodb://localhost:27017/zenbot4'
  };
  logger.info('Using default MongoDB connection string');
} else if (conf.mongo && !conf.mongo.connectionString) {
  // Construct connection string if host/port/db are present but connectionString is not
  const host = conf.mongo.host || 'localhost';
  const port = conf.mongo.port || 27017;
  const db = conf.mongo.db || 'zenbot4';
  conf.mongo.connectionString = `mongodb://${host}:${port}/${db}`;
  logger.info(`Constructed MongoDB connection string: ${conf.mongo.connectionString}`);
}

// Parse command line arguments
const argv = minimist(process.argv.slice(2), {
  string: ['start', 'end', 'selector', 'log', 'batch-size', 'rate-limit', 'parallel', 'bulk-size', 'strategy', 'config'],
  boolean: ['help', 'debug', 'verbose', 'quiet', 'force', 'no-progress', 'sim-after', 'verify', 'clean', 'repair', 'optimize'],
  alias: {
    h: 'help',
    d: 'days',
    s: 'start',
    e: 'end',
    v: 'verbose',
    p: 'pair',
    q: 'quiet',
    l: 'log',
    f: 'force',
    b: 'batch-size',
    r: 'rate-limit',
    c: 'clean',
    o: 'optimize'
  },
  default: {
    days: conf.days || 14,
    selector: conf.selector || 'binance.SUI-USDT',
    debug: false,
    verbose: false,
    quiet: false,
    force: false,
    'no-progress': false,
    'sim-after': false,
    verify: false,
    clean: false,
    repair: false,
    optimize: false,
    log: path.join(process.cwd(), 'sui_usdt_backfill.log'),
    'batch-size': 1000,
    'rate-limit': 1200, // ms between API calls
    parallel: Math.max(1, Math.floor(os.cpus().length / 2)), // Use half of available CPU cores
    'bulk-size': 100, // Number of trades to bulk insert
    strategy: 'cci_srsi', // Default strategy
    config: './conf.js' // Default config file
  }
});

// Set log level based on command line arguments
if (argv.quiet) {
  logger.setLevel(LOG_LEVELS.ERROR);
} else if (argv.verbose) {
  logger.setLevel(LOG_LEVELS.VERBOSE);
} else if (argv.debug) {
  logger.setLevel(LOG_LEVELS.DEBUG);
}

// Set up log file
if (argv.log) {
  logger.setLogFile(argv.log);
  logger.info(`Logging to ${argv.log}`);
}

// Show help and exit
if (argv.help) {
  console.log('Usage: node sui_usdt_backfill.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --help, -h              Display this help message');
  console.log('  --days, -d <days>       Number of days to backfill (default: ' + argv.days + ')');
  console.log('  --start, -s <date>      Start date in YYYYMMDD format or unix timestamp');
  console.log('  --end, -e <date>        End date in YYYYMMDD format or unix timestamp');
  console.log('  --selector <selector>   Selector to use (default: ' + argv.selector + ')');
  console.log('  --pair, -p <pair>       Trading pair, alternative to selector (default: SUI-USDT)');
  console.log('  --debug                 Enable debug output');
  console.log('  --verbose, -v           Enable verbose output');
  console.log('  --quiet, -q             Suppress all output except errors');
  console.log('  --log, -l <file>        Log file path (default: ./sui_usdt_backfill.log)');
  console.log('  --force, -f             Force backfill even if data exists');
  console.log('  --clean, -c             Clean existing data before backfill');
  console.log('  --repair                Repair gaps in existing data');
  console.log('  --optimize, -o          Optimize database after backfill');
  console.log('  --batch-size, -b <n>    Number of trades to process in each batch (default: 1000)');
  console.log('  --bulk-size <n>         Number of trades to bulk insert (default: 100)');
  console.log('  --rate-limit, -r <ms>   Milliseconds between API calls (default: 1200)');
  console.log('  --parallel <n>          Number of parallel processes (default: half of CPU cores)');
  console.log('  --no-progress           Disable progress bar');
  console.log('  --sim-after             Run simulation after backfill completes');
  console.log('  --verify                Verify data integrity after backfill');
  console.log('  --strategy <name>       Strategy to use for simulation (default: cci_srsi)');
  console.log('  --config <file>         Configuration file to use (default: ./conf.js)');
  console.log('');
  console.log('Examples:');
  console.log('  node sui_usdt_backfill.js --days 30');
  console.log('  node sui_usdt_backfill.js --start 20250101 --end 20250131');
  console.log('  node sui_usdt_backfill.js --selector binance.SUI-USDT --days 7 --verbose');
  console.log('  node sui_usdt_backfill.js --days 14 --force --sim-after');
  console.log('  node sui_usdt_backfill.js --days 30 --parallel 4 --bulk-size 200');
  console.log('  node sui_usdt_backfill.js --repair --verify');
  process.exit(0);
}

// Process pair argument if provided
if (argv.pair && argv.pair !== 'SUI-USDT') {
  argv.selector = 'binance.' + argv.pair;
}

// Process selector
const selector = objectifySelector(argv.selector);

// Process date ranges
let start_time, end_time;

if (argv.start) {
  if (/^\d{8}$/.test(argv.start)) {
    // YYYYMMDD format
    start_time = moment(argv.start, 'YYYYMMDD').valueOf();
  } else {
    // Unix timestamp
    start_time = parseInt(argv.start);
  }
} else {
  // Default to N days ago
  start_time = moment().subtract(argv.days, 'days').valueOf();
}

if (argv.end) {
  if (/^\d{8}$/.test(argv.end)) {
    // YYYYMMDD format
    end_time = moment(argv.end, 'YYYYMMDD').valueOf();
  } else {
    // Unix timestamp
    end_time = parseInt(argv.end);
  }
} else {
  // Default to now
  end_time = moment().valueOf();
}

// Validate date range
if (end_time <= start_time) {
  logger.error('End time must be after start time');
  process.exit(1);
}

// Validate batch size
const batchSize = parseInt(argv['batch-size']);
if (isNaN(batchSize) || batchSize < 1) {
  logger.error('Batch size must be a positive integer');
  process.exit(1);
}

// Validate bulk size
const bulkSize = parseInt(argv['bulk-size']);
if (isNaN(bulkSize) || bulkSize < 1) {
  logger.error('Bulk size must be a positive integer');
  process.exit(1);
}

// Validate rate limit
const rateLimit = parseInt(argv['rate-limit']);
if (isNaN(rateLimit) || rateLimit < 0) {
  logger.error('Rate limit must be a non-negative integer');
  process.exit(1);
}

// Validate parallel processes
const parallelProcesses = parseInt(argv.parallel);
if (isNaN(parallelProcesses) || parallelProcesses < 1) {
  logger.error('Number of parallel processes must be a positive integer');
  process.exit(1);
}

// Load custom configuration if specified
if (argv.config && argv.config !== './conf.js') {
  try {
    const customConf = require(path.resolve(process.cwd(), argv.config));
    Object.assign(conf, customConf);
    logger.info(`Loaded custom configuration from ${argv.config}`);
  } catch (e) {
    logger.error(`Failed to load custom configuration from ${argv.config}`, e);
    process.exit(1);
  }
}

// Error handling and retry logic
const MAX_RETRIES = 5;
const RETRY_DELAYS = [1000, 5000, 15000, 30000, 60000]; // Increasing backoff

// Memory management
function checkMemoryUsage() {
  const memoryUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
  const rss = Math.round(memoryUsage.rss / 1024 / 1024);
  
  logger.debug(`Memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB (Heap), ${rss}MB (RSS)`);
  
  // Force garbage collection if available and memory usage is high
  if (global.gc && heapUsedMB > heapTotalMB * 0.8) {
    logger.debug('Forcing garbage collection');
    global.gc();
  }
  
  return { heapUsedMB, heapTotalMB, rss };
}

// Initialize
async function run() {
  logger.info('Backfill: SUI-USDT Historical Data');
  logger.info('==============================');
  logger.info(`Selector: ${selector.normalized}`);
  logger.info(`Period:   ${moment(start_time).format('YYYY-MM-DD HH:mm:ss')} to ${moment(end_time).format('YYYY-MM-DD HH:mm:ss')}`);
  logger.info(`Days:     ${moment(end_time).diff(moment(start_time), 'days')}`);
  logger.info(`Batch size: ${batchSize}, Bulk size: ${bulkSize}, Rate limit: ${rateLimit}ms`);
  logger.info(`Parallel processes: ${parallelProcesses}`);
  
  if (argv.force) {
    logger.warn('Force mode enabled - will overwrite existing data');
  }
  
  if (argv.clean) {
    logger.warn('Clean mode enabled - will remove existing data before backfill');
  }
  
  if (argv.repair) {
    logger.warn('Repair mode enabled - will identify and fill gaps in existing data');
  }
  
  if (argv.optimize) {
    logger.warn('Optimize mode enabled - will optimize database after backfill');
  }

  // Load exchange module
  let exchange;
  try {
    exchange = require(`./extensions/exchanges/${selector.exchange_id}/exchange`)(conf);
    if (!exchange) {
      throw new Error('Exchange not found');
    }
    logger.info(`Using exchange: ${selector.exchange_id}`);
  } catch (e) {
    logger.error(`Cannot backfill ${selector.normalized}: exchange not implemented`, e);
    process.exit(1);
  }

  // Check if exchange supports historical data
  const mode = exchange.historyScan;
  if (!mode) {
    logger.error(`Cannot backfill ${selector.normalized}: exchange does not offer historical data`);
    process.exit(1);
  }
  logger.info(`Exchange scan mode: ${mode}`);

  // Initialize MongoDB connection properly
  logger.info('Connecting to MongoDB...');
  const MongoClient = require('mongodb').MongoClient;

  let mongoClient, db;
  try {
    // Connect to MongoDB
    mongoClient = await MongoClient.connect(conf.mongo.connectionString, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    db = mongoClient.db('zenbot4');
    logger.info('Successfully connected to MongoDB');

    // Set up the conf.db.mongo structure that collection service expects
    conf.db = { mongo: db };

    logger.debug('MongoDB database object set up successfully');
  } catch (e) {
    logger.error('Failed to connect to MongoDB', e);
    process.exit(1);
  }

  // Initialize collections
  let collectionServiceInstance, tradesCollection, resumeMarkers;
  try {
    logger.debug('Initializing collection service...');
    collectionServiceInstance = collectionService(conf);

    logger.debug('Getting trades collection...');
    tradesCollection = collectionServiceInstance.getTrades();
    if (!tradesCollection) {
      throw new Error('Failed to get trades collection from collection service');
    }

    logger.debug('Getting resume markers collection...');
    resumeMarkers = collectionServiceInstance.getResumeMarkers();
    if (!resumeMarkers) {
      throw new Error('Failed to get resume markers collection from collection service');
    }

    // Test the collections by performing a simple operation
    logger.debug('Testing collection connectivity...');
    await tradesCollection.findOne({}, { limit: 1 });
    await resumeMarkers.findOne({}, { limit: 1 });

    logger.debug('MongoDB collections initialized and tested successfully');
  } catch (e) {
    logger.error('Failed to initialize MongoDB collections', e);
    logger.error('Error details:', {
      message: e.message,
      code: e.code,
      stack: e.stack
    });
    process.exit(1);
  }

  // Clean existing data if requested
  if (argv.clean) {
    try {
      logger.info('Cleaning existing data...');
      const result = await tradesCollection.deleteMany({
        selector: selector.normalized,
        time: { $gte: start_time, $lte: end_time }
      });
      logger.info(`Cleaned ${result.deletedCount} existing trades`);
      
      // Also clean markers
      await resumeMarkers.deleteMany({
        selector: selector.normalized
      });
      logger.info('Cleaned existing progress markers');
    } catch (e) {
      logger.error('Failed to clean existing data', e);
      process.exit(1);
    }
  }
  // Check if data already exists
  else if (!argv.force && !argv.repair) {
    try {
      const existingCount = await tradesCollection.countDocuments({
        selector: selector.normalized,
        time: { $gte: start_time, $lte: end_time }
      });
      
      if (existingCount > 0) {
        logger.warn(`Found ${existingCount} existing trades in the specified time range.`);
        logger.warn('Use --force to overwrite existing data, --clean to remove it, --repair to fill gaps, or adjust your date range.');
        process.exit(0);
      }
    } catch (e) {
      logger.error('Failed to check for existing data', e);
      // Continue despite error
    }
  }

  // If repair mode is enabled, identify gaps
  if (argv.repair) {
    await repairGaps();
    return;
  }

  // Create marker for tracking progress
  const marker = {
    id: crypto.randomBytes(4).toString('hex'),
    selector: selector.normalized,
    from: null,
    to: null,
    oldest_time: null,
    newest_time: null
  };
  marker._id = marker.id;
  logger.debug('Created progress marker', marker);

  // Counters and state
  let trade_counter = 0;
  let batch_counter = 0;
  let get_trade_retry_count = 0;
  let last_batch_id, last_batch_opts;
  let offset = exchange.offset;
  let start_time_ms = Date.now();
  let last_memory_check = Date.now();
  let last_save_marker = Date.now();
  let bulk_operations = [];

  // Find existing markers for this selector
  let markers;
  try {
    markers = await resumeMarkers.find({selector: selector.normalized}).toArray();
    markers.sort((a, b) => {
      if (mode === 'backward') {
        if (a.to > b.to) return -1;
        if (a.to < b.to) return 1;
      } else {
        if (a.from < b.from) return -1;
        if (a.from > b.from) return 1;
      }
      return 0;
    });
    
    if (markers.length > 0) {
      logger.info(`Found ${markers.length} existing progress markers for ${selector.normalized}`);
      logger.debug('Existing markers', markers);
    }
  } catch (e) {
    logger.error('Failed to retrieve existing markers', e);
    process.exit(1);
  }

  // Handle process termination
  process.on('SIGINT', async () => {
    logger.warn('Received SIGINT, saving progress and exiting...');
    logger.progressBar.stop();
    try {
      // Flush any pending bulk operations
      if (bulk_operations.length > 0) {
        await flushBulkOperations();
      }

      await resumeMarkers.replaceOne({_id: marker.id}, marker, {upsert: true});
      logger.info('Progress saved. You can resume this backfill later.');

      // Close MongoDB connection
      if (mongoClient) {
        await mongoClient.close();
        logger.debug('MongoDB connection closed');
      }

      process.exit(0);
    } catch (e) {
      logger.error('Failed to save progress marker', e);

      // Still try to close MongoDB connection
      if (mongoClient) {
        try {
          await mongoClient.close();
        } catch (closeErr) {
          logger.error('Failed to close MongoDB connection', closeErr);
        }
      }

      process.exit(1);
    }
  });

  // Estimate total trades for progress bar
  let estimated_total_trades = 0;
  try {
    // Estimate based on average trades per day for this pair
    const avg_trades_per_day = 50000; // Estimated for SUI-USDT
    const days = moment(end_time).diff(moment(start_time), 'days');
    estimated_total_trades = avg_trades_per_day * days;
    
    if (!argv['no-progress']) {
      logger.progressBar.start(estimated_total_trades);
    }
  } catch (e) {
    logger.warn('Failed to estimate total trades', e);
  }

  // Function to flush bulk operations
  async function flushBulkOperations() {
    if (bulk_operations.length === 0) return;
    
    try {
      const bulkResult = await tradesCollection.bulkWrite(bulk_operations, { ordered: false });
      logger.verbose(`Bulk operation completed: ${bulkResult.upsertedCount} upserted, ${bulkResult.modifiedCount} modified`);
    } catch (e) {
      // Handle duplicate key errors gracefully
      if (e.code === 11000) {
        logger.debug('Some trades already exist in database (duplicate key error)');
      } else {
        logger.error('Bulk operation failed', e);
        throw e; // Re-throw for retry
      }
    }
    
    // Clear the array
    bulk_operations = [];
  }

  // Function to add trade to bulk operations
  function addToBulkOperations(trade) {
    bulk_operations.push({
      replaceOne: {
        filter: { _id: trade._id },
        replacement: trade,
        upsert: true
      }
    });
    
    if (bulk_operations.length >= bulkSize) {
      return flushBulkOperations();
    }
    
    return Promise.resolve();
  }

  // If using parallel processing, split the time range
  if (parallelProcesses > 1 && !argv.repair) {
    return runParallel();
  } else {
    // Start fetching trades
    await getNext();
  }

  // Function to run parallel backfill processes
  async function runParallel() {
    logger.info(`Starting ${parallelProcesses} parallel backfill processes...`);
    
    // Split the time range into chunks
    const timeRangeMs = end_time - start_time;
    const chunkSizeMs = Math.floor(timeRangeMs / parallelProcesses);
    
    const chunks = [];
    for (let i = 0; i < parallelProcesses; i++) {
      const chunkStart = start_time + (i * chunkSizeMs);
      const chunkEnd = (i === parallelProcesses - 1) ? end_time : chunkStart + chunkSizeMs;
      
      chunks.push({
        start: chunkStart,
        end: chunkEnd
      });
    }
    
    logger.debug('Time range chunks', chunks);
    
    // Create child processes for each chunk
    const children = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Build arguments for child process
      const childArgs = [
        path.resolve(__dirname, 'sui_usdt_backfill_final.js'),
        '--start', chunk.start.toString(),
        '--end', chunk.end.toString(),
        '--selector', selector.normalized,
        '--batch-size', batchSize.toString(),
        '--bulk-size', bulkSize.toString(),
        '--rate-limit', rateLimit.toString(),
        '--log', `${argv.log}.${i}`,
        '--no-progress'
      ];
      
      if (argv.force) childArgs.push('--force');
      if (argv.debug) childArgs.push('--debug');
      if (argv.quiet) childArgs.push('--quiet');
      
      logger.info(`Starting child process ${i+1}/${parallelProcesses} for time range ${moment(chunk.start).format('YYYY-MM-DD')} to ${moment(chunk.end).format('YYYY-MM-DD')}`);
      
      const child = spawn('node', childArgs, {
        stdio: 'inherit'
      });
      
      children.push(child);
      
      // Add event listeners
      child.on('error', (err) => {
        logger.error(`Child process ${i+1} error:`, err);
      });
    }
    
    // Wait for all child processes to complete
    const results = await Promise.all(children.map((child, i) => {
      return new Promise((resolve) => {
        child.on('close', (code) => {
          logger.info(`Child process ${i+1}/${parallelProcesses} exited with code ${code}`);
          resolve({ index: i, code });
        });
      });
    }));
    
    // Check if all processes completed successfully
    const failed = results.filter(r => r.code !== 0);
    if (failed.length > 0) {
      logger.error(`${failed.length} child processes failed`);
      process.exit(1);
    }
    
    logger.info('All parallel backfill processes completed successfully');
    
    // Verify data if requested
    if (argv.verify) {
      await verifyData();
    }
    
    // Optimize database if requested
    if (argv.optimize) {
      await optimizeDatabase();
    }
    
    // Run simulation if requested
    if (argv['sim-after']) {
      await runSimulation();
    } else {
      process.exit(0);
    }
  }

  // Function to repair gaps in existing data
  async function repairGaps() {
    logger.info('Analyzing existing data for gaps...');
    
    try {
      // Get min and max time from existing data
      const minMaxResult = await tradesCollection.aggregate([
        { $match: { selector: selector.normalized, time: { $gte: start_time, $lte: end_time } } },
        { $group: { _id: null, min_time: { $min: "$time" }, max_time: { $max: "$time" } } }
      ]).toArray();
      
      if (minMaxResult.length === 0) {
        logger.warn('No existing data found in the specified time range. Use regular backfill instead of repair.');
        process.exit(0);
      }
      
      const { min_time, max_time } = minMaxResult[0];
      logger.info(`Existing data spans from ${moment(min_time).format('YYYY-MM-DD HH:mm:ss')} to ${moment(max_time).format('YYYY-MM-DD HH:mm:ss')}`);
      
      // Find gaps by sampling at 1-hour intervals
      const hourMs = 60 * 60 * 1000;
      const gaps = [];
      
      // Start from min_time and check each hour
      for (let time = min_time; time <= max_time; time += hourMs) {
        const startWindow = time;
        const endWindow = time + hourMs;
        
        const count = await tradesCollection.countDocuments({
          selector: selector.normalized,
          time: { $gte: startWindow, $lt: endWindow }
        });
        
        if (count === 0) {
          // Found a gap, extend it as far as possible
          let gapStart = startWindow;
          let gapEnd = endWindow;
          
          // Find exact gap start
          while (gapStart > min_time) {
            const prevHour = gapStart - hourMs;
            const prevCount = await tradesCollection.countDocuments({
              selector: selector.normalized,
              time: { $gte: prevHour, $lt: gapStart }
            });
            
            if (prevCount === 0) {
              gapStart = prevHour;
            } else {
              break;
            }
          }
          
          // Find exact gap end
          while (gapEnd < max_time) {
            const nextHour = gapEnd + hourMs;
            const nextCount = await tradesCollection.countDocuments({
              selector: selector.normalized,
              time: { $gte: gapEnd, $lt: nextHour }
            });
            
            if (nextCount === 0) {
              gapEnd = nextHour;
            } else {
              break;
            }
          }
          
          // Add gap to list
          gaps.push({
            start: gapStart,
            end: gapEnd,
            duration: moment.duration(gapEnd - gapStart).humanize()
          });
          
          // Skip to end of this gap
          time = gapEnd;
        }
      }
      
      if (gaps.length === 0) {
        logger.info('No gaps found in the data!');
        process.exit(0);
      }
      
      logger.info(`Found ${gaps.length} gaps in the data:`);
      gaps.forEach((gap, i) => {
        logger.info(`Gap ${i+1}: ${moment(gap.start).format('YYYY-MM-DD HH:mm:ss')} to ${moment(gap.end).format('YYYY-MM-DD HH:mm:ss')} (${gap.duration})`);
      });
      
      // Fill gaps one by one
      for (let i = 0; i < gaps.length; i++) {
        const gap = gaps[i];
        logger.info(`Filling gap ${i+1}/${gaps.length}: ${moment(gap.start).format('YYYY-MM-DD HH:mm:ss')} to ${moment(gap.end).format('YYYY-MM-DD HH:mm:ss')}`);
        
        // Reset marker for this gap
        marker.id = crypto.randomBytes(4).toString('hex');
        marker._id = marker.id;
        marker.from = null;
        marker.to = null;
        marker.oldest_time = null;
        marker.newest_time = null;
        
        // Reset counters
        trade_counter = 0;
        batch_counter = 0;
        get_trade_retry_count = 0;
        last_batch_id = null;
        last_batch_opts = null;
        bulk_operations = [];
        
        // Set time range for this gap
        start_time = gap.start;
        end_time = gap.end;
        
        // Start backfilling this gap
        await getNext();
      }
      
      logger.info('All gaps have been filled!');
      
      if (argv.verify) {
        await verifyData();
      }
      
      if (argv.optimize) {
        await optimizeDatabase();
      }
      
      process.exit(0);
    } catch (e) {
      logger.error('Failed to analyze gaps', e);
      process.exit(1);
    }
  }

  async function getNext() {
    // Check memory usage periodically
    if (Date.now() - last_memory_check > 60000) { // Every minute
      const memUsage = checkMemoryUsage();
      
      // If memory usage is too high, flush operations and force GC
      if (memUsage.heapUsedMB > memUsage.heapTotalMB * 0.7) {
        if (bulk_operations.length > 0) {
          await flushBulkOperations();
        }
        
        if (global.gc) {
          global.gc();
        }
      }
      
      last_memory_check = Date.now();
    }
    
    const opts = {product_id: selector.product_id, limit: batchSize};
    
    if (mode === 'backward') {
      opts.to = marker.from;
    } else {
      if (marker.to) {
        opts.from = marker.to + 1;
      } else {
        opts.from = exchange.getCursor(start_time);
      }
    }
    
    if (offset) {
      opts.offset = offset;
    }
    
    last_batch_opts = opts;
    logger.verbose('Fetching trades with options', opts);
    
    let retryCount = 0;
    let trades;

    while (retryCount < MAX_RETRIES) {
      try {
        trades = await new Promise((resolve, reject) => {
          exchange.getTrades(opts, (err, results) => {
            if (err) reject(err);
            else resolve(results);
          });
        });
        
        break; // Success, exit retry loop
      } catch (err) {
        retryCount++;
        const retryDelay = RETRY_DELAYS[Math.min(retryCount - 1, RETRY_DELAYS.length - 1)];
        
        if (err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND' || err.code === 'ECONNRESET' || 
            (err.message && err.message.includes('rate limit'))) {
          logger.warn(`Network error (attempt ${retryCount}/${MAX_RETRIES}), retrying in ${retryDelay/1000}s...`, err);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        
        // For other errors, log and exit
        logger.error('Failed to fetch trades', err);
        process.exit(1);
      }
    }
    
    if (!trades) {
      logger.error(`Failed to fetch trades after ${MAX_RETRIES} attempts`);
      process.exit(1);
    }
    
    if (mode !== 'backward' && !trades.length) {
      if (trade_counter) {
        logger.info('Download complete!');
        logger.progressBar.stop();
        
        // Flush any remaining bulk operations
        if (bulk_operations.length > 0) {
          await flushBulkOperations();
        }
        
        await displaySummary();
        
        if (argv.verify) {
          await verifyData();
        }
        
        if (argv.optimize) {
          await optimizeDatabase();
        }
        
        if (argv['sim-after']) {
          await runSimulation();
        } else {
          process.exit(0);
        }
      } else {
        if (get_trade_retry_count < 5) {
          logger.warn('getTrades() returned no trades, retrying with smaller interval.');
          get_trade_retry_count++;
          start_time += (end_time - start_time) * 0.4;
          return await getNext();
        } else {
          logger.error('getTrades() returned no trades, --start may be too remotely in the past.');
          process.exit(1);
        }
      }
    } else if (!trades.length) {
      logger.warn('getTrades() returned no trades, we may have exhausted the historical data range.');
      logger.progressBar.stop();
      
      // Flush any remaining bulk operations
      if (bulk_operations.length > 0) {
        await flushBulkOperations();
      }
      
      await displaySummary();
      
      if (argv.verify) {
        await verifyData();
      }
      
      if (argv.optimize) {
        await optimizeDatabase();
      }
      
      if (argv['sim-after']) {
        await runSimulation();
      } else {
        process.exit(0);
      }
    }
    
    // Sort trades
    trades.sort((a, b) => {
      if (mode === 'backward') {
        if (a.time > b.time) return -1;
        if (a.time < b.time) return 1;
      } else {
        if (a.time < b.time) return -1;
        if (a.time > b.time) return 1;
      }
      return 0;
    });
    
    // Check for duplicate results
    if (last_batch_id && last_batch_id === trades[0].trade_id) {
      logger.error('getTrades() returned duplicate results', {
        current: opts,
        previous: last_batch_opts
      });
      process.exit(1);
    }
    
    last_batch_id = trades[0].trade_id;
    batch_counter++;
    
    logger.debug(`Processing batch ${batch_counter} with ${trades.length} trades`);
    
    // Process trades
    await runTasks(trades);
  }

  async function runTasks(trades) {
    try {
      // Save all trades
      for (const trade of trades) {
        await saveTrade(trade);
      }
      
      const oldest_time = marker.oldest_time;
      const newest_time = marker.newest_time;
      
      // Check for overlaps with other markers
      for (const other_marker of markers) {
        // For backward scan, if the oldest_time is within another marker's range, skip to the other marker's start point
        if (mode === 'backward' && marker.id !== other_marker.id && 
            marker.from <= other_marker.to && marker.from > other_marker.from) {
          logger.info(`Detected overlap with existing marker ${other_marker.id}, adjusting range`);
          marker.from = other_marker.from;
          marker.oldest_time = other_marker.oldest_time;
        }
        // For forward scan, if the newest_time is within another marker's range, skip to the other marker's end point
        else if (mode !== 'backward' && marker.id !== other_marker.id && 
                marker.to >= other_marker.from && marker.to < other_marker.to) {
          logger.info(`Detected overlap with existing marker ${other_marker.id}, adjusting range`);
          marker.to = other_marker.to;
          marker.newest_time = other_marker.newest_time;
        }
      }
      
      // Report skipped data
      let diff;
      if (oldest_time !== marker.oldest_time) {
        diff = tb(oldest_time - marker.oldest_time).resize('1h').value;
        logger.info(`Skipping ${diff} hrs of previously collected data`);
      } else if (newest_time !== marker.newest_time) {
        diff = tb(marker.newest_time - newest_time).resize('1h').value;
        logger.info(`Skipping ${diff} hrs of previously collected data`);
      }
      
      // Flush bulk operations if we have enough
      if (bulk_operations.length >= bulkSize) {
        await flushBulkOperations();
      }
      
      // Save marker periodically (every 5 minutes)
      if (Date.now() - last_save_marker > 300000) {
        try {
          await resumeMarkers.replaceOne({_id: marker.id}, marker, {upsert: true});
          logger.debug('Progress marker updated', marker);
          last_save_marker = Date.now();
        } catch (e) {
          logger.error('Failed to update progress marker', e);
          // Continue despite error
        }
      }
      
      // Setup for next batch
      trade_counter += trades.length;
      
      // Update progress bar
      if (!argv['no-progress']) {
        logger.progressBar.update(Math.min(trade_counter, estimated_total_trades));
      }
      
      // Calculate days left
      const current_days_left = 1 + (mode === 'backward' 
        ? tb(marker.oldest_time - start_time).resize('1d').value 
        : tb(end_time - marker.newest_time).resize('1d').value);
      
      // Progress reporting
      if (batch_counter % 10 === 0 || current_days_left < 1) {
        const progress = mode === 'backward'
          ? ((marker.oldest_time - start_time) / (end_time - start_time) * 100).toFixed(1)
          : ((marker.newest_time - start_time) / (end_time - start_time) * 100).toFixed(1);
        
        const elapsed_ms = Date.now() - start_time_ms;
        const elapsed_min = (elapsed_ms / 60000).toFixed(1);
        const trades_per_min = (trade_counter / (elapsed_ms / 60000)).toFixed(0);
        
        if (argv['no-progress']) {
          logger.info(`Progress: ${progress}% complete, ${trade_counter} trades (${trades_per_min}/min), ${current_days_left.toFixed(1)} days left, elapsed: ${elapsed_min} min`);
        }
      } else if (argv['no-progress']) {
        process.stdout.write('.');
      }
      
      // Check if we're done
      if ((mode === 'backward' && marker.oldest_time <= start_time) ||
          (mode !== 'backward' && marker.newest_time >= end_time)) {
        logger.info('Backfill complete!');
        logger.progressBar.stop();
        
        // Flush any remaining bulk operations
        if (bulk_operations.length > 0) {
          await flushBulkOperations();
        }
        
        // Save final marker
        try {
          await resumeMarkers.replaceOne({_id: marker.id}, marker, {upsert: true});
        } catch (e) {
          logger.error('Failed to save final marker', e);
        }
        
        await displaySummary();
        
        if (argv.verify) {
          await verifyData();
        }
        
        if (argv.optimize) {
          await optimizeDatabase();
        }
        
        if (argv['sim-after']) {
          await runSimulation();
        } else {
          process.exit(0);
        }
      }
      
      // Rate limiting
      const actualRateLimit = exchange.backfillRateLimit || rateLimit;
      if (actualRateLimit > 0) {
        await new Promise(resolve => setTimeout(resolve, actualRateLimit));
      }
      
      // Get next batch
      await getNext();
      
    } catch (err) {
      logger.error('Error processing trades', err);
      logger.warn('Retrying after 10 seconds...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      return await runTasks(trades);
    }
  }

  async function saveTrade(trade) {
    trade.id = selector.normalized + '-' + String(trade.trade_id);
    trade._id = trade.id;
    trade.selector = selector.normalized;
    
    const cursor = exchange.getCursor(trade);
    
    if (mode === 'backward') {
      if (!marker.to) {
        marker.to = cursor;
        marker.oldest_time = trade.time;
        marker.newest_time = trade.time;
      }
      marker.from = marker.from ? Math.min(marker.from, cursor) : cursor;
      marker.oldest_time = Math.min(marker.oldest_time, trade.time);
    } else {
      if (!marker.from) {
        marker.from = cursor;
        marker.oldest_time = trade.time;
        marker.newest_time = trade.time;
      }
      marker.to = marker.to ? Math.max(marker.to, cursor) : cursor;
      marker.newest_time = Math.max(marker.newest_time, trade.time);
    }
    
    // Only save trades within our target time range
    if (trade.time >= start_time && trade.time <= end_time) {
      try {
        await addToBulkOperations(trade);
        logger.verbose(`Prepared trade ${trade.id} at ${moment(trade.time).format('YYYY-MM-DD HH:mm:ss')} for bulk insert`);
      } catch (e) {
        logger.error(`Failed to save trade ${trade.id}`, e);
        throw e; // Propagate error for retry
      }
    }
  }

  async function verifyData() {
    logger.info('Verifying data integrity...');
    
    try {
      // Count trades in database
      const count = await tradesCollection.countDocuments({
        selector: selector.normalized,
        time: { $gte: start_time, $lte: end_time }
      });
      
      logger.info(`Found ${count} trades in database`);
      
      // Check for time gaps
      const pipeline = [
        { $match: { selector: selector.normalized, time: { $gte: start_time, $lte: end_time } } },
        { $sort: { time: 1 } },
        { $group: {
            _id: null,
            times: { $push: "$time" },
            min_time: { $min: "$time" },
            max_time: { $max: "$time" }
          }
        }
      ];
      
      const result = await tradesCollection.aggregate(pipeline).toArray();
      
      if (result.length === 0) {
        logger.warn('No trades found for verification');
        return;
      }
      
      const { times, min_time, max_time } = result[0];
      
      logger.info(`Time range: ${moment(min_time).format('YYYY-MM-DD HH:mm:ss')} to ${moment(max_time).format('YYYY-MM-DD HH:mm:ss')}`);
      
      // Check for large gaps (more than 1 hour)
      let prev_time = times[0];
      let large_gaps = 0;
      let max_gap = 0;
      let max_gap_start = 0;
      
      for (let i = 1; i < times.length; i++) {
        const gap = times[i] - prev_time;
        
        if (gap > 3600000) { // 1 hour in ms
          large_gaps++;
          if (gap > max_gap) {
            max_gap = gap;
            max_gap_start = prev_time;
          }
        }
        
        prev_time = times[i];
      }
      
      if (large_gaps > 0) {
        logger.warn(`Found ${large_gaps} large gaps (>1 hour) in the data`);
        logger.warn(`Largest gap: ${(max_gap / 3600000).toFixed(1)} hours starting at ${moment(max_gap_start).format('YYYY-MM-DD HH:mm:ss')}`);
      } else {
        logger.info('No large gaps found in the data');
      }
      
      // Check for duplicate trades
      const duplicatePipeline = [
        { $match: { selector: selector.normalized, time: { $gte: start_time, $lte: end_time } } },
        { $group: { _id: "$trade_id", count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
        { $count: "duplicates" }
      ];
      
      const duplicateResult = await tradesCollection.aggregate(duplicatePipeline).toArray();
      
      if (duplicateResult.length > 0 && duplicateResult[0].duplicates > 0) {
        logger.warn(`Found ${duplicateResult[0].duplicates} duplicate trade IDs`);
      } else {
        logger.info('No duplicate trade IDs found');
      }
      
      // Check for price anomalies
      const anomalyPipeline = [
        { $match: { selector: selector.normalized, time: { $gte: start_time, $lte: end_time } } },
        { $sort: { time: 1 } },
        { $group: {
            _id: null,
            avg_price: { $avg: "$price" },
            std_dev: { $stdDevPop: "$price" },
            min_price: { $min: "$price" },
            max_price: { $max: "$price" }
          }
        }
      ];
      
      const anomalyResult = await tradesCollection.aggregate(anomalyPipeline).toArray();
      
      if (anomalyResult.length > 0) {
        const { avg_price, std_dev, min_price, max_price } = anomalyResult[0];
        logger.info(`Price statistics: avg=${avg_price.toFixed(6)}, stddev=${std_dev.toFixed(6)}, min=${min_price.toFixed(6)}, max=${max_price.toFixed(6)}`);
        
        // Check for extreme outliers (more than 3 standard deviations from mean)
        const upperBound = avg_price + (3 * std_dev);
        const lowerBound = avg_price - (3 * std_dev);
        
        const outlierCount = await tradesCollection.countDocuments({
          selector: selector.normalized,
          time: { $gte: start_time, $lte: end_time },
          price: { $gt: upperBound, $lt: lowerBound }
        });
        
        if (outlierCount > 0) {
          logger.warn(`Found ${outlierCount} price outliers (>3 std dev from mean)`);
        } else {
          logger.info('No extreme price outliers found');
        }
      }
      
      logger.info('Data verification complete');
    } catch (e) {
      logger.error('Data verification failed', e);
    }
  }

  async function optimizeDatabase() {
    logger.info('Optimizing database...');
    
    try {
      // Create index on selector and time
      await tradesCollection.createIndex({ selector: 1, time: 1 });
      logger.info('Created index on selector and time');
      
      // Create index on trade_id
      await tradesCollection.createIndex({ trade_id: 1 });
      logger.info('Created index on trade_id');
      
      // Run compact command
      const db = tradesCollection.s.db;
      await db.command({ compact: tradesCollection.collectionName });
      logger.info('Compacted trades collection');
      
      logger.info('Database optimization complete');
    } catch (e) {
      logger.error('Database optimization failed', e);
    }
  }

  async function displaySummary() {
    const elapsed_ms = Date.now() - start_time_ms;
    const elapsed_min = (elapsed_ms / 60000).toFixed(1);
    const trades_per_min = (trade_counter / (elapsed_ms / 60000)).toFixed(0);
    
    logger.info('=== Backfill Summary ===');
    logger.info(`Selector: ${selector.normalized}`);
    logger.info(`Period: ${moment(start_time).format('YYYY-MM-DD')} to ${moment(end_time).format('YYYY-MM-DD')}`);
    logger.info(`Total trades: ${trade_counter}`);
    logger.info(`Total batches: ${batch_counter}`);
    logger.info(`Elapsed time: ${elapsed_min} minutes`);
    logger.info(`Performance: ${trades_per_min} trades/minute`);
    
    // Count actual trades in database
    try {
      const count = await tradesCollection.countDocuments({
        selector: selector.normalized,
        time: { $gte: start_time, $lte: end_time }
      });
      
      logger.info(`Trades in database: ${count}`);
      
      if (count < trade_counter) {
        logger.warn(`Note: ${trade_counter - count} trades were outside the specified time range or duplicates`);
      }
    } catch (e) {
      logger.error('Failed to count trades in database', e);
    }
    
    logger.info('======================');
  }

  async function runSimulation() {
    logger.info('Starting simulation with backfilled data...');
    
    try {
      // Construct simulation command
      const simArgs = [
        'node',
        './zenbot.js',
        'sim',
        selector.normalized,
        '--strategy', argv.strategy || conf.strategy || 'cci_srsi',
        '--start', moment(start_time).format('YYYYMMDDHHmm'),
        '--end', moment(end_time).format('YYYYMMDDHHmm')
      ];
      
      // Execute simulation
      const sim = spawn('node', simArgs, { stdio: 'inherit' });
      
      sim.on('close', (code) => {
        logger.info(`Simulation completed with exit code ${code}`);
        process.exit(code);
      });
      
      sim.on('error', (err) => {
        logger.error('Failed to start simulation', err);
        process.exit(1);
      });
    } catch (e) {
      logger.error('Error running simulation', e);
      process.exit(1);
    }
  }
}

// Run the backfill process
run().catch(err => {
  logger.error('Fatal error', err);
  process.exit(1);
});
