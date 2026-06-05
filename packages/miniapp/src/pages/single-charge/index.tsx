import { View, Text, Input, Textarea, Picker } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import NavBar from '../../components/NavBar';
import Loading from '../../components/Loading';
import ErrorState from '../../components/ErrorState';
import { useState, useCallback } from 'react';
import { get, post } from '../../services/request';
import './index.scss';

const FEE_TYPES = ['水费', '电费', '燃气费', '网费', '维修费', '押金', '清洁费', '其他'];

interface RoomOption {
  id: number;
  label: string;
}

export default function SingleCharge() {
  const routerParams = Taro.getCurrentInstance().router?.params || {};
  const preRoomId = Number(routerParams.roomId) || 0;

  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<number>(preRoomId);
  const [feeType, setFeeType] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await get<any[]>('/rooms');
      const allRooms = res.data || [];
      const opts: RoomOption[] = allRooms.map((r: any) => {
        const tenant = (r.tenants || []).find((t: any) => t.status !== 0);
        const label = tenant ? `${r.name} · ${tenant.name}` : `${r.name} (空房)`;
        return { id: r.id, label };
      });
      setRooms(opts);
      if (preRoomId > 0 && !selectedRoomId) {
        setSelectedRoomId(preRoomId);
      }
    } catch (err) {
      console.error('[SingleCharge] 加载房间失败:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [preRoomId, selectedRoomId]);

  useDidShow(() => { loadData(); });

  const goBack = useCallback(() => { Taro.navigateBack(); }, []);

  const handleGenerate = useCallback(async () => {
    if (!selectedRoomId) {
      Taro.showToast({ title: '请选择房间', icon: 'none', duration: 2000 });
      return;
    }
    if (!feeType) {
      Taro.showToast({ title: '请选择费用类型', icon: 'none', duration: 2000 });
      return;
    }
    if (!amount.trim() || Number(amount) <= 0) {
      Taro.showToast({ title: '请输入有效金额', icon: 'none', duration: 2000 });
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    await post(`/rooms/${selectedRoomId}/single-charge`, {
      feeType,
      amount: Number(amount),
      note,
    });
    Taro.showToast({ title: '收款通知已生成', icon: 'none', duration: 2000 });
    setTimeout(() => {
      setSubmitting(false);
      Taro.navigateTo({
        url: `/pages/payment/index?roomId=${selectedRoomId}&amount=${Number(amount)}&feeType=${feeType}&note=${encodeURIComponent(note)}`
      });
    }, 1500);
  }, [selectedRoomId, feeType, amount, note, submitting]);

  const selectedRoomLabel = rooms.find(r => r.id === selectedRoomId)?.label || '请选择房间';

  return (
    <View className="page-single-charge">
      <NavBar title="单独收一笔钱" onBack={goBack} />

      {loading && <Loading />}
      {error && <ErrorState description="加载失败，请稍后重试" onRetry={loadData} />}
      {!loading && !error && (
        <>
      <View className="sc-tip">
        <Text className="sc-tip-text">适合单独收水电费、维修费、押金等</Text>
      </View>

      <View className="sc-form">
        {/* Room Selector */}
        <View className="form-group">
          <Text className="form-label">选择房间</Text>
          <Picker
            mode="selector"
            range={rooms.map(r => r.label)}
            value={rooms.findIndex(r => r.id === selectedRoomId)}
            onChange={(e) => {
              const idx = Number(e.detail.value);
              if (rooms[idx]) {
                setSelectedRoomId(rooms[idx].id);
              }
            }}
          >
            <View className="form-select-wrap">
              <Text className="form-select-text" style={{ color: selectedRoomId ? 'var(--text-primary)' : 'var(--text-hint)' }}>
                {selectedRoomLabel}
              </Text>
              <svg width="16" height="16" viewBox="0 0 24 24" stroke="var(--text-hint)" strokeWidth="1.8" fill="none">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </View>
          </Picker>
        </View>

        {/* Fee Type */}
        <View className="form-group">
          <Text className="form-label">费用类型</Text>
          <View className="fee-type-grid">
            {FEE_TYPES.map(ft => (
              <View
                key={ft}
                className={`fee-type-item ${feeType === ft ? 'active' : ''}`}
                onClick={() => setFeeType(ft)}
              >
                <Text className="fee-type-text">{ft}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Amount */}
        <View className="form-group">
          <Text className="form-label">金额</Text>
          <View className="input-with-suffix">
            <Input
              className="form-input suffix-input"
              type="digit"
              placeholder="输入金额"
              value={amount}
              onInput={(e: any) => setAmount(e.detail.value)}
              placeholderStyle="color: var(--text-hint)"
            />
            <Text className="input-suffix">元</Text>
          </View>
        </View>

        {/* Note */}
        <View className="form-group">
          <Text className="form-label">备注</Text>
          <Textarea
            className="form-textarea"
            placeholder="如：5月水费，按表读数 12 吨"
            value={note}
            onInput={(e: any) => setNote(e.detail.value)}
            placeholderStyle="color: var(--text-hint)"
            maxlength={200}
            autoHeight
          />
        </View>

        {/* Submit */}
        <View className="sc-actions">
          <View className="sc-submit-btn" onClick={handleGenerate}>
            <Text className="sc-submit-text">{submitting ? '生成中...' : '生成收款通知'}</Text>
          </View>
        </View>
      </View>
        </>
      )}
    </View>
  );
}
