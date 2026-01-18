# 1. Подключитесь к серверу
ssh root@94.230.231.28

# 2. Установите Node.js и npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Установите MongoDB
sudo apt-get install mongodb

# 4. Скопируйте файлы на сервер
scp -r ./finance-empire/* root@94.230.231.28:/var/www/finance-empire/

# 5. На сервере установите зависимости
cd /var/www/finance-empire
npm install

# 6. Запустите сервер
npm start

# 7. Для постоянной работы установите PM2
npm install -g pm2
pm2 start server.js --name finance-empire
pm2 save
pm2 startup