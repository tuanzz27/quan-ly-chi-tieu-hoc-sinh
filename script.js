// script.js

// === KHAI BÁO BIẾN TRẠNG THÁI TOÀN CỤC ===
let appData = loadAppData();
let currentUser = null; 
const loggedInUser = appData.users.find(u => u.isLoggedIn);
if (loggedInUser) {
    currentUser = loggedInUser;
}

// === KHAI BÁO CÁC PHẦN TỬ UI QUAN TRỌNG ===
const authScreen = document.getElementById('auth-screen');
const profileSetupScreen = document.getElementById('profile-setup-screen');
const mainApp = document.getElementById('main-app');
const globalMessage = document.getElementById('global-message');

// Lấy các element khác
const currentBalanceDisplay = document.getElementById('current-balance-display'); 
const monthlyIncomeDisplay = document.getElementById('monthly-income-display'); 
const addBalanceContainer = document.getElementById('add-balance-container'); 
const showAddBalanceFormBtn = document.getElementById('show-add-balance-form-btn'); 
const dailySpentDisplay = document.getElementById('daily-spent');
const dailyLimitAlert = document.getElementById('daily-limit-alert'); 
const transactionList = document.getElementById('transaction-list');
const transactionForm = document.getElementById('transaction-form');
const savingsForm = document.getElementById('savings-form');
const savingsTransferForm = document.getElementById('savings-transfer-form');
const savingsWithdrawForm = document.getElementById('savings-withdraw-form'); 
const dateInput = document.getElementById('date-input');
const monthlyPieChartCanvas = document.getElementById('monthlyPieChart');
const historyBarChartCanvas = document.getElementById('historyBarChart');

const limitOverrideModal = document.getElementById('limit-override-modal'); 
const limitOverrideForm = document.getElementById('limit-override-form'); 
let transactionPending = null; 

let monthlyPieChartInstance = null;
let historyBarChartInstance = null; 

