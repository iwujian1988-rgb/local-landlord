import { View, Text, Textarea } from '@tarojs/components';
import { useState, useEffect } from 'react';
import './index.scss';

interface NoteEditModalProps {
  visible: boolean;
  initialNote?: string;
  onCancel: () => void;
  onConfirm: (note: string) => Promise<void> | void;
}

export default function NoteEditModal({
  visible,
  initialNote = '',
  onCancel,
  onConfirm,
}: NoteEditModalProps) {
  const [note, setNote] = useState<string>(initialNote);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setNote(initialNote);
      setSubmitting(false);
    }
  }, [visible, initialNote]);

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onConfirm(note.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className={`note-overlay${visible ? ' show' : ''}`} onClick={onCancel}>
      <View className="note-content" onClick={(e) => e.stopPropagation()}>
        <View className="note-handle" />

        <View className="note-text">
          <Text className="note-title">编辑备注</Text>
          <Text className="note-desc">记录房间的小细节，方便自己查阅</Text>
        </View>

        <View className="note-textarea-wrap">
          <Textarea
            className="note-textarea"
            value={note}
            onInput={(e) => setNote(e.detail.value)}
            placeholder="如：靠近地铁站、家具情况、租客特殊要求等"
            maxlength={200}
            autoHeight
          />
          <Text className="note-counter">{note.length}/200</Text>
        </View>

        <View className="note-actions">
          <View className="note-btn cancel-btn" onClick={onCancel}>
            取消
          </View>
          <View
            className={`note-btn ok-btn${submitting ? ' disabled' : ''}`}
            onClick={submitting ? undefined : handleConfirm}
          >
            {submitting ? '保存中' : '保存'}
          </View>
        </View>
      </View>
    </View>
  );
}
