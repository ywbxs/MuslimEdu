import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoSubscription } from '@react-native-community/netinfo';
import { PickedPhoto } from './orphanService';
import type { AttendanceRecordInput } from './teacherAttendanceService';

/**
 * Generic offline outbox: the first version of M6's "offline sync" item.
 * Scope is deliberately narrow - a queue + retry engine plus its first real
 * consumers (orphan/teacher monthly report submission), not a rewrite of
 * every mutating call in the app. Most services still call `fetch`/`axios`
 * directly rather than going through one shared client, so a generic
 * "queue any request" interceptor isn't a safe drop-in yet; this instead
 * queues fully-formed, JSON-serializable action payloads and replays them
 * through the same service functions the screens already call.
 *
 * Adding a new queueable action means: add its type to `QueuedActionKind`,
 * add a case in `runAction`, and expose an `enqueue*` helper below.
 */

const STORAGE_KEY = '@offline_queue_v1';
const MAX_ATTEMPTS = 8;
// Exponential backoff, capped at 30 minutes, so a genuinely broken action
// (e.g. server keeps rejecting it) doesn't hammer the network every retry.
const BASE_BACKOFF_MS = 15_000;
const MAX_BACKOFF_MS = 30 * 60 * 1000;

export type QueuedActionKind =
  | 'orphan_report_submit'
  | 'teacher_orphan_report_submit'
  | 'attendance_submit'
  | 'attendance_scan';

interface OrphanReportSubmitPayload {
  fields: { note: string; academic_rating: number; wellbeing_rating: number; report_month?: string };
  photos: PickedPhoto[];
}

interface TeacherOrphanReportSubmitPayload {
  fields: {
    note: string;
    teaching_effectiveness_rating: number;
    classroom_engagement_rating: number;
    professional_growth_rating: number;
    report_month?: string;
  };
  photos: PickedPhoto[];
}

interface AttendanceSubmitPayload {
  sectionId: number;
  subjectId: number;
  date: string;
  records: AttendanceRecordInput[];
}

interface AttendanceScanPayload {
  sectionId: number;
  subjectId: number;
  date: string;
  code: string;
}

type QueuedActionPayload =
  | OrphanReportSubmitPayload
  | TeacherOrphanReportSubmitPayload
  | AttendanceSubmitPayload
  | AttendanceScanPayload;

export interface QueuedAction {
  id: string;
  kind: QueuedActionKind;
  token: string;
  payload: QueuedActionPayload;
  createdAt: number;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: number;
}

export interface OfflineQueueSnapshot {
  isOnline: boolean;
  isFlushing: boolean;
  actions: QueuedAction[];
}

type Listener = (snapshot: OfflineQueueSnapshot) => void;

let queue: QueuedAction[] = [];
let isOnline = true;
let isFlushing = false;
let isLoaded = false;
let loadPromise: Promise<void> | null = null;
let netInfoUnsubscribe: NetInfoSubscription | null = null;
const listeners = new Set<Listener>();

function snapshot(): OfflineQueueSnapshot {
  return { isOnline, isFlushing, actions: queue.slice() };
}

function notify() {
  const s = snapshot();
  listeners.forEach((listener) => listener(s));
}

async function persist() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // Best-effort persistence - losing the on-disk copy just means a future
    // cold start won't recover this queue, not that the in-memory retry loop
    // breaks right now.
  }
}

async function ensureLoaded() {
  if (isLoaded) return;
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        queue = raw ? (JSON.parse(raw) as QueuedAction[]) : [];
      } catch {
        queue = [];
      }
      isLoaded = true;
    })();
  }
  await loadPromise;
}

function backoffFor(attempts: number): number {
  const delay = BASE_BACKOFF_MS * Math.pow(2, Math.max(0, attempts - 1));
  return Math.min(delay, MAX_BACKOFF_MS);
}

/** Replays one queued action through the real service function it queued for. */
async function runAction(action: QueuedAction): Promise<void> {
  if (action.kind === 'orphan_report_submit') {
    const { submitReport } = await import('./orphanService');
    const payload = action.payload as OrphanReportSubmitPayload;
    await submitReport(action.token, payload.fields, payload.photos);
    return;
  }
  if (action.kind === 'teacher_orphan_report_submit') {
    const { submitTeacherReport } = await import('./teacherOrphanService');
    const payload = action.payload as TeacherOrphanReportSubmitPayload;
    await submitTeacherReport(action.token, payload.fields, payload.photos);
    return;
  }
  if (action.kind === 'attendance_submit') {
    const { submitAttendance } = await import('./teacherAttendanceService');
    const payload = action.payload as AttendanceSubmitPayload;
    await submitAttendance(action.token, payload.sectionId, payload.subjectId, payload.date, payload.records);
    return;
  }
  if (action.kind === 'attendance_scan') {
    const { scanAttendance } = await import('./teacherAttendanceService');
    const payload = action.payload as AttendanceScanPayload;
    await scanAttendance(action.token, payload.sectionId, payload.subjectId, payload.date, payload.code);
    return;
  }
  throw new Error(`No offline queue executor registered for "${action.kind}".`);
}

