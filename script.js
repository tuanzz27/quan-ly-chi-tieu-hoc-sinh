// script.js - Logic cho ứng dụng Quản lý Chi tiêu THPT

// =================================================================
// CÁC HẰNG VÀ BIẾN TOÀN CỤC
// =================================================================
const APP_DATA_KEY = 'qlctthpt_appData';
let appData = {};
let currentTransaction = null; // Biến lưu giao dịch tạm thời (dùng cho Modal vượt mức)

const screens = document.querySelectorAll('.screen-container');
const tabContents = document.querySelectorAll('.tab-content');
const navItems = document.querySelectorAll('.bottom-nav .nav-item');

// Danh sách danh mục chi tiêu (có thể được mở rộng sau)
const EXPENSE_CATEGORIES = [
    'an-uong', 'hoc-tap', 'giai-tri', 'di-chuyen', 'mua-sam', 'tiet-kiem', 'chi-phi-khac'
];

// Cấu trúc Pet và Mốc Tiến Hóa MỚI
const PET_LEVELS = [
    { level: 1, name: 'Heo Con', goal: 0, icon: 'https://i.imgur.com/gK2R0cZ.png' }, // Mới bắt đầu
    { level: 2, name: 'Heo Đất', goal: 50000, icon: 'https://i.imgur.com/vH4H3hA.png' }, // 50,000 đ
    { level: 3, name: 'Heo Lớn', goal: 150000, icon: 'https://i.imgur.com/jM8vKqC.png' }, // 150,000 đ
    { level: 4, name: 'Heo Vàng', goal: 500000, icon: 'https://i.imgur.com/yF5wRzO.png' }, // 500,000 đ
    { level: 5, name: 'Heo Tỷ Phú', goal: 1000000, icon: 'https://i.imgur.com/gK2R0cZ.png' } // 1,000,000 đ (Ví dụ)
];

/** Hàm trả về Icon tương ứng với Danh mục */
const getCategoryIcon = (category) => {
    switch (category) {
        case 'an-uong': return 'fa-utensils';
        case 'hoc-tap': return 'fa-book-reader';
        case 'giai-tri': return 'fa-gamepad';
        case 'di-chuyen': return 'fa-bus';
        case 'mua-sam': return 'fa-shopping-bag';
        case 'tiet-kiem': return 'fa-piggy-bank';
        case 'chi-phi-khac': return 'fa-stream';
        case 'thu-nhap-chinh': return 'fa-briefcase';
        case 'thu-nhap-phu': return 'fa-coins';
        case 'rut-tiet-kiem': return 'fa-hand-holding-usd';
        case 'khac': return 'fa-question-circle';
        default: return 'fa-stream';
    }
};

// Phân bổ 6 Lọ (NEC, LTSS, EDU, PLAY, FF, GIVE)
const JAR_ALLOCATION = {
    'NEC': 0.55, // Chi tiêu cần thiết
    'LTSS': 0.10, // Tiết kiệm dài hạn (Tiết kiệm Mục tiêu)
    'EDU': 0.10, // Giáo dục
    'PLAY': 0.10, // Hưởng thụ
    'FF': 0.10, // Tự do tài chính
    'GIVE': 0.05, // Cho đi
};


// =================================================================
// CÁC HÀM TIỆN ÍCH CHUNG
// =================================================================

/** Hàm định dạng số thành tiền tệ (VNĐ) */
const formatCurrency = (amount) => {
    // Sử dụng ' đ' thay vì 'VNĐ' để khớp với yêu cầu giao diện mới
    return new Intl.NumberFormat('vi-VN', {
        style: 'decimal',
        minimumFractionDigits: 0
    }).format(amount) + ' đ';
};

/** Lấy ngày hiện tại ở định dạng YYYY-MM-DD */
const getCurrentDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
};

/** Hiển thị thông báo toàn cục */
const showGlobalMessage = (message, type = 'success') => {
    const msgEl = document.getElementById('global-message');
    msgEl.textContent = message;
    msgEl.className = `message ${type}`;
    msgEl.style.display = 'block';
    setTimeout(() => {
        msgEl.style.display = 'none';
    }, 4000);
};

/** Lấy dữ liệu ứng dụng từ LocalStorage */
const loadAppData = () => {
    const data = localStorage.getItem(APP_DATA_KEY);
    appData = data ? JSON.parse(data) : {};
};

/** Lưu dữ liệu ứng dụng vào LocalStorage */
const saveAppData = () => {
    localStorage.setItem(APP_DATA_KEY, JSON.stringify(appData));
};

/** Lấy thông tin người dùng đang đăng nhập */
const getCurrentUser = () => {
    const username = localStorage.getItem('currentLoggedInUser');
    return appData[username] || null;
};

/** Cập nhật thông tin người dùng đang đăng nhập */
const updateCurrentUser = (user) => {
    if (user) {
        appData[user.username] = user;
        saveAppData();
    }
};

