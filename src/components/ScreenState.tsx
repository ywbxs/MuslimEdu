import React, { type ReactElement } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { type ApiResult, FAILURE_COPY } from '../services/http/envelope';

interface ScreenStateProps<T> {
  result: ApiResult<T> | null;
  loading: boolean;
  onRetry: () => void;
  children: (data: T) => ReactElement | null;
  emptyTitle?: string;
  emptyMessage?: string;
  testIDPrefix?: string;
}

/**
 * Renders every required state exactly once (Phase F2 exit criteria):
 * loading, populated, empty, validation, unauthorized, forbidden, throttled,
 * retryable server error, offline.
 *
 * Wrap any API-backed screen body in this component. No screen should branch
 * on HTTP status codes by hand again.
 */
export function ScreenState<T>({
  result,
  loading,
  onRetry,
  children,
  emptyTitle = 'Nothing here yet',
  emptyMessage = 'No records match this view.',
  testIDPrefix = 'screen-state',
}: ScreenStateProps<T>): ReactElement {
  if (loading || result === null) {
    return (
      <View style={styles.center} testID={`${testIDPrefix}-loading`}>
        <ActivityIndicator size="large" />
        <Text style={styles.muted}>Loading</Text>
      </View>
    );
  }

  if (result.status === 'empty') {
    return (
      <View style={styles.center} testID={`${testIDPrefix}-empty`}>
        <Text style={styles.title}>{emptyTitle}</Text>
        <Text style={styles.muted}>{emptyMessage}</Text>
        <RetryButton onPress={onRetry} label="Refresh" testID={`${testIDPrefix}-empty-retry`} />
      </View>
    );
  }

  if (result.status === 'failure') {
    const title =
      result.kind === 'forbidden'
        ? 'Not allowed'
        : result.kind === 'unauthenticated'
          ? 'Session expired'
          : result.kind === 'offline'
            ? 'Offline'
            : result.kind === 'throttled'
              ? 'Slow down'
              : result.kind === 'validation'
                ? 'Check your input'
                : 'Something went wrong';

    return (
      <View style={styles.center} testID={`${testIDPrefix}-${result.kind}`}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.muted}>{result.message || FAILURE_COPY[result.kind]}</Text>

        {result.fieldErrors
          ? Object.entries(result.fieldErrors).map(([field, messages]) => (
              <Text key={field} style={styles.fieldError}>
                {field}: {messages.join(' ')}
              </Text>
            ))
          : null}

        {result.retryable ? (
          <RetryButton onPress={onRetry} label="Try again" testID={`${testIDPrefix}-retry`} />
        ) : null}
      </View>
    );
  }

  return <>{children(result.data)}</>;
}

function RetryButton({
  onPress,
  label,
  testID,
}: {
  onPress: () => void;
  label: string;
  testID: string;
}): ReactElement {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress} testID={testID} accessibilityRole="button">
      <Text style={styles.buttonLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  muted: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
  fieldError: {
    fontSize: 13,
    color: '#b3261e',
    textAlign: 'center',
  },
  button: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
});