/**
 * Attempts to send every due queued action, in the order they were queued.
 * Safe to call opportunistically (on connectivity change, on app foreground,
 * after enqueueing) - it no-ops if already flushing or offline.
 */
export async function flushOfflineQueue(): Promise<void> {
  await ensureLoaded();
  if (isFlushing || !isOnline || queue.length === 0) return;
  isFlushing = true;
  notify();

  try {
    const now = Date.now();
    const due = queue.filter((a) => a.nextAttemptAt <= now);
    for (const action of due) {
      // Re-check before each send - a mid-flush disconnect should stop the
      // loop rather than burn through every remaining action's retry budget.
      if (!isOnline) break;
      try {
        await runAction(action);
        queue = queue.filter((a) => a.id !== action.id);
        await persist();
        notify();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error.';
        queue = queue.map((a) =>
          a.id === action.id
            ? {
                ...a,
                attempts: a.attempts + 1,
                lastError: message,
                nextAttemptAt: Date.now() + backoffFor(a.attempts + 1),
              }
            : a,
        );
        await persist();
        notify();
        // Stop the loop on the first failure - if the network just dropped
        // (as opposed to the server rejecting this specific action), the
        // remaining actions would fail identically and just burn attempts.
        break;
      }
    }
    // Actions that permanently fail (validation errors that will never
    // succeed on retry) are dropped after MAX_ATTEMPTS rather than kept
    // forever silently retrying in the background.
    queue = queue.filter((a) => a.attempts < MAX_ATTEMPTS);
    await persist();
  } finally {
    isFlushing = false;
    notify();
  }
}

function enqueue(kind: QueuedActionKind, token: string, payload: QueuedActionPayload): QueuedAction {
  const action: QueuedAction = {
    id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    token,
    payload,
    createdAt: Date.now(),
    attempts: 0,
    lastError: null,
    nextAttemptAt: 0,
  };
  queue = [...queue, action];
  persist();
  notify();
  flushOfflineQueue();
  return action;
}

export function enqueueOrphanReportSubmit(
  token: string,
  fields: OrphanReportSubmitPayload['fields'],
  photos: PickedPhoto[],
): QueuedAction {
  return enqueue('orphan_report_submit', token, { fields, photos });
}

export function enqueueTeacherOrphanReportSubmit(
  token: string,
  fields: TeacherOrphanReportSubmitPayload['fields'],
  photos: PickedPhoto[],
): QueuedAction {
  return enqueue('teacher_orphan_report_submit', token, { fields, photos });
}

export function enqueueAttendanceSubmit(
  token: string,
  sectionId: number,
  subjectId: number,
  date: string,
  records: AttendanceRecordInput[],
): QueuedAction {
  return enqueue('attendance_submit', token, { sectionId, subjectId, date, records });
}

export function enqueueAttendanceScan(
  token: string,
  sectionId: number,
  subjectId: number,
  date: string,
  code: string,
): QueuedAction {
  return enqueue('attendance_scan', token, { sectionId, subjectId, date, code });
}

export function getPendingCount(): number {
  return queue.length;
}

export function subscribeOfflineQueue(listener: Listener): () => void {
  listeners.add(listener);
  listener(snapshot());
  return () => listeners.delete(listener);
}

/** Call once at app start (see OfflineQueueContext). Safe to call more than once. */
export async function initOfflineQueue(): Promise<() => void> {
  await ensureLoaded();

  if (!netInfoUnsubscribe) {
    const state = await NetInfo.fetch();
    isOnline = !!state.isConnected && state.isInternetReachable !== false;
    notify();

    netInfoUnsubscribe = NetInfo.addEventListener((state) => {
      const wasOnline = isOnline;
      isOnline = !!state.isConnected && state.isInternetReachable !== false;
      notify();
      if (!wasOnline && isOnline) {
        flushOfflineQueue();
      }
    });
  }

  if (isOnline) flushOfflineQueue();

  return () => {
    netInfoUnsubscribe?.();
    netInfoUnsubscribe = null;
  };
}
