import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, TextInput, Alert, ActivityIndicator, Linking
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { leadsApi } from '../../services/api';


interface Props {
  leadId: string;
  onBack: () => void;
  onQuoteSent: () => void;
}

export default function LeadDetailScreen({ leadId, onBack, onQuoteSent }: Props) {
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    leadsApi.updateStatus(leadId, 'VIEWED').catch(() => {});
    leadsApi.getLeadById(leadId)
      .then(res => setLead(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [leadId]);

  const sendQuote = async () => {
    if (!amount || !description.trim()) {
      Alert.alert('Required', 'Please enter both a price and description.');
      return;
    }
    setSubmitting(true);
    try {
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + 7);
      await leadsApi.sendQuote(leadId, {
        amount: Math.round(parseFloat(amount) * 100),
        description: description.trim(),
        validUntil: validUntil.toISOString(),
      });
      Alert.alert('Quote Sent!', 'The customer has been notified.', [{ text: 'OK', onPress: onQuoteSent }]);
    } catch {
      Alert.alert('Error', 'Could not send quote. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const rejectLead = () => {
    Alert.alert('Reject Lead', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject', style: 'destructive',
        onPress: async () => {
          await leadsApi.updateStatus(leadId, 'REJECTED');
          onBack();
        }
      }
    ]);
  };

  const statusColors: Record<string, { bg: string; text: string }> = {
    NEW:       { bg: '#FFF3E0', text: '#B45309' },
    VIEWED:    { bg: '#EFF6FF', text: '#1D4ED8' },
    QUOTED:    { bg: '#F5F3FF', text: '#6D28D9' },
    ACCEPTED:  { bg: '#ECFDF5', text: '#065F46' },
    COMPLETED: { bg: '#F3F4F6', text: '#374151' },
    REJECTED:  { bg: '#FEF2F2', text: '#991B1B' },
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-ZA', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  // All hooks declared above — safe to return conditionally now
  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color="#1A56F0" />
    </View>
  );

  if (!lead) return (
    <View style={s.center}>
      <Text style={s.errorText}>Lead not found.</Text>
    </View>
  );

  const color = statusColors[lead.status] ?? { bg: '#F3F4F6', text: '#374151' };
  const hasQuote = lead.quotes?.length > 0;
  const latestQuote = lead.quotes?.[0];

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <FontAwesome name="arrow-left" size={16} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Lead Details</Text>
        <View style={[s.statusBadge, { backgroundColor: color.bg }]}>
          <Text style={[s.statusText, { color: color.text }]}>{lead.status}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={s.card}>
          <Text style={s.cardTitle}>Customer Request</Text>
          <View style={s.infoRow}>
            <FontAwesome name="calendar" size={13} color="#9CA3AF" style={s.infoIcon} />
            <Text style={s.infoText}>{formatDate(lead.createdAt)}</Text>
          </View>
          {lead.jobAddress && (
            <View style={s.infoRow}>
              <FontAwesome name="map-marker" size={13} color="#9CA3AF" style={s.infoIcon} />
              <Text style={s.infoText}>{lead.jobAddress}</Text>
            </View>
          )}
          {lead.budget && (
            <View style={s.infoRow}>
              <FontAwesome name="money" size={13} color="#9CA3AF" style={s.infoIcon} />
              <Text style={s.infoText}>Budget: R{(lead.budget / 100).toLocaleString()}</Text>
            </View>
          )}
                   <View style={s.messageBubble}>
            <Text style={s.messageText}>{lead.message}</Text>
          </View>

          {/* Contact actions */}
          <View style={s.contactRow}>
            <TouchableOpacity
              style={s.contactBtn}
              onPress={() => {
                const phone = lead.customer?.phone;
                if (phone) Linking.openURL(`tel:${phone}`);
              }}>
              <FontAwesome name="phone" size={15} color="#fff" />
              <Text style={s.contactBtnText}>Call</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.contactBtn, s.whatsappBtn]}
              onPress={() => {
                const phone = lead.customer?.phone?.replace(/\D/g, '');
                if (phone) Linking.openURL(`https://wa.me/${phone}`);
              }}>
              <FontAwesome name="whatsapp" size={15} color="#fff" />
              <Text style={s.contactBtnText}>WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.contactBtn, s.messageBtn]}
              onPress={() => {
                const phone = lead.customer?.phone;
                if (phone) Linking.openURL(`sms:${phone}`);
              }}>
              <FontAwesome name="comment" size={15} color="#1A56F0" />
              <Text style={[s.contactBtnText, { color: '#1A56F0' }]}>SMS</Text>
            </TouchableOpacity>
          </View>

        </View>

        {hasQuote && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Your Quote</Text>
            <View style={s.quoteAmount}>
              <Text style={s.quoteAmountLabel}>Amount</Text>
              <Text style={s.quoteAmountValue}>R{(latestQuote.amount / 100).toLocaleString()}</Text>
            </View>
            <Text style={s.quoteDesc}>{latestQuote.description}</Text>
            <View style={s.infoRow}>
              <FontAwesome name="clock-o" size={13} color="#9CA3AF" style={s.infoIcon} />
              <Text style={s.infoText}>
                Valid until {new Date(latestQuote.validUntil).toLocaleDateString('en-ZA')}
              </Text>
            </View>
            <View style={[s.quoteStatus, { backgroundColor: latestQuote.status === 'ACCEPTED' ? '#ECFDF5' : '#F5F3FF' }]}>
              <Text style={[s.quoteStatusText, { color: latestQuote.status === 'ACCEPTED' ? '#065F46' : '#6D28D9' }]}>
                Quote {latestQuote.status}
              </Text>
            </View>
          </View>
        )}

        {!hasQuote && lead.status !== 'REJECTED' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Send a Quote</Text>
            {!showQuoteForm ? (
              <TouchableOpacity style={s.sendQuoteBtn} onPress={() => setShowQuoteForm(true)}>
                <FontAwesome name="paper-plane" size={14} color="#fff" style={{ marginRight: 8 }} />
                <Text style={s.sendQuoteBtnText}>Write Quote</Text>
              </TouchableOpacity>
            ) : (
              <>
                <Text style={s.fieldLabel}>Your price (R)</Text>
                <TextInput
                  style={s.input}
                  placeholder="e.g. 12500"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={setAmount}
                />
                <Text style={s.fieldLabel}>Quote description</Text>
                <TextInput
                  style={[s.input, s.textArea]}
                  placeholder="Describe what's included — materials, labour, timeline..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  value={description}
                  onChangeText={setDescription}
                />
                <View style={s.formActions}>
                  <TouchableOpacity style={s.cancelBtn} onPress={() => setShowQuoteForm(false)}>
                    <Text style={s.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.submitBtn, submitting && s.submitDisabled]}
                    onPress={sendQuote}
                    disabled={submitting}>
                    {submitting
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={s.submitBtnText}>Send Quote</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        )}

        {lead.status !== 'REJECTED' && lead.status !== 'COMPLETED' && (
          <TouchableOpacity style={s.rejectBtn} onPress={rejectLead}>
            <FontAwesome name="times" size={14} color="#DC2626" style={{ marginRight: 8 }} />
            <Text style={s.rejectBtnText}>Reject this lead</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#6B7280', fontSize: 14 },
  header: { backgroundColor: '#0D1B4B', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14, gap: 12 },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '700' },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  card: { margin: 14, marginBottom: 0, backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: '#E5E7EB', marginTop: 14 },
  cardTitle: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  infoIcon: { width: 20 },
  infoText: { fontSize: 13, color: '#374151', flex: 1 },
  messageBubble: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginTop: 8 },
  messageText: { fontSize: 14, color: '#111827', lineHeight: 22 },
  quoteAmount: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  quoteAmountLabel: { fontSize: 13, color: '#6B7280' },
  quoteAmountValue: { fontSize: 22, fontWeight: '800', color: '#1A56F0' },
  quoteDesc: { fontSize: 13, color: '#374151', lineHeight: 20, marginBottom: 10 },
  quoteStatus: { borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 8 },
  quoteStatusText: { fontSize: 12, fontWeight: '700' },
  sendQuoteBtn: { backgroundColor: '#1A56F0', borderRadius: 12, paddingVertical: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  sendQuoteBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#111827' },
  textArea: { height: 110, paddingTop: 11 },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
  submitBtn: { flex: 2, backgroundColor: '#1A56F0', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  submitDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  rejectBtn: { margin: 14, borderWidth: 1, borderColor: '#FECACA', borderRadius: 14, paddingVertical: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#FEF2F2', marginTop: 14 },
  rejectBtnText: { color: '#DC2626', fontWeight: '600', fontSize: 14 },
  contactRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
contactBtn: { flex: 1, backgroundColor: '#1A56F0', borderRadius: 10, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
whatsappBtn: { backgroundColor: '#25D366' },
messageBtn: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
contactBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});