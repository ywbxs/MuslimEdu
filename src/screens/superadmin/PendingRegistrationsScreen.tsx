import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  FlatList,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  MapPin,
  Mail,
  Phone,
  Check,
  CircleCheck,
  CircleX,
  Clock,
  Inbox,
  Maximize2,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import {
  PendingRegistration,
  RegistrationStatus,
  SubscriptionSelection,
  fetchPendingSchoolRegistrations,
  approveSchoolRegistration,
  rejectSchoolRegistration,
} from '../../services/schoolRegistrationService';
import { Skeleton } from '../../components/Skeleton';
import PhotoLightbox from '../../components/PhotoLightbox';
import PressableScale from '../../components/PressableScale';
import { BRAND, COLORS, RADIUS, SHADOW } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
import { WizardStepHeader } from '../../components/wizard/WizardKit';

const EMERALD = COLORS.emerald;
const EMERALD_SOFT = COLORS.emeraldSoft;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const DANGER_SOFT = 'rgba(239,68,68,0.10)';
const AMBER_SOFT = 'rgba(180,83,9,0.10)';

// A brand surface colour and a readable brand *label* colour are not the same
// thing, and every label here was using the surface one. Measured against WCAG
// AA (4.5:1 at these text sizes): white on #1FAE64 is 2.9:1, #EF4444 on its own
// 10% tint is 3.3:1, #1FAE64 on its own 12% tint is 2.6:1 - all failing, the
// primary CTA worst of all. Labels now use the deep member of the same family;
// fills and tints keep the brand hue, so the palette is unchanged.
const EMERALD_INK = BRAND.emeraldDeep; // #0F7A3D - on 12% emerald 4.8:1, white on it 5.4:1
const DANGER_INK = '#B91C1C'; //          on 10% red     5.7:1, white on it 6.5:1
const AMBER_INK = '#92400E'; //           on 10% amber

const INSTITUTION_LABELS: Record<string, string> = {
  mahad: 'Mahad',
  madrasa: 'Madrasa',
  markaz: 'Markaz',
  regular_school: 'Regular School',
  orphanage: 'Orphan School',
};

// Pre-written reasons for the most common rejections, so the applicant gets
// something actionable back instead of a bare "rejected" - the backend has
// always stored a `reason` (see the school_registrations migration) and the
// service has always accepted one; this screen just never collected it.
const QUICK_REASONS = [
  'ID photo is unclear or unreadable',
  "Selfie doesn't match the ID document",
  'School details are incomplete',
  'Duplicate application',
];

interface SubscriptionTier {
  key: string;
  label: string;
  studentLimit: number | null; // null = unlimited
  tagline: string;
}

const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  { key: 'basic', label: 'Basic', studentLimit: 100, tagline: 'For schools just getting started' },
  { key: 'standard', label: 'Standard', studentLimit: 500, tagline: 'Most schools' },
  { key: 'premium', label: 'Premium', studentLimit: null, tagline: 'Unlimited students, full features' },
];

const DURATION_OPTIONS: { key: string; label: string; months: number }[] = [
  { key: '1m', label: '1 Month', months: 1 },
  { key: '6m', label: '6 Months', months: 6 },
  { key: '12m', label: '1 Year', months: 12 },
];

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

