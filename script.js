// script.js

// === KHAI BÁO BIẾN TRẠNG THÁI TOÀN CỤC ===
let appData = loadAppData();
let currentUser = appData.users.find(u => u.isLoggedIn);

// === KHAI BÁO CÁC PHẦN TỬ UI QUAN TRỌNG ===
const authScreen = document.getElementById('auth-screen');
const profileSetupScreen = document.getElementById('profile-setup-screen');
const mainApp = document.getElementById('main-app');
const globalMessage = document.getElementById('global-message');

// Lấy các element khác
const currentBalanceDisplay = document.getElementById('current-balance');
const dailySpentDisplay = document.getElementById('daily-spent');
const dailyLimitAlert = document.getElementById('daily-limit-alert'); 
const transactionList = document.getElementById('transaction-list');
const transactionForm = document.getElementById('transaction-form');
const savingsForm = document.getElementById('savings-form');
const savingsTransferForm = document.getElementById('savings-transfer-form');
const dateInput = document.getElementById('date-input');
const monthlyPieChartCanvas = document.getElementById('monthlyPieChart');
const historyBarChartCanvas = document.getElementById('historyBarChart');

// Biến mới cho tính năng vượt mức
const limitOverrideModal = document.getElementById('limit-override-modal'); 
const limitOverrideForm = document.getElementById('limit-override-form'); 
let transactionPending = null; // BIẾN MỚI: Lưu giao dịch đang chờ xác nhận

let monthlyPieChartInstance = null;
let historyBarChartInstance = null;

// === HÀM LƯU & TẢI DỮ LIỆU ===
function loadAppData() {
    const defaultData = {
        users: [],
        categories: {
            'an-uong': 'Ăn Uống', 'hoc-tap': 'Học Tập', 'giai-tri': 'Giải Trí', 
            'di-lai': 'Đi Lại', 'sinh-hoat': 'Sinh Hoạt', 'khac': 'Khác',
            'thu-nhap-chinh': 'Thu Nhập Chính', 'thu-nhap-phu': 'Thu Nhập Phụ', 'khoi-tao': 'Khởi Tạo',
            'tiet-kiem': 'Tiết Kiệm' 
        }
    };
    const data = localStorage.getItem('financeFlowData');
    return data ? JSON.parse(data) : defaultData;
}

function saveAppData() {
    localStorage.setItem('financeFlowData', JSON.stringify(appData));
}

// === HÀM TIỆN ÍCH CHUNG ===
function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function showMessage(msg, type = 'success') {
    globalMessage.textContent = msg;
    globalMessage.className = `message active ${type}`;
    globalMessage.style.display = 'block';
    
    setTimeout(() => {
        globalMessage.style.display = 'none';
        globalMessage.classList.remove('active');
    }, 3000);
}

function getCurrentDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function calculateBalance(transactions, initialBalance) {
    let balance = initialBalance;
    transactions.forEach(t => {
        if (t.type === 'income') {
            balance += t.amount;
        } else if (t.type === 'expense') {
            balance -= t.amount;
        }
    });
    return balance;
}

// Hàm lưu giao dịch (được gọi từ cả form thường và modal xác nhận)
function saveTransaction(transaction, overrideReason = '') {
    if (overrideReason) {
        // Thêm lý do vượt mức vào ghi chú giao dịch
        transaction.note = `[VƯỢT MỨC: ${overrideReason}] ${transaction.note}`;
    }
    
    currentUser.transactions.push(transaction);
    saveAppData();
    // Bắt buộc update UI sau khi lưu giao dịch
    updateAppUI(); 
}

/**
 * Kiểm tra và xử lý hoàn thành mục tiêu tiết kiệm.
 * Nếu hoàn thành, sẽ lưu vào lịch sử, reset mục tiêu hiện tại và lưu appData.
 * @returns {boolean} True nếu mục tiêu được hoàn thành và reset.
 */
