# MuslimEdu Build Status

> Updated after **Phase 01: Subject Loading Engine**
> Date: 2026-07-26
> Scope of this phase: the authoritative subject-enrolment engine. Repository
> cleanup and migration de-duplication were deliberately skipped.

---

## 1. What this phase shipped

The repo previously had an enrollment workflow with a **Subject Loading** stage
but no engine behind it, so no validated subject-enrolment record ever got
written. Everything downstream (COR, transcripts, GPA, promotion, graduation)
was dead-ended on that gap. This phase closes it.

### Backend (Laravel)

| File | Purpose |
| --- | --- |
| `database/migrations/..._create_academic_load_policies_table.php` | Per school / program / level rulebook. Every rule is a column, nothing hardcoded. |
| `database/migrations/..._create_academic_subject_loadings_table.php` | One load header per student per term. The record a COR is generated from. |
| `database/migrations/..._create_academic_subject_loading_items_table.php` | One row per loaded subject. **The authoritative subject-enrolment record.** |
| `database/migrations/..._create_academic_subject_loading_audits_table.php` | Append-only audit of every mutation, override and decision. |
| `app/Models/AcademicLoadPolicy.php` | Policy model + `resolveFor()` (most specific scope wins). |
| `app/Models/AcademicSubjectLoading.php` | Load header, status constants, active scopes. |
| `app/Models/AcademicSubjectLoadingItem.php` | Loaded subject, seat-holding scope. |
| `app/Models/AcademicSubjectLoadingAudit.php` | Audit writer. |
| `app/Services/SubjectEligibilityValidator.php` | Pure rules engine. Never writes. |
| `app/Services/SubjectLoadingService.php` | The only place allowed to mutate an enrolment. Transactions + row locks. |
| `app/Http/Controllers/SubjectLoadingController.php` | 15 endpoints, all school-scoped from the token. |
| `routes/api_subject_loading.php` | Complete standalone route file. |

### Rules the engine now enforces

| Code | Rule | Overridable |
| --- | --- | --- |
| `SUBJECT_NOT_FOUND` | Subject must exist | no |
| `SUBJECT_WRONG_SCHOOL` | Cross-school subject rejected | **no** |
| `SUBJECT_INACTIVE` | Archived subjects blocked | yes |
| `NOT_IN_CURRICULUM` | Must belong to the student's curriculum version | yes |
| `PREREQUISITE_NOT_MET` | Prerequisite must be passed | yes |
| `COREQUISITE_MISSING` | Co-requisite must be in the same basket | yes |
| `ALREADY_PASSED` | No re-taking a passed subject | yes |
| `DUPLICATE_IN_BASKET` | Same subject twice in one load | no |
| `ALREADY_ENROLLED_THIS_TERM` | Duplicate active enrolment | **no** |
| `SCHEDULE_CONFLICT` | Timetable overlap, basket + existing load | yes |
| `CAPACITY_FULL` | Section / schedule seat limit | yes |
| `SCHEDULE_SUBJECT_MISMATCH` | Schedule must belong to the subject | no |
| `MAX_UNITS_EXCEEDED` | Unit ceiling per policy | yes |
| `MIN_UNITS_NOT_MET` | Unit floor, checked on submit | yes |
| `ENROLLMENT_WINDOW_CLOSED` | Term enrollment window | yes |
| `EMPTY_LOAD` | Cannot submit an empty load | no |

Every override records **who, why, when, and the exact rules that were broken**.

### Endpoints added

```
POST /api/admin_subject_loading_context        offer sheet + current draft + policy
POST /api/admin_subject_loading_eligibility    dry run, writes nothing
POST /api/admin_subject_loading_store          atomic create/replace draft
POST /api/admin_subject_loading_submit         draft -> submitted
POST /api/admin_subject_loading_approve        re-validates, then locks
POST /api/admin_subject_loading_reject         return for correction
POST /api/admin_subject_loading_cancel         releases seats
POST /api/admin_subject_loading_drop_item      drop one subject, keep history
POST /api/admin_subject_loading_list           registrar queue + status counts
POST /api/admin_subject_loading_detail         one load in full
POST /api/admin_subject_loading_audit          audit trail
POST /api/admin_load_policy_list               read policies
POST /api/admin_load_policy_save               create/update a policy
POST /api/admin_load_policy_delete             soft delete a policy
POST /api/student_subject_load                 student, own record only
POST /api/teacher_subject_load_advisees        adviser, own sections only
```

### Frontend (React Native)

