import React, { useRef, useState } from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
  FlatList,
  TouchableWithoutFeedback,
  Dimensions,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { X } from 'lucide-react-native';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DOUBLE_TAP_MS = 260;

function CloseIcon() {
  return <X size={24} color={"#FFFFFF"} strokeWidth={2.2} />;
}

function ZoomableImage({ uri, active }: { uri: string; active: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  const zoomedRef = useRef(false);
  const lastTapRef = useRef(0);

  const onPress = () => {
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      // double tap - toggle zoom
      const toValue = zoomedRef.current ? 1 : 2.4;
      zoomedRef.current = !zoomedRef.current;
      Animated.spring(scale, { toValue, useNativeDriver: true, friction: 6 }).start();
    }
    lastTapRef.current = now;
  };

  return (
    <TouchableWithoutFeedback onPress={onPress}>
      <View style={styles.page}>
        <Animated.Image
          source={{ uri }}
          style={[styles.image, { transform: [{ scale: active ? scale : 1 }] }]}
          resizeMode="contain"
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

/**
 * Full-screen photo viewer - swipe left/right between a post's images,
 * double-tap to zoom in/out, tap the X (or single-tap the image with no
 * pending double tap) to close.
 */
export default function ImageViewerScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { images, initialIndex = 0 } = (route.params as { images: string[]; initialIndex?: number }) ?? {
    images: [],
    initialIndex: 0,
  };

  const [index, setIndex] = useState(initialIndex);
  const listRef = useRef<FlatList>(null);

  return (
    <View style={styles.flex}>
      {/* No <StatusBar hidden /> here - see AnimatedSplash.tsx for why RN's
          StatusBar is avoided app-wide: the native module backing it is
          missing methods on this build and crashes the app when any
          <StatusBar> mounts, regardless of which props it's given. */}
      <FlatList
        ref={listRef}
        data={images}
        horizontal
        pagingEnabled
        initialScrollIndex={initialIndex}
        getItemLayout={(_, i) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * i, index: i })}
        keyExtractor={(uri, i) => `${uri}-${i}`}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const newIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setIndex(newIndex);
        }}
        renderItem={({ item, index: i }) => <ZoomableImage uri={item} active={i === index} />}
      />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={styles.closeBtn}>
          <CloseIcon />
        </TouchableOpacity>
        {images.length > 1 && (
          <Text style={styles.counter}>
            {index + 1} / {images.length}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#000000' },
  page: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  image: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
  header: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});
