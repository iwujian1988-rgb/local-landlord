# 微信云托管内测部署清单

## 小程序运行模式

- 开发构建：`APP_USE_CLOUD=false`，接口走 `http://127.0.0.1:3100/api`
- 生产/体验版构建：`APP_USE_CLOUD=true`，接口走 `wx.cloud.callContainer`
- 图片/H5 公网地址仍使用 `API_BASE` 推导，当前生产地址：
  - API: `https://local-landlord-265509-4-1439465517.sh.run.tcloudbase.com/api`
  - H5: `https://prod-d6gpmvmbod40b5928.sh.run.tcloudbaseapp.com/h5`

## 云托管服务配置

云环境 ID：

```text
prod-d6gpmvmbod40b5928
```

云托管服务名：

```text
local-landlord
```

容器端口：

```text
80
```

Dockerfile：

```text
docker/Dockerfile.server
```

## 必填环境变量

`container.config.json` 已打开云托管登录：

```text
ALLOW_OPENID_HEADER=true
UPLOAD_MODE=cloudbase
```

上线前必须在云托管控制台补齐：

```text
DB_HOST=
DB_PORT=3306
DB_USERNAME=
DB_PASSWORD=
DB_DATABASE=local_landlord
JWT_SECRET=
WX_APPID=
WX_SECRET=
COS_SECRET_ID=
COS_SECRET_KEY=
COS_BUCKET=
COS_REGION=
ADMIN_DEFAULT_PASSWORD=
```

说明：

- `ALLOW_OPENID_HEADER=true` 只应该在微信云托管内开启，用来接收微信网关注入的 `X-WX-OPENID`。
- `UPLOAD_MODE=cloudbase` 会把图片上传到 COS。`COS_*` 不填时，体验版上传房源图、二维码、合同图会失败。
- 不要把小程序体验版 API 指向 `127.0.0.1`，内测用户手机无法访问你的电脑本地服务。

## 发布前自测

1. 云托管服务部署成功后，在微信开发者工具用体验版构建打开小程序。
2. 首次进入首页，确认能自动登录，不出现 `cloud-login` 失败。
3. 新增房源并上传图片，确认图片能显示，且数据库中不再保存 `127.0.0.1` 图片地址。
4. 新增房间、新增租客，确认首页 hero、收租列表、统计页正常刷新。
5. 上传收款二维码，保存后重新进入页面，确认二维码能正常显示。
6. 让一名体验成员扫码进入，确认不需要连接你的电脑本地服务也能登录和使用。

## 本地验证命令

```bash
npx tsc -p packages/server/tsconfig.json --noEmit
npx tsc -p packages/miniapp/tsconfig.json --noEmit
cd packages/miniapp
npx taro build --type weapp
```

