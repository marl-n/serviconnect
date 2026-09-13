import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Switch,
  StyleSheet, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { searchApi, businessApi, categoryQuestionsApi, serviceRequestsApi } from '../../services/api';
import { Category, SubCategory, CategoryQuestion } from '../../types';

interface Props {
  onBack?: () => void;
  onSuccess?: () => void;
}

type Answers = Record<string, unknown>;

const TOTAL_STEPS = 4;

export default function NewServiceRequestScreen({ onBack, onSuccess }: Props) {
  const [step, setStep] = useState(1);

  // Step 1 — categories
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [categoryName, setCategoryName] = useState('');

  // Step 2 — subcategories
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [subCategoriesLoading, setSubCategoriesLoading] = useState(false);
  const [subCategoriesError, setSubCategoriesError] = useState(false);
  const [subCategoryId, setSubCategoryId] = useState('');
  const [subCategoryName, setSubCategoryName] = useState('');

  // Step 3 — dynamic questions
  const [questions, setQuestions] = useState<CategoryQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState(false);
  const [answers, setAnswers] = useState<Answers>({});
  const [questionIndex, setQuestionIndex] = useState(0);

  // Step 4 — general details
  const [message, setMessage] = useState('');
  const [jobAddress, setJobAddress] = useState('');
  const [jobDate, setJobDate] = useState('');
  const [budget, setBudget] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setCategoriesLoading(true);
    setCategoriesError(false);
    try {
      const res = await searchApi.categories();
      setCategories(res.data ?? []);
    } catch {
      setCategoriesError(true);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const loadSubCategories = async (catId: string) => {
    setSubCategoriesLoading(true);
    setSubCategoriesError(false);
    setSubCategories([]);
    try {
      const res = await businessApi.getSubCategories(catId);
      setSubCategories(res.data ?? []);
    } catch {
      setSubCategoriesError(true);
    } finally {
      setSubCategoriesLoading(false);
    }
  };

  const loadQuestions = async (catId: string, subCatId: string) => {
    setQuestionsLoading(true);
    setQuestionsError(false);
    setQuestions([]);
    try {
      const res = await categoryQuestionsApi.list(catId, subCatId);
      const sorted = [...(res.data ?? [])].sort((a: CategoryQuestion, b: CategoryQuestion) => a.sortOrder - b.sortOrder);
      setQuestions(sorted);
    } catch {
      setQuestionsError(true);
    } finally {
      setQuestionsLoading(false);
    }
  };

  const selectCategory = (cat: Category) => {
    setCategoryId(cat.id);
    setCategoryName(cat.name);
    setSubCategoryId('');
    setSubCategoryName('');
    setStep(2);
    loadSubCategories(cat.id);
  };

  const selectSubCategory = (sub: SubCategory) => {
    setSubCategoryId(sub.id);
    setSubCategoryName(sub.name);
    setAnswers({});
    setQuestionIndex(0);
    setStep(3);
    loadQuestions(categoryId, sub.id);
  };

  const isAnswerMissing = (q: CategoryQuestion) => {
    const v = answers[q.key];
    return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
  };

  // Validates only the currently displayed question, then either advances
  // to the next question or — on the final question — continues to the
  // existing Details step.
  const questionContinue = () => {
    const q = questions[questionIndex];
    if (q && q.isRequired && isAnswerMissing(q)) {
      Alert.alert('Required', `Please answer: ${q.label}`);
      return;
    }
    if (questionIndex < questions.length - 1) {
      setQuestionIndex(questionIndex + 1);
    } else {
      setStep(4);
    }
  };

  // Steps back one question, preserving all collected answers. From the
  // first question, falls back to the subcategory step.
  const questionBack = () => {
    if (questionIndex > 0) {
      setQuestionIndex(questionIndex - 1);
    } else {
      setStep(2);
    }
  };

  const goBack = () => {
    if (step === 1) {
      onBack?.();
      return;
    }
    setStep(step - 1);
  };

  const setAnswer = (key: string, value: unknown) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
  };

  const resetFlow = () => {
    setStep(1);
    setCategoryId('');
    setCategoryName('');
    setSubCategoryId('');
    setSubCategoryName('');
    setSubCategories([]);
    setQuestions([]);
    setAnswers({});
    setQuestionIndex(0);
    setMessage('');
    setJobAddress('');
    setJobDate('');
    setBudget('');
  };

  const submit = async () => {
    if (submitting) return; // guard against duplicate taps
    if (!message.trim()) {
      Alert.alert('Required', 'Please describe the job you need done.');
      return;
    }
    if (message.trim().length > 2000) {
      Alert.alert('Too long', 'Please keep your description under 2000 characters.');
      return;
    }
    if (!categoryId || !subCategoryId) {
      Alert.alert('Error', 'Please select a category and service type before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      await serviceRequestsApi.create({
        categoryId,
        subCategoryId,
        message: message.trim(),
        jobAddress: jobAddress.trim() || undefined,
        jobDate: jobDate.trim() || undefined,
        budget: budget ? Math.round(parseFloat(budget) * 100) : undefined,
        answers: Object.keys(answers).length > 0 ? answers : undefined,
      });
      Alert.alert(
        'Request Submitted!',
        "We'll match you with businesses that can help. You'll be notified as they respond.",
        [{ text: 'OK', onPress: () => { resetFlow(); onSuccess?.(); } }]
      );
    } catch (err: any) {
      const serverMsg = err?.response?.data?.message;
      const msg = err?.response?.status === 401
        ? 'You need to log in to submit a request.'
        : Array.isArray(serverMsg) ? serverMsg.join('\n') : (serverMsg || 'Something went wrong. Please try again.');
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const renderProgressBar = () => (
    <View style={s.progressRow}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View key={i} style={[s.progressDot, i < step && s.progressDotActive]} />
      ))}
    </View>
  );

  const renderStep1 = () => {
    if (categoriesLoading) {
      return <ActivityIndicator style={{ marginTop: 40 }} color="#1A56F0" />;
    }
    if (categoriesError) {
      return (
        <View style={s.emptyBox}>
          <View style={s.emptyIconBox}>
            <FontAwesome name="exclamation-triangle" size={26} color="#9CA3AF" />
          </View>
          <Text style={s.emptyTitle}>Couldn't load categories</Text>
          <Text style={s.emptyText}>Check your connection and try again.</Text>
          <TouchableOpacity style={s.emptyCta} onPress={loadCategories}>
            <Text style={s.emptyCtaText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (categories.length === 0) {
      return (
        <View style={s.emptyBox}>
          <View style={s.emptyIconBox}>
            <FontAwesome name="folder-open-o" size={26} color="#9CA3AF" />
          </View>
          <Text style={s.emptyTitle}>No categories available</Text>
          <Text style={s.emptyText}>Please check back later.</Text>
        </View>
      );
    }
    return (
      <>
        <Text style={s.stepTitle}>What do you need help with?</Text>
        <Text style={s.stepSub}>Choose the category that best fits your job</Text>
        {categories.map(c => (
          <TouchableOpacity key={c.id} style={s.listItem} onPress={() => selectCategory(c)}>
            <Text style={s.listItemText}>{c.name}</Text>
            <FontAwesome name="chevron-right" size={13} color="#9CA3AF" />
          </TouchableOpacity>
        ))}
      </>
    );
  };

  const renderStep2 = () => {
    if (subCategoriesLoading) {
      return <ActivityIndicator style={{ marginTop: 40 }} color="#1A56F0" />;
    }
    if (subCategoriesError) {
      return (
        <View style={s.emptyBox}>
          <View style={s.emptyIconBox}>
            <FontAwesome name="exclamation-triangle" size={26} color="#9CA3AF" />
          </View>
          <Text style={s.emptyTitle}>Couldn't load service types</Text>
          <Text style={s.emptyText}>Check your connection and try again.</Text>
          <TouchableOpacity style={s.emptyCta} onPress={() => loadSubCategories(categoryId)}>
            <Text style={s.emptyCtaText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (subCategories.length === 0) {
      return (
        <View style={s.emptyBox}>
          <View style={s.emptyIconBox}>
            <FontAwesome name="folder-open-o" size={26} color="#9CA3AF" />
          </View>
          <Text style={s.emptyTitle}>No service types for {categoryName}</Text>
          <Text style={s.emptyText}>
            This category doesn't have any specific service types set up yet, so a request can't be submitted for it right now.
          </Text>
          <TouchableOpacity style={s.emptyCta} onPress={() => setStep(1)}>
            <Text style={s.emptyCtaText}>Choose a different category</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <>
        <Text style={s.stepTitle}>What type of {categoryName.toLowerCase()} job?</Text>
        <Text style={s.stepSub}>This helps us match you with the right businesses</Text>
        {subCategories.map(sc => (
          <TouchableOpacity key={sc.id} style={s.listItem} onPress={() => selectSubCategory(sc)}>
            <Text style={s.listItemText}>{sc.name}</Text>
            <FontAwesome name="chevron-right" size={13} color="#9CA3AF" />
          </TouchableOpacity>
        ))}
      </>
    );
  };

  const renderQuestion = (q: CategoryQuestion) => {
    const value = answers[q.key];
    const options: string[] = Array.isArray(q.options) ? q.options as string[] : [];

    return (
      <View key={q.id} style={s.field}>
        <Text style={s.label}>
          {q.label} {q.isRequired && <Text style={s.required}>*</Text>}
        </Text>

        {q.type === 'TEXT' && (
          <TextInput
            style={s.input}
            placeholder="Type your answer"
            placeholderTextColor="#9CA3AF"
            value={(value as string) ?? ''}
            onChangeText={t => setAnswer(q.key, t)}
          />
        )}

        {q.type === 'NUMBER' && (
          <TextInput
            style={s.input}
            placeholder="Enter a number"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
            value={value !== undefined && value !== null ? String(value) : ''}
            onChangeText={t => setAnswer(q.key, t === '' ? undefined : Number(t))}
          />
        )}

        {q.type === 'DATE' && (
          <TextInput
            style={s.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#9CA3AF"
            value={(value as string) ?? ''}
            onChangeText={t => setAnswer(q.key, t)}
          />
        )}

        {q.type === 'BOOLEAN' && (
          <View style={s.switchRow}>
            <Switch
              value={!!value}
              onValueChange={val => setAnswer(q.key, val)}
              trackColor={{ false: '#E5E7EB', true: '#1A56F0' }}
              thumbColor="#fff"
            />
            <Text style={s.switchLabel}>{value ? 'Yes' : 'No'}</Text>
          </View>
        )}

        {q.type === 'SELECT' && (
          <View style={s.optionList}>
            {options.map(opt => (
              <TouchableOpacity
                key={opt}
                style={[s.optionItem, value === opt && s.optionItemActive]}
                onPress={() => setAnswer(q.key, opt)}>
                <Text style={[s.optionText, value === opt && s.optionTextActive]}>{opt}</Text>
                {value === opt && <FontAwesome name="check" size={13} color="#1A56F0" />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {q.type === 'MULTISELECT' && (
          <View style={s.optionList}>
            {options.map(opt => {
              const selected = Array.isArray(value) && (value as string[]).includes(opt);
              return (
                <TouchableOpacity
                  key={opt}
                  style={[s.optionItem, selected && s.optionItemActive]}
                  onPress={() => {
                    const current: string[] = Array.isArray(value) ? [...(value as string[])] : [];
                    const next = current.includes(opt) ? current.filter(o => o !== opt) : [...current, opt];
                    setAnswer(q.key, next);
                  }}>
                  <Text style={[s.optionText, selected && s.optionTextActive]}>{opt}</Text>
                  {selected && <FontAwesome name="check" size={13} color="#1A56F0" />}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  const renderStep3 = () => {
    if (questionsLoading) {
      return <ActivityIndicator style={{ marginTop: 40 }} color="#1A56F0" />;
    }
    if (questionsError) {
      return (
        <View style={s.emptyBox}>
          <View style={s.emptyIconBox}>
            <FontAwesome name="exclamation-triangle" size={26} color="#9CA3AF" />
          </View>
          <Text style={s.emptyTitle}>Couldn't load questions</Text>
          <Text style={s.emptyText}>Check your connection and try again.</Text>
          <TouchableOpacity style={s.emptyCta} onPress={() => loadQuestions(categoryId, subCategoryId)}>
            <Text style={s.emptyCtaText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <>
        <Text style={s.stepTitle}>A few quick questions</Text>
        <Text style={s.stepSub}>{subCategoryName}</Text>
        {questions.length === 0 ? (
          <View style={s.infoBox}>
            <FontAwesome name="info-circle" size={14} color="#1D4ED8" style={{ marginRight: 8, marginTop: 1 }} />
            <Text style={s.infoText}>No additional questions for this service — you can continue.</Text>
          </View>
        ) : (
          <>
            <Text style={s.questionProgress}>Question {questionIndex + 1} of {questions.length}</Text>
            {renderQuestion(questions[questionIndex])}
          </>
        )}
      </>
    );
  };

  const renderStep4 = () => (
    <>
      <Text style={s.stepTitle}>Tell us more</Text>
      <Text style={s.stepSub}>Final details for your request</Text>

      <View style={s.field}>
        <Text style={s.label}>Describe the job <Text style={s.required}>*</Text></Text>
        <TextInput
          style={[s.input, s.textArea]}
          placeholder="e.g. I need a tar driveway surfaced, approximately 80sqm. Looking for a quote including materials and labour."
          placeholderTextColor="#9CA3AF"
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          maxLength={2000}
        />
        <Text style={s.hint}>{message.length}/2000</Text>
      </View>

      <View style={s.field}>
        <Text style={s.label}>Job address</Text>
        <TextInput
          style={s.input}
          placeholder="e.g. 12 Main Street, Kempton Park"
          placeholderTextColor="#9CA3AF"
          value={jobAddress}
          onChangeText={setJobAddress}
        />
      </View>

      <View style={s.field}>
        <Text style={s.label}>Preferred date</Text>
        <TextInput
          style={s.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#9CA3AF"
          value={jobDate}
          onChangeText={setJobDate}
        />
        <Text style={s.hint}>Optional</Text>
      </View>

      <View style={s.field}>
        <Text style={s.label}>Your budget (R)</Text>
        <TextInput
          style={s.input}
          placeholder="e.g. 15000"
          placeholderTextColor="#9CA3AF"
          value={budget}
          onChangeText={setBudget}
          keyboardType="numeric"
        />
        <Text style={s.hint}>Optional — helps businesses give you an accurate quote</Text>
      </View>

      <View style={s.infoBox}>
        <FontAwesome name="info-circle" size={14} color="#1D4ED8" style={{ marginRight: 8, marginTop: 1 }} />
        <Text style={s.infoText}>
          Your request will be shared with relevant businesses in your area. You'll be notified as they respond.
        </Text>
      </View>
    </>
  );

  const stepLabels = ['Category', 'Service type', 'Questions', 'Details'];

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.headerTop}>
          <TouchableOpacity onPress={goBack} style={s.backBtn}>
            <FontAwesome name="arrow-left" size={16} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerLabel}>Step {step} of {TOTAL_STEPS} · {stepLabels[step - 1]}</Text>
            <Text style={s.headerTitle}>Request a Service</Text>
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

        {step === 3 && !questionsLoading && !questionsError && questions.length === 0 && (
          <View style={s.actions}>
            <TouchableOpacity style={s.nextBtn} onPress={() => setStep(4)}>
              <Text style={s.nextBtnText}>Continue</Text>
              <FontAwesome name="arrow-right" size={14} color="#fff" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          </View>
        )}

        {step === 3 && !questionsLoading && !questionsError && questions.length > 0 && (
          <View style={s.questionNavRow}>
            <TouchableOpacity style={s.backQuestionBtn} onPress={questionBack}>
              <FontAwesome name="arrow-left" size={14} color="#374151" />
              <Text style={s.backQuestionBtnText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.nextBtn, s.nextBtnFlex]} onPress={questionContinue}>
              <Text style={s.nextBtnText}>{questionIndex === questions.length - 1 ? 'Continue' : 'Next'}</Text>
              <FontAwesome name="arrow-right" size={14} color="#fff" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          </View>
        )}

        {step === 4 && (
          <View style={s.actions}>
            <TouchableOpacity
              style={[s.nextBtn, (!message.trim() || submitting) && s.btnDisabled]}
              onPress={submit}
              disabled={!message.trim() || submitting}>
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <>
                    <FontAwesome name="check" size={14} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={s.nextBtnText}>Submit Request</Text>
                  </>
              }
            </TouchableOpacity>
          </View>
        )}

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
  field: { marginBottom: 16 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#111827' },
  textArea: { height: 120, paddingTop: 12 },
  hint: { fontSize: 11, color: '#9CA3AF', marginTop: 5 },
  listItem: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  listItemText: { fontSize: 14, fontWeight: '600', color: '#111827' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  switchLabel: { fontSize: 14, color: '#374151', fontWeight: '500' },
  optionList: { gap: 8 },
  optionItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  optionItemActive: { backgroundColor: '#EFF6FF', borderColor: '#1A56F0' },
  optionText: { fontSize: 14, color: '#374151' },
  optionTextActive: { color: '#1A56F0', fontWeight: '600' },
  infoBox: { backgroundColor: '#EFF6FF', borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: '#BFDBFE', flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  infoText: { fontSize: 12, color: '#1D4ED8', lineHeight: 18, flex: 1 },
  emptyBox: { alignItems: 'center', paddingTop: 56, paddingHorizontal: 32 },
  emptyIconBox: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 6, textAlign: 'center' },
  emptyText: { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 19, marginBottom: 16 },
  emptyCta: { backgroundColor: '#1A56F0', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  emptyCtaText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  actions: { marginTop: 8 },
  nextBtn: { backgroundColor: '#1A56F0', borderRadius: 14, paddingVertical: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  questionProgress: { fontSize: 12, fontWeight: '700', color: '#1A56F0', marginBottom: 14, letterSpacing: 0.3 },
  questionNavRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  nextBtnFlex: { flex: 1 },
  backQuestionBtn: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, paddingVertical: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  backQuestionBtnText: { color: '#374151', fontWeight: '700', fontSize: 15 },
});