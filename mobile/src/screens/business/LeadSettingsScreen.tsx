import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { businessApi, locationsApi } from '../../services/api';
import { Province, SubCategory } from '../../types';

interface Props {
  business: { id: string; categoryId: string; category?: { name: string } };
  /** Shown as the first screen after onboarding — no back button, different wording. */
  firstRun?: boolean;
  onDone: () => void;
}

type AreaTown = { id: string; name: string; province?: { name: string } };

/**
 * Where a business gets its leads from: which service types (sub-categories of
 * its category) it offers and which towns/cities it serves. Both are required
 * for matching; suburbs are never used.
 */
export default function LeadSettingsScreen({ business, firstRun, onDone }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [selectedSubs, setSelectedSubs] = useState<Set<string>>(new Set());
  const [towns, setTowns] = useState<AreaTown[]>([]);

  // Town search
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [province, setProvince] = useState<Province | undefined>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AreaTown[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    (async () => {
      try {
        const [subsRes, mineRes, areasRes, provRes] = await Promise.all([
          businessApi.getSubCategories(business.categoryId),
          businessApi.getMyBusiness(),
          businessApi.getServiceAreas(business.id),
          locationsApi.provinces(),
        ]);
        setSubCategories(subsRes.data ?? []);
        setSelectedSubs(new Set((mineRes.data?.subCategories ?? []).map((s: any) => s.subCategory?.id ?? s.subCategoryId)));
        setTowns(areasRes.data ?? []);
        setProvinces(provRes.data ?? []);
      } catch {
        Alert.alert('Error', 'Could not load your lead settings. Pull down to retry.');
      } finally {
        setLoading(false);
      }
    })();
  }, [business.id]);

  useEffect(() => {
    if (!province) return;
    const n = ++seq.current;
    const h = setTimeout(async () => {
      try {
        const res = await locationsApi.towns(province.id, query.trim());
        if (n === seq.current) setResults((res.data ?? []).map((t: any) => ({ ...t, province })));
      } catch { /* keep previous results */ }
    }, 250);
    return () => clearTimeout(h);
  }, [province, query]);

  const toggleSub = (id: string) =>
    setSelectedSubs(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleTown = (t: AreaTown) =>
    setTowns(prev => (prev.some(x => x.id === t.id) ? prev.filter(x => x.id !== t.id) : [...prev, t]));

  const save = async () => {
    if (selectedSubs.size === 0) { Alert.alert('Required', 'Choose at least one service type you offer.'); return; }
    if (towns.length === 0) { Alert.alert('Required', 'Add at least one town or city you serve.'); return; }
    setSaving(true);
    try {
      await businessApi.setSubCategories(business.id, [...selectedSubs]);
      await businessApi.setServiceAreas(business.id, towns.map(t => t.id));
      onDone();
    } catch (err: any) {
      const m = err?.response?.data?.message;
      Alert.alert('Error', Array.isArray(m) ? m.join('\n') : m || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#1A56F0" /></View>;

  return (
    <View style={s.container}>
      <View style={s.header}>
        {!firstRun && (
          <TouchableOpacity onPress={onDone} style={s.backBtn}>
            <FontAwesome name="arrow-left" size={16} color="#fff" />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={s.headerLabel}>{firstRun ? 'Last step' : 'Lead settings'}</Text>
          <Text style={s.headerTitle}>Which jobs do you want?</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.sectionTitle}>Service types {business.category?.name ? `· ${business.category.name}` : ''}</Text>
        <Text style={s.sectionSub}>You'll only receive requests for the types you select.</Text>
        {subCategories.length === 0 && <Text style={s.muted}>No service types are set up for your category yet.</Text>}
        {subCategories.map(sc => {
          const on = selectedSubs.has(sc.id);
          return (
            <TouchableOpacity key={sc.id} style={[s.option, on && s.optionOn]} onPress={() => toggleSub(sc.id)}>
              <Text style={[s.optionText, on && s.optionTextOn]}>{sc.name}</Text>
              <FontAwesome name={on ? 'check-square' : 'square-o'} size={16} color={on ? '#1A56F0' : '#9CA3AF'} />
            </TouchableOpacity>
          );
        })}

        <Text style={[s.sectionTitle, { marginTop: 20 }]}>Towns and cities you serve</Text>
        <Text style={s.sectionSub}>You'll receive requests from anywhere in these towns, including all their suburbs.</Text>

        {towns.length > 0 && (
          <View style={s.chips}>
            {towns.map(t => (
              <TouchableOpacity key={t.id} style={s.chip} onPress={() => toggleTown(t)}>
                <Text style={s.chipText}>{t.name}</Text>
                <FontAwesome name="times" size={11} color="#1A56F0" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.provinceRow}>
          {provinces.map(p => (
            <TouchableOpacity key={p.id} style={[s.provinceChip, province?.id === p.id && s.provinceChipOn]} onPress={() => { setProvince(p); setQuery(''); }}>
              <Text style={[s.provinceText, province?.id === p.id && s.provinceTextOn]}>{p.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {province ? (
          <>
            <TextInput
              style={s.search}
              placeholder={`Search towns in ${province.name}`}
              placeholderTextColor="#9CA3AF"
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
            />
            {results.slice(0, 40).map(t => {
              const on = towns.some(x => x.id === t.id);
              return (
                <TouchableOpacity key={t.id} style={[s.option, on && s.optionOn]} onPress={() => toggleTown(t)}>
                  <Text style={[s.optionText, on && s.optionTextOn]}>{t.name}</Text>
                  <FontAwesome name={on ? 'check-square' : 'plus'} size={15} color={on ? '#1A56F0' : '#9CA3AF'} />
                </TouchableOpacity>
              );
            })}
          </>
        ) : (
          <Text style={s.muted}>Choose a province to add towns.</Text>
        )}

        <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>{firstRun ? 'Start receiving leads' : 'Save'}</Text>}
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#0D1B4B', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { padding: 4 },
  headerLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600', marginBottom: 2 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  content: { padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  sectionSub: { fontSize: 12, color: '#6B7280', marginTop: 2, marginBottom: 10 },
  muted: { fontSize: 13, color: '#9CA3AF', marginVertical: 8 },
  option: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  optionOn: { borderColor: '#1A56F0', backgroundColor: '#EFF6FF' },
  optionText: { fontSize: 14, color: '#374151', flex: 1 },
  optionTextOn: { color: '#1A56F0', fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { fontSize: 12, fontWeight: '600', color: '#1A56F0' },
  provinceRow: { gap: 8, paddingBottom: 10 },
  provinceChip: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  provinceChipOn: { backgroundColor: '#1A56F0', borderColor: '#1A56F0' },
  provinceText: { fontSize: 12, color: '#374151' },
  provinceTextOn: { color: '#fff', fontWeight: '600' },
  search: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#111827', marginBottom: 10 },
  saveBtn: { backgroundColor: '#1A56F0', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
