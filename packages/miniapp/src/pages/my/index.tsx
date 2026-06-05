import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState } from 'react';
import { getAppData } from '../../utils/storage';
import './index.scss';

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  bgColor: string;
  url?: string;
  toast?: string;
}

export default function My() {
  const appData = getAppData();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  useDidShow(() => {
    // 页面显示时刷新数据
  });

  const goToPage = (url: string) => {
    Taro.navigateTo({ url });
  };

  const showToastMsg = (msg: string) => {
    Taro.showToast({ title: msg, icon: 'none', duration: 2000 });
  };

  const menuItems: MenuItem[] = [
    {
      icon: (
        <svg viewBox="0 0 24 24" stroke="var(--accent)" strokeWidth="1.8" fill="none" width="20" height="20">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="3" height="3" />
          <line x1="21" y1="14" x2="21" y2="14.01" />
          <line x1="21" y1="21" x2="21" y2="21.01" />
        </svg>
      ),
      label: '默认收款码',
      bgColor: 'var(--accent-soft)',
      url: '/pages/qr-code/index',
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" stroke="var(--green)" strokeWidth="1.8" fill="none" width="20" height="20">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
      label: '常用收费项目',
      bgColor: 'var(--green-soft)',
      url: '/pages/fee-setup/index',
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" stroke="var(--orange)" strokeWidth="1.8" fill="none" width="20" height="20">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
      label: '房东资料',
      bgColor: 'var(--orange-soft)',
      toast: '房东资料即将上线',
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" stroke="var(--neon-mid)" strokeWidth="1.8" fill="none" width="20" height="20">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
      label: '帮助说明',
      bgColor: 'var(--blue-soft)',
      toast: '该功能即将上线，敬请期待',
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" stroke="var(--text-secondary)" strokeWidth="1.8" fill="none" width="20" height="20">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
      label: '使用设置',
      bgColor: 'rgba(0,0,0,0.04)',
      toast: '该功能即将上线，敬请期待',
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" stroke="var(--text-secondary)" strokeWidth="1.8" fill="none" width="20" height="20">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
      label: '隐私政策',
      bgColor: 'rgba(0,0,0,0.04)',
      url: '/pages/privacy/index',
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" stroke="var(--text-secondary)" strokeWidth="1.8" fill="none" width="20" height="20">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
      label: '用户协议',
      bgColor: 'rgba(0,0,0,0.04)',
      url: '/pages/terms/index',
    },
  ];

  const faqItems = [
    { question: '怎么添加房间？', answer: '在房间列表页点击右上角 + 号，拍照后填写房间信息保存即可' },
    { question: '怎么发给租客？', answer: '在房间详情点击「发账单」，确认金额后点击「发微信给租客」' },
    { question: '怎么设置收款码？', answer: '在房间详情或「我的」页面点击「收款码」，上传微信或支付宝收款码' },
    { question: '怎么记录已收？', answer: '在收租列表找到对应房间，点击「已收到」，确认金额后即标记为已收' },
    { question: '怎么上传合同收据？', answer: '在房间详情点击「合同收据」，点击右上角 + 号上传文件' },
  ];

  const handleMenuItem = (item: MenuItem) => {
    if (item.url) {
      goToPage(item.url);
    } else if (item.toast) {
      showToastMsg(item.toast);
    }
  };

  return (
    <ScrollView className="page-my" scrollY>
      <View className="nav-bar">
        <Text className="nav-title">我的</Text>
      </View>

      <View className="profile-header">
        <View className="avatar">
          <Text className="avatar-text">{appData.profile?.name?.charAt(0) || ''}</Text>
        </View>
        <View>
          <Text className="profile-name">{appData.profile?.name || ''}</Text>
          <Text className="profile-phone">{appData.profile?.phone || ''}</Text>
        </View>
      </View>

      <View className="menu-list">
        {menuItems.map((item, idx) => (
          <View key={idx} className="menu-item" onClick={() => handleMenuItem(item)}>
            <View className="menu-icon" style={{ background: item.bgColor }}>
              {item.icon}
            </View>
            <Text className="menu-text">{item.label}</Text>
            <svg className="menu-arrow" viewBox="0 0 24 24">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </View>
        ))}
      </View>

      <View className="section-header">
        <Text className="section-title">常见问题</Text>
      </View>
      <View className="faq-list">
        {faqItems.map((faq, idx) => (
          <View key={idx}>
            <View className="menu-item faq-item" onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}>
              <Text className="faq-text">{faq.question}</Text>
              <svg className="menu-arrow" viewBox="0 0 24 24" style={{ transform: expandedFaq === idx ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </View>
            {expandedFaq === idx && (
              <View className="tip-answer">
                <Text className="tip-answer-text">{faq.answer}</Text>
              </View>
            )}
          </View>
        ))}
      </View>

      <View className="section-header">
        <Text className="section-title">联系客服</Text>
      </View>
      <View className="faq-list">
        <View className="menu-item faq-item" onClick={() => Taro.makePhoneCall({ phoneNumber: '400-000-0000' })}>
          <Text className="faq-text">联系客服</Text>
          <svg className="menu-arrow" viewBox="0 0 24 24">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </View>
      </View>

      <View style={{ height: '120px' }} />
    </ScrollView>
  );
}
