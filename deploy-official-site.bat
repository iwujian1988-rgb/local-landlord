@echo off
setlocal
cd /d "%~dp0"

set "HOST=ubuntu@api.wulianzhijia.cn"
set "KEY=%USERPROFILE%\.ssh\codex_migration_key"

if not exist "%KEY%" (
  echo SSH key not found: %KEY%
  pause
  exit /b 1
)

echo Uploading official site...
scp -i "%KEY%" -o IdentitiesOnly=yes -r official-site "%HOST%:/home/ubuntu/"
if errorlevel 1 goto :failed
scp -i "%KEY%" -o IdentitiesOnly=yes docker\nginx-official-site.conf "%HOST%:/home/ubuntu/"
if errorlevel 1 goto :failed

echo Installing official site and nginx config...
ssh -i "%KEY%" -o IdentitiesOnly=yes "%HOST%" "sudo mkdir -p /var/www/wulianzhijia && sudo cp -r /home/ubuntu/official-site/. /var/www/wulianzhijia/ && sudo cp /home/ubuntu/nginx-official-site.conf /etc/nginx/sites-available/wulianzhijia && sudo ln -sf /etc/nginx/sites-available/wulianzhijia /etc/nginx/sites-enabled/wulianzhijia && sudo nginx -t && sudo systemctl reload nginx"
if errorlevel 1 goto :failed

echo Official site installed. Next configure DNS for @ and www, then run certbot.
pause
exit /b 0

:failed
echo Deployment failed. Check the error above.
pause
exit /b 1