// === HÀM LƯU & TẢI DỮ LIỆU ===
function loadAppData() {
    const defaultData = {
        users: [],
        categories: {
            'an-uong': 'Ăn Uống', 'hoc-tap': 'Học Tập', 'giai-tri': 'Giải Trí', 
            'di-chuyen': 'Di Chuyển', 'mua-sam': 'Mua Sắm', 'chi-phi-khac': 'Chi phí khác',
            'khac': 'Khác',
            'thu-nhap-chinh': 'Thu Nhập Chính', 'thu-nhap-phu': 'Thu Nhập Phụ', 'khoi-tao': 'Khởi Tạo',
            'tiet-kiem': 'Tiết Kiệm', 'rut-tiet-kiem': 'Rút Tiết Kiệm' 
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
    if (typeof amount !== 'number') return '0 VNĐ';

    const formattedAmount = new Intl.NumberFormat('vi-VN', {
        minimumFractionDigits: 0, 
        maximumFractionDigits: 0
    }).format(Math.abs(amount));
    
    return `${formattedAmount} VNĐ`;
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

// HÀM TÍNH TỔNG SỐ DƯ
function calculateBalance(transactions, initialBalance) {
    let balance = initialBalance;
    transactions.forEach(t => {
        if (t.type === 'income' && t.category !== 'rut-tiet-kiem') { 
            balance += t.amount;
        } else if (t.type === 'expense' && t.category !== 'tiet-kiem') {
            balance -= t.amount;
        }
    });
    
     transactions.forEach(t => {
        if (t.category === 'rut-tiet-kiem') {
            balance += t.amount;
        }
    });
    return balance;
}

function saveTransaction(transaction, overrideReason = '') {
    if (overrideReason) {
        transaction.note = `[VƯỢT MỨC: ${overrideReason}] ${transaction.note}`;
    }
    
    currentUser.transactions.push(transaction);
    saveAppData();
    
    // SỬA LỖI 1: Sau khi lưu giao dịch, chỉ cần cập nhật dashboard (bao gồm biểu đồ) và history.
    updateAppUI('dashboard-tab'); 
    updateAppUI('history-tab'); 
}

function checkSavingsCompletion() {
    if (!currentUser) return false;
    const savings = currentUser.savings;

    if (savings.goal > 0 && savings.currentAmount >= savings.goal) {
        const completedGoal = {
            id: Date.now().toString(),
            name: savings.name,
            goal: savings.goal,
            amount: savings.currentAmount,
            completedDate: getCurrentDate()
        };
        
        if (!currentUser.savingsHistory) {
            currentUser.savingsHistory = [];
        }
        currentUser.savingsHistory.push(completedGoal);

        savings.currentAmount = 0; 
        savings.goal = 0;
        savings.name = 'Mục tiêu mới';
        savings.password = '';
        
        showMessage(`🎉 CHÚC MỪNG! Bạn đã hoàn thành mục tiêu "${completedGoal.name}" (${formatCurrency(completedGoal.goal)})! Mục tiêu đã được reset, bạn có thể thiết lập mục tiêu mới.`, 'success');
        return true;
    }
    return false;
}

function withdrawSavings(amount, password) {
    const savings = currentUser.savings;
    
    if (password !== savings.password) {
        showMessage('Mật khẩu Quỹ không đúng.', 'error');
        return false;
    }
    
    if (amount <= 0 || amount > savings.currentAmount) {
        showMessage('Số tiền rút không hợp lệ hoặc vượt quá số dư Quỹ.', 'error');
        return false;
    }
    
    savings.currentAmount -= amount;
    
    currentUser.transactions.push({
        id: Date.now().toString(),
        amount: amount,
        type: 'income',
        category: 'rut-tiet-kiem', 
        date: getCurrentDate(),
        note: `Rút tiền từ Quỹ Tiết kiệm (${savings.name})`
    });

    saveAppData();
    updateAppUI('dashboard-tab');
    updateAppUI('savings-tab');
    showMessage(`Đã rút thành công ${formatCurrency(amount)} từ Quỹ Tiết kiệm!`, 'success');
    return true;
}


// === HÀM RENDER BIỂU ĐỒ ===

function renderMonthlyPieChart() {
    if (!currentUser || !monthlyPieChartCanvas) return;
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyExpenses = currentUser.transactions.filter(t => {
        const date = new Date(t.date + 'T00:00:00'); // Thêm 'T00:00:00' để tránh vấn đề múi giờ
        return t.type === 'expense' && t.category !== 'tiet-kiem' && 
               date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const categoryTotals = monthlyExpenses.reduce((acc, t) => {
        const categoryName = appData.categories[t.category] || t.category;
        acc[categoryName] = (acc[categoryName] || 0) + t.amount;
        return acc;
    }, {});

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);
    
    const backgroundColors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', 
        '#FF9F40', '#E7E9ED', '#8AC926', '#1982C4', '#6A4C93'
    ];

    if (monthlyPieChartInstance) {
        monthlyPieChartInstance.destroy(); 
    }
    
    const chartContainer = monthlyPieChartCanvas.parentElement;

    const chartTitleElement = chartContainer.closest('.card').querySelector('h4');

    if (labels.length === 0) {
        if(chartTitleElement) chartTitleElement.textContent = 'Phân bổ Chi tiêu Tháng (Chưa có chi tiêu)';
        monthlyPieChartCanvas.style.display = 'none';
        return;
    }
    
    monthlyPieChartCanvas.style.display = 'block';
    if(chartTitleElement) chartTitleElement.textContent = 'Phân bổ Chi tiêu Tháng';

    const ctx = monthlyPieChartCanvas.getContext('2d');
    if (!ctx) return; 

    monthlyPieChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors.slice(0, labels.length),
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                },
                title: {
                    display: false,
                }
            }
        }
    });
}

function renderHistoryBarChart() {
    if (!currentUser || !historyBarChartCanvas) return;
    
    const allExpenses = currentUser.transactions.filter(t => 
        t.type === 'expense' && t.category !== 'tiet-kiem'
    );

    const dates = [...new Set(allExpenses.map(t => t.date))].sort().reverse().slice(0, 5).reverse();
    
    const chartContainer = historyBarChartCanvas.parentElement;
    const chartTitleElement = chartContainer.closest('.card').querySelector('h4');


    if (dates.length === 0) {
        if (historyBarChartInstance) historyBarChartInstance.destroy();
        if(chartTitleElement) chartTitleElement.textContent = 'Chi tiêu 5 ngày gần nhất (Chưa có dữ liệu)';
        historyBarChartCanvas.style.display = 'none';
        return;
    }
    
    historyBarChartCanvas.style.display = 'block';
    if(chartTitleElement) chartTitleElement.textContent = 'Chi tiêu 5 ngày gần nhất';

    const dailyTotals = dates.map(date => {
        return allExpenses.filter(t => t.date === date)
                          .reduce((sum, t) => sum + t.amount, 0);
    });

    const labels = dates.map(date => {
        const d = new Date(date + 'T00:00:00'); 
        return `${d.getDate()}/${d.getMonth() + 1}`;
    });

    if (historyBarChartInstance) {
        historyBarChartInstance.destroy();
    }
    
    const ctx = historyBarChartCanvas.getContext('2d');
    if (!ctx) return;

    historyBarChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Tổng Chi Tiêu (VNĐ)',
                data: dailyTotals,
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value, index, values) {
                            return new Intl.NumberFormat('vi-VN').format(value);
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}
// === KẾT THÚC HÀM RENDER BIỂU ĐỒ ===


