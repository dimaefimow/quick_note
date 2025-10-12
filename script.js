// Блокировка закрытия свайпом в Telegram Mini Apps
if (window.Telegram?.WebApp?.preventClose) {
  window.Telegram.WebApp.preventClose();
}

// Отключение вертикальных свайпов (для Telegram 7.7+)
if (window.Telegram?.WebApp?.disableVerticalSwipes) {
  window.Telegram.WebApp.disableVerticalSwipes();
}

// Глобальные переменные
let elements = {};
let financeData = {};
let budgetData = {
  totalAmount: 0,
  days: 0,
  startDate: null,
  spent: 0,
  dailyHistory: {}
};
let savingsWidgets = [];
let fundWidgets = [];
let achievementsData = {};
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let hasUnsavedChanges = false;
let saveTimeout = null;

// Переменные для графиков
let chart, capitalChart, miniCapitalChart, miniExpenseChart;

// Цвета для категорий
const categoryColors = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', 
  '#9b59b6', '#1abc9c', '#d35400', '#34495e',
  '#16a085', '#27ae60', '#2980b9', '#8e44ad',
  '#f1c40f', '#e67e22', '#c0392b'
];

// Названия месяцев
const monthNames = [
  'Январь', 'Февраль', 'Март', 'Апрель', 
  'Май', 'Июнь', 'Июль', 'Август', 
  'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

// Переменные для достижений
let themeToggleCount = 0;
let lastThemeToggleTime = 0;
let pullAttempts = 0;
let monthSequence = [];
let widgetClickCount = 0;
const requiredMonthSequence = [8, 9, 10, 11, 0, 1]; // Сентябрь-Февраль

// Список достижений
const achievements = [
  {
    id: 'better_than_most',
    title: "Лучше большинства",
    description: "Вы получите её сразу",
    emoji: "🏆",
    secret: false,
    check: () => true
  },
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
    id: 'food_category',
    title: 'Что на ужин?',
    description: 'Создать категорию «Еда»',
    emoji: '🍕',
    secret: false,
    check: (data) => Object.keys(data.categories).includes('Еда')
  },
  {
    id: 'ghost_busters',
    title: "Ghost busters",
    description: "5 раз подряд переключить тему",
    emoji: "👻",
    secret: true,
    check: () => false
  },
  {
    id: 'dungeons_and_dragons',
    title: "Подземелье и драконы",
    description: "Потянуть вниз когда страница уже не листается",
    emoji: "🐉",
    secret: true,
    check: () => false
  },
  {
    id: 'do_re_mi',
    title: "До ре ми фа соль ля си",
    description: "Открыть месяцы по порядку: сентябрь, октябрь, ноябрь, декабрь, январь, февраль",
    emoji: "🎵",
    secret: true,
    check: () => false
  }
];

// ==================== ОСНОВНЫЕ ФУНКЦИИ ====================

function formatCurrency(amount) {
  return new Intl.NumberFormat('ru-RU').format(amount) + ' ₽';
}

function showSuccessMessage(message) {
  // Создаем элемент уведомления
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #2ecc71;
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    font-weight: 600;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // Анимация появления
  setTimeout(() => {
    notification.style.opacity = '1';
    notification.style.transform = 'translateX(-50%) translateY(0)';
  }, 100);
  
  // Автоматическое скрытие
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(-50%) translateY(-20px)';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

function markDataChanged() {
  hasUnsavedChanges = true;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveData, 2000);
}

// ==================== РАБОТА С ДАННЫМИ ====================

function loadData() {
  try {
    // Загрузка из localStorage
    const financeDataStr = localStorage.getItem('financeData');
    const budgetDataStr = localStorage.getItem('budgetData');
    const savingsWidgetsStr = localStorage.getItem('savingsWidgets');
    const fundWidgetsStr = localStorage.getItem('fundWidgets');
    const achievementsDataStr = localStorage.getItem('achievementsData');
    
    // Парсинг данных
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
    
    // Инициализация года если нет данных
    if (!financeData[currentYear]) {
      initYearData(currentYear);
    }
    
    console.log('✅ Данные загружены');
  } catch (error) {
    console.error('❌ Ошибка загрузки данных:', error);
    initializeEmptyData();
  }
}

