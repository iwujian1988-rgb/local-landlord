import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import NavBar from '../../components/NavBar';
import './index.scss';

export default function Privacy() {
  const goBack = () => {
    Taro.navigateBack();
  };

  return (
    <View className="page-privacy">
      <NavBar title="隐私政策" onBack={goBack} />
      <ScrollView className="content-scroll" scrollY>
        <View className="policy-content">
          <Text className="policy-title">隐私政策</Text>
          <Text className="policy-update">更新日期：2024年1月1日</Text>

          <View className="policy-section">
            <Text className="section-title">1. 信息收集</Text>
            <Text className="section-text">
              我们仅收集您主动提供的信息，包括：房源信息、租客信息、收款码图片。我们不收集任何个人身份信息，所有数据加密存储在您设备的本地存储中。
            </Text>
          </View>

          <View className="policy-section">
            <Text className="section-title">2. 信息使用</Text>
            <Text className="section-text">
              收集的信息仅用于本应用的功能实现：管理房源、记录收租、生成账单等。我们不会将您的数据用于其他目的，也不会与第三方共享。
            </Text>
          </View>

          <View className="policy-section">
            <Text className="section-title">3. 数据存储</Text>
            <Text className="section-text">
              所有数据均存储在您的设备本地。我们不会将数据上传到服务器。您可以随时通过卸载应用来完全清除所有数据。
            </Text>
          </View>

          <View className="policy-section">
            <Text className="section-title">4. 信息安全</Text>
            <Text className="section-text">
              我们采用合理的安全措施保护您的数据安全。由于数据存储在您设备本地，请您妥善保管好自己的设备。
            </Text>
          </View>

          <View className="policy-section">
            <Text className="section-title">5. 权限说明</Text>
            <Text className="section-text">
              本应用可能需要访问以下权限：相册（用于上传收款码和房源照片）、通讯录（仅在您主动选择导入联系人时使用）。所有权限都需要您的明确授权。
            </Text>
          </View>

          <View className="policy-section">
            <Text className="section-title">6. 联系我们</Text>
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