| File | Purpose |
| --- | --- |
| `src/services/subjectLoadingService.ts` | Typed client. Auto-detects the base URL and auth token. |
| `src/screens/admin/SubjectLoadingBuilderScreen.tsx` | Live-validating basket builder with the override flow. |
| `src/screens/admin/SubjectLoadingQueueScreen.tsx` | Registrar queue with status filters. |
| `src/screens/admin/SubjectLoadingDetailScreen.tsx` | Approve / return / cancel / drop + audit trail. |
| `src/screens/admin/LoadPolicyScreen.tsx` | Toggle every rule the engine enforces. |
| `src/screens/student/StudentSubjectLoadScreen.tsx` | Student view, own record only. |
| `patch-navigation.js` | Idempotently registers all five screens in RootNavigator. |

---

## 2. Security posture of this phase

- Every endpoint derives `school_id` from the authenticated user. No school,
  curriculum, term or program id is ever read from the request body.
- Students hit `student_subject_load` with an empty payload; there is no id to
  tamper with.
- Advisers are restricted to students in sections where they are the class
  teacher. If no adviser relationship can be resolved, they see **nothing**
  rather than the whole school.
- Writes run inside `DB::transaction` with `lockForUpdate`, and capacity is
  re-checked at approval time, so two advisers cannot over-fill a section.
- Overrides require a written reason before the backend honours them.

---

## 3. Graceful degradation

The engine is schema-defensive. If a supporting table is missing or shaped
differently, that rule is **skipped and reported**, not silently ignored. Every
response carries a `checks_skipped` array, and the builder screen shows those as
amber chips. Watch for:

- `CURRICULUM_CHECK` - no curriculum/subject mapping table found
- `PREREQUISITE_CHECK` - no prerequisite table found
- `SCHEDULE_CONFLICT_CHECK` - schedule table has no readable day/time columns
- `CAPACITY_CHECK` - schedule table has no capacity column
- `ENROLLMENT_WINDOW` - term has no enrollment window configured
- `ACADEMIC_HISTORY` - no graded loading history yet, so prerequisites read as
  unmet (expected on day one and for transferees; use overrides)

Any chip you see is a real gap in the data layer, not a bug in the engine.

---

## 4. Full project status after this phase

### Built

**Foundation** - multi-school auth, roles, sanctum tokens, school codes, school
types, usernames, academic setup wizard, institution profile.

**Structure** - campuses, departments, programs, subjects, curricula, grade
levels, classes, sections, facilities, buildings, rooms.

**Calendar** - academic years, semester terms, term windows, calendar events.

**Grading** - grading systems, grade scales, exam categories, assessments,
submissions, teacher gradebook, admin review.

**Attendance** - new attendance tables, edit logs, settings, legacy migration,
teacher roster/history, admin analytics.

**Enrollment** - admission, configurable workflow stages, workflow records and
history, student numbering.

**Content** - materials, lesson plans, announcements, posts/comments/likes.

**Portals** - full admin, teacher and student screen sets.

**Operational modules** - finance, library, orphan/sponsor.

**NEW: Subject Loading Engine** - authoritative subject enrolment with a
complete rules engine, override audit trail, and approval workflow.

### Not built yet

**P0 - Timetable conflict engine.** Schedules are still CRUD only. The loading
engine detects student-side conflicts, but there is no room, instructor or
section conflict detection, no draft/review/published states, and no publish
notification. *This is the next phase.*

**P0 - Repository and migration normalisation.** Deliberately skipped. Duplicate
migrations remain for curricula, semester terms, usernames, teacher reports,
user documents and two generations of student numbering. Backend archives and
`.phpo`/`.php1` backups still sit in the repo root.

**P0 - Authorization hardening across the older modules.** This phase is clean;
the legacy `ApiController` endpoints still need a school-scope audit and
negative tests using another school's ids.

**P1** - promotion/retention policy engine, graduation requirements engine,
versioned certificate and transcript templates (COR can now be generated from
approved loads, but the template layer does not exist), grade release and
revision workflow, GPA/CGPA computation, student transfers and withdrawals,
bulk import/export, real permission-scoped analytics, Arabic/English
localisation and RTL, Hijri/dual calendar rendering.

**P2** - finance and library synchronisation, notifications, messaging,
biometric/QR attendance integrations, offline sync, exports.

---

## 5. Suggested next phase

**Timetable Conflict Engine.** It is the last hard dependency before subject
loading is fully trustworthy: right now a student can be loaded into a schedule
block whose room or instructor is double-booked, because nothing validates the
schedule itself. Build room / instructor / section conflict detection, add the
draft -> review -> published -> archived lifecycle, then wire published
schedules into the loading offer sheet.
