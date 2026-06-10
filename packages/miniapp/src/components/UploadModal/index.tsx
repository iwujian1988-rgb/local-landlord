import { View, Text, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState } from 'react';
import { uploadFile } from '../../services/upload';
import './index.scss';

export interface UploadFile {
  tempFilePath: string;
  size: number;
  serverUrl?: string;
}

interface UploadModalProps {
  visible: boolean;
  onClose: () => void;
  onUpload: (file: UploadFile, note: string) => void;
  entityType?: string;
}

export default function UploadModal({ visible, onClose, onUpload }: UploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<UploadFile | null>(null);
  const [note, setNote] = useState('');
  const [uploading, setUploading] = useState(false);

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

  const handleConfirm = async () => {
    if (!selectedFile) {
      Taro.showToast({ title: '请先选择图片', icon: 'none' });
      return;
    }
    if (uploading) return;

    setUploading(true);
    try {
      const result = await uploadFile(selectedFile.tempFilePath);
      onUpload({ ...selectedFile, serverUrl: result.url }, note);
      reset();
    } catch {
      Taro.showToast({ title: '上传失败，请重试', icon: 'none' });
    } finally {
      setUploading(false);
    }
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
              <Text style={{ fontSize: '48px', lineHeight: 1 }}>📷</Text>
            </View>
            <Text className="upload-action-label">拍照</Text>
          </View>
          <View className="upload-action" onClick={() => handleChooseImage(['album'])}>
            <View className="upload-action-icon">
              <Text style={{ fontSize: '28px', lineHeight: 1, color: 'var(--text-primary)' }}>🖼</Text>
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
            <Text className="upload-btn-text confirm-text">{uploading ? '上传中...' : '确认上传'}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
