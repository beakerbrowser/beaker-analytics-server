const os = require('os')
const path = require('path')
const fs = require('fs')
const EventEmitter = require('events')
const yaml = require('js-yaml')
const untildify = require('untildify')

const DEFAULT_CONFIG_DIRECTORY = path.join(os.homedir(), '.bas')
const IS_DEBUG = (['debug', 'staging', 'test'].indexOf(process.env.NODE_ENV) !== -1)

// exported api
// =

class BASConfig {
  constructor (configPath = false) {
    this.events = new EventEmitter()

    // where the config is loaded from
    this.configPath = null

    // `canonical` the config read from the file
    this.canonical = {}

    if (configPath) {
      this.readFromFile(configPath)
    }
  }

  readFromFile (configPath = false) {
    configPath = configPath || this.configPath
    this.configPath = configPath
    var configContents

    // read file
    try {
      configContents = fs.readFileSync(configPath, 'utf8')
    } catch (e) {
      // throw if other than a not-found
      configContents = ''
      if (e.code !== 'ENOENT') {
        console.error('Failed to load config file at', configPath)
        throw e
      }
    }

    // parse
    try {
      this.canonical = yaml.safeLoad(configContents)
    } catch (e) {
      console.error('Failed to parse config file at', configPath)
      throw e
    }
    this.canonical = this.canonical || {}

    // validate
    validate(this.canonical)

    this.events.emit('read-config')
  }

  checkAdminCreds (username, password) {
    var admin = this.admins.filter(admin => admin.username === username && admin.password === password)
    return admin.length > 0
  }

  get isDebug () {
    return IS_DEBUG
  }

  get directory () {
    return untildify(this.canonical.directory || DEFAULT_CONFIG_DIRECTORY)
  }

  get dbPath () {
    return path.join(this.directory, 'analytics.db')
  }

  get domain () {
    if (!IS_DEBUG && !this.canonical.domain) {
      // only fallback to hostname if not debugging, otherwise tests will always fail
      return os.hostname()
    }
    return this.canonical.domain
  }

  get ports () {
    var ports = this.canonical.ports || {}
    ports.http = ports.http || 80
    ports.https = ports.https || 443
    return ports
  }

  get letsencrypt () {
    return this.canonical.letsencrypt || false
  }

  get hostnames () {
    return [this.domain]
  }

  get admins () {
    return this.canonical.admins || []
  }
}

module.exports = {
  BASConfig
}

// internal methods
// =

function validate (config) {
  if ('directory' in config) check(typeof config.directory === 'string', 'directory must be a string')
  if ('domain' in config) check(typeof config.domain === 'string', 'domain must be a string')
  if ('ports' in config) check(config.ports && typeof config.ports === 'object', 'ports must be an object containing .http and/or .https')
  if ('ports' in config && 'http' in config.ports) check(typeof config.ports.http === 'number', 'ports.http must be a number')
  if ('ports' in config && 'https' in config.ports) check(typeof config.ports.https === 'number', 'ports.https must be a number')
  if ('letsencrypt' in config) check(typeof config.letsencrypt === 'object' || config.letsencrypt === false, 'letsencrypt must be an object or false')
  if (config.letsencrypt) check(typeof config.letsencrypt.email === 'string', 'letsencrypt.email must be specified')
  if ('admins' in config) {
    config.admins = Array.isArray(config.admins) ? config.admins : [config.admins]
    config.admins.forEach(admin => {
      check(typeof admin === 'object', 'admins must be objects containing username and password')
      check(typeof admin.username === 'string', 'admins username must be a string')
      check(typeof admin.password === 'string', 'admins password must be a string')
    })
  }
}

function check (assertion, error, value, errorKey) {
  if (!assertion) {
    var err = new Error(error)
    err.value = value
    if (errorKey) {
      err[errorKey] = true
    }
    throw err
  }
}

