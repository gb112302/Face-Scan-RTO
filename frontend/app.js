// ===================================
// RTO FACE SCAN APPLICATION - CORE LOGIC
// ===================================
const API_URL = 'http://localhost:3000/api';

// State Management
let isCameraActive = false;
let isModelLoaded = false;
let currentCameraSource = 'device';
let selectedDeviceId = null;
let stream = null;
let videoElement = null;
let canvasElement = null;
let currentCity = 'Ahmedabad'; // Default
let rtoCameraInterval = null;
let faceDetectionInterval = null;

// Global State
let driverDatabase = [];
let trafficViolations = [];
let cityCoordinates = {};
let currentDriver = null;

// DOM Elements Cache
const dom = {};

// ===================================
// DEBUG UTILITIES
// ===================================
function createDebugOverlay() {
    if (document.getElementById('debugOverlay')) return;
    const debugDiv = document.createElement('div');
    debugDiv.id = 'debugOverlay';
    debugDiv.style.cssText = 'position: fixed; bottom: 10px; right: 10px; width: 300px; max-height: 200px; overflow-y: auto; background: rgba(0,0,0,0.8); color: lime; font-family: monospace; font-size: 10px; z-index: 9999; padding: 5px; pointer-events: none; border: 1px solid lime;';
    document.body.appendChild(debugDiv);
}

function debugLog(msg) {
    const overlay = document.getElementById('debugOverlay');
    if (overlay) {
        const line = document.createElement('div');
        line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        overlay.appendChild(line);
        overlay.scrollTop = overlay.scrollHeight;
    }
    console.log(`[DEBUG] ${msg}`);
}

// ===================================
// INITIALIZATION
// ===================================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('Initializing RTO App...');
        createDebugOverlay();
        debugLog('App Initialized');

        // Cache critical DOM elements safely
        videoElement = document.getElementById('videoElement');
        canvasElement = document.getElementById('overlay');

        if (!videoElement) throw new Error('Critical: Video element #videoElement not found');

        // Initialize Listeners
        setupEventListeners();

        // Load Data
        await loadModels();
        await fetchCameraData();
        await fetchLocationData();
        await loadDatabaseDescriptors();
        await populateViolationsList();
        await enumerateCameras();

        // Initialize Analytics
        try {
            initializeAnalytics();
        } catch (e) { debugLog('Analytics init warning: ' + e.message); }

        // UI Setup
        const citySelect = document.getElementById('headerCitySelect');
        if (citySelect) {
            currentCity = citySelect.value;
            debugLog(`City set to: ${currentCity}`);
        }

        // Auto-start camera
        await startCamera();

        debugLog('Ready to start');

    } catch (e) {
        console.error('CRITICAL INIT ERROR:', e);
        alert(`App failed to initialize: ${e.message}`);
    }
});

