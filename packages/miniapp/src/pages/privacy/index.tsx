import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
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
          <Text className="policy-update">更新日期：2026年1月1日</Text>

          <View className="policy-section">
            <Text className="section-title">1. 信息收集</Text>
            <Text className="section-text">
              我们收集以下您主动提供的信息：房源名称和地址、租客姓名和电话、账单和收款记录、房源及合同照片。此外，我们通过微信登录获取您的微信 OpenID 用于身份识别。我们不会收集您的通讯录、位置信息或其他无关数据。
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
              您的数据通过加密连接（HTTPS）传输，安全存储在我们的服务器上。照片等文件资源存储在腾讯云对象存储（COS）中。我们使用 JWT（JSON Web Token）进行身份认证，确保只有您本人可以访问自己的数据。服务器采取合理的安全措施防止数据泄露。
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
              本应用需要以下权限：微信登录（用于身份识别）、相册/相机（用于拍摄和上传房源照片、合同照片、收款码）。所有权限都需要您的明确授权，您可以在微信设置中随时关闭。
            </Text>
          </View>

          <View className="policy-section">
            <Text className="section-title">6. 数据删除</Text>
            <Text className="section-text">
              您可以在应用内删除自己录入的房源、租客、照片等数据。如需彻底注销账户和清除所有数据，请联系客服处理。
            </Text>
          </View>

          <View className="policy-section">
            <Text className="section-title">7. 联系我们</Text>
            <Text className="section-text">
              如果您对本隐私政策有任何疑问或建议，请通过以下方式联系我们：客服电话 400-888-8888
            </Text>
          </View>
        </View>
        <View style={{ height: '80px' }} />
      </ScrollView>
    </View>
  );
}