function saveData() {
  try {
    localStorage.setItem('financeData', JSON.stringify(financeData));
    localStorage.setItem('budgetData', JSON.stringify(budgetData));
    localStorage.setItem('savingsWidgets', JSON.stringify(savingsWidgets));
    localStorage.setItem('fundWidgets', JSON.stringify(fundWidgets));
    localStorage.setItem('achievementsData', JSON.stringify(achievementsData));
    
    hasUnsavedChanges = false;
    console.log('💾 Данные сохранены');
    return true;
  } catch (error) {
    console.error('❌ Ошибка сохранения:', error);
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

function initYearData(year) {
  if (!financeData[year]) {
    financeData[year] = {};
    for (let i = 0; i < 12; i++) {
      financeData[year][i] = {
        income: 0,
        expense: 0,
        categories: {},
        capital: 0,
        expensesHistory: []
      };
    }
  }
}

// ==================== ИНИЦИАЛИЗАЦИЯ ЭЛЕМЕНТОВ DOM ====================

function initializeDOMElements() {
  console.log('🔧 Инициализация элементов DOM...');
  
  elements = {
    // Основные элементы ввода
    incomeInput: document.getElementById('income-input'),
    addIncomeBtn: document.getElementById('add-income-btn'),
    
    // Отображение данных
    incomeDisplay: document.getElementById('income'),
    expenseDisplay: document.getElementById('expense'),
    percentDisplay: document.getElementById('percent'),
    capitalDisplay: document.getElementById('capital-display'),
    currentYearDisplay: document.getElementById('current-year-display'),
    
    // Кнопки верхней панели
    categoryBtn: document.getElementById('category-btn'),
    capitalizationBtn: document.getElementById('capitalization-btn'),
    settingsBtn: document.getElementById('settings-btn'),
    themeToggleBtn: document.getElementById('theme-toggle-btn'),
    moreBtn: document.getElementById('more-btn'),
    
    // Меню и модальные окна
    categoryMenu: document.getElementById('category-menu'),
    capitalizationMenu: document.getElementById('capitalization-menu'),
    settingsMenu: document.getElementById('settings-menu'),
    moreMenu: document.getElementById('more-menu'),
    savingsModal: document.getElementById('savings-modal'),
    fundModal: document.getElementById('fund-modal'),
    historyModal: document.getElementById('history-modal'),
    achievementsModal: document.getElementById('achievements-modal'),
    yearSelectModal: document.getElementById('year-select-modal'),
    transferDataModal: document.getElementById('transfer-data-modal'),
    setBudgetModal: document.getElementById('set-budget-modal'),
    
    // Кнопки закрытия
    closeCategoryWidget: document.getElementById('close-category-widget'),
    closeReportsBtn: document.getElementById('close-reports-btn'),
    closeHistory: document.getElementById('close-history'),
    closeAchievements: document.getElementById('close-achievements'),
    closeYearSelect: document.getElementById('close-year-select'),
    closeTransferData: document.getElementById('close-transfer-data'),
    
    // Категории
    newCategoryInput: document.getElementById('new-category-input'),
    addCategoryBtn: document.getElementById('add-category-btn'),
    categoriesList: document.getElementById('categories-list'),
    
    // Капитализация
    capitalInput: document.getElementById('capital-input'),
    saveCapitalBtn: document.getElementById('save-capital-btn'),
    cancelCapitalBtn: document.getElementById('cancel-capital-btn'),
    
    // Бюджет
    budgetSettingsBtn: document.getElementById('budget-settings-btn'),
    dailyBudgetAmount: document.getElementById('daily-budget-amount'),
    budgetProgress: document.getElementById('budget-progress'),
    budgetAmount: document.getElementById('budget-amount'),
    budgetDays: document.getElementById('budget-days'),
    saveBudgetBtn: document.getElementById('save-budget-btn'),
    cancelBudgetBtn: document.getElementById('cancel-budget-btn'),
    daysProgressBar: document.querySelector('.days-progress'),
    fundsProgressBar: document.querySelector('.funds-progress'),
    daysProgressValue: document.getElementById('days-progress-value'),
    fundsProgressValue: document.getElementById('funds-progress-value'),
    
    // Виджеты
    widgetsContainer: document.getElementById('widgets'),
    
    // Дополнительные функции
    enableSavingsBtn: document.getElementById('enable-savings-btn'),
    enableFundBtn: document.getElementById('enable-fund-btn'),
    yearSelectBtn: document.getElementById('year-select-btn'),
    historyBtn: document.getElementById('history-btn'),
    achievementsBtn: document.getElementById('achievements-btn'),
    transferDataBtn: document.getElementById('transfer-data-btn'),
    resetBtn: document.getElementById('reset-btn'),
    
    // Перенос данных
    exportDataBtn: document.getElementById('export-data-btn'),
    importDataBtn: document.getElementById('import-data-btn'),
    importDataInput: document.getElementById('import-data-input'),
    
    // Год
    addYearBtn: document.getElementById('add-year-btn'),
    yearsList: document.getElementById('years-list'),
    
    // Отчеты
    avgIncome: document.getElementById('avg-income'),
    avgExpense: document.getElementById('avg-expense'),
    bestMonth: document.getElementById('best-month'),
    totalIncome: document.getElementById('total-income'),
    totalExpense: document.getElementById('total-expense'),
    topCategoriesList: document.getElementById('top-categories-list'),
    
    // История и достижения
    historyList: document.getElementById('history-list'),
    achievementsList: document.getElementById('achievements-list'),
    
    // Месяцы
    monthTabs: document.querySelectorAll('.month-tab'),
    
    // Фон для модальных окон
    fullscreenBackdrop: document.getElementById('fullscreen-backdrop')
  };
  
  console.log('✅ Элементы DOM инициализированы');
}

// ==================== ОБРАБОТЧИКИ СОБЫТИЙ ====================

function initializeEventListeners() {
  console.log('🎯 Инициализация обработчиков событий...');
  
  // Основные кнопки
  elements.addIncomeBtn.addEventListener('click', addIncome);
  elements.incomeInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') addIncome();
  });
  
  // Верхняя панель кнопок
  elements.categoryBtn.addEventListener('click', toggleCategoryMenu);
  elements.capitalizationBtn.addEventListener('click', toggleCapitalizationMenu);
  elements.settingsBtn.addEventListener('click', toggleReportsMenu);
  elements.themeToggleBtn.addEventListener('click', toggleTheme);
  elements.moreBtn.addEventListener('click', toggleMoreMenu);
  
  // Кнопки закрытия
  elements.closeCategoryWidget.addEventListener('click', closeAllMenus);
  elements.closeReportsBtn.addEventListener('click', closeAllMenus);
  elements.closeHistory.addEventListener('click', closeAllMenus);
  elements.closeAchievements.addEventListener('click', closeAllMenus);
  elements.closeYearSelect.addEventListener('click', closeAllMenus);
  elements.closeTransferData.addEventListener('click', closeAllMenus);
  
  // Категории
  elements.addCategoryBtn.addEventListener('click', addCategory);
  elements.newCategoryInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') addCategory();
  });
  
  // Капитализация
  elements.saveCapitalBtn.addEventListener('click', saveCapital);
  elements.cancelCapitalBtn.addEventListener('click', closeAllMenus);
  
  // Бюджет
  elements.budgetSettingsBtn.addEventListener('click', toggleBudgetModal);
  elements.saveBudgetBtn.addEventListener('click', saveBudget);
  elements.cancelBudgetBtn.addEventListener('click', closeBudgetModal);
  
  // Дополнительное меню
  elements.enableSavingsBtn.addEventListener('click', showSavingsModal);
  elements.enableFundBtn.addEventListener('click', showFundModal);
  elements.yearSelectBtn.addEventListener('click', showYearSelectModal);
  elements.historyBtn.addEventListener('click', showHistoryModal);
  elements.achievementsBtn.addEventListener('click', showAchievementsModal);
  elements.transferDataBtn.addEventListener('click', showTransferDataModal);
  elements.resetBtn.addEventListener('click', showResetModal);
  
  // Перенос данных
  elements.exportDataBtn.addEventListener('click', exportData);
  elements.importDataBtn.addEventListener('click', importData);
  
  // Год
  elements.addYearBtn.addEventListener('click', addNewYear);
  
  // Месяцы
  elements.monthTabs.forEach(tab => {
    tab.addEventListener('click', function() {
      switchMonth(parseInt(this.dataset.month));
    });
  });
  
  // Закрытие меню при клике вне их
  document.addEventListener('click', function(event) {
    if (!event.target.closest('.header-buttons') && 
        !event.target.closest('.neumorphic-menu') &&
        !event.target.closest('.category-widget') &&
        !event.target.closest('.neumorphic-btn')) {
      closeAllMenus();
    }
  });
  
  // Обработчик прокрутки для достижения "Подземелье и драконы"
  const scrollable = document.getElementById('scrollable');
  let lastScrollPosition = 0;
  
  if (scrollable) {
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
  }
  
  console.log('✅ Обработчики событий инициализированы');
}

