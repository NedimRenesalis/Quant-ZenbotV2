module.exports = function api () {
  let express = require('express')
  let app = express()
  let random_port = require('random-port')
  let path = require('path')
  let moment = require('moment')
  let rateLimit = null

  let run = function(reporter, tradeObject) {
    if (!reporter.port || reporter.port === 0) {
      random_port({from: 20000}, function(port) {
        startServer(port, reporter.ip, tradeObject)
      })
    } else {
      startServer(reporter.port, reporter.ip, tradeObject)
    }
  }

  let objectWithoutKey = (object, key) => {
    // eslint-disable-next-line no-unused-vars
    const {[key]: deletedKey, ...otherKeys} = object
    return otherKeys
  }

  // set up rate limiter: maximum of fifty requests per minute
  // Check if RateLimit is a constructor or a function
  try {
    const RateLimitModule = require('express-rate-limit');
    // For newer versions of express-rate-limit
    rateLimit = typeof RateLimitModule === 'function' ? 
      RateLimitModule({
        windowMs: 1 * 60 * 1000, // 1 minute
        max: 60, // limit each IP to 60 requests per windowMs
        standardHeaders: true,
        legacyHeaders: false,
        message: 'Too many requests, please try again later.'
      }) : 
      // For older versions where it might be a constructor
      new RateLimitModule({
        windowMs: 1 * 60 * 1000, // 1 minute
        max: 60, // limit each IP to 60 requests per windowMs
        delayMs: 0, // disable delaying - full speed until the max limit is reached
        message: 'Too many requests, please try again later.'
      });
  } catch (e) {
    console.error('Error setting up rate limit:', e.message);
    console.log('Continuing without rate limiting...');
  }

  let startServer = function(port, ip, tradeObject) {
    tradeObject.port = port

    app.set('views', path.join(__dirname+'/../../templates'))
    app.set('view engine', 'ejs')

    // Only use rate limiter if it was successfully created
    if (rateLimit) {
      app.use(rateLimit);
    }
    
    app.use('/assets', express.static(__dirname+'/../../templates/dashboard_assets'))
    app.use('/assets-wp', express.static(__dirname+'/../../dist/'))
    app.use('/assets-zenbot', express.static(__dirname+'/../../assets'))

    app.get('/', function (req, res) {
      app.locals.moment = moment
      app.locals.deposit = tradeObject.options.deposit
      let datas = JSON.parse(JSON.stringify(objectWithoutKey(tradeObject, 'options'))) // deep copy to prevent alteration
      res.render('dashboard', datas)
    })

    app.get('/trades', function (req, res) {
      res.send(objectWithoutKey(tradeObject, 'options'))
    })

    app.get('/stats', function (req, res) {
      res.sendFile(path.join(__dirname+'../../../stats/index.html'))
    })

    if (ip && ip !== '0.0.0.0') {
      app.listen(port, ip)
      tradeObject.url = ip + ':' + port + '/'
    } else {
      app.listen(port)
      tradeObject.url = require('ip').address() + ':' + port + '/'
    }
    console.log('Web GUI running on http://' + tradeObject.url)
  }

  return {
    run: run
  }
}
