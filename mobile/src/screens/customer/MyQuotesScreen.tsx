import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
  Image,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { leadsApi } from '../../services/api';
import { Lead, LeadStatus } from '../../types';
import BusinessProfileScreen from './BusinessProfileScreen';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  onViewBusiness?: (slug: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<LeadStatus, { bg: string; text: string }> = {
  NEW:       { bg: '#FFF3E0', text: '#B45309' },
  VIEWED:    { bg: '#EFF6FF', text: '#1D4ED8' },
  QUOTED:    { bg: '#F5F3FF', text: '#6D28D9' },
  ACCEPTED:  { bg: '#ECFDF5', text: '#065F46' },
  COMPLETED: { bg: '#F3F4F6', text: '#374151' },
  REJECTED:  { bg: '#FEF2F2', text: '#991B1B' },
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW:       'Sent',
  VIEWED:    'Seen',
  QUOTED:    'Quote received',
  ACCEPTED:  'Accepted',
  COMPLETED: 'Completed',
  REJECTED:  'Declined',
};

const STATUS_DESCRIPTIONS: Record<LeadStatus, string> = {
  NEW:       'Waiting for the business to respond',
  VIEWED:    'The business has seen your request',
  QUOTED:    'You have a quote to review',
  ACCEPTED:  'You accepted their quote',
  COMPLETED: 'This job has been completed',
  REJECTED:  'The business could not take this job',
};

const STATUS_ICONS: Record<LeadStatus, string> = {
  NEW:       'clock-o',
  VIEWED:    'eye',
  QUOTED:    'exclamation-circle',
  ACCEPTED:  'check-circle',
  COMPLETED: 'flag-checkered',
  REJECTED:  'times-circle',
};

const FILTERS: (LeadStatus | 'ALL')[] = [
  'ALL', 'NEW', 'VIEWED', 'QUOTED', 'ACCEPTED', 'COMPLETED',
];

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const timeStr = date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `Today, ${timeStr}`;
  if (diffDays === 1) return `Yesterday, ${timeStr}`;
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatPrice(cents: number): string {
  return `R${(cents / 100).toLocaleString('en-ZA')}`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

// ─── Business Avatar ──────────────────────────────────────────────────────────

function BusinessAvatar({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  const [imgError, setImgError] = useState(false);

  if (logoUrl && !imgError) {
    return (
      <Image
        source={{ uri: logoUrl }}
        style={s.bizAvatar}
        onError={() => setImgError(true)}
      />
    );
  }

  const colors = ['#1A56F0', '#0D1B4B', '#6D28D9', '#065F46', '#B45309', '#991B1B'];
  const bg = colors[name.charCodeAt(0) % colors.length];

  return (
    <View style={[s.bizAvatar, { backgroundColor: bg }]}>
      <Text style={s.bizAvatarText}>{getInitials(name)}</Text>
    </View>
  );
}

// ─── Contact Buttons ──────────────────────────────────────────────────────────
// business.phone is not in the Lead type but the API returns it — cast as any safely

function ContactButtons({ lead }: { lead: Lead }) {
  const biz = lead.business as any;
  const phone: string | undefined = biz?.phone;
  const whatsapp: string | undefined = biz?.whatsapp ?? biz?.phone;

  const call = () => {
    if (phone) Linking.openURL(`tel:${phone}`);
    else Alert.alert('No number', 'This business has not provided a phone number.');
  };

  const openWhatsApp = () => {
    const number = whatsapp?.replace(/\D/g, '');
    if (number) Linking.openURL(`https://wa.me/${number}`);
    else Alert.alert('No number', 'This business has not provided a WhatsApp number.');
  };

  const sms = () => {
    if (phone) Linking.openURL(`sms:${phone}`);
    else Alert.alert('No number', 'This business has not provided a phone number.');
  };

  return (
    <View style={s.contactRow}>
      <TouchableOpacity style={[s.contactBtn, s.callBtn]} onPress={call}>
        <FontAwesome name="phone" size={14} color="#fff" />
        <Text style={s.contactBtnText}>Call</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[s.contactBtn, s.waBtn]} onPress={openWhatsApp}>
        <FontAwesome name="whatsapp" size={14} color="#fff" />
        <Text style={s.contactBtnText}>WhatsApp</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[s.contactBtn, s.smsBtn]} onPress={sms}>
        <FontAwesome name="comment" size={14} color="#1A56F0" />
        <Text style={[s.contactBtnText, { color: '#1A56F0' }]}>SMS</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Quote Block ──────────────────────────────────────────────────────────────

function QuoteBlock({
  lead,
  quote,
  onReload,
  onViewBusiness,
}: {
  lead: Lead;
  quote: Lead['quotes'][0];
  onReload: () => void;
  onViewBusiness: () => void;
}) {
  const [acting, setActing] = useState(false);
  const isAccepted = quote.status === 'ACCEPTED' || lead.status === 'ACCEPTED';

  const handleAccept = async () => {
    setActing(true);
    try {
      await leadsApi.acceptQuote(quote.id);
      onReload();
    } catch {
      Alert.alert('Error', 'Could not accept quote. Please try again.');
    } finally {
      setActing(false);
    }
  };

  const handleDecline = () => {
    Alert.alert(
      'Decline Quote',
      'Are you sure you want to decline this quote?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setActing(true);
            try {
              await leadsApi.updateStatus(lead.id, 'REJECTED');
              onReload();
            } catch {
              Alert.alert('Error', 'Could not decline. Please try again.');
            } finally {
              setActing(false);
            }
          },
        },
      ]
    );
  };

  const handleDiscuss = () => {
    const biz = lead.business as any;
    const number = (biz?.whatsapp ?? biz?.phone)?.replace(/\D/g, '');
    const msg = `Hi, regarding your quote of ${formatPrice(quote.amount)} for: "${lead.message.slice(0, 80)}"`;
    if (number) {
      Linking.openURL(`https://wa.me/${number}?text=${encodeURIComponent(msg)}`);
    } else {
      Linking.openURL(`whatsapp://send?text=${encodeURIComponent(msg)}`).catch(() => {
        Alert.alert('WhatsApp not available', 'Please install WhatsApp to use this feature.');
      });
    }
  };

  return (
    <View style={s.quoteBox}>
      <View style={s.quoteHeader}>
        <Text style={s.quoteLabel}>Quote received</Text>
        <Text style={s.quoteAmount}>{formatPrice(quote.amount)}</Text>
      </View>

      <Text style={s.quoteDesc}>{quote.description}</Text>

      <View style={s.metaInfoRow}>
        <FontAwesome name="clock-o" size={11} color="#9CA3AF" style={s.metaInfoIcon} />
        <Text style={s.metaInfoText}>
          Valid until{' '}
          {new Date(quote.validUntil).toLocaleDateString('en-ZA', {
            day: 'numeric', month: 'short', year: 'numeric',
          })}
        </Text>
      </View>

      {/* PENDING — show accept / decline / discuss */}
      {quote.status === 'PENDING' && !isAccepted && (
        <View style={s.quoteActions}>
          <TouchableOpacity
            style={[s.actionBtn, s.acceptBtn, acting && s.actionBtnDisabled]}
            onPress={handleAccept}
            disabled={acting}>
            {acting
              ? <ActivityIndicator size="small" color="#fff" />
              : <>
                  <FontAwesome name="check" size={13} color="#fff" style={{ marginRight: 5 }} />
                  <Text style={s.acceptBtnText}>Accept</Text>
                </>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.actionBtn, s.declineBtn, acting && s.actionBtnDisabled]}
            onPress={handleDecline}
            disabled={acting}>
            <FontAwesome name="times" size={13} color="#DC2626" style={{ marginRight: 5 }} />
            <Text style={s.declineBtnText}>Decline</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[s.actionBtn, s.discussBtn]} onPress={handleDiscuss}>
            <FontAwesome name="whatsapp" size={13} color="#fff" style={{ marginRight: 5 }} />
            <Text style={s.discussBtnText}>Discuss</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ACCEPTED — show confirmation + contact buttons */}
      {isAccepted && (
        <View style={s.acceptedSection}>
          <View style={s.acceptedConfirm}>
            <FontAwesome name="check-circle" size={15} color="#065F46" style={{ marginRight: 7 }} />
            <View>
              <Text style={s.acceptedTitle}>Quote accepted</Text>
              <Text style={s.acceptedSub}>Contact the business to arrange the job.</Text>
            </View>
          </View>
          <ContactButtons lead={lead} />
        </View>
      )}

      {quote.status === 'REJECTED' && !isAccepted && (
        <View style={s.quoteStatusRow}>
          <FontAwesome name="times-circle" size={14} color="#991B1B" style={{ marginRight: 6 }} />
          <Text style={[s.quoteStatusText, { color: '#991B1B' }]}>Quote declined</Text>
        </View>
      )}

      {quote.status === 'EXPIRED' && !isAccepted && (
        <View style={s.quoteStatusRow}>
          <FontAwesome name="clock-o" size={14} color="#6B7280" style={{ marginRight: 6 }} />
          <Text style={[s.quoteStatusText, { color: '#6B7280' }]}>Quote expired</Text>
        </View>
      )}
    </View>
  );
}

