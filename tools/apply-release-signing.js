#!/usr/bin/env node
// Patches a freshly-generated android/app/build.gradle (from
// `react-native init`, run fresh in the release-build CI workflow every
// time - there's no committed android/ directory to hand-edit once) so
// the release build type signs with the real upload keystore instead of
// the debug keystore it ships with by default.
//
// Reads MYAPP_RELEASE_STORE_FILE / MYAPP_RELEASE_KEY_ALIAS /
// MYAPP_RELEASE_STORE_PASSWORD / MYAPP_RELEASE_KEY_PASSWORD from
// android/gradle.properties at build time (the CI workflow writes those
// from GitHub secrets right before this script runs) - this file never
// contains a real password itself.
//
// Usage: node apply-release-signing.js <path-to-build.gradle>

const fs = require('fs');

const gradlePath = process.argv[2];
if (!gradlePath) {
  console.error('Usage: node apply-release-signing.js <path-to-build.gradle>');
  process.exit(1);
}

let content = fs.readFileSync(gradlePath, 'utf8');

if (content.includes('MYAPP_RELEASE_STORE_FILE')) {
  console.log('build.gradle already has a release signing config - leaving it as-is.');
  process.exit(0);
}

const signingConfigsPattern = /signingConfigs\s*\{([\s\S]*?debug\s*\{[\s\S]*?\}\s*)\}/;
const match = content.match(signingConfigsPattern);

if (!match) {
  console.error(
    'Could not find the expected signingConfigs { debug { ... } } block in build.gradle. ' +
    'The React Native template this was generated from may have changed shape - ' +
    'this build will still produce an .aab, but it will be signed with the DEBUG ' +
    'keystore, which the Play Store will reject on upload. Add a release ' +
    'signingConfigs block by hand (see reactnative.dev "Generating an upload key" / ' +
    '"Setting up gradle variables") and re-run.'
  );
  process.exit(0); // don't fail the whole workflow - let bundleRelease run so the log shows the real Gradle error too
}

const releaseSigningBlock =
  '        release {\n' +
  "            if (project.hasProperty('MYAPP_RELEASE_STORE_FILE')) {\n" +
  '                storeFile file(MYAPP_RELEASE_STORE_FILE)\n' +
  '                storePassword MYAPP_RELEASE_STORE_PASSWORD\n' +
  '                keyAlias MYAPP_RELEASE_KEY_ALIAS\n' +
  '                keyPassword MYAPP_RELEASE_KEY_PASSWORD\n' +
  '            }\n' +
  '        }\n' +
  '    ';

content = content.replace(
  signingConfigsPattern,
  (full, debugBlock) => `signingConfigs {${debugBlock}${releaseSigningBlock}}`
);

// Point the release buildType at the new signingConfigs.release instead of
// signingConfigs.debug - only the FIRST such line after the literal
// "release {" buildType name, which (since debug's own signingConfig line
// always appears earlier in the file) is guaranteed to be the release
// block's own line, not debug's.
const releaseBuildTypePattern = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/;
if (releaseBuildTypePattern.test(content)) {
  content = content.replace(releaseBuildTypePattern, '$1signingConfig signingConfigs.release');
} else {
  console.error(
    'Added a release signingConfigs block, but could not find ' +
    '"signingConfig signingConfigs.debug" inside buildTypes.release to repoint - ' +
    'check android/app/build.gradle by hand.'
  );
}

fs.writeFileSync(gradlePath, content);
console.log('Release signing config applied to ' + gradlePath);
