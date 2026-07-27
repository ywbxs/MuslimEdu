#!/usr/bin/env node
/**
 * patch-navigation.js
 *
 * Registers the Subject Loading screens in src/navigation/RootNavigator.tsx
 * WITHOUT overwriting that file. Safe to run more than once: it looks for its
 * own marker and exits cleanly if the screens are already wired.
 *
 *   node patch-navigation.js
 */
const fs = require('fs');
const path = require('path');

const NAV = path.join(process.cwd(), 'src', 'navigation', 'RootNavigator.tsx');
const NL = String.fromCharCode(10);
const Q = String.fromCharCode(34);
const SQ = String.fromCharCode(39);

const SCREENS = [
  {
    name: 'SubjectLoadingQueue',
    component: 'SubjectLoadingQueueScreen',
    from: '../screens/admin/SubjectLoadingQueueScreen',
  },
  {
    name: 'SubjectLoadingBuilder',
    component: 'SubjectLoadingBuilderScreen',
    from: '../screens/admin/SubjectLoadingBuilderScreen',
  },
  {
    name: 'SubjectLoadingDetail',
    component: 'SubjectLoadingDetailScreen',
    from: '../screens/admin/SubjectLoadingDetailScreen',
  },
  {
    name: 'LoadPolicy',
    component: 'LoadPolicyScreen',
    from: '../screens/admin/LoadPolicyScreen',
  },
  {
    name: 'StudentSubjectLoad',
    component: 'StudentSubjectLoadScreen',
    from: '../screens/student/StudentSubjectLoadScreen',
  },
];

const MARKER = 'SUBJECT_LOADING_ROUTES';

function fail(message) {
  console.error('[patch-navigation] ' + message);
  process.exit(1);
}

if (!fs.existsSync(NAV)) {
  fail('src/navigation/RootNavigator.tsx not found. Run this from the repo root.');
}

let src = fs.readFileSync(NAV, 'utf8');

if (src.indexOf(MARKER) !== -1) {
  console.log('[patch-navigation] Already wired. Nothing to do.');
  process.exit(0);
}

fs.writeFileSync(NAV + '.bak', src, 'utf8');

// ---- 1. imports: insert after the last existing import line ----------
const lines = src.split(NL);
let lastImport = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].indexOf('import ') === 0) {
    lastImport = i;
  }
}
if (lastImport === -1) {
  fail('Could not find any import statements in RootNavigator.tsx.');
}

const importBlock = [''].concat(
  ['// ' + MARKER + ' imports'],
  SCREENS.map(function (s) {
    return 'import ' + s.component + ' from ' + SQ + s.from + SQ + ';';
  }),
);
lines.splice.apply(lines, [lastImport + 1, 0].concat(importBlock));
src = lines.join(NL);

// ---- 2. screens: insert before the closing Navigator tag -------------
const closeMatch = src.match(/<\/([A-Za-z0-9_]+)\.Navigator>/);
if (!closeMatch) {
  fail(
    'Could not find a closing Navigator tag. Register these manually: ' +
      SCREENS.map(function (s) {
        return s.name;
      }).join(', '),
  );
}

const stackVar = closeMatch[1];
const rows = SCREENS.map(function (s) {
  return (
    '      <' +
    stackVar +
    '.Screen name=' +
    Q +
    s.name +
    Q +
    ' component={' +
    s.component +
    '} />'
  );
});

const screenBlock =
  '      {/* ' + MARKER + ' */}' + NL + rows.join(NL) + NL + '      ';

src = src.replace(closeMatch[0], screenBlock + closeMatch[0]);

fs.writeFileSync(NAV, src, 'utf8');

console.log(
  '[patch-navigation] Wired ' + SCREENS.length + ' screens into RootNavigator.tsx',
);
console.log('[patch-navigation] Backup: src/navigation/RootNavigator.tsx.bak');
SCREENS.forEach(function (s) {
  console.log('  - ' + s.name);
});