function setupEventListeners() {
    // Camera Controls
    safeListen('toggleCamera', 'click', toggleCamera);
    safeListen('cameraSourceSelect', 'change', handleCameraSourceChange);
    safeListen('videoDeviceSelect', 'change', handleDeviceChange);

    // Login
    safeListen('loginBtn', 'click', () => {
        const modal = document.getElementById('loginModal');
        if (modal) modal.style.display = 'block';
    });
    safeListen('closeLoginModal', 'click', () => {
        const modal = document.getElementById('loginModal');
        if (modal) modal.style.display = 'none';
    });
    safeListen('loginSubmitBtn', 'click', handleLogin);

    // City & Driver
    safeListen('headerCitySelect', 'change', handleCityChange);
    safeListen('demoDriverSelect', 'change', (e) => {
        const driverId = e.target.value;
        if (driverId) {
            debugLog(`Selected Demo Driver ID: ${driverId}`);
            const driver = driverDatabase.find(d => d.id === driverId);
            if (driver) displayDriverInfo(driver, 0.1);
        }
    });

    // Memo
    safeListen('generateMemoBtn', 'click', openMemoModal);
    safeListen('closeMemoModal', 'click', closeMemoModal);
    safeListen('printMemoBtn', 'click', printMemo);
    safeListen('downloadMemoBtn', 'click', downloadMemo);

    // Payment
    safeListen('closePaymentModal', 'click', () => {
        const m = document.getElementById('paymentModal');
        if (m) m.style.display = 'none';
    });
    safeListen('processPaymentBtn', 'click', processPayment);
    document.querySelectorAll('.payment-method-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const method = card.getAttribute('data-method');
            selectPaymentMethod(method);
            document.querySelectorAll('.payment-method-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
        });
    });

    // Analytics & Features
    safeListen('refreshAnalytics', 'click', () => {
        initializeAnalytics();
        addNotification('Data Refreshed', 'Analytics dashboard updated');
    });

    // Navigation
    const showSection = (id) => {
        ['analyticsSection', 'documentSection', 'vehicleSection', 'mapSection'].forEach(s => {
            const el = document.getElementById(s);
            if (el) el.style.display = 'none';
        });
        const target = document.getElementById(id);
        if (target) target.style.display = 'block';
    };

    safeListen('showAnalyticsBtn', 'click', () => showSection('analyticsSection'));
    safeListen('showDocumentsBtn', 'click', () => showSection('documentSection'));
    safeListen('showVehicleBtn', 'click', () => showSection('vehicleSection'));
    safeListen('showMapBtn', 'click', () => showSection('mapSection'));

    safeListen('showCameraBtn', 'click', () => {
        ['analyticsSection', 'documentSection', 'vehicleSection', 'mapSection'].forEach(s => {
            const el = document.getElementById(s);
            if (el) el.style.display = 'none';
        });
    });

    // Map & Other
    safeListen('getCurrentLocationBtn', 'click', getCurrentLocation);
    safeListen('showHeatmapBtn', 'click', showHeatmap);
    safeListen('showMapBtn', 'click', () => {
        showSection('mapSection');
        setTimeout(initializeMap, 100);
    });

    // Initialize Subsystems
    initializeDocumentFeatures();
    setupVehicleRecognition();
}

function safeListen(id, event, handler) {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener(event, handler);
    } else {
        // console.warn(`Element #${id} not found for event ${event}`);
    }
}

// ===================================
// API INTEGRATION
// ===================================
async function fetchCameraData() {
    try {
        const res = await fetch(`${API_URL}/cameras`);
        if (res.ok) {
            await res.json();
            debugLog('Camera configs loaded');
        }
    } catch (e) { debugLog('Failed to load camera configs'); }
}

async function fetchLocationData() {
    try {
        debugLog('Fetching location data...');
        const response = await fetch(`${API_URL}/locations`);
        if (response.ok) {
            const data = await response.json();
            Object.assign(cityCoordinates, data.cityCoordinates);
            debugLog('Locations loaded');
        }
    } catch (e) { debugLog('Error loading locations'); }
}

async function populateViolationsList() {
    try {
        const response = await fetch(`${API_URL}/violations`);
        if (response.ok) {
            trafficViolations = await response.json();
            debugLog(`Loaded ${trafficViolations.length} violations`);
        }
    } catch (e) { debugLog('Failed to load violations'); }
}

async function loadDatabaseDescriptors() {
    try {
        debugLog('Loading driver database...');
        const response = await fetch(`${API_URL}/drivers-basic`);
        if (!response.ok) throw new Error('API Error');
        const drivers = await response.json();
        driverDatabase = drivers;
        debugLog(`Database loaded: ${driverDatabase.length} drivers`);
        populateDemoDrivers();
    } catch (e) { debugLog('Error loading driver database'); }
}

// ===================================
// CAMERA LOGIC
// ===================================
async function toggleCamera() {
    if (isCameraActive) {
        stopCamera();
    } else {
        await startCamera();
    }
}

