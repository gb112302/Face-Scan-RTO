// ===================================
// Login & Feature Access Management
// ===================================

// Demo credentials for testing
const demoCredentials = {
    username: 'officer',
    password: 'rto123'
};

// Global detected city
let detectedCity = 'Mehsana'; // Default fallback

// Gujarat District & City Data
// Gujarat District & City Data - Will be loaded from API
let gujaratData = {};

// Fetch location data
async function fetchGujaratData() {
    try {
        const response = await fetch('/api/locations');
        const data = await response.json();
        gujaratData = data.gujaratData;
        
        // Also update cityCoordinates if available globally (for app.js)
        // Accessing global from other file (not ideal but works in this legacy setup)
        if (typeof cityCoordinates !== 'undefined') {
            Object.assign(cityCoordinates, data.cityCoordinates);
        }
        
        console.log('Gujarat location data loaded');
    } catch (error) {
        console.error('Error loading Gujarat data:', error);
    }
}

// Call immediately
fetchGujaratData();

// Open City Selection Modal
function openCityModal() {
    const modal = document.getElementById('citySelectionModal');
    if (!modal) return;

    // Populate Districts if empty
    const districtSelect = document.getElementById('districtSelect');
    if (districtSelect && districtSelect.options.length <= 1) {
        Object.keys(gujaratData).sort().forEach(district => {
            const option = document.createElement('option');
            option.value = district;
            option.textContent = district;
            districtSelect.appendChild(option);
        });
    }

    modal.style.display = 'flex';
}

// Close City Modal
function closeCityModal() {
    const modal = document.getElementById('citySelectionModal');
    if (modal) modal.style.display = 'none';
}

// Handle District Change
function handleDistrictChange() {
    const district = document.getElementById('districtSelect').value;
    const citySelect = document.getElementById('citySelect');

    // Reset City Select
    citySelect.innerHTML = '<option value="" disabled selected>Select City</option>';

    if (district && gujaratData[district]) {
        gujaratData[district].sort().forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            option.textContent = city;
            citySelect.appendChild(option);
        });
        citySelect.disabled = false;
    } else {
        citySelect.disabled = true;
    }
}

// Confirm Location Selection
function confirmLocation() {
    const selectedCity = document.getElementById('citySelect').value;
    if (!selectedCity) {
        showNotification('Please select a city', 'error');
        return;
    }

    detectedCity = selectedCity; // Update global
    currentCity = selectedCity;

    // Update Header Text
    const locationText = document.getElementById('currentLocationText');
    if (locationText) locationText.textContent = selectedCity;

    // Trigger updates
    if (typeof updateCityUI === 'function') updateCityUI();
    if (typeof populateDemoDrivers === 'function') populateDemoDrivers();

    showNotification(`Location set to ${selectedCity}`, 'success');
    closeCityModal();
}

// Detect City from ISP (Disabled by default as per request)
async function detectCityFromISP() {
    // ... logic preserved but disabled call ...
    try {
        console.log('Detecting city via ISP...');
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();

        if (data && data.city) {
            console.log('ISP City Detected:', data.city);

            // Check if detected city is in our supported list, otherwise keep it anyway or fallback
            // For this app, we'll try to match it or just use it
            detectedCity = data.city;

            // Update header dropdown if exists
            const headerSelect = document.getElementById('headerCitySelect');
            if (headerSelect) {
                // Try to select if option exists
                let optionFound = false;
                for (let i = 0; i < headerSelect.options.length; i++) {
                    if (headerSelect.options[i].value.toLowerCase() === detectedCity.toLowerCase()) {
                        headerSelect.selectedIndex = i;
                        optionFound = true;
                        break;
                    }
                }
                // If not found, add it temporarily or just set value
                if (!optionFound) {
                    const newOption = document.createElement('option');
                    newOption.value = detectedCity;
                    newOption.text = detectedCity + ' (Detected)';
                    newOption.selected = true;
                    headerSelect.add(newOption);
                }

                // Trigger change event
                headerSelect.dispatchEvent(new Event('change'));
            }

            showNotification(`Location detected: ${detectedCity}`, 'success');
        }
    } catch (error) {
        console.warn('Could not detect city from ISP:', error);
        // Fallback silently to default
    }
}

