import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';

const TOP_RIGHT_COLOR = '#1FAE64';
const BOTTOM_LEFT_COLOR = '#4CAF50';
const TOP_RIGHT_SIZE = 220;
const BOTTOM_LEFT_SIZE = 180;

/**
 * Soft luminous glow for a dark dashboard hero - a bright core fading
 * smoothly to nothing via a real radial gradient, not a flat-opacity disc.
 * A plain View with backgroundColor + borderRadius (the previous
 * implementation, duplicated across every dashboard's hero) can only ever
 * render a uniform-opacity circle - every pixel inside it is the exact same
 * color, so it reads as a faint flat blob rather than an actual glow, no
 * matter how the opacity is tuned. A radial gradient is bright at the center
 * and genuinely fades to fully transparent at the edge, which is what makes
 * it look like light instead of a shape.
 */
interface HeroGlowProps {
  /** Default true - pass false to omit that circle (e.g. the login card only
   * wants the top-right one; the bottom-left one poked out past the card's
   * rounded corner as a hard-edged wedge once the glow was moved outside
   * the card's overflow:'hidden', since the card itself covers the rest of
   * that circle rather than the whole thing blending into a page-colored
   * background). */
  topRight?: boolean;
  bottomLeft?: boolean;
  /** Override the two greens - e.g. Prayer Times syncs these to the current
   * time of day (dark blue at night, gold in the morning...) instead of the
   * fixed brand green every other hero uses. */
  topRightColor?: string;
  bottomLeftColor?: string;
}

export default function HeroGlow({
  topRight = true,
  bottomLeft = true,
  topRightColor = TOP_RIGHT_COLOR,
  bottomLeftColor = BOTTOM_LEFT_COLOR,
}: HeroGlowProps) {
  return (
    <>
      {topRight && (
        <Svg width={TOP_RIGHT_SIZE} height={TOP_RIGHT_SIZE} style={styles.topRight} pointerEvents="none">
          <Defs>
            <RadialGradient id="heroGlowTopRight" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={topRightColor} stopOpacity={0.55} />
              <Stop offset="1" stopColor={topRightColor} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={TOP_RIGHT_SIZE / 2} cy={TOP_RIGHT_SIZE / 2} r={TOP_RIGHT_SIZE / 2} fill="url(#heroGlowTopRight)" />
        </Svg>
      )}
      {bottomLeft && (
        <Svg width={BOTTOM_LEFT_SIZE} height={BOTTOM_LEFT_SIZE} style={styles.bottomLeft} pointerEvents="none">
          <Defs>
            <RadialGradient id="heroGlowBottomLeft" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={bottomLeftColor} stopOpacity={0.4} />
              <Stop offset="1" stopColor={bottomLeftColor} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={BOTTOM_LEFT_SIZE / 2} cy={BOTTOM_LEFT_SIZE / 2} r={BOTTOM_LEFT_SIZE / 2} fill="url(#heroGlowBottomLeft)" />
        </Svg>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  topRight: { position: 'absolute', top: -70, right: -70 },
  bottomLeft: { position: 'absolute', bottom: -80, left: -50 },
});
