import { View, Text, Input } from '@tarojs/components';
import { useState, useEffect } from 'react';
import './index.scss';

interface DepositModalProps {
  visible: boolean;
  /** Original deposit collected at move-in */
  deposit?: number;
  /** P0-B: Auto-computed prepaid rent refund (unused days × monthly rent/30) */
  prepaidRefund?: number;
  /** P0-C: 入住水电读数，对照展示用 */
  moveInReading?: string;
  /** Pure close — does NOT trigger checkout */
  onCancel: () => void;
  /** Skip deposit record and proceed directly with checkout (no refund logged) */
  onSkip: () => void;
  onConfirm: (data: {
    depositStatus: number;
    refundAmount: number;
    deductReason: string;
    moveOutReading: string;
  }) => void;
}

export default function DepositModal({
  visible,
  deposit = 0,
  prepaidRefund = 0,
  moveInReading = '',
  onCancel,
  onSkip,
  onConfirm,
}: DepositModalProps) {
  const [option, setOption] = useState<'full' | 'partial' | 'none'>('full');
  const [refundAmount, setRefundAmount] = useState<string>(deposit ? String(deposit) : '');
  const [deductReason, setDeductReason] = useState<string>('');
  const [moveOutReading, setMoveOutReading] = useState<string>('');

  useEffect(() => {
    if (visible) {
      setOption('full');
      setRefundAmount(deposit ? String(deposit) : '');
      setDeductReason('');
      setMoveOutReading('');
    }
  }, [visible, deposit]);

  const parsedRefund = Number(refundAmount) || 0;

  // 实退 = 押金实退 + 预付租金退还
  const depositRefund = option === 'none' ? 0 : option === 'full' ? deposit : parsedRefund;
  const totalRefund = depositRefund + (prepaidRefund || 0);

  const handleConfirm = () => {
    if (option === 'none') {
      onConfirm({ depositStatus: 1, refundAmount: 0, deductReason: '', moveOutReading: moveOutReading.trim() });
    } else if (option === 'full') {
      onConfirm({ depositStatus: 1, refundAmount: deposit, deductReason: '', moveOutReading: moveOutReading.trim() });
    } else {
      // partial
      if (!(parsedRefund > 0 && parsedRefund < deposit)) return;
      onConfirm({
        depositStatus: 1,
        refundAmount: parsedRefund,
        deductReason: deductReason.trim(),
        moveOutReading: moveOutReading.trim(),
      });
    }
  };

  const canConfirm = option === 'full' || option === 'none' || (option === 'partial' && parsedRefund > 0 && parsedRefund < deposit);

  return (
    <View className={`deposit-overlay${visible ? ' show' : ''}`} onClick={onCancel}>
      <View className="deposit-content" onClick={(e) => e.stopPropagation()}>
        <View className="deposit-handle" />

        <View className="deposit-text">
          <Text className="deposit-title">退租结算</Text>
          <Text className="deposit-desc">押金 {deposit.toLocaleString()} 元 + 预付租金剩余 {prepaidRefund.toLocaleString()} 元 = 应退 {(deposit + prepaidRefund).toLocaleString()} 元</Text>
        </View>

        {/* Summary breakdown */}
        <View className="deposit-summary">
          <View className="deposit-summary-row">
            <Text className="deposit-summary-label">押金原收</Text>
            <Text className="deposit-summary-value">{deposit.toLocaleString()} 元</Text>
          </View>
          {prepaidRefund > 0 && (
            <View className="deposit-summary-row">
              <Text className="deposit-summary-label">预付租金剩余</Text>
              <Text className="deposit-summary-value">{prepaidRefund.toLocaleString()} 元</Text>
            </View>
          )}
          <View className="deposit-summary-row total">
            <Text className="deposit-summary-label">合计应退</Text>
            <Text className="deposit-summary-value accent">{totalRefund.toLocaleString()} 元</Text>
          </View>
        </View>

        <Text className="deposit-section-title">押金如何处理？</Text>
        <View className="deposit-options">
          <View
            className={`deposit-option${option === 'full' ? ' active' : ''}`}
            onClick={() => setOption('full')}
          >
            <Text className="deposit-option-title">全额退还</Text>
            <Text className="deposit-option-desc">退还 {deposit.toLocaleString()} 元</Text>
          </View>
          <View
            className={`deposit-option${option === 'partial' ? ' active' : ''}`}
            onClick={() => setOption('partial')}
          >
            <Text className="deposit-option-title">部分退还</Text>
            <Text className="deposit-option-desc">扣除部分后退还</Text>
          </View>
          <View
            className={`deposit-option${option === 'none' ? ' active' : ''}`}
            onClick={() => setOption('none')}
          >
            <Text className="deposit-option-title">不退还</Text>
            <Text className="deposit-option-desc">作为赔偿扣除</Text>
          </View>
        </View>

        {option === 'partial' && (
          <View className="deposit-input-area">
            <View className="deposit-input-row">
              <Text className="deposit-input-label">退还押金金额</Text>
              <View className="deposit-input-box">
                <Input
                  className="deposit-input"
                  type="digit"
                  value={refundAmount}
                  onInput={(e) => setRefundAmount(e.detail.value)}
                  placeholder={String(deposit)}
                />
                <Text className="deposit-input-suffix">元</Text>
              </View>
            </View>
            <View className="deposit-input-row">
              <Text className="deposit-input-label">扣除原因（可选）</Text>
              <View className="deposit-input-box">
                <Input
                  className="deposit-input"
                  value={deductReason}
                  onInput={(e) => setDeductReason(e.detail.value)}
                  placeholder="如：维修 100 元"
                />
              </View>
            </View>
          </View>
        )}

        {/* P0-C: 退租水电读数 */}
        <View className="deposit-input-area">
          <View className="deposit-input-row">
            <Text className="deposit-input-label">
              退租水电读数（可选）
              {moveInReading && <Text className="deposit-input-hint"> · 入住时：{moveInReading}</Text>}
            </Text>
            <View className="deposit-input-box">
              <Input
                className="deposit-input"
                value={moveOutReading}
                onInput={(e) => setMoveOutReading(e.detail.value)}
                placeholder="如：电 1340 / 水 78"
              />
            </View>
          </View>
        </View>

        <View className="deposit-actions">
          <View className="deposit-btn cancel" onClick={onCancel}>
            取消
          </View>
          <View className="deposit-btn skip" onClick={onSkip}>
            跳过押金
          </View>
          <View
            className={`deposit-btn ok${canConfirm ? '' : ' disabled'}`}
            onClick={canConfirm ? handleConfirm : undefined}
          >
            确认退租
          </View>
        </View>
      </View>
    </View>
  );
}