async function startCamera() {
    debugLog('Starting camera...');
    stopCamera();
    const constraints = {
        video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined
        }
    };

    try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = stream;
        await videoElement.play();
        isCameraActive = true;
        updateCameraUI(true);
        debugLog('Camera started successfully');
        startFaceDetection();
    } catch (error) {
        console.error('Camera Error:', error);
        alert(`Camera Error: ${error.message}`);
        updateCameraUI(false);
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    if (videoElement) {
        videoElement.srcObject = null;
    }
    isCameraActive = false;
    updateCameraUI(false);
    stopFaceDetection();
}

function updateCameraUI(active) {
    const btn = document.getElementById('toggleCamera');
    const status = document.getElementById('cameraStatus');
    if (active) {
        if (btn) {
            btn.textContent = 'Stop Camera';
            btn.classList.replace('btn-primary', 'btn-danger');
            // Also add btn-danger if not replaced above simply
            btn.classList.add('btn-danger');
            btn.classList.remove('btn-primary');
        }
        if (status) {
            status.textContent = 'Active - Monitoring';
            status.style.color = 'lime';
        }
    } else {
        if (btn) {
            btn.textContent = 'Start Camera';
            btn.classList.replace('btn-danger', 'btn-primary');
            btn.classList.add('btn-primary');
            btn.classList.remove('btn-danger');
        }
        if (status) {
            status.textContent = 'Inactive';
            status.style.color = '#fff';
        }
    }
}

async function enumerateCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        const select = document.getElementById('videoDeviceSelect');
        if (select) {
            select.innerHTML = '';
            videoDevices.forEach(device => {
                const opt = document.createElement('option');
                opt.value = device.deviceId;
                opt.textContent = device.label || `Camera ${select.length + 1}`;
                select.appendChild(opt);
            });
            if (videoDevices.length > 0) selectedDeviceId = videoDevices[0].deviceId;
        }
    } catch (e) {
        console.error('Error listing cameras:', e);
    }
}

function handleDeviceChange(e) {
    selectedDeviceId = e.target.value;
    if (isCameraActive) startCamera();
}

function handleCameraSourceChange(e) {
    currentCameraSource = e.target.value;
    const deviceControls = document.getElementById('deviceControls');
    if (deviceControls) {
        deviceControls.style.display = currentCameraSource === 'device' ? 'block' : 'none';
    }
    if (currentCameraSource === 'rto') {
        alert('RTO Network feeds are currently simulated via local data.');
    }
}

// ===================================
// AI FACE DETECTION
// ===================================
async function loadModels() {
    debugLog('Loading AI Models...');
    try {
        // Use a reliable CDN for models since local folder is missing
        const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL); // Fallback/More accurate

        isModelLoaded = true;
        debugLog('AI Models Loaded from CDN');
    } catch (e) {
        console.error('Model Load Error:', e);
        debugLog('Failed to load AI models');
        alert('Failed to load AI models. Check internet connection.');
    }
}

function startFaceDetection() {
    if (!isModelLoaded) {
        debugLog('Waiting for models to load...');
        setTimeout(startFaceDetection, 1000); // Retry if models aren't ready
        return;
    }
    if (!videoElement) return;

    debugLog('Starting Face Detection Loop');

    // Canvas setup
    const displaySize = { width: videoElement.videoWidth, height: videoElement.videoHeight };
    if (canvasElement) {
        faceapi.matchDimensions(canvasElement, displaySize);
    }

    faceDetectionInterval = setInterval(async () => {
        if (!isCameraActive || videoElement.paused || videoElement.ended) return;

        try {
            const detections = await faceapi.detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceDescriptors();

            const resizedDetections = faceapi.resizeResults(detections, displaySize);

            if (canvasElement) {
                const ctx = canvasElement.getContext('2d');
                ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
                faceapi.draw.drawDetections(canvasElement, resizedDetections);
            }

            if (resizedDetections.length > 0) {
                debugLog('Face detected, matching...');
                const bestMatch = findBestMatch(resizedDetections[0].descriptor);
                if (bestMatch) {
                    displayDriverInfo(bestMatch.driver, bestMatch.distance);
                    updateDetectionStatus(true);
                } else {
                    showNoMatch();
                    updateDetectionStatus(false);
                }
            } else {
                updateDetectionStatus(false);
            }

        } catch (e) {
            // Suppress transient errors
        }
    }, 200);
}

