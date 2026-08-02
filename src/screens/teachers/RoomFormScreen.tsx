import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useAcademicGlassTheme } from './academicGlassTheme';
import { RADIUS } from '../../theme/glass';
import WizardShell, { WizardStep } from '../../components/glass/WizardShell';
import { listBuildings, listRooms, saveRoom, updateRoom, Building, RoomType } from '../../services/academicFacilitiesService';

const TYPES: RoomType[] = ['classroom', 'laboratory', 'library', 'office', 'hall', 'mosque', 'learning_space', 'other'];

function IconDoor({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Path d="M6 21V4a1 1 0 0 1 1-1h8l3 3v15" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6 21h14" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={13} cy={13} r={0.9} fill={color} />
    </Svg>
  );
}
function IconRuler({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Path d="M4 15l5-5 3 3 8-8" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 19h16" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function IconDoc({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Path d="M7 3h7l4 4v14H7V3Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M14 3v4h4" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}

function SummaryRow({ label, value, theme }: { label: string; value: string; theme: ReturnType<typeof useAcademicGlassTheme> }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border }}>
      <Text style={{ fontSize: 13, color: theme.textSecondary, fontWeight: '600' }}>{label}</Text>
      <Text style={{ fontSize: 14, color: theme.textPrimary, fontWeight: '700' }}>{value}</Text>
    </View>
  );
}

export default function RoomFormScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token } = useAuth();
  const { t } = useLocale();

  const buildingId: number = route.params?.buildingId;
  const roomId: number | undefined = route.params?.roomId;
  const isEditing = !!roomId;

  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [building, setBuilding] = useState<Building | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [roomType, setRoomType] = useState<RoomType>('classroom');
  const [floorNumber, setFloorNumber] = useState('1');
  const [capacity, setCapacity] = useState('30');

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        setLoading(true);
        const buildings = await listBuildings(token);
        setBuilding(buildings.find((b) => b.id === buildingId) ?? null);
        if (isEditing) {
          const rooms = await listRooms(token, buildingId);
          const r = rooms.find((x) => x.id === roomId);
          if (r) {
            setName(r.name);
            setCode(r.code);
            setRoomType(r.room_type as RoomType);
            setFloorNumber(String(r.floor_number));
            setCapacity(String(r.capacity));
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [token, buildingId, isEditing, roomId]);

  const floorNum = Math.max(1, Number(floorNumber) || 1);
  const capacityNum = Math.max(0, Number(capacity) || 0);

  const onSave = async () => {
    if (!token || !name.trim() || !code.trim()) return;
    setSubmitting(true);
    try {
      if (isEditing) {
        await updateRoom(token, roomId!, { name: name.trim(), code: code.trim().toUpperCase(), room_type: roomType, floor_number: floorNum, capacity: capacityNum });
      } else {
        await saveRoom(token, { building_id: buildingId, name: name.trim(), code: code.trim().toUpperCase(), room_type: roomType, floor_number: floorNum, capacity: capacityNum });
      }
      navigation.goBack();
    } finally {
      setSubmitting(false);
    }
  };

  const steps: WizardStep[] = [
    {
      id: 'info',
      title: t('room_form.step_info_title', 'Room Info'),
      subtitle: t('room_form.step_info_subtitle', 'What is this room called, and what type is it?'),
      icon: <IconDoor color={theme.accent} />,
      isValid: name.trim().length > 0 && code.trim().length > 0,
      content: (
        <>
          <Text style={styles.label}>{t('room_form.name_label', 'Room Name')}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t('room_form.name_placeholder', 'e.g. Room 204')}
            placeholderTextColor={theme.textMuted}
          />
          <Text style={styles.label}>{t('room_form.code_label', 'Code')}</Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            placeholder={t('room_form.code_placeholder', 'e.g. R204')}
            placeholderTextColor={theme.textMuted}
            autoCapitalize="characters"
          />
          <Text style={styles.label}>{t('room_form.type_label', 'Room Type')}</Text>
          <View style={styles.chipRow}>
            {TYPES.map((rt) => {
              const selected = roomType === rt;
              return (
                <TouchableOpacity
                  key={rt}
                  style={[styles.chip, selected && { backgroundColor: theme.accent, borderColor: theme.accent }]}
                  onPress={() => setRoomType(rt)}
                >
                  <Text style={[styles.chipText, selected && { color: theme.onAccent }]}>
                    {t(`academic_facilities.type_${rt}`, rt.replace('_', ' '))}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      ),
    },
    {
      id: 'capacity',
      title: t('room_form.step_capacity_title', 'Location & Capacity'),
      subtitle: t('room_form.step_capacity_subtitle', 'Which floor is it on, and how many can it hold?'),
      icon: <IconRuler color={theme.accent} />,
      isValid: true,
      content: (
        <>
          <Text style={styles.label}>{t('room_form.floor_label', 'Floor Number')}</Text>
          <TextInput style={styles.input} value={floorNumber} onChangeText={setFloorNumber} keyboardType="number-pad" placeholderTextColor={theme.textMuted} />
          <Text style={styles.label}>{t('room_form.capacity_label', 'Capacity')}</Text>
          <TextInput style={styles.input} value={capacity} onChangeText={setCapacity} keyboardType="number-pad" placeholderTextColor={theme.textMuted} />
        </>
      ),
    },
    {
      id: 'review',
      title: t('room_form.step_review_title', 'Review'),
      subtitle: t('room_form.step_review_subtitle', 'Does everything look right?'),
      icon: <IconDoc color={theme.accent} />,
      isValid: name.trim().length > 0 && code.trim().length > 0,
      content: (
        <View>
          <SummaryRow label={t('room_form.building_label', 'Building')} value={building?.name ?? '—'} theme={theme} />
          <SummaryRow label={t('room_form.name_label', 'Room Name')} value={name.trim() || '—'} theme={theme} />
          <SummaryRow label={t('room_form.code_label', 'Code')} value={code.trim() || '—'} theme={theme} />
          <SummaryRow label={t('room_form.type_label', 'Room Type')} value={t(`academic_facilities.type_${roomType}`, roomType.replace('_', ' '))} theme={theme} />
          <SummaryRow label={t('room_form.floor_label', 'Floor Number')} value={String(floorNum)} theme={theme} />
          <SummaryRow label={t('room_form.capacity_label', 'Capacity')} value={String(capacityNum)} theme={theme} />
        </View>
      ),
    },
  ];

  if (loading) return null;

  return (
    <WizardShell
      title={isEditing ? t('room_form.edit_title', 'Edit Room') : t('room_form.add_title', 'Add Room')}
      steps={steps}
      onCancel={() => navigation.goBack()}
      onFinish={onSave}
      finishLabel={isEditing ? t('room_form.save_changes', 'Save Changes') : t('room_form.add_title', 'Add Room')}
      saving={submitting}
      theme={theme}
    />
  );
}

const makeStyles = (theme: ReturnType<typeof useAcademicGlassTheme>) =>
  StyleSheet.create({
    label: { fontSize: 12.5, fontWeight: '600', color: theme.textSecondary, marginBottom: 6, marginTop: 14 },
    input: {
      height: 48,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: RADIUS.sm,
      paddingHorizontal: 16,
      fontSize: 15,
      backgroundColor: theme.background,
      color: theme.textPrimary,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      borderColor: theme.borderStrong,
    },
    chipText: { fontSize: 13, fontWeight: '600', color: theme.textPrimary, textTransform: 'capitalize' },
  });
