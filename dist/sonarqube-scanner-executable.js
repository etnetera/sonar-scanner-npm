var fs = require('fs');
var path = require('path');
var exec = require('child_process').execSync;
var mkdirp = require('mkdirp').sync;
var download = require('download');
var log = require('fancy-log');

module.exports = defineSonarQubeScannerExecutable;

/*
 * Returns the SQ Scanner executable:
 * - the one available in the PATH if it exists (meaning user has also JAVA)
 * - or the standalone JDK-9 binaries (that don't require JAVA on the box)
 */
function defineSonarQubeScannerExecutable() {
  var command = "sonar-scanner";
  if (isWindows()) {
    command += ".bat";
  }

  // #1 - Try to execute the "sonar-scanner" command
  try {
    exec(command + " -v", {});
    // if we're here, this means that the SQ Scanner can be executed
    // TODO: we should check that it's at least v2.8+
    // let's return it
    return command;
  } catch (e) {
    // sonar-scanner is not in the PATH => download the binaries for the
    // correct platform...
    log("Trying to use the target binaries for the '" + process.platform + "' platform...");
  }

  // #2 - Download the binaries from https://github.com/henryju/bdd-scanner-natif
  if (isWindows() || isLinux() || isMac()) {
    command = getPlatformBinaries();
    if (command) {
      return command;
    }
  }

  // #3 - If we're here, nothing can be done...
  throw Error("SonarQube Scanner not found and impossible to download a compatible binary for it.");
}

function getPlatformBinaries() {
  var platformBinariesVersion = "0.1";
  var installFolder = path.join(process.env.HOME, ".sonar", "native-sonar-scanner", platformBinariesVersion);
  var binaryExtension = "";
  if (isWindows()) {
    binaryExtension = ".bat";
  }

  try {
      var platformExecutable = path.join(installFolder, "bin", "org.sonarsource.scanner.standalone" + binaryExtension);
      log("Checking if executable exists: " + platformExecutable);
      fs.accessSync(platformExecutable, fs.F_OK);
      // executable exists, let's return it
      return platformExecutable;
  } catch (e) {
      // Folder does not exist - let's create it and install the binaries
      log("Could not find executable. Proceed with download...");
      log("Creating " + installFolder);
      mkdirp(installFolder);
      var targetOS = "mac";
      var fileName = "sonarqube-scanner-"
                      + targetOS
                      + "-x86_64-"
                      + platformBinariesVersion
                      + ".zip";
      var downloadUrl = "https://github.com/henryju/bdd-scanner-natif/releases/download/"
                        + platformBinariesVersion + "/" + fileName;
      log("Downloading from " + downloadUrl);
      // download(downloadUrl).pipe(fs.createWriteStream(path.join(installFolder, fileName)));
      download(downloadUrl, installFolder).then(() => {
        log("DONE!");
      });

  }

  return null;
}

/*
 * Some util functions...
 */
function isWindows() {
  return /^win/.test(process.platform);
}

function isMac() {
  return /^darwin/.test(process.platform);
}

function isLinux() {
  return /^linux/.test(process.platform);
}
