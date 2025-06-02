
var semver = require('semver')
var path = require('path')
var program = require('commander')
program._name = 'zenbot'

var versions = process.versions

if (semver.gt('8.3.0', versions.node)) {
  console.log('You are running a node.js version older than 8.3.x, please upgrade via https://nodejs.org/en/')
  process.exit(1)
}

var fs = require('fs')
  , boot = require('./boot')

boot(function (err, zenbot) {
  if (err) {
    throw err
  }
  
  // Check if program.version is a function before calling it
  if (typeof program.version === 'function') {
    program.version(zenbot.version)
  } else {
    // For newer versions of commander
    program.version = zenbot.version
  }
  
  var command_directory = './commands'
  fs.readdir(command_directory, function(err, files){
    if (err) {
      throw err
    }
    
    var commands = files.map((file)=>{
      return path.join(command_directory, file)
    }).filter((file)=>{
      // Only include .js files and exclude .bak files
      return fs.statSync(file).isFile() && file.endsWith('.js') && !file.endsWith('.bak.js') && !file.includes('.bak')
    })

    commands.forEach((file)=>{
      require(path.resolve(__dirname, file.replace('.js','')))(program, zenbot.conf)
    })

    program
      .command('*', 'Display help', { noHelp: true })
      .action((cmd)=>{
        console.log('Invalid command: ' + cmd)
        program.help()
      })

    program.parse(process.argv)
  })
})
