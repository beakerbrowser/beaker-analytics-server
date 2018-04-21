const path = require('path')
const fs = require('fs')
const moment = require('moment')

exports.readFixture = function (name) {
  var data = []
  var rawFixture = fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8')
  rawFixture.split('\n').forEach(line => {
    if (line.startsWith('//')) return
    var cols = line.split(' ')
    if (cols.length !== 5) return
    data.push({
      date: +(moment().subtract(+cols[0], 'days')),
      userId: cols[1],
      ip: cols[2],
      beakerVersion: cols[3],
      os: cols[4]
    })
  })
  return data
}