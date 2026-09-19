import { Input, Text, View } from '@tarojs/components';
import { useEffect, useState } from 'react';
import './index.scss';

interface Props { visible: boolean; currentAmount: number; totalAmount: number; submitting?: boolean;
  onCancel: () => void; onConfirm: (amount: number, reason: string) => void }

export default function PaymentCorrectionModal({ visible, currentAmount, totalAmount, submitting, onCancel, onConfirm }: Props) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { if (visible) { setAmount(String(currentAmount)); setReason(''); setError(''); } }, [visible, currentAmount]);
  if (!visible) return null;
  const submit = () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0 || value > totalAmount) { setError(`请输入0到${totalAmount}元之间的金额`); return; }
    if (!reason.trim()) { setError('请写清楚为什么要改'); return; }
    setError(''); onConfirm(value, reason.trim());
  };
  return <View className="correction-mask" onClick={onCancel}><View className="correction-sheet" onClick={e => e.stopPropagation()}>
    <Text className="correction-title">改正收款金额</Text>
    <Text className="correction-help">账上现在记的是 {currentAmount.toLocaleString()} 元。这里改账，不会自动给租客转钱。</Text>
    <Text className="correction-label">实际一共收到多少钱？</Text>
    <View className="correction-input-row"><Input className="correction-input" type="digit" value={amount}
      onInput={e => setAmount(e.detail.value)} /><Text>元</Text></View>
    <Text className="correction-label">为什么要改？</Text>
    <Input className="correction-reason" value={reason} onInput={e => setReason(e.detail.value)}
      placeholder="例如：上次金额点错了" maxlength={256} />
    {!!error && <Text className="correction-error">{error}</Text>}
    <View className={`correction-confirm${submitting ? ' disabled' : ''}`} onClick={submitting ? undefined : submit}>
      {submitting ? '正在保存…' : '确认改正'}</View>
    <View className="correction-cancel" onClick={onCancel}>不改了</View>
  </View></View>;
}
