import { View, Text, ScrollView, Input, Image } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useCallback, useMemo, useState } from 'react';
import Loading from '../../components/Loading';
import ErrorState from '../../components/ErrorState';
import Icon from '../../components/Icon';
import { get, put } from '../../services/request';
import { uploadFile } from '../../services/upload';
import { resolveAsset } from '../../config';
import { pickImages } from '../../utils/pick-image';
import './index.scss';

type Mode = 'none' | 'manual' | 'metered';
type UtilityType = 0 | 1;
type Step = 'water-choice' | 'water-form' | 'electric-choice' | 'electric-form' | 'summary';

interface UtilityForm {
  utilityType: UtilityType;
  name: string;
  mode: Mode;
  amount: string;
  previousReading: string;
  currentReading: string;
  unitPrice: string;
  photos: string[];
  note: string;
  firstReading: boolean;
}

const monthText = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
const stepNumber: Record<Step, number> = { 'water-choice': 1, 'water-form': 1, 'electric-choice': 2, 'electric-form': 2, summary: 3 };

function emptyForm(utilityType: UtilityType, name: string): UtilityForm {
  return { utilityType, name, mode: 'none', amount: '', previousReading: '', currentReading: '', unitPrice: '', photos: [], note: '', firstReading: true };
}

export default function UtilityReadingPage() {
  const params = Taro.getCurrentInstance().router?.params || {};
  const roomId = Number(params.roomId) || 0;
  const [period] = useState(params.period || monthText(new Date()));
  const [forms, setForms] = useState<UtilityForm[]>([emptyForm(0, '水费'), emptyForm(1, '电费')]);
  const [step, setStep] = useState<Step>('water-choice');
  const [roomName, setRoomName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingType, setUploadingType] = useState<UtilityType | null>(null);

  const formFor = useCallback((utilityType: UtilityType) => forms.find(form => form.utilityType === utilityType) || emptyForm(utilityType, utilityType === 0 ? '水费' : '电费'), [forms]);
  const updateForm = useCallback((type: UtilityType, patch: Partial<UtilityForm>) => {
    setForms(prev => prev.map(form => form.utilityType === type ? { ...form, ...patch } : form));
  }, []);

  const loadData = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    setError(false);
    try {
      const res = await get<any>(`/rooms/${roomId}/utility-readings?period=${period}`);
      const data = res.data;
      setRoomName(data.roomName || '本房间');
      const nextForms: UtilityForm[] = (data.records || []).map((item: any) => {
        const reading = item.reading;
        return {
          utilityType: item.utilityType,
          name: item.name,
          mode: reading?.mode || 'none',
          amount: reading?.amount == null ? '' : String(reading.amount),
          previousReading: reading?.previousReading ?? item.previousReadingSuggested ?? '',
          currentReading: reading?.currentReading ?? '',
          unitPrice: reading?.unitPrice ?? '',
          photos: reading?.photos || [],
          note: reading?.note || '',
          firstReading: item.isFirstReading,
        } as UtilityForm;
      });
      setForms(nextForms);
      if (nextForms.some(form => form.mode !== 'none')) setStep('summary');
    } catch (err) {
      console.error('[UtilityReading] load failed:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [roomId, period]);

  useDidShow(() => {
    Taro.setNavigationBarTitle({ title: '本月水电费' });
    loadData();
  });

  const amountFor = useCallback((form: UtilityForm) => {
    if (form.mode === 'manual') return Number(form.amount) || 0;
    if (form.mode !== 'metered') return 0;
    const usage = (Number(form.currentReading) || 0) - (Number(form.previousReading) || 0);
    return usage >= 0 ? usage * (Number(form.unitPrice) || 0) : 0;
  }, []);
  const formatAmount = useCallback((value: number) => (Math.round(value * 100) / 100).toFixed(2), []);
  const total = useMemo(() => forms.reduce((sum, form) => sum + amountFor(form), 0), [forms, amountFor]);

  const chooseMode = useCallback((utilityType: UtilityType, mode: Mode) => {
    updateForm(utilityType, { mode });
    if (mode === 'none') setStep(utilityType === 0 ? 'electric-choice' : 'summary');
    else setStep(utilityType === 0 ? 'water-form' : 'electric-form');
  }, [updateForm]);

  const validateAndNext = useCallback((utilityType: UtilityType) => {
    const form = formFor(utilityType);
    if (form.mode === 'manual' && (!Number.isFinite(Number(form.amount)) || Number(form.amount) < 0)) {
      Taro.showToast({ title: '请填写正确金额', icon: 'none' });
      return;
    }
    if (form.mode === 'metered') {
      if (form.previousReading === '' || form.currentReading === '' || form.unitPrice === '') {
        Taro.showToast({ title: '请把表上数字和单价填完整', icon: 'none' });
        return;
      }
      if (Number(form.currentReading) < Number(form.previousReading)) {
        Taro.showToast({ title: '本次读数不能小于上次', icon: 'none' });
        return;
      }
    }
    setStep(utilityType === 0 ? 'electric-choice' : 'summary');
  }, [formFor]);

  const handlePhoto = useCallback(async (type: UtilityType, sourceType: 'camera' | 'album') => {
    if (uploadingType !== null) return;
    const picked = await pickImages({ count: 1, sourceType: [sourceType] });
    if (!picked.length) return;
    setUploadingType(type);
    try {
      const result = await uploadFile(picked[0].path);
      setForms(prev => prev.map(form => form.utilityType === type ? { ...form, photos: [...form.photos, result.url].slice(0, 3) } : form));
    } catch {
      Taro.showToast({ title: '照片上传失败，请重试', icon: 'none' });
    } finally {
      setUploadingType(null);
    }
  }, [uploadingType]);

  const handleSave = useCallback(async () => {
    if (saving || uploadingType !== null) return;
    setSaving(true);
    try {
      await put(`/rooms/${roomId}/utility-readings`, {
        period,
        readings: forms.map(form => ({
          utilityType: form.utilityType,
          mode: form.mode,
          amount: form.mode === 'manual' ? Number(form.amount) || 0 : undefined,
          previousReading: form.mode === 'metered' ? Number(form.previousReading) : undefined,
          currentReading: form.mode === 'metered' ? Number(form.currentReading) : undefined,
          unitPrice: form.mode === 'metered' ? Number(form.unitPrice) : undefined,
          photos: form.photos,
          note: form.note.trim() || undefined,
        })),
      });
      Taro.showToast({ title: '已记到账单', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 700);
    } catch (err: any) {
      Taro.showToast({ title: err?.message || '保存失败，请重试', icon: 'none' });
    } finally {
      setSaving(false);
    }
  }, [forms, period, roomId, saving, uploadingType]);

  const renderChoice = (utilityType: UtilityType) => {
    const label = utilityType === 0 ? '水费' : '电费';
    return <View className="utility-question-card">
      {utilityType === 1 && <Text className="utility-back" onClick={() => setStep('water-choice')}>‹ 上一步</Text>}
      <Text className="utility-question-kicker">第 {stepNumber[step]} 步，共 3 步</Text>
      <Text className="utility-question-title">这个月收{label}吗？</Text>
      <Text className="utility-question-desc">选一个最符合的情况就行。</Text>
      <View className="utility-choice-list">
        <View className="utility-choice" onClick={() => chooseMode(utilityType, 'none')}><Text className="utility-choice-title">这个月不收</Text><Text className="utility-choice-desc">不计入本月账单</Text><Text className="utility-choice-arrow">›</Text></View>
        <View className="utility-choice" onClick={() => chooseMode(utilityType, 'manual')}><Text className="utility-choice-title">直接填金额</Text><Text className="utility-choice-desc">例如这月一共收 80 元</Text><Text className="utility-choice-arrow">›</Text></View>
        <View className="utility-choice" onClick={() => chooseMode(utilityType, 'metered')}><Text className="utility-choice-title">看表上数字来算</Text><Text className="utility-choice-desc">拍表照片，按读数自动算钱</Text><Text className="utility-choice-arrow">›</Text></View>
      </View>
    </View>;
  };

  const renderForm = (utilityType: UtilityType) => {
    const form = formFor(utilityType);
    const meterLabel = utilityType === 0 ? '水表' : '电表';
    const usage = Math.max(0, (Number(form.currentReading) || 0) - (Number(form.previousReading) || 0));
    return <View className="utility-question-card">
      <Text className="utility-back" onClick={() => setStep(utilityType === 0 ? 'water-choice' : 'electric-choice')}>‹ 换一种填写方式</Text>
      <Text className="utility-question-kicker">第 {stepNumber[step]} 步，共 3 步</Text>
      <Text className="utility-question-title">{form.mode === 'manual' ? `这个月${form.name}收多少？` : `看一下${meterLabel}，填这 3 个数`}</Text>
      {form.mode === 'manual' ? <>
        <Text className="utility-question-desc">只填本月一共要收的钱。</Text>
        <View className="utility-large-input"><Input type="digit" value={form.amount} placeholder="例如 80" onInput={e => updateForm(utilityType, { amount: e.detail.value })} /><Text>元</Text></View>
      </> : <>
        <Text className="utility-question-desc">不会算也没关系，填完系统会自动算。</Text>
        <View className="utility-field"><Text>{form.firstReading ? '上次表上数字（首次必填）' : '上次表上数字'}</Text><Input type="digit" value={form.previousReading} placeholder="例如 120" onInput={e => updateForm(utilityType, { previousReading: e.detail.value })} /></View>
        <View className="utility-field"><Text>这次表上数字</Text><Input type="digit" value={form.currentReading} placeholder="例如 136.5" onInput={e => updateForm(utilityType, { currentReading: e.detail.value })} /></View>
        <View className="utility-field"><Text>{utilityType === 0 ? '每吨水多少钱' : '每度电多少钱'}</Text><View className="utility-input-wrap"><Input type="digit" value={form.unitPrice} placeholder="例如 0.6" onInput={e => updateForm(utilityType, { unitPrice: e.detail.value })} /><Text>元</Text></View></View>
        <View className="utility-calc"><Text>本月用了 {formatAmount(usage)} {utilityType === 0 ? '吨' : '度'}</Text><Text>应收 {formatAmount(amountFor(form))} 元</Text></View>
      </>}
      <Text className="utility-photo-label">拍一张{meterLabel}照片（可不拍）</Text>
      <View className="utility-photo-actions">
        <View className="utility-photo-button" onClick={() => handlePhoto(utilityType, 'camera')}><Icon name="camera" size={28} color="var(--accent-dk)" /><Text>{uploadingType === utilityType ? '上传中…' : `拍${meterLabel}`}</Text></View>
        <View className="utility-photo-button" onClick={() => handlePhoto(utilityType, 'album')}><Icon name="file-text" size={28} color="var(--accent-dk)" /><Text>从相册选</Text></View>
      </View>
      {!!form.photos.length && <View className="utility-photo-list">{form.photos.map((photo, index) => <View className="utility-photo" key={photo}><Image src={resolveAsset(photo)} mode="aspectFill" /><Text onClick={() => updateForm(utilityType, { photos: form.photos.filter((_, photoIndex) => photoIndex !== index) })}>删除</Text></View>)}</View>}
      <View className="utility-next" onClick={() => validateAndNext(utilityType)}><Text>{utilityType === 0 ? '下一步，填电费' : '下一步，看看合计'}</Text></View>
    </View>;
  };

  const renderSummary = () => <View className="utility-question-card">
    <Text className="utility-question-kicker">第 3 步，共 3 步</Text>
    <Text className="utility-question-title">这月水电一共 {formatAmount(total)} 元</Text>
    <Text className="utility-question-desc">确认后会自动放进本月账单。</Text>
    {forms.map(form => <View key={form.utilityType} className="utility-summary-row"><View><Text className="utility-summary-name">{form.name}</Text><Text className="utility-summary-detail">{form.mode === 'none' ? '本月不收' : form.mode === 'metered' ? '按表计算' : '直接填写'}</Text></View><View className="utility-summary-right"><Text>{formatAmount(amountFor(form))} 元</Text><Text onClick={() => setStep(form.utilityType === 0 ? 'water-choice' : 'electric-choice')}>修改</Text></View></View>)}
    <View className="utility-total"><Text>本月水电合计</Text><Text>{formatAmount(total)} 元</Text></View>
    <View className={`utility-save${saving || uploadingType !== null ? ' disabled' : ''}`} onClick={saving || uploadingType !== null ? undefined : handleSave}><Text>{saving ? '保存中…' : '确认记到账单'}</Text></View>
  </View>;

  return <View className="page-utility-reading"><ScrollView className="utility-scroll" scrollY>
    {loading && <Loading />}
    {error && <ErrorState description="加载失败，请稍后重试" onRetry={loadData} />}
    {!loading && !error && <><View className="utility-hero"><Text className="utility-period">{period}</Text><Text className="utility-title">{roomName} · 本月水电费</Text></View>{step === 'water-choice' && renderChoice(0)}{step === 'water-form' && renderForm(0)}{step === 'electric-choice' && renderChoice(1)}{step === 'electric-form' && renderForm(1)}{step === 'summary' && renderSummary()}<View style={{ height: '48px' }} /></>}
  </ScrollView></View>;
}
