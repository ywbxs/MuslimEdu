import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Image } from 'react-native';
import Svg, { Path, Polyline, Rect, Line } from 'react-native-svg';

const EMERALD = '#1FAE64';
const EMERALD_DEEP = '#0F7A3D';
const EMERALD_SOFT = 'rgba(31,174,100,0.1)';
const GOLD = '#B8912F';
const INK = '#1C1C1E';
const SUBTLE = '#8A9099';
const DANGER = '#E5484D';
const DANGER_SOFT = 'rgba(229,72,77,0.08)';
const BORDER = '#EDEEF0';
const SURFACE = '#FFFFFF';

export interface TimelineMeter {
  label: string;
  value: number | null;
  tone?: 'accent' | 'gold';
}

export interface TimelineMonthMeta {
  key: string;
  name: string;
  submitted: boolean;
  submittedOn?: string | null;
  meters?: TimelineMeter[];
  photos?: string[];
}

function CheckIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Polyline points="5 13 10 18 19 7" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function MissingIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={5} width={16} height={16} rx={3} stroke={DANGER} strokeWidth={2} />
      <Line x1={4} y1={9.5} x2={20} y2={9.5} stroke={DANGER} strokeWidth={2} />
    </Svg>
  );
}
function ChevronIcon({ color = '#C4C9CF' }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M9 6l6 6-6 6" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PhotoStack({ photos }: { photos: string[] }) {
  const shown = photos.slice(0, 3);
  const extra = photos.length - shown.length;
  return (
    <View style={styles.photoStack}>
      {shown.map((uri, i) => (
        <Image key={`${uri}-${i}`} source={{ uri }} style={[styles.photoStackImg, i > 0 && styles.photoStackImgOverlap]} />
      ))}
      {extra > 0 ? (
        <View style={[styles.photoStackMore, styles.photoStackImgOverlap]}>
          <Text style={styles.photoStackMoreText}>+{extra}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Meter({ meter }: { meter: TimelineMeter }) {
  const fillAnim = useRef(new Animated.Value(0)).current;
  const target = meter.value != null ? (meter.value / 5) * 100 : 0;

  useEffect(() => {
    Animated.timing(fillAnim, { toValue: target, duration: 500, delay: 150, useNativeDriver: false }).start();
  }, [fillAnim, target]);

  return (
    <View style={styles.meter}>
      <View style={styles.meterLabelRow}>
        <Text style={styles.meterLabel}>{meter.label}</Text>
        <Text style={styles.meterValue}>{meter.value != null ? `${meter.value}/5` : '—'}</Text>
      </View>
      <View style={styles.meterTrack}>
        <Animated.View
          style={[
            styles.meterFill,
            meter.tone === 'gold' && styles.meterFillGold,
            { width: fillAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) },
          ]}
        />
      </View>
    </View>
  );
}

function TimelineRow({
  month,
  index,
  onPress,
}: {
  month: TimelineMonthMeta;
  index: number;
  onPress: () => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 380, delay: index * 55, useNativeDriver: true }).start();
  }, [anim, index]);

  const meters = month.meters ?? [];
  const photos = month.photos ?? [];

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      }}
    >
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.row}>
        <View style={styles.nodeCol}>
          <View style={[styles.node, month.submitted ? styles.nodeOn : styles.nodeMissing]}>
            {month.submitted ? <CheckIcon /> : <MissingIcon />}
          </View>
        </View>

        <View style={[styles.card, !month.submitted && styles.cardMissing]}>
          <View style={styles.topRow}>
            <Text style={styles.month} numberOfLines={1}>
              {month.name}
            </Text>
            <View style={[styles.pill, month.submitted ? styles.pillOn : styles.pillMissing]}>
              <Text style={[styles.pillText, month.submitted ? styles.pillTextOn : styles.pillTextMissing]}>
                {month.submitted ? 'On time' : 'Make up'}
              </Text>
            </View>
          </View>

          {month.submitted ? (
            <>
              {month.submittedOn ? <Text style={styles.time}>Submitted {month.submittedOn}</Text> : null}
              {meters.length > 0 && (
                <View style={styles.metersRow}>
                  {meters.map((m) => (
                    <Meter key={m.label} meter={m} />
                  ))}
                </View>
              )}
              <View style={styles.bottomRow}>
                {photos.length > 0 ? <PhotoStack photos={photos} /> : <Text style={styles.emptyPhotos}>No photos</Text>}
                <ChevronIcon />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.missingBody}>No report was submitted for this month.</Text>
              <View style={styles.missingCta}>
                <Text style={styles.missingCtaText}>Submit a make-up report</Text>
                <ChevronIcon color={DANGER} />
              </View>
            </>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

/**
 * Modern gradient-rail timeline shared by OrphanReportScreen.tsx (2
 * meters: academic/wellbeing) and TeacherOrphanReportScreen.tsx (3
 * meters: teaching/engagement/growth) - the two screens' history
 * sections were structurally identical aside from which/how many
 * rating meters each report carries, so that's the one thing callers
 * customize via each month's `meters` array.
 */
export default function MonthlyReportTimeline({
  months,
  onPressMonth,
}: {
  months: TimelineMonthMeta[];
  onPressMonth: (month: TimelineMonthMeta) => void;
}) {
  const railAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(railAnim, { toValue: 1, duration: 700, useNativeDriver: false }).start();
  }, [railAnim]);

  return (
    <View style={styles.timeline}>
      <Animated.View style={[styles.rail, { transform: [{ scaleY: railAnim }] }]} />
      {months.map((m, i) => (
        <TimelineRow key={m.key} month={m} index={i} onPress={() => onPressMonth(m)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  timeline: { position: 'relative', marginTop: 6 },
  rail: {
    position: 'absolute',
    left: 21,
    top: 6,
    bottom: 6,
    width: 2,
    borderRadius: 2,
    backgroundColor: EMERALD,
    opacity: 0.35,
    transformOrigin: 'top',
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 14 },
  nodeCol: { width: 44, alignItems: 'center', paddingTop: 8, flexShrink: 0 },
  node: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  nodeOn: {
    backgroundColor: EMERALD_DEEP,
    shadowColor: EMERALD,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  nodeMissing: { backgroundColor: SURFACE, borderWidth: 2, borderColor: '#D9DEE2', borderStyle: 'dashed' },

  card: { flex: 1, minWidth: 0, backgroundColor: SURFACE, borderRadius: 18, padding: 15, shadowColor: '#0D1E1C', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardMissing: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#DEE2E5', borderStyle: 'dashed', shadowOpacity: 0, elevation: 0 },

  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  month: { fontSize: 14.5, fontWeight: '800', color: INK, flexShrink: 1, marginRight: 8 },
  pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, flexShrink: 0 },
  pillOn: { backgroundColor: EMERALD_SOFT },
  pillMissing: { backgroundColor: DANGER_SOFT },
  pillText: { fontSize: 10.5, fontWeight: '800' },
  pillTextOn: { color: EMERALD_DEEP },
  pillTextMissing: { color: DANGER },

  time: { fontSize: 11.5, color: SUBTLE, fontWeight: '600', marginTop: 3 },

  metersRow: { flexDirection: 'row', gap: 14, marginTop: 12 },
  meter: { flex: 1, minWidth: 0 },
  meterLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  meterLabel: { fontSize: 10, fontWeight: '700', color: SUBTLE, textTransform: 'uppercase', letterSpacing: 0.3 },
  meterValue: { fontSize: 10, fontWeight: '800', color: INK },
  meterTrack: { height: 5, borderRadius: 3, backgroundColor: BORDER, overflow: 'hidden', marginTop: 5 },
  meterFill: { height: '100%', borderRadius: 3, backgroundColor: EMERALD },
  meterFillGold: { backgroundColor: GOLD },

  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  photoStack: { flexDirection: 'row', alignItems: 'center' },
  photoStackImg: { width: 26, height: 26, borderRadius: 9, backgroundColor: '#F0F0F0', borderWidth: 2, borderColor: SURFACE },
  photoStackImgOverlap: { marginLeft: -8 },
  photoStackMore: { width: 26, height: 26, borderRadius: 9, backgroundColor: INK, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: SURFACE },
  photoStackMoreText: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '800' },
  emptyPhotos: { fontSize: 11.5, color: SUBTLE },

  missingBody: { fontSize: 12, color: SUBTLE, lineHeight: 17, marginTop: 6 },
  missingCta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  missingCtaText: { fontSize: 12, fontWeight: '800', color: DANGER },
});
