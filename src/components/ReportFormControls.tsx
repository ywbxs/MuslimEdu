import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, ScrollView } from 'react-native';
import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';
import { launchImageLibrary } from 'react-native-image-picker';
import { PickedPhoto } from '../services/orphanService';
import { SHADOW } from '../theme/spatial';

const EMERALD = '#0F9D58';
const EMERALD_SOFT = '#E7F5EC';
const INK = '#1C1C1E';
const SUBTLE = '#8A9099';
const HAIRLINE = '#EDEEF0';
const CANVAS = '#F6F7F9';

export function NoteInput({
  value,
  onChange,
  maxLength = 500,
  placeholder = 'Write your summary...',
}: {
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  placeholder?: string;
}) {
  return (
    <View>
      <View style={styles.noteBox}>
        <TextInput
          style={styles.noteInput}
          multiline
          placeholder={placeholder}
          placeholderTextColor={SUBTLE}
          value={value}
          onChangeText={(t) => onChange(t.slice(0, maxLength))}
          maxLength={maxLength}
        />
      </View>
      <Text style={styles.noteCounter}>
        {value.length} / {maxLength}
      </Text>
    </View>
  );
}

export function RatingSelector({
  value,
  onChange,
  labels,
}: {
  value: number | null;
  onChange: (v: number) => void;
  labels: Record<number, string>;
}) {
  return (
    <View style={styles.ratingRow}>
      {[1, 2, 3, 4, 5].map((n) => {
        const selected = value === n;
        return (
          <TouchableOpacity key={n} style={styles.ratingCell} onPress={() => onChange(n)} activeOpacity={0.8}>
            <View style={[styles.ratingCircle, selected && styles.ratingCircleActive]}>
              <Text style={[styles.ratingNum, selected && styles.ratingNumActive]}>{n}</Text>
            </View>
            {labels[n] ? <Text style={styles.ratingLabel}>{labels[n]}</Text> : <View style={styles.ratingLabelSpacer} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function IconPlusCircle() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={EMERALD} strokeWidth={1.8} />
      <Line x1={12} y1={8} x2={12} y2={16} stroke={EMERALD} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={8} y1={12} x2={16} y2={12} stroke={EMERALD} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function IconClose() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Line x1={6} y1={6} x2={18} y2={18} stroke="#FFF" strokeWidth={2.4} strokeLinecap="round" />
      <Line x1={18} y1={6} x2={6} y2={18} stroke="#FFF" strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

export function PhotoPicker({
  photos,
  onChange,
  maxPhotos = 5,
}: {
  photos: PickedPhoto[];
  onChange: (photos: PickedPhoto[]) => void;
  maxPhotos?: number;
}) {
  const pick = async () => {
    if (photos.length >= maxPhotos) return;
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: maxPhotos - photos.length,
      quality: 0.7,
    });
    if (result.didCancel || result.errorCode || !result.assets) return;
    const picked: PickedPhoto[] = result.assets
      .filter((a) => !!a.uri)
      .map((a) => ({ uri: a.uri as string, fileName: a.fileName ?? null, type: a.type ?? null }));
    onChange([...photos, ...picked].slice(0, maxPhotos));
  };
  const remove = (uri: string) => onChange(photos.filter((p) => p.uri !== uri));

  return (
    <View>
      {photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
          {photos.map((p) => (
            <View key={p.uri} style={styles.photoThumbWrap}>
              <Image source={{ uri: p.uri }} style={styles.photoThumb} />
              <TouchableOpacity style={styles.photoRemoveBtn} onPress={() => remove(p.uri)} hitSlop={8}>
                <IconClose />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
      {photos.length < maxPhotos && (
        <TouchableOpacity style={styles.addPhotosBox} onPress={pick} activeOpacity={0.8}>
          <IconPlusCircle />
          <Text style={styles.addPhotosText}>Add Photos</Text>
          <Text style={styles.addPhotosSub}>Up to {maxPhotos} images</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  noteBox: {
    backgroundColor: CANVAS,
    borderRadius: 14,
    minHeight: 140,
    padding: 14,
    ...SHADOW.level1,
  },
  noteInput: { fontSize: 14.5, color: INK, minHeight: 110, textAlignVertical: 'top' },
  noteCounter: { textAlign: 'right', color: SUBTLE, fontSize: 12, marginTop: 6 },

  ratingRow: { flexDirection: 'row', justifyContent: 'space-between' },
  ratingCell: { alignItems: 'center', flex: 1 },
  ratingCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    ...SHADOW.level1,
  },
  ratingCircleActive: { backgroundColor: EMERALD, ...SHADOW.level2 },
  ratingNum: { fontSize: 15, fontWeight: '700', color: INK },
  ratingNumActive: { color: '#FFFFFF' },
  ratingLabel: { fontSize: 10.5, color: SUBTLE, marginTop: 6, textAlign: 'center' },
  ratingLabelSpacer: { height: 14 },

  photoScroll: { marginBottom: 12 },
  photoThumbWrap: { marginRight: 10 },
  photoThumb: { width: 72, height: 72, borderRadius: 12, backgroundColor: CANVAS },
  photoRemoveBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotosBox: {
    borderWidth: 1.5,
    borderColor: EMERALD,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 22,
    alignItems: 'center',
    backgroundColor: EMERALD_SOFT,
  },
  addPhotosText: { color: EMERALD, fontWeight: '700', fontSize: 14, marginTop: 6 },
  addPhotosSub: { color: SUBTLE, fontSize: 11.5, marginTop: 2 },
});