// ==================== УПРАВЛЕНИЕ МЕНЮ ====================

function toggleCategoryMenu() {
  closeAllMenus();
  elements.categoryMenu.style.display = 'block';
  updateCategoriesList();
}

function toggleCapitalizationMenu() {
  closeAllMenus();
  elements.capitalizationMenu.style.display = 'block';
  elements.capitalInput.value = financeData[currentYear][currentMonth].capital || '';
}

function toggleReportsMenu() {
  closeAllMenus();
  elements.settingsMenu.style.display = 'block';
  elements.fullscreenBackdrop.style.display = 'block';
  updateFinancialReports();
  renderMiniCharts();
}

function toggleMoreMenu() {
  closeAllMenus();
  elements.moreMenu.style.display = 'block';
}

function toggleTheme() {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  
  const themeIcon = elements.themeToggleBtn.querySelector('.theme-icon');
  if (themeIcon) {
    themeIcon.textContent = isDark ? '☀️' : '🌙';
  }
  
  // Проверка достижения Ghost busters
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
}

function closeAllMenus() {
  const menus = [
    elements.categoryMenu,
    elements.capitalizationMenu,
    elements.settingsMenu,
    elements.moreMenu,
    elements.savingsModal,
    elements.fundModal,
    elements.historyModal,
    elements.achievementsModal,
    elements.yearSelectModal,
    elements.transferDataModal,
    elements.setBudgetModal
  ];
  
  menus.forEach(menu => {
    if (menu) menu.style.display = 'none';
  });
  
  if (elements.fullscreenBackdrop) {
    elements.fullscreenBackdrop.style.display = 'none';
  }
}

function showSavingsModal() {
  closeAllMenus();
  createNewSavingsWidget();
}

function showFundModal() {
  closeAllMenus();
  createNewFundWidget();
}

function showHistoryModal() {
  closeAllMenus();
  elements.historyModal.style.display = 'block';
  elements.fullscreenBackdrop.style.display = 'block';
  renderExpenseHistory();
}

function showAchievementsModal() {
  closeAllMenus();
  elements.achievementsModal.style.display = 'block';
  elements.fullscreenBackdrop.style.display = 'block';
  renderAchievementsList();
}

function showYearSelectModal() {
  closeAllMenus();
  elements.yearSelectModal.style.display = 'block';
  renderYearSelection();
}

function showTransferDataModal() {
  closeAllMenus();
  elements.transferDataModal.style.display = 'block';
}

function toggleBudgetModal() {
  closeAllMenus();
  elements.setBudgetModal.style.display = 'block';
  elements.budgetAmount.value = budgetData.totalAmount || '';
  elements.budgetDays.value = budgetData.days || '';
}

function closeBudgetModal() {
  elements.setBudgetModal.style.display = 'none';
}

// ==================== ОСНОВНЫЕ ОПЕРАЦИИ ====================

function addIncome() {
  const amount = parseFloat(elements.incomeInput.value);
  if (!isNaN(amount) && amount > 0) {
    financeData[currentYear][currentMonth].income += amount;
    elements.incomeInput.value = '';
    updateUI();
    markDataChanged();
    
    // Анимация кнопки
    elements.addIncomeBtn.classList.add('pulse');
    setTimeout(() => elements.addIncomeBtn.classList.remove('pulse'), 500);
  }
}

function addCategory() {
  const categoryName = elements.newCategoryInput.value.trim();
  if (categoryName) {
    // Добавляем категорию во все месяцы текущего года
    for (let i = 0; i < 12; i++) {
      if (!financeData[currentYear][i].categories[categoryName]) {
        financeData[currentYear][i].categories[categoryName] = 0;
      }
    }
    
    elements.newCategoryInput.value = '';
    updateUI();
    markDataChanged();
    
    // Проверка достижений
    checkAchievements();
  }
}

