#!/usr/bin/env bash
set -euo pipefail
python3 - <<'PY'
from pathlib import Path
p=Path('src/navigation/RootNavigator.tsx');s=p.read_text();mark="import AppLaunchSkeleton from '../components/AppLaunchSkeleton';";imp="import RemainingModulesPhase12Screen from '../screens/admin/RemainingModulesPhase12Screen';\nimport TeacherPortalCompletionPhase13Screen from '../screens/teacher/TeacherPortalCompletionPhase13Screen';\nimport StudentPortalCompletionPhase14Screen from '../screens/student/StudentPortalCompletionPhase14Screen';"
if 'RemainingModulesPhase12Screen' not in s and mark in s:s=s.replace(mark,mark+'\n'+imp)
needle='<Stack.Screen name="MainTabs" component={MainTabs} options={{ animation: \'fade\' }} />';add='\n <Stack.Screen name="RemainingModulesPhase12" component={RemainingModulesPhase12Screen} options={{ animation: \'slide_from_right\' }} />\n <Stack.Screen name="TeacherPortalCompletionPhase13" component={TeacherPortalCompletionPhase13Screen} options={{ animation: \'slide_from_right\' }} />\n <Stack.Screen name="StudentPortalCompletionPhase14" component={StudentPortalCompletionPhase14Screen} options={{ animation: \'slide_from_right\' }} />'
if 'name="RemainingModulesPhase12"' not in s and needle in s:s=s.replace(needle,needle+add)
p.write_text(s)
p=Path('src/config/api.ts');s=p.read_text()
if 'academicRemaining:' not in s and 'logoutAll:' in s:s=s.replace("logoutAll: `${API_BASE_URL}/logout-all`,","logoutAll: `${API_BASE_URL}/logout-all`,\n academicRemaining: `${API_BASE_URL}/academic`,")
p.write_text(s)
PY