// Open login modal
function openLoginModal() {
    document.getElementById('loginModal').style.display = 'flex';
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginUsername').focus();
}

// Close login modal
function closeLoginModal() {
    document.getElementById('loginModal').style.display = 'none';
}

// Handle login
async function handleLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!username || !password) {
        alert('Please enter both username and password');
        return;
    }

    const loginBtn = document.querySelector('.login-btn');
    const originalText = loginBtn.innerHTML;
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span>⏳</span><span>Verifying...</span>';

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ officerId: username, password: password })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            const selectedCity = detectedCity || 'Mehsana';
            // Successful login with API data
            performLogin({
                name: data.officer.name,
                badge: data.officer.badgeNumber,
                username: data.officer.id,
                city: selectedCity
            });
            closeLoginModal();
        } else {
            alert(data.message || 'Invalid credentials');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed. Please check server connection.');
    } finally {
        loginBtn.disabled = false;
        loginBtn.innerHTML = originalText;
    }
}

// Handle biometric login
function handleBiometricLogin() {
    // Simulate biometric authentication
    const fingerprintScanner = document.getElementById('fingerprintScanner') || document.getElementById('landingFingerprint');
    if (fingerprintScanner) {
        fingerprintScanner.classList.add('scanning');
    }

    setTimeout(() => {
        const selectedCity = detectedCity || 'Mehsana';
        performLogin({
            name: 'Traffic Officer',
            badge: 'TO-001',
            username: 'biometric_user',
            city: selectedCity
        });
        closeLoginModal();
        showNotification('Biometric authentication successful!', 'success');
        if (fingerprintScanner) {
            fingerprintScanner.classList.remove('scanning');
        }
    }, 2000);
}

// Perform login and show all features
function performLogin(officer) {
    isLoggedIn = true;
    currentOfficer = officer;

    // Update city if provided
    if (officer.city) {
        currentCity = officer.city;
        if (typeof updateCityUI === 'function') {
            updateCityUI();
        }
        if (typeof populateDemoDrivers === 'function') {
            populateDemoDrivers();
        }
    }


    // Hide login landing page
    const landingPage = document.getElementById('loginLandingPage');
    if (landingPage) {
        landingPage.style.display = 'none';
    }

    // Remove login-mode class from body
    document.body.classList.remove('login-mode');

    // Update UI
    document.getElementById('loginBtn').style.display = 'none';
    document.getElementById('officerInfo').style.display = 'flex';
    document.getElementById('headerSearchSection').style.display = 'flex';

    document.getElementById('headerOfficerName').textContent = officer.name;

    // Pre-fill officer details in memo section
    document.getElementById('officerName').value = officer.name;
    document.getElementById('officerBadge').value = officer.badge;

    // Show main content
    document.getElementById('mainContent').style.display = 'grid';

    // Show all hidden features
    showAllFeatures();

    // Show success notification
    showNotification(`Welcome, ${officer.name}!`, 'success');
}

// Handle logout
function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        isLoggedIn = false;
        currentOfficer = null;

        // Update UI
        document.getElementById('loginBtn').style.display = 'flex';
        document.getElementById('officerInfo').style.display = 'none';
        document.getElementById('headerSearchSection').style.display = 'none';

        // Hide main content
        document.getElementById('mainContent').style.display = 'none';

        // Hide all advanced features
        hideAllFeatures();

        // Show login landing page
        const landingPage = document.getElementById('loginLandingPage');
        if (landingPage) {
            landingPage.style.display = 'flex';
            // Clear landing page fields
            document.getElementById('landingUsername').value = '';
            document.getElementById('landingPassword').value = '';
        }

        // Add login-mode class back
        document.body.classList.add('login-mode');

        // Show notification
        showNotification('Logged out successfully', 'info');
    }
}