function saveCapital() {
  const amount = parseFloat(elements.capitalInput.value);
  if (!isNaN(amount)) {
    financeData[currentYear][currentMonth].capital = amount;
    updateUI();
    closeAllMenus();
    markDataChanged();
  }
}

function saveBudget() {
  const amount = parseFloat(elements.budgetAmount.value);
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
    
    closeBudgetModal();
    updateUI();
    markDataChanged();
    showSuccessMessage('Бюджет установлен!');
  }
}

function switchMonth(month) {
  currentMonth = month;
  
  // Проверка последовательности месяцев для достижения "До ре ми"
  monthSequence.push(month);
  if (monthSequence.length > requiredMonthSequence.length) {
    monthSequence.shift();
  }
  
  // Проверяем совпадение с требуемой последовательностью
  if (monthSequence.length === requiredMonthSequence.length) {
    let match = true;
    for (let i = 0; i < requiredMonthSequence.length; i++) {
      if (monthSequence[i] !== requiredMonthSequence[i]) {
        match = false;
        break;
      }
    }
    if (match) {
      unlockAchievement('do_re_mi');
      monthSequence = [];
    }
  }
  
  updateUI();
}

// ==================== ОБНОВЛЕНИЕ ИНТЕРФЕЙСА ====================

function updateUI() {
  const monthData = financeData[currentYear][currentMonth];
  
  // Обновление основных показателей
  elements.incomeDisplay.textContent = formatCurrency(monthData.income);
  elements.expenseDisplay.textContent = formatCurrency(monthData.expense);
  elements.capitalDisplay.textContent = formatCurrency(monthData.capital || 0);
  elements.currentYearDisplay.textContent = `Год: ${currentYear}`;
  
  // Расчет процента остатка
  const remaining = monthData.income - monthData.expense;
  const percentage = monthData.income > 0 ? Math.round((remaining / monthData.income) * 100) : 0;
  elements.percentDisplay.textContent = (remaining < 0 ? '-' : '') + Math.abs(percentage) + '%';
  
  if (remaining < 0) {
    elements.percentDisplay.classList.add('negative');
    elements.percentDisplay.style.color = '#e74c3c';
  } else {
    elements.percentDisplay.classList.remove('negative');
    elements.percentDisplay.style.color = percentage < 20 ? '#f39c12' : '#2ecc71';
  }
  
  // Обновление активного месяца
  elements.monthTabs.forEach(tab => {
    const month = parseInt(tab.dataset.month);
    tab.classList.toggle('active', month === currentMonth);
  });
  
  // Обновление виджетов и отчетов
  updateCategoriesList();
  renderWidgets();
  updateBudgetWidget();
  updateFinancialReports();
  renderAllCharts();
  
  // Проверка достижений
  checkAchievements();
}

function updateCategoriesList() {
  if (!elements.categoriesList) return;
  
  elements.categoriesList.innerHTML = '';
  const categories = financeData[currentYear][currentMonth].categories;
  
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
  
  // Обработчики удаления категорий
  document.querySelectorAll('.delete-category-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const category = this.getAttribute('data-category');
      if (confirm(`Удалить категорию "${category}"?`)) {
        deleteCategory(category);
      }
    });
  });
}

function deleteCategory(category) {
  const monthData = financeData[currentYear][currentMonth];
  const categoryExpense = monthData.categories[category] || 0;
  
  monthData.expense -= categoryExpense;
  delete monthData.categories[category];
  
  updateUI();
  markDataChanged();
}

// ==================== ВИДЖЕТЫ ====================

function renderWidgets() {
  if (!elements.widgetsContainer) return;
  
  elements.widgetsContainer.innerHTML = '';
  const monthData = financeData[currentYear][currentMonth];
  const categories = monthData.categories;
  
  // Виджеты накоплений
  savingsWidgets.forEach(widget => {
    const widgetElement = createSavingsWidget(widget);
    elements.widgetsContainer.appendChild(widgetElement);
  });
  
  // Виджеты фондов
  fundWidgets.forEach(widget => {
    const widgetElement = createFundWidget(widget);
    elements.widgetsContainer.appendChild(widgetElement);
  });
  
  // Виджеты категорий расходов
  Object.entries(categories).forEach(([category, amount], index) => {
    const widget = createCategoryWidget(category, amount, index);
    elements.widgetsContainer.appendChild(widget);
  });
}

function createSavingsWidget(widget) {
  const widgetElement = document.createElement('div');
  widgetElement.className = 'neumorphic-card widget savings-widget';
  widgetElement.dataset.widgetId = widget.id;
  
  const progress = widget.goal > 0 ? Math.min(100, Math.round((widget.current / widget.goal) * 100)) : 0;
  
  widgetElement.innerHTML = `
    <button class="delete-widget-btn" data-widget-id="${widget.id}">×</button>
    <h3 style="color: #2ecc71">${widget.name}</h3>
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
  
  // Обработчики для виджетов накоплений
  widgetElement.querySelector('.add-savings-btn').addEventListener('click', addToSavings);
  widgetElement.querySelector('.delete-widget-btn').addEventListener('click', deleteSavingsWidget);
  
  return widgetElement;
}

function createFundWidget(widget) {
  const widgetElement = document.createElement('div');
  widgetElement.className = 'neumorphic-card widget fund-widget';
  widgetElement.dataset.widgetId = widget.id;
  
  const spent = widget.initialAmount - widget.current;
  const progress = widget.initialAmount > 0 ? Math.min(100, Math.round((spent / widget.initialAmount) * 100)) : 0;
  
  widgetElement.innerHTML = `
    <button class="delete-widget-btn" data-widget-id="${widget.id}">×</button>
    <h3 style="color: #e67e22">${widget.name}</h3>
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
  
  // Обработчики для виджетов фондов
  widgetElement.querySelector('.add-fund-btn').addEventListener('click', subtractFromFund);
  widgetElement.querySelector('.delete-widget-btn').addEventListener('click', deleteFundWidget);
  
  return widgetElement;
}

