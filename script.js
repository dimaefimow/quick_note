document.addEventListener('DOMContentLoaded', function() {
  // Текущий месяц и год
  let currentMonth = new Date().getMonth();
  let currentYear = new Date().getFullYear();
  
  // Названия месяцев
  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 
    'Май', 'Июнь', 'Июль', 'Август', 
    'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  // Данные приложения
  let financeData = JSON.parse(localStorage.getItem('financeData')) || {};
  
  // Инициализация данных для года
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
  
  // Инициализация текущего года
  initYearData(currentYear);
  
  // Данные бюджета
  let budgetData = JSON.parse(localStorage.getItem('budgetData')) || {
    totalAmount: 0,
    days: 0,
    startDate: null,
    spent: 0,
    dailyHistory: {}
  };

  // Данные накоплений (теперь массив виджетов)
  let savingsWidgets = JSON.parse(localStorage.getItem('savingsWidgets')) || [];

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
    tutorialOverlay: document.getElementById('tutorial-overlay'),
    tutorialBox: document.getElementById('tutorial-box'),
    tutorialTitle: document.getElementById('tutorial-title'),
    tutorialText: document.getElementById('tutorial-text'),
    tutorialPrev: document.getElementById('tutorial-prev'),
    tutorialNext: document.getElementById('tutorial-next'),
    tutorialClose: document.getElementById('tutorial-close')
  };

  // Функция сохранения данных
  function saveData() {
    localStorage.setItem('financeData', JSON.stringify(financeData));
    updateCategoriesList();
  }

  // Форматирование валюты
  function formatCurrency(amount) {
    return amount.toLocaleString('ru-RU') + ' ₽';
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
      
      saveData();
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

  // Отображение самых затратных категорий
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
          const percent = Math.round((amount / totalExpense) * 100);
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
    
    for (let i = 0; i < 12; i++) {
      const monthData = financeData[currentYear][i] || { income: 0, expense: 0, capital: 0 };
      capitalData.push(monthData.capital);
      expenseData.push(monthData.expense);
    }
    
    // График капитализации
    if (miniCapitalChart) miniCapitalChart.destroy();
    const capitalCtx = elements.miniCapitalChart?.getContext('2d');
    if (capitalCtx) {
      miniCapitalChart = new Chart(capitalCtx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            data: capitalData,
            borderColor: '#3498db',
            backgroundColor: 'rgba(52, 152, 219, 0.1)',
            borderWidth: 2,
            tension: 0.3,
            fill: true
          }]
        },
        options: getChartOptions('Капитализация')
      });
    }
    
    // График расходов
    if (miniExpenseChart) miniExpenseChart.destroy();
    const expenseCtx = elements.miniExpenseChart?.getContext('2d');
    if (expenseCtx) {
      miniExpenseChart = new Chart(expenseCtx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            data: expenseData,
            backgroundColor: 'rgba(231, 76, 60, 0.7)',
            borderColor: 'rgba(231, 76, 60, 1)',
            borderWidth: 1
          }]
        },
        options: getChartOptions('Расходы')
      });
    }
  }

  // Настройки графиков
  function getChartOptions(title) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.parsed.y.toLocaleString('ru-RU')} ₽`;
            }
          }
        },
        title: {
          display: false,
          text: title
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return (value / 1000).toFixed(0) + 'k ₽';
            },
            color: document.body.classList.contains('dark') ? '#eee' : '#333'
          },
          grid: {
            color: document.body.classList.contains('dark') ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
          }
        },
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: document.body.classList.contains('dark') ? '#eee' : '#333'
          }
        }
      },
      animation: {
        duration: 1000,
        easing: 'easeOutQuart'
      },
      devicePixelRatio: 1, // Фиксируем соотношение пикселей
      layout: {
        padding: {
          left: 10,
          right: 10,
          top: 10,
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
    
    // Отрисовка истории трат
    renderExpenseHistory();
    
    // Отрисовка графиков динамики категорий
    renderCategoryTrends();
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
        <button class="delete-widget-btn" data-category="${cat}">×</button>
        <h3 style="color: ${color}">${cat}</h3>
        <p>${formatCurrency(val)}</p>
        <div class="widget-input-group">
          <input type="number" class="neumorphic-input widget-input" placeholder="Сумма" id="expense-${cat}">
          <button class="neumorphic-btn small" data-category="${cat}">+</button>
        </div>
      `;
      
      elements.widgetsContainer.appendChild(widget);
    });

    // Добавляем обработчики для новых кнопок
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
  }

  // Отрисовка всех виджетов накоплений
  function renderSavingsWidgets() {
    // Сначала удаляем все существующие виджеты накоплений
    document.querySelectorAll('.savings-widget').forEach(widget => widget.remove());
    
    // Затем создаем новые виджеты из сохраненных данных
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
      
      // Добавляем обработчики для нового виджета
      widgetElement.querySelector('.add-savings-btn').addEventListener('click', addToSavings);
      widgetElement.querySelector('.delete-widget-btn').addEventListener('click', deleteSavingsWidget);
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
        localStorage.setItem('savingsWidgets', JSON.stringify(savingsWidgets));
        
        // Обновляем только этот виджет
        updateSingleWidget(widgetId);
        
        input.value = '';
        this.classList.add('pulse');
        setTimeout(() => this.classList.remove('pulse'), 500);
      }
    }
  }

  // Удаление виджета накоплений
  function deleteSavingsWidget() {
    const widgetId = this.dataset.widgetId;
    if (confirm('Удалить этот виджет накоплений?')) {
      savingsWidgets = savingsWidgets.filter(w => w.id !== widgetId);
      localStorage.setItem('savingsWidgets', JSON.stringify(savingsWidgets));
      document.querySelector(`.savings-widget[data-widget-id="${widgetId}"]`).remove();
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

  // Создание нового виджета накоплений
  function createNewSavingsWidget(name = '', goal = 0, current = 0) {
    const widgetId = Date.now().toString(); // Уникальный ID для виджета
    
    const newWidget = {
      id: widgetId,
      name: name || `Накопления ${savingsWidgets.length + 1}`,
      goal: goal || 0,
      current: current || 0,
      color: getRandomWidgetColor()
    };
    
    savingsWidgets.push(newWidget);
    localStorage.setItem('savingsWidgets', JSON.stringify(savingsWidgets));
    
    // Отрисовываем новый виджет
    renderSavingsWidgets();
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
      
      saveData();
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
      
      saveData();
      
      // Обновляем дневные траты в бюджете
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      if (budgetData.startDate && budgetData.dailyHistory[todayStr]) {
        budgetData.dailyHistory[todayStr].spentToday += expenseVal;
        localStorage.setItem('budgetData', JSON.stringify(budgetData));
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

    const backgroundColors = categoryNames.map((_, index) => {
      const color = categoryColors[index % categoryColors.length];
      const gradient = ctx.createLinearGradient(0, 0, 0, 400);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, shadeColor(color, -40));
      return gradient;
    });

    chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: categoryNames,
        datasets: [{
          label: 'Расходы по категориям',
          data: values,
          backgroundColor: backgroundColors,
          borderColor: document.body.classList.contains('dark') ? '#2e2e2e' : '#e0e5ec',
          borderWidth: 2,
          borderRadius: 10,
          borderSkipped: false,
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

    capitalChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Капитализация'],
        datasets: [{
          label: 'Капитализация',
          data: [capitalValue],
          backgroundColor: '#3498db33',
          borderColor: '#3498db',
          borderWidth: 3,
          tension: 0.3,
          fill: true,
          pointBackgroundColor: '#3498db',
          pointRadius: 5,
          pointHoverRadius: 7
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
      document.body.removeChild(successMsg);
    }, 3000);
  }

  // Функция обновления виджета бюджета
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
    
    // Проверяем, что бюджет в текущем месяце
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

    // Рассчитываем прошедшие дни (включая текущий)
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

    // Рассчитываем остаток бюджета с учетом перерасходов/экономии
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

    // Рассчитываем дневной бюджет с учетом остатка
    const dailyBudget = remainingAmount / remainingDays;
    
    elements.dailyBudgetAmount.textContent = formatCurrency(dailyBudget);
    elements.budgetProgress.textContent = 
        `Остаток: ${formatCurrency(remainingAmount)} | ${remainingDays} дн.`;
    
    // Обновляем прогресс-бары (реверсивные)
    const daysProgress = 100 - (elapsedDays / budgetData.days * 100);
    const fundsProgress = 100 - (totalSpent / budgetData.totalAmount * 100);
    
    if (elements.daysProgressBar) elements.daysProgressBar.style.width = `${Math.max(0, daysProgress)}%`;
    if (elements.fundsProgressBar) elements.fundsProgressBar.style.width = `${Math.max(0, fundsProgress)}%`;
    if (elements.daysProgressValue) elements.daysProgressValue.textContent = `${Math.round(Math.max(0, daysProgress))}%`;
    if (elements.fundsProgressValue) elements.fundsProgressValue.textContent = `${Math.round(Math.max(0, fundsProgress))}%`;
    
    // Обновляем историю трат
    if (!budgetData.dailyHistory[todayStr]) {
      budgetData.dailyHistory[todayStr] = {
        date: todayStr,
        dailyBudget: dailyBudget,
        spentToday: 0
      };
    }
    localStorage.setItem('budgetData', JSON.stringify(budgetData));
  }

  // Просмотр истории трат
  function renderExpenseHistory() {
    elements.historyList.innerHTML = '';
    const monthData = financeData[currentYear][currentMonth];
    const history = monthData.expensesHistory || [];
    
    // Сортируем от последних к старым
    const sortedHistory = [...history].reverse();
    
    sortedHistory.forEach(item => {
      const historyItem = document.createElement('div');
      historyItem.className = 'history-item';
      historyItem.innerHTML = `
        <div>${item.category}: ${formatCurrency(item.amount)}</div>
        <div class="history-date">${item.date}</div>
      `;
      elements.historyList.appendChild(historyItem);
    });
  }

  // Выбор года
  function renderYearSelection() {
    elements.yearsList.innerHTML = '';
    
    // Получаем все доступные годы
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
      localStorage.setItem('financeData', JSON.stringify(financeData));
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
      
      // Собираем данные по категории за все месяцы года
      for (let i = 0; i < 12; i++) {
        const monthCatData = financeData[currentYear][i].categories || {};
        trendData.push(monthCatData[category] || 0);
      }
      
      const container = document.createElement('div');
      container.className = 'trend-chart-container';
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
          ...getChartOptions(category),
          aspectRatio: 1,
          maintainAspectRatio: true
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
    
    // Показываем обучение при первом запуске
    if (!localStorage.getItem('tutorialShown')) {
      showTutorialStep(0);
      localStorage.setItem('tutorialShown', 'true');
    }
  }

  // Функция для переключения меню
  function toggleMenu(menuElement) {
    // Скрываем все другие меню
    document.querySelectorAll('.neumorphic-menu').forEach(menu => {
      if (menu !== menuElement) menu.classList.remove('show');
    });
    
    // Переключаем текущее меню
    menuElement.classList.toggle('show');
    
    // Позиционируем меню по центру экрана
    if (menuElement.classList.contains('show')) {
      menuElement.style.top = '50%';
      menuElement.style.left = '50%';
      menuElement.style.transform = 'translate(-50%, -50%)';
    }
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
        saveData();
        updateUI();
        
        elements.addIncomeBtn.classList.add('pulse');
        setTimeout(() => elements.addIncomeBtn.classList.remove('pulse'), 500);
      }
    });

    // Добавление категории
    elements.addCategoryBtn.addEventListener('click', () => {
      const categoryName = elements.newCategoryInput.value.trim();
      if (categoryName) {
        // Добавляем категорию во все месяцы текущего года
        for (let i = 0; i < 12; i++) {
          const monthData = financeData[currentYear][i];
          if (!monthData.categories[categoryName]) {
            monthData.categories[categoryName] = 0;
          }
        }
        elements.newCategoryInput.value = '';
        saveData();
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
        saveData();
        updateUI();
        elements.capitalizationMenu.classList.remove('show');
      }
    });

    elements.cancelCapitalBtn.addEventListener('click', () => {
      elements.capitalizationMenu.classList.remove('show');
    });

    // Настройки/отчеты
    elements.settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu(elements.settingsMenu);
    });

    elements.closeReportsBtn.addEventListener('click', () => {
      elements.settingsMenu.classList.remove('show');
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
        localStorage.setItem('budgetData', JSON.stringify(budgetData));
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

    // Виджет накоплений
    elements.enableSavingsBtn.addEventListener('click', () => {
      elements.moreMenu.classList.remove('show');
      toggleMenu(elements.savingsModal);
      
      // Сбрасываем поля формы при открытии
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

    // История трат
    elements.historyBtn.addEventListener('click', () => {
      elements.moreMenu.classList.remove('show');
      toggleMenu(elements.historyModal);
    });
    
    elements.closeHistory.addEventListener('click', () => {
      elements.historyModal.classList.remove('show');
    });

    // Закрытие меню при клике вне их
    document.addEventListener('click', (e) => {
      // Список всех меню
      const menus = [
        elements.categoryMenu,
        elements.capitalizationMenu,
        elements.settingsMenu,
        elements.setBudgetModal,
        elements.moreMenu,
        elements.savingsModal,
        elements.yearSelectModal,
        elements.historyModal
      ];
      
      // Проверяем, был ли клик вне меню
      const clickOutside = !menus.some(menu => menu.contains(e.target));
      
      // Проверяем, была ли нажата кнопка меню
      const isMenuButton = [
        elements.categoryBtn,
        elements.capitalizationBtn,
        elements.settingsBtn,
        elements.budgetSettingsBtn,
        elements.moreBtn,
        elements.enableSavingsBtn,
        elements.yearSelectBtn,
        elements.historyBtn
      ].some(button => button.contains(e.target));
      
      // Закрываем все меню, если клик был вне меню и не по кнопке меню
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
      { element: elements.savingsGoal, handler: elements.saveSavingsBtn }
    ];

    enterHandlers.forEach(item => {
      item.element.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          item.handler.click();
        }
      });
    });
  }

  // Инициализация приложения
  function initializeApp() {
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
      const icon = elements.themeToggleBtn.querySelector('.theme-icon');
      icon.textContent = '☀️';
    }
    
    // Обработчик переключения темы
    elements.themeToggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('dark');
      localStorage.setItem('darkTheme', document.body.classList.contains('dark'));
      
      const icon = elements.themeToggleBtn.querySelector('.theme-icon');
      if (document.body.classList.contains('dark')) {
        icon.textContent = '☀️';
      } else {
        icon.textContent = '🌙';
      }
      
      renderAllCharts();
    });
    
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
    
    // Оптимизация обработчика изменения размера
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(handleResize, 250);
    });
  }

  // Запуск приложения
  initializeApp();
});