// =================================================================
// LOGIC CHUYỂN ĐỔI MÀN HÌNH (QUAN TRỌNG ĐỂ FIX LỖI ẨN/HIỆN)
// =================================================================

/** Ẩn tất cả các màn hình chính */
const hideAllScreens = () => {
    screens.forEach(screen => screen.classList.remove('active'));
};

/** Chuyển đổi trạng thái hiển thị màn hình dựa trên LocalStorage */
const checkLoginState = () => {
    const username = localStorage.getItem('currentLoggedInUser');
    const user = appData[username];

    hideAllScreens();

    if (user && user.isLoggedIn) {
        // Đã đăng nhập, vào app chính
        document.getElementById('main-app').classList.add('active');
        updateAppUI();
    } else {
        // Chưa đăng nhập, hiển thị màn hình xác thực
        document.getElementById('auth-screen').classList.add('active');
        // Đảm bảo Form Đăng Nhập hiển thị mặc định
        document.getElementById('login-form').style.display = 'block';
        document.getElementById('register-form').style.display = 'none';
        document.getElementById('auth-title').textContent = 'Đăng Nhập';
        document.getElementById('show-register').style.display = 'block';
        document.getElementById('show-login').style.display = 'none';
    }
    
    // Đảm bảo màn hình Profile Setup luôn bị ẩn
    document.getElementById('profile-setup-screen').style.display = 'none';
};

/** Chuyển tab trong ứng dụng chính */
const switchTab = (targetId) => {
    tabContents.forEach(tab => tab.classList.remove('active'));
    document.getElementById(targetId).classList.add('active');
    
    // Cập nhật tiêu đề header
    const titleMap = {
        'dashboard-tab': 'Trang Chủ',
        'history-tab': 'Lịch Sử',
        'add-transaction-tab': 'Thêm Giao Dịch',
        'savings-tab': 'Tiết Kiệm',
        'settings-tab': 'Cài Đặt',
    };
    document.getElementById('tab-title').textContent = titleMap[targetId];

    // Cập nhật trạng thái active của thanh nav
    navItems.forEach(item => item.classList.remove('active'));
    document.querySelector(`.nav-item[data-target="${targetId}"]`).classList.add('active');
};

// =================================================================
// LOGIC XÁC THỰC (Đăng ký, Đăng nhập, Thoát)
// =================================================================

document.getElementById('show-register').addEventListener('click', () => {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'block';
    document.getElementById('auth-title').textContent = 'Đăng Ký';
    document.getElementById('show-register').style.display = 'none';
    document.getElementById('show-login').style.display = 'block';
    document.getElementById('auth-error').textContent = '';
});

document.getElementById('show-login').addEventListener('click', () => {
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('register-form').style.display = 'none';
    document.getElementById('auth-title').textContent = 'Đăng Nhập';
    document.getElementById('show-register').style.display = 'block';
    document.getElementById('show-login').style.display = 'none';
    document.getElementById('auth-error-reg').textContent = '';
});

document.getElementById('register-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    const errorEl = document.getElementById('auth-error-reg');

    if (password !== confirmPassword) {
        errorEl.textContent = 'Mật khẩu xác nhận không khớp.';
        return;
    }

    if (password.length < 6) {
        errorEl.textContent = 'Mật khẩu phải có ít nhất 6 ký tự.';
        return;
    }

    if (appData[username]) {
        errorEl.textContent = 'Tên đăng nhập đã tồn tại.';
        return;
    }

    // Đăng ký thành công, tạo user object VÀ THIẾT LẬP GIÁ TRỊ MẶC ĐỊNH
    appData[username] = {
        username,
        password, // Lưu mật khẩu đơn giản (trong môi trường thực tế cần hash)
        isLoggedIn: true,
        transactions: [],
        balance: 0, // Mặc định 0 VNĐ
        monthlyIncome: 0, // Mặc định 0 VNĐ (sẽ được cập nhật ở Setting)
        dailyLimit: 0, // Mặc định 0 (không giới hạn)
        savings: {
            name: 'Quỹ chung',
            goal: 0,
            currentAmount: 0,
            password: null, // Mật khẩu Quỹ Tiết Kiệm
            unlockedPets: [PET_LEVELS[0].name], // Bắt đầu với Pet đầu tiên: Heo Con
        },
        jars: { // Khởi tạo 6 Lọ
            NEC: 0,
            LTSS: 0,
            EDU: 0,
            PLAY: 0,
            FF: 0,
            GIVE: 0
        }
    };

    localStorage.setItem('currentLoggedInUser', username);
    saveAppData();
    showGlobalMessage('Đăng ký thành công! Chào mừng bạn.', 'success');
    checkLoginState(); // Chuyển thẳng vào App
});

