#!/usr/bin/env bash
# Student Numbers (spec 4.5) - frontend deploy.
# Same pattern as every prior slice: pull, unzip, mv -f, commit, push.
set -e

cd /workspaces/MuslimEdu
git pull
unzip -o muslimedu-studentnumber-frontend.zip

mv -f StudentNumberConfigScreen.tsx src/screens/admin/StudentNumberConfigScreen.tsx
mv -f studentNumberService.ts       src/services/studentNumberService.ts

# RootNavigator.tsx and AdminDashboard.tsx are patched in place instead of
# replaced - both are large and change every slice, so an anchored insert is
# safer than shipping a whole-file copy. Idempotent, safe to re-run.
node apply-studentnumber-phase.js
rm -f apply-studentnumber-phase.js

git add -A
git commit -m "Add student number configuration: format builder, live preview, collision-safe issuance"
git push
