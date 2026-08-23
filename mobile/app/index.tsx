import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FontAwesome } from '@expo/vector-icons';
import { authApi } from '../src/services/api';
import LoginScreen from '../src/screens/auth/LoginScreen';
import SearchScreen from '../src/screens/customer/SearchScreen';
import ProfileScreen from '../src/screens/customer/ProfileScreen';
import DashboardScreen from '../src/screens/business/DashboardScreen';

type Tab = 'search' | 'profile';

export default function Index() {
  const [user, setUser] = useState<any>(null);
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('search');

  useEffect(() => {
    AsyncStorage.getItem('sc_token').then(async token => {
      if (token) {
        try {
          const res = await authApi.getMe();
          setUser(res.data);
        } catch {
          await AsyncStorage.removeItem('sc_token');
        }
      }
      setChecking(false);
    });
  }, []);

  const logout = async () => {
    await AsyncStorage.removeItem('sc_token');
    setUser(null);
    setActiveTab('search');
  };

  if (checking) return (
    <View style={s.centered}>
      <ActivityIndicator size="large" color="#1A56F0" />
    </View>
  );

  if (!user) return (
    <LoginScreen onLoginSuccess={(u) => setUser(u)} />
  );

  if (user.role === 'BUSINESS') return (
    <DashboardScreen
  onViewLead={(id) => {}}
  onLogout={logout}
/>
  );

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'search', label: 'Search', icon: 'search' },
    { key: 'profile', label: 'Account', icon: 'user' },
  ];

  return (
    <View style={s.shell}>
      <View style={s.content}>
        {activeTab === 'search' && <SearchScreen />}
        {activeTab === 'profile' && <ProfileScreen user={user} onLogout={logout} />}
      </View>

      <View style={s.tabBar}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={s.tabItem}
            onPress={() => setActiveTab(tab.key)}>
            <FontAwesome
              name={tab.icon as any}
              size={20}
              color={activeTab === tab.key ? '#1A56F0' : '#9CA3AF'}
            />
            <Text style={[s.tabLabel, activeTab === tab.key && s.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  shell: { flex: 1, backgroundColor: '#F4F6FB' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F6FB' },
  content: { flex: 1 },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 0.5, borderTopColor: '#E5E7EB', paddingBottom: 24, paddingTop: 10 },
  tabItem: { flex: 1, alignItems: 'center', gap: 4 },
  tabLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '500', marginTop: 2 },
  tabLabelActive: { color: '#1A56F0', fontWeight: '700' },
});