type TabKey = RegistrationStatus;
const TABS: { key: TabKey; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

type BusyState = { id: number; action: 'approve' | 'reject' } | null;
type ResultState =
  | { kind: 'approved'; row: PendingRegistration; subscription: SubscriptionSelection }
  | { kind: 'rejected'; row: PendingRegistration }
  | null;

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusChip({ status }: { status: RegistrationStatus }) {
  const meta =
    status === 'approved'
      ? { bg: EMERALD_SOFT, fg: EMERALD_INK, label: 'Approved', Icon: CircleCheck }
      : status === 'rejected'
      ? { bg: DANGER_SOFT, fg: DANGER_INK, label: 'Rejected', Icon: CircleX }
      : { bg: AMBER_SOFT, fg: AMBER_INK, label: 'Pending', Icon: Clock };
  const { Icon } = meta;
  return (
    <View style={[styles.statusChip, { backgroundColor: meta.bg }]}>
      <Icon size={12} color={meta.fg} strokeWidth={2.4} />
      <Text style={[styles.statusChipText, { color: meta.fg }]}>{meta.label}</Text>
    </View>
  );
}

function MetaRow({ Icon, text }: { Icon: typeof Mail; text: string }) {
  return (
    <View style={styles.metaRow}>
      <Icon size={13} color={SUBTLE} strokeWidth={2} />
      <Text style={styles.metaText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

function initialsOf(name: string): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Tappable proof photo. The caption rides on the image rather than sitting in
 * its own row beneath it - two stacked caption rows plus a section heading was
 * most of this card's height, for three words of text.
 */
function ProofThumb({ uri, label, onPress }: { uri: string; label: string; onPress: () => void }) {
  return (
    <PressableScale style={styles.proofSlot} scaleTo={0.97} onPress={onPress} accessibilityLabel={`Inspect ${label}`}>
      {/* PressableScale renders children in a transform-only Animated.View,
          so the clipping/stacking has to live on an inner wrapper. */}
      <View style={styles.proofInner}>
        <Image source={{ uri }} style={styles.proofImg} resizeMode="cover" />
        <View style={styles.proofPill}>
          <Text style={styles.proofPillText}>{label}</Text>
        </View>
        <View style={styles.proofExpand}>
          <Maximize2 size={11} color="#FFFFFF" strokeWidth={2.6} />
        </View>
      </View>
    </PressableScale>
  );
}

function RegistrationCard({
  item,
  onApprove,
  onReject,
  onViewPhoto,
  busy,
}: {
  item: PendingRegistration;
  onApprove: (item: PendingRegistration) => void;
  onReject: (item: PendingRegistration) => void;
  onViewPhoto: (photos: string[], index: number) => void;
  busy: BusyState;
}) {
  const photos = [item.id_document_url, item.selfie_url].filter(Boolean) as string[];
  const isBusy = busy?.id === item.id;
  const isPending = item.status === 'pending';

  return (
    <View style={[styles.card, isBusy && styles.cardBusy]}>
      <View style={styles.cardHeader}>
        <View style={styles.monogram}>
          <Text style={styles.monogramText}>{(item.school_name || '?').charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.flex1}>
          <View style={styles.titleRow}>
            <Text style={styles.schoolName} numberOfLines={2}>
              {item.school_name}
            </Text>
            <Text style={styles.date}>{formatDate(item.created_at)}</Text>
          </View>
          <View style={styles.chipRow}>
            <View style={styles.typeChip}>
              <Text style={styles.typeChipText}>
                {INSTITUTION_LABELS[item.institution_type] ?? item.institution_type}
              </Text>
            </View>
            {!isPending && <StatusChip status={item.status} />}
          </View>
          {!!item.school_address && (
            <View style={styles.addressRow}>
              <MapPin size={12} color={SUBTLE} strokeWidth={2} />
              <Text style={styles.addressText} numberOfLines={1}>
                {item.school_address}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.applicantPanel}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initialsOf(item.admin_name)}</Text>
        </View>
        <View style={styles.flex1}>
          <Text style={styles.applicantCaption}>Applying as admin</Text>
          <Text style={styles.applicantName} numberOfLines={1}>
            {item.admin_name}
          </Text>
          <View style={styles.metaStack}>
            <MetaRow Icon={Mail} text={item.admin_email} />
            {!!item.admin_phone && <MetaRow Icon={Phone} text={item.admin_phone} />}
          </View>
        </View>
      </View>

      {photos.length > 0 && (
        <View style={styles.proofRow}>
          {item.id_document_url && (
            <ProofThumb uri={item.id_document_url} label="ID" onPress={() => onViewPhoto(photos, 0)} />
          )}
          {item.selfie_url && (
            <ProofThumb
              uri={item.selfie_url}
              label="Selfie"
              onPress={() => onViewPhoto(photos, photos.length - 1)}
            />
          )}
        </View>
      )}

      {item.status === 'rejected' && !!item.reason && (
        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>Reason given</Text>
          <Text style={styles.reasonText}>{item.reason}</Text>
        </View>
      )}

      {/* Deliberately unequal. Two identical half-width blocks gave a
          destructive action the same pull as the primary one; the affirming
          action is wider and solid, the destructive one quiet but still
          unmistakably red. */}
      {isPending && (
        <View style={styles.actionRow}>
          <PressableScale
            style={[styles.actionBtn, styles.rejectBtn]}
            scaleTo={0.97}
            onPress={() => onReject(item)}
            disabled={isBusy}
            accessibilityRole="button"
            accessibilityLabel={`Reject ${item.school_name}`}
          >
            <View style={styles.btnInner}>
              {isBusy && busy?.action === 'reject' ? (
                <ActivityIndicator size="small" color={DANGER_INK} />
              ) : (
                <Text style={styles.rejectBtnText}>Reject</Text>
              )}
            </View>
          </PressableScale>
          <PressableScale
            style={[styles.actionBtn, styles.approveBtn]}
            scaleTo={0.97}
            onPress={() => onApprove(item)}
            disabled={isBusy}
            accessibilityRole="button"
            accessibilityLabel={`Approve ${item.school_name}`}
          >
            <View style={styles.btnInner}>
              {isBusy && busy?.action === 'approve' ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Check size={16} color="#FFFFFF" strokeWidth={3} />
                  <Text style={styles.approveBtnText}>Approve</Text>
                </>
              )}
            </View>
          </PressableScale>
        </View>
      )}
    </View>
  );
}

/** Approving mints a real School + a real login account, so it spells out
 *  exactly what is about to be created rather than a generic "are you sure".
 *  A 2-step wizard (reusing WizardStepHeader, same numbered-circle stepper
 *  every other wizard in the app uses) - confirm the account being created,
 *  then pick the subscription it starts on, so a freshly-approved school
 *  never lands on "no_subscription" with nobody having chosen a plan for it. */
function ApproveSheet({
  item,
  submitting,
  onConfirm,
  onClose,
}: {
  item: PendingRegistration | null;
  submitting: boolean;
  onConfirm: (subscription: SubscriptionSelection) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [tierKey, setTierKey] = useState('standard');
  const [durationKey, setDurationKey] = useState('12m');

  // Fresh wizard per application - otherwise the previous school's step/plan
  // choice is still showing when the next approval sheet opens.
  useEffect(() => {
    if (item) {
      setStep(1);
      setTierKey('standard');
      setDurationKey('12m');
    }
  }, [item]);

  const tier = SUBSCRIPTION_TIERS.find((t) => t.key === tierKey) ?? SUBSCRIPTION_TIERS[1];
  const duration = DURATION_OPTIONS.find((d) => d.key === durationKey) ?? DURATION_OPTIONS[2];
  const expireDate = isoDate(addMonths(new Date(), duration.months));

  const close = () => {
    if (submitting) return;
    onClose();
  };

  const confirmApprove = () => {
    onConfirm({ package: tier.label, studentLimit: tier.studentLimit, expireDate });
  };

  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.sheetBackdrop}>
        <TouchableOpacity style={styles.flex1} activeOpacity={1} onPress={close} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />

          <WizardStepHeader step={step} labels={['Confirm', 'Plan']} />

          {step === 1 ? (
            <>
              <View style={[styles.sheetIcon, { backgroundColor: EMERALD_SOFT }]}>
                <CircleCheck size={26} color={EMERALD_INK} strokeWidth={2} />
              </View>
              <Text style={styles.sheetTitle}>Approve this school?</Text>
              <Text style={styles.sheetBody}>This creates the school and an admin login immediately.</Text>

              <View style={styles.summaryBox}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryKey}>School</Text>
                  <Text style={styles.summaryVal} numberOfLines={1}>
                    {item?.school_name}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryKey}>Admin</Text>
                  <Text style={styles.summaryVal} numberOfLines={1}>
                    {item?.admin_name}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryKey}>Login</Text>
                  <Text style={styles.summaryVal} numberOfLines={1}>
                    {item?.admin_email}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.sheetTitle}>Choose a plan</Text>
              <Text style={styles.sheetBody} numberOfLines={2}>
                {item?.school_name} will start on this subscription.
              </Text>

              <View style={plan.tierList}>
                {SUBSCRIPTION_TIERS.map((t) => {
                  const active = t.key === tierKey;
                  return (
                    <PressableScale
                      key={t.key}
                      style={[plan.tierCard, active && plan.tierCardActive]}
                      scaleTo={0.98}
                      onPress={() => setTierKey(t.key)}
                    >
                      <View style={plan.tierHeaderRow}>
                        <Text style={[plan.tierLabel, active && plan.tierLabelActive]}>{t.label}</Text>
                        {active && <CircleCheck size={18} color={EMERALD_INK} strokeWidth={2.4} />}
                      </View>
                      <Text style={plan.tierLimit}>
                        {t.studentLimit === null ? 'Unlimited students' : `Up to ${t.studentLimit} students`}
                      </Text>
                      <Text style={plan.tierTagline}>{t.tagline}</Text>
                    </PressableScale>
                  );
                })}
              </View>

              <Text style={plan.durationLabel}>Duration</Text>
              <View style={plan.durationRow}>
                {DURATION_OPTIONS.map((d) => {
                  const active = d.key === durationKey;
                  return (
                    <TouchableOpacity
                      key={d.key}
                      style={[plan.durationChip, active && plan.durationChipActive]}
                      activeOpacity={0.85}
                      onPress={() => setDurationKey(d.key)}
                    >
                      <Text style={[plan.durationChipText, active && plan.durationChipTextActive]}>{d.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.summaryBox}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryKey}>Active until</Text>
                  <Text style={styles.summaryVal}>{formatShortDate(expireDate)}</Text>
                </View>
              </View>
            </>
          )}

          <View style={styles.sheetActions}>
            <TouchableOpacity
              style={[styles.sheetBtn, styles.sheetBtnGhost]}
              onPress={step === 1 ? close : () => setStep(1)}
              disabled={submitting}
            >
              <Text style={styles.sheetBtnGhostText}>{step === 1 ? 'Cancel' : 'Back'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetBtn, styles.sheetBtnPrimary]}
              onPress={step === 1 ? () => setStep(2) : confirmApprove}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.sheetBtnPrimaryText}>{step === 1 ? 'Next' : 'Approve & Activate'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Reject now captures the reason the backend has always had a column for. */
function RejectSheet({
  item,
  submitting,
  onConfirm,
  onClose,
}: {
  item: PendingRegistration | null;
  submitting: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');

  // Fresh sheet per application - otherwise the previous applicant's reason
  // is still sitting in the box when the next one is opened.
  const close = () => {
    setReason('');
    onClose();
  };

  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.sheetBackdrop}>
          <TouchableOpacity style={styles.flex1} activeOpacity={1} onPress={close} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={[styles.sheetIcon, { backgroundColor: DANGER_SOFT }]}>
              <CircleX size={26} color={DANGER_INK} strokeWidth={2} />
            </View>
            <Text style={styles.sheetTitle}>Reject {item?.school_name}?</Text>
            <Text style={styles.sheetBody}>Tell them why, so they can correct it and reapply.</Text>

            <ScrollView keyboardShouldPersistTaps="handled" style={styles.reasonScroll}>
              <View style={styles.quickWrap}>
                {QUICK_REASONS.map((r) => {
                  const active = reason === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      style={[styles.quickChip, active && styles.quickChipActive]}
                      activeOpacity={0.8}
                      onPress={() => setReason(active ? '' : r)}
                    >
                      <Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>{r}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TextInput
                style={styles.reasonInput}
                value={reason}
                onChangeText={setReason}
                placeholder="Or write your own reason (optional)"
                placeholderTextColor={SUBTLE}
                multiline
                maxLength={300}
              />
            </ScrollView>

            <View style={styles.sheetActions}>
              <TouchableOpacity style={[styles.sheetBtn, styles.sheetBtnGhost]} onPress={close} disabled={submitting}>
                <Text style={styles.sheetBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetBtn, styles.sheetBtnDanger]}
                onPress={() => onConfirm(reason.trim())}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.sheetBtnPrimaryText}>Reject</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** The "what just happened" step the old flow was missing entirely - the card
 *  simply vanished, with no confirmation that an account had been created. */
function ResultSheet({ result, onClose }: { result: ResultState; onClose: () => void }) {
  const approved = result?.kind === 'approved';
  return (
    <Modal visible={!!result} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.resultBackdrop}>
        <View style={styles.resultCard}>
          <View style={[styles.sheetIcon, { backgroundColor: approved ? EMERALD_SOFT : DANGER_SOFT }]}>
            {approved ? (
              <CircleCheck size={30} color={EMERALD_INK} strokeWidth={2} />
            ) : (
              <CircleX size={30} color={DANGER_INK} strokeWidth={2} />
            )}
          </View>

          <Text style={styles.sheetTitle}>{approved ? 'School approved' : 'Application rejected'}</Text>

          {approved ? (
            <>
              <Text style={styles.sheetBody}>
                {result?.row.school_name} is live. Its admin can sign in right now with the password from their
                application.
              </Text>
              <View style={styles.summaryBox}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryKey}>Login</Text>
                  <Text style={styles.summaryVal} numberOfLines={1}>
                    {result?.row.admin_email}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryKey}>Plan</Text>
                  <Text style={styles.summaryVal} numberOfLines={1}>
                    {result?.kind === 'approved' ? result.subscription.package : ''}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryKey}>Until</Text>
                  <Text style={styles.summaryVal} numberOfLines={1}>
                    {result?.kind === 'approved' ? formatShortDate(result.subscription.expireDate) : ''}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.sheetBody}>
                {result?.row.school_name} was not approved. It's saved under the Rejected tab.
              </Text>
              {!!result?.row.reason && (
                <View style={styles.reasonBox}>
                  <Text style={styles.reasonLabel}>Reason given</Text>
                  <Text style={styles.reasonText}>{result.row.reason}</Text>
                </View>
              )}
            </>
          )}

          <TouchableOpacity style={[styles.sheetBtn, styles.sheetBtnPrimary, styles.resultBtn]} onPress={onClose}>
            <Text style={styles.sheetBtnPrimaryText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Superadmin review queue for "Register Your School" self-service signups
 * (SchoolRegistrationScreen.tsx). An application is only a row in
 * `school_registrations` until it's approved here - approving creates the
 * real School + admin User server-side, so the admin can log in immediately.
 *
 * The list endpoint returns every application regardless of status, so the
 * Approved/Rejected tabs are a free audit trail of past decisions rather
 * than an extra round trip.
 */
export default function PendingRegistrationsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();

  const [rows, setRows] = useState<PendingRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<TabKey>('pending');
  const [busy, setBusy] = useState<BusyState>(null);
  const [approveTarget, setApproveTarget] = useState<PendingRegistration | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingRegistration | null>(null);
  const [result, setResult] = useState<ResultState>(null);
  const [lightbox, setLightbox] = useState<{ photos: string[]; index: number } | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setRows(await fetchPendingSchoolRegistrations(token));
    } catch (err: any) {
      Alert.alert("Couldn't load applications", err?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const counts = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }),
        {} as Record<RegistrationStatus, number>,
      ),
    [rows],
  );
  const visible = useMemo(() => rows.filter((r) => r.status === tab), [rows, tab]);

  // Both decisions follow the same shape: keep the row on screen while the
  // request is in flight, then fold the server's own updated copy back into
  // the list. The old flow removed the card up front and re-fetched on
  // failure, so a failed call looked identical to a successful one until the
  // list happened to reload.
  const decide = async (
    item: PendingRegistration,
    action: 'approve' | 'reject',
    run: () => Promise<PendingRegistration>,
    subscription?: SubscriptionSelection,
  ) => {
    if (!token) return;
    setBusy({ id: item.id, action });
    try {
      const updated = await run();
      setRows((prev) => prev.map((r) => (r.id === item.id ? updated : r)));
      setApproveTarget(null);
      setRejectTarget(null);
      setResult(
        action === 'approve'
          ? { kind: 'approved', row: updated, subscription: subscription! }
          : { kind: 'rejected', row: updated },
      );
    } catch (err: any) {
      Alert.alert(
        action === 'approve' ? "Couldn't approve" : "Couldn't reject",
        err?.message ?? 'Please try again.',
      );
    } finally {
      setBusy(null);
    }
  };

  const emptyCopy: Record<TabKey, string> = {
    pending: 'No applications waiting for review.',
    approved: 'No approved applications yet.',
    rejected: 'No rejected applications.',
  };

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.headerBtn}>
          <ChevronLeft size={22} color={INK} strokeWidth={2.1} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>School Applications</Text>
        <View style={styles.headerBtn} />
      </View>

      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const active = t.key === tab;
          const n = counts[t.key] ?? 0;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, active && styles.tabActive]}
              activeOpacity={0.85}
              onPress={() => setTab(t.key)}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
              {n > 0 && (
                <View style={[styles.tabCount, active && styles.tabCountActive]}>
                  <Text style={[styles.tabCountText, active && styles.tabCountTextActive]}>{n}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={EMERALD}
            colors={[EMERALD]}
          />
        }
        renderItem={({ item }) => (
          <RegistrationCard
            item={item}
            busy={busy}
            onApprove={setApproveTarget}
            onReject={setRejectTarget}
            onViewPhoto={(photos, index) => setLightbox({ photos, index })}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.gapCol}>
              <Skeleton width="100%" height={230} borderRadius={RADIUS.lg} />
              <Skeleton width="100%" height={230} borderRadius={RADIUS.lg} />
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Inbox size={26} color={SUBTLE} strokeWidth={1.8} />
              </View>
              <Text style={styles.emptyText}>{emptyCopy[tab]}</Text>
            </View>
          )
        }
      />

      <ApproveSheet
        item={approveTarget}
        submitting={busy?.action === 'approve'}
        onClose={() => setApproveTarget(null)}
        onConfirm={(subscription) =>
          approveTarget &&
          decide(
            approveTarget,
            'approve',
            () => approveSchoolRegistration(token!, approveTarget.id, subscription),
            subscription,
          )
        }
      />

      <RejectSheet
        item={rejectTarget}
        submitting={busy?.action === 'reject'}
        onClose={() => setRejectTarget(null)}
        onConfirm={(reason) =>
          rejectTarget &&
          decide(rejectTarget, 'reject', () =>
            rejectSchoolRegistration(token!, rejectTarget.id, reason || undefined),
          )
        }
      />

      <ResultSheet result={result} onClose={() => setResult(null)} />

      <PhotoLightbox
        visible={!!lightbox}
        photos={lightbox?.photos ?? []}
        initialIndex={lightbox?.index ?? 0}
        onClose={() => setLightbox(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.canvas },
  flex1: { flex: 1 },
  gap: { height: 14 },
  gapCol: { gap: 14 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  headerBtn: { width: 30 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: INK },

  tabBar: {
    flexDirection: 'row',
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 4,
    padding: 4,
    backgroundColor: 'rgba(17,24,39,0.05)',
    borderRadius: RADIUS.pill,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: RADIUS.pill,
  },
  tabActive: { backgroundColor: '#FFFFFF', ...SHADOW.level1 },
  tabText: { fontSize: 13, fontWeight: '600', color: SUBTLE },
  tabTextActive: { color: INK, fontWeight: '800' },
  tabCount: {
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17,24,39,0.09)',
  },
  tabCountActive: { backgroundColor: EMERALD },
  tabCountText: { fontSize: 10.5, fontWeight: '800', color: SUBTLE },
  tabCountTextActive: { color: '#FFFFFF' },

  list: { padding: 16, paddingBottom: 40 },

  emptyWrap: { alignItems: 'center', paddingTop: 70 },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(17,24,39,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyText: { fontSize: 13.5, color: SUBTLE, textAlign: 'center' },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.05)',
    ...SHADOW.level1,
  },
  cardBusy: { opacity: 0.6 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  monogram: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: { fontSize: 19, fontWeight: '800', color: EMERALD_INK },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  schoolName: { flex: 1, fontSize: 17, fontWeight: '800', color: INK, lineHeight: 22 },
  chipRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 7 },
  typeChip: {
    backgroundColor: EMERALD_SOFT,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  typeChipText: { fontSize: 11, fontWeight: '700', color: EMERALD_INK },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusChipText: { fontSize: 11, fontWeight: '700' },
  date: { fontSize: 11.5, color: SUBTLE, fontWeight: '600', marginTop: 2 },

  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7 },
  addressText: { flex: 1, fontSize: 12.5, color: SUBTLE },

  // Tinted panel instead of a heading + divider: the grouping is carried by
  // the surface, which costs no vertical space.
  applicantPanel: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    padding: 13,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(17,24,39,0.035)',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: '800', color: SUBTLE },
  applicantCaption: { fontSize: 11, color: SUBTLE, fontWeight: '600' },
  applicantName: { fontSize: 15, fontWeight: '800', color: INK, marginTop: 1 },
  metaStack: { gap: 4, marginTop: 7 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { flex: 1, fontSize: 12.5, color: SUBTLE },

  proofRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  proofSlot: { flex: 1 },
  proofInner: { borderRadius: RADIUS.sm, overflow: 'hidden', backgroundColor: '#EDEFF2' },
  proofImg: { width: '100%', height: 118 },
  proofPill: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
    backgroundColor: 'rgba(17,24,39,0.68)',
  },
  proofPillText: { fontSize: 10.5, fontWeight: '700', color: '#FFFFFF' },
  proofExpand: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(17,24,39,0.68)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  reasonBox: {
    marginTop: 14,
    backgroundColor: 'rgba(17,24,39,0.04)',
    borderRadius: RADIUS.sm,
    padding: 12,
  },
  reasonLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: SUBTLE,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  reasonText: { fontSize: 13, color: INK, lineHeight: 18 },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  // Fixed height, so swapping the label for a spinner can't nudge the layout.
  actionBtn: {
    height: 50,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Lives on an inner View, not the button itself - see ProofThumb's comment.
  btnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  rejectBtn: { flex: 1, backgroundColor: DANGER_SOFT },
  // Slightly positive tracking: small type reads too tight without it.
  rejectBtnText: { color: DANGER_INK, fontWeight: '700', fontSize: 15, letterSpacing: 0.2 },
  approveBtn: { flex: 1.5, backgroundColor: EMERALD_INK },
  approveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15, letterSpacing: 0.2 },

  // --- sheets ---
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(17,20,23,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: 22,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    alignItems: 'center',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DADDE1',
    marginTop: 10,
    marginBottom: 18,
  },
  sheetIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: INK, textAlign: 'center' },
  sheetBody: { fontSize: 13.5, color: SUBTLE, textAlign: 'center', lineHeight: 19, marginTop: 8 },

  summaryBox: {
    width: '100%',
    backgroundColor: 'rgba(17,24,39,0.04)',
    borderRadius: RADIUS.md,
    padding: 14,
    marginTop: 18,
    gap: 10,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryKey: { width: 58, fontSize: 12, fontWeight: '700', color: SUBTLE },
  summaryVal: { flex: 1, fontSize: 13.5, fontWeight: '700', color: INK, textAlign: 'right' },

  reasonScroll: { width: '100%', maxHeight: 260, marginTop: 16 },
  quickWrap: { gap: 8 },
  quickChip: {
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  quickChipActive: { borderColor: DANGER_INK, backgroundColor: DANGER_SOFT },
  quickChipText: { fontSize: 13, color: INK, fontWeight: '600' },
  quickChipTextActive: { color: DANGER_INK, fontWeight: '700' },
  reasonInput: {
    marginTop: 10,
    marginBottom: 4,
    minHeight: 74,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(17,24,39,0.04)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13.5,
    color: INK,
    textAlignVertical: 'top',
  },

  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 20, width: '100%' },
  sheetBtn: {
    flex: 1,
    height: 52,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBtnGhost: { backgroundColor: 'rgba(17,24,39,0.06)' },
  sheetBtnGhostText: { color: INK, fontWeight: '700', fontSize: 15, letterSpacing: 0.2 },
  sheetBtnPrimary: { backgroundColor: EMERALD_INK },
  sheetBtnPrimaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15, letterSpacing: 0.2 },
  sheetBtnDanger: { backgroundColor: DANGER_INK },

  resultBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,20,23,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 26,
  },
  resultCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    padding: 24,
    alignItems: 'center',
    ...SHADOW.level3,
  },
  resultBtn: { flex: 0, alignSelf: 'stretch', marginTop: 20 },
});

const plan = StyleSheet.create({
  tierList: { width: '100%', gap: 10, marginTop: 18 },
  tierCard: {
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 14,
  },
  tierCardActive: { borderColor: EMERALD_INK, backgroundColor: EMERALD_SOFT },
  tierHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tierLabel: { fontSize: 15, fontWeight: '800', color: INK },
  tierLabelActive: { color: EMERALD_INK },
  tierLimit: { fontSize: 12.5, fontWeight: '700', color: SUBTLE, marginTop: 4 },
  tierTagline: { fontSize: 12, color: SUBTLE, marginTop: 2 },

  durationLabel: {
    width: '100%',
    fontSize: 11,
    fontWeight: '800',
    color: SUBTLE,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 18,
    marginBottom: 8,
  },
  durationRow: { width: '100%', flexDirection: 'row', gap: 8 },
  durationChip: {
    flex: 1,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingVertical: 10,
    alignItems: 'center',
  },
  durationChipActive: { borderColor: EMERALD_INK, backgroundColor: EMERALD_SOFT },
  durationChipText: { fontSize: 13, fontWeight: '700', color: SUBTLE },
  durationChipTextActive: { color: EMERALD_INK },
});
