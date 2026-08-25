import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { businessApi, searchApi } from '../../services/api';

interface Props {
  onComplete: (business: any) => void;
}

export default function OnboardingScreen({ onComplete }: Props) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [address, setAddress] = useState('');
  const [suburb, setSuburb] = useState('');
  const [city, setCity] = useState('Johannesburg');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [yearsInBusiness, setYearsInBusiness] = useState('');

  const totalSteps = 4;

  const loadCategories = async () => {
    if (categoriesLoaded) return;
    try {
      const res = await searchApi.categories();
      setCategories(res.data);
      setCategoriesLoaded(true);
    } catch {
      Alert.alert('Error', 'Could not load categories.');
    }
  };

  const nextStep = () => {
    if (step === 1) {
      if (!name.trim()) { Alert.alert('Required', 'Please enter your business name.'); return; }
      if (!categoryId) { Alert.alert('Required', 'Please select a service category.'); return; }
    }
    if (step === 2) {
      if (!phone.trim()) { Alert.alert('Required', 'Please enter a contact number.'); return; }
      if (!suburb.trim()) { Alert.alert('Required', 'Please enter your suburb.'); return; }
    }
    if (step < totalSteps) setStep(step + 1);
  };

  const submit = async () => {
  setLoading(true);
  try {
    const data: any = {
      name: name.trim(),
      categoryId,
      phone: phone.trim(),
      whatsapp: whatsapp.trim() || phone.trim(),
      suburb: suburb.trim(),
      city: city.trim(),
    };

    if (description.trim()) data.description = description.trim();
    if (address.trim()) data.address = address.trim();
    if (yearsInBusiness) data.yearsInBusiness = parseInt(yearsInBusiness);
    if (priceMin) data.priceMin = Math.round(parseFloat(priceMin) * 100);
    if (priceMax) data.priceMax = Math.round(parseFloat(priceMax) * 100);

    const res = await businessApi.create(data);
    onComplete(res.data);
  } catch (err: any) {
    console.error(err?.response?.data);
    Alert.alert('Error', 'Could not create your business. Please try again.');
  } finally {
    setLoading(false);
  }
};

  const renderProgressBar = () => (
    <View style={s.progressRow}>
      {Array.from({ length: totalSteps }).map((_, i) => (
        <View key={i} style={[s.progressDot, i < step && s.progressDotActive]} />
      ))}
    </View>
  );

  const renderStep1 = () => (
    <>
      <Text style={s.stepTitle}>Business details</Text>
      <Text style={s.stepSub}>Let's start with the basics</Text>

      <Text style={s.label}>Business name <Text style={s.required}>*</Text></Text>
      <TextInput
        style={s.input}
        placeholder="e.g. 4Set Civil Construction"
        placeholderTextColor="#9CA3AF"
        value={name}
        onChangeText={setName}
      />

      <Text style={s.label}>Service category <Text style={s.required}>*</Text></Text>
      {!categoriesLoaded ? (
        <TouchableOpacity style={s.loadCatBtn} onPress={loadCategories}>
          <FontAwesome name="list" size={14} color="#1A56F0" style={{ marginRight: 8 }} />
          <Text style={s.loadCatText}>Tap to load categories</Text>
        </TouchableOpacity>
      ) : (
        <ScrollView style={s.categoryList} nestedScrollEnabled>
          {categories.map(c => (
            <TouchableOpacity
              key={c.id}
              style={[s.categoryItem, categoryId === c.id && s.categoryItemActive]}
              onPress={() => { setCategoryId(c.id); setCategoryName(c.name); }}>
              <Text style={[s.categoryItemText, categoryId === c.id && s.categoryItemTextActive]}>
                {c.name}
              </Text>
              {categoryId === c.id && (
                <FontAwesome name="check" size={13} color="#1A56F0" />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {categoryId && (
        <View style={s.selectedCat}>
          <FontAwesome name="check-circle" size={14} color="#12B76A" style={{ marginRight: 6 }} />
          <Text style={s.selectedCatText}>{categoryName} selected</Text>
        </View>
      )}

      <Text style={s.label}>Years in business</Text>
      <TextInput
        style={s.input}
        placeholder="e.g. 5"
        placeholderTextColor="#9CA3AF"
        keyboardType="numeric"
        value={yearsInBusiness}
        onChangeText={setYearsInBusiness}
      />
    </>
  );

  const renderStep2 = () => (
    <>
      <Text style={s.stepTitle}>Contact & location</Text>
      <Text style={s.stepSub}>How customers will reach you</Text>

      <Text style={s.label}>Phone number <Text style={s.required}>*</Text></Text>
      <TextInput
        style={s.input}
        placeholder="e.g. 082 555 0000"
        placeholderTextColor="#9CA3AF"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />

      <Text style={s.label}>WhatsApp number</Text>
      <TextInput
        style={s.input}
        placeholder="Leave blank if same as phone"
        placeholderTextColor="#9CA3AF"
        keyboardType="phone-pad"
        value={whatsapp}
        onChangeText={setWhatsapp}
      />

      <Text style={s.label}>Suburb <Text style={s.required}>*</Text></Text>
      <TextInput
        style={s.input}
        placeholder="e.g. Kempton Park"
        placeholderTextColor="#9CA3AF"
        value={suburb}
        onChangeText={setSuburb}
      />

      <Text style={s.label}>Street address</Text>
      <TextInput
        style={s.input}
        placeholder="e.g. 12 Main Street"
        placeholderTextColor="#9CA3AF"
        value={address}
        onChangeText={setAddress}
      />

      <Text style={s.label}>City</Text>
      <TextInput
        style={s.input}
        placeholder="Johannesburg"
        placeholderTextColor="#9CA3AF"
        value={city}
        onChangeText={setCity}
      />
    </>
  );

  const renderStep3 = () => (
    <>
      <Text style={s.stepTitle}>About your business</Text>
      <Text style={s.stepSub}>Help customers understand what you offer</Text>

      <Text style={s.label}>Business description</Text>
      <TextInput
        style={[s.input, s.textArea]}
        placeholder="Describe your services, experience, and what makes you stand out..."
        placeholderTextColor="#9CA3AF"
        multiline
        numberOfLines={5}
        textAlignVertical="top"
        value={description}
        onChangeText={setDescription}
      />

      <Text style={s.label}>Minimum price (R)</Text>
      <TextInput
        style={s.input}
        placeholder="e.g. 500"
        placeholderTextColor="#9CA3AF"
        keyboardType="numeric"
        value={priceMin}
        onChangeText={setPriceMin}
      />

      <Text style={s.label}>Maximum price (R)</Text>
      <TextInput
        style={s.input}
        placeholder="e.g. 50000"
        placeholderTextColor="#9CA3AF"
        keyboardType="numeric"
        value={priceMax}
        onChangeText={setPriceMax}
      />
    </>
  );

  const renderStep4 = () => (
    <>
      <Text style={s.stepTitle}>You're almost there!</Text>
      <Text style={s.stepSub}>Review your details before going live</Text>

      <View style={s.reviewCard}>
        <View style={s.reviewRow}>
          <FontAwesome name="building" size={14} color="#6B7280" style={s.reviewIcon} />
          <View style={s.reviewMeta}>
            <Text style={s.reviewLabel}>Business name</Text>
            <Text style={s.reviewValue}>{name}</Text>
          </View>
        </View>
        <View style={s.reviewRow}>
          <FontAwesome name="tag" size={14} color="#6B7280" style={s.reviewIcon} />
          <View style={s.reviewMeta}>
            <Text style={s.reviewLabel}>Category</Text>
            <Text style={s.reviewValue}>{categoryName}</Text>
          </View>
        </View>
        <View style={s.reviewRow}>
          <FontAwesome name="phone" size={14} color="#6B7280" style={s.reviewIcon} />
          <View style={s.reviewMeta}>
            <Text style={s.reviewLabel}>Phone</Text>
            <Text style={s.reviewValue}>{phone}</Text>
          </View>
        </View>
        <View style={s.reviewRow}>
          <FontAwesome name="map-marker" size={14} color="#6B7280" style={s.reviewIcon} />
          <View style={s.reviewMeta}>
            <Text style={s.reviewLabel}>Location</Text>
            <Text style={s.reviewValue}>{suburb}, {city}</Text>
          </View>
        </View>
        {(priceMin || priceMax) && (
          <View style={s.reviewRow}>
            <FontAwesome name="money" size={14} color="#6B7280" style={s.reviewIcon} />
            <View style={s.reviewMeta}>
              <Text style={s.reviewLabel}>Pricing range</Text>
              <Text style={s.reviewValue}>
                {priceMin ? `R${priceMin}` : ''}
                {priceMin && priceMax ? ' – ' : ''}
                {priceMax ? `R${priceMax}` : ''}
              </Text>
            </View>
          </View>
        )}
      </View>

      <View style={s.infoBox}>
        <FontAwesome name="info-circle" size={14} color="#1D4ED8" style={{ marginRight: 8, marginTop: 1 }} />
        <Text style={s.infoText}>
          Your listing will be reviewed and activated within 24 hours. You'll start receiving leads once it's live.
        </Text>
      </View>
    </>
  );

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.headerTop}>
          {step > 1 && (
            <TouchableOpacity onPress={() => setStep(step - 1)} style={s.backBtn}>
              <FontAwesome name="arrow-left" size={16} color="#fff" />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.headerLabel}>Step {step} of {totalSteps}</Text>
            <Text style={s.headerTitle}>Set up your business</Text>
          </View>
        </View>
        {renderProgressBar()}
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}

        <View style={s.actions}>
          {step < totalSteps ? (
            <TouchableOpacity style={s.nextBtn} onPress={nextStep}>
              <Text style={s.nextBtnText}>Continue</Text>
              <FontAwesome name="arrow-right" size={14} color="#fff" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[s.nextBtn, loading && s.btnDisabled]}
              onPress={submit}
              disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <>
                    <FontAwesome name="check" size={14} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={s.nextBtnText}>Go Live</Text>
                  </>
              }
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FB' },
  header: { backgroundColor: '#0D1B4B', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 16 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  backBtn: { padding: 4 },
  headerLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 2 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  progressRow: { flexDirection: 'row', gap: 6 },
  progressDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
  progressDotActive: { backgroundColor: '#1A56F0' },
  content: { padding: 16 },
  stepTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 4 },
  stepSub: { fontSize: 13, color: '#6B7280', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 4 },
  required: { color: '#EF4444' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#111827', marginBottom: 12 },
  textArea: { height: 120, paddingTop: 12 },
  loadCatBtn: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 12, paddingVertical: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  loadCatText: { color: '#1A56F0', fontWeight: '600', fontSize: 14 },
  categoryList: { maxHeight: 220, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, backgroundColor: '#fff', marginBottom: 12 },
  categoryItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  categoryItemActive: { backgroundColor: '#EFF6FF' },
  categoryItemText: { fontSize: 14, color: '#374151' },
  categoryItemTextActive: { color: '#1A56F0', fontWeight: '600' },
  selectedCat: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  selectedCatText: { fontSize: 13, color: '#12B76A', fontWeight: '600' },
  reviewCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: '#E5E7EB', marginBottom: 14 },
  reviewRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6', gap: 10 },
  reviewIcon: { width: 20, marginTop: 2 },
  reviewMeta: { flex: 1 },
  reviewLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '500', marginBottom: 2 },
  reviewValue: { fontSize: 14, color: '#111827', fontWeight: '600' },
  infoBox: { backgroundColor: '#EFF6FF', borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: '#BFDBFE', flexDirection: 'row', alignItems: 'flex-start' },
  infoText: { fontSize: 12, color: '#1D4ED8', lineHeight: 18, flex: 1 },
  actions: { marginTop: 20 },
  nextBtn: { backgroundColor: '#1A56F0', borderRadius: 14, paddingVertical: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});