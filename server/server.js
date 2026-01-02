const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./database');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend'))); // Serve frontend files from ../frontend

// ==========================================
// API Routes
// ==========================================

// Login API
app.post('/api/login', (req, res) => {
    const { officerId, password } = req.body;
    
    // Simple mock auth for now (as per original app logic)
    // In production, use hashed passwords in DB
    if (officerId && password) {
        res.json({
            success: true,
            officer: {
                id: officerId,
                name: "Inspector Vikram Singh",
                badgeNumber: officerId,
                rank: "Senior Inspector",
                station: "RTO Main Station"
            }
        });
    } else {
        res.status(401).json({ success: false, message: "Invalid credentials" });
    }
});

// Get Violations
app.get('/api/violations', (req, res) => {
    db.all("SELECT * FROM violations", [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Get Driver by ID
app.get('/api/drivers/:id', (req, res) => {
    const id = req.params.id;
    db.get("SELECT * FROM drivers WHERE id = ?", [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (row) {
            res.json(row);
        } else {
            res.status(404).json({ message: "Driver not found" });
        }
    });
});

// GetAll Drivers (for localized face matching initialization)
// In a real large-scale system, we wouldn't send ALL drivers. 
// We'd send embeddings to a vector DB or do server-side matching.
// For this local app, sending minimal info for client-side matcher is fine.
app.get('/api/drivers-basic', (req, res) => {
    db.all("SELECT id, name, photo, faceDescriptor FROM drivers", [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        // Parse faceDescriptor JSON string back to array/object if needed
        const drivers = rows.map(d => ({
            ...d,
            faceDescriptor: d.faceDescriptor ? JSON.parse(d.faceDescriptor) : null
        }));
        res.json(drivers);
    });
});

// Save Memo (E-Challan)
app.post('/api/memos', (req, res) => {
    const { driverId, officerId, location, violations, totalFine } = req.body;
    const date = new Date().toISOString();
    const memoId = `MEMO-${Date.now()}`;

    const stmt = db.prepare(`
        INSERT INTO memos (id, driverId, officerId, location, violations, totalFine, date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([memoId, driverId, officerId, location, JSON.stringify(violations), totalFine, date], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ 
            success: true, 
            message: "Memo generated successfully",
            memo: { id: memoId, date, totalFine }
        });
    });
    stmt.finalize();
});

// Get Driver History
app.get('/api/memos/driver/:driverId', (req, res) => {
    const driverId = req.params.driverId;
    db.all("SELECT * FROM memos WHERE driverId = ? ORDER BY date DESC", [driverId], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        const memos = rows.map(m => ({
            ...m,
            violations: JSON.parse(m.violations)
        }));
        res.json(memos);
    });
});

// Get Locations (Districts and Cities)
app.get('/api/locations', (req, res) => {
    db.all("SELECT * FROM districts ORDER BY name", [], (err, districts) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.all("SELECT * FROM cities ORDER BY name", [], (err, cities) => {
            if (err) return res.status(500).json({ error: err.message });
            
            // Structure data as hierarchy: { District: [City1, City2], ... }
            const gujaratData = {};
            const cityCoordinates = {};
            
            districts.forEach(d => {
                gujaratData[d.name] = [];
            });
            
            cities.forEach(c => {
                const district = districts.find(d => d.id === c.district_id);
                if (district) {
                    gujaratData[district.name].push(c.name);
                    if (c.latitude && c.longitude) {
                        cityCoordinates[c.name] = [c.latitude, c.longitude];
                    }
                }
            });
            
            res.json({ gujaratData, cityCoordinates });
        });
    });
});

// Get Cameras
app.get('/api/cameras', (req, res) => {
    db.all("SELECT * FROM cameras", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const rtoCameraFeeds = {};
        const cameraNames = {};
        
        rows.forEach(row => {
            rtoCameraFeeds[row.id] = JSON.parse(row.feeds);
            cameraNames[row.id] = row.name;
        });
        
        res.json({ rtoCameraFeeds, cameraNames });
    });
});

// Enhanced Memo Creation with Server-Side Validation
app.post('/api/memos', (req, res) => {
    const { driverId, officerId, officerName, location, violations, paymentStatus } = req.body;
    
    // Server-side validation
    if (!driverId || !officerId || !violations || violations.length === 0) {
        return res.status(400).json({ 
            success: false, 
            error: 'Missing required fields: driverId, officerId, or violations' 
        });
    }

    const date = new Date().toISOString();
    const memoId = `MEMO-${Date.now()}`;
    
    // Calculate total fine server-side
    const totalFine = violations.reduce((sum, v) => sum + (v.fine || 0), 0);

    const stmt = db.prepare(`
        INSERT INTO memos (id, driverId, officerId, officerName, location, violations, totalFine, paymentStatus, date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
        memoId, 
        driverId, 
        officerId, 
        officerName || 'Unknown Officer',
        location || 'Unknown Location', 
        JSON.stringify(violations), 
        totalFine,
        paymentStatus || 'pending',
        date
    ], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        // Update analytics after new memo
        updateAnalytics();
        
        res.json({ 
            success: true, 
            message: "Memo generated successfully",
            memo: { id: memoId, date, totalFine, paymentStatus: paymentStatus || 'pending' }
        });
    });
    stmt.finalize();
});

// Get Analytics (Computed from Database)
app.get('/api/analytics', (req, res) => {
    // Get latest analytics or compute fresh
    db.get("SELECT * FROM analytics ORDER BY updated_at DESC LIMIT 1", [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (row) {
            // Return cached analytics
            res.json({
                todayViolations: row.total_violations,
                totalFines: row.total_fines,
                activeOfficers: row.active_officers,
                violationBreakdown: JSON.parse(row.violation_breakdown),
                paymentStats: JSON.parse(row.payment_stats),
                lastUpdated: row.updated_at
            });
        } else {
            // Compute fresh if no cache exists
            computeAndReturnAnalytics(res);
        }
    });
});

// Refresh Analytics (Force Recalculation)
app.get('/api/analytics/refresh', (req, res) => {
    updateAnalytics();
    computeAndReturnAnalytics(res);
});

// Helper function to compute analytics
function computeAndReturnAnalytics(res) {
    const today = new Date().toISOString().split('T')[0];
    
    db.all("SELECT * FROM memos WHERE date LIKE ?", [`${today}%`], (err, memos) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const totalViolations = memos.length;
        const totalFines = memos.reduce((sum, m) => sum + m.totalFine, 0);
        
        // Count unique officers
        const uniqueOfficers = new Set(memos.map(m => m.officerId)).size;
        
        // Violation breakdown
        const violationMap = {};
        memos.forEach(m => {
            const violations = JSON.parse(m.violations);
            violations.forEach(v => {
                violationMap[v.violation] = (violationMap[v.violation] || 0) + 1;
            });
        });
        
        // Payment stats
        const paymentStats = {
            paid: memos.filter(m => m.paymentStatus === 'paid').length,
            pending: memos.filter(m => m.paymentStatus === 'pending').length,
            total: memos.length
        };
        
        res.json({
            todayViolations: totalViolations,
            totalFines,
            activeOfficers: uniqueOfficers,
            violationBreakdown: violationMap,
            paymentStats
        });
    });
}

// Update analytics cache
function updateAnalytics() {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();
    
    db.all("SELECT * FROM memos WHERE date LIKE ?", [`${today}%`], (err, memos) => {
        if (err) return console.error(err);
        
        const totalViolations = memos.length;
        const totalFines = memos.reduce((sum, m) => sum + m.totalFine, 0);
        const uniqueOfficers = new Set(memos.map(m => m.officerId)).size;
        
        const violationMap = {};
        memos.forEach(m => {
            const violations = JSON.parse(m.violations);
            violations.forEach(v => {
                violationMap[v.violation] = (violationMap[v.violation] || 0) + 1;
            });
        });
        
        const paymentStats = {
            paid: memos.filter(m => m.paymentStatus === 'paid').length,
            pending: memos.filter(m => m.paymentStatus === 'pending').length,
            total: memos.length
        };
        
        db.run(`
            INSERT INTO analytics (date, total_violations, total_fines, active_officers, violation_breakdown, payment_stats, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [today, totalViolations, totalFines, uniqueOfficers, JSON.stringify(violationMap), JSON.stringify(paymentStats), now]);
    });
}


// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
