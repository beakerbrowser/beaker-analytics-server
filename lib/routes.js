const asyncHandler = require('express-async-handler')
const RateLimit = require('express-rate-limit')
const basicAuth = require('basic-auth-connect')
const moment = require('moment')
const queries = require('./queries')

const IS_DEBUG = (['debug', 'staging', 'test'].indexOf(process.env.NODE_ENV) !== -1)
const ID_REGEX = /^[0-9a-f]+$/

module.exports = function (app, db, config) {
  // routes
  // =
  
  if (!IS_DEBUG) {
    app.use(new RateLimit({windowMs: 10e3, max: 100, delayMs: 0})) // general rate limit
    app.use('/ping', new RateLimit({windowMs: 24 * 60 * 60 * 1000, max: 1, delayMs: 0})) // 1 ping per day
  }

  app.get('/', basicAuth(config.checkAdminCreds.bind(config)), asyncHandler(listReports))
  app.get('/report/:id', basicAuth(config.checkAdminCreds.bind(config)), asyncHandler(getReport))
  app.post('/ping', asyncHandler(addPing))

  // route handlers
  // =

  async function listReports (req, res) {
    // run query
    var reports = await queries.listReports(db)

    // respond
    res.status(200).format({
      'text/html': () => {
        reports.forEach(r => {
          res.write(`<p><a href="/report/${r.id}">${moment(r.computeDate)}</a></p>`)
        })
        res.end()
      },
      'default': () => {
        res.json(reports)
      }
    })
  }

  async function getReport (req, res) {
    // run query
    var report = await queries.getReport(db, req.params.id)

    // respond
    res.status(200).format({
      'text/html': () => {
        report.computeDate = moment(report.computeDate)
        res.send('<pre>' + JSON.stringify(report, null, 2) + '</pre>')
      },
      'default': () => {
        res.json(report)
      }
    })
  }

  async function addPing (req, res) {
    var userId = req.query.userId
    if (typeof userId === 'string' && ID_REGEX.test(userId)) {
      await queries.addPing(db, {
        ...req.query
      })
    }
    res.status(204).end()
  }
}
