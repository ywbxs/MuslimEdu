# Phase 14 frontend

No application screen is changed in this phase. The package contains a scan-only repository checker:

```bash
cd /workspaces/MuslimEdu
git pull
unzip -o MuslimEdu-Phase14-Normalization-Frontend.zip -d .
node tools/normalization-check.js > frontend-normalization-report.json
git add -A && git commit -m "Phase 14: repository normalization scan" && git push
```

The checker reports backup/archive candidates and deletes nothing.
