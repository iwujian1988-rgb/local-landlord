@echo off
setlocal
cd /d "%~dp0"

echo 业务域名校验文件上传工具
echo 脚本目录：%~dp0
where scp >nul 2>nul
if errorlevel 1 (
  echo 未找到 scp，请先安装或启用 Windows OpenSSH Client。
  pause
  exit /b 1
)
where ssh >nul 2>nul
if errorlevel 1 (
  echo 未找到 ssh，请先安装或启用 Windows OpenSSH Client。
  pause
  exit /b 1
)
pause

set "HOST=api.wulianzhijia.cn"
set "USER=ubuntu"
set "VERIFY_FILE=zbQbvEaGmB.txt"
set "VERIFY_LOCAL=%USERPROFILE%\Downloads\%VERIFY_FILE%"
set "REMOTE_SCRIPT=setup-business-domain.sh"

if not exist "%VERIFY_LOCAL%" (
  echo 未找到校验文件：%VERIFY_LOCAL%
  pause
  exit /b 1
)

echo [1/3] 上传校验文件...
scp -o StrictHostKeyChecking=accept-new "%VERIFY_LOCAL%" %USER%@%HOST%:/tmp/%VERIFY_FILE%
if errorlevel 1 goto :fail

echo [2/3] 上传服务器配置脚本...
scp -o StrictHostKeyChecking=accept-new "%~dp0%REMOTE_SCRIPT%" %USER%@%HOST%:/tmp/%REMOTE_SCRIPT%
if errorlevel 1 goto :fail

echo [3/3] 服务器正在安装并验证（可能会再次要求输入服务器密码）...
ssh -t -o StrictHostKeyChecking=accept-new %USER%@%HOST% "sudo bash /tmp/%REMOTE_SCRIPT%"
if errorlevel 1 goto :fail

echo.
echo 完成。现在回到微信后台，点击业务域名窗口中的“保存”。
pause
exit /b 0

:fail
echo.
echo 执行失败，请把上面的完整错误信息发我。
pause
exit /b 1
