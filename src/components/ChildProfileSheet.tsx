import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { X, ChevronRight, Mail, Phone, Heart, GraduationCap, User, IdCard, FileText, ClipboardList, Pencil } from 'lucide-react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useAuth } from '../context/AuthContext';
import { isOrphanSchoolUser } from '../utils/orphanSchool';
import {
  fetchChildProfile,
  updateOrphanProfile,
  updateChildBasicProfile,
  ChildProfile,
  ChildStatus,
  StudentSummary,
  OrphanProfileFields,
  BasicProfileFields,
} from '../services/adminService';
import { Skeleton, SkeletonCircle } from './Skeleton';
import UserAvatar from './UserAvatar';
import { COLORS, BRAND } from '../theme/glass';

const EMERALD = BRAND.emerald;
const EMERALD_SOFT = COLORS.emeraldSoft;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const HAIRLINE = COLORS.border;
const CANVAS = COLORS.canvas;
const DANGER = COLORS.danger;
const DANGER_SOFT = 'rgba(239,68,68,0.1)';
const AMBER = '#C88A11';
const AMBER_SOFT = '#FBF1DD';

const STATUS_COLORS: Record<ChildStatus, { dot: string; chipBg: string; chipText: string; label: string }> = {
  active: { dot: EMERALD, chipBg: EMERALD_SOFT, chipText: EMERALD, label: 'Active' },
  pending: { dot: AMBER, chipBg: AMBER_SOFT, chipText: AMBER, label: 'Pending' },
  inactive: { dot: DANGER, chipBg: DANGER_SOFT, chipText: DANGER, label: 'Inactive' },
};

function formatJoined(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// --- Icons ---------------------------------------------------------------
function IconClose({ color }: { color: string }) {
  return <X color={color} size={18} strokeWidth={2.2} />;
}
function IconChevronRight({ color }: { color: string }) {
  return <ChevronRight color={color} size={20} strokeWidth={2.2} />;
}
function IconMail({ color }: { color: string }) {
  return <Mail color={color} size={15} strokeWidth={2} />;
}
function IconPhone({ color }: { color: string }) {
  return <Phone color={color} size={15} strokeWidth={2} />;
}
function IconHeart({ color }: { color: string }) {
  return <Heart color={color} size={15} strokeWidth={2} />;
}
function IconCap({ color }: { color: string }) {
  return <GraduationCap color={color} size={15} strokeWidth={2} />;
}
function IconUser({ color }: { color: string }) {
  return <User color={color} size={15} strokeWidth={2} />;
}
function IconIdCard({ color }: { color: string }) {
  return <IdCard color={color} size={15} strokeWidth={2} />;
}
function IconDocument({ color }: { color: string }) {
  return <FileText color={color} size={20} strokeWidth={1.8} />;
}
function IconReport({ color }: { color: string }) {
  return <ClipboardList color={color} size={20} strokeWidth={1.8} />;
}
function IconPencil({ color }: { color: string }) {
  return <Pencil color={color} size={15} strokeWidth={1.8} />;
}

// --- Action modal: Profile / Documents / Monthly Report -------------------
export function ChildActionModal({
  visible,
  child,
  onClose,
  onSelect,
}: {
  visible: boolean;
  child: StudentSummary | null;
  onClose: () => void;
  onSelect: (action: 'profile' | 'documents' | 'report') => void;
}) {
  const options: { key: 'profile' | 'documents' | 'report'; label: string; desc: string; icon: (c: string) => React.ReactElement }[] = [
    { key: 'profile', label: 'Profile', desc: 'View contact info and role details', icon: (c) => <IconIdCard color={c} /> },
    { key: 'documents', label: 'Documents', desc: 'ID, certificates, and other files', icon: (c) => <IconDocument color={c} /> },
    { key: 'report', label: 'Monthly Report', desc: 'View this child\u2019s report history', icon: (c) => <IconReport color={c} /> },
  ];
  const status: ChildStatus = child?.status ?? 'active';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <TouchableOpacity style={styles.sheetBackdropTouch} activeOpacity={1} onPress={onClose} />
        <View style={styles.actionSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeaderRow}>
            <View style={[styles.flex1, { flexDirection: 'row', alignItems: 'center' }]}>
              <UserAvatar name={child?.name ?? ''} photo={child?.photo} size={38} ringColor={HAIRLINE} dotColor={STATUS_COLORS[status].dot} />
              <Text style={styles.actionSheetTitle} numberOfLines={1}>{child?.name ?? ''}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.sheetCloseBtn}>
              <IconClose color={SUBTLE} />
            </TouchableOpacity>
          </View>

          {options.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() => onSelect(opt.key)}
            >
              <View style={styles.actionIconWrap}>{opt.icon(EMERALD)}</View>
              <View style={styles.flex1}>
                <Text style={styles.actionLabel}>{opt.label}</Text>
                <Text style={styles.actionDesc}>{opt.desc}</Text>
              </View>
              <IconChevronRight color="#C4C9CF" />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>{icon}</View>
      <View style={styles.flex1}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function EditField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  secureTextEntry,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'words' | 'sentences';
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.editLabel}>{label}</Text>
      <TextInput
        style={[styles.editInput, multiline && styles.editInputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={SUBTLE}
        multiline={multiline}
        keyboardType={keyboardType ?? 'default'}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize ?? 'sentences'}
      />
    </View>
  );
}

