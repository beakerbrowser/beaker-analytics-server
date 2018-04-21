const mtb36 = require('monotonic-timestamp-base36')
const moment = require('moment')

const IS_DEBUG = (['debug', 'staging', 'test'].indexOf(process.env.NODE_ENV) !== -1)

function toCohortId (date) {
  return date.format('YYYY') + 'week' + date.format('WW')
}

exports.listReports = async (db) => {
  return db.all(`SELECT id, computeDate FROM reports`)
}

exports.getReport = async (db, id) => {
  var report = await db.get(`
    SELECT reports.*
      FROM reports
      WHERE id=?`,
    [id])

  report.stats = (await db.all(`
    SELECT data
      FROM report_data
      WHERE report_data.reportId = ?`,
    [id])).map(row => JSON.parse(row.data))

  report.cohorts = await db.all(`
    SELECT startWeek, totalCount, stillActiveCount
      FROM report_active_user_cohorts
      WHERE report_active_user_cohorts.reportId = ?`,
    [id])

  return report
}

exports.computeReport = async (db, date = undefined) => {
  var thisWeek = moment(date).startOf('week')
  var reportId = toCohortId(thisWeek)
  console.log('Computing report', reportId)

  // delete if the report already exists
  await db.run(`DELETE FROM reports WHERE id=?`, [reportId])
  await db.run(`DELETE FROM report_data WHERE reportId=?`, [reportId])
  await db.run(`DELETE FROM report_active_user_cohorts WHERE reportId=?`, [reportId])

  // get the very first ping to figure out our first cohort
  var firstPing = await db.get(`SELECT date FROM pings ORDER BY date LIMIT 1`)

  // get this week's pings
  var thisWeeksPings = await db.all(`
    SELECT * FROM pings WHERE date >= ? GROUP BY userId
  `, [+thisWeek])
  var thisWeeksUserIds = thisWeeksPings.map(ping => ping.userId)

  // iterate the cohorts
  var cohorts = {}
  var thisWeek = moment().startOf('week')
  var cohortStart = moment(firstPing ? firstPing.date : undefined).startOf('week')
  while (cohortStart < thisWeek) {
    let cohortEnd = cohortStart.clone().add(1, 'week')

    // get all user IDs to pings in that cohort
    let cohortPings = await db.all(`
      SELECT DISTINCT(userId) FROM pings WHERE date >= ? AND date < ? AND isFirstPing=1
    `, [+cohortStart, +cohortEnd])

    // calculate how many are still active
    var stillActiveCount = 0
    cohortPings.forEach(ping => {
      if (thisWeeksUserIds.indexOf(ping.userId) !== -1) {
        stillActiveCount++
      }
    })

    // store
    cohorts[toCohortId(cohortStart)] = {
      totalCount: cohortPings.length,
      stillActiveCount
    }
    cohortStart = cohortEnd
  }

  // get all user IDs to pings in that cohort
  let totalUserCount = (await db.get(`SELECT COUNT(DISTINCT(userId)) AS count FROM pings`)).count

  // calculate stats
  var counts = {}
  thisWeeksPings.forEach(ping => {
    var bucket = JSON.stringify({beaker: ping.beakerVersion, os: ping.os})
    counts[bucket] = (counts[bucket] || 0) + 1
  })

  // store data
  await db.run(`INSERT INTO reports (id, activeUserCount, totalUserCount) VALUES (?, ?, ?)`, [reportId, thisWeeksPings.length, totalUserCount])
  for (let bucket in counts) {
    let bucketData = JSON.parse(bucket)
    bucketData.count = counts[bucket]
    bucketData = JSON.stringify(bucketData)
    await db.run(`INSERT INTO report_data (reportId, data) VALUES (?, ?)`, [reportId, bucketData])
  }
  for (let startWeek in cohorts) {
    let cohort = cohorts[startWeek]
    await db.run(`
      INSERT INTO report_active_user_cohorts (reportId, startWeek, totalCount, stillActiveCount)
      VALUES (?, ?, ?, ?)`,
      [reportId, startWeek, cohort.totalCount, cohort.stillActiveCount]
    )    
  }
}

exports.addPing = async (db, data) => {
  // delete any other pings received today
  var today = moment().startOf('day')
  await db.run(`DELETE FROM pings WHERE userId = ? AND date >= ?`, [data.userId, today])

  // look for an existing ping
  var oldPing = await db.get(`SELECT userId FROM pings WHERE userId = ?`, [data.userId])

  // construct row
  var row = {
    id: mtb36(),
    userId: data.userId,
    isFirstPing: oldPing ? 0 : 1,
    beakerVersion: data.beakerVersion,
    os: data.os,
    ip: data.ip
  }

  if (IS_DEBUG && data.date) {
    // date override (for testing)
    row.date = data.date
  }

  // insert
  var keysArray = Object.keys(row)
  var keys = keysArray.join(', ')
  var qs = keysArray.map(v => '?').join(', ')
  var values = Object.values(row)
  await db.run(`INSERT INTO pings (${keys}) VALUES (${qs})`, values)
}

exports.countPingsBy = async (db, userId) => {
  return (await db.get(`SELECT COUNT(id) as COUNT FROM pings WHERE userId = ?`, [userId])).count
}