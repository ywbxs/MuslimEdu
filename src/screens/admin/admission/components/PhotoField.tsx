import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Animated } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { md3 } from '../theme';
import { prepareProfilePhoto, InvalidPhotoTypeError, formatBytes, MAX_PHOTO_BYTES } from '../../../../utils/imagePrep';
import { PickedPhoto } from '../../../../services/orphanService';
import { useLocale } from '../../../../context/LocaleContext';

export interface PreparedPhotoState extends PickedPhoto {
  size?: number;
  wasCompressed?: boolean;
}

export default function PhotoField({
  photo,
  onChange,
  initial,
  error,
  onErrorChange,
}: {
  photo: PreparedPhotoState | null;
  onChange: (photo: PreparedPhotoState | null) => void;
  initial: string;
  error?: string | null;
  onErrorChange: (message: string | null) => void;
}) {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;

  const runPulse = () => {
    pulse.setValue(1);
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1.06, duration: 140, useNativeDriver: true }),
      Animated.spring(pulse, { toValue: 1, useNativeDriver: true, friction: 5 }),
    ]).start();
  };

  const pickPhoto = async () => {
    onErrorChange(null);
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      quality: 1, // grab full quality; we compress ourselves against an exact byte budget
    });
    if (result.didCancel || result.errorCode || !result.assets?.[0]?.uri) return;

    const asset = result.assets[0];
    setBusy(true);
    try {
      const prepared = await prepareProfilePhoto(
        asset.uri as string,
        asset.fileName ?? undefined,
        asset.type ?? undefined,
      );
      onChange({
        uri: prepared.uri,
        fileName: prepared.fileName,
        type: prepared.type,
        size: prepared.size,
        wasCompressed: prepared.wasCompressed,
      });
      runPulse();
    } catch (err) {
      if (err instanceof InvalidPhotoTypeError) {
        onErrorChange(err.message);
      } else {
        onErrorChange(t('photo_field.process_error', 'Could not process that image. Please try a different photo.'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity onPress={pickPhoto} activeOpacity={0.85} disabled={busy} style={styles.circleWrap}>
        <Animated.View style={{ transform: [{ scale: pulse }] }}>
          {photo ? (
            <Image source={{ uri: photo.uri }} style={[styles.circle, error && styles.circleError]} />
          ) : (
            <View style={[styles.circle, styles.circlePlaceholder, error && styles.circleError]}>
              <Text style={styles.initial}>{initial}</Text>
            </View>
          )}
          {busy ? (
            <View style={styles.busyOverlay}>
              <ActivityIndicator color={md3.color.onPrimary} />
            </View>
          ) : null}
        </Animated.View>
        <View style={styles.editBadge}>
          <Text style={styles.editBadgeText}>{photo ? t('photo_field.change', 'Change') : t('photo_field.add_photo', 'Add photo')}</Text>
        </View>
      </TouchableOpacity>

      <Text style={styles.hint}>
        {busy
          ? t('photo_field.optimizing', 'Optimizing image...')
          : photo
          ? t('photo_field.tap_to_change', 'Tap the photo to choose a different one.')
          : t('photo_field.required_types', 'Required. JPG, JPEG, or PNG.')}
      </Text>

      {photo?.size ? (
        <Text style={styles.meta}>
          {formatBytes(photo.size)}
          {photo.wasCompressed ? ` · ${t('photo_field.compressed_to_fit', 'compressed to fit')} ${formatBytes(MAX_PHOTO_BYTES)} ${t('photo_field.limit', 'limit')}` : ''}
        </Text>
      ) : (
        <Text style={styles.meta}>{t('photo_field.max_size', 'Max')} {formatBytes(MAX_PHOTO_BYTES)} - {t('photo_field.compressed_note', 'larger photos are compressed automatically.')}</Text>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {photo ? (
        <TouchableOpacity onPress={() => onChange(null)} hitSlop={8}>
          <Text style={styles.remove}>{t('photo_field.remove_photo', 'Remove photo')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 8 },
  circleWrap: { alignItems: 'center', justifyContent: 'center' },
  circle: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: md3.color.primaryContainer,
  },
  circlePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  circleError: { borderWidth: 2, borderColor: md3.color.error },
  busyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 66,
    backgroundColor: 'rgba(15,20,17,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontSize: 46, fontWeight: '800', color: md3.color.onPrimaryContainer },
  editBadge: {
    marginTop: -14,
    backgroundColor: md3.color.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: md3.shape.full,
    borderWidth: 3,
    borderColor: md3.color.surface,
  },
  editBadgeText: { color: md3.color.onPrimary, fontSize: 12, fontWeight: '700' },
  hint: {
    fontSize: 13,
    color: md3.color.onSurfaceVariant,
    marginTop: 18,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  meta: {
    fontSize: 12,
    color: md3.color.onSurfaceVariant,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  errorText: { fontSize: 13, color: md3.color.error, fontWeight: '600', marginTop: 10, textAlign: 'center' },
  remove: { fontSize: 13.5, color: md3.color.error, fontWeight: '600', marginTop: 14 },
});