// Show all hidden features (Modified to NOT show them automatically)
function showAllFeatures() {
    // Hide analytics section by default
    const analyticsSection = document.getElementById('analyticsSection');
    if (analyticsSection) {
        analyticsSection.style.display = 'none';
    }

    // Hide document verification section by default
    const documentSection = document.getElementById('documentSection');
    if (documentSection) {
        documentSection.style.display = 'none';
    }

    // Hide vehicle recognition section by default
    const vehicleSection = document.getElementById('vehicleSection');
    if (vehicleSection) {
        vehicleSection.style.display = 'none';
    }

    // Hide map section by default
    const mapSection = document.getElementById('mapSection');
    if (mapSection) {
        mapSection.style.display = 'none';
    }

    // We no longer need the fixed navigation menu since we have the dropdown
    const navMenu = document.getElementById('featureNavigation');
    if (navMenu) {
        navMenu.remove();
    }
}

// Hide all advanced features
function hideAllFeatures() {
    const sectionsToHide = [
        'analyticsSection',
        'documentSection',
        'vehicleSection',
        'mapSection'
    ];

    sectionsToHide.forEach(sectionId => {
        const section = document.getElementById(sectionId);
        if (section) {
            section.style.display = 'none';
        }
    });

    // Remove navigation menu if exists
    const navMenu = document.getElementById('featureNavigation');
    if (navMenu) {
        navMenu.remove();
    }
}

// Create navigation menu for features
function createNavigationMenu() {
    // Check if navigation already exists
    if (document.getElementById('featureNavigation')) {
        return;
    }

    const nav = document.createElement('div');
    nav.id = 'featureNavigation';
    nav.className = 'feature-navigation';
    nav.innerHTML = `
        <div class="nav-header">
            <h3>📋 Features</h3>
        </div>
        <div class="nav-items">
            <button class="nav-item" onclick="scrollToSection('main-content')">
                <span class="nav-icon">🏠</span>
                <span class="nav-label">Home</span>
            </button>
            <button class="nav-item" onclick="scrollToSection('analyticsSection')">
                <span class="nav-icon">📊</span>
                <span class="nav-label">Analytics</span>
            </button>
            <button class="nav-item" onclick="scrollToSection('documentSection')">
                <span class="nav-icon">📄</span>
                <span class="nav-label">Documents</span>
            </button>
            <button class="nav-item" onclick="scrollToSection('vehicleSection')">
                <span class="nav-icon">🚗</span>
                <span class="nav-label">Vehicle Scan</span>
            </button>
            <button class="nav-item" onclick="scrollToSection('mapSection')">
                <span class="nav-icon">🗺️</span>
                <span class="nav-label">Map</span>
            </button>
        </div>
    `;

    document.body.appendChild(nav);
}

// Scroll to section
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Fetch and populate analytics from server
async function populateAnalytics() {
    try {
        const response = await fetch('/api/analytics');
        const data = await response.json();
        
        // Update stats from server data
        document.getElementById('todayViolations').textContent = data.todayViolations || '0';
        document.getElementById('weekViolations').textContent = calculateWeeklyTotal(data);
        document.getElementById('totalFinesCollected').textContent = `₹${(data.totalFines || 0).toLocaleString('en-IN')}`;
        document.getElementById('activeOfficers').textContent = data.activeOfficers || '0';

        // Initialize charts with real data
        if (typeof Chart !== 'undefined') {
            initializeCharts(data.violationBreakdown || {});
        }
    } catch (error) {
        console.error('Error fetching analytics:', error);
        // Fallback to zero values
        document.getElementById('todayViolations').textContent = '0';
        document.getElementById('weekViolations').textContent = '0';
        document.getElementById('totalFinesCollected').textContent = '₹0';
        document.getElementById('activeOfficers').textContent = '0';
    }
}