document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('auth-error');
    const user = appData[username];

    if (!user || user.password !== password) {
        errorEl.textContent = 'Tên đăng nhập hoặc mật khẩu không đúng.';
        return;
    }

    // Đăng nhập thành công
    user.isLoggedIn = true;
    localStorage.setItem('currentLoggedInUser', username);
    
    // Đảm bảo trường jars và unlockedPets tồn tại (cho người dùng cũ)
    if (!user.jars) {
        user.jars = { NEC: 0, LTSS: 0, EDU: 0, PLAY: 0, FF: 0, GIVE: 0 };
    }
    if (!user.savings.unlockedPets) {
        user.savings.unlockedPets = [PET_LEVELS[0].name];
    }
    
    updateCurrentUser(user);
    showGlobalMessage('Đăng nhập thành công!', 'success');
    checkLoginState();
});

document.getElementById('logout-btn-app').addEventListener('click', logout);
document.getElementById('logout-btn-setting').addEventListener('click', logout);

function logout() {
    const user = getCurrentUser();
    if (user) {
        user.isLoggedIn = false;
        updateCurrentUser(user);
    }
    localStorage.removeItem('currentLoggedInUser');
    showGlobalMessage('Bạn đã đăng xuất.', 'success');
    checkLoginState();
}

// =================================================================
// LOGIC CẬP NHẬT GIAO DỊCH VÀ SỐ DƯ
// =================================================================

/** Tính toán lại số dư, thu nhập/chi tiêu tháng và ngày */
const calculateBalance = (user) => {
    // Tính số dư (Mọi thứ đều là transaction)
    user.balance = user.transactions.reduce((acc, trans) => {
        if (trans.type === 'income') {
            return acc + trans.amount;
        } else if (trans.type === 'expense') {
            return acc - trans.amount;
        }
        return acc;
    }, 0);

    // Tính toán chi tiêu tháng/ngày
    const currentMonth = new Date().toISOString().slice(0, 7);
    const today = getCurrentDate();
    
    // Chi tiêu không tính phần chuyển vào tiết kiệm
    const monthlyExpense = user.transactions
        .filter(t => t.type === 'expense' && t.date.startsWith(currentMonth) && t.category !== 'tiet-kiem')
        .reduce((sum, t) => sum + t.amount, 0);
        
    const monthlyIncome = user.transactions
        .filter(t => t.type === 'income' && t.date.startsWith(currentMonth))
        .reduce((sum, t) => sum + t.amount, 0);


    const dailyExpense = user.transactions
        .filter(t => t.type === 'expense' && t.date === today && t.category !== 'tiet-kiem')
        .reduce((sum, t) => sum + t.amount, 0);
    
    return {
        balance: user.balance,
        monthlyExpense,
        dailyExpense,
        monthlyIncome
    };
};

/** Cập nhật thông tin chi tiết người dùng */
const updateAppUI = () => {
    const user = getCurrentUser();
    if (!user) return;

    const { balance, monthlyExpense, dailyExpense, monthlyIncome } = calculateBalance(user);

    // Cập nhật Dashboard (Giao diện MỚI)
    document.getElementById('current-user-display-dashboard').textContent = user.username; 
    document.getElementById('current-balance-display').textContent = formatCurrency(balance);
    
    // Thu nhập tháng hiện tại (tính từ các giao dịch income)
    document.getElementById('monthly-income-display').textContent = formatCurrency(monthlyIncome); 

    // Cập nhật cảnh báo giới hạn ngày (giữ lại nếu cần)
    const dailyLimitAlert = document.getElementById('daily-limit-alert');
    // Giao diện mới không có cảnh báo này, nhưng giữ logic đề phòng
    if (dailyLimitAlert) { 
        if (user.dailyLimit > 0 && dailyExpense > user.dailyLimit) {
            dailyLimitAlert.style.display = 'block';
            dailyLimitAlert.textContent = `🚨 Đã vượt giới hạn ngày: ${formatCurrency(user.dailyLimit)}! Bạn đã chi ${formatCurrency(dailyExpense)}.`;
        } else {
            dailyLimitAlert.style.display = 'none';
        }
    }
    
    // Cập nhật thông tin người dùng ở Header
    document.getElementById('current-user-display').textContent = user.username;
    document.getElementById('current-user-display-setting').textContent = user.username;

    // Cập nhật Tiết Kiệm (Heo Đất/Pet)
    renderSavingsUI(user);
    
    // Cập nhật 6 Chiếc Lọ - **Sử dụng monthlyIncome được tính toán TỪ GIAO DỊCH**
    renderJarsUI(user, monthlyIncome);
    
    // Tải lại lịch sử và biểu đồ (Ẩn trong HTML nhưng giữ logic đề phòng)
    renderTransactionList(user.transactions.slice().reverse());
    // renderMonthlyPieChart(user); // Đã ẩn chart
    // renderHistoryBarChart(user); // Đã ẩn chart
    
    updateCurrentUser(user);
};

// =================================================================
// LOGIC THÊM GIAO DỊCH
// =================================================================

