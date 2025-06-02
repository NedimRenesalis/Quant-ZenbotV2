#!/usr/bin/env node

// Load modules
var program = require('commander')
var path = require('path')
var fs = require('fs')
var mongodb = require('mongodb')

// Load configuration
var conf = {}
var conf_file = path.resolve(__dirname, 'conf.js')
if (fs.existsSync(conf_file)) {
  var conf_from_file = require(conf_file)
  Object.assign(conf, conf_from_file)
}

// Initialize MongoDB connection
console.log('Connecting to MongoDB...')
var connectionString = 'mongodb://127.0.0.1:27017/zenbot4'
mongodb.MongoClient.connect(connectionString, { useNewUrlParser: true, useUnifiedTopology: true }, function(err, client) {
  if (err) {
    console.error('MongoDB connection error:', err)
    process.exit(1)
  }
  
  console.log('Successfully connected to MongoDB')
  var db = client.db('zenbot4')
  conf.db = { mongo: db }
  
  // Register our debug simulation command
  require('./commands/sim-debug')(program, conf)
  
  // Parse command line arguments
  program.parse(process.argv)
})
