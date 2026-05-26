@echo off
setlocal

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js est introuvable. Installe Node.js ou ajoute-le au PATH.
  pause
  exit /b 1
)

echo Demarrage de SEVEN Chantier...
start "SEVEN Chantier Server" /min node tools\dev-static-server.cjs

timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:4173/"

echo Application ouverte sur http://127.0.0.1:4173/
echo Laisse la fenetre serveur ouverte pendant l'utilisation.
