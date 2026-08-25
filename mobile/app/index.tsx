import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FontAwesome } from '@expo/vector-icons';
import { authApi, businessApi } from '../src/services/api';
import LoginScreen from '../src/screens/auth/LoginScreen';
import SearchScreen from '../src/screens/customer/SearchScreen';
import ProfileScreen from '../src/screens/customer/ProfileScreen';
import DashboardScreen from '../src/screens/business/DashboardScreen';
import OnboardingScreen from '../src/screens/business/OnboardingScreen';
import MyQuotesScreen from '../src/screens/customer/MyQuotesScreen';

type Tab = 'search' | 'profile' | 'quotes';

interface AppState {
  user: any;
  business: any;
}

export default function Index() {
  const [appState, setAppState] = useState<AppState | null>(null);
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('search');

  useEffect(() => {
    AsyncStorage.getItem('sc_token').then(async token => {
      if (token) {
        try {
          const res = await authApi.getMe();
          const user = res.data;

          let business = null;
          if (user.role === 'BUSINESS') {
            try {
              const bizRes = await businessApi.getMyBusiness();
              business = bizRes.data ?? null;
            } catch {
              business = null;
            }
          }

          setAppState({ user, business });
        } catch {
          await AsyncStorage.removeItem('sc_token');
        }
      }
      setChecking(false);
    });
  }, []);

  const logout = async () => {
    await AsyncStorage.removeItem('sc_token');
    setAppState(null);
    setActiveTab('search');
  };

  if (checking) return (
    <View style={s.centered}>
      <ActivityIndicator size="large" color="#1A56F0" />
    </View>
  );

  if (!appState) return (
    <LoginScreen onLoginSuccess={async (user) => {
      let business = null;
      if (user.role === 'BUSINESS') {
        try {
          const bizRes = await businessApi.getMyBusiness();
          business = bizRes.data ?? null;
        } catch {
          business = null;
        }
      }
      setAppState({ user, business });
    }} />
  );

  const { user, business } = appState;

  // Business user with no profile — show onboarding
  if (user.role === 'BUSINESS' && !business) return (
    <OnboardingScreen onComplete={(biz) => setAppState({ user, business: biz })} />
  );

  // Business user with profile — show dashboard
  if (user.role === 'BUSINESS' && business) return (
    <DashboardScreen
      onViewLead={(id) => {}}
      onLogout={logout}
    />
  );

  // Customer tab layout
  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'search', label: 'Search', icon: 'search' },
    { key: 'profile', label: 'Account', icon: 'user' },
    { key: 'quotes', label: 'My Quotes', icon: 'file-text-o' },
  ];

  return (
    <View style={s.shell}>
      <View style={s.content}>
        {activeTab === 'search' && <SearchScreen />}
        {activeTab === 'profile' && <ProfileScreen user={user} onLogout={logout} />}
        {activeTab === 'quotes' && <MyQuotesScreen onViewBusiness={(slug) => {}} />}
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