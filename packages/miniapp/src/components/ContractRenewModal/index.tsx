import { View, Text, Picker } from '@tarojs/components';
import { useState, useEffect } from 'react';
import './index.scss';

interface ContractRenewModalProps {
  visible: boolean;
  tenantName?: string;
  currentEndDate?: string;
  onCancel: () => void;
  onConfirm: (newEndDate: string) => Promise<void> | void;
}

export default function ContractRenewModal({
  visible,
  tenantName = '租客',
  currentEndDate = '',
  onCancel,
  onConfirm,
}: ContractRenewModalProps) {
  const [newEndDate, setNewEndDate] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      // Default to 1 year after current end date, or 1 year from today
      const base = currentEndDate ? new Date(currentEndDate) : new Date();
      if (isNaN(base.getTime())) {
        setNewEndDate('');
      } else {
        base.setFullYear(base.getFullYear() + 1);
        setNewEndDate(base.toISOString().slice(0, 10));
      }
      setSubmitting(false);
    }
  }, [visible, currentEndDate]);

  const handleConfirm = async () => {
    if (submitting) return;
    if (!newEndDate) return;
    setSubmitting(true);
    try {
      await onConfirm(newEndDate);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className={`renew-overlay${visible ? ' show' : ''}`} onClick={onCancel}>
      <View className="renew-content" onClick={(e) => e.stopPropagation()}>
        <View className="renew-handle" />

        <View className="renew-text">
          <Text className="renew-title">续签合同</Text>
          <Text className="renew-desc">为 {tenantName} 设置新的合同到期日</Text>
        </View>

        <View className="renew-date-area">
          <View className="renew-date-row">
            <Text className="renew-date-label">原到期日</Text>
            <Text className="renew-date-value old">{currentEndDate || '未设置'}</Text>
          </View>
          <Text className="renew-arrow">↓</Text>
          <View className="renew-date-row">
            <Text className="renew-date-label">新到期日</Text>
            <Picker mode="date" value={newEndDate} onChange={e => setNewEndDate(e.detail.value)}>
              <View className="renew-date-input">
                <Text style={{ color: newEndDate ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {newEndDate || '选择日期'}
                </Text>
                <Text className="renew-date-icon">📅</Text>
              </View>
            </Picker>
          </View>
        </View>

        <View className="renew-actions">
          <View className="renew-btn cancel-btn" onClick={onCancel}>
            取消
          </View>
          <View
            className={`renew-btn ok-btn${submitting || !newEndDate ? ' disabled' : ''}`}
            onClick={submitting || !newEndDate ? undefined : handleConfirm}
          >
            {submitting ? '保存中' : '确认续签'}
          </View>
        </View>
      </View>
    </View>
  );
}
