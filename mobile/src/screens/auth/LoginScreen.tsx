import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { authApi, saveToken } from '../../services/api';

interface Props {
  onLoginSuccess: (user: any) => void;
}

export default function LoginScreen({ onLoginSuccess }: Props) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'CUSTOMER' | 'BUSINESS' | null>(null);
  const [step, setStep] = useState<'role' | 'phone' | 'otp'>('role');
  const [loading, setLoading] = useState(false);

  const sendOtp = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    try {
      await authApi.sendOtp(phone.trim());
      setStep('otp');
    } catch {
      Alert.alert('Error', 'Could not send OTP. Check your number and try again.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    try {
      const res = await authApi.verifyOtp(
        phone.trim(),
        code,
        role ?? 'CUSTOMER',
        name.trim() || undefined
      );
      await saveToken(res.data.token);
      onLoginSuccess(res.data.user);
    } catch {
      Alert.alert('Error', 'Invalid or expired OTP. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderRole = () => (
    <>
      <View style={s.logoRow}>
        <View style={s.logoBox}>
          <Text style={s.logoText}>S</Text>
        </View>
        <Text style={s.logoLabel}>ServiConnect</Text>
      </View>
      <Text style={s.heading}>Welcome</Text>
      <Text style={s.subheading}>Are you looking for a service or offering one?</Text>

      <TouchableOpacity
        style={[s.roleCard, role === 'CUSTOMER' && s.roleCardActive]}
        onPress={() => setRole('CUSTOMER')}>
        <View style={s.roleIconBox}>
          <FontAwesome name="search" size={22} color={role === 'CUSTOMER' ? '#1A56F0' : '#6B7280'} />
        </View>
        <View style={s.roleMeta}>
          <Text style={[s.roleTitle, role === 'CUSTOMER' && s.roleTitleActive]}>I need a service</Text>
          <Text style={s.roleSub}>Find trusted local businesses</Text>
        </View>
        {role === 'CUSTOMER' && <FontAwesome name="check-circle" size={20} color="#1A56F0" />}
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.roleCard, role === 'BUSINESS' && s.roleCardActive]}
        onPress={() => setRole('BUSINESS')}>
        <View style={s.roleIconBox}>
          <FontAwesome name="briefcase" size={22} color={role === 'BUSINESS' ? '#1A56F0' : '#6B7280'} />
        </View>
        <View style={s.roleMeta}>
          <Text style={[s.roleTitle, role === 'BUSINESS' && s.roleTitleActive]}>I offer a service</Text>
          <Text style={s.roleSub}>Get leads and grow your business</Text>
        </View>
        {role === 'BUSINESS' && <FontAwesome name="check-circle" size={20} color="#1A56F0" />}
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.btn, !role && s.btnDisabled]}
        onPress={() => role && setStep('phone')}
        disabled={!role}>
        <Text style={s.btnText}>Continue</Text>
      </TouchableOpacity>
    </>
  );

  const renderPhone = () => (
    <>
      <TouchableOpacity onPress={() => setStep('role')} style={s.backRow}>
        <FontAwesome name="arrow-left" size={14} color="#6B7280" />
        <Text style={s.backText}>Back</Text>
      </TouchableOpacity>

      <Text style={s.heading}>
        {role === 'BUSINESS' ? 'Business login' : 'Welcome back'}
      </Text>
      <Text style={s.subheading}>Enter your phone number to get started</Text>

      <Text style={s.label}>Phone number</Text>
      <TextInput
        style={s.input}
        placeholder="e.g. 082 555 0000"
        placeholderTextColor="#9CA3AF"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
        editable={!loading}
      />

      <TouchableOpacity
        style={[s.btn, (!phone.trim() || loading) && s.btnDisabled]}
        onPress={sendOtp}
        disabled={!phone.trim() || loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.btnText}>Send OTP</Text>}
      </TouchableOpacity>
    </>
  );

  const renderOtp = () => (
    <>
      <TouchableOpacity onPress={() => setStep('phone')} style={s.backRow}>
        <FontAwesome name="arrow-left" size={14} color="#6B7280" />
        <Text style={s.backText}>Change number</Text>
      </TouchableOpacity>

      <Text style={s.heading}>Enter your OTP</Text>
      <Text style={s.subheading}>Sent to {phone}</Text>

      <Text style={s.label}>Your name</Text>
      <TextInput
        style={s.input}
        placeholder="e.g. Thabo Dlamini"
        placeholderTextColor="#9CA3AF"
        value={name}
        onChangeText={setName}
        editable={!loading}
      />

      <Text style={s.label}>6-digit code</Text>
      <TextInput
        style={[s.input, s.otpInput]}
        placeholder="000000"
        placeholderTextColor="#9CA3AF"
        keyboardType="number-pad"
        maxLength={6}
        value={code}
        onChangeText={setCode}
        editable={!loading}
      />

      <TouchableOpacity
        style={[s.btn, (code.length !== 6 || loading) && s.btnDisabled]}
        onPress={verifyOtp}
        disabled={code.length !== 6 || loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.btnText}>Verify & Continue</Text>}
      </TouchableOpacity>
    </>
  );

 return (
  <KeyboardAvoidingView
    style={s.container}
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView
      contentContainerStyle={s.scroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      <View style={s.card}>
        {step === 'role' && renderRole()}
        {step === 'phone' && renderPhone()}
        {step === 'otp' && renderOtp()}
      </View>
    </ScrollView>
  </KeyboardAvoidingView>
);
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FB', justifyContent: 'center',  },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 20, elevation: 4 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 },
  logoBox: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#1A56F0', justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  logoLabel: { fontSize: 20, fontWeight: '700', color: '#0D1B4B' },
  heading: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 6 },
  subheading: { fontSize: 13, color: '#6B7280', marginBottom: 24, lineHeight: 20 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  backText: { fontSize: 13, color: '#6B7280' },
  roleCard: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  roleCardActive: { borderColor: '#1A56F0', backgroundColor: '#EFF6FF' },
  roleIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  roleMeta: { flex: 1 },
  roleTitle: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 2 },
  roleTitleActive: { color: '#1A56F0' },
  roleSub: { fontSize: 12, color: '#6B7280' },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: '#111827', marginBottom: 14 },
  otpInput: { textAlign: 'center', fontSize: 24, letterSpacing: 10, fontWeight: '700' },
  btn: { backgroundColor: '#1A56F0', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
});