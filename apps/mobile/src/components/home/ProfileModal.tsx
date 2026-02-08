import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  userInfo: {
    name: string;
    age: string;
    dob: string;
    gender: string;
    parentContact: string;
    joinedDate: string;
  };
}

export function ProfileModal({
  isOpen,
  onClose,
  username,
  userInfo,
}: ProfileModalProps) {
  if (!isOpen) return null;

  return (
    <Modal transparent visible={isOpen} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>PLAYER PROFILE</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView contentContainerStyle={styles.content}>
            {/* Left - Avatar */}
            <View style={styles.avatarSection}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarLetter}>
                  {username.charAt(0).toUpperCase()}
                </Text>
              </View>
              <TouchableOpacity style={styles.editBtn} activeOpacity={0.7}>
                <Ionicons name="pencil" size={14} color="#4C6A92" />
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
            </View>

            {/* Right - Info */}
            <View style={styles.infoSection}>
              <InfoField label="Name" value={userInfo.name} />
              <InfoField label="Age" value={userInfo.age} />
              <InfoField label="Date of Birth" value={userInfo.dob} />
              <InfoField label="Gender" value={userInfo.gender} />
              <InfoField label="Parent Contact" value={userInfo.parentContact} />
              <InfoField label="Joined Date" value={userInfo.joinedDate} />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '80%',
    maxWidth: 540,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
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
    flexDirection: 'row',
    padding: 28,
    gap: 28,
  },
  avatarSection: {
    alignItems: 'center',
  },
  avatarCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#8FB8A8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 10,
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontSize: 44,
    fontWeight: '700',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editText: {
    color: '#4C6A92',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  infoSection: {
    flex: 1,
  },
  field: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 10,
    color: '#6B7280',
    letterSpacing: 1,
    marginBottom: 3,
    fontWeight: '600',
  },
  fieldValue: {
    fontSize: 15,
    color: '#1F2933',
    fontWeight: '500',
  },
});
