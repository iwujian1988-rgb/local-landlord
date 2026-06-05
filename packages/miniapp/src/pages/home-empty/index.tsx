import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState } from 'react';
import './index.scss';

export default function HomeEmpty() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const goToAddProperty = () => {
    Taro.navigateTo({ url: '/pages/add-property/index' });
  };

  const faqItems = [
    {
      question: '怎么添加房间？',
      answer: '先点击上方"添加第一套房源"创建房源，然后进入房源可以添加房间。填写房间名称、租金和状态即可。',
      iconClass: 'accent-bg',
      iconStroke: 'var(--accent)',
    },
    {
      question: '怎么发给租客看？',
      answer: '进入房间详情页，点击"发给租客"可以生成转发卡片。也可以通过"提醒租客"功能发送催缴信息。',
      iconClass: 'green-bg',
      iconStroke: 'var(--green)',
    },
    {
      question: '怎么设置收款码？',
      answer: '在"我的"页面点击"收款码设置"，上传微信或支付宝收款码，租客扫码即可付款。不通过小程序收钱，租客直接付给你。',
      iconClass: 'orange-bg',
      iconStroke: 'var(--orange)',
    },
  ];

  return (
    <ScrollView className="page-home-empty" scrollY>
      {/* Greeting */}
      <View className="greeting">
        <View className="greeting-text">
          <Text className="greeting-name">你好，新房东</Text>
          <Text className="greeting-subtitle">添加房间后就能开始收租了</Text>
        </View>
      </View>

      {/* Empty State Hero */}
      <View className="empty-hero">
        <View className="empty-illustration">
          <svg width="52" height="52" viewBox="0 0 24 24" stroke="var(--accent-hover)" strokeWidth="1.8" fill="none" opacity="0.5">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </View>
        <Text className="empty-hero-title">还没有房源</Text>
        <Text className="empty-hero-desc">四步开始使用</Text>

        {/* Steps */}
        <View className="steps-list">
          <View className="step-item">
            <View className="step-num"><Text className="step-num-text">1</Text></View>
            <View className="step-content">
              <Text className="step-content-title">添加一套房源</Text>
              <Text className="step-content-desc">取个名字、填个地址就行</Text>
            </View>
          </View>
          <View className="step-item">
            <View className="step-num"><Text className="step-num-text">2</Text></View>
            <View className="step-content">
              <Text className="step-content-title">添加房间</Text>
              <Text className="step-content-desc">拍照、填房名和租金</Text>
            </View>
          </View>
          <View className="step-item">
            <View className="step-num"><Text className="step-num-text">3</Text></View>
            <View className="step-content">
              <Text className="step-content-title">登记租客信息</Text>
              <Text className="step-content-desc">填姓名、电话、收租日期</Text>
            </View>
          </View>
          <View className="step-item">
            <View className="step-num"><Text className="step-num-text">4</Text></View>
            <View className="step-content">
              <Text className="step-content-title">设置收款码</Text>
              <Text className="step-content-desc">上传微信或支付宝收款码</Text>
            </View>
          </View>
        </View>

        <View className="add-first-btn" onClick={goToAddProperty}>
          <svg width="20" height="20" viewBox="0 0 24 24" stroke="var(--text-primary)" strokeWidth="1.8" fill="none">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <Text className="add-first-text">添加第一套房源</Text>
        </View>
      </View>

      {/* Quick Tips */}
      <View className="section-header">
        <Text className="section-title">快速了解</Text>
      </View>
      <View className="quick-tips">
        {faqItems.map((faq, idx) => (
          <View key={idx}>
            <View className="tip-item" onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}>
              <View className={`tip-icon ${faq.iconClass}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" stroke={faq.iconStroke} strokeWidth="1.8" fill="none">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </View>
              <Text className="tip-text">{faq.question}</Text>
              <svg width="16" height="16" viewBox="0 0 24 24" stroke="var(--text-hint)" strokeWidth="1.8" fill="none"
                style={{ transform: expandedFaq === idx ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
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
      <View style={{ height: '160px' }} />
    </ScrollView>
  );
}
