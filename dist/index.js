var exec = require('child_process').execFileSync
var log = require('fancy-log')
var prepareExecEnvironment = require('./sonar-scanner-executable').prepareExecEnvironment
var scannerExecutable = require('./sonar-scanner-executable').getSonarScannerExecutable
var localscannerExecutable = require('./sonar-scanner-executable').getLocalSonarScannerExecutable

module.exports = scan
module.exports.cli = scanCLI
module.exports.customScanner = scanUsingCustomScanner
module.exports.fromParam = fromParam

const version = require('../package.json').version

/*
 * Function used programmatically to trigger an analysis.
 */
function scan(params, callback) {
  scanCLI([], params, callback)
}

/*
 * Function used by the '/bin/sonar-scanner' executable that accepts command line arguments.
 */
function scanCLI(cliArgs, params, callback) {
  log('Starting analysis...')

  // prepare the exec options, most notably with the SQ params
  var optionsExec = prepareExecEnvironment(params, process)

  // determine the command to run and execute it
  scannerExecutable((sqScannerCommand) => {
    try {
      exec(sqScannerCommand, fromParam().concat(cliArgs), optionsExec)
      log('Analysis finished.')
      callback()
    } catch (error) {
      process.exit(error.status)
    }
  })
}

/*
 * Alternatively, trigger an analysis with a local install of the SonarScanner.
 */
function scanUsingCustomScanner(params, callback) {
  log('Starting analysis (with local install of the SonarScanner)...')

  // prepare the exec options, most notably with the SQ params
  var optionsExec = prepareExecEnvironment(params, process)

  // determine the command to run and execute it
  localscannerExecutable((sqScannerCommand) => {
    try {
      exec(sqScannerCommand, fromParam(), optionsExec)
      log('Analysis finished.')
      callback()
    } catch (error) {
      process.exit(error.status)
    }
  })
}

function fromParam() {
  const forcedScannerCLIVersion = process.env.SONAR_SCANNER_VERSION || process.env.npm_config_sonar_scanner_version
  if (forcedScannerCLIVersion && forcedScannerCLIVersion < '4.4') {
    // When the scanner version is forced through SONAR_SCANNER_VERSION, and version is less than 4.4, don't use the scanner identity parameter
    return []
  } else {
    return [`--from=ScannerNpm/${version}`]
  }
}