document.getElementById('type-select').addEventListener('change', (e) => {
    const type = e.target.value;
    document.getElementById('expense-category-container').style.display = type === 'expense' ? 'block' : 'none';
    document.getElementById('income-category-container').style.display = type === 'income' ? 'block' : 'none';
});

document.getElementById('transaction-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('amount-input').value);
    const type = document.getElementById('type-select').value;
    const date = document.getElementById('date-input').value;
    const note = document.getElementById('note-input').value.trim();
    let category = '';

    if (type === 'expense') {
        category = document.getElementById('category-select').value;
    } else {
        category = document.getElementById('income-category-select').value;
    }

    const newTransaction = {
        id: Date.now(),
        amount,
        type,
        category,
        date,
        note,
    };

    currentTransaction = newTransaction; // Lưu tạm thời

    const user = getCurrentUser();
    const { dailyExpense } = calculateBalance(user);

    // Xử lý CẢNH BÁO VƯỢT MỨC TRƯỚC KHI LƯU
    const isExpense = newTransaction.type === 'expense' && newTransaction.category !== 'tiet-kiem';
    if (isExpense && user.dailyLimit > 0 && dailyExpense + amount > user.dailyLimit) {
        // Hiển thị modal xác nhận vượt mức
        document.getElementById('limit-override-modal').style.display = 'flex';
        // Reset form giao dịch sau khi modal được hiển thị
        document.getElementById('transaction-form').reset();
        return; 
    }
    
    // Nếu không vượt mức hoặc là giao dịch thu nhập, tiến hành lưu
    saveTransaction(newTransaction);
});

// Hàm lưu giao dịch thực sự
function saveTransaction(transaction, isOverride = false, overrideReason = '') {
    const user = getCurrentUser();

    if (transaction.type === 'expense' && transaction.category === 'tiet-kiem') {
        // Xử lý chuyển tiền vào Quỹ Tiết Kiệm (Nếu đến từ form thêm giao dịch)
        user.transactions.push(transaction);
        user.savings.currentAmount += transaction.amount;
        
        // Kiểm tra và mở khóa pet
        checkPetEvolution(user); 

        updateCurrentUser(user);
        showGlobalMessage(`Đã chuyển ${formatCurrency(transaction.amount)} vào Quỹ Tiết Kiệm.`, 'success');
        document.getElementById('transaction-form').reset();
        updateAppUI();
        return; 
    }
    
    if (isOverride) {
        transaction.note = `[Vượt Mức - ${overrideReason}] ${transaction.note}`;
    }

    user.transactions.push(transaction);
    
    updateCurrentUser(user);
    showGlobalMessage('Giao dịch đã được lưu.', 'success');
    document.getElementById('transaction-form').reset();
    updateAppUI();
}

// =================================================================
// LOGIC NHẬP NHANH THU NHẬP (TRÊN DASHBOARD MỚI)
// ** ĐÃ TỐI ƯU ĐỂ KÍCH HOẠT PHÂN BỔ 6 LỌ **
// =================================================================
document.getElementById('quick-income-save-btn').addEventListener('click', () => {
    const inputEl = document.getElementById('quick-income-input');
    const amount = parseFloat(inputEl.value);

    if (isNaN(amount) || amount <= 0) {
        showGlobalMessage('Vui lòng nhập số tiền thu nhập hợp lệ.', 'error');
        return;
    }

    const user = getCurrentUser();
    
    const newTransaction = {
        id: Date.now(),
        amount: amount,
        type: 'income',
        category: 'thu-nhap-chinh', 
        date: getCurrentDate(),
        note: 'Thu nhập nhanh từ Dashboard',
    };

    user.transactions.push(newTransaction);
    
    updateCurrentUser(user);
    showGlobalMessage(`Đã thêm ${formatCurrency(amount)} vào Thu nhập. Các Lọ đã được phân bổ lại.`, 'success');
    inputEl.value = '';
    
    // **UPDATEAPPUI SẼ TỰ ĐỘNG GỌI renderJarsUI VỚI THU NHẬP MỚI**
    updateAppUI(); 
});


// =================================================================
// LOGIC MODAL VƯỢT MỨC
// =================================================================

document.getElementById('limit-override-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const overridePassword = document.getElementById('override-password').value;
    const overrideReason = document.getElementById('override-reason').value.trim();
    const user = getCurrentUser();

    if (!user || user.password !== overridePassword) {
        showGlobalMessage('Mật khẩu tài khoản không chính xác.', 'error');
        return;
    }

    if (!currentTransaction || !overrideReason) {
        showGlobalMessage('Lỗi hệ thống hoặc lý do không hợp lệ.', 'error');
        return;
    }

    // Lưu giao dịch sau khi xác nhận vượt mức
    saveTransaction(currentTransaction, true, overrideReason);
    
    // Đóng modal và reset form
    document.getElementById('limit-override-modal').style.display = 'none';
    document.getElementById('limit-override-form').reset();
    currentTransaction = null; 
});

