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

  // 2. load conf.js if present
  try {
    conf = require('./conf')
  } catch (err) {
    console.error(err + ', falling back to conf-sample')
  }

  // 3. Load conf-sample.js and merge
  var defaults = require('./conf-sample')
  _.defaultsDeep(config, overrides, conf, defaults)
  zenbot.conf = config

  var eventBus = new EventEmitter()
  zenbot.conf.eventBus = eventBus

  // Use localhost for MongoDB since we've exposed the port in docker-compose
  let connectionString = 'mongodb://localhost:27017/zenbot4'
  console.log('Using MongoDB connection string:', connectionString)

  // Connect to MongoDB with minimal options
  const MongoClient = require('mongodb').MongoClient
  console.log('Attempting to connect to MongoDB at:', connectionString)
  
  MongoClient.connect(connectionString, function(err, client) {
    if (err) {
      console.error('WARNING: MongoDB Connection Error: ', err)
      console.error('WARNING: without MongoDB some features (such as backfilling/simulation) may be disabled.')
      console.error('Attempted authentication string: ' + connectionString)
      cb(null, zenbot)
      return
    }
    console.log('Successfully connected to MongoDB at ' + connectionString)
    var db = client.db('zenbot4')
    _.set(zenbot, 'conf.db.mongo', db)
    cb(null, zenbot)
  })
}
