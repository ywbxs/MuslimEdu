import React, { useState } from 'react';
import { Text, View, TextStyle, StyleSheet, StyleProp } from 'react-native';

const EMERALD = '#2BCBB0';

interface Props {
  text: string;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  seeMoreStyle?: StyleProp<TextStyle>;
  // Alternative to numberOfLines: truncate by paragraph count instead of
  // measured line count, so "See more" kicks in based on how much the
  // author actually wrote (paragraph breaks) rather than how the device
  // happens to wrap it. Takes over entirely when set - numberOfLines is
  // ignored, since the two strategies would otherwise fight over what
  // "truncated" means.
  maxParagraphs?: number;
}

/**
 * Renders text truncated to `numberOfLines` (or, with `maxParagraphs` set,
 * to that many paragraphs instead), with a "See more" toggle that appears
 * only if the text actually overflows. Tapping it expands the full text
 * (and shows "See less" to collapse again).
 */
export default function ExpandableText({ text, numberOfLines = 6, style, seeMoreStyle, maxParagraphs }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);

  if (maxParagraphs != null) {
    const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim() !== '');
    const overflows = paragraphs.length > maxParagraphs;
    const previewText = overflows ? paragraphs.slice(0, maxParagraphs).join('\n\n') : text;

    return (
      <View>
        <Text style={style}>{expanded ? text : previewText}</Text>
        {overflows && (
          <Text style={[styles.seeMore, seeMoreStyle]} onPress={() => setExpanded((v) => !v)} suppressHighlighting>
            {expanded ? 'See less' : 'See more'}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View>
      {/* Hidden measurer: same style, unlimited lines, not interactive/visible.
          Only needed for the line-count strategy - onTextLayout on an
          already-truncated <Text> only reports the visible (truncated)
          lines, not the true total, so a full-height copy measures it. */}
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
