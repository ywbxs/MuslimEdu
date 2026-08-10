import React, { useState } from 'react';
import { Text, View, TextStyle, StyleSheet, StyleProp } from 'react-native';

const EMERALD = '#2BCBB0';

interface Props {
  text: string;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  seeMoreStyle?: StyleProp<TextStyle>;
}

/**
 * Renders text truncated to `numberOfLines`, with a "See more" toggle that
 * appears only if the text actually overflows. Tapping it expands the full
 * text (and shows "See less" to collapse again).
 *
 * A hidden, untruncated copy of the text is used purely to measure how many
 * lines the full text would take, since onTextLayout on an already-truncated
 * <Text> only reports the visible (truncated) lines, not the true total.
 */
export default function ExpandableText({ text, numberOfLines = 6, style, seeMoreStyle }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);

  return (
    <View>
      {/* Hidden measurer: same style, unlimited lines, not interactive/visible */}
      <Text
        style={[style, styles.measurer]}
        onTextLayout={(e) => {
          if (e.nativeEvent.lines.length > numberOfLines) {
            setIsTruncated(true);
          }
        }}
      >
        {text}
      </Text>

      <Text style={style} numberOfLines={expanded ? undefined : numberOfLines}>
        {text}
      </Text>

      {isTruncated && (
        <Text
          style={[styles.seeMore, seeMoreStyle]}
          onPress={() => setExpanded((v) => !v)}
          suppressHighlighting
        >
          {expanded ? 'See less' : 'See more'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  measurer: {
    position: 'absolute',
    opacity: 0,
    zIndex: -1,
    left: 0,
    right: 0,
  },
  seeMore: {
    fontSize: 13,
    fontWeight: '700',
    color: EMERALD,
    marginTop: 4,
  },
});
