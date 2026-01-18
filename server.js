// ================== КОНФИГУРАЦИЯ СЕРВЕРА ==================
const API_BASE_URL = 'http://94.230.231.28:3000/api';

// ================== СИСТЕМА ПОЛЬЗОВАТЕЛЕЙ ==================
class UserSystem {
    constructor() {
        this.currentUser = null;
        this.token = localStorage.getItem('financeEmpireToken');
    }

    async register(username, password, email = '') {
        try {
            const response = await fetch(`${API_BASE_URL}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password, email })
            });

            const data = await response.json();

            if (!response.ok) {
                return { success: false, message: data.error || 'Ошибка регистрации' };
            }

            this.token = data.token;
            this.currentUser = data.user;
            localStorage.setItem('financeEmpireToken', data.token);
            localStorage.setItem('financeEmpireUserId', data.user.id);

            return { success: true, user: data.user, token: data.token };
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, message: 'Ошибка подключения к серверу' };
        }
    }

    async login(username, password) {
        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                return { success: false, message: data.error || 'Ошибка входа' };
            }

            this.token = data.token;
            this.currentUser = data.user;
            localStorage.setItem('financeEmpireToken', data.token);
            localStorage.setItem('financeEmpireUserId', data.user.id);

            return { success: true, user: data.user, token: data.token };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: 'Ошибка подключения к серверу' };
        }
    }

    async loadUserData() {
        if (!this.token) return null;

        try {
            const response = await fetch(`${API_BASE_URL}/user`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                localStorage.removeItem('financeEmpireToken');
                localStorage.removeItem('financeEmpireUserId');
                return null;
            }

            const data = await response.json();
            this.currentUser = data;
            return data;
        } catch (error) {
            console.error('Load user error:', error);
            return null;
        }
    }

    async saveGameData(gameData) {
        if (!this.token) return false;

        try {
            const response = await fetch(`${API_BASE_URL}/save`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ gameData })
            });

            return response.ok;
        } catch (error) {
            console.error('Save error:', error);
            return false;
        }
    }

    async getLeaderboard(limit = 100) {
        try {
            const response = await fetch(`${API_BASE_URL}/leaderboard?limit=${limit}`);
            if (!response.ok) throw new Error('Ошибка загрузки лидерборда');
            return await response.json();
        } catch (error) {
            console.error('Get leaderboard error:', error);
            return [];
        }
    }

    async getLeaderboardTop() {
        try {
            const response = await fetch(`${API_BASE_URL}/leaderboard/top`);
            if (!response.ok) throw new Error('Ошибка загрузки топа');
            return await response.json();
        } catch (error) {
            console.error('Get top leaderboard error:', error);
            return [];
        }
    }

    async getUserLeaderboardPosition() {
        if (!this.token) return null;

        try {
            const response = await fetch(`${API_BASE_URL}/leaderboard/position`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Ошибка получения позиции');
            return await response.json();
        } catch (error) {
            console.error('Get position error:', error);
            return null;
        }
    }

    logout() {
        this.token = null;
        this.currentUser = null;
        localStorage.removeItem('financeEmpireToken');
        localStorage.removeItem('financeEmpireUserId');
    }
}

// ================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==================
let userSystem = new UserSystem();
let gameState = null;
let currentActiveEvents = [];
let eventTimers = {};
let autoSaveInterval;
let leaderboardCache = null;
let leaderboardCacheTime = 0;
const LEADERBOARD_CACHE_DURATION = 5 * 60 * 1000; // 5 минут

// ================== ОБНОВЛЕНИЕ ФУНКЦИЙ ДЛЯ РАБОТЫ С СЕРВЕРОМ ==================

// В функции initAuth добавьте проверку существующей сессии:
async function initAuth() {
    // Проверка сохраненного токена
    const token = localStorage.getItem('financeEmpireToken');
    if (token) {
        showNotification('Загрузка данных...', 'info');

        const userData = await userSystem.loadUserData();
        if (userData) {
            gameState = userData.gameData;
            showApp(userData);
            startAutoSave();
            return;
        }
    }

    // Продолжаем с обычной инициализацией аутентификации...
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const formId = tab.getAttribute('data-form');

            authTabs.forEach(t => t.classList.remove('active'));
            authForms.forEach(f => f.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(`${formId}-form`).classList.add('active');
        });
    });

    // Обработка входа
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        const result = await userSystem.login(username, password);
        if (result.success) {
            gameState = result.user.gameData;
            showApp(result.user);
            startAutoSave();
        } else {
            showNotification(result.message, 'error');
        }
    });

    // Обработка регистрации
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('register-username').value;
        const password = document.getElementById('register-password').value;
        const email = document.getElementById('register-email').value;

        const result = await userSystem.register(username, password, email);
        if (result.success) {
            gameState = result.user.gameData;
            showApp(result.user);
            showNotification('Регистрация успешна! Добро пожаловать в Finance Empire!', 'success');
            startAutoSave();
        } else {
            showNotification(result.message, 'error');
        }
    });

    // Выход из системы
    logoutButton.addEventListener('click', () => {
        userSystem.logout();
        clearInterval(autoSaveInterval);
        authScreen.style.display = 'flex';
        appContainer.style.display = 'none';
    });
}

// Добавьте функцию автосохранения:
function startAutoSave() {
    // Сохраняем каждые 30 секунд
    autoSaveInterval = setInterval(async () => {
        if (gameState && userSystem.currentUser) {
            const success = await userSystem.saveGameData(gameState);
            if (success) {
                console.log('Автосохранение выполнено');
            }
        }
    }, 30000);

    // Также сохраняем при закрытии вкладки
    window.addEventListener('beforeunload', async () => {
        if (gameState && userSystem.currentUser) {
            await userSystem.saveGameData(gameState);
        }
    });
}

// Обновите функцию сохранения в updateDisplay:
async function updateDisplay() {
    // Обновляем баланс
    balanceElement.textContent = formatMoney(gameState.money);
    balanceStatElement.textContent = formatMoney(gameState.money);

    // Обновляем престиж
    prestigeElement.textContent = gameState.prestigePoints;

    // Пересчитываем доходы
    const incomes = calculateIncomes();

    // Обновляем отображение доходов
    clickIncomeElement.textContent = formatMoney(incomes.clickIncome);
    clickValueElement.textContent = `+${formatMoney(incomes.clickIncome)}`;
    clickMultiplierElement.textContent = `Множитель: ${gameState.clickMultiplier.toFixed(1)}x`;
    incomePerSecElement.textContent = `${formatMoney(incomes.passiveIncome)}/сек`;

    // Обновляем прогресс бары
    updateProgressBars();

    // Обновляем все вкладки
    renderAllTabs();

    // Проверяем достижения
    checkAchievements();

    // Автосохранение на сервер
    if (userSystem.currentUser) {
        await userSystem.saveGameData(gameState);
    }
}

// Обновите функцию рендера лидерборда:
async function renderLeaderboard() {
    const leaderboardTable = document.getElementById('leaderboard-table');
    if (!leaderboardTable) return;

    // Используем кэшированные данные, если они актуальны
    const now = Date.now();
    if (!leaderboardCache || now - leaderboardCacheTime > LEADERBOARD_CACHE_DURATION) {
        try {
            leaderboardCache = await userSystem.getLeaderboard();
            leaderboardCacheTime = now;
        } catch (error) {
            showNotification('Ошибка загрузки лидерборда', 'error');
            return;
        }
    }

    const leaderboard = leaderboardCache;
    const currentUserId = userSystem.currentUser?.id;

    leaderboardTable.innerHTML = `
        <div class="leaderboard-header">
            <div>Ранг</div>
            <div>Игрок</div>
            <div>Уровень престижа</div>
            <div>Очки престижа</div>
            <div>Общий капитал</div>
        </div>
    `;

    leaderboard.forEach((player, index) => {
        const isCurrentUser = player.userId === currentUserId;
        const row = document.createElement('div');
        row.className = `leaderboard-row ${isCurrentUser ? 'current-user' : ''}`;

        const rankClass = index === 0 ? 'rank-1' :
                         index === 1 ? 'rank-2' :
                         index === 2 ? 'rank-3' : '';

        row.innerHTML = `
            <div class="rank-cell ${rankClass}">
                ${index + 1}
            </div>
            <div class="user-cell">
                <div class="user-cell-avatar">${player.username.charAt(0).toUpperCase()}</div>
                <div>
                    <div style="font-weight: 600;">${player.username}</div>
                    ${isCurrentUser ? '<div style="color: var(--accent); font-size: 0.8rem;">Вы</div>' : ''}
                </div>
            </div>
            <div>${player.prestigeLevel}</div>
            <div>${formatMoney(player.prestigePoints)}</div>
            <div>${formatMoney(player.totalMoney)}</div>
        `;

        leaderboardTable.appendChild(row);
    });

    // Получаем позицию текущего пользователя
    if (currentUserId) {
        const positionData = await userSystem.getUserLeaderboardPosition();
        if (positionData && positionData.position === null) {
            // Если пользователя нет в топ-100, показываем его отдельно
            const currentUser = userSystem.currentUser;
            const totalMoney = calculateTotalMoneyForLeaderboard(gameState);

            const row = document.createElement('div');
            row.className = 'leaderboard-row current-user';
            row.innerHTML = `
                <div class="rank-cell">${positionData ? positionData.position : '-'}</div>
                <div class="user-cell">
                    <div class="user-cell-avatar">${currentUser.username.charAt(0).toUpperCase()}</div>
                    <div>
                        <div style="font-weight: 600;">${currentUser.username}</div>
                        <div style="color: var(--accent); font-size: 0.8rem;">Вы</div>
                    </div>
                </div>
                <div>${gameState.prestigeLevel}</div>
                <div>${formatMoney(gameState.prestigePoints)}</div>
                <div>${formatMoney(totalMoney)}</div>
            `;

            leaderboardTable.appendChild(row);

            // Добавляем информацию о позиции
            if (positionData && positionData.position) {
                const infoDiv = document.createElement('div');
                infoDiv.style.textAlign = 'center';
                infoDiv.style.marginTop = '20px';
                infoDiv.style.color = 'var(--text-secondary)';
                infoDiv.innerHTML = `<i class="fas fa-info-circle"></i> Ваша позиция в общем рейтинге: ${positionData.position} из ${positionData.totalPlayers}`;
                leaderboardTable.appendChild(infoDiv);
            }
        }
    }
}

// Вспомогательная функция для расчета денег для лидерборда
function calculateTotalMoneyForLeaderboard(gameData) {
    let total = gameData.money || 0;

    // Расчет стоимости всех улучшений
    if (gameData.upgrades) {
        const allUpgrades = [
            ...gameData.clickUpgrades,
            ...gameData.realEstateUpgrades,
            ...gameData.cryptoUpgrades,
            ...gameData.businessUpgrades,
            ...gameData.luxuryUpgrades
        ];

        allUpgrades.forEach(upgrade => {
            const level = gameData.upgrades[upgrade.id] || 0;
            if (level > 0) {
                for (let i = 0; i < level; i++) {
                    total += upgrade.basePrice * Math.pow(upgrade.priceMultiplier, i);
                }
            }
        });
    }

    return total;
}

// Обновите функцию initTabs для кэширования лидерборда:
function initTabs() {
    const tabs = document.querySelectorAll('.nav-tab');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });

            const tabId = tab.getAttribute('data-tab');
            document.getElementById(`${tabId}-tab`).classList.add('active');

            // Особые обработки для вкладок
            if (tabId === 'leaderboard') {
                // Сбрасываем кэш при открытии вкладки
                leaderboardCache = null;
                renderLeaderboard();
            } else if (tabId === 'events') {
                renderEventsTab();
            }
        });
    });
}

// ================== ИНСТРУКЦИЯ ПО ЗАПУСКУ ==================

/*
1. УСТАНОВКА ЗАВИСИМОСТЕЙ:
   - Установите Node.js
   - В папке с проектом выполните:
     npm init -y
     npm install express mongoose cors bcryptjs jsonwebtoken

2. УСТАНОВКА MONGODB:
   - Установите MongoDB на ваш сервер 94.230.231.28
   - Или используйте MongoDB Atlas (бесплатный облачный вариант)
   - Отредактируйте строку подключения в server.js:
     const MONGODB_URI = 'mongodb://localhost:27017/finance_empire'

3. НАСТРОЙКА ФАЙРВОЛА:
   - На сервере 94.230.231.28 откройте порт 3000:
     sudo ufw allow 3000/tcp
   - Для MongoDB (если на том же сервере):
     sudo ufw allow 27017/tcp

4. ЗАПУСК СЕРВЕРА:
   node server.js

5. ДЛЯ ПОСТОЯННОЙ РАБОТЫ (с PM2):
   npm install -g pm2
   pm2 start server.js --name finance-empire
   pm2 save
   pm2 startup

6. НАСТРОЙКА NGINX (опционально, для домена):
   - Настройте проксирование с порта 80 на 3000
   - Или используйте домен с портом: http://94.230.231.28:3000

7. БЕЗОПАСНОСТЬ:
   - Измените JWT_SECRET в server.js
   - Используйте HTTPS в продакшене
   - Настройте CORS для вашего домена
*/

// Обновите блок инициализации в конце файла:
document.addEventListener('DOMContentLoaded', () => {
    initAuth();

    // Показываем статус подключения
    const connectionStatus = document.createElement('div');
    connectionStatus.id = 'connection-status';
    connectionStatus.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 10px;
        padding: 5px 10px;
        background: var(--secondary);
        border-radius: 5px;
        font-size: 0.8rem;
        color: var(--text-secondary);
        z-index: 10000;
        display: none;
    `;
    document.body.appendChild(connectionStatus);

    // Проверка подключения к серверу
    async function checkConnection() {
        try {
            const response = await fetch(`${API_BASE_URL}/leaderboard/top`);
            if (response.ok) {
                connectionStatus.textContent = '✓ Онлайн';
                connectionStatus.style.color = 'var(--accent2)';
                connectionStatus.style.display = 'block';
                setTimeout(() => {
                    connectionStatus.style.display = 'none';
                }, 3000);
            }
        } catch (error) {
            connectionStatus.textContent = '✗ Офлайн';
            connectionStatus.style.color = 'var(--accent4)';
            connectionStatus.style.display = 'block';
        }
    }

    // Проверяем подключение при загрузке
    checkConnection();

    // Периодическая проверка
    setInterval(checkConnection, 60000);
});