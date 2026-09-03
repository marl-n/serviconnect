import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Linking, Share
} from 'react-native';
import { businessApi, reviewsApi } from '../../services/api';
import RequestQuoteScreen from './RequestQuoteScreen';
import { savedApi } from '../../services/api';
import FontAwesome from '@expo/vector-icons/build/FontAwesome';

interface Props {
  slug: string;
  onBack: () => void;
  onRequestQuote: (businessId: string, businessName: string) => void;
}

export default function BusinessProfileScreen({ slug, onBack, onRequestQuote }: Props) {
  const [business, setBusiness] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'about' | 'reviews'>('about');
  const [showQuote, setShowQuote] = useState(false);
  const [quoteBusinessId, setQuoteBusinessId] = useState('');
  const [quoteBusinessName, setQuoteBusinessName] = useState('');
  const [isSaved, setIsSaved] = useState(false);
const [savingToggle, setSavingToggle] = useState(false);

  useEffect(() => {
  businessApi.getBySlug(slug)
    .then(async (bizRes) => {
      setBusiness(bizRes.data);
      const [revRes, savedRes] = await Promise.all([
        reviewsApi.getBusinessReviews(bizRes.data.id),
        savedApi.isSaved(bizRes.data.id).catch(() => ({ data: { saved: false } })),
      ]);
      setReviews(revRes.data?.data ?? []);
      setIsSaved(savedRes.data.saved);
    })
    .catch(console.error)
    .finally(() => setLoading(false));
}, [slug]);

const toggleSave = async () => {
  if (savingToggle) return;
  setSavingToggle(true);
  const prev = isSaved;
  setIsSaved(!prev); // optimistic update
  try {
    if (prev) await savedApi.unsave(business.id);
    else await savedApi.save(business.id);
  } catch {
    setIsSaved(prev); // revert on failure
  } finally {
    setSavingToggle(false);
  }
};

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color="#1A56F0" />
    </View>
  );

  if (!business) return (
    <View style={s.center}>
      <Text style={s.errorText}>Business not found.</Text>
    </View>
  );

  if (showQuote) {
    return (
      <RequestQuoteScreen
        businessId={quoteBusinessId}
        businessName={quoteBusinessName}
        onBack={() => setShowQuote(false)}
        onSuccess={() => {
          setShowQuote(false);
          onBack();
        }}
      />
    );
  }

  const call = () => business.phone && Linking.openURL(`tel:${business.phone}`);
  const whatsapp = () => {
    const n = (business.whatsapp ?? business.phone)?.replace(/\D/g, '');
    if (n) Linking.openURL(`https://wa.me/${n}`);
  };
  const share = () => Share.share({ message: `Check out ${business.name} on ServiConnect!` });
  const stars = (r: number) => '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));
  const price = (c: number) => `R${(c / 100).toLocaleString()}`;
  const priceRange = (min?: number, max?: number) => {
    if (min && max) return `${price(min)} – ${price(max)}`;
    if (min) return `From ${price(min)}`;
    if (max) return `Up to ${price(max)}`;
    return null;
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
  <TouchableOpacity onPress={onBack} style={s.backBtn}>
    <Text style={s.backText}>← Back</Text>
  </TouchableOpacity>
  <View style={{ flexDirection: 'row', gap: 8 }}>
    <TouchableOpacity onPress={toggleSave} style={s.shareBtn} disabled={savingToggle}>
      <FontAwesome
        name={isSaved ? 'heart' : 'heart-o'}
        size={18}
        color={isSaved ? '#EF4444' : 'rgba(255,255,255,0.7)'}
      />
    </TouchableOpacity>
    <TouchableOpacity onPress={share} style={s.shareBtn}>
      <Text style={s.shareText}>Share</Text>
    </TouchableOpacity>
  </View>
</View>

      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        <View style={s.hero}>
          <View style={s.logoBox}>
            <Text style={s.logoText}>{business.name.charAt(0)}</Text>
          </View>
          <View style={s.heroMeta}>
            <Text style={s.bizName}>{business.name}</Text>
            <Text style={s.bizCat}>{business.category?.name} · {business.suburb ?? business.city}</Text>
            <View style={s.badgeRow}>
              {business.isVerified && (
                <View style={s.verifiedBadge}>
                  <Text style={s.verifiedText}>Verified</Text>
                </View>
              )}
              <View style={s.ratingBadge}>
                <Text style={s.ratingText}>{stars(business.ratingAvg)} {business.ratingAvg.toFixed(1)} ({business.reviewCount})</Text>
              </View>
            </View>
          </View>
        </View>

        {priceRange(business.priceMin, business.priceMax) && (
          <View style={s.priceStrip}>
            <Text style={s.priceLabel}>Pricing range</Text>
            <Text style={s.priceValue}>{priceRange(business.priceMin, business.priceMax)}</Text>
          </View>
        )}

        <View style={s.tabRow}>
          {(['about', 'reviews'] as const).map(tab => (
            <TouchableOpacity key={tab} style={[s.tab, activeTab === tab && s.tabActive]} onPress={() => setActiveTab(tab)}>
              <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
                {tab === 'reviews' ? `Reviews (${business.reviewCount})` : 'About'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'about' && (
          <View style={s.content}>
            {business.description && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>About</Text>
                <Text style={s.bodyText}>{business.description}</Text>
              </View>
            )}

            {business.services?.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Services</Text>
                {business.services.map((sv: any) => (
                  <View key={sv.id} style={s.serviceCard}>
                    <View style={s.serviceTop}>
                      <Text style={s.serviceName}>{sv.title}</Text>
                      {priceRange(sv.priceMin, sv.priceMax) && (
                        <Text style={s.servicePrice}>{priceRange(sv.priceMin, sv.priceMax)}</Text>
                      )}
                    </View>
                    {sv.description && <Text style={s.serviceDesc}>{sv.description}</Text>}
                  </View>
                ))}
              </View>
            )}

            <View style={s.section}>
              <Text style={s.sectionTitle}>Contact</Text>
              {business.phone && (
                <TouchableOpacity onPress={call} style={s.contactRow}>
                  <Text style={s.contactLabel}>Phone</Text>
                  <Text style={s.contactValue}>{business.phone}</Text>
                </TouchableOpacity>
              )}
              {business.whatsapp && (
                <TouchableOpacity onPress={whatsapp} style={s.contactRow}>
                  <Text style={s.contactLabel}>WhatsApp</Text>
                  <Text style={s.contactValue}>{business.whatsapp}</Text>
                </TouchableOpacity>
              )}
              {business.address && (
                <View style={s.contactRow}>
                  <Text style={s.contactLabel}>Address</Text>
                  <Text style={s.contactValue}>{business.address}, {business.city}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {activeTab === 'reviews' && (
          <View style={s.content}>
            {reviews.length === 0 ? (
              <Text style={s.emptyText}>No reviews yet.</Text>
            ) : reviews.map((r: any) => (
              <View key={r.id} style={s.reviewCard}>
                <View style={s.reviewTop}>
                  <View style={s.reviewAvatar}>
                    <Text style={s.reviewAvatarText}>{r.customer?.name?.charAt(0) ?? '?'}</Text>
                  </View>
                  <View>
                    <Text style={s.reviewName}>{r.customer?.name}</Text>
                    <Text style={s.reviewStars}>{stars(r.rating)}</Text>
                  </View>
                </View>
                {r.comment && <Text style={s.reviewComment}>{r.comment}</Text>}
                {r.reply && (
                  <View style={s.replyBox}>
                    <Text style={s.replyLabel}>Business reply</Text>
                    <Text style={s.replyText}>{r.reply}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={s.bottomBar}>
        <TouchableOpacity style={s.whatsappBtn} onPress={whatsapp}>
          <Text style={s.whatsappText}>WhatsApp</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.quoteBtn}
          onPress={() => {
            setQuoteBusinessId(business.id);
            setQuoteBusinessName(business.name);
            setShowQuote(true);
          }}>
          <Text style={s.quoteText}>Request Quote</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#6B7280', fontSize: 14 },
  header: { backgroundColor: '#0D1B4B', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14 },
  backBtn: { width: 60 },
  backText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  shareBtn: { padding: 4 },
  shareText: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  hero: { backgroundColor: '#0D1B4B', flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingBottom: 22 },
  logoBox: { width: 58, height: 58, borderRadius: 14, backgroundColor: '#1A56F0', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  logoText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  heroMeta: { flex: 1 },
  bizName: { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 3 },
  bizCat: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginBottom: 8 },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  verifiedBadge: { backgroundColor: '#ECFDF5', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  verifiedText: { color: '#065F46', fontSize: 10, fontWeight: '700' },
  ratingBadge: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  ratingText: { color: '#FBBF24', fontSize: 10 },
  priceStrip: { backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  priceLabel: { fontSize: 13, color: '#6B7280' },
  priceValue: { fontSize: 13, fontWeight: '700', color: '#111827' },
  tabRow: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#1A56F0' },
  tabText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  tabTextActive: { color: '#1A56F0', fontWeight: '700' },
  content: { padding: 16 },
  section: { marginBottom: 22 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  bodyText: { fontSize: 14, color: '#374151', lineHeight: 22 },
  serviceCard: { backgroundColor: '#fff', borderRadius: 10, padding: 13, marginBottom: 8, borderWidth: 0.5, borderColor: '#E5E7EB' },
  serviceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  serviceName: { fontSize: 13, fontWeight: '600', color: '#111827', flex: 1 },
  servicePrice: { fontSize: 12, fontWeight: '700', color: '#1A56F0', marginLeft: 8 },
  serviceDesc: { fontSize: 12, color: '#6B7280', lineHeight: 18 },
  contactRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  contactLabel: { fontSize: 13, color: '#6B7280' },
  contactValue: { fontSize: 13, fontWeight: '500', color: '#1A56F0' },
  reviewCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 0.5, borderColor: '#E5E7EB' },
  reviewTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1A56F0', justifyContent: 'center', alignItems: 'center' },
  reviewAvatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  reviewName: { fontSize: 13, fontWeight: '600', color: '#111827' },
  reviewStars: { fontSize: 11, color: '#FBBF24', marginTop: 2 },
  reviewComment: { fontSize: 13, color: '#374151', lineHeight: 20 },
  replyBox: { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 10, marginTop: 10 },
  replyLabel: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  replyText: { fontSize: 12, color: '#374151', lineHeight: 18 },
  emptyText: { textAlign: 'center', color: '#9CA3AF', fontSize: 13, marginTop: 40 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 30, borderTopWidth: 0.5, borderTopColor: '#E5E7EB' },
  whatsappBtn: { flex: 1, backgroundColor: '#25D366', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  whatsappText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  quoteBtn: { flex: 2, backgroundColor: '#1A56F0', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  quoteText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});