import { View, Text, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState } from 'react';
import './index.scss';

export interface UploadFile {
  tempFilePath: string;
  size: number;
}

interface UploadModalProps {
  visible: boolean;
  onClose: () => void;
  onUpload: (file: UploadFile, note: string) => void;
}

export default function UploadModal({ visible, onClose, onUpload }: UploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<UploadFile | null>(null);
  const [note, setNote] = useState('');

  if (!visible) return null;

  const handleChooseImage = (sourceType: ('album' | 'camera')[]) => {
    Taro.chooseImage({
      count: 1,
      sourceType,
      sizeType: ['compressed'],
      success: (res) => {
        const file = res.tempFiles[0];
        if (file) {
          setSelectedFile({ tempFilePath: file.path, size: file.size });
        }
      },
      fail: () => {
        Taro.showToast({ title: '图片没选上，再试一次吧', icon: 'none' });
      },
    });
  };

  const handleConfirm = () => {
    if (!selectedFile) {
      Taro.showToast({ title: '请先选择图片', icon: 'none' });
      return;
    }
    onUpload(selectedFile, note);
    reset();
  };

  const handleCancel = () => {
    reset();
    onClose();
  };

  const reset = () => {
    setSelectedFile(null);
    setNote('');
  };

  return (
    <View className="upload-overlay" onClick={handleCancel}>
      <View className="upload-card" onClick={(e) => e.stopPropagation()}>
        <View className="upload-handle">
          <View className="upload-handle-bar" />
        </View>

        <Text className="upload-title">上传图片</Text>

        <View className="upload-actions-row">
          <View className="upload-action" onClick={() => handleChooseImage(['camera'])}>
            <View className="upload-action-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" stroke="var(--text-primary)" strokeWidth="1.8" fill="none">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </View>
            <Text className="upload-action-label">拍照</Text>
          </View>
          <View className="upload-action" onClick={() => handleChooseImage(['album'])}>
            <View className="upload-action-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" stroke="var(--text-primary)" strokeWidth="1.8" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </View>
            <Text className="upload-action-label">相册</Text>
          </View>
        </View>

        {selectedFile && (
          <View className="upload-preview">
            <Text className="upload-preview-label">已选择图片</Text>
            <Text className="upload-preview-name">{selectedFile.tempFilePath.split('/').pop() || '图片'}</Text>
          </View>
        )}

        <View className="upload-note">
          <Input
            className="upload-note-input"
            type="text"
            placeholder="添加备注（选填）"
            value={note}
            onInput={(e) => setNote(e.detail.value)}
            placeholderStyle="color: #B5A99A"
            maxlength={50}
          />
        </View>

        <View className="upload-btns">
          <View className="upload-btn cancel" onClick={handleCancel}>
            <Text className="upload-btn-text">取消</Text>
          </View>
          <View className="upload-btn confirm" onClick={handleConfirm}>
            <Text className="upload-btn-text confirm-text">确认上传</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