function createCategoryWidget(category, amount, index) {
  const widget = document.createElement('div');
  widget.className = 'neumorphic-card widget';
  const color = categoryColors[index % categoryColors.length];
  
  widget.innerHTML = `
    <div class="widget-header">
      <h3 style="color: ${color}">${category}</h3>
      <div class="widget-actions">
        <button class="delete-widget-btn" data-category="${category}">×</button>
      </div>
    </div>
    <p>${formatCurrency(amount)}</p>
    <div class="widget-input-group">
      <input type="number" class="neumorphic-input widget-input" placeholder="Сумма" id="expense-${category}">
      <button class="neumorphic-btn small" data-category="${category}">+</button>
    </div>
  `;
  
  // Обработчики для виджетов категорий
  widget.addEventListener('click', function() {
    widgetClickCount++;
    if (widgetClickCount >= 15) {
      triggerFallAnimation();
      widgetClickCount = 0;
    }
  });
  
  widget.querySelector('.neumorphic-btn.small').addEventListener('click', function() {
    const category = this.getAttribute('data-category');
    addExpenseToCategory(category);
  });
  
  widget.querySelector('.delete-widget-btn').addEventListener('click', function() {
    const category = this.getAttribute('data-category');
    deleteWidget(category);
  });
  
  return widget;
}

function addExpenseToCategory(category) {
  const input = document.getElementById(`expense-${category}`);
  const amount = parseFloat(input.value);
  
  if (!isNaN(amount) && amount > 0) {
    const monthData = financeData[currentYear][currentMonth];
    
    monthData.expense += amount;
    monthData.categories[category] = (monthData.categories[category] || 0) + amount;
    
    // Добавляем в историю
    monthData.expensesHistory.push({
      category: category,
      amount: amount,
      date: new Date().toLocaleString()
    });
    
    input.value = '';
    updateUI();
    markDataChanged();
    
    // Анимация кнопки
    const btn = input.nextElementSibling;
    btn.classList.add('pulse');
    setTimeout(() => btn.classList.remove('pulse'), 500);
  }
}

function deleteWidget(category) {
  if (confirm(`Удалить категорию "${category}"?`)) {
    const monthData = financeData[currentYear][currentMonth];
    const categoryExpense = monthData.categories[category] || 0;
    
    monthData.expense -= categoryExpense;
    delete monthData.categories[category];
    
    updateUI();
    markDataChanged();
  }
}

// ==================== НАКОПЛЕНИЯ И ФОНДЫ ====================

function createNewSavingsWidget() {
  const name = prompt('Введите название цели накоплений:');
  if (!name) return;
  
  const goal = parseFloat(prompt('Введите целевую сумму:'));
  if (isNaN(goal) || goal <= 0) return;
  
  const widgetId = Date.now().toString();
  const newWidget = {
    id: widgetId,
    name: name,
    goal: goal,
    current: 0,
    color: '#2ecc71'
  };
  
  savingsWidgets.push(newWidget);
  markDataChanged();
  updateUI();
  showSuccessMessage('Цель накоплений создана!');
}

function createNewFundWidget() {
  const name = prompt('Введите название фонда:');
  if (!name) return;
  
  const amount = parseFloat(prompt('Введите начальную сумму фонда:'));
  if (isNaN(amount) || amount <= 0) return;
  
  const widgetId = Date.now().toString();
  const newWidget = {
    id: widgetId,
    name: name,
    initialAmount: amount,
    current: amount,
    color: '#e67e22'
  };
  
  fundWidgets.push(newWidget);
  markDataChanged();
  updateUI();
  showSuccessMessage('Фонд создан!');
}

function addToSavings() {
  const widgetId = this.dataset.widgetId;
  const input = document.querySelector(`.savings-amount[data-widget-id="${widgetId}"]`);
  const amount = parseFloat(input.value);
  
  if (!isNaN(amount) && amount > 0) {
    const widgetIndex = savingsWidgets.findIndex(w => w.id === widgetId);
    if (widgetIndex !== -1) {
      savingsWidgets[widgetIndex].current += amount;
      markDataChanged();
      updateUI();
      input.value = '';
    }
  }
}

function subtractFromFund() {
  const widgetId = this.dataset.widgetId;
  const input = document.querySelector(`.fund-amount[data-widget-id="${widgetId}"]`);
  const amount = parseFloat(input.value);
  
  if (!isNaN(amount) && amount > 0) {
    const widgetIndex = fundWidgets.findIndex(w => w.id === widgetId);
    if (widgetIndex !== -1 && fundWidgets[widgetIndex].current >= amount) {
      fundWidgets[widgetIndex].current -= amount;
      markDataChanged();
      updateUI();
      input.value = '';
    } else if (widgetIndex !== -1) {
      alert('Недостаточно средств в фонде!');
    }
  }
}

function deleteSavingsWidget() {
  const widgetId = this.dataset.widgetId;
  if (confirm('Удалить этот виджет накоплений?')) {
    savingsWidgets = savingsWidgets.filter(w => w.id !== widgetId);
    markDataChanged();
    updateUI();
  }
}

function deleteFundWidget() {
  const widgetId = this.dataset.widgetId;
  if (confirm('Удалить этот фонд?')) {
    fundWidgets = fundWidgets.filter(w => w.id !== widgetId);
    markDataChanged();
    updateUI();
  }
}

