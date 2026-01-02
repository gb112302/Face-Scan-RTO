const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'rto.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Create Tables
    db.run(`CREATE TABLE IF NOT EXISTS drivers (
        id TEXT PRIMARY KEY,
        name TEXT,
        isDriver INTEGER,
        govtIdType TEXT,
        govtIdNumber TEXT,
        licenseNumber TEXT,
        vehicleNumber TEXT,
        vehicleType TEXT,
        fatherName TEXT,
        dob TEXT,
        bloodGroup TEXT,
        address TEXT,
        city TEXT,
        phone TEXT,
        licenseExpiry TEXT,
        photo TEXT,
        faceDescriptor TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS violations (
        id TEXT PRIMARY KEY,
        code TEXT,
        category TEXT,
        violation TEXT,
        fine INTEGER,
        description TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS memos (
        id TEXT PRIMARY KEY,
        driverId TEXT,
        officerId TEXT,
        officerName TEXT,
        location TEXT,
        violations TEXT, -- JSON string
        totalFine INTEGER,
        paymentStatus TEXT DEFAULT 'pending',
        date TEXT,
        FOREIGN KEY(driverId) REFERENCES drivers(id)
    )`);

    // Analytics table for storing computed stats
    db.run(`CREATE TABLE IF NOT EXISTS analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        total_violations INTEGER,
        total_fines INTEGER,
        active_officers INTEGER,
        violation_breakdown TEXT, -- JSON
        payment_stats TEXT, -- JSON
        updated_at TEXT
    )`);

    // Seed Data (Check if empty first)
    db.get("SELECT count(*) as count FROM drivers", [], (err, row) => {
        if (err) return console.error(err.message);
        if (row.count === 0) {
            console.log("Seeding drivers...");
            const drivers = [
                {
                    id: "GJ001",
                    name: "GOVIND CHAUDHARI",
                    isDriver: true,
                    govtIdType: "Aadhaar",
                    govtIdNumber: "5566-7788-9900",
                    licenseNumber: "GJ-0120230045678",
                    vehicleNumber: "GJ 02 AB 1234",
                    vehicleType: "Two Wheeler",
                    fatherName: "Ramesh Chaudhari",
                    dob: "1985-06-15",
                    bloodGroup: "O+",
                    address: "12, Gokuldham Society, Visnagar, Gujarat",
                    city: "Visnagar",
                    phone: "+91 96646 50787",
                    licenseExpiry: "2027-08-22",
                    photo: "https://randomuser.me/api/portraits/women/44.jpg"
                },
                {
                    id: "GJ002",
                    name: "PRAYAN CHAUDHARI",
                    isDriver: true,
                    govtIdType: "Aadhaar",
                    govtIdNumber: "9988-7766-5544",
                    licenseNumber: "GJ-0520200012345",
                    vehicleNumber: "GJ 05 CD 5678",
                    vehicleType: "Four Wheeler",
                    fatherName: "Suresh Chaudhari",
                    dob: "1990-11-23",
                    bloodGroup: "A+",
                    address: "45, Surat Diamond Hub, Surat, Gujarat",
                    city: "Surat",
                    phone: "+91 98980 12345",
                    licenseExpiry: "2030-12-10",
                    photo: "https://randomuser.me/api/portraits/men/32.jpg"
                },
                {
                    id: "GJ003",
                    name: "KRIS CHAUDHARY",
                    isDriver: true,
                    govtIdType: "PAN",
                    govtIdNumber: "ABCDE1234F",
                    licenseNumber: "GJ-0120210023456",
                    vehicleNumber: "GJ 01 EF 9012",
                    vehicleType: "SUV",
                    fatherName: "Mahesh Chaudhary",
                    dob: "1992-03-08",
                    bloodGroup: "B+",
                    address: "78, Satellite Road, Ahmedabad, Gujarat",
                    city: "Ahmedabad",
                    phone: "+91 98765 43210",
                    licenseExpiry: "2025-05-20",
                    photo: "https://randomuser.me/api/portraits/men/45.jpg"
                }
            ];

            const stmt = db.prepare(`INSERT INTO drivers VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            drivers.forEach(d => {
                stmt.run([
                    d.id, d.name, d.isDriver ? 1 : 0, d.govtIdType, d.govtIdNumber, d.licenseNumber,
                    d.vehicleNumber, d.vehicleType, d.fatherName, d.dob, d.bloodGroup,
                    d.address, d.city, d.phone, d.licenseExpiry, d.photo, null // faceDescriptor initially null
                ]);
            });

            // Generate 500 Data Records
            console.log("Generating 500 random drivers...");
            const cities = ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar", "Junagadh", "Gandhinagar"];
            const bloodGroups = ["A+", "B+", "AB+", "O+", "A-", "B-", "AB-", "O-"];
            const vehicleTypes = ["Two Wheeler", "Four Wheeler", "SUV", "Truck", "Bus"];

            const randomDate = (start, end) => {
                return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString().split('T')[0];
            }

            for (let i = 1; i <= 500; i++) {
                const idNum = i + 3; // Start from 4 since we have 3 static ones
                const driverId = `GJ${String(idNum).padStart(3, '0')}`;
                
                // Helper to get random item
                const r = arr => arr[Math.floor(Math.random() * arr.length)];
                const randomNum = (len) => Math.floor(Math.random() * Math.pow(10, len)).toString().padStart(len, '0');
                
                const city = r(cities);
                const vehicleType = r(vehicleTypes);

                 const driver = {
                    id: driverId,
                    name: `Driver ${idNum}`,
                    isDriver: 1,
                    govtIdType: "Aadhaar",
                    govtIdNumber: `${randomNum(4)}-${randomNum(4)}-${randomNum(4)}`,
                    licenseNumber: `GJ-${randomNum(2)}${new Date().getFullYear()}${randomNum(7)}`,
                    vehicleNumber: `GJ ${randomNum(2)} ${String.fromCharCode(65+Math.floor(Math.random()*26))}${String.fromCharCode(65+Math.floor(Math.random()*26))} ${randomNum(4)}`,
                    vehicleType: vehicleType,
                    fatherName: `Father of Driver ${idNum}`,
                    dob: randomDate(new Date(1970, 0, 1), new Date(2000, 0, 1)),
                    bloodGroup: r(bloodGroups),
                    address: `Random Address ${idNum}, ${city}`,
                    city: city,
                    phone: `+91 ${Math.floor(9000000000 + Math.random() * 1000000000)}`,
                    licenseExpiry: randomDate(new Date(2026, 0, 1), new Date(2035, 0, 1)),
                    photo: `https://randomuser.me/api/portraits/${Math.random() > 0.5 ? 'men' : 'women'}/${Math.floor(Math.random() * 99)}.jpg`,
                    faceDescriptor: null
                };

                stmt.run([
                    driver.id, driver.name, driver.isDriver, driver.govtIdType, driver.govtIdNumber, driver.licenseNumber,
                    driver.vehicleNumber, driver.vehicleType, driver.fatherName, driver.dob, driver.bloodGroup,
                    driver.address, driver.city, driver.phone, driver.licenseExpiry, driver.photo, driver.faceDescriptor
                ]);
            }
            stmt.finalize();
            console.log("500 Drivers generated.");
        }
    });

    // Seed Violations
    db.get("SELECT count(*) as count FROM violations", [], (err, row) => {
        if (err) return console.error(err.message);
        if (row.count === 0) {
            console.log("Seeding violations...");
            const violations = [
                {
                    id: "V001",
                    code: "177",
                    category: "General Offences",
                    violation: "Riding without helmet",
                    fine: 1000,
                    description: "Two-wheeler rider/pillion rider not wearing helmet"
                },
                {
                    id: "V002",
                    code: "184",
                    category: "Driving Offences",
                    violation: "Dangerous driving",
                    fine: 5000,
                    description: "Driving in a manner dangerous to the public"
                }
            ];

            const stmt = db.prepare(`INSERT INTO violations VALUES (?, ?, ?, ?, ?, ?)`);
            violations.forEach(v => {
                stmt.run([v.id, v.code, v.category, v.violation, v.fine, v.description]);
            });
            stmt.finalize();
        }
    });

    // Create Metadata Tables (Districts, Cities, Cameras)
    db.run(`CREATE TABLE IF NOT EXISTS districts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS cities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        district_id INTEGER,
        name TEXT,
        latitude REAL,
        longitude REAL,
        FOREIGN KEY(district_id) REFERENCES districts(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS cameras (
        id TEXT PRIMARY KEY,
        name TEXT,
        type TEXT,
        feeds TEXT -- JSON string of feed URLs
    )`);

    // Seed Districts and Cities
    db.get("SELECT count(*) as count FROM districts", [], (err, row) => {
        if (err) return console.error(err.message);
        if (row.count === 0) {
            console.log("Seeding location data...");
            
            const gujaratData = {
                "Ahmedabad": ["Ahmedabad", "Dholera", "Sanand", "Bavla", "Dhandhuka", "Viramgam"],
                "Amreli": ["Amreli", "Bagasara", "Dhari", "Lathi", "Rajula", "Savarkundla"],
                "Anand": ["Anand", "Khambhat", "Petlad", "Sojitra", "Umreth", "Tarapur"],
                "Aravalli": ["Modasa", "Bayad", "Bhiloda", "Dhansura", "Malpur", "Meghraj"],
                "Banaskantha": ["Palanpur", "Deesa", "Dhanera", "Tharad", "Ambaji", "Danta"],
                "Bharuch": ["Bharuch", "Ankleshwar", "Jambusar", "Vagra", "Hansot"],
                "Bhavnagar": ["Bhavnagar", "Mahuva", "Palitana", "Sihor", "Gariadhar", "Talaja"],
                "Botad": ["Botad", "Gadhada", "Barvala", "Ranpur"],
                "Chhota Udaipur": ["Chhota Udaipur", "Bodeli", "Pavi Jetpur"],
                "Dahod": ["Dahod", "Jhalod", "Devgadh Baria", "Limkheda"],
                "Dang": ["Ahwa", "Saputara", "Waghai"],
                "Devbhoomi Dwarka": ["Dwarka", "Khambhalia", "Okha", "Bhanvad"],
                "Gandhinagar": ["Gandhinagar", "Kalol", "Dehgam", "Mansa"],
                "Gir Somnath": ["Veraval", "Somnath", "Talala", "Una", "Kodinar"],
                "Jamnagar": ["Jamnagar", "Dhrol", "Jamjodhpur", "Jodiya", "Kalavad"],
                "Junagadh": ["Junagadh", "Keshod", "Mangrol", "Manavadar", "Visavadar"],
                "Kheda": ["Nadiad", "Kheda", "Kapadvanj", "Mehmedabad", "Dakor"],
                "Kutch": ["Bhuj", "Gandhidham", "Anjar", "Mandvi", "Mundra", "Rapar"],
                "Mahisagar": ["Lunawada", "Balasinor", "Santrampur", "Virpur"],
                "Mehsana": ["Mehsana", "Visnagar", "Unjha", "Kadi", "Vadnagar", "Vijapur", "Becharaji"],
                "Morbi": ["Morbi", "Wankaner", "Halvad", "Tankara"],
                "Narmada": ["Rajpipla", "Dediyapada", "Tilakwada"],
                "Navsari": ["Navsari", "Bilimora", "Gandevi", "Chikhli", "Vansda"],
                "Panchmahal": ["Godhra", "Halol", "Kalol", "Shehera"],
                "Patan": ["Patan", "Sidhpur", "Chanasma", "Harij", "Radhanpur"],
                "Porbandar": ["Porbandar", "Ranavav", "Kutiyana"],
                "Rajkot": ["Rajkot", "Gondal", "Jetpur", "Dhoraji", "Upleta", "Jasdan"],
                "Sabarkantha": ["Himmatnagar", "Idar", "Prantij", "Talod", "Khedbrahma"],
                "Surat": ["Surat", "Bardoli", "Vyara", "Olpad", "Mandvi", "Mangrol"],
                "Surendranagar": ["Surendranagar", "Wadhwan", "Dhrangadhra", "Limbdi", "Chotila"],
                "Tapi": ["Vyara", "Songadh", "Valod", "Uchchal"],
                "Vadodara": ["Vadodara", "Padra", "Karjan", "Dabhoi", "Savli", "Waghodia"],
                "Valsad": ["Valsad", "Vapi", "Pardi", "Umbergaon", "Dharampur"]
            };

            const cityCoordinates = {
                'Ahmedabad': [23.0225, 72.5714],
                'Mehsana': [23.5880, 72.3693],
                'Visnagar': [23.6934, 72.5487],
                'Gandhinagar': [23.2156, 72.6369],
                'Surat': [21.1702, 72.8311],
                'Vadodara': [22.3072, 73.1812]
            };

            const insertDistrict = db.prepare("INSERT INTO districts (name) VALUES (?)");
            const insertCity = db.prepare("INSERT INTO cities (district_id, name, latitude, longitude) VALUES (?, ?, ?, ?)");

            db.serialize(() => {
                for (const [district, cities] of Object.entries(gujaratData)) {
                    insertDistrict.run(district, function(err) {
                        if (err) return console.error(err);
                        const districtId = this.lastID;
                        cities.forEach(city => {
                            const coords = cityCoordinates[city] || [null, null]; // Default to null if no coords
                            insertCity.run(districtId, city, coords[0], coords[1]);
                        });
                    });
                }
            });
            insertDistrict.finalize();
            insertCity.finalize();
        }
    });

    // Seed Cameras
    db.get("SELECT count(*) as count FROM cameras", [], (err, row) => {
        if (err) return console.error(err.message);
        if (row.count === 0) {
            console.log("Seeding camera data...");
            const rtoCameraFeeds = {
                'rto-main': [
                    'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800',
                    'https://images.unsplash.com/photo-1502877338535-766e1452684a?w=800',
                    'https://images.unsplash.com/photo-1486299267070-83823f5448dd?w=800'
                ],
                'rto-highway': [
                    'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800',
                    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800'
                ],
                'rto-junction': [
                    'https://images.unsplash.com/photo-1502877338535-766e1452684a?w=800',
                    'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800'
                ],
                'rto-toll': [
                    'https://images.unsplash.com/photo-1486299267070-83823f5448dd?w=800',
                    'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800'
                ]
            };

            const cameraNames = {
                'rto-main': 'RTO Main Gate Camera',
                'rto-highway': 'Highway Surveillance Camera',
                'rto-junction': 'Traffic Junction Camera',
                'rto-toll': 'Toll Plaza Camera'
            };

            const stmt = db.prepare("INSERT INTO cameras (id, name, type, feeds) VALUES (?, ?, ?, ?)");
            Object.keys(rtoCameraFeeds).forEach(key => {
                stmt.run(key, cameraNames[key], 'Simulation', JSON.stringify(rtoCameraFeeds[key]));
            });
            stmt.finalize();
        }
    });
});

module.exports = db;
