import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import NavBar from '../../components/NavBar';
import './index.scss';

export default function Terms() {
  const goBack = () => {
    Taro.navigateBack();
  };

  return (
    <View className="page-terms">
      <NavBar title="用户协议" onBack={goBack} />
      <ScrollView className="content-scroll" scrollY>
        <View className="policy-content">
          <Text className="policy-title">用户协议</Text>
          <Text className="policy-update">更新日期：2024年1月1日</Text>

          <View className="policy-section">
            <Text className="section-title">1. 接受条款</Text>
            <Text className="section-text">
              使用本应用即表示您同意本用户协议的所有条款。如果您不同意本协议的任何条款，请不要使用本应用。
            </Text>
          </View>

          <View className="policy-section">
            <Text className="section-title">2. 服务说明</Text>
            <Text className="section-text">
              本应用是一个房东管理工具，提供房源管理、租客管理、收租记录、账单生成等功能。所有数据处理均在您的设备本地完成。
            </Text>
          </View>

          <View className="policy-section">
            <Text className="section-title">3. 用户义务</Text>
            <Text className="section-text">
              您应当合法使用本应用，不得利用本应用从事违法违规活动。您应当对您输入和存储的数据负责。请确保您有权收集和使用租客信息。
            </Text>
          </View>

          <View className="policy-section">
            <Text className="section-title">4. 知识产权</Text>
            <Text className="section-text">
              本应用的所有内容，包括但不限于代码、界面设计、图标等均受知识产权保护。未经许可，不得复制、修改或分发本应用。
            </Text>
          </View>

          <View className="policy-section">
            <Text className="section-title">5. 免责声明</Text>
            <Text className="section-text">
              本应用提供的是管理工具，不构成任何法律、税务或财务建议。用户应自行承担使用本应用的风险。我们不对因使用本应用而产生的任何损失承担责任。
            </Text>
          </View>

          <View className="policy-section">
            <Text className="section-title">6. 协议变更</Text>
            <Text className="section-text">
              我们可能会不时更新本用户协议。更新后的协议将在应用内发布，继续使用本应用即表示您接受更新后的协议。
            </Text>
          </View>

          <View className="policy-section">
            <Text className="section-title">7. 联系我们</Text>
            <Text className="section-text">
              如果您对本协议有任何疑问，请通过以下方式联系我们：客服电话 400-888-8888
            </Text>
          </View>
        </View>
        <View style={{ height: '80px' }} />
      </ScrollView>
    </View>
  );
}
