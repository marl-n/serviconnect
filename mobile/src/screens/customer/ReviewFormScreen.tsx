import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { reviewsApi } from '../../services/api';

interface Props {
  businessId: string;
  businessName: string;
  onBack: () => void;
  onSuccess: () => void;
}

export default function ReviewFormScreen({ businessId, businessName, onBack, onSuccess }: Props) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [canReview, setCanReview] = useState(false);
  const [blockReason, setBlockReason] = useState<string | null>(null);

  useEffect(() => {
    reviewsApi.canReview(businessId)
      .then(res => {
        setCanReview(res.data.canReview);
        setBlockReason(res.data.reason);
      })
      .catch(() => setCanReview(false))
      .finally(() => setChecking(false));
  }, [businessId]);

  const submit = async () => {
    if (rating === 0) {
      Alert.alert('Rating required', 'Please select a star rating before submitting.');
      return;
    }
    setLoading(true);
    try {
      await reviewsApi.createReview({
        businessId,
        rating,
        comment: comment.trim() || undefined,
      });
      Alert.alert(
        'Review submitted!',
        'Thank you for your feedback. It helps other customers find great businesses.',
        [{ text: 'Done', onPress: onSuccess }]
      );
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Could not submit review. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const blockMessages: Record<string, { title: string; body: string }> = {
    no_completed_job: {
      title: 'Complete a job first',
      body: 'You can only review a business after they have sent you a quote and you have accepted it.',
    },
    already_reviewed: {
      title: 'Already reviewed',
      body: 'You have already submitted a review for this business.',
    },
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <FontAwesome name="arrow-left" size={16} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Leave a Review</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {/* Business banner */}
        <View style={s.bizBanner}>
          <View style={s.bizAvatar}>
            <Text style={s.bizAvatarText}>{businessName.charAt(0).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={s.bizLabel}>Reviewing</Text>
            <Text style={s.bizName}>{businessName}</Text>
          </View>
        </View>

        {checking ? (
          <View style={s.center}>
            <ActivityIndicator color="#1A56F0" />
            <Text style={s.checkingText}>Checking eligibility…</Text>
          </View>
        ) : !canReview ? (
          <View style={s.blockedBox}>
            <FontAwesome
              name={blockReason === 'already_reviewed' ? 'check-circle' : 'lock'}
              size={32}
              color={blockReason === 'already_reviewed' ? '#12B76A' : '#9CA3AF'}
              style={{ marginBottom: 12 }}
            />
            <Text style={s.blockedTitle}>
              {blockMessages[blockReason ?? 'no_completed_job']?.title ?? 'Cannot review'}
            </Text>
            <Text style={s.blockedBody}>
              {blockMessages[blockReason ?? 'no_completed_job']?.body ?? 'Something went wrong.'}
            </Text>
            <TouchableOpacity style={s.backBtnFull} onPress={onBack}>
              <Text style={s.backBtnFullText}>Go back</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Star rating */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Your rating</Text>
              <View style={s.starsRow}>
                {[1, 2, 3, 4, 5].map(star => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setRating(star)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <FontAwesome
                      name={star <= rating ? 'star' : 'star-o'}
                      size={40}
                      color={star <= rating ? '#FBBF24' : '#D1D5DB'}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              {rating > 0 && (
                <Text style={s.ratingLabel}>
                  {['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'][rating]}
                </Text>
              )}
            </View>

            {/* Comment */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Your review <Text style={s.optional}>(optional)</Text></Text>
              <TextInput
                style={[s.input, s.textArea]}
                placeholder="Tell others about your experience — quality of work, professionalism, value for money…"
                placeholderTextColor="#9CA3AF"
                value={comment}
                onChangeText={setComment}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                maxLength={500}
              />
              <Text style={s.charCount}>{comment.length}/500</Text>
            </View>

            {/* Info box */}
            <View style={s.infoBox}>
              <FontAwesome name="check-circle" size={13} color="#065F46" style={{ marginRight: 8 }} />
              <Text style={s.infoText}>
                Your review will be marked as verified since you completed a job with this business.
              </Text>
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[s.submitBtn, (rating === 0 || loading) && s.submitDisabled]}
              onPress={submit}
              disabled={rating === 0 || loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <>
                    <FontAwesome name="send" size={14} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={s.submitText}>Submit Review</Text>
                  </>
              }
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FB' },
  header: { backgroundColor: '#0D1B4B', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14 },
  backBtn: { padding: 4, width: 36 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  content: { padding: 16 },
  bizBanner: { backgroundColor: '#fff', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20, borderWidth: 0.5, borderColor: '#E5E7EB' },
  bizAvatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#1A56F0', justifyContent: 'center', alignItems: 'center' },
  bizAvatarText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  bizLabel: { fontSize: 11, color: '#9CA3AF', marginBottom: 2 },
  bizName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  center: { alignItems: 'center', paddingVertical: 40 },
  checkingText: { marginTop: 10, fontSize: 13, color: '#9CA3AF' },
  blockedBox: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 16 },
  blockedTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 8, textAlign: 'center' },
  blockedBody: { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  backBtnFull: { backgroundColor: '#F3F4F6', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 32 },
  backBtnFullText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 12 },
  optional: { fontWeight: '400', color: '#9CA3AF' },
  starsRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  ratingLabel: { fontSize: 14, fontWeight: '600', color: '#FBBF24', textAlign: 'center' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#111827' },
  textArea: { height: 130, paddingTop: 12 },
  charCount: { fontSize: 11, color: '#9CA3AF', textAlign: 'right', marginTop: 4 },
  infoBox: { backgroundColor: '#ECFDF5', borderRadius: 10, padding: 12, borderWidth: 0.5, borderColor: '#A7F3D0', flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  infoText: { fontSize: 12, color: '#065F46', lineHeight: 18, flex: 1 },
  submitBtn: { backgroundColor: '#1A56F0', borderRadius: 14, paddingVertical: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});