// Helper to calculate weekly total (simplified - using today's data * 7 for demo)
function calculateWeeklyTotal(data) {
    return (data.todayViolations || 0) * 7;
}

// Initialize charts with real data
function initializeCharts(violationData = {}) {
    // Convert violation breakdown to chart data
    const labels = Object.keys(violationData);
    const data = Object.values(violationData);
    
    // Fallback if no data
    const fallbackLabels = ['No Helmet', 'Over-speeding', 'Signal Jump', 'No Seatbelt', 'Mobile Use'];
    const fallbackData = [0, 0, 0, 0, 0];
    
    // Violation Type Chart
    const violationTypeCtx = document.getElementById('violationTypeChart');
    if (violationTypeCtx && !violationTypeCtx.chart) {
        violationTypeCtx.chart = new Chart(violationTypeCtx, {
            type: 'doughnut',
            data: {
                labels: labels.length > 0 ? labels : fallbackLabels,
                datasets: [{
                    data: data.length > 0 ? data : fallbackData,
                    backgroundColor: [
                        '#6366f1',
                        '#ec4899',
                        '#10b981',
                        '#f59e0b',
                        '#ef4444',
                        '#8b5cf6',
                        '#06b6d4'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#f1f5f9' }
                    }
                }
            }
        });
    }

    // Violation Time Chart (simplified - using today's data as baseline)
    const violationTimeCtx = document.getElementById('violationTimeChart');
    if (violationTimeCtx && !violationTimeCtx.chart) {
        const totalToday = data.reduce((a, b) => a + b, 0);
        const weekData = Array(7).fill(0).map(() => Math.floor(totalToday * (0.8 + Math.random() * 0.4)));
        
        violationTimeCtx.chart = new Chart(violationTimeCtx, {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Violations',
                    data: weekData,
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        labels: { color: '#f1f5f9' }
                    }
                },
                scales: {
                    y: {
                        ticks: { color: '#cbd5e1' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    x: {
                        ticks: { color: '#cbd5e1' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    }
                }
            }
        });
    }
}

// Map initialization consolidated in app.js

// Helper to get demo markers for different cities
function getDemoMarkersForCity(city) {
    const coords = (typeof cityCoordinates !== 'undefined' && cityCoordinates[city])
        ? cityCoordinates[city]
        : [23.5880, 72.3693];

    return [
        { lat: coords[0] + 0.005, lng: coords[1] + 0.005, desc: `No Helmet - ${city} Center` },
        { lat: coords[0] - 0.010, lng: coords[1] - 0.015, desc: `Over-speeding - ${city} Suburb` },
        { lat: coords[0] + 0.012, lng: coords[1] - 0.008, desc: `Signal Jump - ${city} Junction` }
    ];
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `login-notification ${type}`;
    notification.innerHTML = `
        <span class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
        <span class="notification-text">${message}</span>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 100);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ===================================
// Landing Page Event Listeners
// ===================================
document.addEventListener('DOMContentLoaded', () => {
    // Auto-detect city (Disabled to keep Mehsana as default)
    // detectCityFromISP();

    // Landing page login button
    const landingLoginBtn = document.getElementById('landingLoginBtn');
    if (landingLoginBtn) {
        landingLoginBtn.addEventListener('click', handleLandingLogin);
    }

    // Landing page Enter key support
    const landingUsername = document.getElementById('landingUsername');
    const landingPassword = document.getElementById('landingPassword');
    if (landingUsername && landingPassword) {
        landingPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleLandingLogin();
            }
        });
    }

    // Landing page biometric button
    const landingBiometricBtn = document.getElementById('landingBiometricBtn');
    if (landingBiometricBtn) {
        landingBiometricBtn.addEventListener('click', handleBiometricLogin);
    }

    // Landing page fingerprint display
    const landingFingerprint = document.getElementById('landingFingerprint');
    if (landingFingerprint) {
        landingFingerprint.addEventListener('click', handleBiometricLogin);
    }

    // Show register link
    const showRegisterLink = document.getElementById('showRegisterLink');
    if (showRegisterLink) {
        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            showRegisterModal();
        });
    }
});

// Handle landing page login
function handleLandingLogin() {
    const username = document.getElementById('landingUsername').value.trim();
    const password = document.getElementById('landingPassword').value;

    if (!username || !password) {
        showNotification('Please enter both username and password', 'error');
        return;
    }

    // Check credentials (demo mode)
    if (username === demoCredentials.username && password === demoCredentials.password) {
        const selectedCity = detectedCity || 'Mehsana';
        // Successful login
        performLogin({
            name: 'Traffic Officer',
            badge: 'TO-001',
            username: username,
            city: selectedCity
        });
        closeLoginModal();
    } else {
        // Check registered officers
        const registeredOfficers = JSON.parse(localStorage.getItem('registeredOfficers') || '[]');
        const officer = registeredOfficers.find(o => o.username === username && o.password === password);

        if (officer) {
            performLogin({
                name: officer.fullName,
                badge: officer.badgeNumber,
                username: officer.username,
                email: officer.email,
                phone: officer.phone,
                city: officer.city || detectedCity || 'Mehsana'
            });
        } else {
            showNotification('Invalid credentials. Try demo: officer / rto123', 'error');
        }
    }
}

// ===================================
// Officer Registration System
// ===================================

// Show register modal
function showRegisterModal() {
    // Create modal if it doesn't exist
    let modal = document.getElementById('registerModal');
    if (!modal) {
        modal = createRegisterModal();
        document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
}

// Create register modal
function createRegisterModal() {
    const modal = document.createElement('div');
    modal.id = 'registerModal';
    modal.className = 'modal';
    modal.style.display = 'none';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>👮 Officer Registration</h2>
            </div>
            <div class="modal-body">
                <p style="color: var(--text-muted); margin-bottom: var(--spacing-lg);">
                    Register a new officer account to access the RTO Face Scan system.
                </p>
                
                <div class="form-group">
                    <label class="form-label">Full Name *</label>
                    <input type="text" id="regFullName" class="form-input" placeholder="Enter full name" required>
                </div>

                <div class="form-group">
                    <label class="form-label">Badge Number *</label>
                    <input type="text" id="regBadgeNumber" class="form-input" placeholder="e.g., TO-001" required>
                </div>

                <div class="form-group">
                    <label class="form-label">Email Address *</label>
                    <input type="email" id="regEmail" class="form-input" placeholder="officer@rto.gov.in" required>
                </div>

                <div class="form-group">
                    <label class="form-label">Phone Number *</label>
                    <input type="tel" id="regPhone" class="form-input" placeholder="+91 XXXXX XXXXX" required>
                </div>

                <div class="form-group">
                    <label class="form-label">Department</label>
                    <select id="regDepartment" class="form-input">
                        <option value="Traffic Enforcement">Traffic Enforcement</option>
                        <option value="Vehicle Registration">Vehicle Registration</option>
                        <option value="License Verification">License Verification</option>
                        <option value="Challan Management">Challan Management</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">District *</label>
                    <select id="regCity" class="form-input" required>
                        <option value="">Select District</option>
                        ${Object.keys(gujaratData).sort().map(district => `<option value="${district}">${district}</option>`).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Username *</label>
                    <input type="text" id="regUsername" class="form-input" placeholder="Choose a username" required>
                </div>

                <div class="form-group">
                    <label class="form-label">Password *</label>
                    <input type="password" id="regPassword" class="form-input" placeholder="Choose a strong password" required>
                </div>

                <div class="form-group">
                    <label class="form-label">Confirm Password *</label>
                    <input type="password" id="regConfirmPassword" class="form-input" placeholder="Re-enter password" required>
                </div>

                <!-- Face Enrollment Mockup -->
                <!-- Fingerprint Enrollment Mockup -->
                <div class="form-group">
                    <label class="form-label">Fingerprint Authentication</label>
                    <div id="fingerEnrollmentContainer" style="background: var(--bg-secondary); border: 2px dashed rgba(99, 102, 241, 0.4); border-radius: var(--radius-md); padding: var(--spacing-md); text-align: center; cursor: pointer;">
                        <span id="fingerEnrollmentStatus" style="font-size: 0.9rem; color: var(--text-muted); display: flex; flex-direction: column; align-items: center; gap: 8px;">
                            <span style="font-size: 2rem;">👆</span>
                            <span>Click to scan finger for enrollment</span>
                        </span>
                    </div>
                    <input type="hidden" id="fingerEnrollmentData" value="enrolled">
                </div>

                <div style="background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: var(--radius-md); padding: var(--spacing-md); margin-top: var(--spacing-md);">
                    <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0;">
                        <strong>Note:</strong> All officer registrations are stored locally in your browser for demonstration purposes.
                    </p>
                </div>
            </div>
            <div class="modal-footer">
                <button id="cancelRegisterBtn" class="btn btn-secondary">
                    <span>❌</span>
                    <span>Cancel</span>
                </button>
                <button id="submitRegisterBtn" class="btn btn-primary">
                    <span>✅</span>
                    <span>Register Officer</span>
                </button>
            </div>
        </div >
        `;

    // Add event listeners

    modal.querySelector('#cancelRegisterBtn').addEventListener('click', () => {
        modal.style.display = 'none';
    });

    modal.querySelector('#submitRegisterBtn').addEventListener('click', handleOfficerRegistration);

    // Fingerprint Enrollment Mockup Interaction
    const fingerContainer = modal.querySelector('#fingerEnrollmentContainer');
    const fingerStatus = modal.querySelector('#fingerEnrollmentStatus');
    if (fingerContainer) {
        fingerContainer.addEventListener('click', () => {
            fingerStatus.innerHTML = '<span style="font-size: 2rem;">✅</span><span style="color: var(--success-color);">Fingerprint captured and encrypted!</span>';
            fingerContainer.style.borderColor = 'var(--success-color)';
            fingerContainer.style.background = 'rgba(16, 185, 129, 0.1)';
            showNotification('Fingerprint enrolled successfully', 'success');
        });
    }

    // Close on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    return modal;
}

// Handle officer registration
function handleOfficerRegistration() {
    // Get form values
    const fullName = document.getElementById('regFullName').value.trim();
    const badgeNumber = document.getElementById('regBadgeNumber').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const department = document.getElementById('regDepartment').value;
    const city = document.getElementById('regCity').value;
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;

    // Validation
    if (!fullName || !badgeNumber || !email || !phone || !username || !password || !city) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return;
    }

    if (password.length < 6) {
        showNotification('Password must be at least 6 characters', 'error');
        return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showNotification('Please enter a valid email address', 'error');
        return;
    }

    // Check if username already exists
    const registeredOfficers = JSON.parse(localStorage.getItem('registeredOfficers') || '[]');
    if (registeredOfficers.some(o => o.username === username)) {
        showNotification('Username already exists. Please choose another.', 'error');
        return;
    }

    // Create new officer
    const newOfficer = {
        fullName,
        badgeNumber,
        email,
        phone,
        department,
        city,
        username,
        password,
        registeredDate: new Date().toISOString()
    };

    // Save to localStorage
    registeredOfficers.push(newOfficer);
    localStorage.setItem('registeredOfficers', JSON.stringify(registeredOfficers));

    // Close modal
    document.getElementById('registerModal').style.display = 'none';

    // Show success message
    showNotification(`Officer ${fullName} registered successfully!`, 'success');

    // Clear form
    document.getElementById('regFullName').value = '';
    document.getElementById('regBadgeNumber').value = '';
    document.getElementById('regEmail').value = '';
    document.getElementById('regPhone').value = '';
    document.getElementById('regUsername').value = '';
    document.getElementById('regPassword').value = '';
    document.getElementById('regConfirmPassword').value = '';
}
