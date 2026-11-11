import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, FlatList,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { locationsApi } from '../services/api';
import { JobLocation, Province, Suburb, Town } from '../types';

interface Props {
  value?: JobLocation;
  onChange: (value: JobLocation) => void;
  label?: string;
}

type Stage = 'province' | 'town' | 'suburb';

/**
 * Province → Town/City → optional Suburb picker. A town is always required;
 * the suburb step can be skipped, and is skipped automatically when the town
 * has no suburbs.
 */
export default function LocationPicker({ value, onChange, label = 'Job location' }: Props) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>('province');
  const [province, setProvince] = useState<Province | undefined>();
  const [town, setTown] = useState<Town | undefined>();
  const [items, setItems] = useState<{ id: string; name: string }[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const requestSeq = useRef(0);

  const load = async (s: Stage, p?: Province, t?: Town, q = '') => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(false);
    try {
      const res =
        s === 'province' ? await locationsApi.provinces()
        : s === 'town' ? await locationsApi.towns(p!.id, q)
        : await locationsApi.suburbs(t!.id);
      if (seq !== requestSeq.current) return; // a newer request superseded this one
      const rows = res.data ?? [];
      if (s === 'suburb' && rows.length === 0) {
        finish(p!, t!);
        return;
      }
      setItems(rows);
    } catch {
      if (seq === requestSeq.current) setError(true);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  };

  const go = (s: Stage, p?: Province, t?: Town) => {
    setStage(s);
    setQuery('');
    setItems([]);
    load(s, p, t);
  };

  // Debounced server-side search on the town list
  useEffect(() => {
    if (!open || stage !== 'town' || !province) return;
    const h = setTimeout(() => load('town', province, undefined, query.trim()), 250);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const start = () => {
    setOpen(true);
    setProvince(undefined);
    setTown(undefined);
    go('province');
  };

  const finish = (p: Province, t: Town, sub?: Suburb) => {
    onChange({ province: p, town: t, suburb: sub });
    setOpen(false);
  };

  const pick = (item: any) => {
    if (stage === 'province') {
      setProvince(item);
      go('town', item);
    } else if (stage === 'town') {
      setTown(item);
      go('suburb', province, item);
    } else {
      finish(province!, town!, item);
    }
  };

  const back = () => {
    if (stage === 'suburb') go('town', province);
    else if (stage === 'town') go('province');
    else setOpen(false);
  };

  const title = stage === 'province' ? 'Choose a province' : stage === 'town' ? 'Choose a town or city' : 'Choose a suburb';
  const crumb = [province?.name, stage === 'suburb' ? town?.name : undefined].filter(Boolean).join(' › ');

  return (
    <View style={s.field}>
      <Text style={s.label}>{label} <Text style={s.required}>*</Text></Text>
      <TouchableOpacity style={s.input} onPress={start}>
        <FontAwesome name="map-marker" size={15} color={value ? '#1A56F0' : '#9CA3AF'} />
        <Text style={[s.inputText, !value && s.placeholder]} numberOfLines={1}>
          {value
            ? [value.suburb?.name, value.town.name, value.province.name].filter(Boolean).join(', ')
            : 'Select province, town and suburb'}
        </Text>
        <FontAwesome name="chevron-down" size={12} color="#9CA3AF" />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" onRequestClose={back}>
        <View style={s.modal}>
          <View style={s.header}>
            <TouchableOpacity onPress={back} style={s.headerBtn}>
              <FontAwesome name={stage === 'province' ? 'times' : 'arrow-left'} size={16} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              {!!crumb && <Text style={s.crumb}>{crumb}</Text>}
              <Text style={s.headerTitle}>{title}</Text>
            </View>
          </View>

          {stage === 'town' && (
            <TextInput
              style={s.search}
              placeholder="Search towns and cities"
              placeholderTextColor="#9CA3AF"
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
            />
          )}

          {stage === 'suburb' && (
            <TouchableOpacity style={s.skip} onPress={() => finish(province!, town!)}>
              <Text style={s.skipText}>Skip — the suburb is optional</Text>
              <FontAwesome name="arrow-right" size={12} color="#1A56F0" />
            </TouchableOpacity>
          )}

          {loading && items.length === 0 ? (
            <ActivityIndicator style={{ marginTop: 40 }} color="#1A56F0" />
          ) : error ? (
            <View style={s.empty}>
              <Text style={s.emptyText}>Couldn't load locations.</Text>
              <TouchableOpacity style={s.retry} onPress={() => load(stage, province, town, query.trim())}>
                <Text style={s.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={i => i.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 16 }}
              ListEmptyComponent={<Text style={s.emptyText}>No matches.</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.row} onPress={() => pick(item)}>
                  <Text style={s.rowText}>{item.name}</Text>
                  <FontAwesome name="chevron-right" size={12} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 4 },
  required: { color: '#EF4444' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  inputText: { flex: 1, fontSize: 14, color: '#111827' },
  placeholder: { color: '#9CA3AF' },
  modal: { flex: 1, backgroundColor: '#F4F6FB' },
  header: { backgroundColor: '#0D1B4B', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerBtn: { padding: 4 },
  crumb: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600', marginBottom: 2 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  search: { margin: 16, marginBottom: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#111827' },
  skip: { margin: 16, marginBottom: 0, padding: 14, borderRadius: 12, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skipText: { color: '#1A56F0', fontWeight: '700', fontSize: 14 },
  row: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  rowText: { fontSize: 14, fontWeight: '600', color: '#111827', flex: 1 },
  empty: { alignItems: 'center', paddingTop: 40 },
  emptyText: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginTop: 24 },
  retry: { backgroundColor: '#1A56F0', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10, marginTop: 12 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
