var fs = require('fs');
var path = require('path');
var os = require('os');
var exec = require('child_process').execSync;
var mkdirs = require('mkdirp').sync;
var extend = require('extend');
var download = require('download');
var ProgressBar = require('progress');
var log = require('fancy-log');
var logError = log.error;
var sonarScannerParams = require('./sonar-scanner-params');

module.exports.prepareExecEnvironment = prepareExecEnvironment;
module.exports.getSonarScannerExecutable = getSonarScannerExecutable;
module.exports.getLocalSonarScannerExecutable = getLocalSonarScannerExecutable;
module.exports.getInstallFolderPath = getInstallFolderPath;
module.exports.findTargetOS = findTargetOS;
module.exports.getPlatformSuffix = getPlatformSuffix;

const SONAR_SCANNER_MIRROR = 'https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/';
const SONAR_SCANNER_VERSION = '4.5.0.2216';
const SUPPORTED_PLATFORMS = ['windows', 'linux', 'macosx', 'universal'];

const bar = new ProgressBar('[:bar] :percent :etas', {
  complete: '=',
  incomplete: ' ',
  width: 20,
  total: 0
});

/*
 * Prepare the executable options (including env environments) required to run the
 * SQ executable.
 */
function prepareExecEnvironment (params, process) {
  // Define what the SQ Scanner params must be
  var processEnvParams = {};
  if (process.env.SONARQUBE_SCANNER_PARAMS) {
    processEnvParams = JSON.parse(process.env.SONARQUBE_SCANNER_PARAMS);
  }
  var sqScannerParams = sonarScannerParams(params, process.cwd(), processEnvParams);

  // We need to merge the existing env variables (process.env) with the SQ ones
  var mergedEnv = {};
  extend(mergedEnv, process.env, {
    SONARQUBE_SCANNER_PARAMS: JSON.stringify(sqScannerParams)
  });

  // this is the actual object that the process.exec function is waiting for
  var optionsExec = {
    env: mergedEnv,
    stdio: [0, 1, 2],
    // Increase the amount of data allowed on stdout or stderr
    // (if this value is exceeded then the child process is killed).
    // TODO: make this customizable
    maxBuffer: 1024 * 1024
  };

  return optionsExec;
}

/*
 * Returns the SQ Scanner executable for the current platform
 */
function getSonarScannerExecutable (passExecutableCallback) {
  const platformBinariesVersion =
    process.env.SONAR_SCANNER_VERSION || process.env.npm_config_sonar_scanner_version || SONAR_SCANNER_VERSION;
  var targetOS = findTargetOS();
  var platformSuffix = getPlatformSuffix(targetOS);
  var installFolder = getInstallFolderPath();
  var binaryExtension = '';
  if (isWindows()) {
    binaryExtension = '.bat';
  }
  var platformExecutable = path.join(
    installFolder,
    `sonar-scanner-${platformBinariesVersion}${platformSuffix}`,
    'bin',
    `sonar-scanner${binaryExtension}`
  );

  if (process.env.SONAR_SCANNER_BIN) {
    platformExecutable = process.env.SONAR_SCANNER_BIN;
  }

  // #1 - Try to execute the scanner
  var executableFound = false;
  try {
    log('Checking if executable exists: ' + platformExecutable);
    fs.accessSync(platformExecutable, fs.F_OK);
    // executable exists!
    log('Platform binaries for SonarScanner found. Using it.');
    executableFound = true;
  } catch (e) {
    log('Could not find executable in "' + installFolder + '".');
  }
  if (executableFound) {
    passExecutableCallback(platformExecutable);
    return;
  }

  // #2 - Download the binaries and unzip them
  //      They are located at https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-${version}-${os}.zip
  log('Proceed with download of the platform binaries for SonarScanner...');
  log('Creating ' + installFolder);
  mkdirs(installFolder);
  var baseUrl = process.env.SONAR_SCANNER_MIRROR || process.env.npm_config_sonar_scanner_mirror || SONAR_SCANNER_MIRROR;
  var fileName = 'sonar-scanner-cli-' + platformBinariesVersion + platformSuffix + '.zip';
  var downloadUrl = baseUrl + fileName;
  log(`Downloading from ${downloadUrl}`);
  log(`(executable will be saved in cache folder: ${installFolder})`);
  download(downloadUrl, installFolder, { extract: true })
    .on('response', res => {
      bar.total = res.headers['content-length'];
      log(`Downloaded total: ${bar.total}`);
      res.on('data', data => bar.tick(data.length));
    })
    .then(() => {
      log(`passExecutableCallback: ${platformExecutable}`);
      passExecutableCallback(platformExecutable);
    })
    .catch(err => {
      logError(`ERROR: impossible to download and extract binary: ${err.message}`);
      logError(`       SonarScanner binaries probably don't exist for your OS (${targetOS}).`);
      logError(
        '       In such situation, the best solution is to install the standard SonarScanner (requires a JVM).'
      );
      logError('       Check it out at https://redirect.sonarsource.com/doc/install-configure-scanner.html');
    });
}

/*
 * Returns the SQ Scanner executable if one available in the PATH (meaning user has also JAVA)
 */
function getLocalSonarScannerExecutable (passExecutableCallback) {
  var command = 'sonar-scanner';
  if (isWindows()) {
    command += '.bat';
  }

  // Try to execute the 'sonar-scanner' command to see if it's installed locally
  try {
    log('Trying to find a local install of the SonarScanner');
    exec(command + ' -v', {});
    // if we're here, this means that the SQ Scanner can be executed
    // TODO: we should check that it's at least v2.8+
    log('Local install of Sonarscanner found. Using it.');
    passExecutableCallback(command);
    return;
  } catch (e) {
    // sonar-scanner is not in the PATH
    throw Error('Local install of SonarScanner not found.');
  }
}

/*
 * Get the target OS based on the platform name
 */
function findTargetOS () {
  let targetOs = process.platform;

  if (isWindows()) {
    targetOs = 'windows';
  }
  if (isLinux()) {
    targetOs = 'linux';
  }
  if (isMac()) {
    targetOs = 'macosx';
  }

  const envPlatform = process.env.SONAR_SCANNER_TARGET_OS;

  if (envPlatform) {
    targetOs = envPlatform;
  }

  if (SUPPORTED_PLATFORMS.indexOf(targetOs) < 0) {
    throw Error(`Your platform '${targetOs}' is currently not supported.`);
  }

  return targetOs;
}

/**
 * Get the platform suffix for downloading or path checking
 */
function getPlatformSuffix (platform) {
  if (SUPPORTED_PLATFORMS.indexOf(platform) < 0) {
    throw Error(`Your platform '${platform}' is currently not supported.`);
  }

  if (platform === 'universal') {
    return '';
  }

  return `-${platform}`;
}

function getInstallFolderPath () {
  var basePath = process.env.SONAR_BINARY_CACHE || process.env.npm_config_sonar_binary_cache || os.homedir();
  return path.join(basePath, '.sonar', 'native-sonar-scanner');
}

/*
 * Some util functions...
 */
function isWindows () {
  return /^win/.test(process.platform);
}

function isMac () {
  return /^darwin/.test(process.platform);
}

function isLinux () {
  return /^linux/.test(process.platform);
}