function checkSavingsCompletion() {
    if (!currentUser) return false;
    const savings = currentUser.savings;

    // Chỉ kiểm tra và reset nếu có mục tiêu đang hoạt động (goal > 0) và đã đạt mục tiêu
    if (savings.goal > 0 && savings.currentAmount >= savings.goal) {
        
        // 1. Ghi vào lịch sử tiết kiệm
        const completedGoal = {
            id: Date.now().toString(),
            name: savings.name,
            goal: savings.goal,
            amount: savings.currentAmount,
            completedDate: getCurrentDate()
        };
        
        // Đảm bảo savingsHistory tồn tại 
        if (!currentUser.savingsHistory) {
            currentUser.savingsHistory = [];
        }
        currentUser.savingsHistory.push(completedGoal);

        // 2. Reset mục tiêu hiện tại
        savings.name = 'Mục tiêu mới';
        savings.goal = 0;
        savings.currentAmount = 0; // Đặt lại về 0
        savings.password = ''; 
        
        // 3. Thông báo chúc mừng
        showMessage(`🎉 CHÚC MỪNG! Bạn đã hoàn thành mục tiêu "${completedGoal.name}" (${formatCurrency(completedGoal.goal)})! Mục tiêu đã được reset, bạn có thể thiết lập mục tiêu mới.`, 'success');
        return true;
    }
    return false;
}


// === CÁC HÀM UPDATE UI VÀ BIỂU ĐỒ ===
function checkDailyLimit(dailySpent, dailyLimit) {
    if (dailyLimit > 0 && dailySpent > dailyLimit) {
        dailyLimitAlert.style.display = 'block';
    } else {
        dailyLimitAlert.style.display = 'none';
    }
}

function updateDashboard() {
    if (!currentUser) return;
    
    const transactions = currentUser.transactions;
    const { initialBalance, monthlyIncome, dailyLimit } = currentUser.profile;
    const currentBalance = calculateBalance(transactions, initialBalance);
    
    currentBalanceDisplay.textContent = formatCurrency(currentBalance);
    currentBalanceDisplay.classList.toggle('negative', currentBalance < 0);
    currentBalanceDisplay.classList.toggle('positive', currentBalance >= 0);

    const todayStr = getCurrentDate();
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    const monthlyExpense = transactions.filter(t => 
        t.type === 'expense' && new Date(t.date).getMonth() === currentMonth && 
        new Date(t.date).getFullYear() === currentYear && t.category !== 'tiet-kiem' 
    ).reduce((sum, t) => sum + t.amount, 0);
    document.getElementById('monthly-expense').textContent = formatCurrency(monthlyExpense);
    
    const dailySpent = transactions.filter(t => 
        t.type === 'expense' && t.date === todayStr && t.category !== 'tiet-kiem' 
    ).reduce((sum, t) => sum + t.amount, 0);
    dailySpentDisplay.textContent = formatCurrency(dailySpent);
    
    checkDailyLimit(dailySpent, dailyLimit); 
    
    document.getElementById('daily-limit-display').textContent = formatCurrency(dailyLimit);
    
    const ratio = monthlyIncome > 0 ? ((monthlyExpense / monthlyIncome) * 100).toFixed(1) : 0;
    document.getElementById('expense-ratio').textContent = `${ratio}%`;
    
    // Cập nhật biểu đồ
    renderPieChart();
    renderBarChart(); 
}

// Biểu đồ Tròn: Phân bổ Chi tiêu Tháng hiện tại
function renderPieChart() {
    if (!currentUser || !monthlyPieChartCanvas) return;

    const transactions = currentUser.transactions;
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const currentMonthExpenses = transactions.filter(t => 
        t.type === 'expense' && 
        new Date(t.date).getMonth() === currentMonth && 
        new Date(t.date).getFullYear() === currentYear &&
        t.category !== 'tiet-kiem' 
    );

    const categoryTotals = currentMonthExpenses.reduce((acc, t) => {
        const categoryName = appData.categories[t.category] || t.category; 
        acc[categoryName] = (acc[categoryName] || 0) + t.amount;
        return acc;
    }, {});

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#a1a1aa', '#64748b', '#22c55e']; 

    if (monthlyPieChartInstance) {
        monthlyPieChartInstance.destroy();
    }

    monthlyPieChartInstance = new Chart(monthlyPieChartCanvas, {
        type: 'doughnut', 
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length), 
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, 
            plugins: {
                legend: {
                    position: 'right', 
                },
                title: {
                    display: true,
                    text: 'Phân Bổ Chi Tiêu Tháng Này'
                }
            }
        }
    });
}

