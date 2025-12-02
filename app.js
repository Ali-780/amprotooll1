// ==================== إعدادات النظام ====================
const SECURITY_CONFIG = {
    PASSWORD: "780431",
    MAX_ATTEMPTS: 5,
    SESSION_TIMEOUT: 30, // دقائق
    BLOCK_TIME: 15 // دقائق
};

const FIREBASE_CONFIG = {
    mainDb: "https://amprousers-default-rtdb.firebaseio.com",
    authToken: "1hI1zkAiGvtkQEXwlbV8bm63qgtcIiythBTK5Z3I",
    db1: "https://amprofixwatool-default-rtdb.firebaseio.com/users.json",
    db2: "https://hiprotool-aa3f6-default-rtdb.firebaseio.com/users.json"
};

// متغيرات النظام
let loginAttempts = 0;
let sessionStartTime = null;
let sessionTimer = null;
let blockedUntil = null;
let selectMode = false;
let selectedLicenses = new Set();

// ==================== تهيئة الصفحة ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 النظام جاهز للبدء');
    
    // 1. التحقق من حالة الحظر
    checkBlockStatus();
    
    // 2. إعداد زر إظهار/إخفاء كلمة المرور
    setupPasswordToggle();
    
    // 3. إعداد أحداث لوحة المفاتيح
    setupKeyboardEvents();
    
    // 4. تعيين التاريخ الافتراضي
    setDefaultDate();
    
    // 5. تحديث عداد المحاولات
    updateAttemptsDisplay();
    
    // 6. التحقق من تسجيل الدخول السابق
    checkLoginStatus();
    
    // 7. إضافة أزرار التصحيح (للإزالة لاحقاً)
    addDebugButtons();
});

// ==================== دوال التهيئة ====================
function setupPasswordToggle() {
    const toggleBtn = document.getElementById('togglePassword');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function() {
            const passwordInput = document.getElementById('passwordInput');
            const icon = this.querySelector('i');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                icon.classList.replace('fa-eye', 'fa-eye-slash');
            } else {
                passwordInput.type = 'password';
                icon.classList.replace('fa-eye-slash', 'fa-eye');
            }
        });
    }
}

function setupKeyboardEvents() {
    const passwordInput = document.getElementById('passwordInput');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                login();
            }
        });
    }
    
    // اختصار Ctrl+Shift+L للدخول السريع (للتصحيح)
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.shiftKey && e.key === 'L') {
            document.getElementById('passwordInput').value = SECURITY_CONFIG.PASSWORD;
            login();
        }
    });
}

function setDefaultDate() {
    const dateInput = document.getElementById('expiryDate');
    if (dateInput) {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        dateInput.value = `${year}-${month}-${day}`;
    }
}

