var tb = require('timebucket')
  , minimist = require('minimist')
  , n = require('numbro')
  , fs = require('fs')
  , path = require('path')
  , moment = require('moment')
  , colors = require('colors')
  , objectifySelector = require('../lib/objectify-selector')
  , engineFactory = require('../lib/engine')
  , collectionService = require('../lib/services/collection-service')
  , jsonexport = require('jsonexport')
  , _ = require('lodash')

module.exports = function (program, conf) {
  program
    .command('sim [selector]')
    .allowUnknownOption()
    .description('run a simulation on backfilled data')
    .option('--conf <path>', 'path to optional conf overrides file')
    .option('--strategy <name>', 'strategy to use', String, conf.strategy)
    .option('--order_type <type>', 'order type to use (maker/taker)', /^(maker|taker)$/i, conf.order_type)
    .option('--reverse', 'use this and all your signals(buy/sell) will be switch! TAKE CARE!', Boolean, false)
    .option('--filename <filename>', 'filename for the result output (ex: result.html). "none" to disable', String, conf.filename)
    .option('--start <datetime>', 'start ("YYYYMMDDhhmm")')
    .option('--end <datetime>', 'end ("YYYYMMDDhhmm")')
    .option('--days <days>', 'set duration by day count', Number, conf.days)
    .option('--currency_capital <amount>', 'amount of start capital in currency', Number, conf.currency_capital)
    .option('--asset_capital <amount>', 'amount of start capital in asset', Number, conf.asset_capital)
    .option('--avg_slippage_pct <pct>', 'avg. amount of slippage to apply to trades', Number, conf.avg_slippage_pct)
    .option('--buy_pct <pct>', 'buy with this % of currency balance', Number, conf.buy_pct)
    .option('--sell_pct <pct>', 'sell with this % of asset balance', Number, conf.sell_pct)
    .option('--markdown_buy_pct <pct>', '% to mark down buy price', Number, conf.markdown_buy_pct)
    .option('--markup_sell_pct <pct>', '% to mark up sell price', Number, conf.markup_sell_pct)
    .option('--order_adjust_time <ms>', 'adjust bid/ask on this interval to keep orders competitive', Number, conf.order_adjust_time)
    .option('--order_poll_time <ms>', 'poll order status on this interval', Number, conf.order_poll_time)
    .option('--sell_cancel_pct <pct>', 'cancels the sale if the price is between this percentage (for more or less)', Number, conf.sell_cancel_pct)
    .option('--sell_stop_pct <pct>', 'sell if price drops below this % of bought price', Number, conf.sell_stop_pct)
    .option('--buy_stop_pct <pct>', 'buy if price surges above this % of sold price', Number, conf.buy_stop_pct)
    .option('--profit_stop_enable_pct <pct>', 'enable trailing sell stop when reaching this % profit', Number, conf.profit_stop_enable_pct)
    .option('--profit_stop_pct <pct>', 'maintain a trailing stop this % below the high-water mark of profit', Number, conf.profit_stop_pct)
    .option('--max_sell_loss_pct <pct>', 'avoid selling at a loss pct under this float', conf.max_sell_loss_pct)
    .option('--max_buy_loss_pct <pct>', 'avoid buying at a loss pct over this float', conf.max_buy_loss_pct)
    .option('--max_slippage_pct <pct>', 'avoid selling at a slippage pct above this float', conf.max_slippage_pct)
    .option('--symmetrical', 'reverse time at the end of the graph, normalizing buy/hold to 0', conf.symmetrical)
    .option('--rsi_periods <periods>', 'number of periods to calculate RSI at', Number, conf.rsi_periods)
    .option('--exact_buy_orders', 'instead of only adjusting maker buy when the price goes up, adjust it if price has changed at all')
    .option('--exact_sell_orders', 'instead of only adjusting maker sell when the price goes down, adjust it if price has changed at all')
    .option('--disable_options', 'disable printing of options')
    .option('--quarentine_time <minutes>', 'For loss trade, set quarentine time for cancel buys', Number, conf.quarentine_time)
    .option('--enable_stats', 'enable printing order stats')
    .option('--backtester_generation <generation>','creates a json file in simulations with the generation number', Number, -1)
    .option('--verbose', 'print status lines on every period')
    .option('--silent', 'only output on completion (can speed up sim)')
    .action(function (selector, cmd) {
      var s = { options: minimist(process.argv) }
      var so = s.options
      if (!so.quarentine_time) {
        so.quarentine_time = 0
      }

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
      var tradesCollection = collectionService(conf).getTrades()
      var simResults = collectionService(conf).getSimResults()

      // Ensure eventBus exists - create one if missing
      var eventBus = conf.eventBus
      if (!eventBus) {
        console.log('Warning: eventBus not found in conf, creating new EventEmitter')
        const EventEmitter = require('events')
        eventBus = new EventEmitter()
        conf.eventBus = eventBus
      }

      if (so.start) {
        so.start = moment(so.start, 'YYYYMMDDhhmm').valueOf()
        if (so.days && !so.end) {
          so.end = tb(so.start).resize('1d').add(so.days).toMilliseconds()
        }
      }
      if (so.end) {
        so.end = moment(so.end, 'YYYYMMDDhhmm').valueOf()
        if (so.days && !so.start) {
          so.start = tb(so.end).resize('1d').subtract(so.days).toMilliseconds()
        }
      }
      if (!so.start && so.days) {
        var d = tb('1d')
        so.start = d.subtract(so.days).toMilliseconds()
      }

      so.days = moment(so.end).diff(moment(so.start), 'days')

      so.stats = !!cmd.enable_stats
      so.show_options = !cmd.disable_options
      so.verbose = !!cmd.verbose
      so.selector = objectifySelector(selector || conf.selector)
      so.mode = 'sim'

      var engine = engineFactory(s, conf)
      if (!so.min_periods) so.min_periods = 1
      var cursor, reversing, reverse_point
      var query_start = so.start ? tb(so.start).resize(so.period_length).subtract(so.min_periods + 2).toMilliseconds() : null

      function exitSim () {
        console.log()
        if (!s.period) {
          console.error('no trades found! try running `zenbot backfill ' + so.selector.normalized + '` first')
          process.exit(1)
        }
        var option_keys = Object.keys(so)
        var output_lines = []
        option_keys.sort(function (a, b) {
          if (a < b) return -1
          return 1
        })
        var options = {}
        option_keys.forEach(function (k) {
          options[k] = so[k]
        })

        let options_output = options
        options_output.simresults = {}

        if (s.my_trades.length) {
          s.my_trades.push({
            price: s.period.close,
            size: s.balance.asset,
            type: 'sell',
            time: s.period.time
          })
        }
        s.balance.currency = n(s.net_currency).add(n(s.period.close).multiply(s.balance.asset)).format('0.00000000')

        s.balance.asset = 0
        s.lookback.unshift(s.period)
        var profit = s.start_capital ? n(s.balance.currency).subtract(s.start_capital).divide(s.start_capital) : n(0)
        output_lines.push('end balance: ' + n(s.balance.currency).format('0.00000000').yellow + ' (' + profit.format('0.00%') + ')')
        //console.log('start_capital', s.start_capital)
        //console.log('start_price', n(s.start_price).format('0.00000000'))
        //console.log('close', n(s.period.close).format('0.00000000'))
        var buy_hold = s.start_price ? n(s.period.close).multiply(n(s.start_capital).divide(s.start_price)) : n(s.balance.currency)
        //console.log('buy hold', buy_hold.format('0.00000000'))
        var buy_hold_profit = s.start_capital ? n(buy_hold).subtract(s.start_capital).divide(s.start_capital) : n(0)
        output_lines.push('buy hold: ' + buy_hold.format('0.00000000').yellow + ' (' + n(buy_hold_profit).format('0.00%') + ')')
        output_lines.push('vs. buy hold: ' + n(s.balance.currency).subtract(buy_hold).divide(buy_hold).format('0.00%').yellow)
        output_lines.push(s.my_trades.length + ' trades over ' + s.day_count + ' days (avg ' + n(s.my_trades.length / s.day_count).format('0.00') + ' trades/day)')
        var last_buy
        var losses = 0, sells = 0
        s.my_trades.forEach(function (trade) {
          if (trade.type === 'buy') {
            last_buy = trade.price
          }
          else {
            if (last_buy && trade.price < last_buy) {
              losses++
            }
            sells++
          }
        })
        if (s.my_trades.length) {
          output_lines.push('win/loss: ' + (sells - losses) + '/' + losses)
          output_lines.push('error rate: ' + (sells ? n(losses).divide(sells).format('0.00%') : '0.00%').yellow)
        }
        options_output.simresults.start_capital = s.start_capital
        options_output.simresults.last_buy_price = s.last_buy_price
        options_output.simresults.last_assest_value = s.period.close
        options_output.net_currency = s.net_currency
        options_output.simresults.asset_capital = s.asset_capital
        options_output.simresults.currency = n(s.balance.currency).value()
        options_output.simresults.profit = profit.value()
        options_output.simresults.buy_hold = buy_hold.value()
        options_output.simresults.buy_hold_profit = buy_hold_profit.value()
        options_output.simresults.total_trades = s.my_trades.length
        options_output.simresults.length_days = s.day_count
        options_output.simresults.total_sells = sells
        options_output.simresults.total_losses = losses
        options_output.simresults.vs_buy_hold = n(s.balance.currency).subtract(buy_hold).divide(buy_hold).value() * 100.00

        let options_json = JSON.stringify(options_output, null, 2)
        if (so.show_options) {
          output_lines.push(options_json)
        }

        output_lines.forEach(function (line) {
          console.log(line)
        })

        if (so.backtester_generation >= 0)
        {
          var file_name = so.strategy.replace('_','')+'_'+ so.selector.normalized.replace('_','').toLowerCase()+'_'+so.backtester_generation
          fs.writeFileSync(path.resolve(__dirname, '..', 'simulations','sim_'+file_name+'.json'),options_json, {encoding: 'utf8'})
          var trades_json = JSON.stringify(s.my_trades, null, 2)
          fs.writeFileSync(path.resolve(__dirname, '..', 'simulations','sim_trades_'+file_name+'.json'),trades_json, {encoding: 'utf8'})
          jsonexport(s.my_trades,function(err, csv){
            if(err) return console.log(err)
            fs.writeFileSync(path.resolve(__dirname, '..', 'simulations','sim_trades_'+file_name+'.csv'),csv, {encoding: 'utf8'})
          })
        }

        if (so.filename !== 'none') {
          var html_output = output_lines.map(function (line) {
            return colors.stripColors(line)
          }).join('\n')
          var data = s.lookback.slice(0, s.lookback.length - so.min_periods).map(function (period) {
            var data = {}
            var keys = Object.keys(period)
            for(var i = 0;i < keys.length;i++){
              data[keys[i]] = period[keys[i]]
            }
            return data
          })
          var code = 'var data = ' + JSON.stringify(data) + ';\n'
          code += 'var trades = ' + JSON.stringify(s.my_trades) + ';\n'
          var tpl = fs.readFileSync(path.resolve(__dirname, '..', 'templates', 'sim_result.html.tpl'), {encoding: 'utf8'})
          var out = tpl
            .replace('{{code}}', code)
            .replace('{{trend_ema_period}}', so.trend_ema || 36)
            .replace('{{output}}', html_output)
            .replace(/\{\{symbol\}\}/g,  so.selector.normalized + ' - zenbot ' + require('../package.json').version)
          var out_target = so.filename || 'simulations/sim_result_' + so.selector.normalized +'_' + new Date().toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/-/g, '').replace(/:/g, '').replace(/20/, '') + '_UTC.html'
          fs.writeFileSync(out_target, out)
          console.log('wrote', out_target)
        }

        simResults.insertOne(options_output)
          .then(() => {
            process.exit(0)
          })
          .catch((err) => {
            console.error(err)
            process.exit(0)
          })
      }

      var getNext = async () => {
        var opts = {
          query: {
            selector: so.selector.normalized
          },
          sort: { time: 1 },
          limit: 1000,
          timeout: false
        }
        if (so.end) {
          opts.query.time = { $lte: so.end }
        }
        if (cursor) {
          if (reversing) {
            opts.query.time = {}
            opts.query.time['$lt'] = cursor
            if (query_start) {
              opts.query.time['$gte'] = query_start
            }
            opts.sort = { time: -1 }
          } else {
            if (!opts.query.time) opts.query.time = {}
            opts.query.time['$gt'] = cursor
          }
        } else if (query_start) {
          if (!opts.query.time) opts.query.time = {}
          opts.query.time['$gte'] = query_start
        }
        var collectionCursor = tradesCollection
          .find(opts.query)
          .sort(opts.sort)
          .limit(opts.limit)

        var totalTrades = await collectionCursor.count(true)
        const collectionCursorStream = collectionCursor.stream()

        var numTrades = 0
        var lastTrade

        var onCollectionCursorEnd = () => {
          if (numTrades === 0) {
            if (so.symmetrical && !reversing) {
              reversing = true
              reverse_point = cursor
              return getNext()
            }
            engine.exit(exitSim)
            return
          } else {
            if (reversing) {
              cursor = lastTrade.orig_time
            } else {
              cursor = lastTrade.time
            }
          }
          collectionCursorStream.close()
          return getNext()
        }

        if(totalTrades === 0) {
          onCollectionCursorEnd()
        }

        collectionCursorStream.on('data', function(trade) {
          lastTrade = trade
          numTrades++
          if (so.symmetrical && reversing) {
            trade.orig_time = trade.time
            trade.time = reverse_point + (reverse_point - trade.time)
          }
          eventBus.emit('trade', trade)

          if (numTrades && totalTrades && totalTrades == numTrades) {
            onCollectionCursorEnd()
          }
        })
      }

      return getNext()
    })
}