// Biểu đồ Cột: Lịch sử Thu/Chi theo 7 ngày gần nhất
function renderBarChart() {
    if (!currentUser || !historyBarChartCanvas) return;

    const transactions = currentUser.transactions;
    const daysToShow = 7;
    const dataByDate = {};
    
    for (let i = daysToShow - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        dataByDate[dateStr] = { expense: 0, income: 0 };
    }

    transactions.forEach(t => {
        if (dataByDate[t.date]) {
            if (t.type === 'expense' && t.category !== 'tiet-kiem') {
                dataByDate[t.date].expense += t.amount;
            } else if (t.type === 'income') {
                dataByDate[t.date].income += t.amount;
            }
        }
    });

    const dates = Object.keys(dataByDate).map(d => {
        const parts = d.split('-');
        return `${parts[2]}/${parts[1]}`;
    });
    const expenseData = Object.values(dataByDate).map(d => d.expense);
    const incomeData = Object.values(dataByDate).map(d => d.income);

    if (historyBarChartInstance) {
        historyBarChartInstance.destroy();
    }

    historyBarChartInstance = new Chart(historyBarChartCanvas, {
        type: 'bar',
        data: {
            labels: dates,
            datasets: [
                {
                    label: 'Chi Tiêu',
                    data: expenseData,
                    backgroundColor: '#ef4444',
                },
                {
                    label: 'Thu Nhập',
                    data: incomeData,
                    backgroundColor: '#10b981',
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Thu Chi 7 Ngày Gần Nhất'
                }
            },
            scales: {
                x: { stacked: false }, 
                y: { stacked: false }
            }
        }
    });
}

// Hàm hiển thị Lịch sử Tiết kiệm đã hoàn thành
function renderSavingsHistory() {
    if (!currentUser || !document.getElementById('savings-history-list')) return;

    const historyList = document.getElementById('savings-history-list');
    // Đảm bảo savingsHistory tồn tại và sắp xếp theo ngày hoàn thành mới nhất
    const history = currentUser.savingsHistory ? 
        [...currentUser.savingsHistory].sort((a, b) => b.id - a.id) : []; 

    historyList.innerHTML = '';
    
    if (history.length === 0) {
        historyList.innerHTML = '<li class="empty-list">Chưa có mục tiêu nào được hoàn thành.</li>';
        return;
    }

    history.forEach(item => {
        const li = document.createElement('li');
        li.className = 'history-item savings-item';
        li.innerHTML = `
            <div class="item-details">
                <p><strong>${item.name}</strong></p>
                <p class="small-text">Hoàn thành ngày: ${item.completedDate}</p>
            </div>
            <span class="item-amount positive">${formatCurrency(item.amount)} / ${formatCurrency(item.goal)}</span>
        `;
        historyList.appendChild(li);
    });
}

function updateSavingsUI() {
    if (!currentUser) return;

    const savings = currentUser.savings;
    const currentAmount = savings.currentAmount;
    const goal = savings.goal;
    const name = savings.name;

    document.getElementById('savings-goal-name').textContent = name || 'Chưa Thiết Lập Mục Tiêu';
    document.getElementById('target-savings-amount').textContent = formatCurrency(goal);
    document.getElementById('current-savings-amount').textContent = formatCurrency(currentAmount);
    
    // Nếu mục tiêu đã hoàn thành (nhưng chưa reset) -> hiển thị số tiền là mục tiêu
    const displayAmount = (goal > 0 && currentAmount >= goal) ? goal : currentAmount; 

    let percentage = goal > 0 ? (displayAmount / goal) * 100 : 0;
    percentage = Math.min(percentage, 100);
    
    const savingsProgressBar = document.getElementById('savings-progress-bar');
    savingsProgressBar.style.width = `${percentage.toFixed(0)}%`;
    savingsProgressBar.textContent = `${percentage.toFixed(0)}%`;
    savingsProgressBar.classList.toggle('success-bar', percentage >= 100);
    
    renderSavingsHistory();
}

