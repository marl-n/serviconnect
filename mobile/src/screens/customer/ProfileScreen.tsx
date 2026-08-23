import React from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, ScrollView
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

interface Props {
  user: any;
  onLogout: () => void;
}

export default function ProfileScreen({ user, onLogout }: Props) {
  const initials = user?.name
    ?.split(' ')
    .map((n: string) => n.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '?';

  const menuItems: { label: string; icon: string; onPress: () => void }[] = [
    { label: 'My quote requests', icon: 'file-text-o', onPress: () => {} },
    { label: 'Saved businesses', icon: 'heart-o', onPress: () => {} },
    { label: 'Notifications', icon: 'bell-o', onPress: () => {} },
    { label: 'Help & support', icon: 'comment-o', onPress: () => {} },
  ];

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>My Account</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* User card */}
        <View style={s.userCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <View style={s.userMeta}>
            <Text style={s.userName}>{user?.name ?? 'User'}</Text>
            <Text style={s.userPhone}>{user?.phone}</Text>
            <View style={s.roleBadge}>
              <Text style={s.roleText}>{user?.role ?? 'CUSTOMER'}</Text>
            </View>
          </View>
        </View>

        {/* Menu items */}
        <View style={s.menuSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[s.menuItem, index === menuItems.length - 1 && s.menuItemLast]}
              onPress={item.onPress}>
              <View style={s.menuIconBox}>
                <FontAwesome name={item.icon as any} size={16} color="#6B7280" />
              </View>
              <Text style={s.menuLabel}>{item.label}</Text>
              <FontAwesome name="chevron-right" size={12} color="#D1D5DB" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity style={s.logoutBtn} onPress={onLogout}>
          <FontAwesome name="sign-out" size={16} color="#DC2626" style={{ marginRight: 8 }} />
          <Text style={s.logoutText}>Log out</Text>
        </TouchableOpacity>

        <Text style={s.version}>ServiConnect v1.0 · Joburg</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FB' },
  header: { backgroundColor: '#0D1B4B', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 16 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  userCard: { margin: 14, backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 0.5, borderColor: '#E5E7EB' },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#1A56F0', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  userMeta: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 3 },
  userPhone: { fontSize: 13, color: '#6B7280', marginBottom: 8 },
  roleBadge: { backgroundColor: '#EFF6FF', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  roleText: { fontSize: 10, fontWeight: '700', color: '#1D4ED8' },
  menuSection: { marginHorizontal: 14, backgroundColor: '#fff', borderRadius: 16, borderWidth: 0.5, borderColor: '#E5E7EB', overflow: 'hidden', marginBottom: 14 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6', gap: 12 },
  menuItemLast: { borderBottomWidth: 0 },
  menuIconBox: { width: 28, alignItems: 'center' },
  menuLabel: { flex: 1, fontSize: 14, color: '#111827', fontWeight: '500' },
  logoutBtn: { marginHorizontal: 14, backgroundColor: '#FEF2F2', borderRadius: 14, paddingVertical: 15, alignItems: 'center', borderWidth: 0.5, borderColor: '#FECACA', flexDirection: 'row', justifyContent: 'center' },
  logoutText: { color: '#DC2626', fontWeight: '700', fontSize: 15 },
  version: { textAlign: 'center', fontSize: 11, color: '#D1D5DB', marginTop: 16 },
});