<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Финансовая аналитика</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  

  <div class="app">
   <div id="achievements-modal" class="neumorphic-menu">
      <h3>Достижения</h3>
      <div id="achievements-list" class="achievements-grid"></div>
      <button id="close-achievements" class="neumorphic-btn">Закрыть</button>
    </div>
    <header>
      <div class="header-container">
        <div class="header-title"></div>
        <div class="header-buttons">
          <button id="capitalization-btn" class="neumorphic-btn small">Капитализация</button>
          <button id="category-btn" class="neumorphic-btn small">Категории ▼</button>
          <button id="settings-btn" class="neumorphic-btn small">Отчёты</button>
          <button id="theme-toggle-btn" class="neumorphic-btn small theme-toggle">
            <span class="theme-icon">🌙</span>
          </button>
          <button id="more-btn" class="neumorphic-btn small">☰</button>
        </div>
      </div>
      
      <div id="more-menu" class="neumorphic-menu">
        <div class="widget savings-widget-preview">
          <h3 style="color: #2ecc71">Накопления</h3>
          <button id="enable-savings-btn" class="neumorphic-btn primary">Включить виджет</button>
        </div>
        <button id="year-select-btn" class="neumorphic-btn primary">Выбрать год</button>
        <button id="history-btn" class="neumorphic-btn primary">История трат</button>
      </div>
      
      <div id="year-select-modal" class="neumorphic-menu">
  <h3>Выберите год</h3>
  <div id="years-list" class="year-list"></div>
  <div class="button-group">
    <button id="add-year-btn" class="neumorphic-btn primary">Добавить</button>
    <button id="close-year-select" class="neumorphic-btn">Закрыть</button>
  </div>
