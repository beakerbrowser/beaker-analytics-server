const path = require('path')
const http = require('http')
const fs = require('fs')
const express = require('express')
const greenlockExpress = require('greenlock-express')
const mkdirp = require('mkdirp')
const setupDB = require('./setup-db')
const approveDomains = require('./lets-encrypt').approveDomains
const packageJson = require('../package.json')
const setRoutes = require('./routes')
const queries = require('./queries')

// constants
// =

const IS_DEBUG = (['debug', 'staging', 'test'].indexOf(process.env.NODE_ENV) !== -1)

// globals
// =

var app
var db

// exported api
// =

exports.start = function (config, cb) {
  var server

  // ensure the data dirs exist
  mkdirp.sync(config.directory)
  var db = setupDB(config.dbPath)

  // log
  console.log('Starting Beaker Analytics Server', packageJson.version)
  console.log('Hostname:', config.domain)
  console.log('Directory:', config.directory)
  console.log('HTTP Port:', config.ports.http)
  console.log('HTTPS Port:', config.ports.https)

  // create server app
  app = express()
  setRoutes(app, db, config)
  app.use((err, req, res, next) => {
    console.log(err)
    res.status(500).end()
  })

  // start server
  if (config.letsencrypt) {
    server = greenlockExpress.create({
      version: 'v02',
      server: IS_DEBUG ? 'https://acme-staging-v02.api.letsencrypt.org/directory' : 'https://acme-v02.api.letsencrypt.org/directory',
      debug: IS_DEBUG,
      approveDomains: approveDomains(config),
      store: require('le-store-certbot').create({
        configDir: path.join(config.directory, 'letsencrypt', 'etc'),
        workDir: path.join(config.directory, 'letsencrypt', 'var', 'lib'),
        logsDir: path.join(config.directory, 'letsencrypt', 'var', 'log')
      }),
      app: app
    }).listen(config.ports.http, config.ports.https)
  } else {
    server = http.createServer(app)
    server.listen(config.ports.http)
  }

  if (cb) {
    server.once('listening', cb)
  }

  // watch the config file for changes
  if (config.configPath) {
    var prevTime = 0
    var watcher = fs.watch(config.configPath, function () {
      fs.lstat(config.configPath, function (_, st) {
        var now = Date.now()
        if (now - prevTime > 100) {
          console.log(`\nDetected change to ${config.configPath}, reloading...\n`)
          config.readFromFile()
        }
        prevTime = now
      })
    })
  }

  return {
    config,
    computeReport: (date = undefined) => queries.computeReport(db, date),
    countPingsBy: userId => queries.countPingsBy(db, userId),
    close: cb => {
      watcher.close()
      server.close(cb)
    }
  }
}