function updateHistoryList(filterType = 'all', filterMonth = '') {
    if (!currentUser || !transactionList) return;
    const transactions = [...currentUser.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

    const [filterYear, filterMon] = filterMonth.split('-');
    
    const filteredList = transactions.filter(t => {
        let isMatch = true;
        if (t.category === 'khoi-tao') return false; 
        
        if (filterType !== 'all') {
            if (filterType === 'expense' && (t.type !== 'expense' || t.category === 'tiet-kiem')) {
                isMatch = false;
            } else if (filterType === 'income' && t.type !== 'income') {
                 isMatch = false;
            }
        }
        if (filterMonth) {
            const date = new Date(t.date);
            if (date.getFullYear() !== parseInt(filterYear) || date.getMonth() + 1 !== parseInt(filterMon)) {
                isMatch = false;
            }
        }
        return isMatch;
    });

    transactionList.innerHTML = '';
    if (filteredList.length === 0) {
        transactionList.innerHTML = '<li class="empty-list">Không tìm thấy giao dịch nào.</li>';
        return;
    }

    filteredList.forEach(t => {
        const li = document.createElement('li');
        let typeClass = t.type === 'expense' ? 'expense-item' : 'income-item';
        let amountText = t.type === 'expense' ? 
            `<span class="item-amount negative">- ${formatCurrency(t.amount)}</span>` : 
            `<span class="item-amount positive">+ ${formatCurrency(t.amount)}</span>`;

        if (t.category === 'tiet-kiem') {
            typeClass = 'savings-item';
            amountText = `<span class="item-amount negative">-> ${formatCurrency(t.amount)} (Quỹ)</span>`;
        }

        li.className = `${typeClass} ${t.id}`;
        li.innerHTML = `
            <div class="item-details">
                <p><strong>${appData.categories[t.category] || t.category}</strong> - <span class="small-text">${t.note || 'Không ghi chú'}</span></p>
                <p class="small-text">${t.date}</p>
            </div>
            ${amountText}
            <div class="item-actions">
                <button onclick="deleteTransaction('${t.id}')"><i class="fas fa-trash"></i></button>
            </div>
        `;
        transactionList.appendChild(li);
    });
}

function updateAppUI() {
    if (!currentUser) return;
    // Fix up for existing users without savingsHistory
    if (!currentUser.savingsHistory) {
        currentUser.savingsHistory = [];
        saveAppData();
    }
    
    document.getElementById('current-user-display').textContent = currentUser.username;
    
    // Kiểm tra hoàn thành mục tiêu ngay khi load UI để đảm bảo reset nếu người dùng đang ở tab khác
    if (checkSavingsCompletion()) {
        saveAppData(); // Lưu lại trạng thái reset
    }

    updateDashboard();
    
    dateInput.value = getCurrentDate();
    document.getElementById('set-monthly-income').value = currentUser.profile.monthlyIncome;
    document.getElementById('set-daily-limit').value = currentUser.profile.dailyLimit;

    const historyFilterType = document.getElementById('history-filter-type');
    const historyFilterMonth = document.getElementById('history-filter-month');
    updateHistoryList(historyFilterType.value, historyFilterMonth.value);
    updateSavingsUI();
}

function deleteTransaction(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa giao dịch này?')) return;
    const userIndex = appData.users.findIndex(u => u.username === currentUser.username);
    if (userIndex === -1) return;
    const transactionIndex = currentUser.transactions.findIndex(t => t.id === id);
    if (transactionIndex > -1) {
        const transaction = currentUser.transactions[transactionIndex];
        // Xử lý hoàn tiền tiết kiệm nếu giao dịch bị xóa là chuyển vào tiết kiệm
        if (transaction.category === 'tiet-kiem') {
             // Đảm bảo số tiền hiện tại không âm khi xóa
             currentUser.savings.currentAmount = Math.max(0, currentUser.savings.currentAmount - transaction.amount);
             // Sau khi hoàn tiền, kiểm tra lại để reset nếu mục tiêu vừa bị hoàn thành do lỗi nhập liệu
             checkSavingsCompletion(); 
        }
        currentUser.transactions.splice(transactionIndex, 1);
        appData.users[userIndex] = currentUser;
        saveAppData();
        updateAppUI();
        showMessage('Đã xóa giao dịch thành công!', 'error');
    }
}

// === HÀM KHỞI TẠO ỨNG DỤNG VÀ GÁN LISTENERS ===
function initApp() {
    
    // 1. Kiểm tra trạng thái đăng nhập và chuyển màn hình ban đầu
    if (currentUser) {
        authScreen.classList.remove('active');
        mainApp.classList.add('active');
        updateAppUI();
    } else {
        authScreen.classList.add('active');
        profileSetupScreen.classList.remove('active');
        mainApp.classList.remove('active');
    }

    // 2. Gán Listeners cho ĐĂNG KÝ / ĐĂNG NHẬP
    document.getElementById('show-register').addEventListener('click', () => {
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('register-form').style.display = 'block';
        document.getElementById('auth-error').textContent = '';
    });
    document.getElementById('show-login').addEventListener('click', () => {
        document.getElementById('register-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'block';
        document.getElementById('auth-error').textContent = '';
    });
    
    // 3. Xử lý ĐĂNG KÝ
    document.getElementById('register-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('register-username').value.trim();
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm-password').value;
        const authError = document.getElementById('auth-error');
        authError.textContent = '';
        
        if (password !== confirmPassword) {
            authError.textContent = 'Mật khẩu xác nhận không khớp.';
            return;
        }
        
        if (appData.users.some(u => u.username === username)) {
            authError.textContent = 'Tên đăng nhập đã tồn tại.';
            return;
        }

        appData.tempUser = { username, password }; 
        authScreen.classList.remove('active');
        profileSetupScreen.classList.add('active');
        showMessage('Đăng ký thành công! Hãy thiết lập hồ sơ của bạn.', 'success');
    });

    // 4. Xử lý THIẾT LẬP PROFILE
    document.getElementById('profile-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        if (!appData.tempUser) {
            profileSetupScreen.classList.remove('active');
            authScreen.classList.add('active');
            showMessage('Lỗi phiên đăng ký. Vui lòng đăng ký lại.', 'error');
            return;
        }

        const initialBalance = parseInt(document.getElementById('initial-balance').value) || 0;
        const monthlyIncome = parseInt(document.getElementById('monthly-income').value) || 0;
        const dailyLimit = parseInt(document.getElementById('daily-limit').value) || 0;

        appData.users.forEach(u => u.isLoggedIn = false);
        
        const newUser = {
            username: appData.tempUser.username,
            password: appData.tempUser.password, 
            isLoggedIn: true,
            profile: { initialBalance, monthlyIncome, dailyLimit },
            transactions: [{
                id: Date.now().toString(),
                amount: initialBalance,
                type: 'income',
                category: 'khoi-tao',
                date: getCurrentDate(),
                note: 'Số dư khởi tạo'
            }],
            savings: {
                currentAmount: 0, goal: 0, password: '', name: 'Mục tiêu mặc định'
            },
            savingsHistory: [] // THÊM LỊCH SỬ TIẾT KIỆM
        };

        appData.users.push(newUser);
        currentUser = newUser;
        delete appData.tempUser; 
        saveAppData();
        
        profileSetupScreen.classList.remove('active');
        mainApp.classList.add('active');
        updateAppUI();
        showMessage('Thiết lập hoàn tất! Chào mừng đến với QUẢN LÍ CHI TIÊU CHO HỌC SINH.', 'success');
    });

    // 5. Xử lý ĐĂNG NHẬP
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        const authError = document.getElementById('auth-error');
        authError.textContent = '';

        const userIndex = appData.users.findIndex(u => u.username === username && u.password === password);

        if (userIndex !== -1) {
            appData.users.forEach(u => u.isLoggedIn = false);
            appData.users[userIndex].isLoggedIn = true;
            currentUser = appData.users[userIndex];
            
            saveAppData();
            
            authScreen.classList.remove('active');
            mainApp.classList.add('active');
            updateAppUI();
            showMessage(`Chào mừng trở lại, ${currentUser.username}!`, 'success');
        } else {
            authError.textContent = 'Sai tên đăng nhập hoặc mật khẩu.';
        }
    });

    // 6. Xử lý THOÁT
    document.getElementById('logout-btn-app').addEventListener('click', () => {
        if (currentUser) {
            const userInApp = appData.users.find(u => u.username === currentUser.username);
            if(userInApp) {
                 userInApp.isLoggedIn = false;
            }
            
            saveAppData();
            currentUser = null;
            mainApp.classList.remove('active');
            authScreen.classList.add('active');
            showMessage('Đã đăng xuất.', 'info');
        }
    });
    
    // 7. Gán Listeners cho CHUYỂN TAB
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.target;
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.toggle('active', content.id === target);
            });
            document.getElementById('tab-title').textContent = btn.textContent.trim();
            updateAppUI();
        });
    });

    // 8. Gán Listener cho LỌC LỊCH SỬ
    document.getElementById('filter-history-btn').addEventListener('click', () => {
        const type = document.getElementById('history-filter-type').value;
        const month = document.getElementById('history-filter-month').value;
        updateHistoryList(type, month);
    });
    
    // 9. Gán Listener cho THÊM GIAO DỊCH (Đã thêm logic kiểm tra vượt mức)
    transactionForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const form = e.target;
        const amount = parseInt(document.getElementById('amount-input').value);
        const type = document.getElementById('type-select').value;
        const category = document.getElementById('category-select').value;
        const date = document.getElementById('date-input').value;
        const note = document.getElementById('note-input').value.trim();
        const dailyLimit = currentUser.profile.dailyLimit;
        
        if (amount <= 0) {
            showMessage('Số tiền phải lớn hơn 0.', 'error');
            return;
        }
        
        const balance = calculateBalance(currentUser.transactions, currentUser.profile.initialBalance);
        if (type === 'expense' && amount > balance) {
             showMessage('Số dư hiện tại không đủ để thực hiện giao dịch này.', 'error');
             return;
        }

        const newTransaction = { id: Date.now().toString(), amount, type, category, date, note };
        
        // --- LOGIC KIỂM TRA GIỚI HẠN NGÀY ---
        // Chỉ áp dụng cho chi tiêu (expense) và không phải giao dịch chuyển vào tiết kiệm (tiet-kiem)
        if (type === 'expense' && category !== 'tiet-kiem' && dailyLimit > 0) {
            const todayStr = getCurrentDate();
            const dailySpentBefore = currentUser.transactions.filter(t => 
                t.type === 'expense' && t.date === todayStr && t.category !== 'tiet-kiem' 
            ).reduce((sum, t) => sum + t.amount, 0);
            
            if (dailySpentBefore + amount > dailyLimit) {
                // VƯỢT GIỚI HẠN -> KÍCH HOẠT MODAL XÁC NHẬN
                transactionPending = newTransaction; // Lưu giao dịch vào biến tạm
                limitOverrideModal.style.display = 'block';
                return; // Dừng hàm submit form giao dịch
            }
        }
        
        // Nếu không vượt giới hạn (hoặc là thu nhập/tiết kiệm) -> Lưu bình thường
        saveTransaction(newTransaction);
        form.reset();
        document.getElementById('date-input').value = getCurrentDate();
        showMessage('Đã lưu giao dịch thành công!', 'success');
    });
    
    // === LOGIC XỬ LÝ MODAL XÁC NHẬN VƯỢT MỨC ===

    // Listener cho form xác nhận mật khẩu và lý do
    limitOverrideForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const overridePassword = document.getElementById('override-password').value;
        const overrideReason = document.getElementById('override-reason').value.trim();

        if (!transactionPending) {
            showMessage('Lỗi: Không tìm thấy giao dịch đang chờ xử lý.', 'error');
            limitOverrideModal.style.display = 'none';
            return;
        }

        // Kiểm tra mật khẩu (sử dụng mật khẩu đăng nhập)
        if (overridePassword !== currentUser.password) {
            showMessage('Mật khẩu xác nhận không đúng. Giao dịch bị hủy.', 'error');
            transactionPending = null; 
            limitOverrideForm.reset();
            limitOverrideModal.style.display = 'none';
            return;
        }

        // Xử lý lưu giao dịch với lý do vượt mức
        saveTransaction(transactionPending, overrideReason);
        
        // Reset và đóng modal
        transactionPending = null; 
        limitOverrideForm.reset();
        limitOverrideModal.style.display = 'none';
        
        // Reset form thêm giao dịch chính và thông báo
        transactionForm.reset();
        document.getElementById('date-input').value = getCurrentDate();
        showMessage('Đã lưu giao dịch vượt mức thành công!', 'success');
    });

    // Listener đóng modal khi click nút Hủy
    document.querySelector('[data-modal-cancel="limit-override-modal"]').addEventListener('click', () => {
        transactionPending = null; // Hủy giao dịch đang chờ
        limitOverrideForm.reset();
        limitOverrideModal.style.display = 'none';
        showMessage('Giao dịch vượt mức đã bị hủy.', 'info');
    });

    // Listener đóng modal khi click dấu X
    document.querySelector('[data-modal-close="limit-override-modal"]').addEventListener('click', () => {
        transactionPending = null; // Hủy giao dịch đang chờ
        limitOverrideForm.reset();
        limitOverrideModal.style.display = 'none';
        showMessage('Giao dịch vượt mức đã bị hủy.', 'info');
    });
    
    // 10. Gán Listener cho THIẾT LẬP MỤC TIÊU TIẾT KIỆM
    savingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('savings-name').value.trim();
        const goal = parseInt(document.getElementById('savings-goal-input').value);
        const password = document.getElementById('savings-password').value;
        
        if(goal <= 0) {
            showMessage('Mục tiêu phải lớn hơn 0.', 'error');
            return;
        }

        currentUser.savings.goal = goal;
        currentUser.savings.password = password;
        currentUser.savings.name = name;
        currentUser.savings.currentAmount = 0; // Reset số tiền tích lũy khi đặt mục tiêu mới
        
        saveAppData();
        updateSavingsUI();
        showMessage('Mục tiêu tiết kiệm đã được thiết lập!', 'success');
    });

    // 11. Gán Listener cho CHUYỂN TIỀN VÀO QUỸ (Đã sửa logic để reset ngay lập tức)
    savingsTransferForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const transferAmount = parseInt(document.getElementById('transfer-amount').value);
        const transferPassword = document.getElementById('transfer-password').value;
        
        const savings = currentUser.savings;
        const balance = calculateBalance(currentUser.transactions, currentUser.profile.initialBalance);

        if (transferPassword !== savings.password) {
            showMessage('Mật khẩu Quỹ không đúng.', 'error');
            return;
        }
        
        if (savings.goal <= 0) {
            showMessage('Vui lòng thiết lập mục tiêu tiết kiệm trước.', 'error');
            return;
        }

        if (transferAmount > balance) {
            showMessage('Số dư hiện tại không đủ để chuyển tiền.', 'error');
            return;
        }
        
        // --- LOGIC CŨ BỊ LỖI ---
        // if (savings.currentAmount + transferAmount > savings.goal) {
        //     showMessage('Số tiền chuyển vượt quá mục tiêu tiết kiệm còn lại.', 'error');
        //     return;
        // }
        
        // Tinh chỉnh số tiền chuyển để không vượt quá mục tiêu
        const effectiveTransferAmount = Math.min(transferAmount, savings.goal - savings.currentAmount);

        if (effectiveTransferAmount <= 0) {
             showMessage('Số tiền đã đạt hoặc vượt quá mục tiêu. Vui lòng thiết lập mục tiêu mới.', 'info');
             return;
        }

        // Lưu giao dịch chuyển tiền như một khoản chi tiêu
        currentUser.transactions.push({
            id: Date.now().toString(),
            amount: effectiveTransferAmount,
            type: 'expense',
            category: 'tiet-kiem',
            date: getCurrentDate(),
            note: `Chuyển vào Quỹ Tiết kiệm: ${savings.name}`
        });

        // Tăng số tiền tích lũy
        savings.currentAmount += effectiveTransferAmount;
        
        // Kiểm tra hoàn thành mục tiêu ngay sau khi cập nhật số tiền
        const wasCompleted = checkSavingsCompletion();
        
        // Lưu dữ liệu sau khi giao dịch đã được xử lý (và có thể đã reset)
        saveAppData(); 
        
        updateAppUI();
        savingsTransferForm.reset();
        
        if (!wasCompleted) {
            showMessage('Chuyển tiền vào Quỹ thành công!', 'success');
        } 
        // Thông báo chúc mừng đã được xử lý trong checkSavingsCompletion()
    });
    
    // 12. Gán Listener cho MODAL THU NHẬP NHANH
    document.querySelector('[data-modal="income-modal"]').addEventListener('click', () => {
        document.getElementById('income-modal').style.display = 'block';
        document.getElementById('quick-date').value = getCurrentDate();
    });
    document.querySelector('#income-modal .close-btn').addEventListener('click', () => document.getElementById('income-modal').style.display = 'none');
    window.addEventListener('click', (e) => {
        if (e.target === document.getElementById('income-modal')) document.getElementById('income-modal').style.display = 'none';
    });
    document.getElementById('quick-income-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = parseInt(document.getElementById('quick-amount').value);
        const date = document.getElementById('quick-date').value;

        if (amount <= 0) {
            showMessage('Số tiền phải lớn hơn 0.', 'error');
            return;
        }
        
        currentUser.transactions.push({
            id: Date.now().toString(), amount, type: 'income', category: 'thu-nhap-phu', date, note: 'Thu nhập nhanh'
        });

        saveAppData();
        updateAppUI();
        document.getElementById('income-modal').style.display = 'none';
        showMessage('Đã thêm thu nhập thành công!', 'success');
    });
    
    // 13. Gán Listener cho CẬP NHẬT PROFILE (Cài đặt)
    document.getElementById('update-profile-form').addEventListener('submit', (e) => {
        e.preventDefault();
        currentUser.profile.monthlyIncome = parseInt(document.getElementById('set-monthly-income').value);
        currentUser.profile.dailyLimit = parseInt(document.getElementById('set-daily-limit').value);
        saveAppData();
        updateAppUI();
        showMessage('Đã cập nhật cài đặt thành công!', 'success');
    });


    // 14. Gán Listener cho XÓA TOÀN BỘ DỮ LIỆU
    document.getElementById('reset-data-btn').addEventListener('click', () => {
        if (confirm('CẢNH BÁO: Hành động này sẽ xóa toàn bộ dữ liệu của bạn trên trình duyệt. Bạn có chắc chắn không?')) {
            localStorage.removeItem('financeFlowData');
            currentUser = null;
            appData = loadAppData();
            location.reload(); 
        }
    });
}

// === KHỞI TẠO ỨNG DỤNG ===
document.addEventListener('DOMContentLoaded', initApp);