import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface HomeHeaderProps {
  stars: number;
  username: string;
  onMenuPress: () => void;
  onProfilePress: () => void;
}

export function HomeHeader({
  stars,
  username,
  onMenuPress,
  onProfilePress,
}: HomeHeaderProps) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.menuBtn}
        onPress={onMenuPress}
        activeOpacity={0.7}
      >
        <Ionicons name="menu" size={28} color="rgba(255,255,255,0.9)" />
      </TouchableOpacity>

      <View style={styles.rightGroup}>
        <View style={styles.starPill}>
          <Ionicons name="star" size={20} color="#F6C445" />
          <Text style={styles.starText}>{stars.toLocaleString()}</Text>
        </View>

        <TouchableOpacity
          style={styles.profilePill}
          onPress={onProfilePress}
          activeOpacity={0.7}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>
              {username.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.profileName}>{username}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#4C6A92',
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  menuBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  starPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    minWidth: 130,
    justifyContent: 'center',
  },
  starText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    minWidth: 160,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#8FB8A8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  profileName: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    letterSpacing: 0.5,
    fontWeight: '500',
  },
});
