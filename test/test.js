const test = require('ava')
const tempy = require('tempy')
const request = require('request-promise-native')
const moment = require('moment')
const {BASConfig} = require('../lib/config')
const startServer = require('../lib/server').start
const {readFixture} = require('./util')

var server
var firstReportId

test.cb('setup server', t => {
  var config = new BASConfig()
  config.canonical = {
    directory: tempy.directory(),
    ports: {
      http: 10000
    },
    admins: [{username: 'admin', password: 'admin'}]
  }

  server = startServer(config, () => {
    t.pass()
    t.end()
  })
  server.req = request.defaults({
    baseUrl: `http://127.0.0.1:${config.ports.http}`,
    resolveWithFullResponse: true,
    simple: false
  })
})

test('insert ping fixtures', async t => {
  var fixtureData = readFixture('pings.txt')
  for (var i in fixtureData) {
    let ping = fixtureData[i]
    let res = await server.req.post({
      uri: '/ping',
      qs: ping
    })
    t.deepEqual(res.statusCode, 204)
  }
})

test('compute a report', async t => {
  await server.computeReport()
  t.pass()
})

test('list reports', async t => {
  var res = await server.req.get({
    uri: '/',
    json: true,
    auth: {username: 'admin', password: 'admin'}
  })
  console.log('Reports:', res.body)
  t.deepEqual(res.body.length, 1)
  firstReportId = res.body[0].id
})

test('get report', async t => {
  var res = await server.req.get({
    uri: '/report/' + firstReportId,
    auth: {username: 'admin', password: 'admin'},
    json: true
  })
  
  // convert some values into their types, because they'll depend on the time of the test
  res.body.computeDate = typeof res.body.computeDate
  for (var i = 0; i < res.body.cohorts.length; i++) {
    res.body.cohorts[i].startWeek = typeof res.body.cohorts[i].startWeek
  }

  t.deepEqual(res.body, {
    id: firstReportId,
    computeDate: 'number',
    totalUserCount: 7,
    activeUserCount: 4,
    stats: 
     [ { beaker: '0.8.0', os: 'win10', count: 3 },
       { beaker: '0.7.10', os: 'win10', count: 1 } ],
    cohorts: 
     [ { startWeek: 'string', totalCount: 5, stillActiveCount: 3 },
       { startWeek: 'string', totalCount: 0, stillActiveCount: 0 },
       { startWeek: 'string', totalCount: 0, stillActiveCount: 0 },
       { startWeek: 'string', totalCount: 0, stillActiveCount: 0 },
       { startWeek: 'string', totalCount: 2, stillActiveCount: 1 } ]
  })
})

test('recomputing the report wont change the results', async t => {
  await server.computeReport()

  var res = await server.req.get({
    uri: '/report/' + firstReportId,
    auth: {username: 'admin', password: 'admin'},
    json: true
  })
  
  // convert some values into their types, because they'll depend on the time of the test
  res.body.computeDate = typeof res.body.computeDate
  for (var i = 0; i < res.body.cohorts.length; i++) {
    res.body.cohorts[i].startWeek = typeof res.body.cohorts[i].startWeek
  }

  t.deepEqual(res.body, {
    id: firstReportId,
    computeDate: 'number',
    totalUserCount: 7,
    activeUserCount: 4,
    stats: 
     [ { beaker: '0.8.0', os: 'win10', count: 3 },
       { beaker: '0.7.10', os: 'win10', count: 1 } ],
    cohorts: 
     [ { startWeek: 'string', totalCount: 5, stillActiveCount: 3 },
       { startWeek: 'string', totalCount: 0, stillActiveCount: 0 },
       { startWeek: 'string', totalCount: 0, stillActiveCount: 0 },
       { startWeek: 'string', totalCount: 0, stillActiveCount: 0 },
       { startWeek: 'string', totalCount: 2, stillActiveCount: 1 } ]
  })
})

test('cant create more than one ping per day', async t => {
  var origNumPings = await server.countPingsBy(100)
  await server.req.post({
    uri: '/ping',
    qs: {
      userId: 100,
      ip: '123.123.123.123',
      beakerVersion: '0.8.0',
      os: 'win10'
    }
  })
  t.deepEqual(await server.countPingsBy(100), origNumPings)
  await server.req.post({
    uri: '/ping',
    qs: {
      userId: 100,
      ip: '123.123.123.123',
      beakerVersion: '0.8.0',
      os: 'win10'
    }
  })
  t.deepEqual(await server.countPingsBy(100), origNumPings)
  await server.req.post({
    uri: '/ping',
    qs: {
      userId: 100,
      ip: '123.123.123.123',
      beakerVersion: '0.8.0',
      os: 'win10'
    }
  })
  t.deepEqual(await server.countPingsBy(100), origNumPings)
})
