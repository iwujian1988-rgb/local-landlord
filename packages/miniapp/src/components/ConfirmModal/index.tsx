import { View, Text, Input } from '@tarojs/components';
import { useState, useEffect } from 'react';
import './index.scss';

interface ConfirmModalProps {
  visible: boolean;
  title?: string;
  description?: string;
  /** Total amount — shown as default in editable mode */
  amount?: number;
  /** Already-paid amount (for partial payment scenarios) */
  paidAmount?: number;
  /** When true, user can edit the amount being collected right now */
  editableAmount?: boolean;
  confirmText?: string;
  onConfirm: (actualAmount?: number) => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  visible,
  title = '确认已收款',
  description,
  amount,
  paidAmount = 0,
  editableAmount = false,
  confirmText = '确认已收',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const remaining = amount !== undefined ? Math.max(0, amount - paidAmount) : 0;
  const [inputAmount, setInputAmount] = useState<string>(remaining ? String(remaining) : '');

  // Reset to remaining balance whenever the modal opens or amount changes
  useEffect(() => {
    if (visible && editableAmount && amount !== undefined) {
      setInputAmount(remaining ? String(remaining) : '');
    }
  }, [visible, editableAmount, amount, paidAmount, remaining]);

  const descText = description
    ?? (amount !== undefined ? `本笔应收 ${amount.toLocaleString()} 元` : '');

  const parsedAmount = Number(inputAmount) || 0;
  const isPartial = editableAmount && amount !== undefined && parsedAmount > 0 && parsedAmount < remaining;
  const canConfirm = !editableAmount || (parsedAmount > 0 && parsedAmount <= remaining);

  const handleConfirm = () => {
    if (editableAmount) {
      if (!(parsedAmount > 0 && parsedAmount <= remaining)) return;
      onConfirm(parsedAmount);
    } else {
      onConfirm();
    }
  };

  return (
    <View className={`confirm-overlay${visible ? ' show' : ''}`} onClick={onCancel}>
      <View className="confirm-content" onClick={(e) => e.stopPropagation()}>
        <View className="confirm-handle" />

        <View className="confirm-text">
          <Text className="confirm-title">{title}</Text>
          {descText ? <Text className="confirm-desc">{descText}</Text> : null}
          {paidAmount > 0 && (
            <Text className="confirm-desc">已收 {paidAmount.toLocaleString()} 元，待收 {remaining.toLocaleString()} 元</Text>
          )}
        </View>

        {editableAmount && amount !== undefined && (
          <View className="amount-input-wrap">
            <Text className="amount-input-label">本次收款金额</Text>
            <View className="amount-input-row">
              <Input
                className="amount-input"
                type="digit"
                value={inputAmount}
                onInput={(e) => setInputAmount(e.detail.value)}
                placeholder={String(remaining)}
              />
              <Text className="amount-input-suffix">元</Text>
            </View>
            {isPartial && (
              <Text className="amount-input-hint">将标记为部分付款，可稍后再补齐尾款</Text>
            )}
            {inputAmount !== '' && (Number(inputAmount) || 0) > remaining && (
              <Text className="amount-input-warn">超出待收金额，请检查</Text>
            )}
          </View>
        )}

        <View className="confirm-actions">
          <View className="confirm-btn cancel-btn" onClick={onCancel}>
            取消
          </View>
          <View
            className={`confirm-btn ok-btn${canConfirm ? '' : ' disabled'}`}
            onClick={canConfirm ? handleConfirm : undefined}
          >
            {confirmText}
          </View>
        </View>
      </View>
    </View>
  );
}
