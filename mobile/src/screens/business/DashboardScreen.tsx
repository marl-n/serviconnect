import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl
} from 'react-native';
import { businessApi, leadsApi } from '../../services/api';

interface Props {
  onViewLead: (leadId: string) => void;
  onLogout: () => void;
}

const statusColors: Record<string, { bg: string; text: string }> = {
  NEW:       { bg: '#FFF3E0', text: '#B45309' },
  VIEWED:    { bg: '#EFF6FF', text: '#1D4ED8' },
  QUOTED:    { bg: '#F5F3FF', text: '#6D28D9' },
  ACCEPTED:  { bg: '#ECFDF5', text: '#065F46' },
  COMPLETED: { bg: '#F3F4F6', text: '#374151' },
  REJECTED:  { bg: '#FEF2F2', text: '#991B1B' },
};

export default function DashboardScreen({ onViewLead, onLogout }: Props) {
  const [business, setBusiness] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('ALL');

  const load = useCallback(async () => {
    try {
      const bizRes = await businessApi.getMyBusiness();
      const biz = bizRes.data;
      setBusiness(biz);

      if (biz?.id) {
        const [statsRes, leadsRes] = await Promise.all([
          businessApi.getDashboard(),
          leadsApi.getBusinessLeads(biz.id),
        ]);
        setStats(statsRes.data);
        setLeads(leadsRes.data ?? []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = () => { setRefreshing(true); load(); };

  const filteredLeads = activeFilter === 'ALL'
    ? leads
    : leads.filter(l => l.status === activeFilter);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color="#1A56F0" />
    </View>
  );

  if (!business) return (
    <View style={s.center}>
      <Text style={s.errorText}>No business profile found.</Text>
      <Text style={s.errorSub}>Create your business profile to get started.</Text>
    </View>
  );

  const metrics = [
    { label: 'Total leads', value: stats?.leadCount ?? leads.length },
    { label: 'Profile views', value: stats?.viewCount ?? 0 },
    { label: 'Rating', value: business.ratingAvg?.toFixed(1) ?? '0.0' },
    { label: 'Reviews', value: business.reviewCount ?? 0 },
  ];

  const filters = ['ALL', 'NEW', 'VIEWED', 'QUOTED', 'ACCEPTED', 'COMPLETED'];
  const newLeadsCount = leads.filter(l => l.status === 'NEW').length;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerLabel}>Business Dashboard</Text>
          <Text style={s.headerBiz} numberOfLines={1}>{business.name}</Text>
        </View>
        <View style={s.headerRight}>
          {newLeadsCount > 0 && (
            <View style={s.notifBadge}>
              <Text style={s.notifText}>{newLeadsCount}</Text>
            </View>
          )}
          <TouchableOpacity onPress={onLogout} style={s.logoutBtn}>
            <Text style={s.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1A56F0" />}>

        {/* Metric cards */}
        <View style={s.metricsGrid}>
          {metrics.map(m => (
            <View key={m.label} style={s.metricCard}>
              <Text style={s.metricValue}>{m.value}</Text>
              <Text style={s.metricLabel}>{m.label}</Text>
            </View>
          ))}
        </View>

        {/* Verification status */}
        {!business.isVerified && (
          <View style={s.verifyBanner}>
            <Text style={s.verifyTitle}>Get verified</Text>
            <Text style={s.verifyText}>Verified businesses get 3x more leads. Submit your documents to get your badge.</Text>
          </View>
        )}

        {/* Lead inbox */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Lead Inbox</Text>
          <Text style={s.sectionCount}>{leads.length} total</Text>
        </View>

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

        {/* Leads list */}
        {filteredLeads.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyTitle}>
              {activeFilter === 'ALL' ? 'No leads yet' : `No ${activeFilter.toLowerCase()} leads`}
            </Text>
            <Text style={s.emptyText}>
              {activeFilter === 'ALL'
                ? 'Boost your listing to start receiving quote requests from customers.'
                : 'Try a different filter.'}
            </Text>
          </View>
        ) : (
          filteredLeads.map(lead => {
            const color = statusColors[lead.status] ?? { bg: '#F3F4F6', text: '#374151' };
            return (
              <TouchableOpacity
                key={lead.id}
                style={s.leadCard}
                onPress={() => onViewLead(lead.id)}>
                <View style={s.leadTop}>
                  <View style={s.leadAvatar}>
                    <Text style={s.leadAvatarText}>
                      {lead.business?.name?.charAt(0) ?? 'C'}
                    </Text>
                  </View>
                  <View style={s.leadMeta}>
                    <Text style={s.leadName} numberOfLines={1}>
                      {lead.business?.name ?? 'Customer'}
                    </Text>
                    <Text style={s.leadDate}>{formatDate(lead.createdAt)}</Text>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: color.bg }]}>
                    <Text style={[s.statusText, { color: color.text }]}>{lead.status}</Text>
                  </View>
                </View>
                <Text style={s.leadMessage} numberOfLines={2}>{lead.message}</Text>
                {lead.jobAddress && (
                  <Text style={s.leadAddress} numberOfLines={1}>📍 {lead.jobAddress}</Text>
                )}
                {lead.budget && (
                  <Text style={s.leadBudget}>
                    Budget: R{(lead.budget / 100).toLocaleString()}
                  </Text>
                )}
                {lead.quotes?.length > 0 && (
                  <View style={s.quotedRow}>
                    <Text style={s.quotedText}>
                      Quote sent: R{(lead.quotes[0].amount / 100).toLocaleString()}
                    </Text>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 8 },
  errorSub: { fontSize: 13, color: '#6B7280', textAlign: 'center' },
  header: { backgroundColor: '#0D1B4B', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 2 },
  headerBiz: { color: '#fff', fontSize: 17, fontWeight: '700', maxWidth: 220 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notifBadge: { backgroundColor: '#FF6B35', borderRadius: 12, minWidth: 22, height: 22, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  notifText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  logoutBtn: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  logoutText: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8 },
  metricCard: { flex: 1, minWidth: '45%', backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: '#E5E7EB', alignItems: 'center' },
  metricValue: { fontSize: 26, fontWeight: '800', color: '#111827', marginBottom: 4 },
  metricLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '500', textAlign: 'center' },
  verifyBanner: { marginHorizontal: 14, marginBottom: 12, backgroundColor: '#EFF6FF', borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: '#BFDBFE' },
  verifyTitle: { fontSize: 13, fontWeight: '700', color: '#1D4ED8', marginBottom: 4 },
  verifyText: { fontSize: 12, color: '#1D4ED8', lineHeight: 18 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  sectionCount: { fontSize: 12, color: '#9CA3AF' },
  filterRow: { paddingHorizontal: 14, paddingBottom: 10, gap: 8, flexDirection: 'row' },
  filterChip: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  filterChipActive: { backgroundColor: '#1A56F0', borderColor: '#1A56F0' },
  filterText: { fontSize: 11, color: '#374151', fontWeight: '500' },
  filterTextActive: { color: '#fff' },
  emptyBox: { margin: 14, backgroundColor: '#fff', borderRadius: 14, padding: 24, alignItems: 'center', borderWidth: 0.5, borderColor: '#E5E7EB' },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 8 },
  emptyText: { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  leadCard: { marginHorizontal: 14, marginBottom: 10, backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: '#E5E7EB' },
  leadTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  leadAvatar: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#1A56F0', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  leadAvatarText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  leadMeta: { flex: 1 },
  leadName: { fontSize: 13, fontWeight: '700', color: '#111827' },
  leadDate: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4, flexShrink: 0 },
  statusText: { fontSize: 10, fontWeight: '700' },
  leadMessage: { fontSize: 13, color: '#374151', lineHeight: 20, marginBottom: 6 },
  leadAddress: { fontSize: 11, color: '#6B7280', marginBottom: 4 },
  leadBudget: { fontSize: 11, fontWeight: '600', color: '#1A56F0', marginBottom: 4 },
  quotedRow: { backgroundColor: '#ECFDF5', borderRadius: 8, padding: 8, marginTop: 4 },
  quotedText: { fontSize: 11, fontWeight: '600', color: '#065F46' },
});