// ==================== БЮДЖЕТ ====================

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
  
  // Проверяем, не истек ли бюджетный период
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

  const dailyBudget = budgetData.totalAmount / budgetData.days;
  
  elements.dailyBudgetAmount.textContent = formatCurrency(dailyBudget);
  elements.budgetProgress.textContent = `Осталось: ${remainingDays} дн.`;
  
  const daysProgress = (elapsedDays / budgetData.days) * 100;
  const fundsProgress = (financeData[currentYear][currentMonth].expense / budgetData.totalAmount) * 100;
  
  if (elements.daysProgressBar) elements.daysProgressBar.style.width = `${Math.min(daysProgress, 100)}%`;
  if (elements.fundsProgressBar) elements.fundsProgressBar.style.width = `${Math.min(fundsProgress, 100)}%`;
  if (elements.daysProgressValue) elements.daysProgressValue.textContent = `${Math.round(Math.min(daysProgress, 100))}%`;
  if (elements.fundsProgressValue) elements.fundsProgressValue.textContent = `${Math.round(Math.min(fundsProgress, 100))}%`;
}

// ==================== ОТЧЕТЫ И АНАЛИТИКА ====================

function updateFinancialReports() {
  let totalIncome = 0;
  let totalExpense = 0;
  let bestMonthValue = 0;
  let bestMonthName = '';
  
  for (let i = 0; i < 12; i++) {
    const monthData = financeData[currentYear][i] || { income: 0, expense: 0 };
    totalIncome += monthData.income || 0;
    totalExpense += monthData.expense || 0;
    
    if (monthData.income > bestMonthValue) {
      bestMonthValue = monthData.income;
      bestMonthName = monthNames[i];
    }
  }
  
  elements.avgIncome.textContent = formatCurrency(Math.round(totalIncome / 12));
  elements.avgExpense.textContent = formatCurrency(Math.round(totalExpense / 12));
  elements.totalIncome.textContent = formatCurrency(totalIncome);
  elements.totalExpense.textContent = formatCurrency(totalExpense);
  
  if (bestMonthName) {
    elements.bestMonth.textContent = `${bestMonthName}\n+${formatCurrency(bestMonthValue)}`;
  } else {
    elements.bestMonth.textContent = 'Нет данных';
  }
  
  renderTopCategoriesReport();
}

