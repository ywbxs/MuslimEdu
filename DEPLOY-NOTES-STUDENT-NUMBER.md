# Deploying Student Numbers (spec 4.5)

The next slice after Admission. Section 4.5 of the master plan is the only
admission-adjacent piece still missing, and the app already had a placeholder
for it: `adminService.setSchoolCode()` points at `/admin_set_school_code`,
a route the notes admit "doesn't exist on the backend yet". This replaces that
guess with a real, database-driven student number format.

**What it does:** an admin composes the school's student number from prefix,
campus code, department code, academic type, academic year, admission year,
running number, and suffix - reordered freely, with a chosen separator, digit
width, start number, and yearly-reset vs continuous numbering. The screen shows
a live sample of the next three numbers. Admission then generates the real one
server-side, uniquely, with an audit row.

**What it deliberately does not do:** renumber anybody. Issued numbers are
immutable, the format that produced each one is recorded by version, and the
screen says so before you save a change.

---

## Backend (Hostinger File Manager)

Upload these at their matching paths on the live server:

- `app/Models/StudentNumberConfig.php` (new)
- `app/Models/StudentNumberSequence.php` (new)
- `app/Models/StudentNumberIssuedLog.php` (new)
- `app/Services/StudentNumberGenerator.php` (new)
- `app/Http/Controllers/Traits/StudentNumberApi.php` (new)
- `database/migrations/2026_07_27_000000_create_student_number_configs_table.php` (new)
- `database/migrations/2026_07_27_000100_create_student_number_sequences_table.php` (new)
- `database/migrations/2026_07_27_000200_create_student_number_issued_logs_table.php` (new)

If `app/Services/` doesn't exist yet, create it - it's a standard Laravel
autoloaded path under `App\Services`, no composer change needed.

### Manual edit 1 - register the trait

`app/Http/Controllers/ApiController.php` (5,400+ lines, not worth shipping whole
for two lines - same call as the Materials slice):

```php
use App\Http\Controllers\Traits\MaterialApi;
use App\Http\Controllers\Traits\StudentNumberApi;   // add this line
```

```php
class ApiController extends Controller
{
    use AttendanceApi;
    use GradebookApi;
    use AnnouncementApi;
    use LessonPlanApi;
    use AssessmentApi;
    use MaterialApi;
    use StudentNumberApi;   // add this line
```

### Manual edit 2 - the four routes

See `routes/routes-additions.php` in this zip. Paste those four lines into
`routes/api.php` inside the SAME authenticated group your other `admin_*`
routes already use. Don't create a new group.

### Manual edit 3 - generate the number during admission

This is the one that makes the feature real. In `admin_admission_single`, after
the student row has been created and saved (so `$student->id` exists) and
before you build the response, add:

```php
// --- Student number (spec 4.5) --------------------------------------
// Only auto-generates when the school has saved an active format AND the
// request didn't supply an explicit code. Schools that never open the
// Student Numbers screen keep their existing behaviour untouched.
$numberConfig = \App\Models\StudentNumberConfig::forSchool($schoolId);

if ($numberConfig && $numberConfig->is_active && !$request->filled('code')) {
    $student->code = app(\App\Services\StudentNumberGenerator::class)->issue(
        $numberConfig,
        [
            'campus_code'     => $campusCode     ?? null,
            'department_code' => $departmentCode ?? null,
            'academic_type'   => $academicType   ?? null,
            'academic_year'   => $academicYear   ?? null,
            'admission_date'  => $request->input('admission_date'),
        ],
        $student->id,
        $request->user()->id
    );
    $student->save();
}
```

Swap `$schoolId` / `$campusCode` / `$departmentCode` / `$academicType` /
`$academicYear` for whatever those are called in your admission method. Any of
them may be `null` - the generator just skips that segment and the config
screen already warns the admin when a segment has no source.

