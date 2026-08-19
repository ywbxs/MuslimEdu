import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Building2, ChevronLeft, DoorOpen } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useAcademicGlassTheme, AcademicGlassTheme } from './academicGlassTheme';
import { RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
import { BentoGrid } from '../../components/glass/BentoGridCard';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import BottomNavBar from '../../components/BottomNavBar';
import { archiveBuilding, archiveRoom, Building, listBuildings, listRooms, Room } from '../../services/academicFacilitiesService';

/**
 * Bento redesign - was a single unreadable one-line JSX blob with no edit
 * capability (create + archive only). Buildings/rooms are now spatial
 * tiles (icon, code badge, meta, tap-to-edit) via BuildingFormScreen/
 * RoomFormScreen's step wizards, matching Enrollment Stages/Fee Types.
 */

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}
function IconBuilding({ color }: { color: string }) {
  return <Building2 size={20} color={color} strokeWidth={1.8} />;
}
function IconDoor({ color }: { color: string }) {
  return <DoorOpen size={20} color={color} strokeWidth={2} />;
}

export default function AcademicFacilitiesScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token } = useAuth();
  const { t } = useLocale();

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selected, setSelected] = useState<number | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const [b, r] = await Promise.all([listBuildings(token), listRooms(token, selected)]);
      setBuildings(b);
      setRooms(r);
    } catch (e: any) {
      setError(e?.message ?? t('academic_facilities.load_error', 'Could not load facilities.'));
    } finally {
      setLoading(false);
    }
  }, [token, selected, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleArchiveBuilding = (b: Building) => {
    Alert.alert(
      t('academic_facilities.archive_building_title', 'Archive Building'),
      t('academic_facilities.archive_building_message', 'Archive "{name}"? It must have no active rooms.').replace('{name}', b.name),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('academic_facilities.archive', 'Archive'),
          style: 'destructive',
          onPress: async () => {
            try {
              await archiveBuilding(token!, b.id);
              load();
            } catch (e: any) {
              Alert.alert(t('academic_facilities.cannot_archive_title', 'Cannot Archive'), e?.message ?? t('common.try_again', 'Please try again.'));
            }
          },
        },
      ]
    );
  };

  const handleArchiveRoom = (r: Room) => {
    Alert.alert(
      t('academic_facilities.archive_room_title', 'Archive Room'),
      t('academic_facilities.archive_room_message', 'Archive "{name}"?').replace('{name}', r.name),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('academic_facilities.archive', 'Archive'),
          style: 'destructive',
          onPress: async () => {
            try {
              await archiveRoom(token!, r.id);
              load();
            } catch (e: any) {
              Alert.alert(t('academic_facilities.cannot_archive_title', 'Cannot Archive'), e?.message ?? t('common.try_again', 'Please try again.'));
            }
          },
        },
      ]
    );
  };

  const renderSkeletonCard = (key: number) => (
    <View key={key} style={styles.tile}>
      <Skeleton width={40} height={40} borderRadius={20} style={{ marginBottom: 10 }} baseColor={theme.skeletonBase} />
      <Skeleton width="70%" height={15} borderRadius={6} style={{ marginBottom: 8 }} baseColor={theme.skeletonBase} />
      <Skeleton width="45%" height={11} baseColor={theme.skeletonBase} />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
            <IconChevronLeft color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, styles.headerTitleFlex]}>{t('academic_facilities.title', 'Facilities')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <BentoGrid>{[0, 1, 2, 3].map(renderSkeletonCard)}</BentoGrid>
        <BottomNavBar />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={theme.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleFlex}>
          <Text style={styles.headerTitle}>{t('academic_facilities.title', 'Facilities')}</Text>
          <Text style={styles.headerSubtitle}>{t('academic_facilities.subtitle', 'Buildings, floors, rooms and learning spaces')}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
          <TouchableOpacity onPress={load}>
            <Text style={styles.retryText}>{t('common.retry', 'Retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>{t('academic_facilities.buildings', 'Buildings')}</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => (navigation as any).navigate('BuildingForm')}>
            <Text style={styles.addButtonText}>+ {t('academic_facilities.building', 'Building')}</Text>
          </TouchableOpacity>
        </View>

        {buildings.length === 0 ? (
          <EmptyState
            icon="🏢"
            title={t('academic_facilities.empty_buildings_title', 'No buildings yet')}
            subtitle={t('academic_facilities.no_buildings', 'Add the first one to start organizing rooms by floor.')}
            actionLabel={t('academic_facilities.empty_action', 'Add Building')}
            onAction={() => (navigation as any).navigate('BuildingForm')}
            colors={theme}
          />
        ) : (
          <BentoGrid>
            {buildings.map((b) => {
              const isSelected = b.id === selected;
              return (
                <TouchableOpacity
                  key={b.id}
                  style={[styles.tile, isSelected && styles.tileSelected]}
                  activeOpacity={0.85}
                  onPress={() => setSelected(b.id === selected ? undefined : b.id)}
                  onLongPress={() => (navigation as any).navigate('BuildingForm', { buildingId: b.id })}
                >
                  <View style={[styles.iconWrap, isSelected && { backgroundColor: theme.accent }]}>
                    <IconBuilding color={isSelected ? theme.onAccent : theme.accent} />
                  </View>
                  <Text style={styles.codeBadge}>{b.code}</Text>
                  <Text style={styles.tileTitle} numberOfLines={1}>{b.name}</Text>
                  <Text style={styles.tileMeta}>
                    {b.floor_count} {b.floor_count === 1 ? t('academic_facilities.floor', 'floor') : t('academic_facilities.floors', 'floors')} · {b.rooms_count ?? 0} {t('academic_facilities.rooms', 'rooms')}
                  </Text>
                  <View style={styles.tileFooter}>
                    <TouchableOpacity onPress={() => (navigation as any).navigate('BuildingForm', { buildingId: b.id })}>
                      <Text style={styles.editLink}>{t('common.edit', 'Edit')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleArchiveBuilding(b)}>
                      <Text style={styles.archiveLink}>{t('academic_facilities.archive', 'Archive')}</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
          </BentoGrid>
        )}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>
            {selected ? t('academic_facilities.rooms_in_building', 'Rooms in Selected Building') : t('academic_facilities.all_rooms', 'All Rooms')}
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              if (!selected) {
                Alert.alert(t('academic_facilities.select_building_title', 'Select a Building'), t('academic_facilities.select_building_message', 'Choose a building before adding a room.'));
                return;
              }
              (navigation as any).navigate('RoomForm', { buildingId: selected });
            }}
          >
            <Text style={styles.addButtonText}>+ {t('academic_facilities.room', 'Room')}</Text>
          </TouchableOpacity>
        </View>

        {rooms.length === 0 ? (
          <EmptyState
            icon="🚪"
            title={t('academic_facilities.empty_rooms_title', 'No rooms found')}
            subtitle={t('academic_facilities.no_rooms', 'Select a building above, then add its first room.')}
            colors={theme}
          />
        ) : (
          <BentoGrid>
            {rooms.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={styles.tile}
                activeOpacity={0.85}
                onPress={() => (navigation as any).navigate('RoomForm', { buildingId: r.building_id, roomId: r.id })}
              >
                <View style={styles.iconWrap}>
                  <IconDoor color={theme.accent} />
                </View>
                <Text style={styles.codeBadge}>{r.code}</Text>
                <Text style={styles.tileTitle} numberOfLines={1}>{r.name}</Text>
                <Text style={styles.tileMeta}>
                  {t(`academic_facilities.type_${r.room_type}`, String(r.room_type).replace('_', ' '))} · {t('academic_facilities.floor_label', 'Floor')} {r.floor_number}
                </Text>
                <Text style={styles.tileMeta}>{t('academic_facilities.capacity_label', 'Capacity')} {r.capacity}</Text>
                <View style={styles.tileFooter}>
                  <Text style={styles.editLink}>{t('common.edit', 'Edit')}</Text>
                  <TouchableOpacity onPress={() => handleArchiveRoom(r)}>
                    <Text style={styles.archiveLink}>{t('academic_facilities.archive', 'Archive')}</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </BentoGrid>
        )}
      </ScrollView>
      <BottomNavBar />
    </View>
  );
}

const makeStyles = (theme: AcademicGlassTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: theme.textPrimary },
    headerSubtitle: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    headerTitleFlex: { flex: 1, marginLeft: 8 },
    backButton: { width: 32 },
    headerSpacer: { width: 32 },

    errorBanner: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.dangerSoft,
      marginHorizontal: 16,
      marginTop: 12,
      padding: 12,
      borderRadius: RADIUS.md,
    },
    errorBannerText: { color: theme.danger, fontSize: 13, flex: 1, marginRight: 8 },
    retryText: { color: theme.danger, fontWeight: '700', fontSize: 13 },

    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 20,
      paddingBottom: 4,
    },
    sectionLabel: { fontSize: 12, fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 },
    addButton: { backgroundColor: theme.accentSoft, borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 7 },
    addButtonText: { color: theme.accent, fontWeight: '700', fontSize: 12.5 },

    tile: {
      width: '47%',
      minHeight: 150,
      backgroundColor: theme.surface,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      ...theme.elevation2,
    },
    tileSelected: { borderColor: theme.accent, borderWidth: 2 },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    codeBadge: { fontSize: 10, fontWeight: '700', color: theme.accent, letterSpacing: 0.6, marginBottom: 2 },
    tileTitle: { fontSize: 14.5, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
    tileMeta: { fontSize: 11, color: theme.textSecondary, marginBottom: 2 },
    tileFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 8 },
    editLink: { fontSize: 11.5, fontWeight: '700', color: theme.accent },
    archiveLink: { fontSize: 11.5, fontWeight: '700', color: theme.danger },
  });
