document.addEventListener('DOMContentLoaded', function() {
  // Блокировка свайпов в Telegram
  if (window.Telegram?.WebApp?.preventClose) window.Telegram.WebApp.preventClose();
  if (window.Telegram?.WebApp?.disableVerticalSwipes) window.Telegram.WebApp.disableVerticalSwipes();
  
  let currentMonth = new Date().getMonth();
  let currentYear = new Date().getFullYear();
  const monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  const monthShortNames = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
  
  let financeData = {}, budgetData = {}, savingsWidgets = [], fundWidgets = [], achievementsData = {};
  let hasUnsavedChanges = false, saveTimeout = null;
  let themeToggleCount = 0, lastThemeToggleTime = 0, pullAttempts = 0, monthSequence = [];
  const requiredMonthSequence = [8, 9, 10, 11, 0, 1];
  
  // Определяем платформу
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isTelegramIOS = window.Telegram?.WebApp?.platform === 'ios';
  
  // Переменные для отслеживания свайпа
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;
  const SWIPE_THRESHOLD = 100; // минимальное расстояние для свайпа
  const MAX_VERTICAL_DEVIATION = 30; // максимальное отклонение по вертикали
  
  function loadData() {
    try {
      financeData = JSON.parse(localStorage.getItem('financeData')) || {};
      budgetData = JSON.parse(localStorage.getItem('budgetData')) || getDefaultBudgetData();
      savingsWidgets = JSON.parse(localStorage.getItem('savingsWidgets')) || [];
      fundWidgets = JSON.parse(localStorage.getItem('fundWidgets')) || [];
      achievementsData = JSON.parse(localStorage.getItem('achievementsData')) || {};
      return true;
    } catch (e) { 
      console.error('Error loading data:', e);
      return false; 
    }
  }
  
  function getDefaultBudgetData() {
    return { totalAmount: 0, days: 0, startDate: null, spent: 0, dailyHistory: {} };
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
  
  function saveData() {
    try {
      localStorage.setItem('financeData', JSON.stringify(financeData));
      localStorage.setItem('budgetData', JSON.stringify(budgetData));
      localStorage.setItem('savingsWidgets', JSON.stringify(savingsWidgets));
      localStorage.setItem('fundWidgets', JSON.stringify(fundWidgets));
      localStorage.setItem('achievementsData', JSON.stringify(achievementsData));
      hasUnsavedChanges = false;
      return true;
    } catch (e) { 
      console.error('Error saving data:', e);
      return false; 
    }
  }
  
  function markDataChanged() {
    hasUnsavedChanges = true;
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveData, 2000);
  }
  
  // Достижения
  const achievements = [
    { id: 'basic_minimum', title: 'Базовый минимум', description: 'Доход в месяц > 300 000 ₽', emoji: '💰', secret: false, check: (data) => data.income > 300000 },
    { id: 'beer_category', title: 'Я беру паре баб по паре банок Bud', description: 'Создать категорию «Пиво»', emoji: '🍺', secret: false, check: (data) => Object.keys(data.categories).includes('Пиво') },
    { id: 'psychologist_category', title: 'Мне нужен ответ', description: 'Создать категорию «Психолог»', emoji: '🧠', secret: false, check: (data) => Object.keys(data.categories).includes('Психолог') },
    { id: 'credit_category', title: 'Где деньги, Лебовский?', description: 'Создать категорию «Кредит»', emoji: '💳', secret: false, check: (data) => Object.keys(data.categories).includes('Кредит') },
    { id: 'vacation_savings', title: 'А на море белый песок', description: 'Создать виджет накопления «Отдых»', emoji: '🏖️', secret: false, check: (data) => data.savingsWidgets?.some(w => w.name === 'Отдых') },
    { id: 'food_category', title: 'Что на ужин?', description: 'Создать категорию «Еда»', emoji: '🍕', secret: false, check: (data) => Object.keys(data.categories).includes('Еда') },
    { id: 'no_smoking', title: 'Уничтожить табачные корпорации', description: 'Создать категорию «Курение» и не потратить на неё деньги в течение месяца', emoji: '🚭', secret: false, check: (data) => Object.keys(data.categories).includes('Курение') && !data.categories['Курение'] },
    { id: '500_rubles', title: 'Как выжить на 500 рублей?', description: 'В конце месяца у вас остаётся < 500 ₽', emoji: '🪙', secret: false, check: (data) => new Date().getDate() > 28 && data.expense > 0 && (data.income - data.expense) < 500 },
    { id: 'black_hole', title: 'Чёрная дыра в бюджете', description: '1 из категорий трат занимает > 40% всех расходов', emoji: '🕳️', secret: false, check: (data) => new Date().getDate() >= 28 && Object.values(data.categories).some(amount => (amount / data.expense) > 0.4) },
    { id: 'balanced_budget', title: 'Рубль в рубль', description: 'Доходы = Расходы в течение месяца', emoji: '⚖️', secret: false, check: (data) => new Date().getDate() > 1 && data.expense > 0 && data.income === data.expense },
    { id: 'poor', title: 'Бедолага', description: 'Ваш доход < 50 000 ₽ в месяц', emoji: '🥺', secret: false, check: (data) => new Date().getDate() > 3 && data.income > 0 && data.income < 50000 },
    { id: 'no_tracking', title: 'Ред флаг', description: 'Не записывать траты 1 месяц', emoji: '🚩', secret: false, check: (data) => data.expense === 0 && data.expensesHistory.length === 0 },
    { id: 'overspending', title: 'Оказия', description: 'Потратить больше, чем заработал в течение месяца', emoji: '💸', secret: false, check: (data) => data.expense > data.income },
    { id: 'fast_spending', title: 'К чёрту стоп-кран!', description: 'Потратить 80% дохода в первые 24 часа', emoji: '🏎️', secret: false, check: (data) => data.income > 0 && data.expensesHistory.filter(e => new Date(e.date).getDate() === 1).reduce((s,e) => s+e.amount,0)/data.income >= 0.8 },
    { id: 'income_decline', title: 'Раньше было лучше', description: 'Заработать доход за этот месяц меньше, чем в прошлом', emoji: '📉', secret: false, check: (data) => data.income < (financeData[currentMonth===0?currentYear-1:currentYear]?.[currentMonth===0?11:currentMonth-1]?.income||0) },
    { id: 'ghost_busters', title: "Ghost busters", description: "5 раз подряд переключить тему", emoji: "👻", secret: true, check: () => false },
    { id: 'dungeons_and_dragons', title: "Подземелье и драконы", description: "Потянуть вниз когда страница уже не листается", emoji: "🐉", secret: true, check: () => false },
    { id: 'do_re_mi', title: "До ре ми фа соль ля си", description: "Открыть месяцы по порядку: сентябрь, октябрь, ноябрь, декабрь, январь, февраль", emoji: "🎵", secret: true, check: () => false },
    { id: 'better_than_most', title: "Лучше большинства", description: "Вы получите её сразу", emoji: "🏆", secret: false, check: () => true },
    { id: 'cant_get_this', title: "Ты не получишь это достижение", description: "Его нельзя получить", emoji: "🚫", secret: false, check: () => false }
  ];
  
  // Элементы DOM
  const elements = {
    // Основные элементы
    incomeInput: document.getElementById('income-input'),
    incomeDisplay: document.getElementById('income'),
    expenseDisplay: document.getElementById('expense'),
    percentDisplay: document.getElementById('percent'),
    capitalDisplay: document.getElementById('capital-display'),
    widgetsContainer: document.getElementById('widgets'),
    
    // Кнопки и инпуты
    addIncomeBtn: document.getElementById('add-income-btn'),
    categoryBtn: document.getElementById('category-btn'),
    categoryMenu: document.getElementById('category-menu'),
    categoriesList: document.getElementById('categories-list'),
    newCategoryInput: document.getElementById('new-category-input'),
    addCategoryBtn: document.getElementById('add-category-btn'),
    
    // Капитализация
    capitalizationBtn: document.getElementById('capitalization-btn'),
    capitalizationMenu: document.getElementById('capitalization-menu'),
    capitalInput: document.getElementById('capital-input'),
    saveCapitalBtn: document.getElementById('save-capital-btn'),
    cancelCapitalBtn: document.getElementById('cancel-capital-btn'),
    
    // Отчеты
    settingsBtn: document.getElementById('settings-btn'),
    settingsMenu: document.getElementById('settings-menu'),
    monthTabs: document.querySelectorAll('.month-tab'),
    
    // Бюджет
    dailyBudgetAmount: document.getElementById('daily-budget-amount'),
    budgetProgress: document.getElementById('budget-progress'),
    budgetSettingsBtn: document.getElementById('budget-settings-btn'),
    setBudgetModal: document.getElementById('set-budget-modal'),
    budgetAmount: document.getElementById('budget-amount'),
    budgetDays: document.getElementById('budget-days'),
    saveBudgetBtn: document.getElementById('save-budget-btn'),
    cancelBudgetBtn: document.getElementById('cancel-budget-btn'),
    
    // Мини-графики
    miniCapitalChart: document.getElementById('miniCapitalChart'),
    miniExpenseChart: document.getElementById('miniExpenseChart'),
    
    // Финансовые показатели
    avgIncome: document.getElementById('avg-income'),
    avgExpense: document.getElementById('avg-expense'),
    bestMonth: document.getElementById('best-month'),
    topCategoriesList: document.getElementById('top-categories-list'),
    totalIncome: document.getElementById('total-income'),
    totalExpense: document.getElementById('total-expense'),
    
    // Тема
    themeToggleBtn: document.getElementById('theme-toggle-btn'),
    
    // Главное меню
    moreBtn: document.getElementById('more-btn'),
    moreMenu: document.getElementById('more-menu'),
    
    // Накопления
    enableSavingsBtn: document.getElementById('enable-savings-btn'),
    savingsModal: document.getElementById('savings-modal'),
    savingsName: document.getElementById('savings-name'),
    savingsGoal: document.getElementById('savings-goal'),
    saveSavingsBtn: document.getElementById('save-savings-btn'),
    cancelSavingsBtn: document.getElementById('cancel-savings-btn'),
    
    // Фонды
    enableFundBtn: document.getElementById('enable-fund-btn'),
    fundModal: document.getElementById('fund-modal'),
    fundName: document.getElementById('fund-name'),
    fundAmount: document.getElementById('fund-amount'),
    saveFundBtn: document.getElementById('save-fund-btn'),
    cancelFundBtn: document.getElementById('cancel-fund-btn'),
    
    // Закрытие
    closeCategoryWidget: document.getElementById('close-category-widget'),
    
    // Прогресс-бары
    daysProgressBar: document.querySelector('.days-progress'),
    fundsProgressBar: document.querySelector('.funds-progress'),
    daysProgressValue: document.getElementById('days-progress-value'),
    fundsProgressValue: document.getElementById('funds-progress-value'),
    
    // Год
    yearSelectBtn: document.getElementById('year-select-btn'),
    yearSelectModal: document.getElementById('year-select-modal'),
    yearsList: document.getElementById('years-list'),
    addYearBtn: document.getElementById('add-year-btn'),
    currentYearDisplay: document.getElementById('current-year-display'),
    
    // История
    historyBtn: document.getElementById('history-btn'),
    historyModal: document.getElementById('history-modal'),
    historyList: document.getElementById('history-list'),
    
    // Тренды
    trendsScroll: document.getElementById('trends-scroll'),
    
    // Достижения
    achievementsBtn: document.getElementById('achievements-btn'),
    achievementsModal: document.getElementById('achievements-modal'),
    achievementsList: document.getElementById('achievements-list'),
    
    // Сброс
    resetBtn: document.getElementById('reset-btn'),
    
    // Перенос данных
    transferDataBtn: document.getElementById('transfer-data-btn'),
    transferDataModal: document.getElementById('transfer-data-modal'),
    exportDataBtn: document.getElementById('export-data-btn'),
    importDataBtn: document.getElementById('import-data-btn'),
    importFilesBtn: document.getElementById('import-files-btn'),
    fileInput: document.getElementById('file-input'),
    selectedFileName: document.getElementById('selected-file-name'),
    
    // Элементы для инструкций iOS
    exportSection: document.querySelector('.export-section')
  };
  
  // Вспомогательные функции
  function formatCurrency(amount) { 
    return amount.toLocaleString('ru-RU') + ' ₽'; 
  }
  
  function parseCurrency(input) {
    return parseFloat(input.replace(/\s+/g, '').replace(',', '.'));
  }
  
  // Управление темой
  function toggleTheme() {
    const now = Date.now();
    if (now - lastThemeToggleTime < 2000) {
      themeToggleCount++;
      if (themeToggleCount >= 5) { 
        unlockAchievement('ghost_busters'); 
        themeToggleCount = 0; 
      }
    } else {
      themeToggleCount = 1;
    }
    lastThemeToggleTime = now;
    
    document.body.classList.toggle('dark');
    localStorage.setItem('darkTheme', document.body.classList.contains('dark'));
    const icon = elements.themeToggleBtn.querySelector('.theme-icon');
    icon.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
    elements.themeToggleBtn.innerHTML = `<span class="theme-icon">${icon.textContent}</span> Сменить тему`;
    renderAllCharts();
  }
  
  // Достижения
  function checkAchievements() {
    const monthData = financeData[currentYear][currentMonth];
    const data = { 
      income: monthData.income, 
      expense: monthData.expense, 
      capital: monthData.capital, 
      categories: monthData.categories, 
      savingsWidgets, 
      fundWidgets, 
      expensesHistory: monthData.expensesHistory 
    };
    
    achievements.forEach(ach => {
      if (!achievementsData[ach.id] && ach.check(data)) {
        achievementsData[ach.id] = true;
        markDataChanged();
        showAchievementUnlocked(ach);
      }
    });
  }
  
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
    
    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => { 
      notification.classList.remove('show'); 
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 500); 
    }, 5000);
  }
  
  function unlockAchievement(id) {
    if (!achievementsData[id]) {
      achievementsData[id] = true;
      markDataChanged();
      const achievement = achievements.find(a => a.id === id);
      if (achievement) showAchievementUnlocked(achievement);
    }
  }
  
  function checkMonthSequence(month) {
    monthSequence.push(month);
    if (monthSequence.length > requiredMonthSequence.length) {
      monthSequence.shift();
    }
    if (JSON.stringify(monthSequence) === JSON.stringify(requiredMonthSequence)) {
      unlockAchievement('do_re_mi');
      monthSequence = [];
    }
  }
  
  // Категории
  const categoryColors = [
    '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', 
    '#1abc9c', '#d35400', '#34495e', '#16a085', '#27ae60', 
    '#2980b9', '#8e44ad', '#f1c40f', '#e67e22', '#c0392b'
  ];
  
  function updateCategoriesList() {
    elements.categoriesList.innerHTML = '';
    const categories = financeData[currentYear][currentMonth].categories || {};
    
    Object.keys(categories).forEach((category, index) => {
      const categoryItem = document.createElement('div');
      categoryItem.className = 'category-item';
      categoryItem.innerHTML = `
        <span style="color: ${categoryColors[index % categoryColors.length]}">■</span> 
        ${category}
        <span>${formatCurrency(categories[category])}</span>
        <button class="delete-category-btn" data-category="${category}">×</button>
      `;
      elements.categoriesList.appendChild(categoryItem);
    });
    
    document.querySelectorAll('.delete-category-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const category = this.getAttribute('data-category');
        if (confirm(`Удалить категорию "${category}"?`)) {
          const monthData = financeData[currentYear][currentMonth];
          monthData.expense -= monthData.categories[category] || 0;
          delete monthData.categories[category];
          markDataChanged();
          updateUI();
        }
      });
    });
  }
  
  // Финансовые показатели
  function updateFinancialMetrics() {
    let totalIncome = 0, totalExpense = 0, bestMonthValue = 0, bestMonthName = '', bestMonthIndex = -1;
    
    for (let i = 0; i < 12; i++) {
      const monthData = financeData[currentYear][i] || { income: 0, expense: 0 };
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
      elements.bestMonth.textContent = `${bestMonthName}\n+${formatCurrency(monthData.income - monthData.expense)}`;
    }
    
    renderMiniCharts();
    renderTopCategoriesReport();
  }
  
  function renderTopCategoriesReport() {
    elements.topCategoriesList.innerHTML = '';
    const sortedMonths = Array.from({length: 12}, (_, i) => (currentMonth - i + 12) % 12);
    
    sortedMonths.forEach(monthIndex => {
      const monthData = financeData[currentYear][monthIndex] || { categories: {} };
      const categories = Object.entries(monthData.categories);
      
      if (categories.length > 0) {
        categories.sort((a, b) => b[1] - a[1]);
        const monthElement = document.createElement('div');
        monthElement.className = 'month-categories';
        monthElement.innerHTML = `<h5>${monthNames[monthIndex]}</h5>`;
        
        const topCategories = categories.slice(0, 3);
        const totalExpense = categories.reduce((sum, [_, amount]) => sum + amount, 0);
        
        const totalElement = document.createElement('div');
        totalElement.className = 'category-item total';
        totalElement.innerHTML = `<span>Всего расходов</span><strong>${formatCurrency(totalExpense)}</strong>`;
        monthElement.appendChild(totalElement);
        
        topCategories.forEach(([category, amount], index) => {
          const percent = totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0;
          const categoryElement = document.createElement('div');
          categoryElement.className = 'category-item';
          categoryElement.innerHTML = `
            <div>
              <span style="color: ${categoryColors[index % categoryColors.length]}">■</span> ${category}
            </div>
            <div>
              ${formatCurrency(amount)}<br>
              <small>${percent}%</small>
            </div>
          `;
          monthElement.appendChild(categoryElement);
        });
        
        elements.topCategoriesList.appendChild(monthElement);
      }
    });
  }
  
  // Графики
  let chart, capitalChart, miniCapitalChart, miniExpenseChart;
  
  function renderMiniCharts() {
    const labels = monthShortNames;
    const capitalData = [], expenseData = [];
    
    for (let i = 0; i < 12; i++) {
      const monthData = financeData[currentYear][i] || { income: 0, expense: 0, capital: 0 };
      capitalData.push(monthData.capital);
      expenseData.push(monthData.expense);
    }
    
    // Капитализация
    if (miniCapitalChart) miniCapitalChart.destroy();
    const capitalCtx = elements.miniCapitalChart?.getContext('2d');
    if (capitalCtx) {
      const gradient = capitalCtx.createLinearGradient(0, 0, 0, 180);
      gradient.addColorStop(0, 'rgba(52, 152, 219, 0.8)');
      gradient.addColorStop(1, 'rgba(52, 152, 219, 0.2)');
      
      miniCapitalChart = new Chart(capitalCtx, { 
        type: 'line', 
        data: { 
          labels, 
          datasets: [{ 
            data: capitalData, 
            borderColor: gradient, 
            backgroundColor: 'rgba(52, 152, 219, 0.1)', 
            borderWidth: 3, 
            tension: 0.3, 
            fill: true 
          }] 
        }, 
        options: getChartOptions() 
      });
    }
    
    // Расходы
    if (miniExpenseChart) miniExpenseChart.destroy();
    const expenseCtx = elements.miniExpenseChart?.getContext('2d');
    if (expenseCtx) {
      const gradient = expenseCtx.createLinearGradient(0, 0, 0, 180);
      gradient.addColorStop(0, 'rgba(231, 76, 60, 0.8)');
      gradient.addColorStop(1, 'rgba(231, 76, 60, 0.2)');
      
      miniExpenseChart = new Chart(expenseCtx, { 
        type: 'bar', 
        data: { 
          labels, 
          datasets: [{ 
            data: expenseData, 
            backgroundColor: gradient, 
            borderColor: 'transparent', 
            borderRadius: 4 
          }] 
        }, 
        options: getChartOptions() 
      });
    }
  }
  
  function getChartOptions() {
    const isDark = document.body.classList.contains('dark');
    const textColor = isDark ? '#eee' : '#333';
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { display: false }, 
        tooltip: { 
          backgroundColor: isDark ? '#2a2a2a' : '#fff', 
          titleColor: textColor, 
          bodyColor: textColor, 
          borderColor: isDark ? '#444' : '#ddd' 
        } 
      },
      scales: {
        y: { 
          beginAtZero: true, 
          grid: { color: gridColor }, 
          ticks: { 
            color: textColor, 
            callback: v => v >= 1000000 ? (v/1000000).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(0)+'k' : v 
          } 
        },
        x: { 
          grid: { display: false }, 
          ticks: { color: textColor } 
        }
      }
    };
  }
  
  // Основной UI
  function updateUI() {
    const monthData = financeData[currentYear][currentMonth] || { income: 0, expense: 0, categories: {} };
    const capital = monthData.capital || 0;
    const remaining = monthData.income - monthData.expense;
    const percentage = monthData.income > 0 ? Math.round((remaining / monthData.income) * 100) : 0;
    
    elements.incomeDisplay.textContent = formatCurrency(monthData.income);
    elements.expenseDisplay.textContent = formatCurrency(monthData.expense);
    elements.currentYearDisplay.textContent = `Год: ${currentYear}`;
    elements.percentDisplay.textContent = (remaining < 0 ? '-' : '') + Math.abs(percentage) + '%';
    
    if (remaining < 0) {
      elements.percentDisplay.classList.add('negative');
      elements.percentDisplay.style.color = '#e74c3c';
    } else { 
      elements.percentDisplay.classList.remove('negative'); 
      elements.percentDisplay.style.color = percentage < 20 ? '#f39c12' : '#2ecc71'; 
    }
    
    elements.capitalDisplay.textContent = formatCurrency(capital);
    
    updateBudgetWidget();
    updateFinancialMetrics();
    renderAllCharts();
    renderWidgets();
    renderSavingsWidgets();
    renderFundWidgets();
    renderExpenseHistory();
    renderCategoryTrends();
    checkAchievements();
  }
  
  function renderAllCharts() {
    renderChart();
    renderCapitalChart();
    renderMiniCharts();
  }
  
  // Виджеты
  function renderWidgets() {
    elements.widgetsContainer.innerHTML = '';
    const monthData = financeData[currentYear][currentMonth];
    const categories = Object.entries(monthData.categories || {});
    
    if (categories.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.innerHTML = `
        <h3>Нет категорий</h3>
        <p>Добавьте категории для отслеживания расходов</p>
      `;
      elements.widgetsContainer.appendChild(emptyState);
      return;
    }
    
    categories.forEach(([cat, val], index) => {
      const widget = document.createElement('div');
      widget.className = 'neumorphic-card widget';
      widget.style.setProperty('--widget-color', categoryColors[index % categoryColors.length]);
      widget.innerHTML = `
        <div class="widget-header">
          <h3>${cat}</h3>
          <button class="delete-widget-btn" data-category="${cat}">×</button>
        </div>
        <p>${formatCurrency(val)}</p>
        <div class="widget-input-group">
          <input type="number" class="neumorphic-input widget-input" placeholder="Сумма" id="expense-${cat}">
          <button class="neumorphic-btn small" data-category="${cat}">+</button>
        </div>
      `;
      elements.widgetsContainer.appendChild(widget);
    });
    
    document.querySelectorAll('.delete-widget-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const category = this.getAttribute('data-category');
        if (confirm(`Удалить категорию "${category}"?`)) {
          const monthData = financeData[currentYear][currentMonth];
          monthData.expense -= monthData.categories[category] || 0;
          delete monthData.categories[category];
          markDataChanged();
          updateUI();
        }
      });
    });
    
    document.querySelectorAll('.widget-input-group .neumorphic-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const category = this.getAttribute('data-category');
        const input = document.getElementById(`expense-${category}`);
        const expenseVal = parseCurrency(input.value);
        
        if (!isNaN(expenseVal) && expenseVal > 0) {
          const monthData = financeData[currentYear][currentMonth];
          monthData.expense += expenseVal;
          monthData.categories[category] = (monthData.categories[category] || 0) + expenseVal;
          monthData.expensesHistory.push({ 
            category, 
            amount: expenseVal, 
            date: new Date().toLocaleString('ru-RU') 
          });
          input.value = '';
          markDataChanged();
          updateUI();
        }
      });
    });
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
          backgroundColor: categoryNames.map((_, i) => {
            const gradient = ctx.createLinearGradient(0, 0, 0, 300);
            gradient.addColorStop(0, categoryColors[i % categoryColors.length]);
            gradient.addColorStop(1, shadeColor(categoryColors[i % categoryColors.length], -30));
            return gradient;
          }), 
          borderColor: 'transparent', 
          borderRadius: 6 
        }]
      },
      options: getChartOptions()
    });
  }
  
  function renderCapitalChart() {
    const ctx = document.getElementById('capitalChart')?.getContext('2d');
    if (!ctx) return;
    
    if (capitalChart) capitalChart.destroy();
    const monthData = financeData[currentYear][currentMonth];
    
    capitalChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Капитализация'],
        datasets: [{ 
          label: 'Капитализация', 
          data: [monthData.capital || 0], 
          backgroundColor: 'rgba(52, 152, 219, 0.2)', 
          borderColor: '#3498db', 
          borderWidth: 3, 
          tension: 0.3, 
          fill: true 
        }]
      },
      options: getChartOptions()
    });
  }
  
  function shadeColor(color, percent) {
    let R = parseInt(color.substring(1,3),16);
    let G = parseInt(color.substring(3,5),16);
    let B = parseInt(color.substring(5,7),16);
    
    R = parseInt(R * (100 + percent) / 100);
    G = parseInt(G * (100 + percent) / 100);
    B = parseInt(B * (100 + percent) / 100);
    
    R = (R<255) ? R : 255;
    G = (G<255) ? G : 255;
    B = (B<255) ? B : 255;
    
    const RR = ((R.toString(16).length==1) ? "0"+R.toString(16) : R.toString(16));
    const GG = ((G.toString(16).length==1) ? "0"+G.toString(16) : G.toString(16));
    const BB = ((B.toString(16).length==1) ? "0"+B.toString(16) : B.toString(16));
    
    return "#"+RR+GG+BB;
  }
  
  // Накопления
  function renderSavingsWidgets() {
    document.querySelectorAll('.savings-widget').forEach(w => w.remove());
    
    savingsWidgets.forEach(widget => {
      const progress = widget.goal > 0 ? Math.min(100, Math.round((widget.current / widget.goal) * 100)) : 0;
      const widgetElement = document.createElement('div');
      widgetElement.className = 'neumorphic-card widget savings-widget';
      widgetElement.dataset.widgetId = widget.id;
      widgetElement.style.setProperty('--widget-color', widget.color);
      widgetElement.innerHTML = `
        <button class="delete-widget-btn" data-widget-id="${widget.id}">×</button>
        <h3>${widget.name}</h3>
        <div class="savings-progress-container">
          <div class="savings-progress-bar" style="width: ${progress}%"></div>
        </div>
        <p>${formatCurrency(widget.current)} / ${formatCurrency(widget.goal)} (${progress}%)</p>
        <div class="widget-input-group">
          <input type="number" class="neumorphic-input widget-input savings-amount" 
                 placeholder="Сумма" data-widget-id="${widget.id}">
          <button class="neumorphic-btn small add-savings-btn" data-widget-id="${widget.id}">+</button>
        </div>
      `;
      
      elements.widgetsContainer.prepend(widgetElement);
      
      widgetElement.querySelector('.add-savings-btn').addEventListener('click', function() {
        const widgetId = this.dataset.widgetId;
        const input = document.querySelector(`.savings-amount[data-widget-id="${widgetId}"]`);
        const amount = parseCurrency(input.value);
        
        if (!isNaN(amount) && amount > 0) {
          const widgetIndex = savingsWidgets.findIndex(w => w.id === widgetId);
          if (widgetIndex !== -1) {
            savingsWidgets[widgetIndex].current += amount;
            markDataChanged();
            updateSingleWidget(widgetId);
            input.value = '';
          }
        }
      });
      
      widgetElement.querySelector('.delete-widget-btn').addEventListener('click', function() {
        const widgetId = this.dataset.widgetId;
        if (confirm('Удалить этот виджет накоплений?')) {
          savingsWidgets = savingsWidgets.filter(w => w.id !== widgetId);
          markDataChanged();
          document.querySelector(`.savings-widget[data-widget-id="${widgetId}"]`)?.remove();
        }
      });
    });
  }
  
  function updateSingleWidget(widgetId) {
    const widgetData = savingsWidgets.find(w => w.id === widgetId);
    if (!widgetData) return;
    
    const widgetElement = document.querySelector(`.savings-widget[data-widget-id="${widgetId}"]`);
    if (!widgetElement) return;
    
    const progress = widgetData.goal > 0 ? Math.min(100, Math.round((widgetData.current / widgetData.goal) * 100)) : 0;
    widgetElement.querySelector('.savings-progress-bar').style.width = `${progress}%`;
    widgetElement.querySelector('p').textContent = 
      `${formatCurrency(widgetData.current)} / ${formatCurrency(widgetData.goal)} (${progress}%)`;
  }
  
  function createNewSavingsWidget(name, goal, current = 0) {
    const widgetId = Date.now().toString();
    savingsWidgets.push({ 
      id: widgetId, 
      name: name || `Накопления ${savingsWidgets.length + 1}`, 
      goal: goal || 0, 
      current: current || 0, 
      color: getRandomWidgetColor() 
    });
    markDataChanged();
    renderSavingsWidgets();
  }
  
  // Фонды
  function renderFundWidgets() {
    document.querySelectorAll('.fund-widget').forEach(w => w.remove());
    
    fundWidgets.forEach(widget => {
      const spent = widget.initialAmount - widget.current;
      const progress = widget.initialAmount > 0 ? Math.min(100, Math.round((spent / widget.initialAmount) * 100)) : 0;
      const widgetElement = document.createElement('div');
      widgetElement.className = 'neumorphic-card widget fund-widget';
      widgetElement.dataset.widgetId = widget.id;
      widgetElement.style.setProperty('--widget-color', widget.color);
      widgetElement.innerHTML = `
        <button class="delete-widget-btn" data-widget-id="${widget.id}">×</button>
        <h3>${widget.name}</h3>
        <div class="savings-progress-container">
          <div class="savings-progress-bar" style="width: ${progress}%"></div>
        </div>
        <p>Использовано: ${formatCurrency(spent)} / ${formatCurrency(widget.initialAmount)} (${progress}%)</p>
        <p>Остаток: ${formatCurrency(widget.current)}</p>
        <div class="widget-input-group">
          <input type="number" class="neumorphic-input widget-input fund-amount" 
                 placeholder="Сумма расхода" data-widget-id="${widget.id}">
          <button class="neumorphic-btn small add-fund-btn" data-widget-id="${widget.id}">-</button>
        </div>
      `;
      
      elements.widgetsContainer.prepend(widgetElement);
      
      widgetElement.querySelector('.add-fund-btn').addEventListener('click', function() {
        const widgetId = this.dataset.widgetId;
        const input = document.querySelector(`.fund-amount[data-widget-id="${widgetId}"]`);
        const amount = parseCurrency(input.value);
        
        if (!isNaN(amount) && amount > 0) {
          const widgetIndex = fundWidgets.findIndex(w => w.id === widgetId);
          if (widgetIndex !== -1 && fundWidgets[widgetIndex].current >= amount) {
            fundWidgets[widgetIndex].current -= amount;
            markDataChanged();
            updateSingleFundWidget(widgetId);
            input.value = '';
          }
        }
      });
      
      widgetElement.querySelector('.delete-widget-btn').addEventListener('click', function() {
        const widgetId = this.dataset.widgetId;
        if (confirm('Удалить этот фонд?')) {
          fundWidgets = fundWidgets.filter(w => w.id !== widgetId);
          markDataChanged();
          document.querySelector(`.fund-widget[data-widget-id="${widgetId}"]`)?.remove();
        }
      });
    });
  }
  
  function updateSingleFundWidget(widgetId) {
    const widgetData = fundWidgets.find(w => w.id === widgetId);
    if (!widgetData) return;
    
    const widgetElement = document.querySelector(`.fund-widget[data-widget-id="${widgetId}"]`);
    if (!widgetElement) return;
    
    const spent = widgetData.initialAmount - widgetData.current;
    const progress = widgetData.initialAmount > 0 ? Math.min(100, Math.round((spent / widgetData.initialAmount) * 100)) : 0;
    
    widgetElement.querySelector('.savings-progress-bar').style.width = `${progress}%`;
    widgetElement.querySelectorAll('p')[0].textContent = 
      `Использовано: ${formatCurrency(spent)} / ${formatCurrency(widgetData.initialAmount)} (${progress}%)`;
    widgetElement.querySelectorAll('p')[1].textContent = 
      `Остаток: ${formatCurrency(widgetData.current)}`;
  }
  
  function createNewFundWidget(name, amount, current = null) {
    const widgetId = Date.now().toString();
    const initialAmount = current !== null ? current : amount;
    fundWidgets.push({ 
      id: widgetId, 
      name: name || `Фонд ${fundWidgets.length + 1}`, 
      initialAmount: amount, 
      current: initialAmount, 
      color: getRandomWidgetColor() 
    });
    markDataChanged();
    renderFundWidgets();
  }
  
  function getRandomWidgetColor() {
    const colors = ['#2ecc71', '#3498db', '#9b59b6', '#f1c40f', '#e67e22', '#e74c3c'];
    return colors[Math.floor(Math.random() * colors.length)];
  }
  
  // Бюджет
  function updateBudgetWidget() {
    if (!budgetData.startDate) {
      elements.dailyBudgetAmount.textContent = formatCurrency(0);
      elements.budgetProgress.textContent = 'Не задано';
      if (elements.daysProgressBar) elements.daysProgressBar.style.width = '100%';
      if (elements.fundsProgressBar) elements.fundsProgressBar.style.width = '100%';
      return;
    }
    
    const today = new Date();
    const startDate = new Date(budgetData.startDate);
    
    if (today.getMonth() !== startDate.getMonth() || today.getFullYear() !== startDate.getFullYear()) {
      elements.dailyBudgetAmount.textContent = formatCurrency(0);
      elements.budgetProgress.textContent = 'Срок истек';
      return;
    }
    
    const elapsedDays = Math.floor((today - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const remainingDays = Math.max(0, budgetData.days - elapsedDays + 1);
    
    if (remainingDays <= 0) {
      elements.dailyBudgetAmount.textContent = formatCurrency(0);
      elements.budgetProgress.textContent = 'Срок истек';
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
      return;
    }
    
    const dailyBudget = remainingAmount / remainingDays;
    elements.dailyBudgetAmount.textContent = formatCurrency(dailyBudget);
    elements.budgetProgress.textContent = `Остаток: ${formatCurrency(remainingAmount)} | ${remainingDays} дн.`;
    
    const daysProgress = 100 - (elapsedDays / budgetData.days * 100);
    const fundsProgress = 100 - (totalSpent / budgetData.totalAmount * 100);
    
    if (elements.daysProgressBar) {
      elements.daysProgressBar.style.width = `${Math.max(0, daysProgress)}%`;
    }
    if (elements.fundsProgressBar) {
      elements.fundsProgressBar.style.width = `${Math.max(0, fundsProgress)}%`;
    }
    if (elements.daysProgressValue) {
      elements.daysProgressValue.textContent = `${Math.round(Math.max(0, daysProgress))}%`;
    }
    if (elements.fundsProgressValue) {
      elements.fundsProgressValue.textContent = `${Math.round(Math.max(0, fundsProgress))}%`;
    }
  }
  
  // История
  function renderExpenseHistory() {
    elements.historyList.innerHTML = '';
    const history = financeData[currentYear][currentMonth].expensesHistory || [];
    
    if (history.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.innerHTML = `
        <h3>Нет истории трат</h3>
        <p>Добавьте расходы, чтобы они отображались здесь</p>
      `;
      elements.historyList.appendChild(emptyState);
      return;
    }
    
    [...history].reverse().forEach((item, index) => {
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
          markDataChanged();
          updateUI();
        }
      });
    });
  }
  
  // Год
  function renderYearSelection() {
    elements.yearsList.innerHTML = '';
    Object.keys(financeData)
      .sort((a, b) => b - a)
      .forEach(year => {
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
  
  function addNewYear() {
    const newYear = currentYear + 1;
    if (!financeData[newYear]) {
      initYearData(newYear);
      markDataChanged();
      renderYearSelection();
      showSuccessMessage(`Год ${newYear} добавлен!`);
    }
  }
  
  // Тренды
  function renderCategoryTrends() {
    elements.trendsScroll.innerHTML = '';
    const monthData = financeData[currentYear][currentMonth];
    const categories = Object.keys(monthData.categories || {});
    
    if (categories.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.innerHTML = `
        <h3>Нет данных</h3>
        <p>Добавьте расходы по категориям для отображения динамики</p>
      `;
      elements.trendsScroll.appendChild(emptyState);
      return;
    }
    
    categories.forEach(category => {
      const trendData = [];
      for (let i = 0; i < 12; i++) {
        const monthCatData = financeData[currentYear][i].categories || {};
        trendData.push(monthCatData[category] || 0);
      }
      
      const container = document.createElement('div');
      container.className = 'trend-chart-container';
      container.innerHTML = `
        <h4>${category}</h4>
        <canvas id="trend-${category}"></canvas>
      `;
      elements.trendsScroll.appendChild(container);
      
      const ctx = document.getElementById(`trend-${category}`).getContext('2d');
      const colorIndex = categories.indexOf(category);
      const color = categoryColors[colorIndex % categoryColors.length];
      
      new Chart(ctx, {
        type: 'line',
        data: { 
          labels: monthShortNames, 
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
          ...getChartOptions(), 
          aspectRatio: 1, 
          maintainAspectRatio: true, 
          plugins: { legend: { display: false } } 
        }
      });
    });
  }
  
  // Уведомления
  function showSuccessMessage(message) {
    const successMsg = document.createElement('div');
    successMsg.className = 'success-message';
    successMsg.textContent = message;
    document.body.appendChild(successMsg);
    
    setTimeout(() => successMsg.classList.add('show'), 100);
    setTimeout(() => { 
      successMsg.classList.remove('show'); 
      setTimeout(() => {
        if (document.body.contains(successMsg)) {
          document.body.removeChild(successMsg);
        }
      }, 500); 
    }, 3000);
  }
  
  // Меню и модальные окна
  function toggleMenu(menuElement) {
    document.querySelectorAll('.neumorphic-menu').forEach(menu => { 
      if (menu !== menuElement) menu.classList.remove('show'); 
    });
    menuElement.classList.toggle('show');
  }
  
  function openFullscreenModal(modalElement) {
    document.querySelectorAll('.neumorphic-menu').forEach(menu => menu.classList.remove('show'));
    document.getElementById('fullscreen-backdrop').classList.add('show');
    modalElement.classList.add('fullscreen-modal', 'show');
    document.getElementById('scrollable').style.overflow = 'hidden';
    
    // Добавляем индикатор свайпа
    addSwipeIndicator(modalElement);
  }
  
  function closeFullscreenModal() {
    document.querySelectorAll('.neumorphic-menu').forEach(menu => {
      menu.classList.remove('show', 'fullscreen-modal');
    });
    document.getElementById('fullscreen-backdrop').classList.remove('show');
    document.getElementById('scrollable').style.overflow = 'auto';
    
    // Удаляем индикатор свайпа
    removeSwipeIndicator();
  }
  
  // Функции для обработки свайпов
  function addSwipeIndicator(modalElement) {
    // Создаем индикатор свайпа
    const swipeIndicator = document.createElement('div');
    swipeIndicator.className = 'swipe-indicator';
    swipeIndicator.innerHTML = '← Свайпните для закрытия';
    modalElement.appendChild(swipeIndicator);
    
    // Добавляем обработчики событий
    modalElement.addEventListener('touchstart', handleTouchStart, { passive: true });
    modalElement.addEventListener('touchmove', handleTouchMove, { passive: true });
    modalElement.addEventListener('touchend', handleTouchEnd);
  }
  
  function removeSwipeIndicator() {
    const indicators = document.querySelectorAll('.swipe-indicator');
    indicators.forEach(indicator => indicator.remove());
    
    // Удаляем обработчики событий
    const modals = document.querySelectorAll('.fullscreen-modal');
    modals.forEach(modal => {
      modal.removeEventListener('touchstart', handleTouchStart);
      modal.removeEventListener('touchmove', handleTouchMove);
      modal.removeEventListener('touchend', handleTouchEnd);
    });
  }
  
  function handleTouchStart(e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }
  
  function handleTouchMove(e) {
    if (!touchStartX) return;
    
    touchEndX = e.touches[0].clientX;
    touchEndY = e.touches[0].clientY;
    
    // Получаем текущий модальный элемент
    const modalElement = e.currentTarget;
    
    // Рассчитываем разницу
    const diffX = touchEndX - touchStartX;
    const diffY = Math.abs(touchEndY - touchStartY);
    
    // Если горизонтальное движение больше вертикального и это свайп вправо
    if (Math.abs(diffX) > diffY && diffX > 0) {
      // Добавляем визуальную обратную связь
      const translateX = Math.min(diffX, window.innerWidth * 0.3); // Максимум 30% экрана
      modalElement.style.transform = `translateX(${translateX}px)`;
      modalElement.style.opacity = `${1 - (translateX / (window.innerWidth * 0.3)) * 0.5}`;
    }
  }
  
  function handleTouchEnd(e) {
    if (!touchStartX || !touchEndX) return;
    
    const diffX = touchEndX - touchStartX;
    const diffY = Math.abs(touchEndY - touchStartY);
    
    // Если это горизонтальный свайп и движение достаточно большое
    if (Math.abs(diffX) > diffY && diffX > SWIPE_THRESHOLD) {
      // Свайп вправо - закрываем модальное окно
      closeFullscreenModal();
      
      // Сбрасываем параметры трансформации
      e.currentTarget.style.transform = '';
      e.currentTarget.style.opacity = '';
    } else {
      // Возвращаем модальное окно на место
      e.currentTarget.style.transform = '';
      e.currentTarget.style.opacity = '';
    }
    
    // Сбрасываем значения
    touchStartX = 0;
    touchStartY = 0;
    touchEndX = 0;
    touchEndY = 0;
  }
  
  // Добавляем обработку свайпа для мобильных устройств
  function setupSwipeHandlers() {
    // Обработка свайпа для меню категорий
    if (elements.categoryMenu) {
      elements.categoryMenu.addEventListener('touchstart', handleTouchStart, { passive: true });
      elements.categoryMenu.addEventListener('touchmove', handleTouchMove, { passive: true });
      elements.categoryMenu.addEventListener('touchend', function(e) {
        handleTouchEnd(e);
        if (touchEndX - touchStartX > SWIPE_THRESHOLD && 
            Math.abs(touchEndY - touchStartY) < MAX_VERTICAL_DEVIATION) {
          elements.categoryMenu.classList.remove('show');
        }
      });
    }
  }
  
  // Сброс данных
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
    
    function startDrag(e) {
      isDragging = true;
      startX = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX;
      document.addEventListener('mousemove', drag);
      document.addEventListener('touchmove', drag);
      document.addEventListener('mouseup', endDrag);
      document.addEventListener('touchend', endDrag);
    }
    
    function drag(e) {
      if (!isDragging) return;
      const x = e.type === 'mousemove' ? e.clientX : e.touches[0].clientX;
      const rect = track.getBoundingClientRect();
      let newX = x - rect.left;
      newX = Math.max(0, Math.min(newX, rect.width));
      
      thumb.style.left = `${newX}px`;
      progress.style.width = `${newX}px`;
      
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
      if (document.body.contains(modal)) {
        document.body.removeChild(modal);
      }
      
      localStorage.clear();
      financeData = {}; 
      savingsWidgets = []; 
      fundWidgets = []; 
      achievementsData = {}; 
      budgetData = getDefaultBudgetData();
      
      initYearData(currentYear);
      showSuccessMessage('Все данные сброшены!');
      updateUI();
    }
    
    thumb.addEventListener('mousedown', startDrag);
    thumb.addEventListener('touchstart', startDrag);
    
    modal.addEventListener('click', (e) => { 
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
  }
  
  // Экспорт данных (с поддержкой iOS)
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
  
  // Импорт данных
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
      elements.importDataBtn.disabled = true;
      return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const importedData = JSON.parse(e.target.result);
        
        // Проверяем структуру данных
        const requiredFields = ['financeData', 'budgetData', 'savingsWidgets', 'fundWidgets', 'achievementsData'];
        const isValid = requiredFields.every(field => importedData.hasOwnProperty(field));
        
        if (isValid) {
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
            
            elements.fileInput.value = '';
            elements.selectedFileName.textContent = 'Файл не выбран';
            elements.importDataBtn.disabled = true;
            elements.transferDataModal.classList.remove('show');
            
            showSuccessMessage('Данные успешно импортированы!');
          }
        } else {
          alert('Некорректный формат файла. Убедитесь, что это файл экспорта из этого приложения.');
        }
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
  
  // Импорт через File System API
  async function importWithFileSystemAPI() {
    try {
      if ('showOpenFilePicker' in window) {
        const [fileHandle] = await window.showOpenFilePicker({
          types: [{           description: 'Текстовые файлы',
          accept: { 'text/plain': ['.txt'] }
        }],
        multiple: false
      });
      
      const file = await fileHandle.getFile();
      importDataFromFile(file);
      return true;
    }
    
    // Если File System API не доступен, используем стандартный input
    elements.fileInput.click();
    return false;
    
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('Import error:', error);
      alert('Ошибка при выборе файла');
    }
    return false;
  }
}

// Достижения список
function renderAchievementsList() {
  elements.achievementsList.innerHTML = '';
  
  achievements.forEach(ach => {
    const unlocked = achievementsData[ach.id];
    const achievementEl = document.createElement('div');
    achievementEl.className = `achievement-item ${unlocked ? 'unlocked' : 'locked'} ${ach.secret && !unlocked ? 'secret' : ''}`;
    achievementEl.innerHTML = `
      <div class="achievement-icon">${ach.emoji}</div>
      <div class="achievement-info">
        <h4>${ach.title}</h4>
        <p>${ach.secret && !unlocked ? 'Секретное достижение' : ach.description}</p>
      </div>
    `;
    elements.achievementsList.appendChild(achievementEl);
  });
}

// Обработчики событий
function setupEventHandlers() {
  // Добавление дохода
  elements.addIncomeBtn.addEventListener('click', () => {
    const incomeVal = parseCurrency(elements.incomeInput.value);
    if (!isNaN(incomeVal) && incomeVal > 0) {
      financeData[currentYear][currentMonth].income += incomeVal;
      elements.incomeInput.value = '';
      markDataChanged();
      updateUI();
    }
  });
  
  // Добавление категории
  elements.addCategoryBtn.addEventListener('click', () => {
    const categoryName = elements.newCategoryInput.value.trim();
    if (categoryName) {
      for (let i = 0; i < 12; i++) {
        if (!financeData[currentYear][i].categories[categoryName]) {
          financeData[currentYear][i].categories[categoryName] = 0;
        }
      }
      elements.newCategoryInput.value = '';
      markDataChanged();
      updateUI();
    }
  });
  
  // Категории меню
  elements.categoryBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.categoryMenu.classList.toggle('show');
    elements.settingsMenu.classList.remove('show');
    elements.moreMenu.classList.remove('show');
  });
  
  elements.closeCategoryWidget.addEventListener('click', () => {
    elements.categoryMenu.classList.remove('show');
  });
  
  // Капитализация
  elements.capitalizationBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu(elements.capitalizationMenu);
  });
  
  elements.saveCapitalBtn.addEventListener('click', () => {
    const capitalVal = parseCurrency(elements.capitalInput.value);
    if (!isNaN(capitalVal)) {
      financeData[currentYear][currentMonth].capital = capitalVal;
      markDataChanged();
      updateUI();
      elements.capitalizationMenu.classList.remove('show');
    }
  });
  
  elements.cancelCapitalBtn.addEventListener('click', () => {
    elements.capitalizationMenu.classList.remove('show');
  });
  
  // Отчеты
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
    const amount = parseCurrency(elements.budgetAmount.value);
    const days = parseInt(elements.budgetDays.value);
    
    if (!isNaN(amount) && !isNaN(days) && days > 0) {
      const today = new Date();
      budgetData = { 
        totalAmount: amount, 
        days, 
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
      markDataChanged();
      elements.setBudgetModal.classList.remove('show');
      updateBudgetWidget();
      showSuccessMessage('Бюджет установлен!');
    }
  });
  
  elements.cancelBudgetBtn.addEventListener('click', () => {
    elements.setBudgetModal.classList.remove('show');
  });
  
  // Главное меню
  elements.moreBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.moreMenu.classList.toggle('show');
  });
  
  // Тема
  elements.themeToggleBtn.addEventListener('click', toggleTheme);
  
  // Накопления
  elements.enableSavingsBtn.addEventListener('click', () => {
    elements.moreMenu.classList.remove('show');
    toggleMenu(elements.savingsModal);
  });
  
  elements.saveSavingsBtn.addEventListener('click', () => {
    const name = elements.savingsName.value.trim() || `Накопления ${savingsWidgets.length + 1}`;
    const goal = parseCurrency(elements.savingsGoal.value);
    createNewSavingsWidget(name, goal, 0);
    elements.savingsModal.classList.remove('show');
  });
  
  elements.cancelSavingsBtn.addEventListener('click', () => {
    elements.savingsModal.classList.remove('show');
  });
  
  // Фонды
  elements.enableFundBtn.addEventListener('click', () => {
    elements.moreMenu.classList.remove('show');
    toggleMenu(elements.fundModal);
  });
  
  elements.saveFundBtn.addEventListener('click', () => {
    const name = elements.fundName.value.trim() || `Фонд ${fundWidgets.length + 1}`;
    const amount = parseCurrency(elements.fundAmount.value);
    if (!isNaN(amount) && amount > 0) {
      createNewFundWidget(name, amount, amount);
      elements.fundModal.classList.remove('show');
    }
  });
  
  elements.cancelFundBtn.addEventListener('click', () => {
    elements.fundModal.classList.remove('show');
  });
  
  // Месяцы
  elements.monthTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      elements.monthTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentMonth = parseInt(tab.dataset.month);
      checkMonthSequence(currentMonth);
      updateUI();
    });
  });
  
  // Год
  elements.yearSelectBtn.addEventListener('click', () => {
    elements.moreMenu.classList.remove('show');
    toggleMenu(elements.yearSelectModal);
    renderYearSelection();
  });
  
  elements.addYearBtn.addEventListener('click', addNewYear);
  
  // История
  elements.historyBtn.addEventListener('click', () => {
    elements.moreMenu.classList.remove('show');
    openFullscreenModal(elements.historyModal);
  });
  
  // Достижения
  elements.achievementsBtn.addEventListener('click', () => {
    elements.moreMenu.classList.remove('show');
    openFullscreenModal(elements.achievementsModal);
    renderAchievementsList();
  });
  
  // Сброс
  elements.resetBtn.addEventListener('click', () => {
    elements.moreMenu.classList.remove('show');
    showResetSlider();
  });
  
  // Перенос данных
  elements.transferDataBtn.addEventListener('click', () => {
    elements.moreMenu.classList.remove('show');
    toggleMenu(elements.transferDataModal);
    
    // Добавляем инструкции для iOS если нужно
    if ((isIOS || isTelegramIOS) && elements.exportSection) {
      const existingInstructions = elements.exportSection.querySelector('.ios-instructions');
      if (!existingInstructions) {
        const iosInstructions = document.createElement('div');
        iosInstructions.className = 'ios-instructions';
        iosInstructions.innerHTML = `
          <h4><span>📱</span> Для iOS пользователей</h4>
          <p>Нажмите кнопку экспорта и выберите "Поделиться" → "Сохранить в Файлы"</p>
        `;
        elements.exportSection.appendChild(iosInstructions);
      }
    }
  });
  
  // Экспорт данных
  elements.exportDataBtn.addEventListener('click', exportDataToFile);
  
  // Импорт через File System API
  if (elements.importFilesBtn) {
    elements.importFilesBtn.addEventListener('click', async () => {
      try {
        await importWithFileSystemAPI();
      } catch (error) {
        console.error('Import error:', error);
      }
    });
  }
  
  // Обработка выбора файла
  elements.fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
      elements.selectedFileName.textContent = 
        `Выбран: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
      elements.importDataBtn.disabled = false;
    }
  });
  
  // Импорт данных
  elements.importDataBtn.addEventListener('click', function() {
    const file = elements.fileInput.files[0];
    importDataFromFile(file);
  });
  
  // Drag для достижения
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
  
  // Закрытие модальных окон по клику на бэкдроп
  document.getElementById('fullscreen-backdrop').addEventListener('click', closeFullscreenModal);
  
  // Закрытие по Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeFullscreenModal();
  });
  
  // Закрытие по клику вне меню
  document.addEventListener('click', (e) => {
    const menus = [
      elements.categoryMenu, elements.capitalizationMenu, elements.settingsMenu, 
      elements.setBudgetModal, elements.moreMenu, elements.savingsModal, 
      elements.fundModal, elements.yearSelectModal, elements.historyModal, 
      elements.achievementsModal, elements.transferDataModal
    ];
    
    const clickOutside = !menus.some(menu => menu && menu.contains(e.target));
    const isMenuButton = [
      elements.categoryBtn, elements.capitalizationBtn, elements.settingsBtn, 
      elements.budgetSettingsBtn, elements.moreBtn, elements.enableSavingsBtn, 
      elements.enableFundBtn, elements.yearSelectBtn, elements.historyBtn, 
      elements.achievementsBtn, elements.resetBtn, elements.transferDataBtn
    ].some(button => button && button.contains(e.target));
    
    if (clickOutside && !isMenuButton) {
      menus.forEach(menu => {
        if (menu) menu.classList.remove('show');
      });
    }
  });
  
  // Обработка нажатия Enter в полях ввода
  elements.incomeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      elements.addIncomeBtn.click();
    }
  });
  
  elements.newCategoryInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      elements.addCategoryBtn.click();
    }
  });
}

// Инициализация приложения
function initializeApp() {
  console.log('Initializing app...');
  
  // Загружаем данные
  if (!loadData()) {
    console.log('Creating new data structure...');
    financeData = {}; 
    budgetData = getDefaultBudgetData(); 
    savingsWidgets = []; 
    fundWidgets = []; 
    achievementsData = {};
  }
  
  // Инициализируем текущий год
  initYearData(currentYear);
  
  // Устанавливаем активный месяц
  elements.monthTabs[currentMonth]?.classList.add('active');
  
  // Восстанавливаем тему
  if (localStorage.getItem('darkTheme') === 'true') {
    document.body.classList.add('dark');
    elements.themeToggleBtn.innerHTML = '<span class="theme-icon">☀️</span> Сменить тему';
  }
  
  // Настраиваем обработчики событий
  setupEventHandlers();
  
  // Настраиваем обработчики свайпов
  setupSwipeHandlers();
  
  // Обновляем интерфейс
  updateUI();
  
  // Разблокируем достижение "Лучше большинства"
  if (!achievementsData['better_than_most']) {
    unlockAchievement('better_than_most');
  }
  
  // Автосохранение
  window.addEventListener('beforeunload', () => {
    if (hasUnsavedChanges) saveData();
  });
  
  // Периодическое автосохранение
  setInterval(() => {
    if (hasUnsavedChanges) {
      saveData();
      console.log('Auto-saved data');
    }
  }, 30000);
  
  // Инициализация Telegram Web App
  if (window.Telegram?.WebApp) {
    Telegram.WebApp.ready();
    Telegram.WebApp.expand();
    Telegram.WebApp.setHeaderColor('#3498db');
    Telegram.WebApp.setBackgroundColor('#f0f4f8');
    Telegram.WebApp.enableClosingConfirmation();
    
    console.log('Telegram Web App initialized');
  }
  
  console.log('App initialized successfully');
}

// Запуск приложения
initializeApp();
});
