# Student Dashboard Redesign – Installation Guide

## What's Included

**StudentDashboard.tsx** – A complete redesign featuring:

- **Parallax Hero Layer**: Dark gradient background that scrolls at 50% speed, creating Apple-like depth
- **Glass Profile Card**: Frosted glassmorphic card with Name, Email, Student Code fields
- **Monthly Report Hero**: Emerald gradient card with icon, text, and white arrow button
- **Quick Actions Row**: 3 compact cards (My Reports, My Progress, Notifications) with badges
- **This Month Overview**: 4 stats (Reports Submitted, Average Score, Activities Completed, Time Spent)
- **Real Data Wiring**: Reports Submitted and Average Score pull from orphan submission history

## Installation

### Option A: Automated (Recommended)

```bash
cd /workspaces/MuslimEdu
bash setup-student-dashboard.sh
```

This script will:
1. Extract the zip
2. Copy files into `src/`
3. Clean up
4. Git commit with a descriptive message
5. Push to remote

### Option B: Manual

```bash
cd /workspaces/MuslimEdu
unzip -o student-dashboard-redesign.zip
cp -r student-dashboard-redesign/src/* ./src/
rm -rf student-dashboard-redesign student-dashboard-redesign.zip

git add .
git commit -m "feat: redesign student dashboard with parallax hero, profile glass card, monthly report hero, quick actions, and month overview stats"
git push
```

## File Structure

```
student-dashboard-redesign/
└── src/
    └── screens/
        └── dashboards/
            └── StudentDashboard.tsx
```

## Design System Usage

Uses your existing theme constants from `DashboardShell.tsx`:
- `EMERALD` – Primary action color (#10B981)
- `EMERALD_SOFT` – Soft background tints
- `INK` – Text dark color
- `SUBTLE` – Secondary text color
- `PALE_GREEN` – Light accents (#8FD9AE)
- Glass backgrounds with `rgba(255,255,255,0.07)` opacity

## Key Features

### Parallax Scrolling
```tsx
const bgTranslateY = scrollY.interpolate({
  inputRange: [0, HERO_HEIGHT],
  outputRange: [0, -HERO_HEIGHT * PARALLAX_FACTOR],
  extrapolate: 'clamp',
});
```
Content scrolls normally; background moves at 50% speed.

### Glass Card Effect
```tsx
backgroundColor: 'rgba(255,255,255,0.07)',
borderWidth: 1,
borderColor: 'rgba(255,255,255,0.14)',
```

### Inline SVG Icons
All icons are drawn with `react-native-svg` (no external assets needed):
- PersonIcon, MailIcon, IdCardIcon
- CalendarIcon, ProgressBarsIcon, BellIcon
- DocumentIcon, StarIcon, CheckCircleIcon, ClockIcon
- And more

### Real Data Integration
- **Reports Submitted**: Pulls from `orphanService.fetchReportStatus()` → `history.length`
- **Average Score**: Calculates average of academic + wellbeing ratings from submission history
- **Activities/Time**: Fallback to "-" (endpoint doesn't exist yet)

## Customization

### Change Parallax Speed
Adjust `PARALLAX_FACTOR` (currently 0.5):
```tsx
const PARALLAX_FACTOR = 0.5; // 0 = no parallax, 1 = moves with content
```

### Adjust Hero Height
```tsx
const HERO_HEIGHT = 430; // Height of gradient background
```

### Modify Colors
Update the gradient colors:
```tsx
const DARK_TOP = '#123F2E';      // Header top
const DARK_BOTTOM = '#04140D';   // Header bottom
const PALE_GREEN = '#8FD9AE';    // Light accents
```

## Navigation Hooks

The component uses these navigation routes:
- `OrphanReport` – Monthly report submission
- `Menu` – Sidebar menu (avatar tap)
- Placeholder alerts for unimplemented features

Make sure your `RootNavigator` includes these screens.

## Troubleshooting

**Gradient not showing?**
- Verify `react-native-svg` is in `package.json` (you already have it)

**Glass effect too opaque/transparent?**
- Adjust the `rgba()` values:
  - `GLASS_BG = 'rgba(255,255,255,0.07)'` – Background
  - `GLASS_BORDER = 'rgba(255,255,255,0.14)'` – Border
  - `GLASS_DIVIDER = 'rgba(255,255,255,0.12)'` – Divider lines

**Parallax jittery?**
- Ensure `scrollEventThrottle={16}` is set on ScrollView
- Verify native driver is enabled: `useNativeDriver: true`

## Next Steps

1. Wire up the remaining Quick Actions (My Progress, Notifications)
2. Build out the Activities Completed and Time Spent data sources
3. Add month selector that loads different months' stats
4. Consider adding animations for stat updates

---

**Deployed**: [timestamp]
**Component**: StudentDashboard.tsx
**Status**: ✅ Ready for production