// Đóng modal khi click Hủy
document.querySelector('[data-modal-cancel="limit-override-modal"]').addEventListener('click', () => {
    document.getElementById('limit-override-modal').style.display = 'none';
    currentTransaction = null;
    showGlobalMessage('Giao dịch vượt mức đã bị hủy.', 'warning');
});

// =================================================================
// LOGIC TIẾT KIỆM (SAVINGS) & HEO ĐẤT/PET
// =================================================================

/** Tìm Pet cấp độ hiện tại dựa trên số tiền */
function getCurrentPet(currentAmount) {
    // Tìm Pet cao nhất mà số tiền đã đạt được
    const achievedPet = PET_LEVELS
        .filter(pet => currentAmount >= pet.goal)
        .sort((a, b) => b.level - a.level)[0];

    // Tìm Pet tiếp theo cần đạt được
    const nextPet = PET_LEVELS.find(pet => pet.level === achievedPet.level + 1);

    return {
        current: achievedPet,
        next: nextPet || null
    };
}

/** Kiểm tra và mở khóa Pet mới */
function checkPetEvolution(user) {
    const currentAmount = user.savings.currentAmount;
    
    PET_LEVELS.forEach(pet => {
        // Kiểm tra xem đã đạt mục tiêu của Pet này chưa VÀ Pet này chưa được mở khóa
        if (currentAmount >= pet.goal && !user.savings.unlockedPets.includes(pet.name)) {
            user.savings.unlockedPets.push(pet.name);
            showGlobalMessage(`🎉 CHÚC MỪNG! Pet mới đã được mở khóa: ${pet.name}!`, 'success');
        }
    });
}

/** Cập nhật UI Tiết Kiệm và Pet */
function renderSavingsUI(user) {
    const savings = user.savings;
    const { current, next } = getCurrentPet(savings.currentAmount);

    // Cập nhật Tab Tiết Kiệm (UI cũ)
    document.getElementById('savings-name-display').textContent = savings.name;
    document.getElementById('savings-current-amount').textContent = formatCurrency(savings.currentAmount);
    document.getElementById('savings-goal-display').textContent = formatCurrency(savings.goal);
    
    const progress = savings.goal > 0 ? (savings.currentAmount / savings.goal) * 100 : 0;
    const progressBar = document.getElementById('savings-progress-bar');
    progressBar.style.width = `${Math.min(100, progress)}%`;
    
    // Cập nhật Pet (Dashboard UI mới)
    let petProgressText = 'Đã đạt cấp tối đa!';
    let petPercent = 100;

    if (next) {
        // Đang tiến hóa đến Pet tiếp theo
        const requiredAmount = next.goal - current.goal;
        const currentProgress = savings.currentAmount - current.goal;
        petProgressText = `${formatCurrency(currentProgress)}/${formatCurrency(requiredAmount)}`;
        petPercent = (currentProgress / requiredAmount) * 100;

        // Đặc biệt: Nếu goal của Pet 1 (Heo Con) là 0, thì Pet 2 (Heo Đất) là 50k
        if (current.level === 1) {
            petProgressText = `${formatCurrency(savings.currentAmount)}/${formatCurrency(next.goal)}`;
            petPercent = (savings.currentAmount / next.goal) * 100;
        }
    }

    // Hiển thị Pet hiện tại
    document.querySelector('.pet-icon').src = current.icon;
    document.querySelector('.pet-name').textContent = current.name;
    document.querySelector('.pet-level').textContent = `Cấp độ: ${current.level}`;
    document.getElementById('pet-evolution-progress').textContent = petProgressText;
    document.getElementById('savings-progress-bar-small').style.width = `${petPercent}%`;
    
    // Cập nhật Bộ Sưu Tập Pet
    renderPetCollection(user.savings.unlockedPets);
}

/** Hiển thị các Pet đã mở khóa */
function renderPetCollection(unlockedPets) {
    const collectionEl = document.getElementById('pet-collection-list');
    if(!collectionEl) return; // Bảo vệ nếu HTML bị thiếu
    
    collectionEl.innerHTML = ''; 

    PET_LEVELS.forEach(pet => {
        const isUnlocked = unlockedPets.includes(pet.name);
        const petItem = document.createElement('div');
        petItem.className = `pet-collection-item ${isUnlocked ? 'unlocked' : 'locked'}`;
        
        if (isUnlocked) {
            petItem.innerHTML = `
                <img src="${pet.icon}" alt="${pet.name}">
                <p>${pet.name}</p>
                <p class="pet-status">Cấp ${pet.level}</p>
            `;
        } else {
            petItem.innerHTML = `
                <i class="fas fa-lock pet-lock-icon"></i>
                <p>???</p>
                <p class="pet-status">Mục tiêu: ${formatCurrency(pet.goal)}</p>
            `;
        }
        collectionEl.appendChild(petItem);
    });
}

