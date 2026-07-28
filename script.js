// Блокировка закрытия свайпом в Telegram Mini Apps
if (window.Telegram?.WebApp?.preventClose) {
  window.Telegram.WebApp.preventClose();
}

// Отключение вертикальных свайпов (для Telegram 7.7+)
if (window.Telegram?.WebApp?.disableVerticalSwipes) {
  window.Telegram.WebApp.disableVerticalSwipes();
} else {
}

// Определение платформы
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isTelegramIOS = isIOS && window.Telegram?.WebApp?.platform === 'ios';

// ==================== РЕГИСТРАЦИЯ SERVICE WORKER (оффлайн режим) ====================
// Примечание: сам файл sw.js по требованиям браузерной безопасности не может
// быть встроен как blob:/data: URL — Service Worker обязателен как реальный
// сетевой файл рядом с index.html. Поэтому здесь только регистрация.
(function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.info('[SW] Service Worker не поддерживается этим браузером.');
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('sw.js')
      .then((registration) => {
        console.info('[SW] Зарегистрирован, scope:', registration.scope);

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.info('[SW] Доступна новая версия приложения.');
            }
          });
        });
      })
      .catch((err) => {
        console.warn('[SW] Ошибка регистрации (это нормально, если сайт открыт не по HTTPS/localhost):', err);
      });
  });
})();

