# Skeleton Loading – Install Guide

## What changed

Every full-page loading spinner (`ActivityIndicator` centered on a blank
screen) has been replaced with a **skeleton**: pulsing gray placeholder
blocks laid out in the exact shape of the real content. This avoids the
layout "jump" you get when a spinner is swapped for content, and reads as
faster even when the actual load time is unchanged.

**Small inline spinners were intentionally left alone** - e.g. the
spinner inside the "Submit Report" / "Save Report" buttons while a
request is in flight. Those are brief action feedback, not a page loading
state, so a spinner is still the right call there.

### Files touched

| File | Before | After |
|---|---|---|
| `src/components/Skeleton.tsx` | *(new)* | Shared `Skeleton` / `SkeletonCircle` primitives |
| `src/components/AppLaunchSkeleton.tsx` | *(new)* | Generic app-shell skeleton |
| `src/navigation/RootNavigator.tsx` | Blank white view while checking Keychain | `AppLaunchSkeleton` |
| `src/screens/dashboards/StudentDashboard.tsx` | Spinner in "This Month Overview" | 4 skeleton stat items |
| `src/screens/students/StudentListScreen.tsx` | Centered spinner | 5 skeleton list rows |
| `src/screens/orphan/AdminOrphanOverviewScreen.tsx` | Centered spinner | Skeleton progress card + 4 skeleton child rows |
| `src/screens/orphan/AdminChildReportDetailScreen.tsx` | Centered spinner | Skeleton add-button + 2 skeleton report cards |
| `src/screens/orphan/OrphanReportScreen.tsx` | Centered spinner | Skeleton report card + skeleton timeline |

## Install

### Option A: Automated

```bash
cd /workspaces/MuslimEdu
bash setup-skeleton-loading.sh
```

### Option B: Manual

```bash
cd /workspaces/MuslimEdu
unzip -o skeleton-loading-redesign.zip
cp -r skeleton-loading-redesign/src/* ./src/
rm -rf skeleton-loading-redesign skeleton-loading-redesign.zip

git add .
git commit -m "feat: replace loading spinners and launch splash with skeleton loaders"
git push
```

## Customizing

**Change the skeleton color:**
```tsx
// src/components/Skeleton.tsx
const SKELETON_BASE = '#E7E9EC';
```

**Change the pulse speed:**
```tsx
Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
```

**Adjust the app-launch shell shape:**
Edit `src/components/AppLaunchSkeleton.tsx` - it's intentionally generic
(role-agnostic) since at that point the app doesn't know yet whether
you're logged in or what role you are.

## Note

The initial native Android splash (your app icon on white, shown before
any JS runs) is unrelated to this and can't be replaced with a skeleton -
that part is drawn natively by the OS before your bundle loads. This
change only affects the JS-side loading states that happen *after* that.