// Xử lý Form Thiết Lập/Cập nhật Mục tiêu Tiết kiệm
document.getElementById('savings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('savings-name').value.trim();
    const goal = parseFloat(document.getElementById('savings-goal-input').value);
    const password = document.getElementById('savings-password').value;

    if (password.length < 4 || password.length > 6 || isNaN(parseInt(password))) {
        showGlobalMessage('Mật khẩu Quỹ phải là 4-6 chữ số.', 'error');
        return;
    }
    
    const user = getCurrentUser();
    user.savings.name = name;
    user.savings.goal = goal;
    user.savings.password = password;
    
    updateCurrentUser(user);
    showGlobalMessage('Mục tiêu Quỹ đã được thiết lập/cập nhật.', 'success');
    renderSavingsUI(user);
});

// Xử lý Form Chuyển tiền vào Quỹ (Form riêng trong tab Tiết Kiệm)
document.getElementById('savings-transfer-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const transferAmount = parseFloat(document.getElementById('transfer-amount').value);
    const password = document.getElementById('transfer-password').value;
    const user = getCurrentUser();
    
    if (isNaN(transferAmount) || transferAmount <= 0) {
         showGlobalMessage('Vui lòng nhập số tiền hợp lệ.', 'error');
        return;
    }
    
    if (!user.savings.password || user.savings.password !== password) {
        showGlobalMessage('Mật khẩu Quỹ Tiết Kiệm không đúng hoặc chưa thiết lập.', 'error');
        return;
    }
    
    const { balance } = calculateBalance(user);
    if (transferAmount > balance) {
        showGlobalMessage('Số dư tài khoản chính không đủ.', 'error');
        return;
    }
    
    // 1. Ghi lại giao dịch "Chuyển vào Quỹ" (Loại Expense)
    user.transactions.push({
        id: Date.now(),
        amount: transferAmount,
        type: 'expense',
        category: 'tiet-kiem',
        date: getCurrentDate(),
        note: `Chuyển trực tiếp vào quỹ ${user.savings.name}`,
        isSavingsTransfer: true, 
    });

    // 2. Cập nhật số dư Quỹ
    user.savings.currentAmount += transferAmount;
    
    // Kiểm tra và mở khóa pet
    checkPetEvolution(user);

    updateCurrentUser(user);
    showGlobalMessage(`Đã chuyển ${formatCurrency(transferAmount)} vào Quỹ.`, 'success');
    document.getElementById('savings-transfer-form').reset();
    updateAppUI();
});

// Xử lý Hiển thị Form Rút tiền
document.getElementById('show-withdraw-form-btn').addEventListener('click', () => {
    const container = document.getElementById('savings-withdraw-form-container');
    container.style.display = container.style.display === 'none' ? 'block' : 'none';
});

// Xử lý Form Rút tiền Tiết kiệm
document.getElementById('savings-withdraw-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const withdrawAmount = parseFloat(document.getElementById('withdraw-amount').value);
    const password = document.getElementById('withdraw-password').value;
    const user = getCurrentUser();

    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
         showGlobalMessage('Vui lòng nhập số tiền hợp lệ.', 'error');
        return;
    }
    
    if (!user.savings.password || user.savings.password !== password) {
        showGlobalMessage('Mật khẩu Quỹ Tiết Kiệm không đúng hoặc chưa thiết lập.', 'error');
        return;
    }
    
    if (withdrawAmount > user.savings.currentAmount) {
        showGlobalMessage('Số tiền rút vượt quá số dư Quỹ Tiết Kiệm.', 'error');
        return;
    }

    // 1. Ghi lại giao dịch "Rút tiền Tiết kiệm" (Loại Income) vào tài khoản chính
    user.transactions.push({
        id: Date.now(),
        amount: withdrawAmount,
        type: 'income',
        category: 'rut-tiet-kiem', 
        date: getCurrentDate(),
        note: `Rút tiền từ quỹ ${user.savings.name}`,
    });

    // 2. Cập nhật số dư Quỹ
    user.savings.currentAmount -= withdrawAmount;

    updateCurrentUser(user);
    showGlobalMessage(`Đã rút ${formatCurrency(withdrawAmount)} từ Quỹ.`, 'success');
    document.getElementById('savings-withdraw-form').reset();
    document.getElementById('savings-withdraw-form-container').style.display = 'none';
    updateAppUI();
});

// =================================================================
// LOGIC 6 CHIẾC LỌ (JARS)
// ** ĐÃ TỐI ƯU HIỂN THỊ PHẦN TRĂM **
// =================================================================

