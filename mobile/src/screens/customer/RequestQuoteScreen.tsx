import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator
} from 'react-native';
import { leadsApi } from '../../services/api';

interface Props {
  businessId: string;
  businessName: string;
  onBack: () => void;
  onSuccess: () => void;
}

export default function RequestQuoteScreen({ businessId, businessName, onBack, onSuccess }: Props) {
  const [message, setMessage] = useState('');
  const [jobAddress, setJobAddress] = useState('');
  const [budget, setBudget] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!message.trim()) {
      Alert.alert('Required', 'Please describe the job you need done.');
      return;
    }
    setLoading(true);
    try {
      await leadsApi.createLead({
        businessId,
        message: message.trim(),
        jobAddress: jobAddress.trim() || undefined,
        budget: budget ? Math.round(parseFloat(budget) * 100) : undefined,
      });
      Alert.alert(
        'Quote Requested!',
        `${businessName} has received your request and will get back to you shortly.`,
        [{ text: 'OK', onPress: onSuccess }]
      );
    } catch (err: any) {
      const msg = err?.response?.status === 401
        ? 'You need to log in to request a quote.'
        : 'Something went wrong. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Request Quote</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.bizBanner}>
          <View style={s.bizAvatar}>
            <Text style={s.bizAvatarText}>{businessName.charAt(0)}</Text>
          </View>
          <View>
            <Text style={s.bizLabel}>Requesting quote from</Text>
            <Text style={s.bizName}>{businessName}</Text>
          </View>
        </View>

        <View style={s.field}>
          <Text style={s.label}>Describe the job <Text style={s.required}>*</Text></Text>
          <TextInput
            style={[s.input, s.textArea]}
            placeholder="e.g. I need a tar driveway surfaced, approximately 80sqm. Looking for a quote including materials and labour."
            placeholderTextColor="#9CA3AF"
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
        </View>

        <View style={s.field}>
          <Text style={s.label}>Job address</Text>
          <TextInput
            style={s.input}
            placeholder="e.g. 12 Main Street, Kempton Park"
            placeholderTextColor="#9CA3AF"
            value={jobAddress}
            onChangeText={setJobAddress}
          />
        </View>

        <View style={s.field}>
          <Text style={s.label}>Your budget (R)</Text>
          <TextInput
            style={s.input}
            placeholder="e.g. 15000"
            placeholderTextColor="#9CA3AF"
            value={budget}
            onChangeText={setBudget}
            keyboardType="numeric"
          />
          <Text style={s.hint}>Optional — helps businesses give you an accurate quote</Text>
        </View>

        <View style={s.infoBox}>
          <Text style={s.infoText}>
            Your request will be sent directly to {businessName}. They typically respond within a few hours.
          </Text>
        </View>

        <TouchableOpacity
          style={[s.submitBtn, (!message.trim() || loading) && s.submitDisabled]}
          onPress={submit}
          disabled={!message.trim() || loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.submitText}>Send Quote Request</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FB' },
  header: { backgroundColor: '#0D1B4B', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14 },
  backBtn: { width: 60 },
  backText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 40 },
  bizBanner: { backgroundColor: '#fff', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20, borderWidth: 0.5, borderColor: '#E5E7EB' },
  bizAvatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#1A56F0', justifyContent: 'center', alignItems: 'center' },
  bizAvatarText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  bizLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '500', marginBottom: 2 },
  bizName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  required: { color: '#EF4444' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#111827' },
  textArea: { height: 120, paddingTop: 12 },
  hint: { fontSize: 11, color: '#9CA3AF', marginTop: 5 },
  infoBox: { backgroundColor: '#EFF6FF', borderRadius: 10, padding: 12, marginBottom: 20, borderWidth: 0.5, borderColor: '#BFDBFE' },
  infoText: { fontSize: 12, color: '#1D4ED8', lineHeight: 18 },
  submitBtn: { backgroundColor: '#1A56F0', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});