document.addEventListener('DOMContentLoaded', function() {
  
  // Блокировка всплытия событий прокрутки
  const container = document.querySelector('#scrollable');
  if (container) {
    container.addEventListener('scroll', (e) => {
      e.stopPropagation();
    });
  }

  // Текущий месяц и год
  let currentMonth = new Date().getMonth();
  let currentYear = new Date().getFullYear();
  
  // Названия месяцев
  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 
    'Май', 'Июнь', 'Июль', 'Август', 
    'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  // Флаг изменений для автосохранения
  let hasUnsavedChanges = false;
  let saveTimeout = null;

  // ==================== УЛУЧШЕННАЯ ЗАГРУЗКА ДАННЫХ ====================
  
  function loadDataWithValidation() {
    
    const keys = ['financeData', 'budgetData', 'savingsWidgets', 'fundWidgets'];
    keys.forEach(key => {
      const value = localStorage.getItem(key);
    });

    try {
      // Загрузка с валидацией
      const financeDataStr = localStorage.getItem('financeData');
      const budgetDataStr = localStorage.getItem('budgetData');
      const savingsWidgetsStr = localStorage.getItem('savingsWidgets');
      const fundWidgetsStr = localStorage.getItem('fundWidgets');

      // Валидация и парсинг данных
      financeData = financeDataStr ? JSON.parse(financeDataStr) : {};
      budgetData = budgetDataStr ? JSON.parse(budgetDataStr) : {
        totalAmount: 0,
        days: 0,
        startDate: null,
        spent: 0,
        dailyHistory: {}
      };
      savingsWidgets = savingsWidgetsStr ? JSON.parse(savingsWidgetsStr) : [];
      fundWidgets = fundWidgetsStr ? JSON.parse(fundWidgetsStr) : [];

      return true;
    } catch (error) {
      console.error('❌ Ошибка загрузки данных:', error);
      
      // Восстановление из резервной копии
      if (restoreBackup()) {
        return true;
      }
      
      // Инициализация пустых данных
      initializeEmptyData();
      return false;
    }
  }

  function initializeEmptyData() {
    financeData = {};
    budgetData = {
      totalAmount: 0,
      days: 0,
      startDate: null,
      spent: 0,
      dailyHistory: {}
    };
    savingsWidgets = [];
    fundWidgets = [];
    
    initYearData(currentYear);
  }

  function validateDataStructure() {
    // Проверка financeData
    if (!financeData || typeof financeData !== 'object') {
      financeData = {};
    }
    
    // Проверка текущего года
    if (!financeData[currentYear]) {
      initYearData(currentYear);
    }
    
    // Проверка текущего месяца
    if (!financeData[currentYear][currentMonth]) {
      financeData[currentYear][currentMonth] = getDefaultMonthData();
    }
    
    // Проверка других структур
    if (!budgetData || typeof budgetData !== 'object') {
      budgetData = getDefaultBudgetData();
    }
    
    if (!Array.isArray(savingsWidgets)) {
      savingsWidgets = [];
    }
    
    if (!Array.isArray(fundWidgets)) {
      fundWidgets = [];
    }
  }

  function getDefaultMonthData() {
    return { 
      income: 0, 
      expense: 0, 
      categories: {},
      capital: 0,
      expensesHistory: [],
      things: []
    };
  }

  function getDefaultBudgetData() {
    return {
      totalAmount: 0,
      days: 0,
      startDate: null,
      spent: 0,
      dailyHistory: {}
    };
  }

  // ==================== УЛУЧШЕННОЕ СОХРАНЕНИЕ ====================

  function saveData() {
    try {
      // Валидация перед сохранением
      validateDataStructure();
      
      // Сохранение в localStorage
      localStorage.setItem('financeData', JSON.stringify(financeData));
      localStorage.setItem('budgetData', JSON.stringify(budgetData));
      localStorage.setItem('savingsWidgets', JSON.stringify(savingsWidgets));
      localStorage.setItem('fundWidgets', JSON.stringify(fundWidgets));
      
      // Резервная копия
      createBackup();
      
      // Время последнего сохранения
      localStorage.setItem('lastSaveTimestamp', Date.now().toString());

      hasUnsavedChanges = false;
      return true;
    } catch (error) {
      console.error('❌ Ошибка сохранения:', error);
      
      // Попытка сохранить хотя бы основные данные
      try {
        const criticalData = {
          financeData: financeData,
          timestamp: Date.now()
        };
        sessionStorage.setItem('criticalBackup', JSON.stringify(criticalData));
      } catch (e) {
        console.error('❌ Не удалось сохранить даже в sessionStorage:', e);
      }
      
      return false;
    }
  }

  function markDataChanged() {
    hasUnsavedChanges = true;
    
    // Отложенное сохранение (дебаунс)
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    saveTimeout = setTimeout(() => {
      if (hasUnsavedChanges) {
        saveData();
      }
    }, 2000); // Сохраняем через 2 секунды после последнего изменения
  }

  function createBackup() {
    try {
      const backup = {
        financeData: financeData,
        budgetData: budgetData,
        savingsWidgets: savingsWidgets,
        fundWidgets: fundWidgets,
        timestamp: Date.now(),
        version: '2.0'
      };
      sessionStorage.setItem('financeBackup', JSON.stringify(backup));
    } catch (e) {
      console.error('Не удалось создать резервную копию:', e);
    }
  }

  function restoreBackup() {
    try {
      const backupStr = sessionStorage.getItem('financeBackup');
      if (backupStr) {
        const backup = JSON.parse(backupStr);
        
        // Проверяем свежесть бэкапа (не старше 24 часов)
        if (Date.now() - backup.timestamp < 86400000) {
          financeData = backup.financeData || {};
          budgetData = backup.budgetData || getDefaultBudgetData();
          savingsWidgets = backup.savingsWidgets || [];
          fundWidgets = backup.fundWidgets || [];
          return true;
        }
      }
    } catch (e) {
      console.error('Ошибка восстановления из резервной копии:', e);
    }
    return false;
  }

  function checkStorageHealth() {
    try {
      // Проверка доступности localStorage
      const testKey = 'healthCheck';
      const testValue = 'test';
      localStorage.setItem(testKey, testValue);
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      
      if (retrieved !== testValue) {
        throw new Error('LocalStorage не работает корректно');
      }
      
      // Проверка свободного места
      let data = '';
      for (let i = 0; i < 10000; i++) {
        data += '1234567890';
      }
      localStorage.setItem('spaceTest', data);
      localStorage.removeItem('spaceTest');
      
      return true;
    } catch (error) {
      console.error('❌ Проблемы с LocalStorage:', error);
      return false;
    }
  }

  // ==================== ИНИЦИАЛИЗАЦИЯ ДАННЫХ ====================

  // Данные приложения (инициализируются после загрузки)
  let financeData = {};
  let budgetData = {};
  let savingsWidgets = [];
  let fundWidgets = [];

  // Инициализация данных для года
  function initYearData(year) {
    if (!financeData[year]) {
      financeData[year] = {};
      for (let i = 0; i < 12; i++) {
        financeData[year][i] = getDefaultMonthData();
      }
    }
  }

  // Загрузка данных при старте
  if (!loadDataWithValidation()) {
    // Если загрузка не удалась, инициализируем пустые данные
    initializeEmptyData();
  }

  // Проверка здоровья хранилища
  checkStorageHealth();

  // ==================== ОСТАЛЬНОЙ КОД ====================

  // Переменные для графиков
  let chart, yearIncomeChart, yearExpenseChart, yearCapitalChart;
  let miniCapitalChart, miniExpenseChart;
  let trendCharts = {};
  let forecastChartInstance = null;

  // Цвета для категорий
  const categoryColors = [
    '#e74c3c', '#3498db', '#2ecc71', '#f39c12', 
    '#9b59b6', '#1abc9c', '#d35400', '#34495e',
    '#16a085', '#27ae60', '#2980b9', '#8e44ad',
    '#f1c40f', '#e67e22', '#c0392b'
  ];

  // Переменные для пасхалок
  let themeToggleCount = 0;
  let lastThemeToggleTime = 0;
  let pullAttempts = 0;

  // Счетчик кликов по виджетам для активации падения интерфейса
  let widgetClickCount = 0;

  // DOM элементы
  const elements = {
    incomeInput: document.getElementById('income-input'),
    incomeDisplay: document.getElementById('income'),
    expenseDisplay: document.getElementById('expense'),
    percentDisplay: document.getElementById('percent'),
    capitalDisplay: document.getElementById('capital-display'),
    widgetsContainer: document.getElementById('widgets'),
    addIncomeBtn: document.getElementById('add-income-btn'),
    categoryBtn: document.getElementById('category-btn'),
    categoryMenu: document.getElementById('category-menu'),
    categoriesList: document.getElementById('categories-list'),
    newCategoryInput: document.getElementById('new-category-input'),
    addCategoryBtn: document.getElementById('add-category-btn'),
    capitalizationBtn: document.getElementById('capitalization-btn'),
    capitalizationMenu: document.getElementById('capitalization-menu'),
    capitalInput: document.getElementById('capital-input'),
    saveCapitalBtn: document.getElementById('save-capital-btn'),
    cancelCapitalBtn: document.getElementById('cancel-capital-btn'),
    settingsBtn: document.getElementById('settings-btn'),
    settingsMenu: document.getElementById('settings-menu'),
    monthTabs: document.querySelectorAll('.month-tab'),
    yearSummary: document.getElementById('year-summary'),
    closeYearSummary: document.getElementById('close-year-summary'),
    dailyBudgetAmount: document.getElementById('daily-budget-amount'),
    budgetProgress: document.getElementById('budget-progress'),
    budgetSettingsBtn: document.getElementById('budget-settings-btn'),
    setBudgetModal: document.getElementById('set-budget-modal'),
    budgetAmount: document.getElementById('budget-amount'),
    budgetDays: document.getElementById('budget-days'),
    saveBudgetBtn: document.getElementById('save-budget-btn'),
    cancelBudgetBtn: document.getElementById('cancel-budget-btn'),
    miniCapitalChart: document.getElementById('miniCapitalChart'),
    miniExpenseChart: document.getElementById('miniExpenseChart'),
    avgIncome: document.getElementById('avg-income'),
    avgExpense: document.getElementById('avg-expense'),
    bestMonth: document.getElementById('best-month'),
    topCategoriesList: document.getElementById('top-categories-list'),
    themeToggleBtn: document.getElementById('theme-toggle-btn'),
    moreBtn: document.getElementById('more-btn'),
    moreMenu: document.getElementById('more-menu'),
    enableSavingsBtn: document.getElementById('enable-savings-btn'),
    savingsModal: document.getElementById('savings-modal'),
    savingsName: document.getElementById('savings-name'),
    savingsGoal: document.getElementById('savings-goal'),
    saveSavingsBtn: document.getElementById('save-savings-btn'),
    cancelSavingsBtn: document.getElementById('cancel-savings-btn'),
    closeReportsBtn: document.getElementById('close-reports-btn'),
    closeCategoryWidget: document.getElementById('close-category-widget'),
    daysProgressBar: document.querySelector('.days-progress'),
    fundsProgressBar: document.querySelector('.funds-progress'),
    daysProgressValue: document.getElementById('days-progress-value'),
    fundsProgressValue: document.getElementById('funds-progress-value'),
    yearSelectBtn: document.getElementById('year-select-btn'),
    yearSelectModal: document.getElementById('year-select-modal'),
    yearsList: document.getElementById('years-list'),
    addYearBtn: document.getElementById('add-year-btn'),
    closeYearSelect: document.getElementById('close-year-select'),
    historyBtn: document.getElementById('history-btn'),
    historyModal: document.getElementById('history-modal'),
    historyList: document.getElementById('history-list'),
    closeHistory: document.getElementById('close-history'),
    currentYearDisplay: document.getElementById('current-year-display'),
    trendsScroll: document.getElementById('trends-scroll'),
    totalIncome: document.getElementById('total-income'),
    totalExpense: document.getElementById('total-expense'),
    fundModal: document.getElementById('fund-modal'),
    fundName: document.getElementById('fund-name'),
    fundAmount: document.getElementById('fund-amount'),
    saveFundBtn: document.getElementById('save-fund-btn'),
    cancelFundBtn: document.getElementById('cancel-fund-btn'),
    enableFundBtn: document.getElementById('enable-fund-btn'),
    resetBtn: document.getElementById('reset-btn'),
    transferDataBtn: document.getElementById('transfer-data-btn'),
    transferDataModal: document.getElementById('transfer-data-modal'),
    closeTransferData: document.getElementById('close-transfer-data'),
    // Элементы для упрощённого модуля переноса данных
    exportFileBtn: null,
    fileInput: null,
    // Элементы обучения (tutorial-overlay)
    tutorialOverlay: document.getElementById('tutorial-overlay'),
    tutorialTitle: document.getElementById('tutorial-title'),
    tutorialText: document.getElementById('tutorial-text'),
    tutorialPrev: document.getElementById('tutorial-prev'),
    tutorialNext: document.getElementById('tutorial-next'),
    tutorialClose: document.getElementById('tutorial-close'),
    // Прогноз расходов
    forecastBtn: document.getElementById('forecast-btn'),
    forecastModal: document.getElementById('forecast-modal'),
    closeForecast: document.getElementById('close-forecast'),
    // Тепловая карта
    heatmapBtn: document.getElementById('heatmap-btn'),
    heatmapModal: document.getElementById('heatmap-modal'),
    closeHeatmap: document.getElementById('close-heatmap'),
    heatmapGrid: document.getElementById('heatmap-grid'),
    // Редактирование / drag-and-drop виджетов
    editWidgetsBtn: document.getElementById('edit-widgets-btn'),
    editWidgetsModal: document.getElementById('edit-widgets-modal'),
    closeEditWidgets: document.getElementById('close-edit-widgets'),
    draggableWidgetsList: document.getElementById('draggable-widgets-list'),
    saveWidgetsOrderBtn: document.getElementById('save-widgets-order'),
    // Оффлайн-индикатор
    offlineIndicator: document.getElementById('offline-indicator')
  };

  // ==================== УПРОЩЁННЫЙ МОДУЛЬ ПЕРЕНОСА ДАННЫХ ====================

  // Инициализация упрощённого модуля переноса данных
  function initTransferDataModule() {
    // HTML уже находится в index.html — просто получаем ссылки на элементы
    elements.exportFileBtn = document.getElementById('export-file-btn');
    elements.fileInput = document.getElementById('file-input');
    elements.closeTransferData = document.getElementById('close-transfer-data');

    // Настройка обработчиков событий
    setupTransferDataHandlers();
  }

  // Настройка обработчиков для переноса данных
  function setupTransferDataHandlers() {
    // Экспорт в файл
    elements.exportFileBtn.addEventListener('click', exportDataToFile);
    
    // Выбор файла сразу запускает импорт
    elements.fileInput.addEventListener('change', handleFileSelect);
    
    // Закрытие модального окна
    elements.closeTransferData.addEventListener('click', () => {
      elements.transferDataModal.classList.remove('show');
      closeFullscreenModal();
      // Сбрасываем состояние
      resetFileInput();
    });
  }

  // Сброс состояния файлового инпута
  function resetFileInput() {
    elements.fileInput.value = '';
  }

  // Обработчик выбора файла — сразу запускает импорт
  function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
      if (file.name.toLowerCase().endsWith('.txt')) {
        importDataFromFile(file);
      } else {
        alert('Пожалуйста, выберите текстовый файл с расширением .txt');
        resetFileInput();
      }
    }
  }

  // Экспорт данных в файл
  async function exportDataToFile() {
    const dataToExport = {
      financeData,
      budgetData,
      savingsWidgets,
      fundWidgets,
      exportDate: new Date().toISOString(),
      appVersion: '2.0'
    };
    
    const dataStr = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([dataStr], { type: 'text/plain;charset=utf-8' });
    const timestamp = new Date().getTime();
    const fileName = `finance_backup_${timestamp}.txt`;
    
    // Для iOS используем Share API
    if ((isIOS || isTelegramIOS) && navigator.share) {
      try {
        const file = new File([blob], fileName, { type: 'text/plain' });
        
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Резервная копия финансовых данных',
            text: 'Сохраните этот файл для восстановления'
          });
          showSuccessMessage('Файл сохранён!');
          return;
        }
      } catch (error) {
      }
    }
    
    // Для других платформ или как запасной вариант
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
    
    showSuccessMessage('Файл создан!');
  }

  // Импорт данных из файла
  function importDataFromFile(file) {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const importedData = JSON.parse(e.target.result);
        processImportedData(importedData);
      } catch (error) {
        alert('Ошибка при чтении файла: ' + error.message);
        console.error('Import error:', error);
        resetFileInput();
      }
    };
    
    reader.onerror = function() {
      alert('Ошибка при чтении файла');
      resetFileInput();
    };
    
    reader.readAsText(file);
  }

  // Обработка импортированных данных
  function processImportedData(importedData) {
    // Проверяем структуру данных
    const requiredFields = ['financeData', 'budgetData', 'savingsWidgets', 'fundWidgets'];
    const isValid = requiredFields.every(field => importedData.hasOwnProperty(field));
    
    if (!isValid) {
      alert('Некорректный формат данных. Убедитесь, что это данные из этого приложения.');
      resetFileInput();
      return;
    }
    
    if (confirm('Импортировать данные? Текущие данные будут заменены.')) {
      financeData = importedData.financeData || {};
      budgetData = importedData.budgetData || getDefaultBudgetData();
      savingsWidgets = importedData.savingsWidgets || [];
      fundWidgets = importedData.fundWidgets || [];
      
      // Устанавливаем текущий год из данных
      const years = Object.keys(financeData)
        .map(y => parseInt(y))
        .filter(y => !isNaN(y))
        .sort((a, b) => b - a);
        
      if (years.length > 0 && !financeData[currentYear]) {
        currentYear = years[0];
      }
      
      initYearData(currentYear);
      markDataChanged();
      updateUI();
      
      // Сбрасываем форму и закрываем модальное окно
      resetFileInput();
      elements.transferDataModal.classList.remove('show');
      closeFullscreenModal();
      
      showSuccessMessage('Данные успешно восстановлены!');
    } else {
      resetFileInput();
    }
  }

  // Показать инструкции для iOS
  function showIOSInstructions() {
    const modal = document.createElement('div');
    modal.className = 'data-modal';
    modal.innerHTML = `
      <div class="data-modal-content">
        <h3>Как сохранить файл на iPhone/iPad</h3>
        <div class="ios-instructions">
          <h4><span>📱</span> Инструкция для iOS</h4>
          <ol>
            <li>В появившемся меню нажмите "Поделиться"</li>
            <li>Прокрутите список приложений вправо</li>
            <li>Найдите и выберите "Сохранить в Файлы"</li>
            <li>Выберите папку (например, iCloud Drive)</li>
            <li>Нажмите "Сохранить" в правом верхнем углу</li>
          </ol>
          <div class="tip-box">
            <p><strong>Совет:</strong> Для быстрого доступа сохраните файл в папке "Загрузки" или создайте отдельную папку "Финансы"</p>
          </div>
        </div>
        <button class="neumorphic-btn primary close-instructions-btn" style="width: 100%;">
          Понятно
        </button>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('.close-instructions-btn').addEventListener('click', function() {
      document.body.removeChild(modal);
    });
  }

  // ==================== ПРОДОЛЖЕНИЕ ОСНОВНОГО КОДА ====================

  // Функция для анимации падения интерфейса с улучшениями
  function triggerFallAnimation() {
    // Создаем стили для адского режима
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fallDown {
        0% { transform: translateY(0) rotate(0deg); opacity: 1; }
        100% { transform: translateY(100vh) rotate(var(--rotation)); opacity: 0; }
      }
      .falling {
        animation: fallDown 2s ease forwards;
        pointer-events: none;
        position: relative;
        z-index: 10000;
      }
      
      /* Новые эффекты для ада */
      @keyframes hellPulse {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      
      @keyframes flicker {
        0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% {
          opacity: 1;
        }
        20%, 22%, 24%, 55% {
          opacity: 0.3;
        }
      }
      
      @keyframes float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }
      
      body.hell-mode {
        --bg: #1a0000;
        --text: #ff4d4d;
        --shadow-light: #4d0000;
        --shadow-dark: #0a0000;
        --primary: #ff3333;
        --primary-hover: #cc0000;
        transition: all 1s ease;
        background: linear-gradient(45deg, #330000, #1a0000, #4d0000, #330000);
        background-size: 400% 400%;
        animation: hellPulse 15s ease infinite;
      }
      
      body.hell-mode * {
        color: #ff4d4d !important;
        text-shadow: 0 0 5px #ff0000;
        animation: flicker 5s infinite;
      }
      
      body.hell-mode .neumorphic-card,
      body.hell-mode .neumorphic-btn,
      body.hell-mode .neumorphic-input,
      body.hell-mode .neumorphic-menu {
        background: #330000 !important;
        box-shadow: 5px 5px 10px #0a0000, -5px -5px 10px #4d0000 !important;
        border: 1px solid #ff3333 !important;
      }
      
      .hell-particle {
        position: fixed;
        width: 5px;
        height: 5px;
        background: #ff3333;
        border-radius: 50%;
        pointer-events: none;
        z-index: 9998;
        animation: float 3s ease-in-out infinite;
      }
      
      .flame {
        position: fixed;
        width: 100px;
        height: 150px;
        background: radial-gradient(ellipse at center, rgba(255,100,0,0.8) 0%, rgba(255,50,0,0.1) 70%);
        border-radius: 50% 50% 20% 20%;
        filter: blur(5px);
        pointer-events: none;
        z-index: 9997;
        animation: flicker 2s infinite alternate;
      }
      
      @keyframes smokeEffect {
        0% { opacity: 0; transform: scale(0.5); }
        50% { opacity: 0.8; }
        100% { opacity: 0; transform: scale(3); }
      }
      
      .smoke {
        position: absolute;
        background: radial-gradient(circle, rgba(255,100,0,0.7) 0%, rgba(139,0,0,0) 70%);
        border-radius: 50%;
        pointer-events: none;
        animation: smokeEffect 1.5s ease-out forwards;
        z-index: 9999;
      }
    `;
    document.head.appendChild(style);

    // Создаем эффект дыма и огня
    function createHellEffects() {
      // Добавляем частицы ада
      for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.className = 'hell-particle';
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.top = `${Math.random() * 100}%`;
        particle.style.width = `${3 + Math.random() * 7}px`;
        particle.style.height = particle.style.width;
        particle.style.animationDelay = `${Math.random() * 5}s`;
        document.body.appendChild(particle);
      }
      
      // Добавляем языки пламени внизу экрана
      for (let i = 0; i < 5; i++) {
        const flame = document.createElement('div');
        flame.className = 'flame';
        flame.style.left = `${10 + i * 20}%`;
        flame.style.bottom = '-50px';
        flame.style.width = `${80 + Math.random() * 70}px`;
        flame.style.height = `${120 + Math.random() * 80}px`;
        document.body.appendChild(flame);
      }
    }

    // Создаем эффект дыма при падении
    function createSmoke(x, y) {
      const smoke = document.createElement('div');
      smoke.className = 'smoke';
      smoke.style.left = `${x}px`;
      smoke.style.top = `${y}px`;
      smoke.style.width = `${50 + Math.random() * 100}px`;
      smoke.style.height = smoke.style.width;
      document.body.appendChild(smoke);
      
      setTimeout(() => {
        document.body.removeChild(smoke);
      }, 1500);
    }

    // Применяем анимацию ко всем элементам интерфейса
    const allElements = document.querySelectorAll('body > *:not(script):not(style)');
    allElements.forEach(element => {
      if (!element.classList.contains('falling')) {
        // Случайные параметры для каждого элемента
        const rotation = (Math.random() * 360) - 180; // от -180 до 180 градусов
        const delay = Math.random() * 0.5; // случайная задержка
        const duration = 1 + Math.random() * 1; // случайная длительность
        
        element.style.setProperty('--rotation', `${rotation}deg`);
        element.style.animationDelay = `${delay}s`;
        element.style.animationDuration = `${duration}s`;
        element.classList.add('falling');
        
        // Создаем эффект дыма в случайных местах
        if (Math.random() > 0.7) {
          const rect = element.getBoundingClientRect();
          const x = rect.left + rect.width * Math.random();
          const y = rect.top + rect.height * Math.random();
          createSmoke(x, y);
        }
      }
    });

    // Включаем адский режим с дополнительными эффектами
    setTimeout(() => {
      document.body.classList.add('hell-mode');
      createHellEffects();
      
      // Добавляем звуковой эффект (если разрешено)
      if (typeof Audio !== 'undefined') {
        try {
          const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-creepy-laugh-22.mp3');
          audio.volume = 0.3;
        } catch (e) {
        }
      }
      
      // Через 5 секунд возвращаем все на место (но режим ада остается)
      setTimeout(() => {
        allElements.forEach(element => {
          element.classList.remove('falling');
          element.style.animation = 'none';
          element.style.transform = 'none';
          element.style.opacity = '1';
        });
        
        // Удаляем частицы через 10 секунд
        setTimeout(() => {
          document.querySelectorAll('.hell-particle, .flame').forEach(el => el.remove());
        }, 10000);
      }, 5000);
    }, 2000);

    // Сохраняем состояние ада в localStorage
    localStorage.setItem('hellMode', 'true');
    markDataChanged(); // Сохраняем изменение
  }

  // Функция переключения темы
  function toggleTheme() {
    const now = Date.now();
    if (now - lastThemeToggleTime < 2000) {
      themeToggleCount++;
      if (themeToggleCount >= 5) {
        showGhostAnimation();
        themeToggleCount = 0;
      }
    } else {
      themeToggleCount = 1;
    }
    lastThemeToggleTime = now;
    
    document.body.classList.toggle('dark');
    localStorage.setItem('darkTheme', document.body.classList.contains('dark'));
    
    const icon = elements.themeToggleBtn.querySelector('.theme-icon');
    if (document.body.classList.contains('dark')) {
      icon.textContent = '☀️';
      elements.themeToggleBtn.innerHTML = '<span class="theme-icon">☀️</span> Сменить тему';
    } else {
      icon.textContent = '🌙';
      elements.themeToggleBtn.innerHTML = '<span class="theme-icon">🌙</span> Сменить тему';
    }
    
    renderAllCharts();
  }

  // Форматирование валюты
  function formatCurrency(amount) {
    return amount.toLocaleString('ru-RU') + ' ₽';
  }

  // Анимация призраков для достижения Ghost busters
  function showGhostAnimation() {
    const ghosts = ['👻', '👻', '👻', '👻', '👻', '👻', '👻', '👻', '👻', '👻', '👻', '👻', '👻', '👻', '👻', '👻', '👻', '👻', '👻', '👻', '👻', '👻', '👻', '👻', '👻', '👻', '👻', '👻', '👻', '👻', '👻', '👻', '👻', '👻', '👻'];
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '9999';
    container.style.overflow = 'hidden';
    document.body.appendChild(container);

    ghosts.forEach((ghost, i) => {
      const ghostEl = document.createElement('div');
      ghostEl.textContent = ghost;
      ghostEl.style.position = 'absolute';
      ghostEl.style.fontSize = '30px';
      ghostEl.style.left = `${Math.random() * 100}%`;
      ghostEl.style.top = '-50px';
      ghostEl.style.animation = `fall ${3 + Math.random() * 2}s linear ${i * 0.1}s forwards`;
      container.appendChild(ghostEl);
    });

    // Добавляем стили для анимации
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fall {
        to { transform: translateY(calc(100vh + 50px)) rotate(${Math.random() * 360}deg); }
      }
    `;
    document.head.appendChild(style);

    setTimeout(() => {
      document.body.removeChild(container);
      document.head.removeChild(style);
    }, 5000);
  }

  // Отрисовка списка достижений
  // Обновление списка категорий
  function updateCategoriesList() {
    elements.categoriesList.innerHTML = '';
    const monthData = financeData[currentYear][currentMonth];
    const categories = monthData.categories || {};
    
    Object.keys(categories).forEach((category, index) => {
      const categoryItem = document.createElement('div');
      categoryItem.className = 'category-item';
      categoryItem.innerHTML = `
        <span style="color: ${categoryColors[index % categoryColors.length]}">■</span> ${category}
        <span>${formatCurrency(categories[category])}</span>
        <button class="delete-category-btn" data-category="${category}">×</button>
      `;
      elements.categoriesList.appendChild(categoryItem);
    });

    // Добавляем обработчики для новых кнопок удаления
    document.querySelectorAll('.delete-category-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const category = this.getAttribute('data-category');
        deleteCategory(category);
      });
    });
  }

  // Удаление категории
  function deleteCategory(category) {
    if (confirm(`Удалить категорию "${category}"? Все связанные расходы будут потеряны.`)) {
      const monthData = financeData[currentYear][currentMonth];
      const categoryExpense = monthData.categories[category] || 0;
      
      monthData.expense -= categoryExpense;
      delete monthData.categories[category];
      
      markDataChanged(); // Сохраняем изменение
      updateUI();
    }
  }

  // Обновление финансовых показателей
  function updateFinancialMetrics() {
    let totalIncome = 0;
    let totalExpense = 0;
    let bestMonthValue = 0;
    let bestMonthName = '';
    let bestMonthIndex = -1;
    
    for (let i = 0; i < 12; i++) {
      const monthData = financeData[currentYear][i] || { income: 0, expense: 0, capital: 0 };
      totalIncome += monthData.income || 0;
      totalExpense += monthData.expense || 0;
      
      if (monthData.income > bestMonthValue) {
        bestMonthValue = monthData.income;
        bestMonthName = monthNames[i];
        bestMonthIndex = i;
      }
    }
    
    elements.avgIncome.textContent = formatCurrency(Math.round(totalIncome / 12));
    elements.avgExpense.textContent = formatCurrency(Math.round(totalExpense / 12));
    elements.totalIncome.textContent = formatCurrency(totalIncome);
    elements.totalExpense.textContent = formatCurrency(totalExpense);
    
    if (bestMonthIndex >= 0) {
      const monthData = financeData[currentYear][bestMonthIndex];
      const profit = monthData.income - monthData.expense;
      elements.bestMonth.textContent = `${bestMonthName}\n+${formatCurrency(profit)}`;
    } else {
      elements.bestMonth.textContent = 'Нет данных';
    }
    
    renderMiniCharts();
    renderTopCategoriesReport();
    updateThingsReport();
  }

  // Отображение самых затратных категорий с вертикальной прокруткой
  function renderTopCategoriesReport() {
    elements.topCategoriesList.innerHTML = '';
    
    // Сортируем месяцы от текущего к прошлому
    const sortedMonths = [];
    for (let i = 0; i < 12; i++) {
      const monthIndex = (currentMonth - i + 12) % 12;
      sortedMonths.push(monthIndex);
    }

    sortedMonths.forEach(monthIndex => {
      const monthData = financeData[currentYear][monthIndex] || { categories: {} };
      const categories = Object.entries(monthData.categories);
      
      if (categories.length > 0) {
        // Сортируем категории по убыванию расходов
        categories.sort((a, b) => b[1] - a[1]);
        
        const monthElement = document.createElement('div');
        monthElement.className = 'month-categories';
        monthElement.innerHTML = `<h5>${monthNames[monthIndex]}</h5>`;
        
        // Берем топ-3 категории или все, если их меньше 3
        const topCategories = categories.slice(0, 3);
        
        // Добавляем общую сумму расходов за месяц
        const totalExpense = categories.reduce((sum, [_, amount]) => sum + amount, 0);
        const totalElement = document.createElement('div');
        totalElement.className = 'category-item total';
        totalElement.innerHTML = `
          <span>Всего расходов</span>
          <strong>${formatCurrency(totalExpense)}</strong>
        `;
        monthElement.appendChild(totalElement);
        
        topCategories.forEach(([category, amount], index) => {
          const percent = totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0;
          const categoryElement = document.createElement('div');
          categoryElement.className = 'category-item';
          categoryElement.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="color: ${categoryColors[index % categoryColors.length]}; font-weight: bold;">■</span>
              <span>${category}</span>
            </div>
            <div style="text-align: right;">
              <div>${formatCurrency(amount)}</div>
              <small style="color: ${document.body.classList.contains('dark') ? '#aaa' : '#666'}">${percent}%</small>
            </div>
          `;
          monthElement.appendChild(categoryElement);
        });
        
        elements.topCategoriesList.appendChild(monthElement);
      }
    });
  }

  // Отрисовка мини-графиков
  function renderMiniCharts() {
    const labels = monthNames.map(name => name.substring(0, 3));
    const capitalData = [];
    const expenseData = [];
    const isDark = document.body.classList.contains('dark');
    
    for (let i = 0; i < 12; i++) {
      const monthData = financeData[currentYear][i] || { income: 0, expense: 0, capital: 0 };
      capitalData.push(monthData.capital);
      expenseData.push(monthData.expense);
    }
    
    // График капитализации
    if (miniCapitalChart) miniCapitalChart.destroy();
    const capitalCtx = elements.miniCapitalChart?.getContext('2d');
    if (capitalCtx) {
      const gradient = capitalCtx.createLinearGradient(0, 0, 0, 180);
      gradient.addColorStop(0, 'rgba(52, 152, 219, 0.8)');
      gradient.addColorStop(1, 'rgba(52, 152, 219, 0.2)');
      
      miniCapitalChart = new Chart(capitalCtx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            data: capitalData,
            borderColor: gradient,
            backgroundColor: 'rgba(52, 152, 219, 0.1)',
            borderWidth: 3,
            tension: 0.3,
            fill: true,
            pointBackgroundColor: isDark ? '#1a1a1a' : '#fff',
            pointBorderColor: '#3498db',
            pointRadius: 3,
            pointHoverRadius: 5,
            pointBorderWidth: 2
          }]
        },
        options: {
          ...getChartOptions('Капитализация'),
          onClick: function(event, elements) {
            if (elements.length > 0) {
              const idx = elements[0].index;
              showChartValueModal(labels[idx], capitalData[idx]);
            }
          }
        }
      });
    }
    
    // График расходов
    if (miniExpenseChart) miniExpenseChart.destroy();
    const expenseCtx = elements.miniExpenseChart?.getContext('2d');
    if (expenseCtx) {
      const gradient = expenseCtx.createLinearGradient(0, 0, 0, 180);
      gradient.addColorStop(0, 'rgba(231, 76, 60, 0.8)');
      gradient.addColorStop(1, 'rgba(231, 76, 60, 0.2)');
      
      miniExpenseChart = new Chart(expenseCtx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            data: expenseData,
            backgroundColor: gradient,
            borderColor: 'transparent',
            borderWidth: 0,
            borderRadius: 4
          }]
        },
        options: getChartOptions('Расходы')
      });
    }
  }

  // Обновленные настройки графиков
  function getChartOptions(title) {
    const isDark = document.body.classList.contains('dark');
    const textColor = isDark ? '#eee' : '#333';
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    const tooltipBg = isDark ? '#2a2a2a' : '#fff';
    
    return {
      responsive: true,
      maintainAspectRatio: false,
      devicePixelRatio: 3,
      plugins: {
        legend: { 
          display: false,
          labels: {
            color: textColor,
            font: {
              family: "'Segoe UI', system-ui, -apple-system, sans-serif",
              size: 10
            }
          }
        },
        title: {
          display: false,
          text: title || '',
          color: textColor,
          font: {
            family: "'Segoe UI', system-ui, -apple-system, sans-serif",
            size: 14,
            weight: 'bold'
          }
        },
        tooltip: {
          backgroundColor: tooltipBg,
          titleColor: textColor,
          bodyColor: textColor,
          borderColor: isDark ? '#444' : '#ddd',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          callbacks: {
            label: function(context) {
              return `${context.dataset.label || ''}: ${context.parsed.y.toLocaleString('ru-RU')} ₽`;
            }
          },
          displayColors: false,
          titleFont: {
            family: "'Segoe UI', system-ui, -apple-system, sans-serif",
            size: 12,
            weight: 'bold'
          },
          bodyFont: {
            family: "'Segoe UI', system-ui, -apple-system, sans-serif",
            size: 12
          }
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: gridColor,
            drawBorder: false,
            lineWidth: 1
          },
          ticks: {
            color: textColor,
            font: {
              family: "'Segoe UI', system-ui, -apple-system, sans-serif",
              size: 9
            },
            padding: 3,
            callback: function(value) {
              if (value >= 1000000) {
                return (value / 1000000).toFixed(1) + 'M';
              } else if (value >= 1000) {
                return (value / 1000).toFixed(0) + 'k';
              }
              return value;
            }
          }
        },
        x: {
          grid: {
            display: false,
            drawBorder: false
          },
          ticks: {
            color: textColor,
            font: {
              family: "'Segoe UI', system-ui, -apple-system, sans-serif",
              size: 9
            },
            padding: 3,
            maxRotation: 45,
            minRotation: 45
          }
        }
      },
      elements: {
        bar: {
          borderRadius: 6,
          borderSkipped: false,
          borderWidth: 0
        },
        line: {
          tension: 0.3,
          borderWidth: 3,
          fill: true
        },
        point: {
          radius: 5,
          hoverRadius: 7,
          borderWidth: 2,
          backgroundColor: 'var(--bg)'
        }
      },
      animation: {
        duration: 1000,
        easing: 'easeOutQuart'
      },
      layout: {
        padding: {
          left: 10,
          right: 10,
          top: title ? 10 : 20,
          bottom: 10
        }
      }
    };
  }

  // Обновление интерфейса
  function updateUI() {
    const monthData = financeData[currentYear][currentMonth] || { income: 0, expense: 0, categories: {} };
    const capital = monthData.capital || 0;
    
    elements.incomeDisplay.textContent = formatCurrency(monthData.income);
    elements.expenseDisplay.textContent = formatCurrency(monthData.expense);
    elements.currentYearDisplay.textContent = `Год: ${currentYear}`;
    
    // Расчет процента остатка
    const remaining = monthData.income - monthData.expense;
    const percentage = monthData.income > 0 
        ? Math.round((remaining / monthData.income) * 100)
        : 0;
    
    elements.percentDisplay.textContent = (remaining < 0 ? '-' : '') + Math.abs(percentage) + '%';
    
    if (remaining < 0) {
        elements.percentDisplay.classList.add('negative');
    } else {
        elements.percentDisplay.classList.remove('negative');
        elements.percentDisplay.style.color = percentage < 20 ? '#f39c12' : '#2ecc71';
    }
    
    elements.capitalDisplay.textContent = formatCurrency(capital);
    
    // Обновление виджета бюджета
    updateBudgetWidget();
    
    // Обновление финансовых показателей
    updateFinancialMetrics();
    
    // Отрисовка всех графиков
    renderAllCharts();

    // Отрисовка виджетов категорий
    renderWidgets();

    // Отрисовка виджетов накоплений
    renderSavingsWidgets();
    
    // Отрисовка виджетов фондов
    renderFundWidgets();
    
    // Применить сохранённый порядок виджетов (drag-and-drop)
    if (typeof applyWidgetOrder === 'function') {
      applyWidgetOrder();
    }
    
    // Отрисовка истории трат
    renderExpenseHistory();
    
    // Отрисовка графиков динамики категорий
    renderCategoryTrends();
  }

  // Отрисовка всех графиков
  function renderAllCharts() {
    renderChart();
    renderMiniCharts();
    if (elements.yearSummary.classList.contains('show')) {
      renderYearCharts();
    }
  }

  // Отрисовка виджетов категорий
  function renderWidgets() {
    elements.widgetsContainer.innerHTML = '';
    const monthData = financeData[currentYear][currentMonth];
    const categories = monthData.categories || {};
    
    Object.entries(categories).forEach(([cat, val], index) => {
      const widget = document.createElement('div');
      widget.className = 'neumorphic-card widget';
      const color = categoryColors[index % categoryColors.length];
      
      widget.style.setProperty('--widget-color', color);
      widget.dataset.category = cat;
      
      widget.innerHTML = `
        <div class="widget-header">
          <h3 style="color: ${color}">${cat}</h3>
          <div class="widget-actions">
            <button class="delete-widget-btn" data-category="${cat}">×</button>
          </div>
        </div>
        <p>${formatCurrency(val)}</p>
        <div class="widget-input-group">
          <input type="number" class="neumorphic-input widget-input" placeholder="Сумма" id="expense-${cat}">
          <div class="widget-btn-stack">
            <button class="note-btn" data-category="${cat}" title="Записать что купил">📝</button>
            <button class="neumorphic-btn small" data-category="${cat}">+</button>
          </div>
        </div>
      `;
      
      elements.widgetsContainer.appendChild(widget);
    });

    // Добавляем обработчики для кнопок удаления
    document.querySelectorAll('.delete-widget-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const category = this.getAttribute('data-category');
        deleteWidget(category);
      });
    });

    document.querySelectorAll('.widget-input-group .neumorphic-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const category = this.getAttribute('data-category');
        addExpenseToCategory(category);
      });
    });

    // Обработчик кнопки заметки 📝
    document.querySelectorAll('.widget-input-group .note-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const category = this.getAttribute('data-category');
        const input = document.getElementById('expense-' + category);
        const amount = parseFloat((input.value || '').replace(/\s/g, '').replace(',', '.'));
        if (!amount || amount <= 0) {
          showSuccessMessage('Сначала введите сумму');
          return;
        }
        showThingModal(category, amount);
      });
    });

    // Добавляем обработчики кликов для активации падения интерфейса
    document.querySelectorAll('.widget:not(.savings-widget):not(.fund-widget)').forEach(widget => {
      widget.addEventListener('click', function() {
        widgetClickCount++;
        if (widgetClickCount >= 15) {
          if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200, 100, 200]);
          }
          triggerFallAnimation();
          widgetClickCount = 0;
        }
      });
    });
  }

  // Отрисовка всех виджетов накоплений
  function renderSavingsWidgets() {
    document.querySelectorAll('.savings-widget').forEach(widget => widget.remove());
    
    savingsWidgets.forEach(widget => {
      const widgetElement = document.createElement('div');
      widgetElement.className = 'neumorphic-card widget savings-widget';
      widgetElement.dataset.widgetId = widget.id;
      widgetElement.style.setProperty('--widget-color', widget.color);
      
      const progress = widget.goal > 0 
        ? Math.min(100, Math.round((widget.current / widget.goal) * 100)) 
        : 0;
      
      widgetElement.innerHTML = `
        <button class="delete-widget-btn" data-widget-id="${widget.id}">×</button>
        <h3 style="color: ${widget.color}">${widget.name}</h3>
        <div class="savings-progress-container">
          <div class="savings-progress-bar" style="width: ${progress}%"></div>
        </div>
        <p>${formatCurrency(widget.current)} / ${formatCurrency(widget.goal)} (${progress}%)</p>
        <div class="widget-input-group">
          <input type="number" class="neumorphic-input widget-input savings-amount" 
                placeholder="Сумма" data-widget-id="${widget.id}">
          <button class="neumorphic-btn small add-savings-btn" 
                  data-widget-id="${widget.id}">+</button>
        </div>
      `;
      
      elements.widgetsContainer.prepend(widgetElement);
      
      widgetElement.querySelector('.add-savings-btn').addEventListener('click', addToSavings);
      widgetElement.querySelector('.delete-widget-btn').addEventListener('click', deleteSavingsWidget);
    });
  }

  // Отрисовка всех виджетов фондов
  function renderFundWidgets() {
    document.querySelectorAll('.fund-widget').forEach(widget => widget.remove());
    
    fundWidgets.forEach(widget => {
      const widgetElement = document.createElement('div');
      widgetElement.className = 'neumorphic-card widget fund-widget';
      widgetElement.dataset.widgetId = widget.id;
      widgetElement.style.setProperty('--widget-color', widget.color);
      
      const spent = widget.initialAmount - widget.current;
      const progress = widget.initialAmount > 0 
        ? Math.min(100, Math.round((spent / widget.initialAmount) * 100)) 
        : 0;
      
      widgetElement.innerHTML = `
        <button class="delete-widget-btn" data-widget-id="${widget.id}">×</button>
        <h3 style="color: ${widget.color}">${widget.name}</h3>
        <div class="savings-progress-container">
          <div class="savings-progress-bar" style="width: ${progress}%"></div>
        </div>
        <p>Использовано: ${formatCurrency(spent)} / ${formatCurrency(widget.initialAmount)} (${progress}%)</p>
        <p>Остаток: ${formatCurrency(widget.current)}</p>
        <div class="widget-input-group">
          <input type="number" class="neumorphic-input widget-input fund-amount" 
                placeholder="Сумма расхода" data-widget-id="${widget.id}">
          <button class="neumorphic-btn small add-fund-btn" 
                  data-widget-id="${widget.id}">-</button>
        </div>
      `;
      
      elements.widgetsContainer.prepend(widgetElement);
      
      widgetElement.querySelector('.add-fund-btn').addEventListener('click', subtractFromFund);
      widgetElement.querySelector('.delete-widget-btn').addEventListener('click', deleteFundWidget);
    });
  }

  // Добавление средств к накоплениям
  function addToSavings() {
    const widgetId = this.dataset.widgetId;
    const input = document.querySelector(`.savings-amount[data-widget-id="${widgetId}"]`);
    const amount = parseFloat(input.value.replace(/\s+/g, '').replace(',', '.'));
    
    if (!isNaN(amount) && amount > 0) {
      const widgetIndex = savingsWidgets.findIndex(w => w.id === widgetId);
      if (widgetIndex !== -1) {
        savingsWidgets[widgetIndex].current += amount;
        markDataChanged(); // Сохраняем изменение
        
        updateSingleWidget(widgetId);
        
        input.value = '';
        this.classList.add('pulse');
        setTimeout(() => this.classList.remove('pulse'), 500);
      }
    }
  }

  // Вычитание из фонда
  function subtractFromFund() {
    const widgetId = this.dataset.widgetId;
    const input = document.querySelector(`.fund-amount[data-widget-id="${widgetId}"]`);
    const amount = parseFloat(input.value.replace(/\s+/g, '').replace(',', '.'));
    
    if (!isNaN(amount) && amount > 0) {
      const widgetIndex = fundWidgets.findIndex(w => w.id === widgetId);
      if (widgetIndex !== -1 && fundWidgets[widgetIndex].current >= amount) {
        fundWidgets[widgetIndex].current -= amount;
        markDataChanged(); // Сохраняем изменение
        
        updateSingleFundWidget(widgetId);
        
        input.value = '';
        this.classList.add('pulse');
        setTimeout(() => this.classList.remove('pulse'), 500);
      } else if (widgetIndex !== -1) {
        alert('Недостаточно средств в фонде!');
      }
    }
  }

  // Удаление виджета накоплений
  function deleteSavingsWidget() {
    const widgetId = this.dataset.widgetId;
    if (confirm('Удалить этот виджет накоплений?')) {
      savingsWidgets = savingsWidgets.filter(w => w.id !== widgetId);
      markDataChanged(); // Сохраняем изменение
      document.querySelector(`.savings-widget[data-widget-id="${widgetId}"]`).remove();
    }
  }

  // Удаление виджета фонда
  function deleteFundWidget() {
    const widgetId = this.dataset.widgetId;
    if (confirm('Удалить этот фонд?')) {
      fundWidgets = fundWidgets.filter(w => w.id !== widgetId);
      markDataChanged(); // Сохраняем изменение
      document.querySelector(`.fund-widget[data-widget-id="${widgetId}"]`).remove();
    }
  }

  // Обновление одного виджета накоплений
  function updateSingleWidget(widgetId) {
    const widgetData = savingsWidgets.find(w => w.id === widgetId);
    if (!widgetData) return;
    
    const widgetElement = document.querySelector(`.savings-widget[data-widget-id="${widgetId}"]`);
    if (!widgetElement) return;
    
    const progress = widgetData.goal > 0 
      ? Math.min(100, Math.round((widgetData.current / widgetData.goal) * 100)) 
      : 0;
    
    widgetElement.querySelector('.savings-progress-bar').style.width = `${progress}%`;
    widgetElement.querySelector('p').textContent = 
      `${formatCurrency(widgetData.current)} / ${formatCurrency(widgetData.goal)} (${progress}%)`;
  }

  // Обновление одного виджета фонда
  function updateSingleFundWidget(widgetId) {
    const widgetData = fundWidgets.find(w => w.id === widgetId);
    if (!widgetData) return;
    
    const widgetElement = document.querySelector(`.fund-widget[data-widget-id="${widgetId}"]`);
    if (!widgetElement) return;
    
    const spent = widgetData.initialAmount - widgetData.current;
    const progress = widgetData.initialAmount > 0 
      ? Math.min(100, Math.round((spent / widgetData.initialAmount) * 100)) 
      : 0;
    
    widgetElement.querySelector('.savings-progress-bar').style.width = `${progress}%`;
    widgetElement.querySelectorAll('p')[0].textContent = 
      `Использовано: ${formatCurrency(spent)} / ${formatCurrency(widgetData.initialAmount)} (${progress}%)`;
    widgetElement.querySelectorAll('p')[1].textContent = 
      `Остаток: ${formatCurrency(widgetData.current)}`;
  }

  // Создание нового виджета накоплений
  function createNewSavingsWidget(name = '', goal = 0, current = 0) {
    const widgetId = Date.now().toString();
    
    const newWidget = {
      id: widgetId,
      name: name || `Накопления ${savingsWidgets.length + 1}`,
      goal: goal || 0,
      current: current || 0,
      color: getRandomWidgetColor()
    };
    
    savingsWidgets.push(newWidget);
    markDataChanged(); // Сохраняем изменение
    
    renderSavingsWidgets();
  }

  // Создание нового виджета фонда
  function createNewFundWidget(name = '', amount = 0, current = null) {
    const widgetId = Date.now().toString();
    const initialAmount = current !== null ? current : amount;
    
    const newWidget = {
      id: widgetId,
      name: name || `Фонд ${fundWidgets.length + 1}`,
      initialAmount: amount,
      current: initialAmount,
      color: getRandomWidgetColor()
    };
    
    fundWidgets.push(newWidget);
    markDataChanged(); // Сохраняем изменение
    renderFundWidgets();
  }

  // Генерация случайного цвета для виджета
  function getRandomWidgetColor() {
    const colors = ['#2ecc71', '#3498db', '#9b59b6', '#f1c40f', '#e67e22', '#e74c3c'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // Удаление виджета категории
  function deleteWidget(category) {
    if (confirm(`Удалить категорию "${category}" только для текущего месяца?`)) {
      const monthData = financeData[currentYear][currentMonth];
      const categoryExpense = monthData.categories[category] || 0;
      
      monthData.expense -= categoryExpense;
      delete monthData.categories[category];
      
      markDataChanged(); // Сохраняем изменение
      updateUI();
    }
  }

  // Добавление расхода к категории
  function addExpenseToCategory(category) {
    const input = document.getElementById(`expense-${category}`);
    const expenseVal = parseFloat(input.value.replace(/\s+/g, '').replace(',', '.'));
    const monthData = financeData[currentYear][currentMonth];

    if (!isNaN(expenseVal) && expenseVal > 0) {
      monthData.expense += expenseVal;
      monthData.categories[category] = (monthData.categories[category] || 0) + expenseVal;
      
      // Добавляем в историю
      monthData.expensesHistory.push({
        category: category,
        amount: expenseVal,
        date: new Date().toLocaleString()
      });
      
      input.value = '';
      
      markDataChanged(); // Сохраняем изменение
      
      // Обновляем дневные траты в бюджете
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      if (budgetData.startDate && budgetData.dailyHistory[todayStr]) {
        budgetData.dailyHistory[todayStr].spentToday += expenseVal;
        markDataChanged(); // Сохраняем изменение
      }
      
      updateUI();
      
      const btn = input.nextElementSibling;
      btn.classList.add('pulse');
      setTimeout(() => btn.classList.remove('pulse'), 500);
    }
  }

  // Отрисовка основного графика расходов
  function renderChart() {
    const ctx = document.getElementById('barChart')?.getContext('2d');
    if (!ctx) return;
    if (chart) chart.destroy();

    const monthData = financeData[currentYear][currentMonth];
    const categoryNames = Object.keys(monthData.categories);
    const values = Object.values(monthData.categories);
    const isDark = document.body.classList.contains('dark');

    const backgroundColors = categoryNames.map((_, index) => {
      const color = categoryColors[index % categoryColors.length];
      const gradient = ctx.createLinearGradient(0, 0, 0, 300);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, shadeColor(color, -30));
      return gradient;
    });

    const shadowColor = isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.1)';

    chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: categoryNames,
        datasets: [{
          label: 'Расходы',
          data: values,
          backgroundColor: backgroundColors,
          borderColor: 'transparent',
          borderWidth: 0,
          borderRadius: 6,
          borderSkipped: false,
          shadowOffsetX: 3,
          shadowOffsetY: 3,
          shadowBlur: 5,
          shadowColor: shadowColor
        }]
      },
      options: getChartOptions('Расходы по категориям')
    });
  }

  // Отрисовка годовых графиков
  function renderYearCharts() {
    const labels = monthNames;
    const incomeData = [];
    const expenseData = [];
    const capitalData = [];
    
    for (let i = 0; i < 12; i++) {
      const monthData = financeData[currentYear][i] || { income: 0, expense: 0, capital: 0 };
      incomeData.push(monthData.income);
      expenseData.push(monthData.expense);
      capitalData.push(monthData.capital);
    }
    
    // График доходов
    const incomeCtx = document.getElementById('yearIncomeChart')?.getContext('2d');
    if (incomeCtx) {
      if (yearIncomeChart) yearIncomeChart.destroy();
      
      yearIncomeChart = new Chart(incomeCtx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Доход',
            data: incomeData,
            backgroundColor: 'rgba(46, 204, 113, 0.7)',
            borderColor: 'rgba(46, 204, 113, 1)',
            borderWidth: 2,
            borderRadius: 5,
            borderSkipped: false,
          }]
        },
        options: getYearChartOptions('Доход по месяцам')
      });
    }
    
    // График расходов
    const expenseCtx = document.getElementById('yearExpenseChart')?.getContext('2d');
    if (expenseCtx) {
      if (yearExpenseChart) yearExpenseChart.destroy();
      
      yearExpenseChart = new Chart(expenseCtx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Расход',
            data: expenseData,
            backgroundColor: 'rgba(231, 76, 60, 0.7)',
            borderColor: 'rgba(231, 76, 60, 1)',
            borderWidth: 2,
            borderRadius: 5,
            borderSkipped: false,
          }]
        },
        options: getYearChartOptions('Расход по месяцам')
      });
    }
    
    // График капитализации
    const capitalCtx = document.getElementById('yearCapitalChart')?.getContext('2d');
    if (capitalCtx) {
      if (yearCapitalChart) yearCapitalChart.destroy();
      
      yearCapitalChart = new Chart(capitalCtx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Капитализация',
            data: capitalData,
            backgroundColor: 'rgba(52, 152, 219, 0.2)',
            borderColor: 'rgba(52, 152, 219, 1)',
            borderWidth: 3,
            tension: 0.3,
            fill: true,
            pointBackgroundColor: 'rgba(52, 152, 219, 1)',
            pointRadius: 5,
            pointHoverRadius: 7
          }]
        },
        options: getYearChartOptions('Капитализация по месяцам')
      });
    }
  }
  
  // Настройки годовых графиков
  function getYearChartOptions(title) {
    const options = getChartOptions(title);
    options.plugins.title.display = true;
    options.plugins.title.font.size = 16;
    return options;
  }

  // Затемнение цвета
  function shadeColor(color, percent) {
    let R = parseInt(color.substring(1,3), 16);
    let G = parseInt(color.substring(3,5), 16);
    let B = parseInt(color.substring(5,7), 16);

    R = parseInt(R * (100 + percent) / 100);
    G = parseInt(G * (100 + percent) / 100);
    B = parseInt(B * (100 + percent) / 100);

    R = (R<255)?R:255;  
    G = (G<255)?G:255;  
    B = (B<255)?B:255;  

    const RR = ((R.toString(16).length==1)?"0"+R.toString(16):R.toString(16));
    const GG = ((G.toString(16).length==1)?"0"+G.toString(16):G.toString(16));
    const BB = ((B.toString(16).length==1)?"0"+B.toString(16):B.toString(16));

    return "#"+RR+GG+BB;
  }

  // Показать сообщение об успехе
  function showSuccessMessage(message) {
    const successMsg = document.createElement('div');
    successMsg.className = 'success-message';
    successMsg.textContent = message;
    document.body.appendChild(successMsg);
    
    setTimeout(() => {
      successMsg.classList.add('show');
    }, 100);
    
    setTimeout(() => {
      successMsg.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(successMsg);
      }, 500);
    }, 3000);
  }

  // Обновление виджета бюджета
  function updateBudgetWidget() {
    if (!budgetData.startDate) {
      elements.dailyBudgetAmount.textContent = formatCurrency(0);
      elements.budgetProgress.textContent = 'Не задано';
      if (elements.daysProgressBar) elements.daysProgressBar.style.width = '100%';
      if (elements.fundsProgressBar) elements.fundsProgressBar.style.width = '100%';
      if (elements.daysProgressValue) elements.daysProgressValue.textContent = '100%';
      if (elements.fundsProgressValue) elements.fundsProgressValue.textContent = '100%';
      return;
    }

    const today = new Date();
    const startDate = new Date(budgetData.startDate);
    const todayStr = today.toISOString().split('T')[0];
    
    if (today.getMonth() !== startDate.getMonth() || 
        today.getFullYear() !== startDate.getFullYear()) {
      elements.dailyBudgetAmount.textContent = formatCurrency(0);
      elements.budgetProgress.textContent = 'Срок истек';
      if (elements.daysProgressBar) elements.daysProgressBar.style.width = '0%';
      if (elements.fundsProgressBar) elements.fundsProgressBar.style.width = '0%';
      if (elements.daysProgressValue) elements.daysProgressValue.textContent = '0%';
      if (elements.fundsProgressValue) elements.fundsProgressValue.textContent = '0%';
      return;
    }

    const elapsedDays = Math.floor((today - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const remainingDays = Math.max(0, budgetData.days - elapsedDays + 1);
    
    if (remainingDays <= 0) {
      elements.dailyBudgetAmount.textContent = formatCurrency(0);
      elements.budgetProgress.textContent = 'Срок истек';
      if (elements.daysProgressBar) elements.daysProgressBar.style.width = '0%';
      if (elements.fundsProgressBar) elements.fundsProgressBar.style.width = '0%';
      if (elements.daysProgressValue) elements.daysProgressValue.textContent = '0%';
      if (elements.fundsProgressValue) elements.fundsProgressValue.textContent = '0%';
      return;
    }

    let remainingAmount = budgetData.totalAmount;
    let totalSpent = 0;
    
    for (let i = 0; i < elapsedDays; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      if (budgetData.dailyHistory[dateStr]) {
        const dailySpent = budgetData.dailyHistory[dateStr].spentToday;
        remainingAmount -= dailySpent;
        totalSpent += dailySpent;
      }
    }

    if (remainingAmount <= 0) {
      elements.dailyBudgetAmount.textContent = formatCurrency(0);
      elements.budgetProgress.textContent = 'Бюджет исчерпан';
      const daysProgress = 100 - (elapsedDays / budgetData.days * 100);
      if (elements.daysProgressBar) elements.daysProgressBar.style.width = `${Math.max(0, daysProgress)}%`;
      if (elements.fundsProgressBar) elements.fundsProgressBar.style.width = '0%';
      if (elements.daysProgressValue) elements.daysProgressValue.textContent = `${Math.round(Math.max(0, daysProgress))}%`;
      if (elements.fundsProgressValue) elements.fundsProgressValue.textContent = '0%';
      return;
    }

    const dailyBudget = remainingAmount / remainingDays;
    
    elements.dailyBudgetAmount.textContent = formatCurrency(dailyBudget);
    elements.budgetProgress.textContent = 
        `Остаток: ${formatCurrency(remainingAmount)} | ${remainingDays} дн.`;
    
    const daysProgress = 100 - (elapsedDays / budgetData.days * 100);
    const fundsProgress = 100 - (totalSpent / budgetData.totalAmount * 100);
    
    if (elements.daysProgressBar) elements.daysProgressBar.style.width = `${Math.max(0, daysProgress)}%`;
    if (elements.fundsProgressBar) elements.fundsProgressBar.style.width = `${Math.max(0, fundsProgress)}%`;
    if (elements.daysProgressValue) elements.daysProgressValue.textContent = `${Math.round(Math.max(0, daysProgress))}%`;
    if (elements.fundsProgressValue) elements.fundsProgressValue.textContent = `${Math.round(Math.max(0, fundsProgress))}%`;
    
    if (!budgetData.dailyHistory[todayStr]) {
      budgetData.dailyHistory[todayStr] = {
        date: todayStr,
        dailyBudget: dailyBudget,
        spentToday: 0
      };
      markDataChanged(); // Сохраняем изменение
    }
  }

  // Отрисовка истории трат
  function renderExpenseHistory() {
    elements.historyList.innerHTML = '';
    const monthData = financeData[currentYear][currentMonth];
    const history = monthData.expensesHistory || [];
    
    const sortedHistory = [...history].reverse();
    
    sortedHistory.forEach((item, index) => {
      const historyItem = document.createElement('div');
      historyItem.className = 'history-item';
      historyItem.innerHTML = `
        <div class="history-content">
          <div class="history-category">${item.category}</div>
          <div class="history-amount">${formatCurrency(item.amount)}</div>
          <div class="history-date">${item.date}</div>
        </div>
        <button class="delete-history-btn" data-index="${history.length - 1 - index}">×</button>
      `;
      elements.historyList.appendChild(historyItem);
    });

    document.querySelectorAll('.delete-history-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const index = parseInt(this.getAttribute('data-index'));
        deleteExpenseFromHistory(index);
      });
    });
  }

  // Удаление траты из истории
  function deleteExpenseFromHistory(index) {
    const monthData = financeData[currentYear][currentMonth];
    const expense = monthData.expensesHistory[index];
    
    if (expense) {
      monthData.expense -= expense.amount;
      
      if (monthData.categories[expense.category]) {
        monthData.categories[expense.category] -= expense.amount;
        
        if (monthData.categories[expense.category] <= 0) {
          delete monthData.categories[expense.category];
        }
      }
      
      monthData.expensesHistory.splice(index, 1);
      
      markDataChanged(); // Сохраняем изменение
      updateUI();
      
      showSuccessMessage(`Трата "${expense.category}" на сумму ${formatCurrency(expense.amount)} удалена`);
    }
  }

  // Выбор года
  function renderYearSelection() {
    elements.yearsList.innerHTML = '';
    
    const years = Object.keys(financeData).sort((a, b) => b - a);
    
    years.forEach(year => {
      const yearBtn = document.createElement('button');
      yearBtn.className = 'year-btn';
      yearBtn.textContent = year;
      yearBtn.addEventListener('click', () => {
        currentYear = parseInt(year);
        elements.yearSelectModal.classList.remove('show');
        updateUI();
      });
      elements.yearsList.appendChild(yearBtn);
    });
  }

  // Добавление нового года
  function addNewYear() {
    const newYear = currentYear + 1;
    if (!financeData[newYear]) {
      initYearData(newYear);
      markDataChanged(); // Сохраняем изменение
      renderYearSelection();
      showSuccessMessage(`Год ${newYear} добавлен!`);
    } else {
      showSuccessMessage(`Год ${newYear} уже существует!`);
    }
  }

  // Отрисовка графиков динамики категорий
  function renderCategoryTrends() {
    elements.trendsScroll.innerHTML = '';
    
    const monthData = financeData[currentYear][currentMonth];
    const categories = Object.keys(monthData.categories);
    
    categories.forEach(category => {
      const trendData = [];
      
      for (let i = 0; i < 12; i++) {
        const monthCatData = financeData[currentYear][i].categories || {};
        trendData.push(monthCatData[category] || 0);
      }
      
      const container = document.createElement('div');
      container.innerHTML = `<h4>${category}</h4><canvas id="trend-${category}"></canvas>`;
      elements.trendsScroll.appendChild(container);
      
      const ctx = document.getElementById(`trend-${category}`).getContext('2d');
      const color = categoryColors[categories.indexOf(category) % categoryColors.length];
      
      if (trendCharts[category]) trendCharts[category].destroy();
      
      trendCharts[category] = new Chart(ctx, {
        type: 'line',
        data: {
          labels: monthNames.map(name => name.substring(0, 3)),
          datasets: [{
            label: category,
            data: trendData,
            borderColor: color,
            backgroundColor: `${color}33`,
            borderWidth: 2,
            tension: 0.3,
            fill: true
          }]
        },
        options: {
          ...getChartOptions(''),
          aspectRatio: 1,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              display: false
            }
          }
        }
      });
    });
  }

  // Режим обучения
  function initTutorial() {
    const tutorialSteps = [
      {
        title: "Добавление дохода",
        text: "Введите сумму дохода и нажмите кнопку '+' для добавления. Эта сумма будет учтена в текущем месяце."
      },
      {
        title: "Категории расходов",
        text: "Используйте кнопку 'Категории' для управления категориями. Добавляйте расходы по категориям через виджеты."
      },
      {
        title: "Капитализация",
        text: "Кнопка 'Капитализация' позволяет установить общую сумму активов. Эта информация отображается в разделе 'Капитал'."
      },
      {
        title: "Отчёты",
        text: "В разделе 'Отчёты' вы найдете аналитику по вашим финансам: средние значения, лучший месяц и графики."
      },
      {
        title: "Дневной бюджет",
        text: "Установите бюджет на определенное количество дней. Система рассчитает дневной лимит и отследит ваши траты."
      },
      {
        title: "Накопления",
        text: "Включите виджет накоплений через меню (☰) и установите финансовую цель. Отслеживайте прогресс в виджете."
      },
      {
        title: "Фонды",
        text: "Создавайте фонды для целевых расходов. Устанавливайте начальную сумму и вычитайте расходы по мере использования."
      },
      {
        title: "Прогноз и тепловая карта",
        text: "В меню (☰) доступны 'Прогноз расходов' и 'Тепловая карта' — аналитика трендов и визуализация трат по дням."
      },
      {
        title: "Графики",
        text: "Основной график показывает распределение расходов по категориям. Ниже представлена динамика трат по категориям за год."
      }
    ];
    
    let currentStep = 0;
    
    function showTutorialStep(step) {
      elements.tutorialTitle.textContent = tutorialSteps[step].title;
      elements.tutorialText.textContent = tutorialSteps[step].text;
      elements.tutorialOverlay.style.display = 'block';
    }
    
    elements.tutorialNext.addEventListener('click', () => {
      currentStep++;
      if (currentStep >= tutorialSteps.length) {
        elements.tutorialOverlay.style.display = 'none';
      } else {
        showTutorialStep(currentStep);
      }
    });
    
    elements.tutorialPrev.addEventListener('click', () => {
      if (currentStep > 0) {
        currentStep--;
        showTutorialStep(currentStep);
      }
    });
    
    elements.tutorialClose.addEventListener('click', () => {
      elements.tutorialOverlay.style.display = 'none';
    });
    
    if (!localStorage.getItem('tutorialShown')) {
      showTutorialStep(0);
      localStorage.setItem('tutorialShown', 'true');
    }
  }

  // Функция для переключения меню
  // Закрыть все меню и модальные окна (кроме переданного)
  function closeAllMenus(except) {
    document.querySelectorAll('.neumorphic-menu, .category-widget').forEach(menu => {
      if (menu !== except) menu.classList.remove('show');
    });
    const backdrop = document.getElementById('fullscreen-backdrop');
    if (backdrop && except && !except.classList.contains('fullscreen-modal')) {
      backdrop.classList.remove('show');
    }
  }

  function toggleMenu(menuElement) {
    const isOpening = !menuElement.classList.contains('show');

    // Закрываем все остальные меню перед открытием нового
    closeAllMenus(isOpening ? menuElement : null);

    menuElement.classList.toggle('show');

    if (menuElement.classList.contains('show')) {
      document.body.classList.add('menu-open');
    } else {
      document.body.classList.remove('menu-open');
    }
  }

  // Функция для открытия полноэкранных модальных окон
  function openFullscreenModal(modalElement) {
    // Закрыть все другие меню и модальные окна
    closeAllMenus(modalElement);
    
    // Показать затемнение фона
    const backdrop = document.getElementById('fullscreen-backdrop');
    if (backdrop) {
      backdrop.classList.add('show');
    }
    
    // Добавить класс полноэкранного режима и показать модальное окно
    modalElement.classList.add('fullscreen-modal', 'show');
    document.body.classList.add('menu-open');
    
    // Заблокировать прокрутку основного контента
    document.getElementById('scrollable').style.overflow = 'hidden';
  }

  // Функция для закрытия полноэкранных модальных окон
  function closeFullscreenModal() {
    // Скрыть все модальные окна
    document.querySelectorAll('.neumorphic-menu').forEach(menu => {
      menu.classList.remove('show', 'fullscreen-modal');
    });
    
    // Скрыть затемнение фона
    const backdrop = document.getElementById('fullscreen-backdrop');
    if (backdrop) {
      backdrop.classList.remove('show');
    }
    
    document.body.classList.remove('menu-open');
    
    // Разблокировать прокрутку основного контента
    document.getElementById('scrollable').style.overflow = 'auto';
  }

  // Показать слайдер сброса
  function showResetSlider() {
    const modal = document.createElement('div');
    modal.className = 'reset-modal';
    modal.innerHTML = `
      <div class="reset-slider-container">
        <h3>Сбросить все данные</h3>
        <p>Проведите пальцем вправо для подтверждения</p>
        <div class="slider-track">
          <div class="slider-thumb">→</div>
          <div class="slider-progress"></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    const thumb = modal.querySelector('.slider-thumb');
    const track = modal.querySelector('.slider-track');
    const progress = modal.querySelector('.slider-progress');
    let isDragging = false;
    let startX = 0;
    let currentX = 0;
    
    thumb.addEventListener('mousedown', startDrag);
    thumb.addEventListener('touchstart', startDrag);
    
    function startDrag(e) {
      isDragging = true;
      startX = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX;
      currentX = startX;
      document.addEventListener('mousemove', drag);
      document.addEventListener('touchmove', drag);
      document.addEventListener('mouseup', endDrag);
      document.addEventListener('touchend', endDrag);
      e.preventDefault();
    }
    
    function drag(e) {
      if (!isDragging) return;
      const x = e.type === 'mousemove' ? e.clientX : e.touches[0].clientX;
      const rect = track.getBoundingClientRect();
      let newX = x - rect.left;
      
      newX = Math.max(0, Math.min(newX, rect.width));
      
      thumb.style.left = `${newX}px`;
      progress.style.width = `${newX}px`;
      currentX = x;
      
      if (newX >= rect.width * 0.9) {
        endDrag();
        resetApp();
      }
    }
    
    function endDrag() {
      if (!isDragging) return;
      isDragging = false;
      document.removeEventListener('mousemove', drag);
      document.removeEventListener('touchmove', drag);
      document.removeEventListener('mouseup', endDrag);
      document.removeEventListener('touchend', endDrag);
      
      thumb.style.left = '0';
      progress.style.width = '0';
    }
    
    function resetApp() {
      document.body.removeChild(modal);
      
      localStorage.clear();
      financeData = {};
      savingsWidgets = [];
      fundWidgets = [];
      budgetData = {
        totalAmount: 0,
        days: 0,
        startDate: null,
        spent: 0,
        dailyHistory: {}
      };
      
      initYearData(currentYear);
      
      showSuccessMessage('Все данные сброшены!');
      updateUI();
    }
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
  }

  // Настройка обработчиков событий
  function setupEventHandlers() {
    // Добавление дохода
    elements.addIncomeBtn.addEventListener('click', () => {
      const incomeVal = parseFloat(elements.incomeInput.value.replace(/\s+/g, '').replace(',', '.'));
      const monthData = financeData[currentYear][currentMonth];

      if (!isNaN(incomeVal)) {
        monthData.income += incomeVal;
        elements.incomeInput.value = '';
        markDataChanged(); // Сохраняем изменение
        updateUI();
        
        elements.addIncomeBtn.classList.add('pulse');
        setTimeout(() => elements.addIncomeBtn.classList.remove('pulse'), 500);
      }
    });

    // Добавление категории
    elements.addCategoryBtn.addEventListener('click', () => {
      const categoryName = elements.newCategoryInput.value.trim();
      if (categoryName) {
        for (let i = 0; i < 12; i++) {
          const monthData = financeData[currentYear][i];
          if (!monthData.categories[categoryName]) {
            monthData.categories[categoryName] = 0;
          }
        }
        elements.newCategoryInput.value = '';
        markDataChanged(); // Сохраняем изменение
        updateUI();
      }
    });

    // Меню категорий
    elements.categoryBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu(elements.categoryMenu);
    });

    // Закрытие виджета категорий
    elements.closeCategoryWidget.addEventListener('click', () => {
      elements.categoryMenu.classList.remove('show');
    });

    // Капитализация
    elements.capitalizationBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu(elements.capitalizationMenu);
    });

    elements.saveCapitalBtn.addEventListener('click', () => {
      const capitalVal = parseFloat(elements.capitalInput.value.replace(/\s+/g, '').replace(',', '.'));
      if (!isNaN(capitalVal)) {
        financeData[currentYear][currentMonth].capital = capitalVal;
        markDataChanged(); // Сохраняем изменение
        updateUI();
        elements.capitalizationMenu.classList.remove('show');
      }
    });

    elements.cancelCapitalBtn.addEventListener('click', () => {
      elements.capitalizationMenu.classList.remove('show');
    });

    // Настройки/отчеты - полноэкранный режим
    elements.settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openFullscreenModal(elements.settingsMenu);
    });

    elements.closeReportsBtn.addEventListener('click', () => {
      closeFullscreenModal();
    });

    // Бюджет
    elements.budgetSettingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu(elements.setBudgetModal);
    });

    elements.saveBudgetBtn.addEventListener('click', () => {
      const amount = parseFloat(elements.budgetAmount.value.replace(/\s+/g, '').replace(',', '.'));
      const days = parseInt(elements.budgetDays.value);
      
      if (!isNaN(amount) && !isNaN(days) && days > 0) {
        const today = new Date();
        budgetData = {
          totalAmount: amount,
          days: days,
          startDate: today.toISOString(),
          spent: 0,
          dailyHistory: {
            [today.toISOString().split('T')[0]]: {
              date: today.toISOString().split('T')[0],
              dailyBudget: amount / days,
              spentToday: 0
            }
          }
        };
        markDataChanged(); // Сохраняем изменение
        elements.setBudgetModal.classList.remove('show');
        updateBudgetWidget();
        
        showSuccessMessage('Бюджет установлен!');
      }
    });

    elements.cancelBudgetBtn.addEventListener('click', () => {
      elements.setBudgetModal.classList.remove('show');
    });

    // Дополнительное меню
    elements.moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu(elements.moreMenu);
    });

    // Переключение темы
    elements.themeToggleBtn.addEventListener('click', toggleTheme);

    // Виджет накоплений
    elements.enableSavingsBtn.addEventListener('click', () => {
      elements.moreMenu.classList.remove('show');
      toggleMenu(elements.savingsModal);
      
      elements.savingsName.value = '';
      elements.savingsGoal.value = '';
    });

    elements.saveSavingsBtn.addEventListener('click', () => {
      const name = elements.savingsName.value.trim() || `Накопления ${savingsWidgets.length + 1}`;
      const goal = parseFloat(elements.savingsGoal.value.replace(/\s+/g, '').replace(',', '.'));
      
      createNewSavingsWidget(name, goal, 0);
      elements.savingsModal.classList.remove('show');
    });

    elements.cancelSavingsBtn.addEventListener('click', () => {
      elements.savingsModal.classList.remove('show');
    });

    // Виджет фондов
    elements.enableFundBtn.addEventListener('click', () => {
      elements.moreMenu.classList.remove('show');
      toggleMenu(elements.fundModal);
      elements.fundName.value = '';
      elements.fundAmount.value = '';
    });

    elements.saveFundBtn.addEventListener('click', () => {
      const name = elements.fundName.value.trim() || `Фонд ${fundWidgets.length + 1}`;
      const amount = parseFloat(elements.fundAmount.value.replace(/\s+/g, '').replace(',', '.'));
      
      if (!isNaN(amount) && amount > 0) {
        createNewFundWidget(name, amount, amount);
        elements.fundModal.classList.remove('show');
      }
    });

    elements.cancelFundBtn.addEventListener('click', () => {
      elements.fundModal.classList.remove('show');
    });

    // Переключение месяцев
    elements.monthTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        elements.monthTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentMonth = parseInt(tab.dataset.month);
        updateUI();
      });
    });

    // Выбор года
    elements.yearSelectBtn.addEventListener('click', () => {
      elements.moreMenu.classList.remove('show');
      toggleMenu(elements.yearSelectModal);
      renderYearSelection();
    });

    elements.addYearBtn.addEventListener('click', addNewYear);
    
    elements.closeYearSelect.addEventListener('click', () => {
      elements.yearSelectModal.classList.remove('show');
    });

    // История трат - полноэкранный режим
    elements.historyBtn.addEventListener('click', () => {
      elements.moreMenu.classList.remove('show');
      openFullscreenModal(elements.historyModal);
    });
    
    elements.closeHistory.addEventListener('click', () => {
      closeFullscreenModal();
    });

    // Кнопка сброса данных
    elements.resetBtn.addEventListener('click', () => {
      elements.moreMenu.classList.remove('show');
      showResetSlider();
    });

    // Годовой отчёт
    if (elements.closeYearSummary) {
      elements.closeYearSummary.addEventListener('click', () => {
        elements.yearSummary.classList.remove('show');
      });
    }

    // Перенос данных - упрощённая версия
    elements.transferDataBtn.addEventListener('click', () => {
      elements.moreMenu.classList.remove('show');
      openFullscreenModal(elements.transferDataModal);
    });

    // Прогноз расходов - полноэкранный режим
    if (elements.forecastBtn) {
      elements.forecastBtn.addEventListener('click', () => {
        elements.moreMenu.classList.remove('show');
        openFullscreenModal(elements.forecastModal);
        renderForecast();
      });
    }
    if (elements.closeForecast) {
      elements.closeForecast.addEventListener('click', () => {
        closeFullscreenModal();
      });
    }

    // Тепловая карта расходов - полноэкранный режим
    if (elements.heatmapBtn) {
      elements.heatmapBtn.addEventListener('click', () => {
        elements.moreMenu.classList.remove('show');
        openFullscreenModal(elements.heatmapModal);
        renderHeatmap();
      });
    }
    if (elements.closeHeatmap) {
      elements.closeHeatmap.addEventListener('click', () => {
        closeFullscreenModal();
      });
    }

    // Редактирование виджетов (drag-and-drop) - полноэкранный режим
    if (elements.editWidgetsBtn) {
      elements.editWidgetsBtn.addEventListener('click', () => {
        elements.moreMenu.classList.remove('show');
        openFullscreenModal(elements.editWidgetsModal);
        renderDraggableWidgetsList();
      });
    }
    if (elements.closeEditWidgets) {
      elements.closeEditWidgets.addEventListener('click', () => {
        closeFullscreenModal();
      });
    }
    if (elements.saveWidgetsOrderBtn) {
      elements.saveWidgetsOrderBtn.addEventListener('click', () => {
        saveWidgetsOrderFromList();
        closeFullscreenModal();
        showSuccessMessage('Порядок виджетов сохранён');
      });
    }

    // Закрытие по клику на затемненный фон
    const backdrop = document.getElementById('fullscreen-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', closeFullscreenModal);
    }

    // Закрытие по клавише Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeFullscreenModal();
      }
    });

    // Закрытие меню при клике вне их
    document.addEventListener('click', (e) => {
      const menus = [
        elements.categoryMenu,
        elements.capitalizationMenu,
        elements.settingsMenu,
        elements.setBudgetModal,
        elements.moreMenu,
        elements.savingsModal,
        elements.fundModal,
        elements.yearSelectModal,
        elements.historyModal,
        elements.transferDataModal
      ];
      
      const clickOutside = !menus.some(menu => menu && menu.contains(e.target));
      
      const isMenuButton = [
        elements.categoryBtn,
        elements.capitalizationBtn,
        elements.settingsBtn,
        elements.budgetSettingsBtn,
        elements.moreBtn,
        elements.enableSavingsBtn,
        elements.enableFundBtn,
        elements.yearSelectBtn,
        elements.historyBtn,
        elements.resetBtn,
        elements.transferDataBtn
      ].some(button => button && button.contains(e.target));
      
      if (clickOutside && !isMenuButton) {
        menus.forEach(menu => menu && menu.classList.remove('show'));
        document.body.classList.remove('menu-open');
      }
    });

    // Запрет масштабирования
    document.addEventListener('gesturestart', function(e) {
      e.preventDefault();
    });

    // Обработчики ввода по Enter
    const enterHandlers = [
      { element: elements.incomeInput, handler: elements.addIncomeBtn },
      { element: elements.newCategoryInput, handler: elements.addCategoryBtn },
      { element: elements.capitalInput, handler: elements.saveCapitalBtn },
      { element: elements.budgetAmount, handler: elements.saveBudgetBtn },
      { element: elements.budgetDays, handler: elements.saveBudgetBtn },
      { element: elements.savingsName, handler: elements.saveSavingsBtn },
      { element: elements.savingsGoal, handler: elements.saveSavingsBtn },
      { element: elements.fundName, handler: elements.saveFundBtn },
      { element: elements.fundAmount, handler: elements.saveFundBtn }
    ];

    enterHandlers.forEach(item => {
      item.element.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          item.handler.click();
        }
      });
    });
  }

  // ==================== УЛУЧШЕННАЯ ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ====================

  function adjustHeaderButtons() {
    const headerButtons = document.querySelector('.header-buttons');
    const buttons = headerButtons.querySelectorAll('.neumorphic-btn.small');
    
    let totalWidth = 0;
    buttons.forEach(btn => {
      totalWidth += btn.offsetWidth + 6;
    });
    
    if (totalWidth > headerButtons.offsetWidth) {
      headerButtons.style.overflowX = 'auto';
      headerButtons.style.justifyContent = 'flex-start';
    } else {
      headerButtons.style.overflowX = 'hidden';
      headerButtons.style.justifyContent = 'center';
    }
  }

  function initializeApp() {
    
    // Инициализация упрощённого модуля переноса данных
    initTransferDataModule();
    
    // Установка активного месяца
    elements.monthTabs[currentMonth].classList.add('active');
    
    // Проверка бюджета
    if (budgetData.startDate) {
      const today = new Date();
      const lastBudgetDate = new Date(budgetData.startDate);
      
      if (today.getDate() !== lastBudgetDate.getDate() || 
          today.getMonth() !== lastBudgetDate.getMonth() || 
          today.getFullYear() !== lastBudgetDate.getFullYear()) {
        updateBudgetWidget();
      }
    }
    
    // Настройка темы
    if (localStorage.getItem('darkTheme') === 'true') {
      document.body.classList.add('dark');
      elements.themeToggleBtn.innerHTML = '<span class="theme-icon">☀️</span> Сменить тему';
    } else {
      elements.themeToggleBtn.innerHTML = '<span class="theme-icon">🌙</span> Сменить тему';
    }
    
    // Обработчик изменения ориентации устройства
    window.addEventListener('orientationchange', function() {
      setTimeout(function() {
        renderAllCharts();
      }, 500);
    });
    
    // Настройка обработчиков событий
    setupEventHandlers();
    
    // Первоначальное обновление UI
    updateUI();
    
    // Инициализация обучения
    initTutorial();
    
    // Обработчик изменения размера окна
    const handleResize = () => {
      renderMiniCharts();
      if (elements.yearSummary.classList.contains('show')) {
        renderYearCharts();
      }
    };
    
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(handleResize, 250);
    });

    // Сохранение при закрытии страницы
    window.addEventListener('beforeunload', function() {
      if (hasUnsavedChanges) {
        saveData();
      }
    });

    // Периодическое автосохранение
    setInterval(() => {
      if (hasUnsavedChanges) {
        saveData();
      }
    }, 30000); // Каждые 30 секунд

  }

  // Запуск приложения
  initializeApp();

  // Обработчики для кнопок заголовка
  window.addEventListener('load', adjustHeaderButtons);
  window.addEventListener('resize', adjustHeaderButtons);


  // ==================== НОВЫЕ ФУНКЦИИ: ВЕЩИ И ЗАМЕТКИ ====================

  function showThingModal(category, amount) {
    var existing = document.getElementById('thing-modal-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'thing-modal-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;';

    var box = document.createElement('div');
    box.style.cssText = 'background:var(--bg);border-radius:16px;padding:24px;width:100%;max-width:400px;box-shadow:8px 8px 16px var(--shadow-dark),-8px -8px 16px var(--shadow-light);';
    box.innerHTML = '<h3 style="margin:0 0 16px 0;color:var(--primary);">Что купил?</h3>'
      + '<p style="margin:0 0 4px 0;opacity:0.7;font-size:0.9rem;">Категория: <strong>' + category + '</strong></p>'
      + '<p style="margin:0 0 16px 0;opacity:0.7;font-size:0.9rem;">Сумма: <strong>' + formatCurrency(amount) + '</strong></p>'
      + '<input type="text" id="thing-name-input" placeholder="Название вещи или покупки" style="width:100%;padding:12px;border:none;border-radius:12px;background:var(--bg);box-shadow:inset 3px 3px 6px var(--shadow-dark),inset -3px -3px 6px var(--shadow-light);font-size:1rem;color:var(--text);outline:none;box-sizing:border-box;margin-bottom:16px;" />'
      + '<div style="display:flex;gap:10px;">'
      + '<button id="thing-save-btn" style="flex:1;padding:12px;border:none;border-radius:12px;background:var(--primary);color:#fff;font-size:1rem;font-weight:600;cursor:pointer;">Сохранить</button>'
      + '<button id="thing-cancel-btn" style="flex:1;padding:12px;border:none;border-radius:12px;background:var(--bg);color:var(--text);font-size:1rem;cursor:pointer;box-shadow:3px 3px 6px var(--shadow-dark),-3px -3px 6px var(--shadow-light);">Отмена</button>'
      + '</div>';

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    var input = document.getElementById('thing-name-input');
    input.focus();

    function doSave() {
      var name = input.value.trim();
      if (!name) { showSuccessMessage('Введите название'); return; }
      if (!financeData[currentYear][currentMonth].things) {
        financeData[currentYear][currentMonth].things = [];
      }
      financeData[currentYear][currentMonth].things.push({
        name: name,
        category: category,
        amount: amount,
        date: new Date().toLocaleDateString('ru-RU')
      });
      addExpenseToCategory(category);
      overlay.remove();
      markDataChanged();
      updateThingsReport();
      showSuccessMessage('"' + name + '" добавлена');
    }

    document.getElementById('thing-save-btn').addEventListener('click', doSave);
    document.getElementById('thing-cancel-btn').addEventListener('click', function() { overlay.remove(); });
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
    input.addEventListener('keypress', function(e) { if (e.key === 'Enter') doSave(); });
  }

  function updateThingsReport() {
    var list = document.getElementById('things-list');
    if (!list) return;

    var monthData = financeData[currentYear][currentMonth];
    var things = (monthData.things || []).slice().sort(function(a, b) { return b.amount - a.amount; });

    var countEl = document.getElementById('things-count');
    var avgEl = document.getElementById('things-avg');
    var maxEl = document.getElementById('things-max');
    if (countEl) countEl.textContent = things.length;
    if (avgEl) avgEl.textContent = things.length ? formatCurrency(Math.round(things.reduce(function(s,t){return s+t.amount;},0) / things.length)) : '0 \u20bd';
    if (maxEl) maxEl.textContent = things.length ? formatCurrency(things[0].amount) : '0 \u20bd';

    list.innerHTML = '';

    if (!things.length) {
      list.innerHTML = '<p style="text-align:center;opacity:0.5;padding:20px;min-width:200px;">\u041d\u0435\u0442 \u043f\u043e\u043a\u0443\u043f\u043e\u043a.<br>\u041d\u0430\u0436\u043c\u0438 \ud83d\udcdd \u0432 \u0432\u0438\u0434\u0436\u0435\u0442\u0435</p>';
      return;
    }

    var total = things.reduce(function(s,t){return s+t.amount;},0);

    things.forEach(function(thing, i) {
      var pct = total > 0 ? ((thing.amount / total) * 100).toFixed(1) : '0';
      var card = document.createElement('div');
      card.className = 'month-categories';
      card.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">'
        + '<div style="flex:1;min-width:0;">'
        + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">'
        + '<span style="font-weight:700;font-size:1rem;word-break:break-word;">' + thing.name + '</span>'
        + '<button data-thing-idx="' + i + '" style="background:none;border:none;color:#e74c3c;cursor:pointer;font-size:1.1rem;padding:0;flex-shrink:0;line-height:1;">\u00d7</button>'
        + '</div>'
        + '<div style="font-size:0.85rem;color:var(--primary);">' + thing.category + '</div>'
        + '<div style="font-size:0.8rem;opacity:0.6;">' + thing.date + '</div>'
        + '</div>'
        + '<div style="text-align:right;flex-shrink:0;">'
        + '<div style="font-weight:700;">' + formatCurrency(thing.amount) + '</div>'
        + '<div style="font-size:0.8rem;opacity:0.6;">' + pct + '%</div>'
        + '</div></div>';
      list.appendChild(card);
    });

    var totalCard = document.createElement('div');
    totalCard.className = 'month-categories';
    totalCard.style.background = 'rgba(52,152,219,0.12)';
    totalCard.innerHTML = '<div style="display:flex;justify-content:space-between;"><span style="font-weight:600;">\u0412\u0441\u0435\u0433\u043e</span><span style="font-weight:700;color:var(--primary);">' + formatCurrency(total) + '</span></div>';
    list.appendChild(totalCard);

    list.querySelectorAll('[data-thing-idx]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var idx = parseInt(this.getAttribute('data-thing-idx'));
        var md = financeData[currentYear][currentMonth];
        var sorted = (md.things || []).slice().sort(function(a,b){return b.amount-a.amount;});
        var item = sorted[idx];
        var realIdx = (md.things || []).indexOf(item);
        if (realIdx > -1) {
          var name = md.things[realIdx].name;
          md.things.splice(realIdx, 1);
          markDataChanged();
          updateThingsReport();
          showSuccessMessage('"' + name + '" \u0443\u0434\u0430\u043b\u0435\u043d\u0430');
        }
      });
    });
  }

  function showChartValueModal(monthName, value) {
    var existing = document.getElementById('chart-val-modal');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'chart-val-modal';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;';

    var box = document.createElement('div');
    box.style.cssText = 'background:var(--bg);border-radius:16px;padding:28px 32px;text-align:center;box-shadow:8px 8px 16px var(--shadow-dark),-8px -8px 16px var(--shadow-light);min-width:200px;';
    box.innerHTML = '<p style="margin:0 0 8px 0;font-size:1rem;opacity:0.7;">' + monthName + '</p>'
      + '<p style="margin:0 0 20px 0;font-size:2rem;font-weight:700;color:var(--primary);">' + formatCurrency(value) + '</p>'
      + '<button id="close-chart-val" style="padding:10px 24px;border:none;border-radius:10px;background:var(--bg);box-shadow:3px 3px 6px var(--shadow-dark),-3px -3px 6px var(--shadow-light);cursor:pointer;color:var(--text);font-size:0.95rem;">\u0417\u0430\u043a\u0440\u044b\u0442\u044c</button>';

    overlay.appendChild(box);
    document.body.appendChild(overlay);
    document.getElementById('close-chart-val').addEventListener('click', function() { overlay.remove(); });
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
  }

  // ==================== 🔮 ПРОГНОЗ РАСХОДОВ (AI-подобная система) ====================
  //
  // Система строит хронологический ряд расходов по месяцам и применяет
  // линейную регрессию (метод наименьших квадратов) для оценки тренда,
  // а также эвристический анализ категорий, чтобы сформировать
  // человекочитаемые рекомендации — по духу похоже на работу простого
  // AI-аналитика, но полностью работает локально, без внешних запросов.

  // Собрать хронологический ряд месяцев (только прошедшие и текущий месяц)
  function getChronologicalMonthlySeries() {
    const years = Object.keys(financeData).map(y => parseInt(y, 10)).sort((a, b) => a - b);
    const series = [];

    years.forEach(year => {
      for (let m = 0; m < 12; m++) {
        if (year > currentYear) continue;
        if (year === currentYear && m > currentMonth) continue;

        const monthData = financeData[year][m];
        if (!monthData) continue;

        // Пропускаем полностью пустые месяцы в начале ряда (нет смысла тянуть тренд с нулей)
        series.push({
          year: year,
          month: m,
          label: monthNames[m].slice(0, 3) + ' ' + String(year).slice(2),
          income: monthData.income || 0,
          expense: monthData.expense || 0,
          categories: monthData.categories || {}
        });
      }
    });

    // Обрезаем ведущие нулевые месяцы (до первого месяца с активностью)
    let firstActive = series.findIndex(s => s.income > 0 || s.expense > 0);
    if (firstActive > 0) {
      return series.slice(firstActive);
    }
    return series;
  }

  // Линейная регрессия методом наименьших квадратов: y = intercept + slope * x
  function linearRegression(values) {
    const n = values.length;
    if (n === 0) return { slope: 0, intercept: 0 };
    if (n === 1) return { slope: 0, intercept: values[0] };

    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumXX += i * i;
    }

    const denom = (n * sumXX - sumX * sumX);
    const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
    const intercept = (sumY - slope * sumX) / n;

    return { slope: slope, intercept: intercept };
  }

  // Найти категорию с наибольшим ростом трат между двумя последними месяцами
  function findFastestGrowingCategory(series) {
    if (series.length < 2) return null;
    const prev = series[series.length - 2].categories || {};
    const curr = series[series.length - 1].categories || {};

    let maxCat = null;
    let maxDelta = 0;

    Object.keys(curr).forEach(cat => {
      const delta = (curr[cat] || 0) - (prev[cat] || 0);
      if (delta > maxDelta) {
        maxDelta = delta;
        maxCat = cat;
      }
    });

    return maxCat ? { category: maxCat, delta: maxDelta } : null;
  }

  // Основная функция построения прогноза
  function computeForecast() {
    const series = getChronologicalMonthlySeries();
    const expenses = series.map(s => s.expense);
    const incomes = series.map(s => s.income);

    if (series.length < 2) {
      return {
        insufficient: true,
        series: series
      };
    }

    const reg = linearRegression(expenses);
    const n = expenses.length;

    // Прогноз на следующий месяц
    const nextMonthForecast = Math.max(0, Math.round(reg.intercept + reg.slope * n));

    // Прогноз на следующий квартал (сумма 3 месяцев вперёд)
    let quarterForecast = 0;
    for (let i = 0; i < 3; i++) {
      quarterForecast += Math.max(0, reg.intercept + reg.slope * (n + i));
    }
    quarterForecast = Math.round(quarterForecast);

    // Средние показатели за последние до 6 месяцев
    const recentCount = Math.min(6, n);
    const recentExpenses = expenses.slice(-recentCount);
    const recentIncomes = incomes.slice(-recentCount);
    const avgExpense = recentExpenses.reduce((a, b) => a + b, 0) / recentCount;
    const avgIncome = recentIncomes.reduce((a, b) => a + b, 0) / recentCount;

    // Тренд в процентах за месяц относительно среднего расхода
    const trendPercent = avgExpense > 0 ? (reg.slope / avgExpense) * 100 : 0;

    let trendDirection = 'flat';
    if (trendPercent > 3) trendDirection = 'up';
    else if (trendPercent < -3) trendDirection = 'down';

    const growingCategory = findFastestGrowingCategory(series);

    return {
      insufficient: false,
      series: series,
      reg: reg,
      nextMonthForecast: nextMonthForecast,
      quarterForecast: quarterForecast,
      avgExpense: Math.round(avgExpense),
      avgIncome: Math.round(avgIncome),
      trendPercent: trendPercent,
      trendDirection: trendDirection,
      growingCategory: growingCategory
    };
  }

  // Формирование текста рекомендации на основе прогноза
  function buildForecastRecommendation(f) {
    if (f.insufficient) {
      return 'Недостаточно данных для прогноза. Заполните минимум 2 месяца, чтобы увидеть аналитику.';
    }

    const parts = [];

    if (f.trendDirection === 'up') {
      parts.push(`Расходы растут примерно на ${Math.abs(f.trendPercent).toFixed(1)}% в месяц.`);
    } else if (f.trendDirection === 'down') {
      parts.push(`Расходы снижаются примерно на ${Math.abs(f.trendPercent).toFixed(1)}% в месяц — отличная динамика!`);
    } else {
      parts.push('Расходы держатся стабильно, без выраженного тренда.');
    }

    if (f.avgIncome > 0 && f.nextMonthForecast > f.avgIncome) {
      parts.push(`⚠️ Прогноз расходов на следующий месяц (${formatCurrency(f.nextMonthForecast)}) превышает средний доход (${formatCurrency(f.avgIncome)}). Стоит пересмотреть бюджет.`);
    }

    if (f.growingCategory) {
      parts.push(`Быстрее всего растут траты в категории «${f.growingCategory.category}» (+${formatCurrency(Math.round(f.growingCategory.delta))} к предыдущему месяцу).`);
    }

    return parts.join(' ');
  }

  // Отрисовка блока прогноза (карточки + график + текст)
  function renderForecast() {
    const f = computeForecast();

    const nextMonthEl = document.getElementById('forecast-next-month');
    const quarterEl = document.getElementById('forecast-next-quarter');
    const trendMonthEl = document.getElementById('forecast-trend-month');
    const trendQuarterEl = document.getElementById('forecast-trend-quarter');
    const recEl = document.getElementById('forecast-recommendation');
    const analysisEl = document.getElementById('forecast-analysis-text');

    if (f.insufficient) {
      if (nextMonthEl) nextMonthEl.textContent = '—';
      if (quarterEl) quarterEl.textContent = '—';
      if (trendMonthEl) trendMonthEl.textContent = '';
      if (trendQuarterEl) trendQuarterEl.textContent = '';
      if (recEl) recEl.textContent = buildForecastRecommendation(f);
      if (analysisEl) analysisEl.innerHTML = '<p>Добавьте данные минимум за 2 месяца, чтобы система могла построить тренд и прогноз.</p>';
      renderForecastChart(f);
      return;
    }

    if (nextMonthEl) nextMonthEl.textContent = formatCurrency(f.nextMonthForecast);
    if (quarterEl) quarterEl.textContent = formatCurrency(f.quarterForecast);

    const arrow = f.trendDirection === 'up' ? '↑' : (f.trendDirection === 'down' ? '↓' : '→');
    const trendClass = f.trendDirection;
    const trendLabel = `${arrow} ${Math.abs(f.trendPercent).toFixed(1)}% / мес`;

    if (trendMonthEl) {
      trendMonthEl.textContent = trendLabel;
      trendMonthEl.className = 'forecast-trend ' + trendClass;
    }
    if (trendQuarterEl) {
      trendQuarterEl.textContent = trendLabel;
      trendQuarterEl.className = 'forecast-trend ' + trendClass;
    }
    if (recEl) recEl.textContent = buildForecastRecommendation(f);

    if (analysisEl) {
      const avgP = `<p>📊 Средний расход за последние месяцы: <strong>${formatCurrency(f.avgExpense)}</strong>, средний доход: <strong>${formatCurrency(f.avgIncome)}</strong>.</p>`;
      const trendP = `<p>📈 Направление тренда: <strong>${f.trendDirection === 'up' ? 'рост расходов' : f.trendDirection === 'down' ? 'снижение расходов' : 'стабильно'}</strong> (${trendLabel}).</p>`;
      let catP = '';
      if (f.growingCategory) {
        catP = `<p>🏷️ Категория с наибольшим приростом трат: <strong>${f.growingCategory.category}</strong>.</p>`;
      }
      analysisEl.innerHTML = avgP + trendP + catP;
    }

    renderForecastChart(f);
  }

  // Отрисовка графика прогноза (факт + прогнозируемые точки пунктиром)
  function renderForecastChart(f) {
    const ctx = document.getElementById('forecastChart')?.getContext('2d');
    if (!ctx) return;
    if (forecastChartInstance) forecastChartInstance.destroy();

    const series = f.series || [];
    const labels = series.map(s => s.label);
    const actualData = series.map(s => s.expense);

    if (f.insufficient) {
      forecastChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels.length ? labels : ['Нет данных'],
          datasets: [{
            label: 'Расходы',
            data: actualData.length ? actualData : [0],
            borderColor: '#3498db',
            backgroundColor: 'rgba(52,152,219,0.15)',
            fill: true,
            tension: 0.3
          }]
        },
        options: getChartOptions('Прогноз расходов')
      });
      return;
    }

    // Строим будущие точки: 3 месяца вперёд
    const forecastLabels = [];
    const forecastValues = [null]; // соединяем с последней реальной точкой
    for (let i = 0; i < 3; i++) {
      const idx = series.length + i;
      const monthIdx = (currentMonth + i + 1) % 12;
      forecastLabels.push(monthNames[monthIdx].slice(0, 3));
      forecastValues.push(Math.max(0, Math.round(f.reg.intercept + f.reg.slope * idx)));
    }

    const allLabels = labels.concat(forecastLabels);

    // Датасет факта — заполняем null для будущих точек
    const actualDataset = actualData.concat(forecastLabels.map(() => null));

    // Датасет прогноза — null для прошлого, значения для последней фактической + будущих точек
    const forecastDataset = new Array(labels.length - 1).fill(null).concat(
      [actualData[actualData.length - 1]], forecastValues.slice(1)
    );

    forecastChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: allLabels,
        datasets: [
          {
            label: 'Факт',
            data: actualDataset,
            borderColor: '#3498db',
            backgroundColor: 'rgba(52,152,219,0.15)',
            fill: true,
            tension: 0.3,
            spanGaps: false
          },
          {
            label: 'Прогноз',
            data: forecastDataset,
            borderColor: '#e67e22',
            backgroundColor: 'rgba(230,126,34,0.1)',
            borderDash: [6, 4],
            fill: false,
            tension: 0.3,
            pointStyle: 'rectRot',
            spanGaps: false
          }
        ]
      },
      options: getChartOptions('Прогноз расходов')
    });
  }

  // ==================== 🔥 ТЕПЛОВАЯ КАРТА РАСХОДОВ ====================

  // Парсинг даты из истории трат (формат toLocaleString('ru-RU') или ISO)
  function parseHistoryEntryDate(dateStr) {
    if (!dateStr) return null;

    // Формат ru-RU: "13.07.2026, 10:23:00" или "13.07.2026, 10:23"
    const ruMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (ruMatch) {
      const day = parseInt(ruMatch[1], 10);
      const month = parseInt(ruMatch[2], 10) - 1;
      const year = parseInt(ruMatch[3], 10);
      return new Date(year, month, day);
    }

    // Фолбэк — попытка стандартного парсинга
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) return parsed;

    return null;
  }

  // Построить карту "день месяца -> сумма расходов" для текущего месяца/года
  function getDailyExpenseMap() {
    const monthData = financeData[currentYear][currentMonth];
    const history = (monthData && monthData.expensesHistory) || [];
    const map = {};

    history.forEach(entry => {
      const d = parseHistoryEntryDate(entry.date);
      if (!d) return;
      // Учитываем только записи, реально относящиеся к текущему месяцу/году
      if (d.getFullYear() !== currentYear || d.getMonth() !== currentMonth) return;

      const day = d.getDate();
      map[day] = (map[day] || 0) + (entry.amount || 0);
    });

    return map;
  }

  // Определить цвет ячейки тепловой карты по величине траты
  function getHeatmapColor(amount, maxAmount) {
    if (!amount || amount <= 0 || maxAmount <= 0) return null;
    const ratio = amount / maxAmount;

    if (ratio < 0.25) return '#fee5d9';
    if (ratio < 0.5) return '#fcae91';
    if (ratio < 0.75) return '#fb6a4a';
    return '#cb181d';
  }

  // Отрисовка тепловой карты расходов за текущий месяц
  function renderHeatmap() {
    const grid = document.getElementById('heatmap-grid');
    if (!grid) return;

    grid.innerHTML = '';

    const dailyMap = getDailyExpenseMap();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstWeekday = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7; // Пн = 0

    const amounts = Object.values(dailyMap);
    const maxAmount = amounts.length ? Math.max(...amounts) : 0;
    const avgAmount = amounts.length ? Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length) : 0;

    let peakDay = null;
    let peakAmount = 0;
    Object.entries(dailyMap).forEach(([day, amount]) => {
      if (amount > peakAmount) {
        peakAmount = amount;
        peakDay = parseInt(day, 10);
      }
    });

    // Заголовки дней недели
    const weekdayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    weekdayNames.forEach(name => {
      const el = document.createElement('div');
      el.className = 'heatmap-weekday';
      el.textContent = name;
      grid.appendChild(el);
    });

    // Пустые ячейки перед первым днём месяца
    for (let i = 0; i < firstWeekday; i++) {
      const empty = document.createElement('div');
      empty.className = 'heatmap-cell empty';
      grid.appendChild(empty);
    }

    const today = new Date();
    const isCurrentRealMonth = today.getFullYear() === currentYear && today.getMonth() === currentMonth;

    for (let day = 1; day <= daysInMonth; day++) {
      const amount = dailyMap[day] || 0;
      const cell = document.createElement('div');
      cell.className = 'heatmap-cell';

      const color = getHeatmapColor(amount, maxAmount);
      if (color) {
        cell.style.background = color;
      } else {
        cell.style.background = 'rgba(0,0,0,0.04)';
      }

      if (isCurrentRealMonth && today.getDate() === day) {
        cell.classList.add('today');
      }

      cell.innerHTML = `<span class="heatmap-day-num">${day}</span>` +
        (amount > 0 ? `<span class="heatmap-day-amount">${Math.round(amount / 1000 * 10) / 10 || Math.round(amount)}${amount >= 1000 ? 'к' : ''}</span>` : '');

      cell.addEventListener('click', () => {
        if (amount > 0) {
          showChartValueModal(`${day} ${monthNames[currentMonth]}`, amount);
        } else {
          showSuccessMessage('Нет трат в этот день');
        }
      });

      grid.appendChild(cell);
    }

    const maxEl = document.getElementById('heatmap-max');
    const avgEl = document.getElementById('heatmap-avg');
    const peakEl = document.getElementById('heatmap-peak');

    if (maxEl) maxEl.textContent = formatCurrency(maxAmount);
    if (avgEl) avgEl.textContent = formatCurrency(avgAmount);
    if (peakEl) peakEl.textContent = peakDay ? `${peakDay} ${monthNames[currentMonth]} (${formatCurrency(peakAmount)})` : 'Нет данных';
  }

  // ==================== ✏️ ПЕРЕТАСКИВАНИЕ ВИДЖЕТОВ (DRAG-AND-DROP) ====================

  const WIDGET_ORDER_KEY = 'widgetOrder';

  function loadWidgetOrder() {
    try {
      const raw = localStorage.getItem(WIDGET_ORDER_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveWidgetOrder(order) {
    try {
      localStorage.setItem(WIDGET_ORDER_KEY, JSON.stringify(order));
    } catch (e) {
      console.error('Не удалось сохранить порядок виджетов:', e);
    }
  }

  // Применить сохранённый порядок к уже отрисованным виджетам в DOM
  function applyWidgetOrder() {
    const order = loadWidgetOrder();
    if (!order || !order.length || !elements.widgetsContainer) return;

    const container = elements.widgetsContainer;
    const items = Array.from(container.children);

    const keyFor = (el) => {
      if (el.classList.contains('savings-widget')) return 'sav:' + el.dataset.widgetId;
      if (el.classList.contains('fund-widget')) return 'fund:' + el.dataset.widgetId;
      if (el.dataset.category) return 'cat:' + el.dataset.category;
      return null;
    };

    const orderIndex = {};
    order.forEach((key, i) => { orderIndex[key] = i; });

    items.sort((a, b) => {
      const ka = keyFor(a), kb = keyFor(b);
      const ia = (ka !== null && ka in orderIndex) ? orderIndex[ka] : 9999;
      const ib = (kb !== null && kb in orderIndex) ? orderIndex[kb] : 9999;
      return ia - ib;
    });

    items.forEach(el => container.appendChild(el));
  }

  // Собрать список всех виджетов, доступных для сортировки в текущем месяце
  function collectSortableWidgets() {
    const list = [];
    const monthData = financeData[currentYear][currentMonth];
    const categories = (monthData && monthData.categories) || {};

    Object.keys(categories).forEach((cat, index) => {
      list.push({
        type: 'cat',
        key: 'cat:' + cat,
        label: cat,
        color: categoryColors[index % categoryColors.length],
        typeLabel: 'Категория'
      });
    });

    savingsWidgets.forEach(w => {
      list.push({
        type: 'sav',
        key: 'sav:' + w.id,
        label: w.name,
        color: w.color,
        typeLabel: 'Накопления'
      });
    });

    fundWidgets.forEach(w => {
      list.push({
        type: 'fund',
        key: 'fund:' + w.id,
        label: w.name,
        color: w.color,
        typeLabel: 'Фонд'
      });
    });

    // Применяем сохранённый порядок, если он есть
    const order = loadWidgetOrder();
    if (order && order.length) {
      const orderIndex = {};
      order.forEach((key, i) => { orderIndex[key] = i; });
      list.sort((a, b) => {
        const ia = a.key in orderIndex ? orderIndex[a.key] : 9999;
        const ib = b.key in orderIndex ? orderIndex[b.key] : 9999;
        return ia - ib;
      });
    }

    return list;
  }

  // Отрисовать список для режима редактирования (drag-and-drop через Pointer Events)
  function renderDraggableWidgetsList() {
    const listEl = elements.draggableWidgetsList;
    if (!listEl) return;

    listEl.innerHTML = '';

    const items = collectSortableWidgets();

    if (!items.length) {
      listEl.innerHTML = '<div class="draggable-widgets-empty">Нет виджетов для этого месяца.<br>Добавьте категорию, накопления или фонд.</div>';
      return;
    }

    items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'draggable-widget-item';
      el.dataset.key = item.key;
      el.dataset.type = item.type;
      el.innerHTML = `
        <span class="drag-handle">☰</span>
        <span class="drag-color-dot" style="background:${item.color}"></span>
        <span class="drag-label">${item.label}</span>
        <span class="drag-type-badge">${item.typeLabel}</span>
        <button class="drag-delete-btn" title="Удалить">×</button>
      `;
      listEl.appendChild(el);

      el.querySelector('.drag-delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        handleDraggableItemDelete(item);
      });
    });

    setupDragReorder(listEl);
  }

  // Удаление элемента прямо из режима редактирования
  function handleDraggableItemDelete(item) {
    if (item.type === 'cat') {
      if (confirm(`Удалить категорию "${item.label}" только для текущего месяца?`)) {
        deleteWidget(item.label);
        renderDraggableWidgetsList();
      }
    } else if (item.type === 'sav') {
      if (confirm('Удалить этот виджет накоплений?')) {
        savingsWidgets = savingsWidgets.filter(w => 'sav:' + w.id !== item.key);
        markDataChanged();
        renderSavingsWidgets();
        applyWidgetOrder();
        renderDraggableWidgetsList();
      }
    } else if (item.type === 'fund') {
      if (confirm('Удалить этот фонд?')) {
        fundWidgets = fundWidgets.filter(w => 'fund:' + w.id !== item.key);
        markDataChanged();
        renderFundWidgets();
        applyWidgetOrder();
        renderDraggableWidgetsList();
      }
    }
  }

  // Реализация drag-and-drop через Pointer Events (работает и мышью, и пальцем)
  function setupDragReorder(listEl) {
    let draggingEl = null;
    let startY = 0;
    let placeholderIndex = -1;

    function getItems() {
      return Array.from(listEl.querySelectorAll('.draggable-widget-item'));
    }

    function onPointerMove(e) {
      if (!draggingEl) return;
      e.preventDefault();

      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      draggingEl.style.transform = `translateY(${clientY - startY}px)`;

      const items = getItems().filter(el => el !== draggingEl);
      for (let i = 0; i < items.length; i++) {
        const rect = items[i].getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        if (clientY < midpoint) {
          if (draggingEl.nextSibling !== items[i]) {
            listEl.insertBefore(draggingEl, items[i]);
          }
          return;
        }
      }
      // Если ниже всех — переместить в конец
      if (listEl.lastChild !== draggingEl) {
        listEl.appendChild(draggingEl);
      }
    }

    function onPointerUp() {
      if (!draggingEl) return;
      draggingEl.classList.remove('dragging');
      draggingEl.style.transform = '';
      draggingEl.releasePointerCapture && draggingEl.releasePointerCapture(activePointerId);
      draggingEl = null;

      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('touchmove', onPointerMove);
      document.removeEventListener('touchend', onPointerUp);
    }

    let activePointerId = null;

    getItems().forEach(item => {
      const handle = item.querySelector('.drag-handle');
      if (!handle) return;

      const startDrag = (e) => {
        e.preventDefault();
        draggingEl = item;
        activePointerId = e.pointerId;
        startY = (e.touches ? e.touches[0].clientY : e.clientY);
        item.classList.add('dragging');

        if (e.pointerId !== undefined && item.setPointerCapture) {
          try { item.setPointerCapture(e.pointerId); } catch (err) {}
        }

        document.addEventListener('pointermove', onPointerMove, { passive: false });
        document.addEventListener('pointerup', onPointerUp);
        document.addEventListener('touchmove', onPointerMove, { passive: false });
        document.addEventListener('touchend', onPointerUp);
      };

      if (window.PointerEvent) {
        handle.addEventListener('pointerdown', startDrag);
      } else {
        handle.addEventListener('touchstart', startDrag, { passive: false });
        handle.addEventListener('mousedown', startDrag);
      }
    });
  }

  // Сохранить порядок из текущего DOM-состояния списка редактирования
  function saveWidgetsOrderFromList() {
    const listEl = elements.draggableWidgetsList;
    if (!listEl) return;

    const order = Array.from(listEl.querySelectorAll('.draggable-widget-item'))
      .map(el => el.dataset.key)
      .filter(Boolean);

    saveWidgetOrder(order);
    applyWidgetOrder();
  }

  // ==================== 📡 SERVICE WORKER / ОФФЛАЙН РЕЖИМ ====================

  function updateOfflineIndicator() {
    if (!elements.offlineIndicator) return;
    if (navigator.onLine) {
      elements.offlineIndicator.classList.remove('show');
    } else {
      elements.offlineIndicator.classList.add('show');
    }
  }

  window.addEventListener('online', updateOfflineIndicator);
  window.addEventListener('offline', updateOfflineIndicator);
  updateOfflineIndicator();

});