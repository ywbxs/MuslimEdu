# Phase 2 - frontend wiring (4 hand-edits)

The zip only contains NEW files, so nothing of yours is overwritten. These four
edits are the parts that have to go inside files that already exist. Each is a
paste, not a rewrite.

---

## 0. Check the service import (30 seconds, do this first)

Open `src/services/studentAttendanceService.ts`, line ~24:

```ts
import api from './api';
```

Open any existing service (`assessmentService.ts`) and make this line match it.
If they already agree, you are done. This is the single most likely thing to break.

---

## 1. `src/navigation/RootNavigator.tsx` - register the screen

With the other screen imports:

```tsx
import StudentAttendanceScreen from '../screens/attendance/StudentAttendanceScreen';
```

Inside the same `<Stack.Navigator>` where `StudentMaterialsScreen` is registered:

```tsx
<Stack.Screen
  name="StudentAttendance"
  component={StudentAttendanceScreen}
  options={{ title: 'My Attendance' }}
/>
```

---

## 2. `src/screens/StudentDashboard.tsx` - 3 quick links

```tsx
import DashboardQuickLink from '../components/DashboardQuickLink';
```

Then inside the dashboard body:

```tsx
<DashboardQuickLink
  title="My Attendance"
  subtitle="Monthly rate, daily record, 6-month trend"
  glyph="A"
  tint="#1F9254"
  onPress={() => navigation.navigate('StudentAttendance')}
/>

<DashboardQuickLink
  title="Learning Materials"
  subtitle="Notes, worksheets and resources from your teachers"
  glyph="M"
  tint="#2563EB"
  onPress={() => navigation.navigate('StudentMaterials')}
/>

<DashboardQuickLink
  title="My Grades"
  subtitle="Weighted assessment results by subject"
  glyph="G"
  tint="#7C3AED"
  onPress={() => navigation.navigate('StudentAssessmentGrades')}
/>
```

---

## 3. `src/screens/TeacherDashboard.tsx` - 2 quick links

```tsx
import DashboardQuickLink from '../components/DashboardQuickLink';

<DashboardQuickLink
  title="Assessment Grades"
  subtitle="Weighted results for your classes"
  glyph="G"
  tint="#7C3AED"
  onPress={() => navigation.navigate('TeacherAssessmentGrades')}
/>

<DashboardQuickLink
  title="Materials Library"
  subtitle="Upload and manage class resources"
  glyph="M"
  tint="#2563EB"
  onPress={() => navigation.navigate('TeacherMaterials')}
/>
```

---

## 4. `src/screens/AdminDashboard.tsx` - 2 quick links

```tsx
import DashboardQuickLink from '../components/DashboardQuickLink';

<DashboardQuickLink
  title="Assessment Grades"
  subtitle="Institution-wide weighted results"
  glyph="G"
  tint="#7C3AED"
  onPress={() => navigation.navigate('AdminAssessmentGrades')}
/>

<DashboardQuickLink
  title="Materials Review"
  subtitle="Resources published by teachers"
  glyph="M"
  tint="#2563EB"
  onPress={() => navigation.navigate('AdminMaterialReview')}
/>
```

> **Route names.** The five `navigate('...')` targets above are the names used
> when those screens were registered in earlier sessions. If a tap does nothing,
> grep `RootNavigator.tsx` for `Stack.Screen name=` and use the exact string.

---

## 5. Materials document picker - swap one call

In your teacher materials upload screen, replace the direct
`launchImageLibrary(...)` call with:

```tsx
import { pickFiles, toFormDataPart, isDocumentPickerAvailable } from '../../utils/filePicker';

const handlePick = async () => {
  try {
    const { files, cancelled, degraded } = await pickFiles(true);
    if (cancelled || files.length === 0) return;

    if (degraded) {
      Alert.alert(
        'Photos only',
        'Document support is not installed in this build yet, so only images can be attached.',
      );
    }

    setAttachments(files);
  } catch (e: any) {
    Alert.alert('Could not attach file', e?.message ?? 'Please try again.');
  }
};

// when building the upload body:
files.forEach(f => form.append('files[]', toFormDataPart(f)));
```

Then enable real document support:

```bash
npm i react-native-document-picker
cd ios && pod install && cd ..     # iOS only
```

Rebuild the app after installing. A native module will not appear on a JS reload.
`filePicker.ts` degrades to photos on its own until you do, so this is safe to
merge before the native step.

---

## Smoke test

1. Log in as a student -> dashboard shows 3 new cards
2. Tap **My Attendance** -> rate card, 4 status tiles, 6-month bars, daily list
3. Step back a month with `<` -> empty state renders instead of an error
4. Pull to refresh -> spinner, then data
5. If the backend zip is not deployed, the amber "simplified view" banner should
   appear and the screen should still work off the legacy route