function parseDateValue(value: string): Date {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function formatDateValue(date: Date): string {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD - matches what the backend already expects
}

// Native date picker instead of a typed "YYYY-MM-DD" text field - a typed
// date invites malformed values the backend can't parse. Android's picker is
// a self-dismissing dialog; iOS's spinner stays open until "Done" is tapped.
function DateField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShow(false);
      if (event.type === 'set' && selectedDate) {
        onChange(formatDateValue(selectedDate));
      }
      return;
    }
    if (selectedDate) onChange(formatDateValue(selectedDate));
  };

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.editLabel}>{label}</Text>
      <TouchableOpacity style={styles.editInput} onPress={() => setShow(true)} activeOpacity={0.7}>
        <Text style={{ fontSize: 14.5, color: value ? INK : SUBTLE }}>
          {value || placeholder || 'Select date'}
        </Text>
      </TouchableOpacity>
      {show ? (
        <View style={Platform.OS === 'ios' ? styles.iosPickerWrap : undefined}>
          <DateTimePicker
            value={parseDateValue(value)}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={new Date()}
            onChange={handleChange}
          />
          {Platform.OS === 'ios' ? (
            <TouchableOpacity style={styles.iosPickerDone} onPress={() => setShow(false)} activeOpacity={0.85}>
              <Text style={styles.iosPickerDoneText}>Done</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

type EditableFields = {
  name: string;
  email: string;
  phone: string;
  address: string;
  gender: string;
  birthday: string;
  password: string;
  guardian_name: string;
  guardian_relation: string;
  guardian_phone: string;
  health_status: string;
  special_needs: string;
  admission_date: string;
  admission_reason: string;
};

const emptyEditable: EditableFields = {
  name: '',
  email: '',
  phone: '',
  address: '',
  gender: '',
  birthday: '',
  password: '',
  guardian_name: '',
  guardian_relation: '',
  guardian_phone: '',
  health_status: '',
  special_needs: '',
  admission_date: '',
  admission_reason: '',
};

/**
 * A child's full profile: contact info, class, orphan ID, and (for orphan
 * schools) guardian / health / admission details.
 *
 * `canEdit` gates the pencil button in the header. When it's on and the
 * admin taps it, the guardian/health/admission section switches to editable
 * TextInputs and Save calls POST /admin_child_orphan_profile_update - the
 * only profile-edit endpoint currently confirmed on the backend. Core
 * identity fields (name, email, phone, class, orphan ID) stay read-only
 * labels either way: there's no confirmed endpoint yet for editing those,
 * so exposing inputs for them would just fail silently or 404 on save.
 * Teachers always get `canEdit={false}` - view only, no pencil button at all.
 */
export function ChildProfileSheet({
  visible,
  studentId,
  fallback,
  onClose,
  canEdit = false,
}: {
  visible: boolean;
  studentId: number | null;
  fallback: StudentSummary | null;
  onClose: () => void;
  canEdit?: boolean;
}) {
  const { token, user } = useAuth();
  const isOrphanSchool = isOrphanSchoolUser(user);
  const navigation = useNavigation();
  const [profile, setProfile] = useState<ChildProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fields, setFields] = useState<EditableFields>(emptyEditable);

  useEffect(() => {
    if (!visible || !studentId || !token) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setProfile(null);
    setIsEditing(false);
    fetchChildProfile(token, studentId)
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
        setFields({
          name: data.name ?? '',
          email: data.email ?? '',
          phone: data.phone ?? '',
          address: data.address ?? '',
          gender: data.gender ?? '',
          birthday: data.birthday ?? '',
          password: '',
          guardian_name: data.orphan_profile?.guardian_name ?? '',
          guardian_relation: data.orphan_profile?.guardian_relation ?? '',
          guardian_phone: data.orphan_profile?.guardian_phone ?? '',
          health_status: data.orphan_profile?.health_status ?? '',
          special_needs: data.orphan_profile?.special_needs ?? '',
          admission_date: data.orphan_profile?.admission_date ?? '',
          admission_reason: data.orphan_profile?.admission_reason ?? '',
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load profile.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, studentId, token]);

  const handleClose = () => {
    if (isSaving) return;
    setIsEditing(false);
    onClose();
  };

  const handleViewReport = () => {
    if (!studentId) return;
    onClose();
    (navigation as any).navigate('StudentReport', { studentId });
  };

  const handleSave = async () => {
    if (!token || !studentId) return;
    if (!fields.name.trim() || !fields.email.trim()) {
      Alert.alert('Missing info', 'Name and email are required.');
      return;
    }
    setIsSaving(true);
    try {
      const basicFields: BasicProfileFields = {
        name: fields.name.trim(),
        email: fields.email.trim(),
        phone: fields.phone.trim(),
        address: fields.address.trim(),
        gender: fields.gender.trim(),
        birthday: fields.birthday.trim(),
      };
      if (fields.password.trim()) {
        basicFields.password = fields.password.trim();
      }
      // Guardian/health/admission fields are orphan-school only - a regular
      // school never shows that section (see isEditing below), so there's
      // nothing to save here and no reason to touch that endpoint at all.
      const orphanFields: OrphanProfileFields | null = isOrphanSchool
        ? {
            guardian_name: fields.guardian_name.trim(),
            guardian_relation: fields.guardian_relation.trim(),
            guardian_phone: fields.guardian_phone.trim(),
            health_status: fields.health_status.trim(),
            special_needs: fields.special_needs.trim(),
            admission_date: fields.admission_date.trim(),
            admission_reason: fields.admission_reason.trim(),
          }
        : null;
      await Promise.all([
        updateChildBasicProfile(token, studentId, basicFields),
        ...(orphanFields ? [updateOrphanProfile(token, studentId, orphanFields)] : []),
      ]);
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              ...basicFields,
              ...(orphanFields ? { orphan_profile: { ...prev.orphan_profile, ...orphanFields } as any } : {}),
            }
          : prev,
      );
      setFields((p) => ({ ...p, password: '' }));
      setIsEditing(false);
      Alert.alert('Saved', 'The profile has been updated.');
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const person = profile ?? fallback;
  const status: ChildStatus = person?.status ?? 'active';
  const joined = formatJoined(person?.joined_date);
  const orphanProfile = profile?.orphan_profile;
  const hasOrphanInfo = !!(
    orphanProfile &&
    (orphanProfile.guardian_name ||
      orphanProfile.guardian_phone ||
      orphanProfile.health_status ||
      orphanProfile.special_needs ||
      orphanProfile.admission_reason)
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.sheetBackdrop}>
        <TouchableOpacity style={styles.sheetBackdropTouch} activeOpacity={1} onPress={handleClose} />
        <View style={styles.profileSheet}>
          <View style={styles.sheetHandle} />

          {isLoading && !person ? (
            <View style={styles.profileLoadingWrap}>
              <SkeletonCircle size={72} style={{ marginBottom: 14 }} />
              <Skeleton width="50%" height={16} style={{ marginBottom: 8 }} />
              <Skeleton width="65%" height={12} />
            </View>
          ) : person ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.profileScrollContent} keyboardShouldPersistTaps="handled">
              <View style={styles.profileTopRow}>
                {canEdit && !isEditing ? (
                  <TouchableOpacity onPress={() => setIsEditing(true)} hitSlop={10} style={styles.editBtn}>
                    <IconPencil color={EMERALD} />
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                ) : (
                  <View />
                )}
                <TouchableOpacity onPress={handleClose} hitSlop={12} style={styles.profileCloseBtn}>
                  <IconClose color={SUBTLE} />
                </TouchableOpacity>
              </View>

              <View style={styles.profileHeaderCol}>
                <UserAvatar name={person.name} photo={person.photo} size={76} dotColor={STATUS_COLORS[status].dot} />
                <Text style={styles.profileName}>{person.name}</Text>
                <View style={[styles.statusChip, { backgroundColor: STATUS_COLORS[status].chipBg }]}>
                  <View style={[styles.statusChipDot, { backgroundColor: STATUS_COLORS[status].dot }]} />
                  <Text style={[styles.statusChipText, { color: STATUS_COLORS[status].chipText }]}>
                    {STATUS_COLORS[status].label}
                  </Text>
                </View>
              </View>

              {error ? <Text style={styles.profileErrorText}>{error} - showing what's on hand.</Text> : null}

              <View style={styles.profileSection}>
                <InfoRow icon={<IconMail color={SUBTLE} />} label="Email" value={person.email || '—'} />
                {person.phone ? <InfoRow icon={<IconPhone color={SUBTLE} />} label="Phone" value={person.phone} /> : null}
                {profile?.address ? <InfoRow icon={<IconUser color={SUBTLE} />} label="Address" value={profile.address} /> : null}
                {profile?.gender ? <InfoRow icon={<IconUser color={SUBTLE} />} label="Gender" value={profile.gender} /> : null}
                {profile?.birthday ? <InfoRow icon={<IconCap color={SUBTLE} />} label="Birthday" value={profile.birthday} /> : null}
                {joined ? <InfoRow icon={<IconCap color={SUBTLE} />} label="Joined" value={joined} /> : null}
                {person.orphan_id_number ? (
                  <InfoRow icon={<IconIdCard color={SUBTLE} />} label="Orphan ID" value={person.orphan_id_number} />
                ) : null}
                {profile?.class_name || profile?.section_name ? (
                  <InfoRow
                    icon={<IconCap color={SUBTLE} />}
                    label="Class"
                    value={[profile?.class_name, profile?.section_name].filter(Boolean).join(' · ')}
                  />
                ) : null}
              </View>

              {canEdit ? (
                <TouchableOpacity style={styles.reportBtn} onPress={handleViewReport} activeOpacity={0.85}>
                  <IconReport color={EMERALD} />
                  <Text style={styles.reportBtnText}>View Full Report</Text>
                </TouchableOpacity>
              ) : null}

              {isEditing ? (
                <View style={styles.profileSection}>
                  <Text style={styles.profileSectionLabel}>Basic info</Text>
                  <EditField label="Name" value={fields.name} onChangeText={(v) => setFields((p) => ({ ...p, name: v }))} />
                  <EditField label="Email" value={fields.email} onChangeText={(v) => setFields((p) => ({ ...p, email: v }))} keyboardType="email-address" autoCapitalize="none" />
                  <EditField label="Phone" value={fields.phone} onChangeText={(v) => setFields((p) => ({ ...p, phone: v }))} keyboardType="phone-pad" />
                  <EditField label="Address" value={fields.address} onChangeText={(v) => setFields((p) => ({ ...p, address: v }))} />
                  <EditField label="Gender" value={fields.gender} onChangeText={(v) => setFields((p) => ({ ...p, gender: v }))} placeholder="male / female" autoCapitalize="none" />
                  <DateField label="Birthday" value={fields.birthday} onChange={(v) => setFields((p) => ({ ...p, birthday: v }))} placeholder="Select date of birth" />
                  <EditField label="New Password" value={fields.password} onChangeText={(v) => setFields((p) => ({ ...p, password: v }))} placeholder="Leave blank to keep current password" secureTextEntry autoCapitalize="none" />

                  {isOrphanSchool ? (
                    <>
                      <Text style={[styles.profileSectionLabel, { marginTop: 4 }]}>Guardian & care details</Text>
                      <EditField label="Guardian name" value={fields.guardian_name} onChangeText={(v) => setFields((p) => ({ ...p, guardian_name: v }))} />
                      <EditField label="Guardian relation" value={fields.guardian_relation} onChangeText={(v) => setFields((p) => ({ ...p, guardian_relation: v }))} placeholder="e.g. Uncle, Grandmother" />
                      <EditField label="Guardian phone" value={fields.guardian_phone} onChangeText={(v) => setFields((p) => ({ ...p, guardian_phone: v }))} />
                      <EditField label="Health status" value={fields.health_status} onChangeText={(v) => setFields((p) => ({ ...p, health_status: v }))} />
                      <EditField label="Special needs" value={fields.special_needs} onChangeText={(v) => setFields((p) => ({ ...p, special_needs: v }))} />
                      <DateField label="Admission date" value={fields.admission_date} onChange={(v) => setFields((p) => ({ ...p, admission_date: v }))} placeholder="Select admission date" />
                      <EditField label="Admission reason" value={fields.admission_reason} onChangeText={(v) => setFields((p) => ({ ...p, admission_reason: v }))} multiline />
                    </>
                  ) : null}

                  <View style={styles.editActionsRow}>
                    <TouchableOpacity
                      style={[styles.editActionBtn, styles.editActionBtnGhost]}
                      onPress={() => setIsEditing(false)}
                      disabled={isSaving}
                    >
                      <Text style={styles.editActionBtnGhostText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.editActionBtn, styles.editActionBtnPrimary]}
                      onPress={handleSave}
                      disabled={isSaving}
                    >
                      {isSaving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.editActionBtnPrimaryText}>Save</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  {hasOrphanInfo && (orphanProfile?.guardian_name || orphanProfile?.guardian_phone) ? (
                    <View style={styles.profileSection}>
                      <Text style={styles.profileSectionLabel}>Guardian</Text>
                      {orphanProfile?.guardian_name ? (
                        <InfoRow icon={<IconUser color={SUBTLE} />} label={orphanProfile.guardian_relation ?? 'Guardian'} value={orphanProfile.guardian_name} />
                      ) : null}
                      {orphanProfile?.guardian_phone ? (
                        <InfoRow icon={<IconPhone color={SUBTLE} />} label="Guardian phone" value={orphanProfile.guardian_phone} />
                      ) : null}
                    </View>
                  ) : null}

                  {hasOrphanInfo && (orphanProfile?.health_status || orphanProfile?.special_needs) ? (
                    <View style={styles.profileSection}>
                      <Text style={styles.profileSectionLabel}>Health & wellbeing</Text>
                      {orphanProfile?.health_status ? (
                        <InfoRow icon={<IconHeart color={SUBTLE} />} label="Health status" value={orphanProfile.health_status} />
                      ) : null}
                      {orphanProfile?.special_needs ? (
                        <InfoRow icon={<IconHeart color={SUBTLE} />} label="Special needs" value={orphanProfile.special_needs} />
                      ) : null}
                    </View>
                  ) : null}

                  {orphanProfile?.admission_reason ? (
                    <View style={styles.profileSection}>
                      <Text style={styles.profileSectionLabel}>Admission note</Text>
                      <Text style={styles.profileNoteText}>{orphanProfile.admission_reason}</Text>
                    </View>
                  ) : null}

                  {canEdit && isOrphanSchool && !hasOrphanInfo ? (
                    <View style={styles.profileSection}>
                      <Text style={styles.profileNoteText}>
                        No guardian or care details on file yet. Tap Edit above to add them.
                      </Text>
                    </View>
                  ) : null}
                </>
              )}
            </ScrollView>
          ) : (
            <View style={styles.profileLoadingWrap}>
              <Text style={styles.profileErrorText}>{error ?? 'No profile found.'}</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(17,20,23,0.4)', justifyContent: 'flex-end' },
  sheetBackdropTouch: { flex: 1 },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DADDE1',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  sheetCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: CANVAS,
    alignItems: 'center',
    justifyContent: 'center',
  },

  actionSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    paddingHorizontal: 20,
  },
  actionSheetTitle: { fontSize: 16, fontWeight: '700', color: INK, marginLeft: 10, flexShrink: 1 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
    gap: 12,
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { fontSize: 15, fontWeight: '700', color: INK },
  actionDesc: { fontSize: 12, color: SUBTLE, marginTop: 2 },

  profileSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '88%',
    minHeight: 260,
  },
  profileScrollContent: { paddingHorizontal: 22, paddingBottom: 36, paddingTop: 4 },
  profileTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 4 },
  editBtnText: { color: EMERALD, fontSize: 14, fontWeight: '700' },
  profileCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: CANVAS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileLoadingWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  profileHeaderCol: { alignItems: 'center', marginBottom: 18 },
  profileName: { fontSize: 19, fontWeight: '800', color: INK, marginTop: 12 },
  profileErrorText: { color: DANGER, fontSize: 12.5, textAlign: 'center', marginBottom: 12 },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 8,
    gap: 6,
  },
  statusChipDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusChipText: { fontSize: 12, fontWeight: '700' },

  profileSection: {
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
    paddingTop: 14,
    marginTop: 4,
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: EMERALD,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 14,
  },
  reportBtnText: { color: EMERALD, fontSize: 14, fontWeight: '700' },
  profileSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: SUBTLE,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: CANVAS,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoLabel: { fontSize: 11.5, color: SUBTLE, fontWeight: '600' },
  infoValue: { fontSize: 14.5, color: INK, fontWeight: '600', marginTop: 1 },
  profileNoteText: { fontSize: 13.5, color: INK, lineHeight: 19 },

  editLabel: { fontSize: 12.5, fontWeight: '600', color: SUBTLE, marginBottom: 6 },
  editInput: {
    backgroundColor: CANVAS,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14.5,
    color: INK,
  },
  editInputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  iosPickerWrap: { backgroundColor: CANVAS, borderRadius: 12, marginTop: 8, paddingBottom: 8 },
  iosPickerDone: { alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 6 },
  iosPickerDoneText: { color: EMERALD, fontWeight: '700', fontSize: 14 },
  editActionsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  editActionBtn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  editActionBtnGhost: { backgroundColor: CANVAS },
  editActionBtnGhostText: { color: INK, fontWeight: '600' },
  editActionBtnPrimary: { backgroundColor: EMERALD },
  editActionBtnPrimaryText: { color: '#FFFFFF', fontWeight: '700' },
});
