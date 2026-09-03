import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { savedApi } from '../../services/api';
import BusinessProfileScreen from './BusinessProfileScreen';

export default function SavedScreen() {
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewingSlug, setViewingSlug] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await savedApi.getMySaved();
      setBusinesses(res.data ?? []);
    } catch (err) {
      console.error('SavedScreen load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  // All hooks declared — safe to return conditionally
  if (viewingSlug) {
    return (
      <BusinessProfileScreen
        slug={viewingSlug}
        onBack={() => {
          setViewingSlug(null);
          load(true); // refresh in case they unsaved
        }}
        onRequestQuote={() => setViewingSlug(null)}
      />
    );
  }

  if (loading) return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Saved Businesses</Text>
      </View>
      <View style={s.center}>
        <ActivityIndicator size="large" color="#1A56F0" />
        <Text style={s.loadingText}>Loading saved businesses…</Text>
      </View>
    </View>
  );

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Saved Businesses</Text>
        <Text style={s.headerSub}>
          {businesses.length === 0
            ? 'No saved businesses yet'
            : `${businesses.length} saved`}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1A56F0"
            colors={['#1A56F0']}
          />
        }>

        {businesses.length === 0 ? (
          <View style={s.emptyBox}>
            <View style={s.emptyIconBox}>
              <FontAwesome name="heart-o" size={32} color="#9CA3AF" />
            </View>
            <Text style={s.emptyTitle}>No saved businesses yet</Text>
            <Text style={s.emptyText}>
              Tap the heart icon on any business profile to save it here for quick access.
            </Text>
          </View>
        ) : (
          <View style={s.cardList}>
            {businesses.map(biz => (
              <TouchableOpacity
                key={biz.id}
                style={s.card}
                onPress={() => setViewingSlug(biz.slug)}
                activeOpacity={0.88}>
                <View style={s.cardTop}>
                  {/* Avatar */}
                  <View style={[s.avatar, { backgroundColor: getColor(biz.name) }]}>
                    <Text style={s.avatarText}>{getInitials(biz.name)}</Text>
                  </View>

                  <View style={s.cardMeta}>
                    <View style={s.nameRow}>
                      <Text style={s.bizName} numberOfLines={1}>{biz.name}</Text>
                      {biz.isVerified && <View style={s.verifiedDot} />}
                    </View>
                    <Text style={s.bizSub} numberOfLines={1}>
                      {biz.category?.name}{biz.suburb ? ` · ${biz.suburb}` : ''}
                    </Text>
                    <View style={s.ratingRow}>
                      <FontAwesome name="star" size={11} color="#FBBF24" style={{ marginRight: 3 }} />
                      <Text style={s.ratingText}>
                        {biz.ratingAvg.toFixed(1)} ({biz.reviewCount})
                      </Text>
                      {(biz.priceMin || biz.priceMax) && (
                        <>
                          <Text style={s.dot}>·</Text>
                          <Text style={s.priceText}>
                            {biz.priceMin ? `R${(biz.priceMin / 100).toLocaleString()}` : ''}
                            {biz.priceMin && biz.priceMax ? '–' : ''}
                            {biz.priceMax ? `R${(biz.priceMax / 100).toLocaleString()}` : ''}
                          </Text>
                        </>
                      )}
                    </View>
                  </View>

                  <FontAwesome name="chevron-right" size={13} color="#D1D5DB" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>
    </View>
  );
}

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

function getColor(name: string): string {
  const colors = ['#1A56F0', '#0D1B4B', '#6D28D9', '#065F46', '#B45309', '#991B1B'];
  return colors[name.charCodeAt(0) % colors.length];
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  loadingText: { marginTop: 12, fontSize: 13, color: '#9CA3AF' },
  header: { backgroundColor: '#0D1B4B', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 16 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 3 },
  emptyBox: { alignItems: 'center', paddingTop: 56, paddingHorizontal: 32 },
  emptyIconBox: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 8, textAlign: 'center' },
  emptyText: { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  cardList: { paddingHorizontal: 14, paddingTop: 10 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 0.5, borderColor: '#E5E7EB' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  cardMeta: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  bizName: { fontSize: 14, fontWeight: '700', color: '#111827', flex: 1 },
  verifiedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#12B76A', flexShrink: 0 },
  bizSub: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center' },
  ratingText: { fontSize: 11, color: '#6B7280' },
  dot: { fontSize: 11, color: '#D1D5DB', marginHorizontal: 4 },
  priceText: { fontSize: 11, color: '#1A56F0', fontWeight: '600' },
});