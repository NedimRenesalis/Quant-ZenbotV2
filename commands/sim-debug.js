// This is a modified version of the sim command with added debugging and timeout protection
var minimist = require('minimist')
  , path = require('path')
  , moment = require('moment')
  , colors = require('colors')
  , tb = require('timebucket')
  , _ = require('lodash')
  , fs = require('fs')
  , n = require('numbro')
  , debug = require('../lib/debug')

module.exports = function (program, conf) {
  program
    .command('sim-debug [selector]')
    .allowUnknownOption()
    .description('run a debug simulation on backfilled data')
    .option('--conf <path>', 'path to optional conf overrides file')
    .option('--strategy <name>', 'strategy to use', String, conf.strategy)
    .option('--days <days>', 'set duration by day count', Number, conf.days)
    .option('--currency_capital <amount>', 'amount of start capital in currency', Number, conf.currency_capital)
    .option('--asset_capital <amount>', 'amount of start capital in asset', Number, conf.asset_capital)
    .option('--silent', 'only output on completion (can speed up sim)')
    .option('--timeout <seconds>', 'timeout for each period processing in seconds', Number, 10)
    .action(function (selector, cmd) {
      var s = { options: minimist(process.argv) }
      var so = s.options
      
      // Load configuration
      delete so._
      if (cmd.conf) {
        var overrides = require(path.resolve(process.cwd(), cmd.conf))
        Object.keys(overrides).forEach(function (k) {
          so[k] = overrides[k]
        })
      }
      Object.keys(conf).forEach(function (k) {
        if (!_.isUndefined(cmd[k])) {
          so[k] = cmd[k]
        }
      })
      
      // Ensure we have a selector
      if (!so.selector && !selector) {
        console.error('No selector specified. Please specify a selector like binance.BTC-USDT')
        process.exit(1)
      }
      if (!so.selector) so.selector = selector
      
      // Setup collections
      var collectionService = require('../lib/services/collection-service')(conf)
      var tradesCollection = collectionService.getTrades()
      var simResults = collectionService.getSimResults()
      
      // Setup time range
      if (so.days) {
        var d = new Date()
        var end = d.getTime()
        var start = end - (so.days * 86400000)
        so.start = moment(start).format('YYYYMMDDHHmm')
        so.end = moment(end).format('YYYYMMDDHHmm')
      }
      
      // Debug output
      console.log('Starting debug simulation with:')
      console.log('- Strategy:', so.strategy)
      console.log('- Selector:', so.selector)
      console.log('- Days:', so.days)
      console.log('- Start:', so.start)
      console.log('- End:', so.end)
      console.log('- Timeout per period:', so.timeout, 'seconds')
      
      // Load the engine
      var engine = require('../lib/engine')(s)
      
      // Add timeout protection to onPeriod
      var originalOnPeriod = engine.onPeriod
      engine.onPeriod = function(s, cb) {
        console.log('Processing period:', s.period ? s.period.time : 'initializing')
        
        // Set a timeout to prevent freezing
        var timeoutId = setTimeout(function() {
          console.error('TIMEOUT: Period processing took longer than', so.timeout, 'seconds')
          console.error('Current state:', JSON.stringify({
            period: s.period ? s.period.time : null,
            signal: s.signal,
            trend: s.trend,
            balance: s.balance
          }))
          cb() // Continue despite timeout
        }, so.timeout * 1000)
        
        // Call original onPeriod with wrapped callback
        originalOnPeriod(s, function() {
          clearTimeout(timeoutId)
          cb()
        })
      }
      
      // Run the simulation
      function getNext() {
        var opts = {
          query: {
            selector: so.selector
          },
          sort: {time: 1},
          limit: 1000
        }
        if (so.start) {
          var start = moment(so.start, 'YYYYMMDDHHmm').valueOf()
          opts.query.time = {$gte: start}
        }
        if (so.end) {
          var end = moment(so.end, 'YYYYMMDDHHmm').valueOf()
          if (!opts.query.time) opts.query.time = {}
          opts.query.time.$lte = end
        }
        
        console.log('Querying trades with:', JSON.stringify(opts.query))
        tradesCollection.find(opts.query).sort(opts.sort).limit(opts.limit).toArray(function (err, trades) {
          if (err) {
            console.error('Error querying trades:', err)
            process.exit(1)
          }
          if (!trades.length) {
            console.log('No trades found. Try running `zenbot backfill ' + so.selector + '` first.')
            process.exit(1)
          }
          
          console.log('Processing batch of', trades.length, 'trades')
          engine.update(trades, true, function (err) {
            if (err) {
              console.error('Error updating engine:', err)
              process.exit(1)
            }
            setImmediate(getNext)
          })
        })
      }
      
      engine.writeHeader()
      getNext()
    })
}
