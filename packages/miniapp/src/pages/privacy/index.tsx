import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { POLICY_UPDATED_AT } from '../../constants/app';
import './index.scss';

export default function Privacy() {
  useDidShow(() => {
    Taro.setNavigationBarTitle({ title: '隐私政策' });
  });

  return (
    <View className="page-privacy">
      <ScrollView className="content-scroll" scrollY>
        <View className="policy-content">
          <Text className="policy-title">隐私政策</Text>
          <Text className="policy-update">更新日期：{POLICY_UPDATED_AT}</Text>

          <View className="policy-section">
            <Text className="section-title">1. 信息收集</Text>
            <Text className="section-text">
              我们收集以下实现功能所必要的信息：您主动录入的房源名称和地址、租客姓名和电话、账单和收款记录、房源及合同照片；通过微信登录获得的 OpenID 用于识别账号；以及在您主动点击并同意后获得的微信绑定手机号，用于账号登录、身份识别和账户安全。拒绝提供手机号不影响普通微信登录。
            </Text>
          </View>

          <View className="policy-section">
            <Text className="section-title">2. 信息使用</Text>
            <Text className="section-text">
              收集的信息仅用于本应用的核心功能：管理房源、登记租客、记录收租、生成账单和提醒。我们不会将您的数据用于其他目的，也不会向第三方出售或共享您的个人信息。
            </Text>
          </View>

          <View className="policy-section">
            <Text className="section-title">3. 数据存储</Text>
            <Text className="section-text">
              您的数据通过加密连接（HTTPS）传输，安全存储在已备案的腾讯云服务器上。照片等文件资源存储在服务器的持久化存储空间中。我们使用登录令牌进行身份认证，确保只有您本人可以访问自己的数据，并采取合理的安全措施防止数据泄露。
            </Text>
          </View>

          <View className="policy-section">
            <Text className="section-title">4. 信息安全</Text>
            <Text className="section-text">
              我们采用 HTTPS 加密传输、JWT 令牌认证、服务器端数据隔离等安全措施保护您的数据。所有 API 请求均需携带有效的身份令牌。如您发现账户存在安全风险，请立即联系我们。
            </Text>
          </View>

          <View className="policy-section">
            <Text className="section-title">5. 权限说明</Text>
            <Text className="section-text">
              本应用会在您主动操作时申请：微信手机号授权（用于账号登录、身份识别和账户安全）、选择照片或视频及相机能力（用于拍摄和上传房源照片、合同照片、收款码）。所有授权均由您主动选择，您可以拒绝手机号授权并继续使用普通微信登录，也可以在微信设置中管理相关授权。
            </Text>
          </View>

          <View className="policy-section">
            <Text className="section-title">6. 数据删除</Text>
            <Text className="section-text">
              您可以在应用内删除自己录入的房源、租客、照片等数据，也可以在「我的－账户管理」中申请注销账户。账户注销后数据保留 30 天，期满后按照法律法规要求清除。
            </Text>
          </View>

          <View className="policy-section">
            <Text className="section-title">7. 联系我们</Text>
            <Text className="section-text">
              如果您对本隐私政策有任何疑问或建议，请通过「我的」页面底部的「客服反馈」联系我们，我们会尽快回复。
            </Text>
          </View>
        </View>
        <View style={{ height: '80px' }} />
      </ScrollView>
    </View>
  );
}
