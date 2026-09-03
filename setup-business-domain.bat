@echo off
setlocal
cd /d "%~dp0"

echo Business domain verification uploader
echo Script folder: %~dp0

where scp >nul 2>nul
if errorlevel 1 goto :no_scp
where ssh >nul 2>nul
if errorlevel 1 goto :no_ssh

set HOST=api.wulianzhijia.cn
set USER_NAME=ubuntu
set VERIFY_FILE=zbQbvEaGmB.txt
set VERIFY_LOCAL=%USERPROFILE%\Downloads\%VERIFY_FILE%
set REMOTE_SCRIPT=setup-business-domain.sh

if not exist "%VERIFY_LOCAL%" goto :no_file

echo.
echo Press any key to start. SSH/SCP will ask for the server password.
pause

echo [1/3] Uploading verification file...
scp -o StrictHostKeyChecking=accept-new "%VERIFY_LOCAL%" %USER_NAME%@%HOST%:/tmp/%VERIFY_FILE%
if errorlevel 1 goto :failed

echo [2/3] Uploading remote setup script...
scp -o StrictHostKeyChecking=accept-new "%~dp0%REMOTE_SCRIPT%" %USER_NAME%@%HOST%:/tmp/%REMOTE_SCRIPT%
if errorlevel 1 goto :failed

echo [3/3] Installing Nginx rule and checking URL...
ssh -t -o StrictHostKeyChecking=accept-new %USER_NAME%@%HOST% "sudo bash /tmp/%REMOTE_SCRIPT%"
if errorlevel 1 goto :failed

echo.
echo SUCCESS. Return to WeChat and click Save.
pause
exit /b 0

:no_scp
echo ERROR: scp was not found.
pause
exit /b 1

:no_ssh
echo ERROR: ssh was not found.
pause
exit /b 1

:no_file
echo ERROR: verification file not found:
echo %VERIFY_LOCAL%
pause
exit /b 1

:failed
echo ERROR: command failed. Read the message above.
pause
exit /b 1
