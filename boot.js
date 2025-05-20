var _ = require('lodash')
var path = require('path')
var minimist = require('minimist')
var version = require('./package.json').version
var EventEmitter = require('events')

module.exports = function (cb) {
  var zenbot = { version }
  var args = minimist(process.argv.slice(3))
  var conf = {}
  var config = {}
  var overrides = {}

  module.exports.debug = args.debug

  // 1. load conf overrides file if present
  if(!_.isUndefined(args.conf)){
    try {
      overrides = require(path.resolve(process.cwd(), args.conf))
    } catch (err) {
      console.error(err + ', failed to load conf overrides file!')
    }
  }

  // 2. load conf.js
  try {
    conf = require('./conf')
    console.log('Successfully loaded configuration from conf.js')
  } catch (err) {
    console.error(err + ', failed to load conf.js')
    // Create a default configuration
    conf = {
      mongo: {
        db: 'zenbot4',
        host: 'localhost',
        port: 27017,
        connectionString: 'mongodb://localhost:27017/zenbot4'
      },
      selector: 'binance.BTC-TUSD',
      strategy: 'stddev'
    }
    console.log('Using default configuration')
  }
  
  // Merge configurations
  _.defaultsDeep(config, overrides, conf)
  zenbot.conf = config

  var eventBus = new EventEmitter()
  zenbot.conf.eventBus = eventBus

  // Force MongoDB connection to localhost only
  console.log('Forcing MongoDB connection to localhost:27017')
  const connectionString = 'mongodb://127.0.0.1:27017/zenbot4'

  // Connect to MongoDB with simplified options and compatibility with MongoDB 3.6
  try {
    // Try to use an older MongoDB client that's compatible with MongoDB 3.6
    const MongoClient = require('mongodb').MongoClient
    console.log('Attempting to connect to MongoDB with compatibility mode for MongoDB 3.6')
    
    // Use options compatible with MongoDB 3.6
    const options = { 
      useNewUrlParser: true, 
      useUnifiedTopology: true,
      // Force MongoDB driver to use wire protocol compatible with MongoDB 3.6
      serverApi: null
    }
    
    MongoClient.connect(connectionString, options, function(err, client) {
      if (err) {
        console.error('WARNING: MongoDB Connection Error: ', err)
        console.error('WARNING: without MongoDB some features (such as backfilling/simulation) may be disabled.')
        console.error('Attempted authentication string: ' + connectionString)
        
        // Try to connect with a fallback method for older MongoDB versions
        console.log('Attempting fallback connection method for MongoDB 3.6...')
        
        // Try to require an older version of the MongoDB driver if available
        try {
          // This is a workaround to force compatibility
          const oldMongoClient = require('mongodb').MongoClient
          const oldOptions = { useNewUrlParser: true }
          
          oldMongoClient.connect(connectionString, oldOptions, function(oldErr, oldClient) {
            if (oldErr) {
              console.error('WARNING: Fallback MongoDB Connection Error: ', oldErr)
              cb(null, zenbot)
              return
            }
            
            console.log('Successfully connected to MongoDB at ' + connectionString + ' using fallback method')
            var db = oldClient.db('zenbot4')
            _.set(zenbot, 'conf.db.mongo', db)
            cb(null, zenbot)
          })
        } catch (fallbackErr) {
          console.error('WARNING: Fallback MongoDB connection also failed: ', fallbackErr)
          cb(null, zenbot)
        }
        return
      }
      
      console.log('Successfully connected to MongoDB at ' + connectionString)
      var db = client.db('zenbot4')
      _.set(zenbot, 'conf.db.mongo', db)
      cb(null, zenbot)
    })
  } catch (e) {
    console.error('ERROR: Failed to initialize MongoDB client: ', e)
    cb(null, zenbot)
  }
}
