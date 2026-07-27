# Next phase, frontend wiring

The zip contains **only new files**, so nothing of yours is overwritten. The
edits below are the parts that have to go inside files that already exist. Each
one is a paste, not a rewrite.

What shipped: notification centre (inbox, preferences, header bell), teacher
examinations (list, form, marks entry), teacher self profile, teacher
communication hub, student documents, student services, user settings.

**This needs the matching backend zip deployed first.** All 12 screens call
routes that did not exist in `routes/api.php` before this phase.

---

## 0. Check the api client import, 30 seconds, do this first

Open `src/services/nextPhaseClient.ts`, line 2:

```ts
import { apiPost, ApiClientError } from './apiClient';
```

That matches `src/services/apiClient.ts` as it exists today. If your build has
since moved to a default export, change it to match. This is the single most
likely thing to break.

---

## 1. `src/navigation/RootNavigator.tsx` - register 9 screens

With the other screen imports:

```tsx
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import NotificationPreferencesScreen from '../screens/notifications/NotificationPreferencesScreen';
import TeacherExaminationsScreen from '../screens/teachers/TeacherExaminationsScreen';
import TeacherExaminationFormScreen from '../screens/teachers/TeacherExaminationFormScreen';
import TeacherExaminationGradingScreen from '../screens/teachers/TeacherExaminationGradingScreen';
import TeacherProfileScreen from '../screens/teachers/TeacherProfileScreen';
import TeacherCommunicationScreen from '../screens/teachers/TeacherCommunicationScreen';
import StudentDocumentsScreen from '../screens/student/StudentDocumentsScreen';
import StudentServicesScreen from '../screens/student/StudentServicesScreen';
import StudentSettingsScreen from '../screens/student/StudentSettingsScreen';
```

Inside the same `<Stack.Navigator>` where `StudentMaterialsScreen` is registered:

```tsx
<Stack.Screen name='Notifications' component={NotificationsScreen} options={{ title: 'Notifications' }} />
<Stack.Screen name='NotificationPreferences' component={NotificationPreferencesScreen} options={{ title: 'Notification settings' }} />

<Stack.Screen name='TeacherExaminations' component={TeacherExaminationsScreen} options={{ title: 'Examinations' }} />
<Stack.Screen name='TeacherExaminationForm' component={TeacherExaminationFormScreen} options={{ title: 'Examination' }} />
<Stack.Screen name='TeacherExaminationGrading' component={TeacherExaminationGradingScreen} options={{ title: 'Enter marks' }} />
<Stack.Screen name='TeacherProfile' component={TeacherProfileScreen} options={{ title: 'My profile' }} />
<Stack.Screen name='TeacherCommunication' component={TeacherCommunicationScreen} options={{ title: 'Communication' }} />

<Stack.Screen name='StudentDocuments' component={StudentDocumentsScreen} options={{ title: 'My documents' }} />
<Stack.Screen name='StudentServices' component={StudentServicesScreen} options={{ title: 'Student services' }} />
<Stack.Screen name='StudentSettings' component={StudentSettingsScreen} options={{ title: 'Settings' }} />
```

> **Route names matter.** The backend writes `route_name` into every
> notification so a tap deep-links straight to a screen. The names it emits are
> `StudentAssessments`, `StudentAssessmentGrades`, `StudentServices`,
> `StudentDocuments`. If yours differ, either rename above or change the
> `route_name` values in the backend controllers. A mismatch is not fatal:
> `NotificationsScreen` catches the failed navigate and shows an alert instead
> of crashing.

---

## 2. `src/screens/dashboards/TeacherDashboard.tsx` - 4 quick links

