import { Input, Text, View } from '@tarojs/components';
import { useEffect, useState } from 'react';
import './index.scss';

interface Props {
  visible: boolean;
  amount: number;
  tenantName: string;
  onCancel: () => void;
  onConfirm: (action: 'keep' | 'waive', reason?: string) => void;
}

export default function DebtDecisionModal({ visible, amount, tenantName, onCancel, onConfirm }: Props) {
  const [waiving, setWaiving] = useState(false);
  const [reason, setReason] = useState('');
  useEffect(() => { if (visible) { setWaiving(false); setReason(''); } }, [visible]);
  if (!visible) return null;
  return <View className="debt-mask" onClick={onCancel}>
    <View className="debt-sheet" onClick={e => e.stopPropagation()}>
      <Text className="debt-step">退租第 1 步，共 2 步</Text>
      <Text className="debt-title">这笔钱以后还要收吗？</Text>
      <Text className="debt-amount">{tenantName} 还欠 {amount.toLocaleString()} 元</Text>
      {!waiving ? <>
        <View className="debt-main-btn" onClick={() => onConfirm('keep')}>
          <Text className="debt-main-title">以后还要收</Text>
          <Text className="debt-main-desc">推荐。退租后仍会显示在待收款里</Text>
        </View>
        <View className="debt-minor-btn" onClick={() => setWaiving(true)}>这笔钱不要了</View>
        <View className="debt-cancel" onClick={onCancel}>先不退租</View>
      </> : <>
        <Text className="debt-warning">确认后，系统以后不会再提醒你收这笔钱。</Text>
        <Text className="debt-label">为什么不要了？</Text>
        <Input className="debt-input" value={reason} onInput={e => setReason(e.detail.value)}
          placeholder="例如：双方商量后免除" maxlength={256} />
        <View className={`debt-danger-btn${reason.trim() ? '' : ' disabled'}`}
          onClick={() => reason.trim() && onConfirm('waive', reason.trim())}>确认不再收这笔钱</View>
        <View className="debt-cancel" onClick={() => setWaiving(false)}>返回上一步</View>
      </>}
    </View>
  </View>;
}
