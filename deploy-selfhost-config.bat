@echo off
setlocal

set "HOST=ubuntu@api.wulianzhijia.cn"
set "KEY=%USERPROFILE%\.ssh\codex_migration_key"
set "REMOTE=/home/ubuntu/local-landlord"

if not exist "%KEY%" (
  echo SSH key not found: %KEY%
  pause
  exit /b 1
)

echo Uploading self-host configuration...
scp -i "%KEY%" -o IdentitiesOnly=yes docker\docker-compose.yml "%HOST%:%REMOTE%/docker/"
if errorlevel 1 goto :failed
scp -i "%KEY%" -o IdentitiesOnly=yes docker\nginx-selfhost.conf "%HOST%:%REMOTE%/docker/"
if errorlevel 1 goto :failed
scp -i "%KEY%" -o IdentitiesOnly=yes .env.selfhost.example "%HOST%:%REMOTE%/"
if errorlevel 1 goto :failed

echo Applying non-secret settings on server...
ssh -i "%KEY%" -o IdentitiesOnly=yes "%HOST%" "cd %REMOTE% && test -f .env || cp .env.selfhost.example .env && sed -i 's/^DB_HOST=.*/DB_HOST=mysql/; s/^PORT=.*/PORT=3000/; s/^ALLOW_OPENID_HEADER=.*/ALLOW_OPENID_HEADER=false/' .env && chmod 600 .env && docker compose -f docker/docker-compose.yml config >/dev/null"
if errorlevel 1 goto :failed

echo Done. Secrets were not changed. Fill the remaining CHANGE_ME values in:
echo %REMOTE%/.env
pause
exit /b 0

:failed
echo Deployment step failed. Check the error above.
pause
exit /b 1
