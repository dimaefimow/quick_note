// Блокировка закрытия свайпом в Telegram Mini Apps
if (window.Telegram?.WebApp?.preventClose) {
  window.Telegram.WebApp.preventClose();
}

// Отключение вертикальных свайпов (для Telegram 7.7+)
if (window.Telegram?.WebApp?.disableVerticalSwipes) {
  window.Telegram.WebApp.disableVerticalSwipes();
} else {
  console.warn("Метод disableVerticalSwipes не поддерживается");
}

// Определение платформы
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isTelegramIOS = isIOS && window.Telegram?.WebApp?.platform === 'ios';

document.addEventListener('DOMContentLoaded', function() {
  console.log('=== ЗАГРУЗКА ПРИЛОЖЕНИЯ ===');
  
  // Блокировка всплытия событий прокрутки
  const container = document.querySelector('.content-container');
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
    console.log('🔍 Загрузка данных из localStorage...');
    
    const keys = ['financeData', 'budgetData', 'savingsWidgets', 'fundWidgets', 'achievementsData'];
    keys.forEach(key => {
      const value = localStorage.getItem(key);
      console.log(`${key}:`, value ? `✓ данные есть (${value.length} байт)` : '✗ нет данных');
    });

    try {
      // Загрузка с валидацией
      const financeDataStr = localStorage.getItem('financeData');
      const budgetDataStr = localStorage.getItem('budgetData');
      const savingsWidgetsStr = localStorage.getItem('savingsWidgets');
      const fundWidgetsStr = localStorage.getItem('fundWidgets');
      const achievementsDataStr = localStorage.getItem('achievementsData');

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
      achievementsData = achievementsDataStr ? JSON.parse(achievementsDataStr) : {};

      console.log('✅ Данные успешно загружены');
      return true;
    } catch (error) {
      console.error('❌ Ошибка загрузки данных:', error);
      
      // Восстановление из резервной копии
      if (restoreBackup()) {
        console.log('✅ Данные восстановлены из резервной копии');
        return true;
      }
      
      // Инициализация пустых данных
      initializeEmptyData();
      console.log('🔄 Инициализированы новые данные');
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
    achievementsData = {};
    
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
    
    if (!achievementsData || typeof achievementsData !== 'object') {
      achievementsData = {};
    }
  }

  function getDefaultMonthData() {
    return { 
      income: 0, 
      expense: 0, 
      categories: {},
      capital: 0,
      expensesHistory: []
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
      localStorage.setItem('achievementsData', JSON.stringify(achievementsData));
      
      // Резервная копия
      createBackup();
      
      // Время последнего сохранения
      localStorage.setItem('lastSaveTimestamp', Date.now().toString());
      
      console.log('💾 Данные сохранены:', {
        financeData: Object.keys(financeData).length + ' лет',
        budgetData: budgetData.totalAmount > 0 ? 'активен' : 'неактивен',
        savingsWidgets: savingsWidgets.length + ' виджетов',
        fundWidgets: fundWidgets.length + ' фондов',
        achievements: Object.keys(achievementsData).length + ' достижений'
      });
      
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
        console.log('⚠️ Критические данные сохранены в sessionStorage');
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
        achievementsData: achievementsData,
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
          achievementsData = backup.achievementsData || {};
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
      
      console.log('✅ LocalStorage работает нормально');
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
  let achievementsData = {};

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
  let chart, capitalChart, yearIncomeChart, yearExpenseChart, yearCapitalChart;
  let miniCapitalChart, miniExpenseChart;
  let trendCharts = {};

  // Цвета для категорий
  const categoryColors = [
    '#e74c3c', '#3498db', '#2ecc71', '#f39c12', 
    '#9b59b6', '#1abc9c', '#d35400', '#34495e',
    '#16a085', '#27ae60', '#2980b9', '#8e44ad',
    '#f1c40f', '#e67e22', '#c0392b'
  ];

  // Переменные для новых достижений
  let themeToggleCount = 0;
  let lastThemeToggleTime = 0;
  let pullAttempts = 0;
  let monthSequence = [];
  const requiredMonthSequence = [8, 9, 10, 11, 0, 1]; // сентябрь-февраль

  // Счетчик кликов по виджетам для активации падения интерфейса
  let widgetClickCount = 0;

  // Список достижений с уникальными эмодзи
  const achievements = [
    {
      id: 'basic_minimum',
      title: 'Базовый минимум',
      description: 'Доход в месяц > 300 000 ₽',
      emoji: '💰',
      secret: false,
      check: (data) => data.income > 300000
    },
    {
      id: 'beer_category',
      title: 'Я беру паре баб по паре банок Bud',
      description: 'Создать категорию «Пиво»',
      emoji: '🍺',
      secret: false,
      check: (data) => Object.keys(data.categories).includes('Пиво')
    },
    {
      id: 'psychologist_category',
      title: 'Мне нужен ответ',
      description: 'Создать категорию «Психолог»',
      emoji: '🧠',
      secret: false,
      check: (data) => Object.keys(data.categories).includes('Психолог')
    },
    {
      id: 'credit_category',
      title: 'Где деньги, Лебовский?',
      description: 'Создать категорию «Кредит»',
      emoji: '💳',
      secret: false,
      check: (data) => Object.keys(data.categories).includes('Кредит')
    },
    {
      id: 'vacation_savings',
      title: 'А на море белый песок',
      description: 'Создать виджет накопления «Отдых»',
      emoji: '🏖️',
      secret: false,
      check: (data) => data.savingsWidgets?.some(w => w.name === 'Отдых')
    },
    {
      id: 'food_category',
      title: 'Что на ужин?',
      description: 'Создать категорию «Еда»',
      emoji: '🍕',
      secret: false,
      check: (data) => Object.keys(data.categories).includes('Еда')
    },
    {
      id: 'no_smoking',
      title: 'Уничтожить табачные корпорации',
      description: 'Создать категорию «Курение» и не потратить на неё деньги в течение месяца',
      emoji: '🚭',
      secret: false,
      check: (data) => {
        const hasCategory = Object.keys(data.categories).includes('Курение');
        const hasExpenses = data.categories['Курение'] > 0;
        return hasCategory && !hasExpenses;
      }
    },
    {
      id: '500_rubles',
      title: 'Как выжить на 500 рублей?',
      description: 'В конце месяца у вас остаётся < 500 ₽',
      emoji: '🪙',
      secret: false,
      check: (data) => {
        const today = new Date();
        return today.getDate() > 28 && // Проверяем только в конце месяца
               data.expense > 0 && // Должны быть траты
               (data.income - data.expense) < 500;
      }
    },
    {
      id: 'no_spending_week',
      title: 'Содержанка',
      description: 'Прожить неделю, не потратив ни рубля',
      emoji: '👑',
      secret: false,
      check: (data) => {
        const today = new Date();
        return today.getDate() >= 7 && data.expensesHistory.length > 0 &&
          data.expensesHistory
            .filter(e => new Date(e.date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
            .reduce((sum, e) => sum + e.amount, 0) === 0;
      }
    },
    {
      id: 'black_hole',
      title: 'Чёрная дыра в бюджете',
      description: '1 из категорий трат занимает > 40% всех расходов',
      emoji: '🕳️',
      secret: false,
      check: (data) => {
        const totalExpense = data.expense;
        if (totalExpense === 0) return false;
        
        // Проверяем только в конце месяца
        const today = new Date();
        const isEndOfMonth = today.getDate() >= 28;
        
        if (!isEndOfMonth) return false;
        
        return Object.values(data.categories).some(amount => 
          (amount / totalExpense) > 0.4
        );
      }
    },
    {
      id: 'balanced_budget',
      title: 'Рубль в рубль',
      description: 'Доходы = Расходы в течение месяца',
      emoji: '⚖️',
      secret: false,
      check: (data) => {
        const today = new Date();
        return today.getDate() > 1 && data.expense > 0 && data.income === data.expense;
      }
    },
    {
      id: 'poor',
      title: 'Бедолага',
      description: 'Ваш доход < 50 000 ₽ в месяц',
      emoji: '🥺',
      secret: false,
      check: (data) => {
        const today = new Date();
        return today.getDate() > 3 && 
               data.income > 0 && // Доход должен быть больше 0
               data.income < 50000;
      }
    },
    {
      id: 'capital_growth',
      title: 'Как всё идёт',
      description: 'Капитализация +100% в течение 3 месяцев',
      emoji: '📈',
      secret: false,
      check: (data) => {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        let prevMonth = currentMonth - 2;
        let prevYear = currentYear;
        if (prevMonth < 0) {
          prevMonth += 12;
          prevYear--;
        }
        
        const prevCapital = financeData[prevYear]?.[prevMonth]?.capital || 0;
        const currentCapital = data.capital;
        
        return prevCapital > 0 && (currentCapital / prevCapital) >= 2;
      }
    },
    {
      id: 'no_tracking',
      title: 'Ред флаг',
      description: 'Не записывать траты 1 месяц',
      emoji: '🚩',
      secret: false,
      check: (data) => data.expense === 0 && data.expensesHistory.length === 0
    },
    {
      id: 'overspending',
      title: 'Оказия',
      description: 'Потратить больше, чем заработал в течение месяца',
      emoji: '💸',
      secret: false,
      check: (data) => data.expense > data.income
    },
    {
      id: 'fast_spending',
      title: 'К чёрту стоп-кран!',
      description: 'Потратить 80% дохода в первые 24 часа',
      emoji: '🏎️',
      secret: false,
      check: (data) => {
        if (data.income === 0) return false;
        
        const firstDayExpenses = data.expensesHistory
          .filter(e => {
            const expenseDate = new Date(e.date);
            return expenseDate.getDate() === 1 && 
                   expenseDate.getMonth() === currentMonth &&
                   expenseDate.getFullYear() === currentYear;
          })
          .reduce((sum, e) => sum + e.amount, 0);
        
        return (firstDayExpenses / data.income) >= 0.8;
      }
    },
    {
      id: 'income_decline',
      title: 'Раньше было лучше',
      description: 'Заработать доход за этот месяц меньше, чем в прошлом',
      emoji: '📉',
      secret: false,
      check: (data) => {
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        
        const prevMonthIncome = financeData[prevYear]?.[prevMonth]?.income || 0;
        return data.income < prevMonthIncome;
      }
    },
    // Секретные достижения
    {
      id: 'secret_richest',
      title: 'Самый богатый человек подъезда',
      description: 'Накопить капитал > 900 000 ₽',
      emoji: '🏆',
      secret: true,
      check: (data) => data.capital > 900000
    },
    {
      id: 'secret_iMac',
      title: 'Мечта создателя Quick Note',
      description: 'Создать накопление "iMac"',
      emoji: '💻',
      secret: true,
      check: (data) => data.savingsWidgets?.some(w => w.name === 'iMac')
    },
    {
      id: 'secret_manhattan',
      title: 'В квартирке на Лесной',
      description: 'Создать категорию "Манхэттен"',
      emoji: '🍸',
      secret: true,
      check: (data) => Object.keys(data.categories).includes('Манхэттен')
    },
    {
      id: 'secret_devil',
      title: 'Чертила',
      description: 'Потратить 666 рублей за раз',
      emoji: '😈',
      secret: true,
      check: (data) => data.expensesHistory?.some(e => e.amount === 666)
    },
    // Новые достижения
    {
      id: 'better_than_most',
      title: "Лучше большинства",
      description: "Вы получите её сразу",
      emoji: "🏆",
      secret: false,
      check: () => true // Всегда разблокировано
    },
    {
      id: 'cant_get_this',
      title: "Ты не получишь это достижение",
      description: "Его нельзя получить",
      emoji: "🚫",
      secret: false,
      check: () => false // Никогда не разблокируется
    },
    {
      id: 'ghost_busters',
      title: "Ghost busters",
      description: "5 раз подряд переключить тему",
      emoji: "👻",
      secret: true,
      check: () => false // Разблокируется через специальный обработчик
    },
    {
      id: 'dungeons_and_dragons',
      title: "Подземелье и драконы",
      description: "Потянуть вниз когда страница уже не листается",
      emoji: "🐉",
      secret: true,
      check: () => false // Разблокируется через специальный обработчик
    },
    {
      id: 'do_re_mi',
      title: "До ре ми фа соль ля си",
      description: "Открыть месяцы по порядку: сентябрь, октябрь, ноябрь, декабрь, январь, февраль",
      emoji: "🎵",
      secret: true,
      check: () => false // Разблокируется через специальный обработчик
    }
  ];

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
    totalCapital: document.getElementById('total-capital'),
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
    achievementsBtn: document.getElementById('achievements-btn'),
    achievementsModal: document.getElementById('achievements-modal'),
    achievementsList: document.getElementById('achievements-list'),
    closeAchievements: document.getElementById('close-achievements'),
    resetBtn: document.getElementById('reset-btn'),
    transferDataBtn: document.getElementById('transfer-data-btn'),
    transferDataModal: document.getElementById('transfer-data-modal'),
    closeTransferData: document.getElementById('close-transfer-data'),
    // Новые элементы для упрощенного переноса данных
    exportFileBtn: null,
    exportClipboardBtn: null,
    importFileBtn: null,
    fileInput: null,
    selectedFileName: null,
    resetSlider: null,
    resetSliderValue: 0
  };

  // ==================== СВАЙП ДЛЯ ЗАКРЫТИЯ ВМЕСТО КНОПОК ====================

  function setupSwipeToClose() {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    let isSwiping = false;
    let currentModal = null;
    const swipeThreshold = 100; // Минимальное расстояние свайпа для закрытия
    const verticalThreshold = 30; // Максимальное вертикальное отклонение
    
    // Создаем индикатор свайпа
    const swipeIndicator = document.createElement('div');
    swipeIndicator.id = 'swipe-indicator';
    swipeIndicator.className = 'swipe-indicator';
    swipeIndicator.innerHTML = `
      <div class="swipe-arrow">←</div>
      <span class="swipe-text">Свайпните вправо для закрытия</span>
    `;
    document.body.appendChild(swipeIndicator);
    
    // Показать индикатор свайпа
    function showSwipeIndicator() {
      swipeIndicator.classList.add('show');
      setTimeout(() => {
        swipeIndicator.classList.remove('show');
      }, 2000);
    }
    
    // Скрыть индикатор свайпа
    function hideSwipeIndicator() {
      swipeIndicator.classList.remove('show');
    }
    
    // Анимация закрытия свайпом
    function swipeCloseModal(modal) {
      if (!modal || !modal.classList.contains('show')) return;
      
      // Добавляем анимацию выезда
      modal.classList.add('swipe-out');
      
      // Скрываем индикатор
      hideSwipeIndicator();
      
      // Закрываем модальное окно после анимации
      setTimeout(() => {
        closeFullscreenModal();
        modal.classList.remove('swipe-out');
      }, 300);
    }
    
    // Обработчик начала касания
    function handleTouchStart(e) {
      const modal = document.querySelector('.fullscreen-modal.show');
      if (!modal) return;
      
      currentModal = modal;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      isSwiping = true;
      
      // Показываем индикатор свайпа
      showSwipeIndicator();
    }
    
    // Обработчик движения пальца
    function handleTouchMove(e) {
      if (!isSwiping || !currentModal) return;
      
      touchEndX = e.touches[0].clientX;
      touchEndY = e.touches[0].clientY;
      
      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;
      
      // Проверяем, что свайп преимущественно горизонтальный
      if (Math.abs(deltaY) < verticalThreshold) {
        // Анимация сдвига модального окна при свайпе вправо
        if (deltaX > 0) {
          const translateX = Math.min(deltaX, 150);
          currentModal.style.transform = `translateX(${translateX}px)`;
          currentModal.style.opacity = Math.max(0.5, 1 - (translateX / 300));
        }
        
        e.preventDefault(); // Предотвращаем вертикальную прокрутку
      }
    }
    
    // Обработчик окончания касания
    function handleTouchEnd() {
      if (!isSwiping || !currentModal) return;
      
      isSwiping = false;
      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;
      
      // Проверяем условия для закрытия
      if (deltaX > swipeThreshold && Math.abs(deltaY) < verticalThreshold) {
        // Свайп вправо - закрыть
        swipeCloseModal(currentModal);
      } else {
        // Сброс анимации
        currentModal.style.transform = '';
        currentModal.style.opacity = '';
      }
      
      currentModal = null;
      hideSwipeIndicator();
    }
    
    // Добавляем обработчики событий для сенсорных устройств
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
    
    // Также добавляем поддержку мыши для десктопов
    let mouseStartX = 0;
    let mouseStartY = 0;
    let mouseIsDown = false;
    
    document.addEventListener('mousedown', (e) => {
      const modal = document.querySelector('.fullscreen-modal.show');
      if (!modal) return;
      
      currentModal = modal;
      mouseStartX = e.clientX;
      mouseStartY = e.clientY;
      mouseIsDown = true;
      
      showSwipeIndicator();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!mouseIsDown || !currentModal) return;
      
      const mouseEndX = e.clientX;
      const mouseEndY = e.clientY;
      const deltaX = mouseEndX - mouseStartX;
      const deltaY = mouseEndY - mouseStartY;
      
      if (Math.abs(deltaY) < verticalThreshold) {
        if (deltaX > 0) {
          const translateX = Math.min(deltaX, 150);
          currentModal.style.transform = `translateX(${translateX}px)`;
          currentModal.style.opacity = Math.max(0.5, 1 - (translateX / 300));
        }
      }
    });
    
    document.addEventListener('mouseup', (e) => {
      if (!mouseIsDown || !currentModal) return;
      
      mouseIsDown = false;
      const mouseEndX = e.clientX;
      const mouseEndY = e.clientY;
      const deltaX = mouseEndX - mouseStartX;
      const deltaY = mouseEndY - mouseStartY;
      
      if (deltaX > swipeThreshold && Math.abs(deltaY) < verticalThreshold) {
        swipeCloseModal(currentModal);
      } else {
        currentModal.style.transform = '';
        currentModal.style.opacity = '';
      }
      
      currentModal = null;
      hideSwipeIndicator();
    });
    
    // Показать индикатор при открытии модального окна
    const originalOpenFullscreenModal = openFullscreenModal;
    window.openFullscreenModal = function(modalElement) {
      originalOpenFullscreenModal(modalElement);
      setTimeout(showSwipeIndicator, 300);
    };
    
    // Скрыть индикатор при закрытии
    const originalCloseFullscreenModal = closeFullscreenModal;
    window.closeFullscreenModal = function() {
      originalCloseFullscreenModal();
      hideSwipeIndicator();
    };
    
    // Добавляем кнопку "Закрыть" внизу для альтернативного закрытия
    function addCloseButtonToModals() {
      const modals = [
        elements.settingsMenu,
        elements.historyModal,
        elements.achievementsModal,
        elements.transferDataModal
      ];
      
      modals.forEach(modal => {
        if (modal) {
          const closeButton = document.createElement('div');
          closeButton.className = 'swipe-close-hint';
          closeButton.innerHTML = `
            <button class="neumorphic-btn primary close-modal-btn">
              Закрыть
            </button>
            <p class="hint-text">Или свайпните вправо</p>
          `;
          modal.appendChild(closeButton);
          
          // Обработчик для кнопки закрытия
          modal.querySelector('.close-modal-btn')?.addEventListener('click', () => {
            closeFullscreenModal();
          });
        }
      });
    }
    
    // Инициализация кнопок закрытия
    addCloseButtonToModals();
  }

  // ==================== УПРОЩЕННЫЙ МОДУЛЬ ПЕРЕНОСА ДАННЫХ ====================

  // Инициализация упрощенного модуля переноса данных
  function initTransferDataModule() {
    // Обновляем HTML модального окна переноса данных
    elements.transferDataModal.innerHTML = `
      <div class="modal-header">
        <h3>Перенос данных</h3>
        <div class="header-placeholder"></div>
      </div>
      <div class="transfer-options">
        <div class="export-section">
          <h4>📤 Экспорт данных</h4>
          <p>Сохраните все данные в файл для резервного копирования или переноса</p>
          <button id="export-file-btn" class="neumorphic-btn primary">
            💾 Экспортировать в файл
          </button>
          <button id="export-clipboard-btn" class="neumorphic-btn">
            📋 Скопировать в буфер
          </button>
        </div>
        
        <div class="import-section">
          <h4>📥 Импорт данных</h4>
          <p>Загрузите файл с данными для восстановления</p>
          
          <div class="file-upload-area">
            <div class="file-input-wrapper">
              <input type="file" id="file-input" accept=".txt" class="hidden">
              <label for="file-input" class="file-input-label">
                📁 Выбрать файл (.txt)
              </label>
              <div id="selected-file-name" class="selected-file-name">
                Файл не выбран
              </div>
            </div>
            
            <button id="import-file-btn" class="neumorphic-btn primary" disabled>
              📥 Импортировать файл
            </button>
          </div>
        </div>
      </div>
      
      <div class="data-info">
        <p><small>📊 Экспортируется: финансы, бюджеты, накопления, фонды, достижения</small></p>
        <p><small>⚠️ Импорт полностью заменит текущие данные</small></p>
      </div>
      <div class="swipe-close-hint">
        <button class="neumorphic-btn primary close-modal-btn">
          Закрыть
        </button>
        <p class="hint-text">Или свайпните вправо</p>
      </div>
    `;

    // Обновляем ссылки на элементы
    elements.exportFileBtn = document.getElementById('export-file-btn');
    elements.exportClipboardBtn = document.getElementById('export-clipboard-btn');
    elements.importFileBtn = document.getElementById('import-file-btn');
    elements.fileInput = document.getElementById('file-input');
    elements.selectedFileName = document.getElementById('selected-file-name');
    
    // Настройка обработчиков событий
    setupTransferDataHandlers();
    
    // Добавляем стили
    addTransferDataStyles();
  }

  // Настройка обработчиков для переноса данных
  function setupTransferDataHandlers() {
    // Экспорт в файл
    elements.exportFileBtn.addEventListener('click', exportDataToFile);
    
    // Экспорт в буфер обмена
    elements.exportClipboardBtn.addEventListener('click', exportDataToClipboard);
    
    // Выбор файла для импорта
    elements.fileInput.addEventListener('change', handleFileSelect);
    
    // Импорт из файла
    elements.importFileBtn.addEventListener('click', () => {
      if (elements.fileInput.files.length > 0) {
        importDataFromFile(elements.fileInput.files[0]);
      }
    });
    
    // Обработчик для кнопки закрытия в модальном окне
    elements.transferDataModal.querySelector('.close-modal-btn')?.addEventListener('click', () => {
      elements.transferDataModal.classList.remove('show');
      // Сбрасываем состояние
      elements.fileInput.value = '';
      elements.selectedFileName.textContent = 'Файл не выбран';
      elements.importFileBtn.disabled = true;
    });
  }

  // Обработчик выбора файла
  function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
      if (file.name.toLowerCase().endsWith('.txt')) {
        elements.selectedFileName.textContent = `📄 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        elements.importFileBtn.disabled = false;
      } else {
        alert('Пожалуйста, выберите текстовый файл с расширением .txt');
        elements.fileInput.value = '';
        elements.selectedFileName.textContent = 'Файл не выбран';
        elements.importFileBtn.disabled = true;
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
      achievementsData,
      exportDate: new Date().toISOString(),
      appVersion: '2.0'
    };
    
    const dataStr = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([dataStr], { type: 'text/plain;charset=utf-8' });
    const timestamp = new Date().getTime();
    const fileName = `finance_data_${currentYear}_${timestamp}.txt`;
    
    // Для iOS используем Share API
    if ((isIOS || isTelegramIOS) && navigator.share) {
      try {
        const file = new File([blob], fileName, { type: 'text/plain' });
        
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Экспорт финансовых данных',
            text: 'Сохраните этот файл в приложении "Файлы"'
          });
          showSuccessMessage('Файл отправлен! Сохраните в "Файлы".');
          return;
        }
      } catch (error) {
        console.log('Web Share API failed:', error);
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
    
    if (isIOS || isTelegramIOS) {
      showIOSInstructions();
    } else {
      showSuccessMessage('Файл создан! Сохраните его на устройстве.');
    }
  }

  // Экспорт данных в буфер обмена
  async function exportDataToClipboard() {
    const dataToExport = {
      financeData,
      budgetData,
      savingsWidgets,
      fundWidgets,
      achievementsData,
      exportDate: new Date().toISOString(),
      appVersion: '2.0'
    };
    
    const dataStr = JSON.stringify(dataToExport, null, 2);
    
    try {
      await navigator.clipboard.writeText(dataStr);
      showSuccessMessage('Данные скопированы в буфер обмена!');
    } catch (err) {
      console.error('Ошибка копирования в буфер:', err);
      
      // Запасной вариант для старых браузеров
      const textArea = document.createElement('textarea');
      textArea.value = dataStr;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      showSuccessMessage('Данные скопированы в буфер обмена!');
    }
  }

  // Импорт данных из файла
  function importDataFromFile(file) {
    if (!file) {
      alert('Выберите файл для импорта');
      return;
    }
    
    // Проверяем расширение файла
    if (!file.name.toLowerCase().endsWith('.txt')) {
      alert('Пожалуйста, выберите текстовый файл (.txt)');
      elements.fileInput.value = '';
      elements.selectedFileName.textContent = 'Файл не выбран';
      elements.importFileBtn.disabled = true;
      return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const importedData = JSON.parse(e.target.result);
        processImportedData(importedData);
      } catch (error) {
        alert('Ошибка при чтении файла: ' + error.message);
        console.error('Import error:', error);
      }
    };
    
    reader.onerror = function() {
      alert('Ошибка при чтении файла');
    };
    
    reader.readAsText(file);
  }

  // Обработка импортированных данных
  function processImportedData(importedData) {
    // Проверяем структуру данных
    const requiredFields = ['financeData', 'budgetData', 'savingsWidgets', 'fundWidgets', 'achievementsData'];
    const isValid = requiredFields.every(field => importedData.hasOwnProperty(field));
    
    if (!isValid) {
      alert('Некорректный формат данных. Убедитесь, что это данные из этого приложения.');
      return;
    }
    
    if (confirm('Импортировать данные? Текущие данные будут заменены.')) {
      financeData = importedData.financeData || {};
      budgetData = importedData.budgetData || getDefaultBudgetData();
      savingsWidgets = importedData.savingsWidgets || [];
      fundWidgets = importedData.fundWidgets || [];
      achievementsData = importedData.achievementsData || {};
      
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
      
      // Сбрасываем форму
      elements.fileInput.value = '';
      elements.selectedFileName.textContent = 'Файл не выбран';
      elements.importFileBtn.disabled = true;
      elements.transferDataModal.classList.remove('show');
      
      showSuccessMessage('Данные успешно импортированы!');
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

  // Добавить стили для упрощенного модуля переноса данных
  function addTransferDataStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .transfer-options {
        display: flex;
        flex-direction: column;
        gap: 25px;
        margin: 20px 0;
      }
      
      .export-section, .import-section {
        background: var(--bg);
        border-radius: var(--border-radius);
        padding: 20px;
        box-shadow: 3px 3px 6px var(--shadow-dark), -3px -3px 6px var(--shadow-light);
      }
      
      .export-section h4, .import-section h4 {
        margin: 0 0 10px 0;
        color: var(--primary);
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .export-section p, .import-section p {
        margin: 0 0 15px 0;
        color: var(--text);
        opacity: 0.8;
        font-size: 0.9rem;
      }
      
      .export-section .neumorphic-btn,
      .import-section .neumorphic-btn {
        margin-top: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
      }
      
      .file-upload-area {
        margin: 20px 0;
        padding: 15px;
        background: rgba(0,0,0,0.03);
        border-radius: var(--border-radius);
      }
      
      body.dark .file-upload-area {
        background: rgba(255,255,255,0.05);
      }
      
      .file-input-wrapper {
        margin-bottom: 15px;
      }
      
      .file-input-label {
        display: block;
        padding: 15px;
        text-align: center;
        background: var(--bg);
        border-radius: var(--border-radius);
        box-shadow: 5px 5px 10px var(--shadow-dark), -5px -5px 10px var(--shadow-light);
        cursor: pointer;
        transition: var(--transition);
        font-weight: 600;
        margin-bottom: 10px;
      }
      
      .file-input-label:hover {
        background: var(--primary);
        color: white;
        transform: translateY(-2px);
      }
      
      .selected-file-name {
        text-align: center;
        padding: 10px;
        color: var(--text);
        opacity: 0.7;
        font-size: 0.9rem;
      }
      
      .data-info {
        margin-top: 20px;
        padding: 15px;
        background: rgba(52, 152, 219, 0.1);
        border-radius: var(--border-radius);
      }
      
      .data-info p {
        margin: 5px 0;
        font-size: 0.85rem;
        opacity: 0.8;
      }
      
      .data-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 3000;
      }
      
      .data-modal-content {
        background: var(--bg);
        padding: 25px;
        border-radius: var(--border-radius);
        max-width: 500px;
        width: 90%;
        box-shadow: 8px 8px 20px var(--shadow-dark), -8px -8px 20px var(--shadow-light);
      }
      
      .data-modal-content h3 {
        margin: 0 0 20px 0;
        text-align: center;
        color: var(--primary);
      }
      
      .ios-instructions {
        margin: 20px 0;
      }
      
      .ios-instructions h4 {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 0 0 15px 0;
      }
      
      .ios-instructions ol {
        margin: 0;
        padding-left: 20px;
        text-align: left;
      }
      
      .ios-instructions li {
        margin-bottom: 10px;
        line-height: 1.4;
      }
      
      .tip-box {
        margin-top: 20px;
        padding: 15px;
        background: rgba(46, 204, 113, 0.1);
        border-radius: var(--border-radius);
      }
      
      .tip-box p {
        margin: 0;
        font-size: 0.9rem;
      }
      
      .hidden {
        display: none !important;
      }
      
      @media (max-width: 480px) {
        .export-section, .import-section {
          padding: 15px;
        }
        
        .file-input-label {
          padding: 12px;
          font-size: 0.9rem;
        }
        
        .data-modal-content {
          padding: 20px;
        }
      }
    `;
    document.head.appendChild(style);
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
          audio.play().catch(e => console.log('Audio playback error:', e));
        } catch (e) {
          console.log('Audio error:', e);
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
        unlockAchievement('ghost_busters');
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

  // Проверка достижений
  function checkAchievements() {
    const monthData = financeData[currentYear][currentMonth];
    const data = {
      income: monthData.income,
      expense: monthData.expense,
      capital: monthData.capital,
      categories: monthData.categories,
      savingsWidgets: savingsWidgets,
      fundWidgets: fundWidgets,
      expensesHistory: monthData.expensesHistory
    };

    achievements.forEach(ach => {
      if (!achievementsData[ach.id] && ach.check(data)) {
        achievementsData[ach.id] = true;
        markDataChanged(); // Сохраняем разблокировку достижения
        showAchievementUnlocked(ach);
      }
    });
  }

  // Показать уведомление о разблокировке достижения
  function showAchievementUnlocked(achievement) {
    const notification = document.createElement('div');
    notification.className = 'achievement-notification';
    notification.innerHTML = `
      <div class="achievement-badge unlocked">
        <h4>Новое достижение!</h4>
        <h3>${achievement.emoji} ${achievement.title}</h3>
        <p>${achievement.description}</p>
      </div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 500);
    }, 5000);
  }

  // Разблокировать достижение по ID
  function unlockAchievement(id) {
    if (!achievementsData[id]) {
      achievementsData[id] = true;
      markDataChanged(); // Сохраняем изменение
      const achievement = achievements.find(a => a.id === id);
      if (achievement) showAchievementUnlocked(achievement);
    }
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

  // Проверка последовательности месяцев для достижения До ре ми фа соль ля си
  function checkMonthSequence(month) {
    monthSequence.push(month);
    
    // Проверяем, соответствует ли последовательность требуемой
    if (monthSequence.length > requiredMonthSequence.length) {
      monthSequence.shift();
    }
    
    if (arraysEqual(monthSequence, requiredMonthSequence)) {
      unlockAchievement('do_re_mi');
      monthSequence = [];
    }
  }

  // Сравнение массивов
  function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  // Отрисовка списка достижений
  function renderAchievementsList() {
    elements.achievementsList.innerHTML = '';
    
    achievements.forEach(ach => {
      const unlocked = achievementsData[ach.id];
      
      const achievementEl = document.createElement('div');
      achievementEl.className = `achievement-item ${unlocked ? 'unlocked' : 'locked'}`;
      
      // Для секретных и неразблокированных - скрываем описание
      const description = (ach.secret && !unlocked) ? 'Секретное достижение' : ach.description;
      
      achievementEl.innerHTML = `
        <div class="achievement-icon">${ach.emoji}</div>
        <div class="achievement-info">
          <h4>${ach.title}</h4>
          <p>${description}</p>
        </div>
      `;
      
      // Для неразблокированных секретных достижений добавляем класс
      if (ach.secret && !unlocked) {
        achievementEl.classList.add('secret');
      }
      
      elements.achievementsList.appendChild(achievementEl);
    });
  }

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
        options: getChartOptions('Капитализация')
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
    
    // Отрисовка истории трат
    renderExpenseHistory();
    
    // Отрисовка графиков динамики категорий
    renderCategoryTrends();
    
    // Проверка достижений
    checkAchievements();
  }

  // Отрисовка всех графиков
  function renderAllCharts() {
    renderChart();
    renderCapitalChart();
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
          <button class="neumorphic-btn small" data-category="${cat}">+</button>
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

  // Отрисовка графика капитализации
  function renderCapitalChart() {
    const ctx = document.getElementById('capitalChart')?.getContext('2d');
    if (!ctx) return;
    if (capitalChart) capitalChart.destroy();

    const monthData = financeData[currentYear][currentMonth];
    const capitalValue = monthData.capital || 0;
    const isDark = document.body.classList.contains('dark');

    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, '#3498db');
    gradient.addColorStop(1, '#2c3e50');

    capitalChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Капитализация'],
        datasets: [{
          label: 'Капитализация',
          data: [capitalValue],
          backgroundColor: 'rgba(52, 152, 219, 0.2)',
          borderColor: gradient,
          borderWidth: 3,
          tension: 0.3,
          fill: true,
          pointBackgroundColor: isDark ? '#1a1a1a' : '#fff',
          pointBorderColor: '#3498db',
          pointRadius: 6,
          pointHoverRadius: 8,
          pointBorderWidth: 2
        }]
      },
      options: getChartOptions('Капитализация')
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
        title: "Достижения",
        text: "Отслеживайте свои финансовые успехи через систему достижений. Разблокируйте их, выполняя различные условия."
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
  function toggleMenu(menuElement) {
    document.querySelectorAll('.neumorphic-menu').forEach(menu => {
      if (menu !== menuElement) menu.classList.remove('show');
    });
    
    const isOpening = !menuElement.classList.contains('show');
    menuElement.classList.toggle('show');
    
    if (isOpening) {
      document.body.classList.add('menu-open');
    } else {
      document.body.classList.remove('menu-open');
    }
    
    if (menuElement.classList.contains('show')) {
      menuElement.style.top = '50%';
      menuElement.style.left = '50%';
      menuElement.style.transform = 'translate(-50%, -50%)';
    }
  }

  // Функция для открытия полноэкранных модальных окон
  function openFullscreenModal(modalElement) {
    // Закрыть все другие модальные окна
    document.querySelectorAll('.neumorphic-menu').forEach(menu => {
      menu.classList.remove('show');
    });
    
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
      achievementsData = {};
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
      elements.categoryMenu.classList.toggle('show');
      elements.settingsMenu.classList.remove('show');
      elements.moreMenu.classList.remove('show');
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
      elements.moreMenu.classList.toggle('show');
      elements.settingsMenu.classList.remove('show');
      elements.categoryMenu.classList.remove('show');
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
        checkMonthSequence(currentMonth);
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

    // Достижения - полноэкранный режим
    elements.achievementsBtn.addEventListener('click', () => {
      elements.moreMenu.classList.remove('show');
      openFullscreenModal(elements.achievementsModal);
      renderAchievementsList();
    });

    // Кнопка сброса данных
    elements.resetBtn.addEventListener('click', () => {
      elements.moreMenu.classList.remove('show');
      showResetSlider();
    });

    // Перенос данных - упрощенная версия
    elements.transferDataBtn.addEventListener('click', () => {
      elements.moreMenu.classList.remove('show');
      openFullscreenModal(elements.transferDataModal);
    });

    // Обработчик для Подземелье и драконы (потягивание вниз)
    let lastScrollPosition = 0;
    const scrollable = document.getElementById('scrollable');
    scrollable.addEventListener('scroll', () => {
      const currentScroll = scrollable.scrollTop;
      if (currentScroll <= 0 && lastScrollPosition <= 0) {
        pullAttempts++;
        if (pullAttempts >= 3) {
          unlockAchievement('dungeons_and_dragons');
          pullAttempts = 0;
        }
      } else {
        pullAttempts = 0;
      }
      lastScrollPosition = currentScroll;
    });

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
        elements.achievementsModal,
        elements.transferDataModal
      ];
      
      const clickOutside = !menus.some(menu => menu.contains(e.target));
      
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
        elements.achievementsBtn,
        elements.resetBtn,
        elements.transferDataBtn
      ].some(button => button.contains(e.target));
      
      if (clickOutside && !isMenuButton) {
        menus.forEach(menu => menu.classList.remove('show'));
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
    console.log('🚀 Инициализация приложения...');
    
    // Инициализация свайпов для закрытия вместо кнопок
    setupSwipeToClose();
    
    // Инициализация упрощенного модуля переноса данных
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

    // Разблокируем достижение "Лучше большинства" при первом запуске
    if (!achievementsData['better_than_most']) {
      unlockAchievement('better_than_most');
    }

    // Сохранение при закрытии страницы
    window.addEventListener('beforeunload', function() {
      if (hasUnsavedChanges) {
        console.log('💾 Экстренное сохранение перед закрытием...');
        saveData();
      }
    });

    // Периодическое автосохранение
    setInterval(() => {
      if (hasUnsavedChanges) {
        console.log('💾 Автосохранение...');
        saveData();
      }
    }, 30000); // Каждые 30 секунд

    console.log('✅ Приложение инициализировано');
  }

  // Запуск приложения
  initializeApp();

  // Обработчики для кнопок заголовка
  window.addEventListener('load', adjustHeaderButtons);
  window.addEventListener('resize', adjustHeaderButtons);
});
