import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';

import { Colors } from '../../src/constants/colors';
import { tabletVerify } from '../../src/services/api';
import { useAuthStore } from '../../src/stores/auth-store';
import { getPendingCount, flushQueue, startBackgroundRetry } from '../../src/services/upload-queue';

const PIN_LENGTH = 4;

export default function LoginScreen(): React.JSX.Element {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [pendingSyncs, setPendingSyncs] = useState(0);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const setAuth = useAuthStore((s) => s.setAuth);

  // Check for pending uploads and try to flush them
  useEffect(() => {
    const checkQueue = async () => {
      const count = await getPendingCount();
      setPendingSyncs(count);
      if (count > 0) {
        startBackgroundRetry();
        // Also try an immediate flush
        await flushQueue();
        const newCount = await getPendingCount();
        setPendingSyncs(newCount);
      }
    };
    checkQueue();
    const interval = setInterval(checkQueue, 30_000);
    return () => clearInterval(interval);
  }, []);

  const triggerShake = useCallback(() => {
    setError(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 15, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -15, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start(() => {
      setTimeout(() => {
        setPin('');
        setError(false);
      }, 300);
    });
  }, [shakeAnim]);

  const handleSubmit = useCallback(async (currentPin: string) => {
    if (currentPin.length < PIN_LENGTH) return;
    setLoading(true);
    try {
      const result = await tabletVerify(currentPin);
      await SecureStore.setItemAsync('tablet_jwt', result.accessToken);
      setAuth(result.accessToken, result.staffName, result.clinicName, result.tabletId);
      router.replace('/(staff)/select-patient');
    } catch {
      triggerShake();
    } finally {
      setLoading(false);
    }
  }, [setAuth, triggerShake]);

  const handleKeyPress = useCallback((key: string) => {
    if (loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (key === 'delete') {
      setPin((prev) => prev.slice(0, -1));
      setError(false);
      return;
    }


    setPin((prev) => {
      if (prev.length >= PIN_LENGTH) return prev;
      const next = prev + key;
      if (next.length === PIN_LENGTH) {
        setTimeout(() => handleSubmit(next), 100);
      }
      return next;
    });
  }, [loading, pin, handleSubmit]);

  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['delete', '0', ''],
  ];

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Logo area */}
        <View style={styles.logoArea}>
          <Text style={styles.logoIcon}>🪁</Text>
          <Text style={styles.title}>Kite</Text>
          <Text style={styles.subtitle}>Staff PIN</Text>
        </View>

        {/* PIN dots */}
        <Animated.View
          style={[styles.dotsContainer, { transform: [{ translateX: shakeAnim }] }]}
        >
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i < pin.length && styles.dotFilled,
                error && i < pin.length && styles.dotError,
              ]}
            />
          ))}
        </Animated.View>

        {error && (
          <Text style={styles.errorText}>Invalid PIN</Text>
        )}

        {/* Pending sync indicator */}
        {pendingSyncs > 0 && (
          <View style={styles.syncBadge}>
            <View style={styles.syncDot} />
            <Text style={styles.syncText}>
              {pendingSyncs} session{pendingSyncs > 1 ? 's' : ''} pending sync
            </Text>
          </View>
        )}

        {/* Keypad */}
        <View style={styles.keypad}>
          {keys.map((row, rowIdx) => (
            <View key={rowIdx} style={styles.keyRow}>
              {row.map((key, keyIdx) => {
                if (key === '') {
                  return <View key={`empty-${keyIdx}`} style={styles.keyEmpty} />;
                }
                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.key,
                      key === 'delete' && styles.keySpecial,
                    ]}
                    onPress={() => handleKeyPress(key)}
                    disabled={loading}
                    activeOpacity={0.7}
                  >
                    {key === 'delete' ? (
                      <Text style={styles.keySpecialText}>⌫</Text>
                    ) : (
                      <Text style={styles.keyText}>{key}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.skyBlue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    width: 360,
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoIcon: {
    fontSize: 64,
    marginBottom: 8,
  },
  title: {
    fontSize: 42,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 18,
    color: Colors.cloudWhite,
    marginTop: 4,
    fontWeight: '500',
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
    height: 24,
    alignItems: 'center',
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: Colors.white,
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: Colors.white,
  },
  dotError: {
    backgroundColor: Colors.errorRed,
    borderColor: Colors.errorRed,
  },
  errorText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: 'hidden',
  },
  keypad: {
    marginTop: 16,
    gap: 12,
  },
  keyRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  key: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyEmpty: {
    width: 88,
    height: 88,
  },
  keySpecial: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  keyText: {
    fontSize: 32,
    fontWeight: '500',
    color: Colors.white,
  },
  keySpecialText: {
    fontSize: 28,
    color: Colors.white,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 140, 66, 0.25)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 8,
  },
  syncDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.sunsetOrange,
  },
  syncText: {
    fontSize: 13,
    color: Colors.white,
    fontWeight: '500',
  },
});