function renderJarsUI(user, monthlyIncome) {
    const monthlyBudget = monthlyIncome; // Sử dụng tổng thu nhập tháng làm cơ sở phân bổ
    
    // Tính toán lại giá trị cho từng Lọ
    user.jars.NEC = Math.round(monthlyBudget * JAR_ALLOCATION.NEC);
    user.jars.LTSS = Math.round(monthlyBudget * JAR_ALLOCATION.LTSS);
    user.jars.EDU = Math.round(monthlyBudget * JAR_ALLOCATION.EDU);
    user.jars.PLAY = Math.round(monthlyBudget * JAR_ALLOCATION.PLAY);
    user.jars.FF = Math.round(monthlyBudget * JAR_ALLOCATION.FF);
    user.jars.GIVE = Math.round(monthlyBudget * JAR_ALLOCATION.GIVE);
    
    // Cập nhật hiển thị (Dựa trên số tiền phân bổ)
    document.querySelector('.jar-nec .jar-amount').textContent = formatCurrency(user.jars.NEC);
    document.querySelector('.jar-ltss .jar-amount').textContent = formatCurrency(user.jars.LTSS);
    document.querySelector('.jar-edu .jar-amount').textContent = formatCurrency(user.jars.EDU);
    document.querySelector('.jar-play .jar-amount').textContent = formatCurrency(user.jars.PLAY);
    document.querySelector('.jar-ff .jar-amount').textContent = formatCurrency(user.jars.FF);
    document.querySelector('.jar-give .jar-amount').textContent = formatCurrency(user.jars.GIVE);
    
    // Cập nhật phần trăm hiển thị (làm tròn 0 chữ số thập phân)
    // FIX LỖI HIỂN THỊ PHẦN TRĂM DƯ THỪA (VÍ DỤ: 55.00000000000001%)
    document.querySelector('.jar-nec .jar-percent').textContent = ` (NEC - ${ (JAR_ALLOCATION.NEC * 100).toFixed(0)}%)`;
    document.querySelector('.jar-ltss .jar-percent').textContent = ` (LTSS - ${ (JAR_ALLOCATION.LTSS * 100).toFixed(0)}%)`;
    document.querySelector('.jar-edu .jar-percent').textContent = ` (EDU - ${ (JAR_ALLOCATION.EDU * 100).toFixed(0)}%)`;
    document.querySelector('.jar-play .jar-percent').textContent = ` (PLAY - ${ (JAR_ALLOCATION.PLAY * 100).toFixed(0)}%)`;
    document.querySelector('.jar-ff .jar-percent').textContent = ` (FF - ${ (JAR_ALLOCATION.FF * 100).toFixed(0)}%)`;
    document.querySelector('.jar-give .jar-percent').textContent = ` (GIVE - ${ (JAR_ALLOCATION.GIVE * 100).toFixed(0)}%)`;

    updateCurrentUser(user);
}

// =================================================================
// LOGIC LỊCH SỬ GIAO DỊCH
// =================================================================

function renderTransactionList(transactions) {
    const listEl = document.getElementById('transaction-list');
    listEl.innerHTML = ''; 

    if (transactions.length === 0) {
        listEl.innerHTML = '<li class="empty-list">Chưa có giao dịch nào được ghi lại.</li>';
        return;
    }

    transactions.forEach(trans => {
        const li = document.createElement('li');
        li.className = `transaction-item ${trans.type}`;
        
        // Icon
        const iconClass = getCategoryIcon(trans.category);
        let categoryText = trans.category.charAt(0).toUpperCase() + trans.category.slice(1).replace(/-/g, ' ');

        if (trans.category === 'tiet-kiem') {
            categoryText = 'Chuyển Quỹ';
        } else if (trans.category === 'rut-tiet-kiem') {
            categoryText = 'Rút Tiết Kiệm';
        }

        li.innerHTML = `
            <div class="transaction-icon"><i class="fas ${iconClass}"></i></div>
            <div class="transaction-details">
                <span class="transaction-category">${categoryText}</span>
                <span class="transaction-note">${trans.note || 'Không ghi chú'}</span>
                <span class="transaction-date">${trans.date}</span>
            </div>
            <div class="transaction-amount ${trans.type}">
                ${formatCurrency(trans.amount)}
                <button class="delete-btn" data-id="${trans.id}"><i class="fas fa-trash"></i></button>
            </div>
        `;
        listEl.appendChild(li);
    });
    
    // Gắn sự kiện xóa
    listEl.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', deleteTransaction);
    });
}

function deleteTransaction(e) {
    const idToDelete = parseInt(e.currentTarget.getAttribute('data-id'));
    const user = getCurrentUser();
    
    // Tìm giao dịch cần xóa
    const transIndex = user.transactions.findIndex(t => t.id === idToDelete);
    if (transIndex === -1) return;

    const transaction = user.transactions[transIndex];

    // Xử lý trường hợp xóa giao dịch chuyển quỹ (cần hoàn lại quỹ)
    if (transaction.category === 'tiet-kiem') {
        user.savings.currentAmount -= transaction.amount;
        checkPetEvolution(user); // Kiểm tra lại sau khi số tiền thay đổi
    }
    
    // Xử lý trường hợp xóa giao dịch rút quỹ (cần trừ số dư quỹ)
    if (transaction.category === 'rut-tiet-kiem') {
        // Hoàn lại tiền vào quỹ vì giao dịch income bị xóa
        user.savings.currentAmount += transaction.amount;
        checkPetEvolution(user); // Kiểm tra lại sau khi số tiền thay đổi
    }
    
    user.transactions.splice(transIndex, 1);
    
    updateCurrentUser(user);
    showGlobalMessage('Đã xóa giao dịch.', 'warning');
    updateAppUI(); 
}

