@echo off
rem Misja AED - uruchomienie prototypu jednym kliknieciem (Windows).
rem 1) Jesli jest Node.js - serwer na http://localhost:8080/prototyp/
rem 2) Jesli jest Python - serwer na http://localhost:8080/prototyp/
rem 3) W przeciwnym razie - otwiera plik prototyp\index.html bezposrednio (tez dziala).
cd /d "%~dp0"
if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"
if exist "%LOCALAPPDATA%\Programs\node\node.exe" set "PATH=%LOCALAPPDATA%\Programs\node;%PATH%"
where node >nul 2>nul && (start "" http://localhost:8080/prototyp/ & node narzedzia\serwer.mjs & goto :eof)
where py >nul 2>nul && (start "" http://localhost:8080/prototyp/ & py -m http.server 8080 & goto :eof)
where python >nul 2>nul && (start "" http://localhost:8080/prototyp/ & python -m http.server 8080 & goto :eof)
start "" "%~dp0prototyp\index.html"
