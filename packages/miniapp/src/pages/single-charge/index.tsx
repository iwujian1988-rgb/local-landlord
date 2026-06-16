import { View, Text, Input, Textarea, Picker } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import Loading from '../../components/Loading';
import ErrorState from '../../components/ErrorState';
import { useState, useCallback } from 'react';
import { get, post } from '../../services/request';
import './index.scss';

// Common fee types as suggestions - user can also type custom ones
const COMMON_TYPES = ['水费', '电费', '燃气费', '网费', '停车费', '物业费', '维修费', '清洁费', '押金', '家具费', '钥匙费'];

interface RoomOption {
  id: number;
  label: string;
  feeItems?: { name: string }[];
}

export default function SingleCharge() {
  const routerParams = Taro.getCurrentInstance().router?.params || {};
  const preRoomId = Number(routerParams.roomId) || 0;

  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<number>(preRoomId);
  const [feeType, setFeeType] = useState('');
  const [customFeeType, setCustomFeeType] = useState('');
  const [useCustomType, setUseCustomType] = useState(false);
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
        const label = r.tenantName ? `${r.name} · ${r.tenantName}` : `${r.name} (空房)`;
        return { id: r.id, label, feeItems: r.feeItems || [] };
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

  useDidShow(() => { loadData(); Taro.setNavigationBarTitle({ title: '单独收一笔钱' }); });

  // Build fee type options: room-specific fees first, then common suggestions
  const currentRoom = rooms.find(r => r.id === selectedRoomId);
  const roomFeeNames = (currentRoom?.feeItems || []).map(f => f.name);
  const allFeeTypes = [...new Set([...roomFeeNames, ...COMMON_TYPES])];

  const handleGenerate = useCallback(async () => {
    const finalFeeType = useCustomType ? customFeeType.trim() : feeType;
    if (!selectedRoomId) {
      Taro.showToast({ title: '请选择房间', icon: 'none', duration: 2000 });
      return;
    }
    if (!finalFeeType) {
      Taro.showToast({ title: '请选择或输入费用类型', icon: 'none', duration: 2000 });
      return;
    }
    if (!amount.trim() || Number(amount) <= 0) {
      Taro.showToast({ title: '请输入有效金额', icon: 'none', duration: 2000 });
      return;
    }
    if (Number(amount) > 999999) {
      Taro.showToast({ title: '金额超出合理范围', icon: 'none', duration: 2000 });
      return;
    }
    if (submitting) return;
    const roomLabel = rooms.find(r => r.id === selectedRoomId)?.label || '';
    Taro.showModal({
      title: '确认生成收款通知？',
      content: `房间：${roomLabel}\n费用：${finalFeeType}\n金额：${Number(amount).toLocaleString()} 元${note ? '\n备注：' + note : ''}`,
      confirmText: '确认生成',
      cancelText: '再改改',
      success: async (res) => {
        if (!res.confirm) return;
        setSubmitting(true);
        try {
          const res = await post<{ id: number }>(`/rent/rooms/${selectedRoomId}/single-charge`, {
            feeType: finalFeeType,
            amount: Number(amount),
            note,
          });
          const singleChargeId = res.data?.id || 0;
          Taro.showToast({ title: '已保存，正在跳转到付款页...', icon: 'none', duration: 1500 });
          setTimeout(() => {
            setSubmitting(false);
            Taro.navigateTo({
              url: `/pages/payment/index?roomId=${selectedRoomId}&amount=${Number(amount)}&feeType=${encodeURIComponent(finalFeeType)}&note=${encodeURIComponent(note)}&singleChargeId=${singleChargeId}`
            });
          }, 1500);
        } catch (err) {
          Taro.showToast({ title: '保存失败', icon: 'none' });
          setSubmitting(false);
          return;
        }
      },
    });
  }, [selectedRoomId, feeType, customFeeType, useCustomType, amount, note, submitting]);

  const selectedRoomLabel = rooms.find(r => r.id === selectedRoomId)?.label || '请选择房间';

  return (
    <View className="page-single-charge">
      {loading && <Loading />}
      {error && <ErrorState description="加载失败，请稍后重试" onRetry={loadData} />}
      {!loading && !error && (
        <>
      <View className="sc-tip">
        <Text className="sc-tip-text">适合单独收费：水电费、停车费、维修费、押金等</Text>
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
                setFeeType('');
              }
            }}
          >
            <View className="form-select-wrap">
              <Text className="form-select-text" style={{ color: selectedRoomId ? 'var(--text-primary)' : 'var(--text-hint)' }}>
                {selectedRoomLabel}
              </Text>
              <Text style={{ fontSize: '24px', color: 'var(--text-hint)', lineHeight: 1 }}>▾</Text>
            </View>
          </Picker>
        </View>

        {/* Fee Type - Quick select from common types */}
        <View className="form-group">
          <Text className="form-label">费用类型</Text>
          <View className="fee-type-grid">
            {allFeeTypes.map(t => (
              <View
                key={t}
                className={`fee-type-item${feeType === t && !useCustomType ? ' active' : ''}`}
                onClick={() => { setFeeType(t); setUseCustomType(false); }}
              >
                <Text className="fee-type-item-text">{t}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Custom fee type input */}
        <View className="form-group">
          <Text className="form-label">或自己输入</Text>
          <Input
            className="form-input"
            type="text"
            placeholder="如：停车费、空调费、中介费..."
            value={useCustomType ? customFeeType : ''}
            onInput={(e: any) => {
              setCustomFeeType(e.detail.value);
              setUseCustomType(!!e.detail.value.trim());
              if (e.detail.value.trim()) setFeeType('');
            }}
            placeholderStyle="color: var(--text-hint)"
          />
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
              onInput={(e: any) => {
                const val = e.detail.value;
                if (Number(val) < 0 || Number(val) > 999999) return;
                setAmount(val);
              }}
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
          <View className={`sc-submit-btn ${submitting ? 'disabled' : ''}`} onClick={submitting ? undefined : handleGenerate}>
            <Text className="sc-submit-text">{submitting ? '生成中...' : '生成收款通知'}</Text>
          </View>
        </View>
      </View>
        </>
      )}
    </View>
  );
}
