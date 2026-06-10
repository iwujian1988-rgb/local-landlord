import { View, Text, Image, Input, Textarea } from '@tarojs/components';
import Taro, { useDidHide } from '@tarojs/taro';
import { useState, useCallback, useEffect } from 'react';
import { get, post, put } from '../../services/request';
import UploadModal, { UploadFile } from '../../components/UploadModal';
import Loading from '../../components/Loading';
import ErrorState from '../../components/ErrorState';
import Icon from '../../components/Icon';
import './index.scss';

export default function AddProperty() {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [coverImageURL, setCoverImageURL] = useState<string | null>(null);
  const [coverImageFileID, setCoverImageFileID] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(false);
  const [uploadVisible, setUploadVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = Taro.getCurrentInstance().router?.params;
    if (params?.propertyId) {
      const pid = params.propertyId;
      setPropertyId(pid);
      Taro.setNavigationBarTitle({ title: '编辑房源' });
      loadProperty(pid);
    } else {
      Taro.setNavigationBarTitle({ title: '添加房源' });
      const draft: any = Taro.getStorageSync('draft_property');
      if (draft) {
        setName(draft.name || '');
        setAddress(draft.address || '');
        setNote(draft.note || '');
        if (draft.coverImageURL) setCoverImageURL(draft.coverImageURL);
        if (draft.coverImageFileID) setCoverImageFileID(draft.coverImageFileID);
        Taro.showToast({ title: '已恢复未完成的草稿', icon: 'none', duration: 2000 });
      }
    }
  }, []);

  const loadProperty = async (pid: string) => {
    setLoading(true);
    try {
      const res = await get<any>('/properties');
      if (res.code === 0 && res.data) {
        const properties = Array.isArray(res.data) ? res.data : (res.data.list || []);
        const cached = properties.find((p: any) => String(p.id || p._id) === pid);
        if (cached) {
          setName(cached.name || '');
          setAddress(cached.address || '');
          setNote(cached.note || '');
          if (cached.coverImageURL) {
            setCoverImageURL(cached.coverImageURL);
          }
          if (cached.coverImageFileID) {
            setCoverImageFileID(cached.coverImageFileID);
          }
        }
      }
    } catch (err) {
      console.error('[AddProperty] 加载房源失败:', err);
      Taro.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  const handleUploadCover = useCallback((file: UploadFile, _note: string) => {
    if (file.serverUrl) {
      setCoverImageURL(file.serverUrl);
      setUploadVisible(false);
    }
  }, []);

  useDidHide(() => {
    if (!propertyId) {
      const formData = { name, address, note, coverImageURL, coverImageFileID };
      if (name || address || note) {
        Taro.setStorageSync('draft_property', formData);
      }
    }
  });

  const handleSave = useCallback(async () => {
    if (saving) return;
    setErrors({});
    if (!name.trim()) {
      setErrors({ name: '请输入房源名称' });
      return;
    }
    setSaving(true);
    
    const payload: any = {
      name: name.trim(),
      address: address.trim(),
      note: note.trim(),
    };
    if (coverImageURL) {
      payload.coverImage = coverImageURL;
    }

    try {
      if (propertyId) {
        await put(`/properties/${propertyId}`, payload);
        Taro.removeStorageSync('draft_property');
        Taro.showToast({ title: '房源已更新', icon: 'none', duration: 2000 });
        setTimeout(() => {
          setSaving(false);
          Taro.showModal({
            title: '房源已保存',
            content: '要现在添加房间吗？',
            confirmText: '现在添加',
            cancelText: '稍后再说',
            success: (res: any) => {
              if (res.confirm) {
                Taro.navigateTo({ url: `/pages/add-room-info/index?propertyId=${propertyId}` });
              } else {
                Taro.switchTab({ url: '/pages/home/index' });
              }
            },
          });
        }, 800);
      } else {
        const createRes = await post<any>('/properties', payload);
        if (createRes.code === 0) {
          const newId = createRes.data?.id || createRes.data?._id || Date.now();
          Taro.removeStorageSync('draft_property');
          Taro.showToast({ title: '房源已添加', icon: 'none', duration: 2000 });
          setTimeout(() => {
            setSaving(false);
            Taro.showModal({
              title: '房源已保存',
              content: '要现在添加房间吗？',
              confirmText: '现在添加',
              cancelText: '稍后再说',
              success: (res: any) => {
                if (res.confirm) {
                  Taro.navigateTo({ url: `/pages/add-room-info/index?propertyId=${newId}` });
                } else {
                  Taro.switchTab({ url: '/pages/home/index' });
                }
              },
            });
          }, 800);
        } else {
          Taro.showToast({ title: '添加失败', icon: 'none' });
          setSaving(false);
        }
      }
    } catch (err) {
      console.error('[AddProperty] 保存房源失败:', err);
      Taro.showToast({ title: propertyId ? '更新失败' : '添加失败', icon: 'none' });
      setSaving(false);
    }
  }, [saving, name, address, note, propertyId, coverImageURL, coverImageFileID]);

  return (
    <View className="page-add-property">
      {!propertyId && (
        <View className="add-property-hint">
          <Text className="hint-text">先给您的房子取个名字，比如&ldquo;幸福里 2号楼&rdquo;</Text>
        </View>
      )}

      {/* Cover upload */}
      {uploading ? (
        <Loading text="正在上传图片..." fullPage={false} />
      ) : uploadError ? (
        <ErrorState
          title="上传失败了"
          description="网络可能有点问题，请再试一次"
          retryText="重新上传"
          onRetry={() => setUploadVisible(true)}
          fullPage={false}
        />
      ) : coverImageURL ? (
        <View className="cover-preview" onClick={() => setUploadVisible(true)}>
          <Image className="cover-preview-img" src={coverImageURL} mode="aspectFill" />
          <View className="cover-preview-tap">
            <Icon name="camera" size={48} color="currentColor" />
            <Text className="cover-preview-tap-text">重新拍摄</Text>
          </View>
        </View>
      ) : (
        <View className="cover-upload" onClick={() => setUploadVisible(true)}>
          <View className="cover-upload-inner">
            <Icon name="camera" size={48} color="currentColor" />
            <Text className="cover-upload-text">拍一张房子外观（可选）</Text>
          </View>
        </View>
      )}

      {/* Form */}
      <View className="form-group">
        <Text className="form-label">房源名称 *</Text>
        <Input
          className={`form-input${errors.name ? ' error' : ''}`}
          type="text"
          placeholder="如：幸福里小区 2号楼"
          value={name}
          onInput={(e) => { setName(e.detail.value); setErrors({}); }}
          placeholderStyle="color: #B5A99A"
        />
        {errors.name && <Text className="form-error-text">{errors.name}</Text>}
      </View>

      <View className="form-group">
        <Text className="form-label">详细地址</Text>
        <Input
          className="form-input"
          type="text"
          placeholder="如：朝阳区幸福南路 88号"
          value={address}
          onInput={(e) => setAddress(e.detail.value)}
          placeholderStyle="color: #B5A99A"
        />
      </View>

      <View className="form-group">
        <Text className="form-label">备注（可选）</Text>
        <Textarea
          className="form-textarea"
          placeholder="写点备注，方便自己记"
          value={note}
          onInput={(e) => setNote(e.detail.value)}
          placeholderStyle="color: #B5A99A"
          maxlength={200}
          autoHeight
        />
      </View>

      <View className="form-actions">
        <View className={`save-btn ${saving ? 'disabled' : ''}`} onClick={saving ? undefined : handleSave}>
          <Text className="save-btn-text">保存</Text>
        </View>
      </View>

      <UploadModal
        visible={uploadVisible}
        onClose={() => { setUploadVisible(false); setUploadError(false); }}
        onUpload={handleUploadCover}
      />
    </View>
  );
}
