import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { Colors } from '../../src/constants/colors';
import { getPatientsToday } from '../../src/services/api';
import { useSessionStore } from '../../src/stores/session-store';
import { useAuthStore } from '../../src/stores/auth-store';
import type { PatientListItem } from '../../src/types';

export default function SelectPatientScreen(): React.JSX.Element {
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmPatient, setConfirmPatient] = useState<PatientListItem | null>(null);
  const selectPatient = useSessionStore((s) => s.selectPatient);
  const clinicName = useAuthStore((s) => s.clinicName);

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async (): Promise<void> => {
    setLoading(true);
    try {
      const result = await getPatientsToday();
      setPatients(result.patients);
    } catch {
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = patients.filter((p) =>
    `${p.firstName} ${p.lastInitial}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  const handleSelect = useCallback((patient: PatientListItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setConfirmPatient(patient);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!confirmPatient) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    selectPatient(confirmPatient);
    setConfirmPatient(null);
    router.push('/(consent)/consent');
  }, [confirmPatient, selectPatient]);

  const getAvatarColor = (name: string): string => {
    const colors = [Colors.sunsetOrange, Colors.grassGreen, Colors.softPurple, Colors.skyBlueDark, Colors.goldenYellow];
    let hash = 0;
    for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length] ?? Colors.sunsetOrange;
  };

  const renderPatient = ({ item }: { item: PatientListItem }): React.JSX.Element => (
    <TouchableOpacity
      style={[styles.card, item.hasSessionToday && styles.cardCompleted]}
      onPress={() => handleSelect(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.avatar, { backgroundColor: getAvatarColor(item.firstName) }]}>
        <Text style={styles.avatarText}>{item.firstName[0]}</Text>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>
          {item.firstName} {item.lastInitial}.
        </Text>
        <Text style={styles.cardAge}>{item.ageDisplay}</Text>
      </View>
      {item.hasSessionToday && (
        <View style={styles.completedBadge}>
          <Text style={styles.completedText}>✓</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{clinicName ?? 'Clinic'}</Text>
        <Text style={styles.headerSubtitle}>Today&apos;s Patients</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search patients..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
      </View>

      {/* Patient list */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.skyBlueDark} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>☁️</Text>
          <Text style={styles.emptyText}>
            {search ? 'No matching patients' : 'No appointments found for today'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderPatient}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Confirm Modal */}
      <Modal visible={confirmPatient !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Start session for</Text>
            <Text style={styles.modalName}>
              {confirmPatient?.firstName} {confirmPatient?.lastInitial}.
            </Text>
            <Text style={styles.modalAge}>{confirmPatient?.ageDisplay}</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setConfirmPatient(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={handleConfirm}
              >
                <Text style={styles.modalConfirmText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.skyBlue,
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 32,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
    opacity: 0.9,
  },
  headerSubtitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.white,
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: 24,
    marginTop: -20,
    marginBottom: 16,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    color: Colors.textDark,
  },
  list: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardCompleted: {
    opacity: 0.6,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.white,
  },
  cardInfo: {
    marginLeft: 16,
    flex: 1,
  },
  cardName: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textDark,
  },
  cardAge: {
    fontSize: 15,
    color: Colors.textMuted,
    marginTop: 2,
  },
  completedBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.grassGreen,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedText: {
    fontSize: 16,
    color: Colors.white,
    fontWeight: '700',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 18,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 32,
    width: 360,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  modalName: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.textDark,
  },
  modalAge: {
    fontSize: 16,
    color: Colors.textMuted,
    marginTop: 4,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancel: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.cloudWhite,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  modalConfirm: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.skyBlue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.white,
  },
});