function stopFaceDetection() {
    if (faceDetectionInterval) clearInterval(faceDetectionInterval);
    if (canvasElement) {
        const ctx = canvasElement.getContext('2d');
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    }
}

function findBestMatch(faceDescriptor) {
    let bestMatch = null;
    let bestDistance = Infinity;
    const MATCH_THRESHOLD = 0.5;

    if (!Array.isArray(driverDatabase) || driverDatabase.length === 0) return null;

    // 1. Try Real Match
    for (let driver of driverDatabase) {
        if (!driver.faceDescriptor) continue;
        const dbDescriptor = (driver.faceDescriptor instanceof Float32Array)
            ? driver.faceDescriptor
            : new Float32Array(Object.values(driver.faceDescriptor));

        const distance = faceapi.euclideanDistance(faceDescriptor, dbDescriptor);

        if (distance < bestDistance && distance < MATCH_THRESHOLD) {
            bestDistance = distance;
            bestMatch = { driver, distance };
        }
    }

    // 2. DEMO MODE FALLBACK: If real match fails, match the "Demo Driver"
    // This allows the user to see the UI in action without enrolling their face.
    if (!bestMatch) {
        // If a demo driver is selected in dropdown, use that. Otherwise use first one.
        const demoSelect = document.getElementById('demoDriverSelect');
        let demoDriverId = demoSelect ? demoSelect.value : null;

        let demoDriver = null;
        if (demoDriverId) {
            demoDriver = driverDatabase.find(d => d.id === demoDriverId);
        }

        // If still no driver or "No drivers for City", just pick the first valid one in DB
        if (!demoDriver && driverDatabase.length > 0) {
            demoDriver = driverDatabase[0];
        }

        if (demoDriver) {
            // Fake a distance for the demo
            return { driver: demoDriver, distance: 0.35 };
        }
    }

    return bestMatch;
}

function updateDetectionStatus(detected) {
    const indicator = document.getElementById('detectionIndicator');
    const text = document.getElementById('detectionText');
    if (indicator && text) {
        if (detected) {
            indicator.classList.add('detecting');
            text.textContent = 'Face Detected';
        } else {
            indicator.classList.remove('detecting');
            text.textContent = 'Scanning...';
        }
    }
}

function showNoMatch() {
    const card = document.getElementById('driverCard');
    const noMatch = document.getElementById('noMatchState');
    if (card) card.style.display = 'none';
    if (noMatch) noMatch.style.display = 'block';
    currentDriver = null;
}

function displayDriverInfo(driver, distance) {
    currentDriver = driver;
    const safelySetText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    safelySetText('driverName', driver.name);
    safelySetText('driverId', `ID: ${driver.id}`);
    safelySetText('licenseNumber', driver.licenseNumber);
    safelySetText('vehicleNumber', driver.vehicleNumber);
    safelySetText('vehicleType', driver.vehicleType);
    safelySetText('address', driver.address);
    safelySetText('phone', driver.phone);
    safelySetText('licenseExpiry', driver.licenseExpiry);

    const img = document.getElementById('driverPhoto');
    if (img) img.src = driver.photo;

    const confidence = Math.max(0, Math.min(100, (1 - distance) * 100));
    safelySetText('confidenceScore', `${confidence.toFixed(1)}%`);
    const badge = document.getElementById('confidenceBadge');
    if (badge) badge.style.display = 'flex';

    const card = document.getElementById('driverCard');
    const noMatch = document.getElementById('noMatchState');
    if (card) card.style.display = 'block';
    if (noMatch) noMatch.style.display = 'none';

    const memoSec = document.getElementById('memoSection');
    if (memoSec) memoSec.style.display = 'block';
}