function addDebugButtons() {
    // إضافة أزرار التصحيح فقط في وضع التطوير
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        const debugDiv = document.createElement('div');
        debugDiv.className = 'debug-tools';
        debugDiv.innerHTML = `
            <div style="position:fixed; bottom:10px; left:10px; z-index:9999;">
                <button class="btn btn-sm btn-warning me-1" onclick="testFirebaseConnection()">
                    <i class="fas fa-wifi"></i>
                </button>
                <button class="btn btn-sm btn-info me-1" onclick="loadLicenses()">
                    <i class="fas fa-redo"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="clearAllData()">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        document.body.appendChild(debugDiv);
    }
}

// ==================== نظام الحماية ====================
function checkBlockStatus() {
    const blocked = localStorage.getItem('system_blocked');
    if (blocked) {
        const blockData = JSON.parse(blocked);
        const now = new Date().getTime();
        
        if (now < blockData.until) {
            blockedUntil = blockData.until;
            const remaining = Math.ceil((blockData.until - now) / 60000);
            showBlockedMessage(remaining);
            return true;
        } else {
            localStorage.removeItem('system_blocked');
            localStorage.removeItem('login_attempts');
        }
    }
    
    const attempts = localStorage.getItem('login_attempts');
    if (attempts) {
        loginAttempts = parseInt(attempts);
        updateAttemptsDisplay();
    }
    
    return false;
}

function showBlockedMessage(minutes) {
    const loginScreen = document.getElementById('loginScreen');
    if (!loginScreen) return;
    
    loginScreen.innerHTML = `
        <div class="login-container">
            <div class="login-card">
                <div class="text-center mb-4">
                    <i class="fas fa-ban fa-4x text-danger"></i>
                    <h2 class="mt-3">النظام مغلق مؤقتاً</h2>
                    <p class="text-muted">تم تجاوز عدد المحاولات المسموحة</p>
                </div>
                
                <div class="alert alert-danger">
                    <h4><i class="fas fa-exclamation-triangle"></i> تم حظر النظام</h4>
                    <p class="mb-0">سيتم فتح النظام بعد: <strong>${minutes} دقيقة</strong></p>
                </div>
                
                <div class="text-center mt-4">
                    <button class="btn btn-outline-primary" onclick="location.reload()">
                        <i class="fas fa-redo"></i> تحديث الصفحة
                    </button>
                </div>
            </div>
        </div>
    `;
}

// ==================== تسجيل الدخول والخروج ====================
function login() {
    const passwordInput = document.getElementById('passwordInput');
    const password = passwordInput ? passwordInput.value.trim() : '';
    
    if (!password) {
        showToast('تحذير', 'يرجى إدخال كلمة المرور', 'warning');
        return;
    }
    
    if (checkBlockStatus()) {
        return;
    }
    
    if (password === SECURITY_CONFIG.PASSWORD) {
        successfulLogin();
    } else {
        failedLogin();
    }
}

function successfulLogin() {
    loginAttempts = 0;
    localStorage.removeItem('login_attempts');
    localStorage.removeItem('system_blocked');
    
    sessionStartTime = new Date();
    localStorage.setItem('session_start', sessionStartTime.getTime());
    
    // إخفاء شاشة الدخول
    const loginScreen = document.getElementById('loginScreen');
    const mainContent = document.getElementById('mainContent');
    
    if (loginScreen) loginScreen.style.display = 'none';
    if (mainContent) {
        mainContent.classList.remove('d-none');
        mainContent.classList.add('fade-in-up');
    }
    
    // تحديث وقت الدخول
    const loginTime = document.getElementById('loginTime');
    if (loginTime) {
        loginTime.textContent = sessionStartTime.toLocaleString('ar-SA');
    }
    
    // بدء الجلسة
    startSessionTimer();
    
    // تحميل البيانات
    setTimeout(() => {
        loadLicenses();
        updateStat(1);
        updateStat(2);
    }, 500);
    
    localStorage.setItem('logged_in', 'true');
    showToast('مرحباً!', 'تم الدخول بنجاح', 'success');
}

function failedLogin() {
    loginAttempts++;
    localStorage.setItem('login_attempts', loginAttempts.toString());
    updateAttemptsDisplay();
    
    const passwordInput = document.getElementById('passwordInput');
    if (passwordInput) {
        passwordInput.classList.add('error-shake');
        passwordInput.value = '';
        passwordInput.focus();
        
        setTimeout(() => {
            passwordInput.classList.remove('error-shake');
        }, 500);
    }
    
    if (loginAttempts >= SECURITY_CONFIG.MAX_ATTEMPTS) {
        blockSystem();
    } else {
        showToast('خطأ', 'كلمة مرور غير صحيحة', 'error');
    }
}

function updateAttemptsDisplay() {
    const attemptsLeft = SECURITY_CONFIG.MAX_ATTEMPTS - loginAttempts;
    const progressWidth = (attemptsLeft / SECURITY_CONFIG.MAX_ATTEMPTS) * 100;
    
    const attemptsElement = document.getElementById('attemptsLeft');
    const progressElement = document.getElementById('attemptsProgress');
    
    if (attemptsElement) attemptsElement.textContent = attemptsLeft;
    if (progressElement) {
        progressElement.style.width = `${progressWidth}%`;
        
        if (attemptsLeft <= 1) {
            progressElement.className = 'progress-bar bg-danger';
        } else if (attemptsLeft <= 2) {
            progressElement.className = 'progress-bar bg-warning';
        } else {
            progressElement.className = 'progress-bar bg-success';
        }
    }
}

function blockSystem() {
    const blockTime = new Date();
    blockTime.setMinutes(blockTime.getMinutes() + SECURITY_CONFIG.BLOCK_TIME);
    blockedUntil = blockTime.getTime();
    
    const blockData = {
        until: blockedUntil,
        timestamp: new Date().getTime()
    };
    
    localStorage.setItem('system_blocked', JSON.stringify(blockData));
    location.reload();
}

function startSessionTimer() {
    let timeLeft = SECURITY_CONFIG.SESSION_TIMEOUT * 60;
    
    sessionTimer = setInterval(() => {
        timeLeft--;
        
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        
        const timerElement = document.getElementById('sessionTimer');
        if (timerElement) {
            timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            timerElement.className = '';
            if (timeLeft <= 60) {
                timerElement.classList.add('text-danger', 'fw-bold');
            } else if (timeLeft <= 300) {
                timerElement.classList.add('text-warning');
            }
        }
        
        if (timeLeft <= 0) {
            clearInterval(sessionTimer);
            logout(true);
        }
    }, 1000);
}

function logout(timeout = false) {
    if (sessionTimer) clearInterval(sessionTimer);
    
    localStorage.removeItem('logged_in');
    localStorage.removeItem('session_start');
    
    const loginScreen = document.getElementById('loginScreen');
    const mainContent = document.getElementById('mainContent');
    
    if (loginScreen) loginScreen.style.display = 'flex';
    if (mainContent) {
        mainContent.classList.add('d-none');
        mainContent.classList.remove('fade-in-up');
    }
    
    const passwordInput = document.getElementById('passwordInput');
    if (passwordInput) passwordInput.value = '';
    
    if (timeout) {
        loginAttempts = 0;
        localStorage.removeItem('login_attempts');
        updateAttemptsDisplay();
        showToast('انتهت الجلسة', 'تم تسجيل الخروج تلقائياً', 'warning');
    }
}

function checkLoginStatus() {
    const loggedIn = localStorage.getItem('logged_in');
    const sessionStart = localStorage.getItem('session_start');
    
    if (loggedIn === 'true' && sessionStart) {
        const sessionTime = parseInt(sessionStart);
        const now = new Date().getTime();
        const sessionAge = (now - sessionTime) / 60000;
        
        if (sessionAge < SECURITY_CONFIG.SESSION_TIMEOUT) {
            successfulLogin();
        } else {
            localStorage.removeItem('logged_in');
            localStorage.removeItem('session_start');
        }
    }
}

// ==================== دوال Firebase ====================
async function updateStat(dbNumber) {
    try {
        const url = dbNumber === 1 ? FIREBASE_CONFIG.db1 : FIREBASE_CONFIG.db2;
        const response = await fetch(url);
        const data = await response.json();
        
        const count = data ? Object.keys(data).length : 0;
        document.getElementById(`stat${dbNumber}`).textContent = count.toLocaleString('ar-SA');
        
        showToast('تم التحديث', `القاعدة ${dbNumber}: ${count} مستخدم`, 'success');
    } catch (error) {
        showToast('خطأ', `فشل تحديث القاعدة ${dbNumber}`, 'error');
    }
}

async function loadLicenses() {
    const loading = document.getElementById('loading');
    const licensesList = document.getElementById('licensesList');
    
    if (!loading || !licensesList) return;
    
    loading.style.display = 'block';
    licensesList.style.display = 'none';
    
    try {
        const url = `${FIREBASE_CONFIG.mainDb}/license_keys.json?auth=${FIREBASE_CONFIG.authToken}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`خطأ ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        let html = '';
        let totalCount = 0;
        let activeCount = 0;
        
        if (data && typeof data === 'object') {
            const licensesArray = Object.entries(data).map(([key, value]) => ({
                key,
                userName: value.userName || 'غير محدد',
                expiresAt: value.expiresAt || 'غير محدد',
                hwid: value.hwid || '',
                notes: value.notes || '',
                used: value.used || false,
                createdAt: value.createdAt || ''
            }));
            
            licensesArray.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            licensesArray.forEach(license => {
                totalCount++;
                if (!license.used) activeCount++;
                
                const isUsed = license.used;
                const hasHWID = license.hwid && license.hwid.trim() !== '';
                const isExpired = license.expiresAt && new Date(license.expiresAt) < new Date();
                const createdDate = license.createdAt ? new Date(license.createdAt).toLocaleDateString('ar-SA') : '';
                
                html += `
                    <div class="license-card ${isUsed ? 'used' : ''} ${isExpired ? 'expired' : ''}" 
                         onclick="toggleSelect('${license.key}', event)">
                        
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="license-info">
                                <div class="d-flex align-items-center mb-2">
                                    <h6 class="mb-0 me-2"><i class="fas fa-key"></i> ${license.key}</h6>
                                    <span class="badge ${isUsed ? 'bg-danger' : isExpired ? 'bg-warning' : 'bg-success'}">
                                        ${isUsed ? 'مستخدم' : isExpired ? 'منتهي' : 'نشط'}
                                    </span>
                                </div>
                                
                                <p class="mb-1"><i class="fas fa-user"></i> ${license.userName}</p>
                                <p class="mb-1 ${isExpired ? 'text-danger' : ''}">
                                    <i class="fas fa-calendar"></i> ${formatGregorianDate(license.expiresAt)}
                                    ${isExpired ? ' (منتهي)' : ''}
                                </p>
                                
                                <div class="license-meta">
                                    <span class="badge ${hasHWID ? 'bg-info' : 'bg-secondary'}">
                                        <i class="fas ${hasHWID ? 'fa-link' : 'fa-unlink'}"></i> 
                                        ${hasHWID ? 'مرتبط' : 'غير مرتبط'}
                                    </span>
                                    <span class="badge bg-dark">
                                        <i class="fas fa-clock"></i> ${createdDate}
                                    </span>
                                </div>
                            </div>
                            
                            <div class="license-actions">
                                <button class="btn-action btn-edit" onclick="editLicense('${license.key}', event)">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn-action btn-reset" onclick="resetHWID('${license.key}', event)">
                                    <i class="fas fa-sync-alt"></i>
                                </button>
                                <button class="btn-action btn-delete" onclick="deleteLicense('${license.key}', event)">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
        }
        
        if (totalCount === 0) {
            html = `
                <div class="text-center py-5">
                    <i class="fas fa-inbox fa-3x text-muted mb-3"></i>
                    <h5 class="text-muted">لا توجد تراخيص</h5>
                    <p class="text-muted">لم يتم إنشاء أي تراخيص بعد</p>
                </div>
            `;
        }
        
        licensesList.innerHTML = html;
        document.getElementById('totalLicenses').textContent = totalCount;
        document.getElementById('licenseCount').textContent = totalCount;
        document.getElementById('activeCount').textContent = activeCount;
        document.getElementById('activeUsers').textContent = activeCount;
        
    } catch (error) {
        licensesList.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>خطأ في التحميل:</strong> ${error.message}
                <button class="btn btn-sm btn-outline-danger mt-2" onclick="loadLicenses()">
                    <i class="fas fa-redo"></i> إعادة المحاولة
                </button>
            </div>
        `;
    } finally {
        loading.style.display = 'none';
        licensesList.style.display = 'block';
    }
}

async function createLicense() {
    const licenseKey = document.getElementById('licenseKey').value.trim();
    const userName = document.getElementById('userName').value.trim();
    const expiryDate = document.getElementById('expiryDate').value;
    const hwid = document.getElementById('licenseHWID').value.trim();
    const notes = document.getElementById('licenseNotes').value.trim();
    
    if (!licenseKey || !userName || !expiryDate) {
        showToast('تحذير', 'يرجى ملء الحقول المطلوبة', 'warning');
        return;
    }
    
    const licenseData = {
        createdAt: new Date().toISOString(),
        expiresAt: expiryDate,
        hwid: hwid || "",
        notes: notes || "تم الإنشاء عبر تطبيق الويب",
        used: false,
        userName: userName,
        lastUpdated: new Date().toISOString()
    };
    
    try {
        const url = `${FIREBASE_CONFIG.mainDb}/license_keys/${encodeURIComponent(licenseKey)}.json?auth=${FIREBASE_CONFIG.authToken}`;
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(licenseData)
        });
        
        if (response.ok) {
            showToast('نجاح', `تم إنشاء الترخيص: ${licenseKey}`, 'success');
            
            document.getElementById('licenseKey').value = '';
            document.getElementById('userName').value = '';
            document.getElementById('licenseHWID').value = '';
            document.getElementById('licenseNotes').value = '';
            
            setTimeout(loadLicenses, 1000);
        } else {
            showToast('خطأ', 'فشل إنشاء الترخيص', 'error');
        }
    } catch (error) {
        showToast('خطأ', `حدث خطأ: ${error.message}`, 'error');
    }
}

// ==================== دوال إدارة التراخيص ====================
async function editLicense(licenseKey, event) {
    if (event) event.stopPropagation();
    
    try {
        const url = `${FIREBASE_CONFIG.mainDb}/license_keys/${encodeURIComponent(licenseKey)}.json?auth=${FIREBASE_CONFIG.authToken}`;
        const response = await fetch(url);
        const licenseData = await response.json();
        
        // تعبئة النموذج
        document.getElementById('editLicenseKey').value = licenseKey;
        document.getElementById('editUserName').value = licenseData.userName || '';
        document.getElementById('editExpiryDate').value = licenseData.expiresAt || '';
        document.getElementById('editHWID').value = licenseData.hwid || '';
        document.getElementById('editNotes').value = licenseData.notes || '';
        
        if (licenseData.used) {
            document.getElementById('editUsed').checked = true;
        } else {
            document.getElementById('editActive').checked = true;
        }
        
        // إظهار النافذة
        const modal = new bootstrap.Modal(document.getElementById('editLicenseModal'));
        modal.show();
    } catch (error) {
        showToast('خطأ', `فشل تحميل بيانات الترخيص`, 'error');
    }
}

async function resetHWID(licenseKey, event) {
    if (event) event.stopPropagation();
    
    if (!confirm(`هل تريد إعادة ضبط السيريال للترخيص: ${licenseKey}؟`)) {
        return;
    }
    
    try {
        const url = `${FIREBASE_CONFIG.mainDb}/license_keys/${encodeURIComponent(licenseKey)}.json?auth=${FIREBASE_CONFIG.authToken}`;
        const updateData = {
            hwid: "",
            used: false,
            resetAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
        };
        
        const response = await fetch(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        
        if (response.ok) {
            showToast('نجاح', `تم إعادة ضبط السيريال`, 'success');
            setTimeout(loadLicenses, 1000);
        }
    } catch (error) {
        showToast('خطأ', `فشل إعادة الضبط`, 'error');
    }
}

async function deleteLicense(licenseKey, event) {
    if (event) event.stopPropagation();
    
    if (!confirm(`هل أنت متأكد من حذف الترخيص: ${licenseKey}؟`)) {
        return;
    }
    
    try {
        const url = `${FIREBASE_CONFIG.mainDb}/license_keys/${encodeURIComponent(licenseKey)}.json?auth=${FIREBASE_CONFIG.authToken}`;
        const response = await fetch(url, { method: 'DELETE' });
        
        if (response.ok) {
            showToast('نجاح', `تم حذف الترخيص`, 'success');
            setTimeout(loadLicenses, 500);
        }
    } catch (error) {
        showToast('خطأ', `فشل حذف الترخيص`, 'error');
    }
}

async function saveLicenseEdit() {
    const licenseKey = document.getElementById('editLicenseKey').value;
    const userName = document.getElementById('editUserName').value.trim();
    const expiryDate = document.getElementById('editExpiryDate').value;
    const hwid = document.getElementById('editHWID').value.trim();
    const notes = document.getElementById('editNotes').value.trim();
    const used = document.querySelector('input[name="editUsed"]:checked').value === 'true';
    
    if (!userName || !expiryDate) {
        showToast('تحذير', 'يرجى ملء الحقول المطلوبة', 'warning');
        return;
    }
    
    const updateData = {
        userName,
        expiresAt: expiryDate,
        hwid: hwid || "",
        notes,
        used,
        lastUpdated: new Date().toISOString()
    };
    
    try {
        const url = `${FIREBASE_CONFIG.mainDb}/license_keys/${encodeURIComponent(licenseKey)}.json?auth=${FIREBASE_CONFIG.authToken}`;
        const response = await fetch(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        
        if (response.ok) {
            showToast('نجاح', 'تم تحديث بيانات الترخيص', 'success');
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('editLicenseModal'));
            modal.hide();
            
            setTimeout(loadLicenses, 500);
        }
    } catch (error) {
        showToast('خطأ', `فشل تحديث البيانات`, 'error');
    }
}

// ==================== دوال مساعدة ====================
function toggleHint() {
    const hint = document.getElementById('hint');
    const button = event.target;
    
    if (hint.classList.contains('hint-hidden')) {
        hint.classList.remove('hint-hidden');
        hint.textContent = 'فارح بوجهك';
        button.textContent = 'إخفاء';
    } else {
        hint.classList.add('hint-hidden');
        hint.textContent = '••••••';
        button.textContent = 'إظهار';
    }
}

function showForgotPassword() {
    const modal = new bootstrap.Modal(document.getElementById('forgotPasswordModal'));
    modal.show();
}

function refreshAll() {
    loadLicenses();
    updateStat(1);
    updateStat(2);
    showToast('تحديث', 'جاري تحديث البيانات', 'info');
}

function searchLicenses() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    const licenseItems = document.querySelectorAll('.license-card');
    
    if (!searchTerm) {
        licenseItems.forEach(item => item.style.display = 'block');
        return;
    }
    
    licenseItems.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(searchTerm) ? 'block' : 'none';
    });
}

function filterLicenses() {
    const filterValue = document.getElementById('filterStatus').value;
    const licenseItems = document.querySelectorAll('.license-card');
    
    licenseItems.forEach(item => {
        let showItem = true;
        
        if (filterValue === 'active') {
            showItem = !item.classList.contains('used') && !item.classList.contains('expired');
        } else if (filterValue === 'used') {
            showItem = item.classList.contains('used');
        } else if (filterValue === 'expired') {
            showItem = item.classList.contains('expired');
        } else if (filterValue === 'linked') {
            showItem = item.querySelector('.badge.bg-info') !== null;
        } else if (filterValue === 'unlinked') {
            showItem = item.querySelector('.badge.bg-secondary') !== null;
        }
        
        item.style.display = showItem ? 'block' : 'none';
    });
}

function toggleSelect(licenseKey, event) {
    if (!selectMode) return;
    if (event) event.stopPropagation();
    
    if (selectedLicenses.has(licenseKey)) {
        selectedLicenses.delete(licenseKey);
        event.currentTarget.classList.remove('selected');
    } else {
        selectedLicenses.add(licenseKey);
        event.currentTarget.classList.add('selected');
    }
}

function toggleSelectMode() {
    selectMode = !selectMode;
    selectedLicenses.clear();
    
    const button = document.querySelector('[onclick="toggleSelectMode()"]');
    const licenseItems = document.querySelectorAll('.license-card');
    
    if (selectMode) {
        button.innerHTML = '<i class="fas fa-times"></i> إلغاء التحديد';
        button.classList.add('btn-light', 'text-dark');
        licenseItems.forEach(item => item.classList.add('selectable'));
    } else {
        button.innerHTML = '<i class="fas fa-check-double"></i> تحديد متعدد';
        button.classList.remove('btn-light', 'text-dark');
        licenseItems.forEach(item => {
            item.classList.remove('selectable', 'selected');
        });
    }
}

function exportToCSV() {
    showToast('قريباً', 'ميزة التصدير قيد التطوير', 'info');
}

// ==================== دالة تحويل التاريخ إلى ميلادي ====================
function formatGregorianDate(dateString) {
    if (!dateString || dateString === 'غير محدد') {
        return 'غير محدد';
    }
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return dateString;
        }
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
    } catch (error) {
        console.error('خطأ في تحويل التاريخ:', error);
        return dateString;
    }
}

// ==================== دالة عرض الرسائل ====================
function showToast(title, message, type = 'info') {
    const toastHtml = `
        <div class="toast align-items-center text-white bg-${type === 'success' ? 'success' : type === 'error' ? 'danger' : type === 'warning' ? 'warning' : 'primary'} border-0"
             role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">
                    <strong>${title}:</strong> ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>
    `;
    
    const toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    toastContainer.innerHTML = toastHtml;
    document.body.appendChild(toastContainer);
    
    const toastElement = toastContainer.querySelector('.toast');
    const toast = new bootstrap.Toast(toastElement, { delay: 3000 });
    toast.show();
    
    toastElement.addEventListener('hidden.bs.toast', function() {
        document.body.removeChild(toastContainer);
    });
}

// ==================== دوال التصحيح ====================
async function testFirebaseConnection() {
    try {
        const url = `${FIREBASE_CONFIG.mainDb}/.json?auth=${FIREBASE_CONFIG.authToken}&shallow=true`;
        const response = await fetch(url);
        
        if (response.ok) {
            showToast('اتصال ناجح', 'Firebase متصل بنجاح', 'success');
        } else {
            showToast('خطأ اتصال', `فشل الاتصال: ${response.status}`, 'error');
        }
    } catch (error) {
        showToast('خطأ', `تعذر الاتصال: ${error.message}`, 'error');
    }
}

function clearAllData() {
    if (confirm('⚠️ هل تريد حذف جميع البيانات المحلية؟')) {
        localStorage.clear();
        location.reload();
    }
}

// ==================== بدء التشغيل ====================
console.log('🔧 نظام مدير التراخيص - الإصدار النهائي');
console.log('🔑 كلمة المرور:', SECURITY_CONFIG.PASSWORD);
console.log('🌐 Firebase:', FIREBASE_CONFIG.mainDb);
console.log('✅ النظام جاهز للتشغيل');
