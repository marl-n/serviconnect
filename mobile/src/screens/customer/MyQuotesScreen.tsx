import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, Alert, Linking
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { leadsApi } from '../../services/api';
import BusinessProfileScreen from './BusinessProfileScreen';

interface Props {
  onViewBusiness?: (slug: string) => void;
}

const statusColors: Record<string, { bg: string; text: string }> = {
  NEW:       { bg: '#FFF3E0', text: '#B45309' },
  VIEWED:    { bg: '#EFF6FF', text: '#1D4ED8' },
  QUOTED:    { bg: '#F5F3FF', text: '#6D28D9' },
  ACCEPTED:  { bg: '#ECFDF5', text: '#065F46' },
  COMPLETED: { bg: '#F3F4F6', text: '#374151' },
  REJECTED:  { bg: '#FEF2F2', text: '#991B1B' },
};

const statusDescriptions: Record<string, string> = {
  NEW:       'Waiting for business to respond',
  VIEWED:    'Business has seen your request',
  QUOTED:    'Business sent you a quote — review it',
  ACCEPTED:  'You accepted the quote',
  COMPLETED: 'Job completed',
  REJECTED:  'Business could not take this job',
};

export default function MyQuotesScreen({ onViewBusiness }: Props) {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewingSlug, setViewingSlug] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await leadsApi.getMyLeads();
      setLeads(res.data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = () => { setRefreshing(true); load(); };

  const filters = ['ALL', 'NEW', 'VIEWED', 'QUOTED', 'ACCEPTED', 'COMPLETED'];
  const filteredLeads = activeFilter === 'ALL'
    ? leads
    : leads.filter(l => l.status === activeFilter);

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-ZA', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
  const formatPrice = (cents: number) => `R${(cents / 100).toLocaleString()}`;

  if (viewingSlug) {
    return (
      <BusinessProfileScreen
        slug={viewingSlug}
        onBack={() => setViewingSlug(null)}
        onRequestQuote={() => setViewingSlug(null)}
      />
    );
  }

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color="#1A56F0" />
    </View>
  );

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>My Quote Requests</Text>
        <Text style={s.headerSub}>{leads.length} total</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1A56F0" />}>

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {filters.map(f => (
            <TouchableOpacity
              key={f}
              onPress={() => setActiveFilter(f)}
              style={[s.filterChip, activeFilter === f && s.filterChipActive]}>
              <Text style={[s.filterText, activeFilter === f && s.filterTextActive]}>
                {f === 'ALL' ? `All (${leads.length})` : `${f} (${leads.filter(l => l.status === f).length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {filteredLeads.length === 0 ? (
          <View style={s.emptyBox}>
            <FontAwesome name="file-text-o" size={40} color="#D1D5DB" style={{ marginBottom: 14 }} />
            <Text style={s.emptyTitle}>No quote requests yet</Text>
            <Text style={s.emptyText}>Search for a service and tap "Get Quote" to send your first request.</Text>
          </View>
        ) : (
          filteredLeads.map(lead => {
            const color = statusColors[lead.status] ?? { bg: '#F3F4F6', text: '#374151' };
            const hasQuote = lead.quotes?.length > 0;
            const latestQuote = lead.quotes?.[0];
            const isExpanded = expandedId === lead.id;

            return (
              <TouchableOpacity
                key={lead.id}
                style={[s.card, isExpanded && s.cardExpanded]}
                onPress={() => setExpandedId(isExpanded ? null : lead.id)}
                activeOpacity={0.9}>

                {/* Card header — always visible */}
                <View style={s.cardTop}>
                  <View style={s.bizAvatar}>
                    <Text style={s.bizAvatarText}>
                      {lead.business?.name?.charAt(0) ?? 'B'}
                    </Text>
                  </View>
                  <View style={s.bizMeta}>
                    <Text style={s.bizName} numberOfLines={1}>
                      {lead.business?.name ?? 'Business'}
                    </Text>
                    <Text style={s.dateText}>{formatDate(lead.createdAt)}</Text>
                  </View>
                  <View style={s.cardRight}>
                    <View style={[s.statusBadge, { backgroundColor: color.bg }]}>
                      <Text style={[s.statusText, { color: color.text }]}>{lead.status}</Text>
                    </View>
                    <FontAwesome
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={11}
                      color="#9CA3AF"
                      style={{ marginTop: 6 }}
                    />
                  </View>
                </View>

                {/* Status description — always visible */}
                <View style={s.statusDescRow}>
                  <FontAwesome
                    name={lead.status === 'QUOTED' ? 'exclamation-circle' : 'info-circle'}
                    size={12}
                    color={lead.status === 'QUOTED' ? '#6D28D9' : '#9CA3AF'}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[s.statusDescText, lead.status === 'QUOTED' && s.statusDescHighlight]}>
                    {statusDescriptions[lead.status]}
                  </Text>
                </View>

                {/* Expanded content */}
                {isExpanded && (
                  <View style={s.expanded}>
                    {/* Job request */}
                    <View style={s.section}>
                      <Text style={s.sectionTitle}>Your request</Text>
                      <Text style={s.messageText}>{lead.message}</Text>
                      {lead.jobAddress && (
                        <View style={s.infoRow}>
                          <FontAwesome name="map-marker" size={12} color="#9CA3AF" style={{ marginRight: 6 }} />
                          <Text style={s.infoText}>{lead.jobAddress}</Text>
                        </View>
                      )}
                      {lead.budget && (
                        <View style={s.infoRow}>
                          <FontAwesome name="money" size={12} color="#9CA3AF" style={{ marginRight: 6 }} />
                          <Text style={s.infoText}>Your budget: {formatPrice(lead.budget)}</Text>
                        </View>
                      )}
                    </View>

                    {/* Quote details */}
                    {hasQuote && (
                      <View style={s.quoteBox}>
                        <View style={s.quoteTop}>
                          <Text style={s.quoteLabel}>Quote from business</Text>
                          <Text style={s.quoteAmount}>{formatPrice(latestQuote.amount)}</Text>
                        </View>
                        <Text style={s.quoteDesc}>{latestQuote.description}</Text>
                        <Text style={s.quoteExpiry}>
                          Valid until {new Date(latestQuote.validUntil).toLocaleDateString('en-ZA')}
                        </Text>

                        {latestQuote.status === 'PENDING' && (
                          <View style={s.quoteActions}>
                            <TouchableOpacity
                              style={s.acceptBtn}
                              onPress={async () => {
                                await leadsApi.acceptQuote(latestQuote.id);
                                load();
                              }}>
                              <FontAwesome name="check" size={13} color="#fff" style={{ marginRight: 6 }} />
                              <Text style={s.acceptBtnText}>Accept</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={s.declineBtn}
                              onPress={() => {
                                Alert.alert('Decline Quote', 'Are you sure?', [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: 'Decline', style: 'destructive',
                                    onPress: async () => { await leadsApi.updateStatus(lead.id, 'REJECTED'); load(); }
                                  }
                                ]);
                              }}>
                              <FontAwesome name="times" size={13} color="#DC2626" style={{ marginRight: 6 }} />
                              <Text style={s.declineBtnText}>Decline</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={s.whatsappBtn}
                              onPress={() => {
                                const number = lead.business?.phone?.replace(/\D/g, '');
                                if (number) Linking.openURL(
                                  `https://wa.me/${number}?text=Hi, regarding your quote of ${formatPrice(latestQuote.amount)} for: "${lead.message.slice(0, 60)}"`
                                );
                              }}>
                              <FontAwesome name="whatsapp" size={13} color="#fff" style={{ marginRight: 6 }} />
                              <Text style={s.whatsappBtnText}>Discuss</Text>
                            </TouchableOpacity>
                          </View>
                        )}

                        {latestQuote.status === 'ACCEPTED' && (
                          <View style={s.acceptedRow}>
                            <FontAwesome name="check-circle" size={14} color="#065F46" style={{ marginRight: 6 }} />
                            <Text style={s.acceptedText}>Quote accepted</Text>
                          </View>
                        )}

                        {latestQuote.status === 'REJECTED' && (
                          <View style={s.declinedRow}>
                            <FontAwesome name="times-circle" size={14} color="#991B1B" style={{ marginRight: 6 }} />
                            <Text style={s.declinedText}>Quote declined</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* View business profile */}
                    {lead.business?.slug && (
                      <TouchableOpacity
                        style={s.viewBizBtn}
                        onPress={() => setViewingSlug(lead.business.slug)}>
                        <FontAwesome name="building" size={13} color="#1A56F0" style={{ marginRight: 8 }} />
                        <Text style={s.viewBizText}>View business profile</Text>
                        <FontAwesome name="chevron-right" size={11} color="#1A56F0" style={{ marginLeft: 'auto' }} />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#0D1B4B', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 16 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },
  filterRow: { paddingHorizontal: 14, paddingVertical: 12, gap: 8, flexDirection: 'row' },
  filterChip: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  filterChipActive: { backgroundColor: '#1A56F0', borderColor: '#1A56F0' },
  filterText: { fontSize: 11, color: '#374151', fontWeight: '500' },
  filterTextActive: { color: '#fff' },
  emptyBox: { margin: 24, alignItems: 'center', paddingTop: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 8 },
  emptyText: { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  card: { marginHorizontal: 14, marginBottom: 10, backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: '#E5E7EB' },
  cardExpanded: { borderColor: '#1A56F0', borderWidth: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  bizAvatar: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#1A56F0', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  bizAvatarText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  bizMeta: { flex: 1 },
  bizName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  dateText: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  cardRight: { alignItems: 'flex-end' },
  statusBadge: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
  statusText: { fontSize: 10, fontWeight: '700' },
  statusDescRow: { flexDirection: 'row', alignItems: 'center' },
  statusDescText: { fontSize: 12, color: '#6B7280', flex: 1 },
  statusDescHighlight: { color: '#6D28D9', fontWeight: '600' },
  expanded: { marginTop: 14, borderTopWidth: 0.5, borderTopColor: '#F3F4F6', paddingTop: 14 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  messageText: { fontSize: 13, color: '#374151', lineHeight: 20, marginBottom: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  infoText: { fontSize: 12, color: '#6B7280' },
  quoteBox: { backgroundColor: '#F5F3FF', borderRadius: 12, padding: 12, marginBottom: 12 },
  quoteTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  quoteLabel: { fontSize: 11, fontWeight: '600', color: '#6D28D9', textTransform: 'uppercase', letterSpacing: 0.5 },
  quoteAmount: { fontSize: 20, fontWeight: '800', color: '#6D28D9' },
  quoteDesc: { fontSize: 13, color: '#374151', lineHeight: 18, marginBottom: 6 },
  quoteExpiry: { fontSize: 11, color: '#9CA3AF', marginBottom: 10 },
  quoteActions: { flexDirection: 'row', gap: 8 },
  acceptBtn: { flex: 2, backgroundColor: '#1A56F0', borderRadius: 10, paddingVertical: 11, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  acceptBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  declineBtn: { flex: 1, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2', borderRadius: 10, paddingVertical: 11, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  declineBtnText: { color: '#DC2626', fontWeight: '600', fontSize: 13 },
  whatsappBtn: { flex: 1, backgroundColor: '#25D366', borderRadius: 10, paddingVertical: 11, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  whatsappBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  acceptedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  acceptedText: { fontSize: 13, fontWeight: '600', color: '#065F46' },
  declinedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  declinedText: { fontSize: 13, fontWeight: '600', color: '#991B1B' },
  viewBizBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', borderRadius: 10, padding: 12 },
  viewBizText: { fontSize: 13, color: '#1A56F0', fontWeight: '600' },
});