// Lọc lịch sử
document.querySelectorAll('.sub-menu-history button').forEach(button => {
    button.addEventListener('click', (e) => {
        document.querySelectorAll('.sub-menu-history button').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');

        const type = e.target.getAttribute('data-type');
        const user = getCurrentUser();
        let filteredTransactions = user.transactions.slice().reverse();

        document.getElementById('month-filter-container').style.display = 'none';

        if (type === 'income' || type === 'expense') {
            filteredTransactions = filteredTransactions.filter(t => t.type === type);
            renderTransactionList(filteredTransactions);
        } else if (type === 'all') {
            renderTransactionList(filteredTransactions);
        } else if (type === 'filter') {
            document.getElementById('month-filter-container').style.display = 'flex';
        }
    });
});

document.getElementById('apply-history-filter-btn').addEventListener('click', () => {
    const selectedMonth = document.getElementById('history-filter-month').value;
    const user = getCurrentUser();
    
    let filteredTransactions = user.transactions.slice().reverse();
    
    if (selectedMonth) {
        filteredTransactions = filteredTransactions.filter(t => t.date.startsWith(selectedMonth));
    }

    renderTransactionList(filteredTransactions);
    showGlobalMessage(`Đã lọc ${filteredTransactions.length} giao dịch.`, 'info');
});

// =================================================================
// LOGIC BIỂU ĐỒ (CHART.JS) - ĐÃ BỎ QUA
// =================================================================
// Các hàm biểu đồ không được sử dụng trong giao diện mới này,
// nhưng giữ định nghĩa để tránh lỗi nếu bạn muốn dùng lại sau.
function renderMonthlyPieChart(user) { /* Logic Chart */ }
function renderHistoryBarChart(user) { /* Logic Chart */ }


// =================================================================
// LOGIC CÀI ĐẶT
// =================================================================

// Chuyển đổi giữa các cài đặt (Hồ sơ, Mật khẩu, Về ứng dụng)
document.querySelectorAll('.sub-menu-settings button').forEach(button => {
    button.addEventListener('click', (e) => {
        document.querySelectorAll('.sub-menu-settings button').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');

        document.querySelectorAll('.settings-content').forEach(content => {
            content.style.display = 'none';
        });
        
        const targetId = e.target.getAttribute('data-target-setting');
        document.getElementById(targetId).style.display = 'block';
        
        if (targetId === 'profile-settings-content') {
            // Tải dữ liệu hiện tại vào form
            const user = getCurrentUser();
            document.getElementById('set-monthly-income').value = user.monthlyIncome;
            document.getElementById('set-daily-limit').value = user.dailyLimit;
        }
    });
});

document.getElementById('profile-settings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const monthlyIncome = parseFloat(document.getElementById('set-monthly-income').value);
    const dailyLimit = parseFloat(document.getElementById('set-daily-limit').value);
    
    const user = getCurrentUser();
    
    // Cập nhật Thu nhập dự kiến
    user.monthlyIncome = monthlyIncome;
    user.dailyLimit = dailyLimit;
    
    updateCurrentUser(user);
    showGlobalMessage('Cài đặt hồ sơ chi tiêu đã được cập nhật.', 'success');
    updateAppUI(); 
});

document.getElementById('password-settings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmNewPassword = document.getElementById('confirm-new-password').value;
    
    const user = getCurrentUser();

    if (user.password !== currentPassword) {
        showGlobalMessage('Mật khẩu hiện tại không đúng.', 'error');
        return;
    }

    if (newPassword.length < 6) {
        showGlobalMessage('Mật khẩu mới phải có ít nhất 6 ký tự.', 'error');
        return;
    }

    if (newPassword !== confirmNewPassword) {
        showGlobalMessage('Mật khẩu mới và xác nhận không khớp.', 'error');
        return;
    }

    user.password = newPassword;
    updateCurrentUser(user);
    showGlobalMessage('Mật khẩu đã được thay đổi thành công!', 'success');
    document.getElementById('password-settings-form').reset();
});

// =================================================================
// CÁC SỰ KIỆN KHỞI TẠO
// =================================================================

// Lắng nghe sự kiện chuyển tab
navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        const targetId = e.currentTarget.getAttribute('data-target');
        switchTab(targetId);
    });
});


// TẢI DỮ LIỆU VÀ KHỞI TẠO APP
loadAppData();
window.addEventListener('load', () => {
    checkLoginState();
    
    // Đặt ngày hiện tại cho form giao dịch
    document.getElementById('date-input').value = getCurrentDate(); 
});
