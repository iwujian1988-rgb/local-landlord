import { Global, Module } from '@nestjs/common';
import { WechatApiService } from './wechat-api.service';

@Global()
@Module({
  providers: [WechatApiService],
  exports: [WechatApiService],
})
export class WechatApiModule {}
