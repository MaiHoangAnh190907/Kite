import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

interface SettingsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}

const SIDEBAR_WIDTH = 360;
const LANGUAGES = ['English', 'Español', 'Français', 'Deutsch', '中文', '日本語'];

export function SettingsSidebar({ isOpen, onClose, onLogout }: SettingsSidebarProps) {
  const [soundVolume, setSoundVolume] = useState(75);
  const [musicVolume, setMusicVolume] = useState(60);
  const [vibration, setVibration] = useState(true);
  const [language, setLanguage] = useState('English');
  const translateX = useSharedValue(-SIDEBAR_WIDTH);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (isOpen) {
      translateX.value = withSpring(0, { damping: 25, stiffness: 300 });
      backdropOpacity.value = withTiming(1, { duration: 200 });
    } else {
      translateX.value = withSpring(-SIDEBAR_WIDTH, { damping: 25, stiffness: 300 });
      backdropOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [isOpen, translateX, backdropOpacity]);

  const sidebarStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (!isOpen) return null;

  return (
    <Modal transparent visible={isOpen} animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View style={[styles.sidebar, sidebarStyle]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>SETTINGS</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {/* Sound Volume */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="volume-high" size={22} color="#4C6A92" />
                <Text style={styles.sectionLabel}>Sound Volume</Text>
              </View>
              <VolumeSlider value={soundVolume} onChange={setSoundVolume} />
            </View>

            {/* Music Volume */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="musical-notes" size={22} color="#4C6A92" />
                <Text style={styles.sectionLabel}>Music Volume</Text>
              </View>
              <VolumeSlider value={musicVolume} onChange={setMusicVolume} />
            </View>

            {/* Vibration */}
            <View style={styles.section}>
              <View style={styles.toggleRow}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="phone-portrait" size={22} color="#4C6A92" />
                  <Text style={styles.sectionLabel}>Vibration</Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.toggle,
                    vibration ? styles.toggleOn : styles.toggleOff,
                  ]}
                  onPress={() => setVibration(!vibration)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.toggleThumb,
                      vibration ? styles.toggleThumbOn : styles.toggleThumbOff,
                    ]}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Language */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="globe" size={22} color="#4C6A92" />
                <Text style={styles.sectionLabel}>Language</Text>
              </View>
              <View style={styles.langGrid}>
                {LANGUAGES.map((lang) => (
                  <TouchableOpacity
                    key={lang}
                    style={[
                      styles.langBtn,
                      language === lang && styles.langBtnActive,
                    ]}
                    onPress={() => setLanguage(lang)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.langText,
                        language === lang && styles.langTextActive,
                      ]}
                    >
                      {lang}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Logout */}
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={onLogout}
              activeOpacity={0.8}
            >
              <Ionicons name="log-out" size={20} color="#FFFFFF" />
              <Text style={styles.logoutText}>Return to Patient List</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// Simple volume slider with tappable segments
function VolumeSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const steps = [0, 25, 50, 75, 100];

  return (
    <View>
      <View style={sliderStyles.track}>
        <View
          style={[
            sliderStyles.fill,
            { width: `${value}%` },
          ]}
        />
        {/* Touch zones */}
        <View style={sliderStyles.touchRow}>
          {steps.map((step) => (
            <TouchableOpacity
              key={step}
              style={sliderStyles.touchZone}
              onPress={() => onChange(step)}
              activeOpacity={1}
            />
          ))}
        </View>
      </View>
      <View style={sliderStyles.labels}>
        <Text style={sliderStyles.labelMuted}>0</Text>
        <Text style={sliderStyles.labelValue}>{value}</Text>
        <Text style={sliderStyles.labelMuted}>100</Text>
      </View>
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  track: {
    height: 8,
    backgroundColor: '#F4F6F5',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: 8,
    backgroundColor: '#8FB8A8',
    borderRadius: 4,
  },
  touchRow: {
    position: 'absolute',
    top: -10,
    left: 0,
    right: 0,
    bottom: -10,
    flexDirection: 'row',
  },
  touchZone: {
    flex: 1,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  labelMuted: {
    fontSize: 12,
    color: '#6B7280',
  },
  labelValue: {
    fontSize: 12,
    color: '#4C6A92',
    fontWeight: '600',
  },
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 12, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 10,
  },
  header: {
    backgroundColor: '#4C6A92',
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sectionLabel: {
    color: '#1F2933',
    fontSize: 15,
    letterSpacing: 0.5,
    fontWeight: '500',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggle: {
    width: 52,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleOn: {
    backgroundColor: '#8FB8A8',
  },
  toggleOff: {
    backgroundColor: '#CBD5E1',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  toggleThumbOn: {
    alignSelf: 'flex-end',
  },
  toggleThumbOff: {
    alignSelf: 'flex-start',
  },
  langGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  langBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#F4F6F5',
    minWidth: '45%',
    alignItems: 'center',
  },
  langBtnActive: {
    backgroundColor: '#4C6A92',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  langText: {
    fontSize: 13,
    color: '#6B7280',
  },
  langTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#CBD5E1',
    marginVertical: 8,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#D97C7C',
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    marginTop: 8,
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
