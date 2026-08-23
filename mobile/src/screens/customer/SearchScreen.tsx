import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, StyleSheet, ActivityIndicator, ScrollView
} from 'react-native';
import { searchApi } from '../../services/api';
import BusinessProfileScreen from './BusinessProfileScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Business {
  id: string;
  name: string;
  slug: string;
  description?: string;
  category: { name: string; icon?: string };
  suburb?: string;
  city: string;
  ratingAvg: number;
  reviewCount: number;
  isVerified: boolean;
  isSponsored: boolean;
  distanceKm?: number;
  priceMin?: number;
  priceMax?: number;
}

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Business[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  useEffect(() => {
    searchApi.categories().then(r => setCategories(r.data)).catch(() => {});
    doSearch('', null);
  }, []);

  const doSearch = useCallback(async (q: string, cat: string | null) => {
    setLoading(true);
    try {
      const params: any = { sortBy: 'relevance', limit: 20 };
      if (q) params.q = q;
      if (cat) params.categorySlug = cat;
      const res = await searchApi.search(params);
      setResults(res.data.data);
      setTotal(res.data.meta.total);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const selectCategory = (slug: string | null) => {
    setSelectedCat(slug);
    doSearch(query, slug);
  };

  const handleSearch = () => {
    doSearch(query, selectedCat);
  };

  const formatPrice = (cents: number) => `R${(cents / 100).toLocaleString()}`;

  if (selectedSlug) {
    return (
      <BusinessProfileScreen
        slug={selectedSlug}
        onBack={() => setSelectedSlug(null)}
        onRequestQuote={(id, name) => console.log('Quote requested for', name, id)}
      />
    );
  }

  const renderBusiness = ({ item: b }: { item: Business }) => (
    <View style={s.card}>
      <View style={s.cardTop}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{b.name.charAt(0)}</Text>
        </View>
        <View style={s.cardMeta}>
          <View style={s.nameRow}>
            <Text style={s.bizName} numberOfLines={1}>{b.name}</Text>
            {b.isVerified && <View style={s.verifiedDot} />}
          </View>
          <Text style={s.bizSub} numberOfLines={1}>
            {b.category.name} · {b.suburb ?? b.city}
            {b.distanceKm != null ? ` · ${b.distanceKm}km` : ''}
          </Text>
          <Text style={s.rating}>
            {'★'.repeat(Math.round(b.ratingAvg))}{'☆'.repeat(5 - Math.round(b.ratingAvg))} {b.ratingAvg.toFixed(1)} ({b.reviewCount})
          </Text>
          {(b.priceMin || b.priceMax) && (
            <Text style={s.price}>
              {b.priceMin ? formatPrice(b.priceMin) : ''}
              {b.priceMin && b.priceMax ? ' – ' : ''}
              {b.priceMax ? formatPrice(b.priceMax) : ''}
            </Text>
          )}
        </View>
        {b.isSponsored && (
          <View style={s.adBadge}>
            <Text style={s.adText}>AD</Text>
          </View>
        )}
      </View>
      <View style={s.ctaRow}>
        <TouchableOpacity style={s.btnPrimary} onPress={() => setSelectedSlug(b.slug)}>
          <Text style={s.btnPrimaryText}>Get Quote</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btnOutline} onPress={() => setSelectedSlug(b.slug)}>
          <Text style={s.btnOutlineText}>View Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={s.container}>
      {/* Search hero */}
      <View style={s.hero}>
        <Text style={s.heroLabel}>ServiConnect</Text>
        <Text style={s.heroTitle}>What service do you need?</Text>
        <View style={s.searchBox}>
          <TextInput
            style={s.searchInput}
            placeholder="Search plumbers, pavers, cleaners..."
            placeholderTextColor="#9CA3AF"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity onPress={handleSearch} style={s.searchBtn}>
            <Text style={s.searchBtnText}>Search</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Category chips */}
      <View style={s.chipWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
          <TouchableOpacity onPress={() => selectCategory(null)} style={[s.chip, !selectedCat && s.chipSel]}>
            <Text style={[s.chipText, !selectedCat && s.chipTextSel]}>All</Text>
          </TouchableOpacity>
          {categories.map(c => (
            <TouchableOpacity key={c.id} onPress={() => selectCategory(c.slug)} style={[s.chip, selectedCat === c.slug && s.chipSel]}>
              <Text style={[s.chipText, selectedCat === c.slug && s.chipTextSel]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Results count */}
      <View style={s.resultsHeader}>
        <Text style={s.resultsLabel}>
          {loading ? 'Searching...' : `${total} result${total !== 1 ? 's' : ''}`}
        </Text>
      </View>

      {/* Results */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#1A56F0" />
      ) : (
        <FlatList
          data={results}
          renderItem={renderBusiness}
          keyExtractor={b => b.id}
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <Text style={s.empty}>No businesses found. Try a different search.</Text>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FB' },
  hero: { backgroundColor: '#0D1B4B', padding: 20, paddingTop: 56 },
  heroLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 4, fontWeight: '600', letterSpacing: 1 },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 14 },
  searchBox: { backgroundColor: '#fff', borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingLeft: 14, overflow: 'hidden' },
  searchInput: { flex: 1, fontSize: 14, color: '#111827', paddingVertical: 12 },
  searchBtn: { backgroundColor: '#1A56F0', paddingHorizontal: 16, paddingVertical: 12 },
  searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  chipWrapper: { backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  chipRow: { paddingHorizontal: 14, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  chip: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  chipSel: { backgroundColor: '#1A56F0', borderColor: '#1A56F0' },
  chipText: { fontSize: 12, color: '#374151', fontWeight: '500' },
  chipTextSel: { color: '#fff' },
  resultsHeader: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  resultsLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  list: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 24 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#1A56F0', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  cardMeta: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  bizName: { fontSize: 13, fontWeight: '700', color: '#111827', flex: 1 },
  verifiedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#12B76A', flexShrink: 0 },
  bizSub: { fontSize: 11, color: '#6B7280', marginBottom: 3 },
  rating: { fontSize: 11, color: '#FBBF24', marginBottom: 2 },
  price: { fontSize: 11, fontWeight: '600', color: '#1A56F0' },
  adBadge: { backgroundColor: '#FFF3E0', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3, flexShrink: 0 },
  adText: { fontSize: 9, fontWeight: '700', color: '#B45309' },
  ctaRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btnPrimary: { flex: 1, backgroundColor: '#1A56F0', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  btnOutline: { flex: 1, borderWidth: 1.5, borderColor: '#1A56F0', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  btnOutlineText: { color: '#1A56F0', fontWeight: '600', fontSize: 12 },
  empty: { textAlign: 'center', color: '#9CA3AF', fontSize: 13, marginTop: 40, lineHeight: 22 },
});