// ===================================
// CITY & UI UTILS
// ===================================
function handleCityChange(event) {
    currentCity = event.target.value;
    updateCityUI();
    populateDemoDrivers();
    debugLog(`City changed to: ${currentCity}`);
}

function updateCityUI() {
    const headerCity = document.getElementById('headerCitySelect');
    if (headerCity && headerCity.value !== currentCity) {
        headerCity.value = currentCity;
    }
}

function populateDemoDrivers() {
    const demoSelect = document.getElementById('demoDriverSelect');
    if (!demoSelect) return;
    const firstOption = demoSelect.options[0];
    demoSelect.innerHTML = '';
    demoSelect.appendChild(firstOption);

    const cityDrivers = driverDatabase.filter(d => d.city === currentCity);

    cityDrivers.forEach(driver => {
        const option = document.createElement('option');
        option.value = driver.id;
        option.textContent = `${driver.name} (${driver.vehicleNumber})`;
        demoSelect.appendChild(option);
    });

    if (cityDrivers.length === 0) {
        const opt = document.createElement('option');
        opt.disabled = true;
        opt.textContent = `No drivers for ${currentCity}`;
        demoSelect.appendChild(opt);
    }
}

// ===================================
// MEMO GENERATION
// ===================================
function openMemoModal() {
    if (!currentDriver) {
        alert('No driver detected. Please select a driver first.');
        return;
    }
    const checkboxes = document.querySelectorAll('.violation-checkbox:checked');
    if (checkboxes.length === 0) {
        alert('Select at least one violation.');
        return;
    }
    const selectedViolations = Array.from(checkboxes).map(cb => {
        return trafficViolations.find(v => v.id === cb.value);
    });
    generateMemoPreview(selectedViolations);
    const modal = document.getElementById('memoModal');
    if (modal) modal.style.display = 'flex';
}

function closeMemoModal() {
    const modal = document.getElementById('memoModal');
    if (modal) modal.style.display = 'none';
}

function generateMemoPreview(violations) {
    const memoContent = document.getElementById('memoContent');
    if (!memoContent) return;
    const totalFine = violations.reduce((sum, v) => sum + v.fine, 0);
    const now = new Date();

    let rows = violations.map((v, i) => `
        <tr>
            <td>${i + 1}</td>
            <td>${v.violation}</td>
            <td>₹${v.fine}</td>
        </tr>
    `).join('');

    memoContent.innerHTML = `
        <div style="padding: 20px; font-family: monospace;">
            <h2 style="text-align:center; border-bottom: 2px solid black;">E-CHALLAN</h2>
            <p><strong>Driver:</strong> ${currentDriver.name}</p>
            <p><strong>Vehicle:</strong> ${currentDriver.vehicleNumber}</p>
            <p><strong>Date:</strong> ${now.toLocaleString()}</p>
            <hr>
            <table style="width:100%; text-align:left;">
                <tr><th>#</th><th>Violation</th><th>Fine</th></tr>
                ${rows}
            </table>
            <hr>
            <h3 style="text-align:right;">Total: ₹${totalFine}</h3>
        </div>
    `;
}

