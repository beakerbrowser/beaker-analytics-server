#!/usr/bin/env node
const os = require('os')
const path = require('path')
const CronJob = require('cron').CronJob
const {BASConfig} = require('./lib/config')
const startServer = require('./lib/server').start

const configPath = process.env.BAS_CONFIG || path.join(os.homedir(), '.bas.yml')

// read config and start the server
var config = new BASConfig(configPath)
var server = startServer(config, () => {
  server.computeReport().catch(console.error)

  console.log('Will compute the report every saturday at 11:30pm')
  new CronJob('0 30 11 * * 6', function() {
    server.computeReport().catch(console.error)
  }, null, true);
})
