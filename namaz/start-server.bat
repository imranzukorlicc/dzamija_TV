@echo off
title Namaska vremena - lokalni server
echo Otvorite u pregledniku:  http://localhost:8080
echo (za TV koji je u istoj mrezi koristite IP ovog racunara, npr. http://192.168.1.10:8080)
start "" http://localhost:8080
python -m http.server 8080 || py -m http.server 8080
pause
