import { View, Text, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useEffect, useState } from 'react';
import { uploadFile } from '../../services/upload';
import { pickImages } from '../../utils/pick-image';
import './index.scss';

export interface UploadFile {
  tempFilePath: string;
  size: number;
  serverUrl?: string;
}

export interface DocumentTypeOption {
  value: string;
  label: string;
}

const EMPTY_DOCUMENT_TYPE_OPTIONS: DocumentTypeOption[] = [];

interface UploadModalProps {
  visible: boolean;
  onClose: () => void;
  onUpload: (file: UploadFile, note: string, documentType?: string) => void;
  entityType?: string;
  documentTypeOptions?: DocumentTypeOption[];
  defaultDocumentType?: string;
}

export default function UploadModal({
  visible,
  onClose,
  onUpload,
  documentTypeOptions = EMPTY_DOCUMENT_TYPE_OPTIONS,
  defaultDocumentType,
}: UploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<UploadFile | null>(null);
  const [note, setNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const [documentType, setDocumentType] = useState('');

  useEffect(() => {
    if (!visible) return;
    setDocumentType(defaultDocumentType || documentTypeOptions[0]?.value || '');
  }, [visible, defaultDocumentType, documentTypeOptions]);

  if (!visible) return null;

  const handleChooseImage = async (sourceType: ('album' | 'camera')[]) => {
    const picked = await pickImages({ count: 1, sourceType });
    if (picked.length === 0) {
      Taro.showToast({ title: '图片没选上，再试一次吧', icon: 'none' });
      return;
    }
    const file = picked[0];
    setSelectedFile({ tempFilePath: file.path, size: file.size });
  };

  const handleConfirm = async () => {
    if (!selectedFile) {
      Taro.showToast({ title: '请先选择图片', icon: 'none' });
      return;
    }
    if (uploading) return;

    setUploading(true);
    try {
      console.log('[UploadModal] start upload, tempFilePath:', selectedFile.tempFilePath, 'size:', selectedFile.size);
      const result = await uploadFile(selectedFile.tempFilePath);
      console.log('[UploadModal] upload success:', result);
      onUpload({ ...selectedFile, serverUrl: result.url }, note, documentType || undefined);
      reset();
    } catch (err: any) {
      console.error('[UploadModal] upload failed:', err);
      const errMsg = err?.message || err?.errMsg || (typeof err === 'string' ? err : JSON.stringify(err));
      Taro.showModal({
        title: '上传失败（诊断）',
        content: String(errMsg).slice(0, 500),
        showCancel: false,
      });
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

  const getFileName = (path: string) => path.split(/[\\/]/).pop() || '图片';

  const formatFileSize = (size: number) => {
    if (!size) return '';
    if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))}KB`;
    return `${(size / 1024 / 1024).toFixed(1)}MB`;
  };

  return (
    <View className="upload-overlay" onClick={handleCancel}>
      <View className="upload-card" onClick={(e) => e.stopPropagation()}>
        <View className="upload-handle">
          <View className="upload-handle-bar" />
        </View>

        <Text className="upload-title">上传图片</Text>

        {documentTypeOptions.length > 0 && (
          <View className="upload-type-group">
            <Text className="upload-type-label">资料类型</Text>
            <View className="upload-type-options">
              {documentTypeOptions.map((option) => (
                <View
                  key={option.value}
                  className={`upload-type-option${documentType === option.value ? ' active' : ''}`}
                  onClick={() => setDocumentType(option.value)}
                >
                  <Text className="upload-type-option-text">{option.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

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
            <View className="upload-preview-icon">✓</View>
            <View className="upload-preview-info">
              <Text className="upload-preview-label">已选择图片</Text>
              <Text className="upload-preview-name">{getFileName(selectedFile.tempFilePath)}</Text>
              {!!formatFileSize(selectedFile.size) && (
                <Text className="upload-preview-size">{formatFileSize(selectedFile.size)}</Text>
              )}
            </View>
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