```tsx
import DashboardQuickLink from '../../components/DashboardQuickLink';

<DashboardQuickLink
  title='Examinations'
  subtitle='Schedule, publish and mark your examinations'
  glyph='X'
  tint='#7C3AED'
  onPress={() => navigation.navigate('TeacherExaminations')}
/>

<DashboardQuickLink
  title='Communication'
  subtitle='Messages, announcements and alerts in one place'
  glyph='C'
  tint='#2563EB'
  onPress={() => navigation.navigate('TeacherCommunication')}
/>

<DashboardQuickLink
  title='My Profile'
  subtitle='Contact details, qualifications, password'
  glyph='P'
  tint='#1F9254'
  onPress={() => navigation.navigate('TeacherProfile')}
/>

<DashboardQuickLink
  title='Notifications'
  subtitle='Everything that needs your attention'
  glyph='N'
  tint='#B45309'
  onPress={() => navigation.navigate('Notifications')}
/>
```

## 3. `src/screens/dashboards/StudentDashboard.tsx` - 4 quick links

```tsx
import DashboardQuickLink from '../../components/DashboardQuickLink';

<DashboardQuickLink
  title='My Documents'
  subtitle='Request transcripts and certificates'
  glyph='D'
  tint='#2563EB'
  onPress={() => navigation.navigate('StudentDocuments')}
/>

<DashboardQuickLink
  title='Student Services'
  subtitle='Raise a request with the office and track it'
  glyph='R'
  tint='#7C3AED'
  onPress={() => navigation.navigate('StudentServices')}
/>

<DashboardQuickLink
  title='Notifications'
  subtitle='Grades, announcements and request updates'
  glyph='N'
  tint='#B45309'
  onPress={() => navigation.navigate('Notifications')}
/>

<DashboardQuickLink
  title='Settings'
  subtitle='Language, calendar, privacy and password'
  glyph='S'
  tint='#1F9254'
  onPress={() => navigation.navigate('StudentSettings')}
/>
```

## 4. `src/screens/dashboards/AdminDashboard.tsx` - 1 quick link

```tsx
<DashboardQuickLink
  title='Notifications'
  subtitle='Everything that needs your attention'
  glyph='N'
  tint='#B45309'
  onPress={() => navigation.navigate('Notifications')}
/>
```

## 5. Header bell, optional but recommended

In `RootNavigator.tsx`, on any screen where you want the unread badge:

```tsx
import NotificationBell from '../components/NotificationBell';

options={({ navigation }) => ({
  headerRight: () => <NotificationBell navigation={navigation} />,
})}
```

It polls `notification_unread_count` on mount, on app foreground and every 60s.
No websocket dependency: `routes/channels.php` registers a broadcast channel but
the app has no Echo client, so polling is the honest option until that exists.

---

## A dead call this fixes

`src/services/portalService.ts` already POSTs to `student_portal_home`,
`portal_document_show`, `portal_action_submit`, `admin_portal_document_issue`
and `admin_portal_actions`. **None of those routes existed.**
`StudentPortalHomeScreen` has been failing on mount the whole time.

The backend zip implements `student_portal_home`. Once it is deployed that
screen works as written, with no frontend change.

The other four are still dead. Either implement them or delete the callers.
Recommended: point `StudentPortalHomeScreen` at
`src/services/studentPortalService.ts` (shipped here) and delete
`portalService.ts`, since the new service covers documents properly.

Same story for the three routes already flagged in `src/services/routes.ts`
under `unresolved`: `admin_schedule_delete`, `my_schedules`,
`admin_academic_analytics_attendance_trend`. Still unregistered, still dead.

---

## Smoke test

1. Log in as a teacher, dashboard shows 4 new cards
2. **Examinations** -> empty state -> **New examination** -> title + section id + date -> **Create draft**
3. Back on the list the exam shows as `draft`. Tap **Publish** with no date set: it should refuse with a clear message
4. Tap **Marks**, enter a mark higher than the total, tap save: it should refuse
5. Enter valid marks, **Save and release** -> log in as a student in that section -> the bell shows a badge
6. Tap the bell -> the notification is there -> tapping it deep-links to grades
7. **Student Services** -> raise a request -> it appears with an `open` pill and a reference number
8. **Settings** -> change language -> Save -> reopen the screen, it persisted
9. Turn off `grade` in notification settings, release another exam: no new notification is written
