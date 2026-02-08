import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { Colors } from '../../src/constants/colors';
import { createSession } from '../../src/services/api';
import { useSessionStore } from '../../src/stores/session-store';
import { useAuthStore } from '../../src/stores/auth-store';

interface ConsentBullet {
  icon: string;
  text: string;
}

const BULLETS: ConsentBullet[] = [
  { icon: '🎮', text: 'Your child will play fun games on this tablet' },
  { icon: '📊', text: "Games help the doctor track your child's development" },
  { icon: '🚫', text: 'No photos, videos, or recordings are taken' },
  { icon: '🗑️', text: 'You can ask to delete this data at any time' },
];

export default function ConsentScreen(): React.JSX.Element {
  const [loading, setLoading] = useState(false);
  const selectedPatient = useSessionStore((s) => s.selectedPatient);
  const startSession = useSessionStore((s) => s.startSession);
  const tabletId = useAuthStore((s) => s.tabletId);

  const handleConsent = useCallback(async () => {
    if (!selectedPatient || !tabletId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      const result = await createSession(selectedPatient.id, tabletId);
      startSession(result.sessionId, result.gamesConfig.games);
      router.replace('/(game)/hub');
    } catch {
      setLoading(false);
    }
  }, [selectedPatient, startSession, tabletId]);

  const handleDecline = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, []);

  return (
    <View style={styles.container}>
      {/* Cloud decorations */}
      <View style={styles.cloudLeft}>
        <Text style={styles.cloudEmoji}>☁️</Text>
      </View>
      <View style={styles.cloudRight}>
        <Text style={styles.cloudEmoji}>☁️</Text>
      </View>

      <View style={styles.card}>
        {/* Header */}
        <Text style={styles.kiteEmoji}>🪁</Text>
        <Text style={styles.title}>Welcome to Kite!</Text>
        <Text style={styles.subtitle}>
          {selectedPatient
            ? `${selectedPatient.firstName} is about to play some fun games!`
            : 'Your child is about to play some fun games!'}
        </Text>

        {/* Bullets */}
        <View style={styles.bullets}>
          {BULLETS.map((bullet, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bulletIcon}>{bullet.icon}</Text>
              <Text style={styles.bulletText}>{bullet.text}</Text>
            </View>
          ))}
        </View>

        {/* Buttons */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleConsent}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.primaryButtonText}>Start Playing ✨</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleDecline}
          activeOpacity={0.7}
        >
          <Text style={styles.secondaryButtonText}>No Thanks</Text>
        </TouchableOpacity>
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
  cloudLeft: {
    position: 'absolute',
    top: 100,
    left: 40,
    opacity: 0.5,
  },
  cloudRight: {
    position: 'absolute',
    top: 60,
    right: 60,
    opacity: 0.4,
  },
  cloudEmoji: {
    fontSize: 60,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 32,
    padding: 40,
    width: 480,
    maxWidth: '90%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
  },
  kiteEmoji: {
    fontSize: 56,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.textDark,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 17,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 24,
  },
  bullets: {
    width: '100%',
    gap: 16,
    marginBottom: 32,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  bulletIcon: {
    fontSize: 28,
    width: 40,
    textAlign: 'center',
  },
  bulletText: {
    fontSize: 17,
    color: Colors.textDark,
    flex: 1,
    lineHeight: 24,
  },
  primaryButton: {
    width: '100%',
    height: 60,
    borderRadius: 16,
    backgroundColor: Colors.goldenYellow,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: Colors.goldenYellow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textDark,
  },
  secondaryButton: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    color: Colors.textMuted,
    fontWeight: '500',
  },
});
