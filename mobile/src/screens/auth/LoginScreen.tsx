import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { authApi, saveToken } from '../../services/api';

interface Props {
  onLoginSuccess: (user: any) => void;
}

export default function LoginScreen({ onLoginSuccess }: Props) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

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
      const res = await authApi.verifyOtp(phone.trim(), code, 'CUSTOMER', name.trim() || undefined);
      await saveToken(res.data.token);
      setIsNewUser(res.data.isNewUser);
      onLoginSuccess(res.data.user);
    } catch {
      Alert.alert('Error', 'Invalid or expired OTP. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.card}>
        {/* Logo */}
        <View style={s.logoRow}>
          <View style={s.logoBox}>
            <Text style={s.logoText}>S</Text>
          </View>
          <Text style={s.logoLabel}>ServiConnect</Text>
        </View>

        {step === 'phone' ? (
          <>
            <Text style={s.heading}>Find services near you</Text>
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
        ) : (
          <>
            <Text style={s.heading}>Enter your OTP</Text>
            <Text style={s.subheading}>Sent to {phone}</Text>

            {isNewUser && (
              <>
                <Text style={s.label}>Your name</Text>
                <TextInput
                  style={s.input}
                  placeholder="e.g. Thabo Dlamini"
                  placeholderTextColor="#9CA3AF"
                  value={name}
                  onChangeText={setName}
                  editable={!loading}
                />
              </>
            )}

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

            <TouchableOpacity onPress={() => { setStep('phone'); setCode(''); }} style={s.backBtn}>
              <Text style={s.backText}>← Change number</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FB', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 20, elevation: 4 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 },
  logoBox: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#1A56F0', justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  logoLabel: { fontSize: 20, fontWeight: '700', color: '#0D1B4B' },
  heading: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 6 },
  subheading: { fontSize: 13, color: '#6B7280', marginBottom: 24, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: '#111827', marginBottom: 14 },
  otpInput: { textAlign: 'center', fontSize: 24, letterSpacing: 10, fontWeight: '700' },
  btn: { backgroundColor: '#1A56F0', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  backBtn: { marginTop: 16, alignItems: 'center' },
  backText: { color: '#6B7280', fontSize: 13 },
});