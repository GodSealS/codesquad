@echo off
REM Set console to UTF-8 to fix Chinese character display on Windows
chcp 65001 > nul
node "%~dp0codesquad.js" %*
