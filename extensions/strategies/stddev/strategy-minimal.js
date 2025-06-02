/**
 * Minimal Standard Deviation Strategy
 * 
 * This is a simplified version of the stddev strategy with all complex features removed
 * to improve performance and reduce the chance of freezing during simulations.
 */

var z = require('zero-fill')
  , stats = require('stats-lite')
  , math = require('mathjs')

module.exports = {
  name: 'stddev-minimal',
  description: 'Minimal standard deviation strategy for testing and debugging.',
  
  getOptions: function () {
    this.option('period_length', 'period length', String, '100ms')
    this.option('trendtrades_1', 'Trades for array 1', Number, 5)
    this.option('trendtrades_2', 'Trades for array 2', Number, 10)
    this.option('min_periods', 'Minimum periods before trading', Number, 10)
  },
  
  calculate: function (s) {
    // Nothing to do here
  },
  
  onPeriod: function (s, cb) {
    try {
      var tl0 = []
      var tl1 = []
      
      // Ensure we have enough data before proceeding
      if (!s.lookback[s.options.min_periods]) {
        return cb()
      }
      
      // Collect price data with error handling
      try {
        for (let i = 0; i < s.options.trendtrades_1; i++) { 
          if (s.lookback[i] && s.lookback[i].close) {
            tl0.push(s.lookback[i].close) 
          }
        }
        for (let i = 0; i < s.options.trendtrades_2; i++) { 
          if (s.lookback[i] && s.lookback[i].close) {
            tl1.push(s.lookback[i].close) 
          }
        }
        
        // Verify we have enough data points
        if (tl0.length < 3 || tl1.length < 3) {
          return cb()
        }
      } catch (e) {
        console.error('Error collecting price data:', e.message)
        return cb()
      }
      
      // Calculate standard deviation
      s.std0 = stats.stdev(tl0)
      s.std1 = stats.stdev(tl1)
      
      // Calculate means
      s.mean0 = math.mean(tl0)
      s.mean1 = math.mean(tl1)
      
      // Basic signals
      s.sig0 = s.std0 > s.std1 ? 'Up' : 'Down'
      s.sig1 = s.mean0 > s.mean1 ? 'Up' : 'Down'
      
      // Simple buy/sell logic
      if (s.sig1 === 'Down') {
        s.signal = 'sell'
      }
      else if (s.sig0 === 'Up' && s.sig1 === 'Up') {
        s.signal = 'buy'
      }
    } catch (err) {
      console.error('Strategy execution error:', err)
      return cb()
    }
    
    cb()
  }
}