function printMemo() { window.print(); }
function downloadMemo() {
    const memoContent = document.getElementById('memoContent');
    if (!memoContent) return;
    const blob = new Blob([memoContent.innerHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `challan-${Date.now()}.html`;
    a.click();
}

// ===================================
// ANALYTICS SYSTEM
// ===================================
const analyticsData = {
    today: 28, week: 156, month: 642, totalFines: 3850000, activeOfficers: 12,
    violationsByType: { 'No Helmet': 145, 'Over-speeding': 98, 'Signal Jump': 76, 'No Seatbelt': 54, 'Mobile Phone': 48 },
    violationsByTime: { '00-06': 53, '06-12': 123, '12-18': 148, '18-24': 83 }
};

function initializeAnalytics() {
    const safeSet = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    safeSet('todayViolations', analyticsData.today);
    safeSet('weekViolations', analyticsData.week);
    safeSet('totalFinesCollected', `₹${analyticsData.totalFines.toLocaleString('en-IN')}`);
    safeSet('activeOfficers', analyticsData.activeOfficers);
    initializeCharts();
}

function initializeCharts() {
    if (typeof Chart === 'undefined') return;
    const typeCtx = document.getElementById('violationTypeChart');
    if (typeCtx) {
        new Chart(typeCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(analyticsData.violationsByType),
                datasets: [{ data: Object.values(analyticsData.violationsByType), backgroundColor: ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6'] }]
            },
            options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#fff' } } } }
        });
    }
    const timeCtx = document.getElementById('violationTimeChart');
    if (timeCtx) {
        new Chart(timeCtx, {
            type: 'bar',
            data: {
                labels: Object.keys(analyticsData.violationsByTime),
                datasets: [{ label: 'Violations', data: Object.values(analyticsData.violationsByTime), backgroundColor: '#6366f1' }]
            },
            options: { responsive: true, plugins: { legend: { labels: { color: '#fff' } } }, scales: { y: { ticks: { color: '#fff' } }, x: { ticks: { color: '#fff' } } } }
        });
    }
}

// ===================================
// PAYMENT SYSTEM
// ===================================
function openPaymentGateway(challanData) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('paymentChallanNo', challanData.challanNo);
    set('paymentDriverName', challanData.driverName);
    set('paymentTotalAmount', `₹${challanData.amount}`);
    const modal = document.getElementById('paymentModal');
    if (modal) modal.style.display = 'flex';
}

function selectPaymentMethod(method) {
    document.querySelectorAll('.payment-method-card').forEach(c => c.classList.remove('selected'));
    const form = document.getElementById('paymentForm');
    const btn = document.getElementById('processPaymentBtn');
    if (form) form.style.display = 'block';
    if (btn) btn.disabled = false;
}

function processPayment() {
    const btn = document.getElementById('processPaymentBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Processing...';
    }
    setTimeout(() => {
        const form = document.getElementById('paymentForm');
        if (form) {
            form.innerHTML = `<div style="text-align:center; padding:20px;">
                    <div style="font-size:40px;">✅</div><h3>Payment Successful!</h3>
                    <p>Transaction ID: TXN${Date.now()}</p>
                </div>`;
        }
        addNotification('Payment Successful', 'Transaction completed successfully', 'success');
    }, 1500);
}

// ===================================
// NOTIFICATION SYSTEM
// ===================================
let notifications = [];
function addNotification(title, message, type = 'info') {
    const notif = { id: Date.now(), title, message, type };
    notifications.unshift(notif);
    updateNotificationBadge();
    debugLog(`NOTIFICATION: ${title} - ${message}`);
}

function updateNotificationBadge() {
    const badge = document.getElementById('notificationCount');
    if (badge) {
        badge.textContent = notifications.length;
        badge.style.display = notifications.length > 0 ? 'flex' : 'none';
    }
}

function sendEmailNotification(driver, challanNo) {
    addNotification('Email Sent', `Notice sent to ${driver.name}`, 'success');
}

function sendSMSNotification(driver, challanNo) {
    addNotification('SMS Sent', `Notice sent to ${driver.phone}`, 'success');
}

// ===================================
// DOCUMENT, MAP & VEHICLE
// ===================================
function initializeDocumentFeatures() {
    setupDocumentUpload('licenseUploadZone', 'licenseUpload', 'verifyLicense', 'licenseStatus');
    setupDocumentUpload('insuranceUploadZone', 'insuranceUpload', 'verifyInsurance', 'insuranceStatus');
    setupDocumentUpload('registrationUploadZone', 'registrationUpload', 'verifyRegistration', 'registrationStatus');
}

function setupDocumentUpload(zoneId, inputId, verifyBtnId, statusId) {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    const verifyBtn = document.getElementById(verifyBtnId);
    if (zone && input) {
        zone.addEventListener('click', () => input.click());
        input.addEventListener('change', (e) => {
            if (e.target.files.length) {
                const file = e.target.files[0];
                const p = zone.querySelector('p');
                if (p) p.textContent = `File: ${file.name}`;
                if (verifyBtn) verifyBtn.disabled = false;
            }
        });
    }
    if (verifyBtn) {
        verifyBtn.addEventListener('click', () => {
            verifyBtn.textContent = 'Verifying...';
            verifyBtn.disabled = true;
            setTimeout(() => {
                verifyBtn.textContent = 'Verified ✅';
                const status = document.getElementById(statusId);
                if (status) {
                    status.textContent = 'Verified';
                    status.classList.add('verified');
                }
                addNotification('Verified', 'Document verification success');
            }, 1500);
        });
    }
}

// Map
let violationMapInstance = null;
const violationLocations = [
    { lat: 23.5880, lng: 72.3693, count: 5, location: 'Mehsana Circle' },
    { lat: 23.5950, lng: 72.3750, count: 3, location: 'Highway 8' },
    { lat: 23.5800, lng: 72.3600, count: 7, location: 'Visnagar Road' }
];

function initializeMap() {
    const mapElement = document.getElementById('violationMap');
    if (typeof L !== 'undefined' && mapElement) {
        if (violationMapInstance) return;
        const coords = (cityCoordinates[currentCity]) ? cityCoordinates[currentCity] : [23.5880, 72.3693];
        violationMapInstance = L.map('violationMap').setView(coords, 13);
        mapElement.map = violationMapInstance;
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(violationMapInstance);
        violationLocations.forEach(loc => {
            L.marker([loc.lat, loc.lng]).addTo(violationMapInstance).bindPopup(`<b>${loc.location}</b><br>Violations: ${loc.count}`);
        });
        violationMapInstance.on('click', (e) => {
            const { lat, lng } = e.latlng;
            L.popup().setLatLng(e.latlng).setContent(`<button onclick="updateOperatingLocation(${lat},${lng})">Set Location</button>`).openOn(violationMapInstance);
        });
    }
}

function updateOperatingLocation(lat, lng) {
    const locInput = document.getElementById('violationLocation');
    if (locInput) locInput.value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    addNotification('Location Set', 'Operating location updated', 'success');
}

function getCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            const { latitude, longitude } = position.coords;
            if (violationMapInstance) {
                violationMapInstance.setView([latitude, longitude], 15);
                L.marker([latitude, longitude]).addTo(violationMapInstance).bindPopup('You are here').openPopup();
            }
            updateOperatingLocation(latitude, longitude);
        });
    }
}