function renderTopCategoriesReport() {
  if (!elements.topCategoriesList) return;
  
  elements.topCategoriesList.innerHTML = '';
  
  // Собираем все категории за год
  const categoryTotals = {};
  
  for (let month = 0; month < 12; month++) {
    const categories = financeData[currentYear][month].categories;
    for (const [category, amount] of Object.entries(categories)) {
      categoryTotals[category] = (categoryTotals[category] || 0) + amount;
    }
  }
  
  // Сортируем по убыванию и берем топ-5
  const topCategories = Object.entries(categoryTotals)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);
  
  topCategories.forEach(([category, amount], index) => {
    const categoryElement = document.createElement('div');
    categoryElement.className = 'category-item';
    categoryElement.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="color: ${categoryColors[index % categoryColors.length]}; font-weight: bold;">■</span>
        <span>${category}</span>
      </div>
      <div style="text-align: right;">
        <div>${formatCurrency(amount)}</div>
      </div>
    `;
    elements.topCategoriesList.appendChild(categoryElement);
  });
}

// ==================== ГРАФИКИ ====================

function renderAllCharts() {
  renderChart();
  renderCapitalChart();
  renderMiniCharts();
}

function renderChart() {
  const ctx = document.getElementById('barChart')?.getContext('2d');
  if (!ctx) return;
  
  if (chart) chart.destroy();

  const monthData = financeData[currentYear][currentMonth];
  const categoryNames = Object.keys(monthData.categories);
  const values = Object.values(monthData.categories);

  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: categoryNames,
      datasets: [{
        label: 'Расходы',
        data: values,
        backgroundColor: categoryNames.map((_, index) => categoryColors[index % categoryColors.length]),
        borderColor: 'transparent',
        borderWidth: 0,
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(0,0,0,0.05)',
          }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

function renderCapitalChart() {
  const ctx = document.getElementById('capitalChart')?.getContext('2d');
  if (!ctx) return;
  
  if (capitalChart) capitalChart.destroy();

  const monthData = financeData[currentYear][currentMonth];
  const capitalValue = monthData.capital || 0;

  capitalChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Капитализация'],
      datasets: [{
        label: 'Капитализация',
        data: [capitalValue],
        backgroundColor: 'rgba(52, 152, 219, 0.2)',
        borderColor: '#3498db',
        borderWidth: 3,
        tension: 0.3,
        fill: true,
        pointBackgroundColor: '#fff',
        pointBorderColor: '#3498db',
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

function renderMiniCharts() {
  const labels = monthNames.map(name => name.substring(0, 3));
  const capitalData = [];
  const expenseData = [];
  
  for (let i = 0; i < 12; i++) {
    const monthData = financeData[currentYear][i] || { income: 0, expense: 0, capital: 0 };
    capitalData.push(monthData.capital);
    expenseData.push(monthData.expense);
  }
  
  // График капитализации
  if (miniCapitalChart) miniCapitalChart.destroy();
  const capitalCtx = document.getElementById('miniCapitalChart')?.getContext('2d');
  if (capitalCtx) {
    miniCapitalChart = new Chart(capitalCtx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          data: capitalData,
          borderColor: '#3498db',
          backgroundColor: 'rgba(52, 152, 219, 0.1)',
          borderWidth: 3,
          tension: 0.3,
          fill: true,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }
  
  // График расходов
  if (miniExpenseChart) miniExpenseChart.destroy();
  const expenseCtx = document.getElementById('miniExpenseChart')?.getContext('2d');
  if (expenseCtx) {
    miniExpenseChart = new Chart(expenseCtx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          data: expenseData,
          backgroundColor: 'rgba(231, 76, 60, 0.8)',
          borderColor: 'transparent',
          borderWidth: 0,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }
}

// ==================== ИСТОРИЯ ====================

function renderExpenseHistory() {
  if (!elements.historyList) return;
  
  elements.historyList.innerHTML = '';
  const monthData = financeData[currentYear][currentMonth];
  const history = monthData.expensesHistory || [];
  
  if (history.length === 0) {
    elements.historyList.innerHTML = '<p style="text-align: center; padding: 20px; color: #666;">История трат пуста</p>';
    return;
  }
  
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

  // Обработчики удаления записей истории
  document.querySelectorAll('.delete-history-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const index = parseInt(this.getAttribute('data-index'));
      deleteExpenseFromHistory(index);
    });
  });
}

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
    
    updateUI();
    markDataChanged();
    
    showSuccessMessage(`Трата "${expense.category}" удалена`);
  }
}

// ==================== ДОСТИЖЕНИЯ ====================

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
      unlockAchievement(ach.id);
    }
  });
}

function unlockAchievement(id) {
  if (!achievementsData[id]) {
    achievementsData[id] = true;
    markDataChanged();
    const achievement = achievements.find(a => a.id === id);
    if (achievement) showAchievementUnlocked(achievement);
  }
}

function showAchievementUnlocked(achievement) {
  const notification = document.createElement('div');
  notification.className = 'achievement-notification';
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px;
    border-radius: 12px;
    box-shadow: 0 8px 25px rgba(0,0,0,0.3);
    z-index: 10000;
    text-align: center;
    max-width: 300px;
    width: 90%;
  `;
  notification.innerHTML = `
    <div style="font-size: 2rem; margin-bottom: 10px;">${achievement.emoji}</div>
    <h4 style="margin: 0 0 8px 0; font-size: 1.1rem;">Достижение разблокировано!</h4>
    <h3 style="margin: 0 0 8px 0; font-size: 1.3rem;">${achievement.title}</h3>
    <p style="margin: 0; opacity: 0.9;">${achievement.description}</p>
  `;
  document.body.appendChild(notification);
  
  // Анимация появления
  setTimeout(() => {
    notification.style.opacity = '1';
    notification.style.transform = 'translateX(-50%) translateY(0)';
  }, 100);
  
  // Автоматическое скрытие
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(-50%) translateY(20px)';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 5000);
}

function renderAchievementsList() {
  if (!elements.achievementsList) return;
  
  elements.achievementsList.innerHTML = '';
  
  achievements.forEach(ach => {
    const unlocked = achievementsData[ach.id];
    
    const achievementEl = document.createElement('div');
    achievementEl.className = `achievement-item ${unlocked ? 'unlocked' : 'locked'}`;
    achievementEl.style.cssText = `
      display: flex;
      align-items: center;
      padding: 15px;
      margin: 10px 0;
      border-radius: 10px;
      background: ${unlocked ? 'rgba(46, 204, 113, 0.1)' : 'rgba(0,0,0,0.05)'};
      border-left: 4px solid ${unlocked ? '#2ecc71' : '#ccc'};
    `;
    
    const description = (ach.secret && !unlocked) ? 'Секретное достижение' : ach.description;
    
    achievementEl.innerHTML = `
      <div style="font-size: 2rem; margin-right: 15px;">${unlocked ? ach.emoji : '🔒'}</div>
      <div style="flex: 1;">
        <h4 style="margin: 0 0 5px 0; color: ${unlocked ? '#2c3e50' : '#95a5a6'}">${ach.title}</h4>
        <p style="margin: 0; color: ${unlocked ? '#7f8c8d' : '#bdc3c7'}">${description}</p>
      </div>
    `;
    
    elements.achievementsList.appendChild(achievementEl);
  });
}

// ==================== РАБОТА С ГОДАМИ ====================

function renderYearSelection() {
  if (!elements.yearsList) return;
  
  elements.yearsList.innerHTML = '';
  
  const years = Object.keys(financeData).sort((a, b) => b - a);
  
  years.forEach(year => {
    const yearBtn = document.createElement('button');
    yearBtn.className = 'year-btn';
    yearBtn.style.cssText = `
      display: block;
      width: 100%;
      padding: 12px;
      margin: 5px 0;
      border: none;
      border-radius: 8px;
      background: var(--bg);
      color: var(--text);
      cursor: pointer;
      font-size: 1.1rem;
      text-align: center;
    `;
    yearBtn.textContent = year;
    yearBtn.addEventListener('click', () => {
      currentYear = parseInt(year);
      elements.yearSelectModal.style.display = 'none';
      updateUI();
    });
    elements.yearsList.appendChild(yearBtn);
  });
}

function addNewYear() {
  const newYear = currentYear + 1;
  if (!financeData[newYear]) {
    initYearData(newYear);
    markDataChanged();
    renderYearSelection();
    showSuccessMessage(`Год ${newYear} добавлен!`);
  } else {
    showSuccessMessage(`Год ${newYear} уже существует!`);
  }
}

// ==================== ПЕРЕНОС ДАННЫХ ====================

function exportData() {
  const dataToExport = {
    financeData: financeData,
    budgetData: budgetData,
    savingsWidgets: savingsWidgets,
    fundWidgets: fundWidgets,
    achievementsData: achievementsData,
    exportDate: new Date().toISOString()
  };
  
  const dataStr = JSON.stringify(dataToExport, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  
  // Создаем ссылку для скачивания
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `finance-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  showSuccessMessage('Данные экспортированы!');
}

function importData() {
  const importDataStr = elements.importDataInput.value.trim();
  if (!importDataStr) {
    alert('Вставьте данные для импорта');
    return;
  }

  try {
    const importedData = JSON.parse(importDataStr);
    
    if (importedData.financeData) {
      financeData = importedData.financeData;
      budgetData = importedData.budgetData || budgetData;
      savingsWidgets = importedData.savingsWidgets || savingsWidgets;
      fundWidgets = importedData.fundWidgets || fundWidgets;
      achievementsData = importedData.achievementsData || achievementsData;
      
      markDataChanged();
      updateUI();
      elements.importDataInput.value = '';
      elements.transferDataModal.style.display = 'none';
      showSuccessMessage('Данные успешно импортированы!');
    } else {
      alert('Некорректный формат данных');
    }
  } catch (e) {
    console.error('Ошибка импорта: ', e);
    alert('Ошибка при импорте данных. Проверьте формат.');
  }
}

// ==================== СПЕЦИАЛЬНЫЕ ЭФФЕКТЫ ====================

function triggerFallAnimation() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fallDown {
      0% { transform: translateY(0) rotate(0deg); opacity: 1; }
      100% { transform: translateY(100vh) rotate(var(--rotation)); opacity: 0; }
    }
    .falling {
      animation: fallDown 2s ease forwards;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);

  const allElements = document.querySelectorAll('body > *:not(script):not(style)');
  allElements.forEach(element => {
    if (!element.classList.contains('falling')) {
      const rotation = (Math.random() * 360) - 180;
      const delay = Math.random() * 0.5;
      const duration = 1 + Math.random() * 1;
      
      element.style.setProperty('--rotation', `${rotation}deg`);
      element.style.animationDelay = `${delay}s`;
      element.style.animationDuration = `${duration}s`;
      element.classList.add('falling');
    }
  });

  setTimeout(() => {
    allElements.forEach(element => {
      element.classList.remove('falling');
      element.style.animation = 'none';
      element.style.transform = 'none';
      element.style.opacity = '1';
    });
    document.head.removeChild(style);
  }, 5000);
}

function showGhostAnimation() {
  const ghosts = ['👻', '👻', '👻', '👻', '👻'];
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 9999;
    overflow: hidden;
  `;
  document.body.appendChild(container);

  ghosts.forEach((ghost, i) => {
    const ghostEl = document.createElement('div');
    ghostEl.textContent = ghost;
    ghostEl.style.cssText = `
      position: absolute;
      font-size: 30px;
      left: ${Math.random() * 100}%;
      top: -50px;
      animation: ghostFall ${3 + Math.random() * 2}s linear ${i * 0.1}s forwards;
    `;
    container.appendChild(ghostEl);
  });

  const style = document.createElement('style');
  style.textContent = `
    @keyframes ghostFall {
      to { transform: translateY(calc(100vh + 50px)) rotate(${Math.random() * 360}deg); }
    }
  `;
  document.head.appendChild(style);

  setTimeout(() => {
    document.body.removeChild(container);
    document.head.removeChild(style);
  }, 5000);
}

// ==================== СБРОС ДАННЫХ ====================

function showResetModal() {
  if (!confirm('Вы уверены, что хотите сбросить все данные? Это действие нельзя отменить.')) {
    return;
  }
  
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

// ==================== АДАПТАЦИЯ КНОПОК ====================

function adaptHeaderButtons() {
  const headerButtons = document.querySelector('.header-buttons');
  if (!headerButtons) return;
  
  const buttons = headerButtons.querySelectorAll('.neumorphic-btn.small');
  const containerWidth = headerButtons.offsetWidth;
  
  let totalWidth = 0;
  buttons.forEach(btn => {
    totalWidth += btn.offsetWidth + 4;
  });
  
  if (totalWidth > containerWidth && window.innerWidth <= 767) {
    buttons.forEach(btn => {
      if (!btn.classList.contains('theme-toggle')) {
        btn.style.fontSize = '0.65rem';
        btn.style.padding = '6px 8px';
        btn.style.minWidth = '58px';
      }
    });
    
    if (window.innerWidth <= 360) {
      buttons.forEach(btn => {
        if (!btn.classList.contains('theme-toggle')) {
          btn.style.fontSize = '0.6rem';
          btn.style.padding = '5px 6px';
          btn.style.minWidth = '52px';
          btn.style.height = '28px';
        }
      });
      
      const themeBtn = document.querySelector('.theme-toggle');
      if (themeBtn) {
        themeBtn.style.minWidth = '30px';
        themeBtn.style.height = '28px';
        themeBtn.style.padding = '4px';
      }
    }
  } else {
    buttons.forEach(btn => {
      btn.style.fontSize = '';
      btn.style.padding = '';
      btn.style.minWidth = '';
      btn.style.height = '';
    });
  }
}

// ==================== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ====================

document.addEventListener('DOMContentLoaded', function() {
  console.log('=== ЗАГРУЗКА ПРИЛОЖЕНИЯ ===');
  
  // Инициализация элементов DOM
  initializeDOMElements();
  
  // Загрузка данных
  loadData();
  
  // Инициализация обработчиков событий
  initializeEventListeners();
  
  // Загрузка темы
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark');
    const themeIcon = document.querySelector('.theme-icon');
    if (themeIcon) themeIcon.textContent = '☀️';
  }
  
  // Разблокируем достижение "Лучше большинства" при первом запуске
  if (!achievementsData['better_than_most']) {
    unlockAchievement('better_than_most');
  }
  
  // Первоначальное обновление UI
  updateUI();
  
  // Адаптация кнопок
  setTimeout(adaptHeaderButtons, 100);
  
  // Автосохранение при закрытии
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
  }, 30000);
  
  console.log('✅ Приложение инициализировано');
});

// Адаптация кнопок при изменении размера окна
window.addEventListener('resize', adaptHeaderButtons);