</div>
      
      <div id="history-modal" class="neumorphic-menu">
        <h3>История трат</h3>
        <div id="history-list"></div>
        <button id="close-history" class="neumorphic-btn">Закрыть</button>
      </div>
      
      <div id="settings-menu" class="neumorphic-menu financial-menu">
        <div class="financial-grid">
          <div class="financial-card">
            <h3>Средний доход</h3>
            <p id="avg-income" class="financial-value">0 ₽</p>
          </div>
          <div class="financial-card">
            <h3>Средний расход</h3>
            <p id="avg-expense" class="financial-value">0 ₽</p>
          </div>
          <div class="financial-card">
            <h3>Лучший месяц</h3>
            <p id="best-month" class="financial-value">Нет данных</p>
          </div>
          <div class="financial-card">
            <h3>Общий доход</h3>
            <p id="total-income" class="financial-value">0 ₽</p>
          </div>
          <div class="financial-card">
            <h3>Общий расход</h3>
            <p id="total-expense" class="financial-value">0 ₽</p>
          </div>
        </div>
        
        <div class="mini-charts-container">
          <div class="financial-charts">
            <div class="financial-chart-container">
              <h4>Капитализация по месяцам</h4>
              <canvas id="miniCapitalChart"></canvas>
            </div>
            <div class="financial-chart-container">
              <h4>Расходы по месяцам</h4>
              <canvas id="miniExpenseChart"></canvas>
            </div>
          </div>
        </div>
        
        <div class="top-categories-report">
          <h4>Топ трат категории</h4>
          <div class="categories-scroll-container">
            <div id="top-categories-list" class="categories-list"></div>
          </div>
        </div>
        
        <button id="close-reports-btn" class="neumorphic-btn primary">Закрыть</button>
      </div>
    </header>

    <div id="category-menu" class="category-widget">
      <div class="widget-header">
        <h3>Категории</h3>
        <button id="close-category-widget" class="neumorphic-btn small">×</button>
      </div>
      <div class="widget-content">
        <input type="text" id="new-category-input" placeholder="Новая категория" class="neumorphic-input" />
        <button id="add-category-btn" class="neumorphic-btn small">+ Добавить</button>
        <div id="categories-list" class="categories-list"></div>
      </div>
    </div>

    <div id="capitalization-menu" class="neumorphic-menu">
      <h3>Капитализация</h3>
      <input type="number" id="capital-input" placeholder="Сумма активов" class="neumorphic-input" />
      <div class="button-group">
        <button id="save-capital-btn" class="neumorphic-btn primary">Сохранить</button>
        <button id="cancel-capital-btn" class="neumorphic-btn">Отмена</button>
      </div>
      <div class="chart-container">
        <canvas id="capitalChart"></canvas>
      </div>
    </div>

    <div id="savings-modal" class="neumorphic-menu">
      <h3>Цель накоплений</h3>
      <input type="text" id="savings-name" placeholder="Название цели" class="neumorphic-input" />
      <input type="number" id="savings-goal" placeholder="Целевая сумма (₽)" class="neumorphic-input" />
      <div class="button-group">
        <button id="save-savings-btn" class="neumorphic-btn primary">Сохранить</button>
        <button id="cancel-savings-btn" class="neumorphic-btn">Отмена</button>
      </div>
    </div>

    <section class="month-selector">
      <div class="month-tabs">
        <button class="month-tab neumorphic-btn" data-month="0">Янв</button>
        <button class="month-tab neumorphic-btn" data-month="1">Фев</button>
        <button class="month-tab neumorphic-btn" data-month="2">Мар</button>
        <button class="month-tab neumorphic-btn" data-month="3">Апр</button>
        <button class="month-tab neumorphic-btn" data-month="4">Май</button>
        <button class="month-tab neumorphic-btn" data-month="5">Июн</button>
        <button class="month-tab neumorphic-btn" data-month="6">Июл</button>
        <button class="month-tab neumorphic-btn" data-month="7">Авг</button>
        <button class="month-tab neumorphic-btn" data-month="8">Сен</button>
        <button class="month-tab neumorphic-btn" data-month="9">Окт</button>
        <button class="month-tab neumorphic-btn" data-month="10">Ноя</button>
        <button class="month-tab neumorphic-btn" data-month="11">Дек</button>
      </div>
      <div id="current-year-display" class="year-display" style="text-align: center; margin-top: 10px; font-weight: bold;"></div>
    </section>

    <section class="inputs">
      <div class="input-group">
        <input type="number" id="income-input" placeholder="Доход ₽" class="neumorphic-input" />
        <button id="add-income-btn" class="neumorphic-btn">+</button>
      </div>
    </section>

    <section class="daily-budget-widget">
      <div class="neumorphic-card">
        <div class="budget-header">
          <h3>Дневной бюджет</h3>
          <button id="budget-settings-btn" class="neumorphic-btn small">⚙️</button>
        </div>
        <p id="daily-budget-amount">0 ₽</p>
        <p id="budget-progress">Не задано</p>
        
        <div class="budget-progress-container">
          <div class="progress-info">
            <span>Дни: </span>
            <span id="days-progress-value">0%</span>
          </div>
          <div class="savings-progress-container">
            <div class="savings-progress-bar days-progress" style="width: 0%"></div>
          </div>
          
          <div class="progress-info">
            <span>Средства: </span>
            <span id="funds-progress-value">0%</span>
          </div>
          <div class="savings-progress-container">
            <div class="savings-progress-bar funds-progress" style="width: 0%"></div>
          </div>
        </div>
      </div>
      
      <div id="set-budget-modal" class="neumorphic-menu">
        <h3>Установить бюджет</h3>
        <input type="number" id="budget-amount" placeholder="Общая сумма" class="neumorphic-input" />
        <input type="number" id="budget-days" placeholder="Количество дней" class="neumorphic-input" />
        <div class="button-group">
          <button id="save-budget-btn" class="neumorphic-btn primary">Сохранить</button>
          <button id="cancel-budget-btn" class="neumorphic-btn">Отмена</button>
        </div>
      </div>
    </section>

    <section class="summary">
      <div class="neumorphic-card"><h2>Доход</h2><p id="income">0 ₽</p></div>
      <div class="neumorphic-card"><h2>Расход</h2><p id="expense">0 ₽</p></div>
      <div class="neumorphic-card"><h2>Остаток</h2><p id="percent">0%</p></div>
      <div class="neumorphic-card"><h2>Капитал</h2><p id="capital-display">0 ₽</p></div>
    </section>
    
    <section class="widgets" id="widgets"></section>
    
    <section class="charts">
      <div class="chart-container">
        <canvas id="barChart"></canvas>
      </div>
    </section>
    
    <section class="category-trends">
      <h3>Динамика трат по категориям</h3>
      <div class="trends-container">
        <div class="trends-scroll" id="trends-scroll"></div>
      </div>
    </section>

    <div id="year-summary" class="neumorphic-menu year-summary">
      <h2>Годовой отчёт</h2>
      <div class="chart-container">
        <canvas id="yearIncomeChart"></canvas>
      </div>
      <div class="chart-container">
        <canvas id="yearExpenseChart"></canvas>
      </div>
      <div class="chart-container">
        <canvas id="yearCapitalChart"></canvas>
      </div>
      <button id="close-year-summary" class="neumorphic-btn">Закрыть</button>
    </div>
  </div>

  <div id="tutorial-overlay">
    <div id="tutorial-box" class="neumorphic-card">
      <h2 id="tutorial-title">Добро пожаловать</h2>
      <p id="tutorial-text">Это руководство поможет вам освоить приложение</p>
      <div class="tutorial-buttons">
        <button id="tutorial-prev" class="neumorphic-btn">Назад</button>
        <button id="tutorial-next" class="neumorphic-btn primary">Далее</button>
        <button id="tutorial-close" class="neumorphic-btn">Пропустить</button>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="script.js"></script>
</body>
</html>