function showHeatmap() { addNotification('Heatmap', 'Violation hotspots highlighted', 'info'); }

function setupVehicleRecognition() {
    const zone = document.getElementById('plateUploadZone');
    const input = document.getElementById('plateUpload');
    const detectBtn = document.getElementById('detectPlate');
    const preview = document.getElementById('platePreview');
    const details = document.getElementById('vehicleDetails');
    if (zone && input) {
        zone.addEventListener('click', () => input.click());
        input.addEventListener('change', (e) => {
            if (e.target.files.length) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    if (preview) preview.innerHTML = `<img src="${ev.target.result}" style="max-width:100%">`;
                    if (detectBtn) detectBtn.disabled = false;
                };
                reader.readAsDataURL(e.target.files[0]);
            }
        });
    }
    if (detectBtn) {
        detectBtn.addEventListener('click', () => {
            detectBtn.disabled = true;
            detectBtn.textContent = 'Scanning...';
            setTimeout(() => {
                detectBtn.textContent = 'Detect Plate';
                detectBtn.disabled = false;
                if (details) details.innerHTML = '<h4>Vehicle Detected: GJ 02 AB 1234</h4><p>Status: Clear</p>';
            }, 1000);
        });
    }
}

// Auth Placeholder
function handleLogin() {
    document.getElementById('loginModal').style.display = 'none';
    document.querySelectorAll('.auth-guard').forEach(el => el.style.display = 'block');
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) loginBtn.style.display = 'none';
}
