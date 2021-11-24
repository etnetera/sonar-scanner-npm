var assert = require('assert');
var path = require('path');
var index = require('../src/sonar-scanner-executable');

describe('sqScannerExecutable', function () {
  var exclusions = 'node_modules/**,bower_components/**,jspm_packages/**,typings/**,lib-cov/**';

  it('should provide default values', function () {
    var expectedResult = {
      maxBuffer: 1024 * 1024,
      stdio: [0, 1, 2],
      env: {
        SONARQUBE_SCANNER_PARAMS: JSON.stringify({
          'sonar.projectDescription': 'No description.',
          'sonar.sources': '.',
          'sonar.exclusions': exclusions
        })
      }
    };

    var fakeProcess = {
      env: {},
      cwd: function () {
        return pathForProject('fake_project_with_no_package_file');
      }
    };

    assert.deepEqual(index.prepareExecEnvironment({}, fakeProcess), expectedResult);
  });

  it('should read SONARQUBE_SCANNER_PARAMS provided by environment if it exists', function () {
    var expectedResult = {
      maxBuffer: 1024 * 1024,
      stdio: [0, 1, 2],
      env: {
        SONARQUBE_SCANNER_PARAMS: JSON.stringify({
          'sonar.projectDescription': 'No description.',
          'sonar.sources': '.',
          'sonar.exclusions': exclusions,
          'sonar.host.url': 'https://sonarcloud.io',
          'sonar.branch': 'dev'
        })
      }
    };

    var fakeProcess = {
      env: {
        SONARQUBE_SCANNER_PARAMS: JSON.stringify({
          'sonar.host.url': 'https://sonarcloud.io',
          'sonar.branch': 'dev'
        })
      },
      cwd: function () {
        return pathForProject('fake_project_with_no_package_file');
      }
    };

    assert.deepEqual(index.prepareExecEnvironment({}, fakeProcess), expectedResult);
  });
});

describe('getSonarScannerExecutable', function () {
  it('should use SONAR_BINARY_CACHE env when exists', function () {
    process.env.SONAR_BINARY_CACHE = './test-cache';
    assert.equal(index.getInstallFolderPath(), 'test-cache/.sonar/native-sonar-scanner', 'congrats');
  });
});

describe('findTargetOS', function () {
  before(function () {
    this.originalPlatform = process.platform;
    delete process.env.SONAR_SCANNER_TARGET_OS;
  });

  after(function () {
    forcePlatform(this.originalPlatform);
    delete process.env.SONAR_SCANNER_TARGET_OS;
  });

  it('should return the right platform or throw', function () {
    forcePlatform('win');
    assert.equal(index.findTargetOS(), 'windows');

    forcePlatform('darwin');
    assert.equal(index.findTargetOS(), 'macosx');

    forcePlatform('linux');
    assert.equal(index.findTargetOS(), 'linux');

    forcePlatform('foo');
    assert.throws(function () {
      index.findTargetOS();
    }, /Your platform 'foo' is currently not supported\./);
  });

  it('should use the SONAR_SCANNER_TARGET_OS env variable over the process.platform', function () {
    forcePlatform('foo');

    process.env.SONAR_SCANNER_TARGET_OS = 'windows';
    assert.equal(index.findTargetOS(), 'windows');
    assert.equal(index.getPlatformSuffix('windows'), '-windows');

    process.env.SONAR_SCANNER_TARGET_OS = 'macosx';
    assert.equal(index.findTargetOS(), 'macosx');
    assert.equal(index.getPlatformSuffix('macosx'), '-macosx');

    process.env.SONAR_SCANNER_TARGET_OS = 'linux';
    assert.equal(index.findTargetOS(), 'linux');
    assert.equal(index.getPlatformSuffix('linux'), '-linux');

    process.env.SONAR_SCANNER_TARGET_OS = 'universal';
    assert.equal(index.findTargetOS(), 'universal');
    assert.equal(index.getPlatformSuffix('universal'), '');

    process.env.SONAR_SCANNER_TARGET_OS = 'bar';
    assert.throws(function () {
      index.findTargetOS();
    }, /Your platform 'bar' is currently not supported\./);
    assert.throws(function () {
      index.getPlatformSuffix('bar');
    }, /Your platform 'bar' is currently not supported\./);
  });

  it('should ignore an empty SONA_SCANNER_TARGET_OS env variable', function () {
    forcePlatform('windows');
    process.env.SONAR_SCANNER_TARGET_OS = '';
    assert.equal(index.findTargetOS(), 'windows');
  });
});

function pathForProject (projectFolder) {
  return path.join(process.cwd(), 'specs', 'resources', projectFolder);
}

function forcePlatform (platform) {
  Object.defineProperty(process, 'platform', {
    value: platform
  });
}