`issue()` runs in a transaction with `lockForUpdate()` on the counter row, so
two simultaneous admissions cannot get the same number. It also re-checks the
candidate against `student_number_issued_logs` and against `users.code`,
`users.student_number`, and `users.orphan_id_number` (each probed with
`Schema::hasColumn`, so no users-table migration is required).

### Two spots you may want to align

Both are isolated in `StudentNumberApi.php` and marked `ADJUST IF NEEDED`:

- `studentNumberSchoolId()` - reads `school_id` off the authed user, falls back
  to `created_by`, then `id`. Point it at whatever your other admin traits use.
- `studentNumberGuardAdmin()` - denies anyone whose role field is present and
  isn't an admin variant. It stays permissive only when no recognisable role
  field exists at all, so a first deploy can't lock you out. Tighten it to your
  real role check.

### Running the migrations (no SSH)

Same temp-route pattern as every prior migration:

1. Add to `routes/api.php`:
   ```php
   Route::get('/run-migrations-temp', function () {
       Artisan::call('migrate', ['--force' => true]);
       return Artisan::output();
   });
   ```
2. Hit it once in a browser.
3. **Delete the temp route immediately after.** (Spec 2: no temporary migration,
   debug, impersonation, or authorization-bypass route may remain.)

All three migrations are `Schema::hasTable`-guarded, so re-running is harmless.

---

## Frontend

Run `deploy-studentnumber-frontend.sh` from the frontend zip after editing the
`cd` path if yours isn't `/workspaces/MuslimEdu`.

Two files are moved into place as usual:

- `src/screens/admin/StudentNumberConfigScreen.tsx` (new)
- `src/services/studentNumberService.ts` (new)

Two are **patched in place** by `apply-studentnumber-phase.js` rather than
replaced:

- `src/navigation/RootNavigator.tsx` - import + `StudentNumberConfig` route
- `src/screens/dashboards/AdminDashboard.tsx` - `IdCardIcon` + a "Student
  Numbers" card in the Manage grid

Both files are large and touched by nearly every slice, so anchored inserts beat
shipping a stale whole-file copy. The script is idempotent (re-running is a
no-op), has no dependencies, and exits non-zero naming the exact anchor if one
of them has moved.

The dashboard entry point ships **with** the screen this time, rather than being
left as the usual follow-up.

---

## Design decisions worth knowing

**The app never composes a number.** Every sample on the config screen comes
from `/admin_student_number_preview`, debounced 450ms. There is deliberately no
local formatter to drift out of sync with the server, and preview consumes no
running number - it reads the counter, it doesn't touch it.

**Segments are server-defined.** `StudentNumberGenerator::segmentCatalog()` is
the single source of truth for which segments exist and which config flag turns
each one on; the screen renders that list. Adding a segment later is a backend
change plus nothing on the client.

**Order survives new segments.** A saved `segment_order` written before a
segment existed still works - unknown keys are dropped, missing ones are
appended in default order.

**Yearly reset is a data decision.** The counter is keyed by
`(school_id, scope_key)` where `scope_key` is `global` or `year:2026`. Nothing
in the code branches on "is this school yearly".

**Empty segments vanish quietly, loudly.** A segment with no value (campus code
on, but no campuses have codes) is skipped in the number and surfaced as a
named warning on the screen, rather than producing `MLP--0001`.

---

## Still not done

- Nothing in this project has run against a real database or a real RN build
  yet - this slice hasn't either. Same standing risk as always.
- `adminService.setSchoolCode()` / `SchoolCodeSetupScreen` still exist and still
  point at the non-existent `/admin_set_school_code`. This slice doesn't remove
  them (that's an orphan-school onboarding gate, separate concern), but the
  prefix it collects is now properly owned by `student_number_configs.prefix`.
  Retiring that screen in favour of this one is the natural next cleanup.
- Bulk renumbering of existing students is intentionally absent. Spec 4.5 wants
  historical stability; a renumber tool would need its own approval + audit
  flow.
- No student-facing surface yet. Spec 6 wants the number on the student profile
  and ID/QR - the value now exists reliably, wiring it into `StudentDashboard`
  is a small follow-up.
