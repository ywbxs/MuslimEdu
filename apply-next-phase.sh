#!/usr/bin/env bash
set -euo pipefail
python3 - <<'PY'
from pathlib import Path
p=Path('src/navigation/RootNavigator.tsx');s=p.read_text();mark="import AppLaunchSkeleton from '../components/AppLaunchSkeleton';";imp="import AcademicDocumentsPhase10Screen from '../screens/admin/AcademicDocumentsPhase10Screen';"
if 'AcademicDocumentsPhase10Screen' not in s and mark in s:s=s.replace(mark,mark+'\n'+imp)
needle='<Stack.Screen name="MainTabs" component={MainTabs} options={{ animation: \'fade\' }} />';add='\n <Stack.Screen name="AcademicDocumentsPhase10" component={AcademicDocumentsPhase10Screen} options={{ animation: \'slide_from_right\' }} />'
if 'name="AcademicDocumentsPhase10"' not in s and needle in s:s=s.replace(needle,needle+add)
p.write_text(s)
p=Path('src/config/api.ts');s=p.read_text()
if 'academicDocuments:' not in s and 'logoutAll:' in s:s=s.replace("logoutAll: `${API_BASE_URL}/logout-all`,","logoutAll: `${API_BASE_URL}/logout-all`,\n academicDocuments: `${API_BASE_URL}/academic/documents`,")
p.write_text(s)
PY
