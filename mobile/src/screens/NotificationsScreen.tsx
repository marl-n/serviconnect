import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { notificationsApi } from '../services/api';

export interface AppNotification {
  id: string;
  type: 'NEW_LEAD' | 'LEAD_UNLOCKED' | 'NEW_QUOTE' | 'QUOTE_ACCEPTED' | 'QUOTE_DECLINED';
  title: string;
  body: string;
  data?: { leadId?: string; serviceRequestId?: string; quoteId?: string } | null;
  readAt: string | null;
  createdAt: string;
}

const ICON: Record<string, string> = {
  NEW_LEAD: 'bullhorn',
  LEAD_UNLOCKED: 'handshake-o',
  NEW_QUOTE: 'file-text-o',
  QUOTE_ACCEPTED: 'check-circle',
  QUOTE_DECLINED: 'times-circle',
};

/** Unread count, refreshed on mount and every 30 s while the component using it is mounted. */
export function useUnreadCount() {
  const [unread, setUnread] = useState(0);
  const refresh = useCallback(() => {
    notificationsApi.unreadCount().then(r => setUnread(r.data?.unread ?? 0)).catch(() => {});
  }, []);
  useEffect(() => {
    refresh();
    const h = setInterval(refresh, 30_000);
    return () => clearInterval(h);
  }, [refresh]);
  return { unread, refresh };
}

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
};

interface Props {
  onBack?: () => void;
  /** Called after a notification is tapped (and marked read). */
  onOpen: (n: AppNotification) => void;
}

export default function NotificationsScreen({ onBack, onOpen }: Props) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await notificationsApi.list();
      setItems(res.data?.items ?? []);
    } catch {
      // keep what we have
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const open = (n: AppNotification) => {
    if (!n.readAt) {
      setItems(prev => prev.map(x => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      notificationsApi.markRead(n.id).catch(() => {});
    }
    onOpen(n);
  };

  const readAll = () => {
    const now = new Date().toISOString();
    setItems(prev => prev.map(x => ({ ...x, readAt: x.readAt ?? now })));
    notificationsApi.markAllRead().catch(() => {});
  };

  const hasUnread = items.some(n => !n.readAt);

  return (
    <View style={s.container}>
      <View style={s.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={s.headerBtn}>
            <FontAwesome name="arrow-left" size={16} color="#fff" />
          </TouchableOpacity>
        )}
        <Text style={s.headerTitle}>Notifications</Text>
        {hasUnread && (
          <TouchableOpacity onPress={readAll}>
            <Text style={s.readAll}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color="#1A56F0" /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={n => n.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          contentContainerStyle={items.length === 0 ? s.center : { padding: 12 }}
          ListEmptyComponent={<Text style={s.empty}>No notifications yet.</Text>}
          renderItem={({ item: n }) => (
            <TouchableOpacity style={[s.item, !n.readAt && s.itemUnread]} onPress={() => open(n)} activeOpacity={0.85}>
              <FontAwesome
                name={(ICON[n.type] ?? 'bell') as any}
                size={18}
                color={n.readAt ? '#9CA3AF' : '#1A56F0'}
                style={s.icon}
              />
              <View style={{ flex: 1 }}>
                <Text style={[s.title, !n.readAt && s.titleUnread]}>{n.title}</Text>
                <Text style={s.body}>{n.body}</Text>
                <Text style={s.time}>{ago(n.createdAt)}</Text>
              </View>
              {!n.readAt && <View style={s.dot} />}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

/** Small red count bubble for a bell or tab icon. */
export function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={s.badge}>
      <Text style={s.badgeText}>{count > 9 ? '9+' : count}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FB' },
  center: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#0D1B4B', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerBtn: { padding: 4 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '700' },
  readAll: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
  empty: { color: '#9CA3AF', fontSize: 14 },
  item: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'flex-start', borderWidth: 0.5, borderColor: '#E5E7EB' },
  itemUnread: { borderColor: '#BFDBFE', backgroundColor: '#F8FAFF' },
  icon: { width: 24, marginRight: 10, marginTop: 1 },
  title: { fontSize: 14, color: '#374151', fontWeight: '600' },
  titleUnread: { color: '#111827', fontWeight: '700' },
  body: { fontSize: 13, color: '#4B5563', marginTop: 2, lineHeight: 18 },
  time: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1A56F0', marginLeft: 8, marginTop: 6 },
  badge: { position: 'absolute', top: -6, right: -10, backgroundColor: '#EF4444', borderRadius: 9, minWidth: 18, height: 18, paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