// ─── Lead Card ────────────────────────────────────────────────────────────────

function LeadCard({
  lead,
  isExpanded,
  onToggle,
  onViewBusiness,
  onReload,
}: {
  lead: Lead;
  isExpanded: boolean;
  onToggle: () => void;
  onViewBusiness: () => void;
  onReload: () => void;
}) {
  const color = STATUS_COLORS[lead.status] ?? { bg: '#F3F4F6', text: '#374151' };
  const hasQuote = lead.quotes?.length > 0;
  const latestQuote = lead.quotes?.[0];
  const isQuotePending = hasQuote && latestQuote.status === 'PENDING' && lead.status !== 'ACCEPTED';

  return (
    <View style={[s.card, isExpanded && s.cardExpanded, isQuotePending && s.cardHighlighted]}>

      {/* Tappable card header — toggle expand + avatar navigates to profile */}
      <View style={s.cardTop}>
        {/* Avatar — tappable → business profile */}
        <TouchableOpacity onPress={onViewBusiness} activeOpacity={0.7} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <BusinessAvatar
            name={lead.business?.name ?? 'B'}
            logoUrl={(lead.business as any)?.logoUrl}
          />
        </TouchableOpacity>

        {/* Name + date — tappable → toggle expand */}
        <TouchableOpacity style={s.cardMeta} onPress={onToggle} activeOpacity={0.85}>
          <Text style={s.bizName} numberOfLines={1}>
            {lead.business?.name ?? 'Business'}
          </Text>
          <View style={s.cardMetaRow}>
            <Text style={s.dateText}>{formatRelativeDate(lead.createdAt)}</Text>
            {hasQuote && latestQuote.status === 'PENDING' && lead.status !== 'ACCEPTED' && (
              <>
                <Text style={s.metaDot}>·</Text>
                <Text style={s.quotePreview}>{formatPrice(latestQuote.amount)}</Text>
              </>
            )}
          </View>
        </TouchableOpacity>

        {/* Status badge + chevron — toggle expand */}
        <TouchableOpacity style={s.cardRight} onPress={onToggle} activeOpacity={0.85} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <View style={[s.statusBadge, { backgroundColor: color.bg }]}>
            <Text style={[s.statusText, { color: color.text }]}>
              {STATUS_LABELS[lead.status]}
            </Text>
          </View>
          <FontAwesome
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={11}
            color="#C4C9D4"
            style={s.chevron}
          />
        </TouchableOpacity>
      </View>

      {/* Status hint — collapsed only */}
      {!isExpanded && (
        <TouchableOpacity onPress={onToggle} activeOpacity={0.85}>
          <View style={s.statusHint}>
            <FontAwesome
              name={STATUS_ICONS[lead.status] as any}
              size={11}
              color={isQuotePending ? '#6D28D9' : '#9CA3AF'}
              style={{ marginRight: 5 }}
            />
            <Text style={[s.statusHintText, isQuotePending && s.statusHintHighlight]}>
              {STATUS_DESCRIPTIONS[lead.status]}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Expanded content */}
      {isExpanded && (
        <View style={s.expandedContent}>

          {/* Your request */}
          <View style={s.expandedSection}>
            <Text style={s.expandedSectionTitle}>Your request</Text>
            <Text style={s.messageText}>{lead.message}</Text>
            {lead.jobAddress && (
              <View style={s.metaInfoRow}>
                <FontAwesome name="map-marker" size={12} color="#9CA3AF" style={s.metaInfoIcon} />
                <Text style={s.metaInfoText}>{lead.jobAddress}</Text>
              </View>
            )}
            {lead.budget && (
              <View style={s.metaInfoRow}>
                <FontAwesome name="money" size={12} color="#9CA3AF" style={s.metaInfoIcon} />
                <Text style={s.metaInfoText}>Your budget: {formatPrice(lead.budget)}</Text>
              </View>
            )}
          </View>

          {/* Quote */}
          {hasQuote && (
            <QuoteBlock
              lead={lead}
              quote={latestQuote}
              onReload={onReload}
              onViewBusiness={onViewBusiness}
            />
          )}

          {/* Completed placeholder — Leave Review slots in here later */}
          {lead.status === 'COMPLETED' && (
            <View style={s.completedBox}>
              <FontAwesome name="flag-checkered" size={15} color="#374151" style={{ marginRight: 8 }} />
              <Text style={s.completedText}>This job is complete.</Text>
              {/* <TouchableOpacity onPress={onLeaveReview}><Text>Leave a review</Text></TouchableOpacity> */}
            </View>
          )}

          {/* View business profile button */}
          {lead.business?.slug && (
            <TouchableOpacity style={s.viewBizBtn} onPress={onViewBusiness}>
              <FontAwesome name="building" size={13} color="#1A56F0" style={{ marginRight: 8 }} />
              <Text style={s.viewBizText}>View business profile</Text>
              <View style={s.viewBizChevronWrap}>
                <FontAwesome name="chevron-right" size={11} color="#1A56F0" />
              </View>
            </TouchableOpacity>
          )}

        </View>
      )}
    </View>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({
  filter,
  onClearFilter,
}: {
  filter: LeadStatus | 'ALL';
  onClearFilter?: () => void;
}) {
  const isFiltered = filter !== 'ALL';
  return (
    <View style={s.emptyBox}>
      <View style={s.emptyIconBox}>
        <FontAwesome name={isFiltered ? 'filter' : 'file-text-o'} size={30} color="#9CA3AF" />
      </View>
      <Text style={s.emptyTitle}>
        {isFiltered
          ? `No ${STATUS_LABELS[filter as LeadStatus].toLowerCase()} requests`
          : 'No quote requests yet'}
      </Text>
      <Text style={s.emptyText}>
        {isFiltered
          ? 'Try a different filter to see your other requests.'
          : 'Find a service and tap "Get Quote" to send your first request.'}
      </Text>
      {isFiltered && onClearFilter && (
        <TouchableOpacity style={s.emptyCta} onPress={onClearFilter}>
          <Text style={s.emptyCtaText}>View all requests</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MyQuotesScreen({ onViewBusiness }: Props) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<LeadStatus | 'ALL'>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewingSlug, setViewingSlug] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await leadsApi.getMyLeads();
      setLeads(res.data ?? []);
    } catch (err) {
      console.error('MyQuotesScreen load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setExpandedId(null);
    load(true);
  }, [load]);

  const handleFilterChange = (filter: LeadStatus | 'ALL') => {
    setActiveFilter(filter);
    setExpandedId(null);
  };

  const filteredLeads = activeFilter === 'ALL'
    ? leads
    : leads.filter(l => l.status === activeFilter);

  // All hooks declared — safe to return conditionally
  if (viewingSlug) {
    return (
      <BusinessProfileScreen
        slug={viewingSlug}
        onBack={() => setViewingSlug(null)}
        onRequestQuote={() => setViewingSlug(null)}
      />
    );
  }

  if (loading) {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <Text style={s.headerTitle}>My Quote Requests</Text>
        </View>
        <View style={s.center}>
          <ActivityIndicator size="large" color="#1A56F0" />
          <Text style={s.loadingText}>Loading your requests…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>My Quote Requests</Text>
        <Text style={s.headerSub}>
          {leads.length === 0
            ? 'No requests yet'
            : `${leads.length} request${leads.length !== 1 ? 's' : ''}`}
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

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterRow}>
          {FILTERS.map(f => {
            const count = f === 'ALL' ? leads.length : leads.filter(l => l.status === f).length;
            if (f !== 'ALL' && count === 0) return null;
            const isActive = activeFilter === f;
            return (
              <TouchableOpacity
                key={f}
                onPress={() => handleFilterChange(f)}
                style={[s.filterChip, isActive && s.filterChipActive]}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                <Text style={[s.filterText, isActive && s.filterTextActive]}>
                  {f === 'ALL' ? 'All' : STATUS_LABELS[f as LeadStatus]} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Content */}
        {filteredLeads.length === 0 ? (
          <EmptyState
            filter={activeFilter}
            onClearFilter={activeFilter !== 'ALL' ? () => handleFilterChange('ALL') : undefined}
          />
        ) : (
          <View style={s.cardList}>
            {filteredLeads.map(lead => (
              <LeadCard
                key={lead.id}
                lead={lead}
                isExpanded={expandedId === lead.id}
                onToggle={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                onViewBusiness={() => setViewingSlug(lead.business?.slug)}
                onReload={() => load(true)}
              />
            ))}
          </View>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  loadingText: { marginTop: 12, fontSize: 13, color: '#9CA3AF' },

  header: { backgroundColor: '#0D1B4B', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 16 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 3 },

  filterRow: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4, gap: 8, flexDirection: 'row' },
  filterChip: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, minHeight: 36, justifyContent: 'center' },
  filterChipActive: { backgroundColor: '#1A56F0', borderColor: '#1A56F0' },
  filterText: { fontSize: 12, color: '#374151', fontWeight: '500' },
  filterTextActive: { color: '#fff', fontWeight: '600' },

  emptyBox: { alignItems: 'center', paddingTop: 56, paddingHorizontal: 32 },
  emptyIconBox: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 8, textAlign: 'center' },
  emptyText: { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  emptyCta: { marginTop: 20, backgroundColor: '#1A56F0', borderRadius: 10, paddingVertical: 11, paddingHorizontal: 20 },
  emptyCtaText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  cardList: { paddingHorizontal: 14, paddingTop: 10 },

  card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 0.5, borderColor: '#E5E7EB' },
  cardExpanded: { borderColor: '#1A56F0', borderWidth: 1.5 },
  cardHighlighted: { borderColor: '#A78BFA', borderWidth: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  bizAvatar: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0, backgroundColor: '#1A56F0' },
  bizAvatarText: { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: -0.5 },

  cardMeta: { flex: 1, minWidth: 0 },
  bizName: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 3 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dateText: { fontSize: 11, color: '#9CA3AF' },
  metaDot: { fontSize: 11, color: '#D1D5DB' },
  quotePreview: { fontSize: 12, fontWeight: '700', color: '#6D28D9' },

  cardRight: { alignItems: 'flex-end', gap: 6 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
  statusText: { fontSize: 10, fontWeight: '700' },
  chevron: { marginTop: 2 },

  statusHint: { flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: '#F3F4F6' },
  statusHintText: { fontSize: 12, color: '#9CA3AF', flex: 1 },
  statusHintHighlight: { color: '#6D28D9', fontWeight: '600' },

  expandedContent: { marginTop: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: '#F3F4F6' },
  expandedSection: { marginBottom: 14 },
  expandedSectionTitle: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  messageText: { fontSize: 13, color: '#374151', lineHeight: 20, marginBottom: 8 },
  metaInfoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  metaInfoIcon: { width: 18 },
  metaInfoText: { fontSize: 12, color: '#6B7280', flex: 1 },

  quoteBox: { backgroundColor: '#F8F5FF', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 0.5, borderColor: '#DDD6FE' },
  quoteHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  quoteLabel: { fontSize: 10, fontWeight: '700', color: '#7C3AED', textTransform: 'uppercase', letterSpacing: 0.6 },
  quoteAmount: { fontSize: 22, fontWeight: '800', color: '#6D28D9' },
  quoteDesc: { fontSize: 13, color: '#374151', lineHeight: 19, marginBottom: 8 },
  quoteActions: { flexDirection: 'row', gap: 7, marginTop: 12 },
  actionBtn: { flex: 1, borderRadius: 10, paddingVertical: 11, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', minHeight: 42 },
  actionBtnDisabled: { opacity: 0.5 },
  acceptBtn: { flex: 2, backgroundColor: '#1A56F0' },
  acceptBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  declineBtn: { borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  declineBtnText: { color: '#DC2626', fontWeight: '600', fontSize: 13 },
  discussBtn: { backgroundColor: '#25D366' },
  discussBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  acceptedSection: { marginTop: 10 },
  acceptedConfirm: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  acceptedTitle: { fontSize: 13, fontWeight: '700', color: '#065F46' },
  acceptedSub: { fontSize: 12, color: '#374151', marginTop: 2 },

  contactRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  contactBtn: { flex: 1, borderRadius: 10, paddingVertical: 11, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, minHeight: 42 },
  contactBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  callBtn: { backgroundColor: '#1A56F0' },
  waBtn: { backgroundColor: '#25D366' },
  smsBtn: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },

  quoteStatusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 10 },
  quoteStatusText: { fontSize: 13, fontWeight: '600' },

  completedBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 10, padding: 12, marginBottom: 12 },
  completedText: { fontSize: 13, color: '#374151', fontWeight: '500' },

  viewBizBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', borderRadius: 10, padding: 12, marginTop: 4 },
  viewBizText: { fontSize: 13, color: '#1A56F0', fontWeight: '600', flex: 1 },
  viewBizChevronWrap: { width: 20, alignItems: 'flex-end' },
});