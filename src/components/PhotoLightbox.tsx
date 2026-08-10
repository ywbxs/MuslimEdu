import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Image, Alert, ActivityIndicator, Platform, Dimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { downloadImageToDevice } from '../utils/downloadFile';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

function CloseIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6l12 12M18 6L6 18" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}
function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  const d = direction === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6';
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d={d} stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function DownloadIcon({ color }: { color: string }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

interface PhotoLightboxProps {
  visible: boolean;
  photos: string[];
  initialIndex: number;
  onClose: () => void;
}

// Full-screen viewer for a report's uploaded photos - replaces the old
// small 64x64 horizontal-scroll thumbnails with a real large view, plus a
// download action. Downloads happen entirely in-app via downloadFile.ts
// (react-native-fs) straight to device storage - no Linking.openURL
// hand-off to a browser/OS "open with" sheet.
export default function PhotoLightbox({ visible, photos, initialIndex, onClose }: PhotoLightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const [downloaded, setDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (visible) {
      setIndex(initialIndex);
      setDownloaded(false);
    }
  }, [visible, initialIndex]);

  if (!visible || photos.length === 0) return null;

  const step = (dir: 1 | -1) => {
    setIndex((prev) => (prev + dir + photos.length) % photos.length);
    setDownloaded(false);
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await downloadImageToDevice(photos[index]);
      setDownloaded(true);
      Alert.alert(
        'Downloaded',
        Platform.OS === 'android'
          ? 'Saved to your device.'
          : 'Saved in the app - open the Files app and look under "On My iPhone/iPad" to view it.',
      );
    } catch (err) {
      Alert.alert('Could not download', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.top}>
          <TouchableOpacity style={styles.iconBtn} onPress={onClose} hitSlop={10}>
            <CloseIcon />
          </TouchableOpacity>
          <Text style={styles.counter}>{index + 1} / {photos.length}</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.stage}>
          {photos.length > 1 && (
            <TouchableOpacity style={[styles.navArrow, styles.navLeft]} onPress={() => step(-1)} hitSlop={10}>
              <ChevronIcon direction="left" />
            </TouchableOpacity>
          )}
          <Image
            source={{ uri: photos[index] }}
            style={{ width: SCREEN_W - 40, height: SCREEN_H * 0.62 }}
            resizeMode="contain"
          />
          {photos.length > 1 && (
            <TouchableOpacity style={[styles.navArrow, styles.navRight]} onPress={() => step(1)} hitSlop={10}>
              <ChevronIcon direction="right" />
            </TouchableOpacity>
          )}
        </View>

        {photos.length > 1 && (
          <View style={styles.dots}>
            {photos.map((url, i) => (
              <View key={url + i} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
        )}

        <View style={styles.bottom}>
          <TouchableOpacity
            style={[styles.downloadBtn, downloaded && styles.downloadBtnDone]}
            onPress={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <ActivityIndicator size="small" color={downloaded ? '#FFFFFF' : '#14171A'} />
            ) : (
              <DownloadIcon color={downloaded ? '#FFFFFF' : '#14171A'} />
            )}
            <Text style={[styles.downloadText, downloaded && styles.downloadTextDone]}>
              {isDownloading ? 'Downloading…' : downloaded ? 'Downloaded' : 'Download photo'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10,11,12,0.97)' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 10 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  counter: { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontVariant: ['tabular-nums'] },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navArrow: { position: 'absolute', top: '50%', marginTop: -17, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  navLeft: { left: 8 },
  navRight: { right: 8 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, paddingBottom: 8 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { width: 14, borderRadius: 3, backgroundColor: '#FFFFFF' },
  bottom: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 28 },
  downloadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 13 },
  downloadBtnDone: { backgroundColor: '#2BCBB0' },
  downloadText: { color: '#14171A', fontWeight: '700', fontSize: 13.5 },
  downloadTextDone: { color: '#FFFFFF' },
});