// HÀM UPDATE DASHBOARD 
function updateDashboard() {
    if (!currentUser) return;
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthlyIncome = currentUser.profile.monthlyIncome;
    
    let monthlyBudgetBalance = monthlyIncome;

    // Tính toán Số dư Ngân sách Hàng tháng: Thu nhập tháng - Chi tiêu/Tiết kiệm
    currentUser.transactions.forEach(t => {
        // Chỉ tính giao dịch trong tháng hiện tại
        const date = new Date(t.date + 'T00:00:00');
        if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
            
            // Chi tiêu (expense) bao gồm cả chi tiêu thông thường và chuyển vào tiết kiệm (tiet-kiem)
            // Lưu ý: Rút tiền tiết kiệm (rut-tiet-kiem) là income, nó không bị trừ vào ngân sách tháng
            if (t.type === 'expense') {
                monthlyBudgetBalance -= t.amount;
            } 
        }
    });
    
    // 1. Cập nhật hiển thị số dư bằng Số dư Ngân sách Hàng tháng mới
    currentBalanceDisplay.textContent = formatCurrency(monthlyBudgetBalance); 
    currentBalanceDisplay.classList.toggle('negative', monthlyBudgetBalance < 0);

    // 2. Tính toán Số dư Tổng thể (lifetime) để kiểm tra cảnh báo nạp thêm tiền
    const lifetimeBalance = calculateBalance(currentUser.transactions, currentUser.profile.initialBalance);

    monthlyIncomeDisplay.textContent = formatCurrency(currentUser.profile.monthlyIncome);
    
    const todayStr = getCurrentDate();
    const dailySpent = currentUser.transactions.filter(t => 
        t.type === 'expense' && t.date === todayStr && t.category !== 'tiet-kiem' 
    ).reduce((sum, t) => sum + t.amount, 0);
    
    dailySpentDisplay.textContent = formatCurrency(dailySpent);

    // Cảnh báo thêm tiền vẫn dựa trên số dư tổng thể (lifetimeBalance)
    if (lifetimeBalance <= 0) { 
        addBalanceContainer.style.display = 'block'; 
    } else {
        addBalanceContainer.style.display = 'none'; 
    }
    
    const dailyLimit = currentUser.profile.dailyLimit;
    if (dailyLimit > 0 && dailySpent >= dailyLimit) {
        dailyLimitAlert.textContent = 'Bạn đã vượt quá giới hạn chi tiêu ngày!';
        dailyLimitAlert.style.display = 'block';
    } else if (dailyLimit > 0 && dailySpent > dailyLimit * 0.8) {
         dailyLimitAlert.textContent = 'Sắp đạt giới hạn chi tiêu ngày.';
         dailyLimitAlert.style.display = 'block';
    } else {
        dailyLimitAlert.style.display = 'none';
    }
    
    renderMonthlyPieChart();
    renderHistoryBarChart();
}
// END OF HÀM UPDATE DASHBOARD

function updateHistoryList(filterType = 'all', filterMonth = '') {
    if (!currentUser || !transactionList) return;
    const transactions = [...currentUser.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

    const [filterYear, filterMon] = filterMonth.split('-');
    
    const filteredList = transactions.filter(t => {
        let isMatch = true;
        if (t.category === 'khoi-tao') return false; 
        
        // Lọc theo loại giao dịch
        if (filterType !== 'all') {
            if (filterType === 'income') {
                // Thu nhập: Giao dịch income HOẶC rút tiết kiệm
                if (t.type !== 'income' && t.category !== 'rut-tiet-kiem') { 
                    isMatch = false;
                }
            } else if (filterType === 'expense') { 
                // Chi tiêu: Giao dịch expense VÀ KHÔNG phải chuyển vào tiết kiệm
                if (t.type !== 'expense' || t.category === 'tiet-kiem') {
                    isMatch = false;
                }
            }
        }
        
        // Lọc theo tháng
        if (filterMonth) {
            const date = new Date(t.date + 'T00:00:00'); 
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
        if (t.category === 'rut-tiet-kiem') {
            typeClass = 'savings-item';
            amountText = `<span class="item-amount positive">+ ${formatCurrency(t.amount)} (Rút)</span>`;
        }
        const categoryLabel = appData.categories[t.category] || t.category;


        li.className = `${typeClass} ${t.id}`;
        li.innerHTML = `
            <div class="item-details">
                <p><strong>${categoryLabel}</strong> - <span class="small-text">${t.note || 'Không ghi chú'}</span></p>
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

function updateSavingsUI() {
    if (!currentUser) return;
    const savings = currentUser.savings;
    document.getElementById('savings-name-display').textContent = savings.name || 'Chưa thiết lập';
    document.getElementById('savings-current-amount').textContent = formatCurrency(savings.currentAmount);
    document.getElementById('savings-goal-display').textContent = formatCurrency(savings.goal);

    const percent = savings.goal > 0 ? (savings.currentAmount / savings.goal) * 100 : 0;
    document.getElementById('savings-progress-bar').style.width = `${Math.min(percent, 100)}%`;
    
    // Nút rút tiền chỉ hiển thị nếu quỹ có tiền
    document.getElementById('show-withdraw-form-btn').style.display = savings.currentAmount > 0 ? 'block' : 'none';
    
    // Cập nhật giá trị vào form thiết lập
    document.getElementById('savings-name').value = savings.name === 'Mục tiêu mặc định' ? '' : savings.name;
    document.getElementById('savings-goal-input').value = savings.goal > 0 ? savings.goal : '';
}

function updateSettingsUI() {
    if (!currentUser) return;
    document.getElementById('current-user-display-setting').textContent = currentUser.username; 
    document.getElementById('set-monthly-income').value = currentUser.profile.monthlyIncome;
    document.getElementById('set-daily-limit').value = currentUser.profile.dailyLimit;
}

// HÀM UPDATE UI TỔNG THỂ 
function updateAppUI(targetTab) {
    if (!currentUser) return;
    
    document.getElementById('current-user-display').textContent = currentUser.username;
    
    // Kiểm tra và xử lý hoàn thành mục tiêu tiết kiệm
    if (checkSavingsCompletion()) {
        saveAppData(); 
    }

    if (targetTab === 'dashboard-tab') {
        updateDashboard();
    } else if (targetTab === 'history-tab') {
        const activeFilter = document.querySelector('.sub-menu-history .sub-menu-item.active');
        const historyFilterType = activeFilter ? activeFilter.dataset.type : 'all';
        const historyFilterMonth = document.getElementById('history-filter-month').value;
        // Nếu đang lọc theo tháng, loại mặc định là 'all'
        const finalFilterType = historyFilterType === 'filter' ? 'all' : historyFilterType;

        updateHistoryList(finalFilterType, historyFilterMonth);
    } else if (targetTab === 'savings-tab') {
        updateSavingsUI();
    } else if (targetTab === 'settings-tab') {
        updateSettingsUI();
    }
    
    // Đặt lại ngày cho form giao dịch mỗi lần vào tab Thêm giao dịch
    if (targetTab === 'add-transaction-tab') {
        dateInput.value = getCurrentDate();
    }
}

function deleteTransaction(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa giao dịch này không?')) return;
    
    const initialLength = currentUser.transactions.length;
    currentUser.transactions = currentUser.transactions.filter(t => t.id !== id);
    
    if (currentUser.transactions.length < initialLength) {
        saveAppData();
        updateAppUI('dashboard-tab');
        updateAppUI('history-tab');
        showMessage('Đã xóa giao dịch thành công!', 'success');
    } else {
        showMessage('Không tìm thấy giao dịch để xóa.', 'error');
    }
}


// === HÀM KHỞI TẠO ỨNG DỤNG VÀ GÁN LISTENERS (QUAN TRỌNG NHẤT) ===
function initApp() {
    
    // --- 1. GÁN LISTENERS CHO THANH ĐIỀU HƯỚNG DƯỚI CÙNG (Fix lỗi chính) ---
    document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.target;
            
            // Xóa active class khỏi tất cả các nút
            document.querySelectorAll('.bottom-nav .nav-item').forEach(i => i.classList.remove('active'));
            // Thêm active class vào nút được click
            btn.classList.add('active');
            
            // Ẩn tất cả tab và chỉ hiện tab được chọn
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.toggle('active', content.id === target);
            });
            
            const tabTitle = document.getElementById('tab-title');
            if(tabTitle) tabTitle.textContent = btn.querySelector('span').textContent.trim();
            
            // Cập nhật nội dung tab
            updateAppUI(target);
        });
    });

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
        const authError = document.getElementById('auth-error-reg'); 
        authError.textContent = '';
        
        if (password.length < 6) {
             authError.textContent = 'Mật khẩu phải ít nhất 6 ký tự.';
             return;
        }

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
            savingsHistory: [] 
        };

        appData.users.push(newUser);
        currentUser = newUser;
        delete appData.tempUser; 
        saveAppData();
        
        profileSetupScreen.classList.remove('active');
        mainApp.classList.add('active');
        
        // Kích hoạt dashboard sau khi đã đăng nhập
        document.querySelector('.bottom-nav .nav-item[data-target="dashboard-tab"]').click(); 
        showMessage('Thiết lập hoàn tất! Chào mừng đến với Sổ Tay Chi Tiêu Cá Nhân.', 'success');
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
            
            // Kích hoạt dashboard sau khi đã đăng nhập
            document.querySelector('.bottom-nav .nav-item[data-target="dashboard-tab"]').click(); 
            showMessage(`Chào mừng trở lại, ${currentUser.username}!`, 'success');
        } else {
            authError.textContent = 'Sai tên đăng nhập hoặc mật khẩu.';
        }
    });

    // 6. Xử lý THOÁT
    const logoutHandler = () => {
        if (currentUser) {
            const userInApp = appData.users.find(u => u.username === currentUser.username);
            if(userInApp) {
                 userInApp.isLoggedIn = false;
            }
            
            saveAppData();
            currentUser = null;
            mainApp.classList.remove('active');
            authScreen.classList.add('active');
            // Đảm bảo màn hình đăng nhập hiển thị đúng form
            document.getElementById('register-form').style.display = 'none';
            document.getElementById('login-form').style.display = 'block';
            showMessage('Đã đăng xuất.', 'info');
        }
    };
    document.getElementById('logout-btn-app').addEventListener('click', logoutHandler);
    document.getElementById('logout-btn-setting').addEventListener('click', logoutHandler);
    
    // 7. Gán Listeners cho các nút lọc Lịch sử
    document.querySelectorAll('.sub-menu-history .sub-menu-item').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.sub-menu-history .sub-menu-item').forEach(i => i.classList.remove('active'));
            btn.classList.add('active');
            const type = btn.dataset.type;
            const monthContainer = document.getElementById('month-filter-container');
            
            if (type === 'filter') {
                monthContainer.style.display = 'flex'; 
            } else {
                monthContainer.style.display = 'none';
                updateHistoryList(type, ''); 
            }
        });
    });
    
    document.getElementById('apply-history-filter-btn').addEventListener('click', () => {
        const month = document.getElementById('history-filter-month').value;
        // Nếu đang lọc theo tháng, ta dùng filterMonth và loại mặc định là 'all'
        updateHistoryList('all', month);
    });

    // 8. Gán Listener cho THÊM GIAO DỊCH
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
        // Thay đổi: Kiểm tra số dư trước khi cho phép giao dịch Chi tiêu
        if (type === 'expense' && amount > balance) {
             showMessage('Số dư hiện tại không đủ để thực hiện giao dịch này.', 'error');
             return;
        }

        let finalCategory = category;
        if (type === 'income') {
             // Thay đổi category cho income, mặc định là Thu nhập Chính nếu không có lựa chọn khác
             finalCategory = 'thu-nhap-chinh'; 
        }

        const newTransaction = { id: Date.now().toString(), amount, type, category: finalCategory, date, note };
        
        // Kiểm tra giới hạn chi tiêu ngày
        if (type === 'expense' && finalCategory !== 'tiet-kiem' && dailyLimit > 0 && date === getCurrentDate()) { 
            const dailySpentBefore = currentUser.transactions.filter(t => 
                t.type === 'expense' && t.date === date && t.category !== 'tiet-kiem' 
            ).reduce((sum, t) => sum + t.amount, 0);
            
            if (dailySpentBefore + amount > dailyLimit) {
                transactionPending = newTransaction; 
                limitOverrideModal.style.display = 'block';
                return; 
            }
        }
        
        // SỬA LỖI 2: Sau khi lưu giao dịch thành công (không cần override)
        saveTransaction(newTransaction);
        form.reset();
        document.getElementById('date-input').value = getCurrentDate();
        showMessage('Đã lưu giao dịch thành công! Biểu đồ đang được cập nhật.', 'success');
        // updateAppUI đã được gọi trong saveTransaction, đảm bảo biểu đồ và dashboard cập nhật.
    });
    
    // === LOGIC XỬ LÝ MODAL XÁC NHẬN VƯỢT MỨC ===
    limitOverrideForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const overridePassword = document.getElementById('override-password').value;
        const overrideReason = document.getElementById('override-reason').value.trim();

        if (overridePassword !== currentUser.password) {
            showMessage('Mật khẩu xác nhận không đúng. Giao dịch bị hủy.', 'error');
            return;
        }

        saveTransaction(transactionPending, overrideReason);
        
        transactionPending = null; 
        limitOverrideForm.reset();
        limitOverrideModal.style.display = 'none';
        
        transactionForm.reset();
        document.getElementById('date-input').value = getCurrentDate();
        showMessage('Đã lưu giao dịch vượt mức thành công! Biểu đồ đang được cập nhật.', 'success');
    });

    document.querySelector('[data-modal-cancel="limit-override-modal"]').addEventListener('click', () => {
        transactionPending = null; 
        limitOverrideForm.reset();
        limitOverrideModal.style.display = 'none';
    });

    document.querySelector('[data-modal-close="limit-override-modal"]').addEventListener('click', () => {
        transactionPending = null; 
        limitOverrideForm.reset();
        limitOverrideModal.style.display = 'none';
    });
    
    // 9. Gán Listener cho THIẾT LẬP MỤC TIÊU TIẾT KIỆM
    savingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('savings-name').value.trim();
        const goal = parseInt(document.getElementById('savings-goal-input').value);
        const password = document.getElementById('savings-password').value;
        
        if(goal <= 0) {
            showMessage('Mục tiêu phải lớn hơn 0.', 'error');
            return;
        }
        if (password.length < 4) {
             showMessage('Mật khẩu quỹ phải có ít nhất 4 ký tự.', 'error');
             return;
        }

        currentUser.savings.goal = goal;
        currentUser.savings.password = password;
        currentUser.savings.name = name;
        
        saveAppData();
        updateSavingsUI();
        showMessage('Mục tiêu tiết kiệm đã được thiết lập!', 'success');
    });

    // 10. Gán Listener cho CHUYỂN TIỀN VÀO QUỸ
    savingsTransferForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const transferAmount = parseInt(document.getElementById('transfer-amount').value);
        const transferPassword = document.getElementById('transfer-password').value;
        
        const savings = currentUser.savings;
        const balance = calculateBalance(currentUser.transactions, currentUser.profile.initialBalance);

        if (savings.password === '') {
             showMessage('Vui lòng thiết lập Mục tiêu và Mật khẩu Quỹ trước khi chuyển tiền.', 'error');
             return;
        }

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
        
        const effectiveTransferAmount = Math.min(transferAmount, savings.goal - savings.currentAmount);

        if (effectiveTransferAmount <= 0) {
             showMessage('Số tiền đã đạt hoặc vượt quá mục tiêu. Vui lòng thiết lập mục tiêu mới.', 'info');
             return;
        }

        currentUser.transactions.push({
            id: Date.now().toString(),
            amount: effectiveTransferAmount,
            type: 'expense',
            category: 'tiet-kiem',
            date: getCurrentDate(),
            note: `Chuyển vào Quỹ Tiết kiệm: ${savings.name}`
        });

        savings.currentAmount += effectiveTransferAmount;
        
        const wasCompleted = checkSavingsCompletion();
        
        saveAppData(); 
        
        updateAppUI('dashboard-tab');
        updateAppUI('savings-tab');
        savingsTransferForm.reset();
        
        if (!wasCompleted) {
            showMessage('Chuyển tiền vào Quỹ thành công!', 'success');
        } 
    });
    
    // 11. Gán Listener cho RÚT TIỀN TIẾT KIỆM
    savingsWithdrawForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const withdrawAmount = parseInt(document.getElementById('withdraw-amount').value);
        const withdrawPassword = document.getElementById('withdraw-password').value;
        
        if(withdrawSavings(withdrawAmount, withdrawPassword)) {
             savingsWithdrawForm.reset();
             document.getElementById('savings-withdraw-form-container').style.display = 'none';
             document.getElementById('show-withdraw-form-btn').textContent = 'Rút Tiền Tiết Kiệm';
        }
    });
    
    // 12. Gán listener cho nút mở form Rút tiền
    document.getElementById('show-withdraw-form-btn').addEventListener('click', () => {
         const form = document.getElementById('savings-withdraw-form-container');
         const btn = document.getElementById('show-withdraw-form-btn');

         form.style.display = form.style.display === 'none' ? 'block' : 'none';
         btn.textContent = form.style.display === 'none' ? 'Rút Tiền Tiết Kiệm' : 'Ẩn Form Rút Tiền';
    });
    
    // 13. Gán Listener cho NÚT THÊM SỐ DƯ
    showAddBalanceFormBtn.addEventListener('click', () => {
        // Chuyển sang tab Thêm giao dịch
        document.querySelector('.bottom-nav .nav-item[data-target="add-transaction-tab"]').click();
        
        // Chọn loại giao dịch là Thu nhập
        const typeSelect = document.getElementById('type-select');
        typeSelect.value = 'income';
        
        document.getElementById('amount-input').focus();
        
        showMessage('Vui lòng nhập số tiền bạn muốn thêm vào tài khoản chính.', 'info');
    });

    // 14. Xử lý chuyển đổi giữa các tab Cài đặt
    document.querySelectorAll('.sub-menu-settings .sub-menu-item').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.sub-menu-settings .sub-menu-item').forEach(i => i.classList.remove('active'));
            btn.classList.add('active');
            
            document.querySelectorAll('.settings-content').forEach(content => {
                content.style.display = 'none';
            });
            document.getElementById(btn.dataset.targetSetting).style.display = 'block';
            updateSettingsUI(); 
        });
    });
    
    // 15. Form Cập nhật hồ sơ Cài đặt
    document.getElementById('profile-settings-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const newMonthlyIncome = parseInt(document.getElementById('set-monthly-income').value);
        const newDailyLimit = parseInt(document.getElementById('set-daily-limit').value);

        currentUser.profile.monthlyIncome = newMonthlyIncome;
        currentUser.profile.dailyLimit = newDailyLimit;

        saveAppData();
        updateAppUI('dashboard-tab'); 
        updateSettingsUI();
        showMessage('Cài đặt hồ sơ chi tiêu đã được cập nhật!', 'success');
    });
    
    // 16. Form Đổi mật khẩu
    document.getElementById('password-settings-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const currentPass = document.getElementById('current-password').value;
        const newPass = document.getElementById('new-password').value;
        const confirmNewPass = document.getElementById('confirm-new-password').value;

        if (currentPass !== currentUser.password) {
            showMessage('Mật khẩu hiện tại không đúng.', 'error');
            return;
        }

        if (newPass.length < 6) {
             showMessage('Mật khẩu mới phải ít nhất 6 ký tự.', 'error');
             return;
        }

        if (newPass !== confirmNewPass) {
            showMessage('Mật khẩu mới và xác nhận mật khẩu không khớp.', 'error');
            return;
        }

        currentUser.password = newPass;
        saveAppData();
        document.getElementById('password-settings-form').reset();
        showMessage('Mật khẩu đã được thay đổi thành công!', 'success');
    });

    // --- KIỂM TRA TRẠNG THÁI ĐĂNG NHẬP VÀ HIỂN THỊ MÀN HÌNH ---
    if (currentUser) {
        authScreen.classList.remove('active');
        mainApp.classList.add('active');
        // Kích hoạt nút Dashboard để hiển thị giao diện và tải dữ liệu ban đầu
        document.querySelector('.bottom-nav .nav-item[data-target="dashboard-tab"]').click();
    } else {
        authScreen.classList.add('active');
        profileSetupScreen.classList.remove('active');
        mainApp.classList.remove('active');
    }

}

// Chạy khởi tạo ứng dụng
initApp();
