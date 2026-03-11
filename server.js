const express = require('express');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library');
const mysql = require('mysql2');
const jwt = require('jsonwebtoken'); 

const app = express();
app.use(cors()); 
app.use(express.json());

const CLIENT_ID = "159246343111-o9bv4lgk1hmmvdkef0qnq0ih9qefjhmj.apps.googleusercontent.com";
const googleClient = new OAuth2Client(CLIENT_ID);
const HR_SECRET_KEY = "bitsathy_super_secret_hr_key"; 

const dbPool = mysql.createPool({
    host: 'mysql-32a5e69e-sivanagu7771-74ba.d.aivencloud.com',
    port: 17949, 
    user: 'avnadmin', 
    password: 'AVNS_x5GIyjOoanVqXlKMi0w', 
    database: 'defaultdb', 
    waitForConnections: true,
    connectionLimit: 10,
    ssl: { rejectUnauthorized: false } 
});
const promisePool = dbPool.promise();

// --- DB AUTO-INITIALIZER (SELF-HEALING) ---
(async function initializeDatabase() {
    try {
        await promisePool.query(`CREATE TABLE IF NOT EXISTS student_profile (email VARCHAR(255) PRIMARY KEY, full_name VARCHAR(255), roll_no VARCHAR(50), department VARCHAR(100))`);
        try { await promisePool.query(`ALTER TABLE student_profile ADD COLUMN cgpa VARCHAR(10) DEFAULT '0'`); } catch(e){}
        try { await promisePool.query(`ALTER TABLE student_profile ADD COLUMN sgpa VARCHAR(10) DEFAULT '0'`); } catch(e){}
        try { await promisePool.query(`ALTER TABLE student_profile ADD COLUMN attendance VARCHAR(10) DEFAULT '0'`); } catch(e){}
        try { await promisePool.query(`ALTER TABLE student_profile ADD COLUMN reward_points VARCHAR(10) DEFAULT '0'`); } catch(e){}
        try { await promisePool.query(`ALTER TABLE student_profile ADD COLUMN arrears VARCHAR(10) DEFAULT '0'`); } catch(e){}
        try { await promisePool.query(`ALTER TABLE student_profile ADD COLUMN leaves VARCHAR(10) DEFAULT '0'`); } catch(e){}
        
        await promisePool.query(`CREATE TABLE IF NOT EXISTS pcdp_master_courses (id INT AUTO_INCREMENT PRIMARY KEY, course_name VARCHAR(255), description TEXT, total_levels INT DEFAULT 1, category VARCHAR(100), image_url TEXT)`);
        try { await promisePool.query(`ALTER TABLE pcdp_master_courses ADD COLUMN total_levels INT DEFAULT 1`); } catch(e){}
        try { await promisePool.query(`ALTER TABLE pcdp_master_courses ADD COLUMN category VARCHAR(100)`); } catch(e){}
        
        await promisePool.query(`CREATE TABLE IF NOT EXISTS student_courses (id INT AUTO_INCREMENT PRIMARY KEY, student_email VARCHAR(255), semester INT, course_name VARCHAR(255), marks VARCHAR(50), grade VARCHAR(10))`);
        
        await promisePool.query(`CREATE TABLE IF NOT EXISTS student_skills (id INT AUTO_INCREMENT PRIMARY KEY, student_email VARCHAR(255), skill_name VARCHAR(255), total_levels INT, completed_levels INT, category VARCHAR(100), image_url TEXT)`);
        try { await promisePool.query(`ALTER TABLE student_skills ADD COLUMN image_url TEXT`); } catch(e){}
        try { await promisePool.query(`ALTER TABLE student_skills ADD COLUMN description TEXT`); } catch(e){}

        await promisePool.query(`CREATE TABLE IF NOT EXISTS pcdp_courses (
            id INT AUTO_INCREMENT PRIMARY KEY,
            course_name VARCHAR(255) UNIQUE,
            total_levels INT DEFAULT 1,
            category VARCHAR(100),
            image_url TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`);

        await promisePool.query(`CREATE TABLE IF NOT EXISTS student_sem_gpa (id INT AUTO_INCREMENT PRIMARY KEY, student_email VARCHAR(255) NOT NULL, semester INT NOT NULL, gpa VARCHAR(10), UNIQUE KEY unique_sem (student_email, semester))`);
        await promisePool.query(`CREATE TABLE IF NOT EXISTS placement_global (id INT PRIMARY KEY, total_placed VARCHAR(50), ongoing_drives VARCHAR(50), highest_ctc VARCHAR(50), avg_ctc VARCHAR(50))`);
        await promisePool.query(`INSERT IGNORE INTO placement_global (id, total_placed, ongoing_drives, highest_ctc, avg_ctc) VALUES (1, '0', '0', '0', '0')`);
        await promisePool.query(`CREATE TABLE IF NOT EXISTS placement_drives (id INT AUTO_INCREMENT PRIMARY KEY, company VARCHAR(255), role VARCHAR(255), appeared VARCHAR(50), selected VARCHAR(50), ctc VARCHAR(50))`);
        
        await promisePool.query(`CREATE TABLE IF NOT EXISTS placement_student_profile (student_email VARCHAR(255) PRIMARY KEY, offer_role VARCHAR(255) DEFAULT '--', offer_company VARCHAR(255) DEFAULT '--', offer_ctc VARCHAR(50) DEFAULT '--', status VARCHAR(50) DEFAULT 'Unplaced', assessments VARCHAR(50) DEFAULT '0', interviews VARCHAR(50) DEFAULT '0', offers VARCHAR(50) DEFAULT '0', tech_dsa VARCHAR(50) DEFAULT '0', tech_oop VARCHAR(50) DEFAULT '0', tech_core VARCHAR(50) DEFAULT '0', apt_quant VARCHAR(50) DEFAULT '0', apt_logical VARCHAR(50) DEFAULT '0', apt_hr VARCHAR(50) DEFAULT '0', resume_url LONGTEXT)`);
        try { await promisePool.query(`ALTER TABLE placement_student_profile ADD COLUMN resume_url LONGTEXT`); } catch(e){}
        try { await promisePool.query(`ALTER TABLE placement_student_profile MODIFY COLUMN resume_url LONGTEXT`); } catch(e){}

        await promisePool.query(`CREATE TABLE IF NOT EXISTS placement_apps (id INT AUTO_INCREMENT PRIMARY KEY, student_email VARCHAR(255), company VARCHAR(255), role VARCHAR(255), date_applied VARCHAR(50), status VARCHAR(50))`);
        await promisePool.query(`CREATE TABLE IF NOT EXISTS hr_profile (email VARCHAR(255) PRIMARY KEY, company_name VARCHAR(255), password VARCHAR(255))`);
        
        console.log("✅ Database Verified: All enterprise tables and HR module ready.");
    } catch (err) { console.error("❌ DB Init Error:", err.message); }
})();

// --- 1. MANUAL LOGIN (HR ONLY) ---
app.post('/api/hr/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const [hr] = await promisePool.query("SELECT * FROM hr_profile WHERE LOWER(email) = LOWER(?) AND password = ?", [email, password]);
        
        if (hr.length > 0) {
            const token = jwt.sign({ email: hr[0].email, company: hr[0].company_name }, HR_SECRET_KEY, { expiresIn: '2h' });
            res.json({ success: true, token: token, company: hr[0].company_name });
        } else {
            res.json({ success: false, message: "Invalid HR Email or Password." });
        }
    } catch (e) { res.json({ success: false, message: "Database Error during HR login." }); }
});

// --- 2. GOOGLE AUTH (Admin & Students ONLY) ---
app.post('/api/auth', async (req, res) => {
    try {
        const ticket = await googleClient.verifyIdToken({ idToken: req.body.token, audience: CLIENT_ID });
        const payload = ticket.getPayload();
        const email = payload.email.toLowerCase();
        
        if (email === 'sivanagu7771@gmail.com') {
            const [globalStats] = await promisePool.query("SELECT * FROM placement_global WHERE id = 1");
            const [globalDrives] = await promisePool.query("SELECT * FROM placement_drives ORDER BY id DESC");
            return res.json({ success: true, isAdmin: true, profile: { full_name: payload.name, email: email, picture: payload.picture }, globalStats: globalStats[0], globalDrives });
        }

        if (!email.endsWith('@bitsathy.ac.in')) return res.json({ success: false, message: "Access Denied. Only @bitsathy.ac.in or Admin Google accounts allowed here." });
        
        let [profile] = await promisePool.query("SELECT * FROM student_profile WHERE email = ?", [email]);
        if (profile.length === 0) {
            await promisePool.query("INSERT INTO student_profile (email, full_name, department, reward_points) VALUES (?, ?, 'Not Assigned', '0')", [email, payload.name]);
            [profile] = await promisePool.query("SELECT * FROM student_profile WHERE email = ?", [email]);
        }

        const [courses] = await promisePool.query("SELECT * FROM student_courses WHERE student_email = ? ORDER BY semester ASC", [email]);
        const [skills] = await promisePool.query("SELECT * FROM student_skills WHERE student_email = ?", [email]);
        const [semGpas] = await promisePool.query("SELECT semester, gpa FROM student_sem_gpa WHERE student_email = ?", [email]);
        const [placeProfile] = await promisePool.query("SELECT * FROM placement_student_profile WHERE student_email = ?", [email]);
        const [placeApps] = await promisePool.query("SELECT * FROM placement_apps WHERE student_email = ? ORDER BY id DESC", [email]);
        const [globalStats] = await promisePool.query("SELECT * FROM placement_global WHERE id = 1");
        const [globalDrives] = await promisePool.query("SELECT * FROM placement_drives ORDER BY id DESC");

        res.json({ success: true, isAdmin: false, profile: profile[0], courses, skills, semGpas, globalStats: globalStats[0], globalDrives, placeProfile: placeProfile[0], placeApps, picture: payload.picture });
    } catch (error) { 
        console.error("AUTH ERROR CAUGHT:", error.message);
        res.json({ success: false, message: `Login Error: ${error.message}` }); 
    }
});

// ==============================================================================
// --- HR DATA APIS (UPDATED) ---
// ==============================================================================

app.post('/api/hr/verify', async (req, res) => {
    try {
        const decoded = jwt.verify(req.body.token, HR_SECRET_KEY);
        res.json({ success: true, company: decoded.company, email: decoded.email });
    } catch(e) { res.json({ success: false }); }
});

// 🛠️ FIX 1: Modified SQL query to pull a.id as app_id, s.cgpa, and p.tech_core
app.post('/api/hr/applicants', async (req, res) => {
    try {
        const decoded = jwt.verify(req.body.token, HR_SECRET_KEY);
        
        const sql = `
            SELECT a.id as app_id, a.role, a.date_applied, a.status, 
                   s.full_name, s.roll_no, s.department, s.email, s.cgpa, 
                   p.resume_url, p.tech_dsa, p.tech_oop, p.tech_core
            FROM placement_apps a
            JOIN student_profile s ON a.student_email = s.email
            LEFT JOIN placement_student_profile p ON a.student_email = p.student_email
            WHERE LOWER(a.company) = LOWER(?)
        `;
        const [applicants] = await promisePool.query(sql, [decoded.company]);
        res.json({ success: true, applicants });
    } catch(e) { 
        console.error("Fetch Applicants Error:", e.message);
        res.json({ success: false }); 
    }
});

// 🛠️ FIX 2: Added the missing status update route for HR Dashboard
app.post('/api/hr/update-status', async (req, res) => {
    try {
        const decoded = jwt.verify(req.body.token, HR_SECRET_KEY);
        const { app_id, status } = req.body;
        
        // Secure update ensuring the HR only updates apps for their specific company
        await promisePool.query(
            "UPDATE placement_apps SET status = ? WHERE id = ? AND LOWER(company) = LOWER(?)", 
            [status, app_id, decoded.company]
        );
        res.json({ success: true });
    } catch(e) { 
        console.error("Status Update Error:", e.message);
        res.json({ success: false, message: "Invalid session or server error." }); 
    }
});

// --- STUDENT APIS ---
app.post('/api/student/update-resume', async (req, res) => {
    try {
        const ticket = await googleClient.verifyIdToken({ idToken: req.body.token, audience: CLIENT_ID });
        const email = ticket.getPayload().email.toLowerCase();
        
        await promisePool.query(
            `INSERT INTO placement_student_profile (student_email, resume_url) 
             VALUES (?, ?) 
             ON DUPLICATE KEY UPDATE resume_url = ?`, 
            [email, req.body.resume_url, req.body.resume_url]
        );
        
        res.json({ success: true });
    } catch(e) { 
        console.error("Resume Save Error:", e.message);
        res.json({ success: false, message: "Session Expired", details: e.message }); 
    }
});

app.post('/api/student/all-rewards', async (req, res) => {
    try {
        await googleClient.verifyIdToken({ idToken: req.body.token, audience: CLIENT_ID });
        let [rows] = await promisePool.query("SELECT full_name, roll_no, department, reward_points FROM student_profile");
        res.json({ success: true, students: rows || [] });
    } catch (e) { res.json({ success: false, message: "Session expired." }); }
});

// ==============================================================================
// --- PCDP CONTROL PORTAL APIS ---
// ==============================================================================

async function verifyPcdpAdmin(token) {
    if (token !== 'pcdp_admin_authorized_token_7771') throw new Error("Unauthorized Access to PCDP Portal.");
    return true;
}

app.post('/api/pcdp/admin/students', async (req, res) => {
    try {
        await verifyPcdpAdmin(req.body.adminToken);
        const [rows] = await promisePool.query("SELECT email, full_name, roll_no, department FROM student_profile ORDER BY full_name ASC");
        res.json({ success: true, students: rows });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/pcdp/admin/student-courses', async (req, res) => {
    try {
        await verifyPcdpAdmin(req.body.adminToken);
        const email = req.body.targetEmail;

        const [profile] = await promisePool.query("SELECT full_name, roll_no, department, reward_points FROM student_profile WHERE LOWER(email) = LOWER(?)", [email]);
        
        const sql = `
            SELECT id, skill_name, total_levels, completed_levels, category, image_url
            FROM student_skills
            WHERE student_email = ?
            ORDER BY id DESC
        `;
        const [courses] = await promisePool.query(sql, [email]);
        
        res.json({ success: true, profile: profile[0], courses: courses });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/pcdp/admin/add-skill', async (req, res) => {
    try {
        await verifyPcdpAdmin(req.body.adminToken);
        await promisePool.query(
            "INSERT INTO student_skills (student_email, skill_name, total_levels, completed_levels, category, image_url) VALUES (?, ?, ?, 0, ?, ?)", 
            [req.body.targetEmail, req.body.skill_name, req.body.total_levels, req.body.category, req.body.image_url]
        );
        res.json({ success: true });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/pcdp/admin/update-level', async (req, res) => {
    try {
        await verifyPcdpAdmin(req.body.adminToken);
        const { courseId, newLevel } = req.body;
        
        const [current] = await promisePool.query("SELECT total_levels FROM student_skills WHERE id = ?", [courseId]);
        if(current.length === 0) throw new Error("Course not found.");
        if(newLevel < 0 || newLevel > current[0].total_levels) throw new Error("Invalid level value.");

        await promisePool.query("UPDATE student_skills SET completed_levels = ? WHERE id = ?", [newLevel, courseId]);
        
        res.json({ success: true, message: "PCDP Level Updated Successfully." });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/pcdp/admin/delete-skill', async (req, res) => {
    try {
        await verifyPcdpAdmin(req.body.adminToken);
        await promisePool.query("DELETE FROM student_skills WHERE id = ?", [req.body.id]);
        res.json({ success: true });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

// -----------------------------------------------------------------------------
// PCDP COURSE LIBRARY ENDPOINTS (global courses managed by PCDP admin)
// -----------------------------------------------------------------------------

app.post('/api/pcdp/courses', async (req, res) => {
    try {
        await verifyPcdpAdmin(req.body.adminToken);
        const [rows] = await promisePool.query("SELECT * FROM pcdp_courses ORDER BY course_name ASC");
        res.json({ success: true, courses: rows });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/pcdp/course/add', async (req, res) => {
    try {
        await verifyPcdpAdmin(req.body.adminToken);
        const { course_name, total_levels, category, image_url } = req.body;
        await promisePool.query(
            "INSERT INTO pcdp_courses (course_name, total_levels, category, image_url) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE total_levels=VALUES(total_levels), category=VALUES(category), image_url=VALUES(image_url)",
            [course_name, total_levels || 1, category, image_url]
        );
        res.json({ success: true });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/pcdp/course/update', async (req, res) => {
    try {
        await verifyPcdpAdmin(req.body.adminToken);
        const { id, field, value } = req.body;
        await promisePool.query(`UPDATE pcdp_courses SET ${field} = ? WHERE id = ?`, [value, id]);
        res.json({ success: true });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/pcdp/course/delete', async (req, res) => {
    try {
        await verifyPcdpAdmin(req.body.adminToken);
        await promisePool.query("DELETE FROM pcdp_courses WHERE id = ?", [req.body.id]);
        res.json({ success: true });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/admin/pcdp-courses', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        const [rows] = await promisePool.query("SELECT * FROM pcdp_courses ORDER BY course_name ASC");
        res.json({ success: true, courses: rows });
    } catch (e) { res.json({ success: false }); }
});

// ==============================================================================
// --- EXISTING ADMIN ROUTES ---
// ==============================================================================

async function verifyAdmin(token) {
    const ticket = await googleClient.verifyIdToken({ idToken: token, audience: CLIENT_ID });
    if (ticket.getPayload().email.toLowerCase() !== 'sivanagu7771@gmail.com') throw new Error("Unauthorized");
    return true;
}

app.post('/api/admin/list', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        const [rows] = await promisePool.query("SELECT email, full_name, roll_no, department FROM student_profile ORDER BY full_name ASC");
        res.json({ success: true, students: rows });
    } catch (e) { res.json({ success: false }); }
});

app.post('/api/admin/student-data', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        const email = req.body.targetEmail;
        const [profile] = await promisePool.query("SELECT * FROM student_profile WHERE LOWER(email) = LOWER(?)", [email]);
        const [courses] = await promisePool.query("SELECT * FROM student_courses WHERE student_email = ? ORDER BY semester ASC", [email]);
        const [skills] = await promisePool.query("SELECT * FROM student_skills WHERE student_email = ?", [email]);
        const [semGpas] = await promisePool.query("SELECT semester, gpa FROM student_sem_gpa WHERE student_email = ?", [email]);
        const [placeProfile] = await promisePool.query("SELECT * FROM placement_student_profile WHERE student_email = ?", [email]);
        const [placeApps] = await promisePool.query("SELECT * FROM placement_apps WHERE student_email = ? ORDER BY id DESC", [email]);
        res.json({ success: true, profile: profile[0], courses, skills, semGpas, placeProfile: placeProfile[0], placeApps });
    } catch (e) { res.json({ success: false }); }
});

app.post('/api/admin/update-field', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        const { targetEmail, field, value } = req.body;
        if (field === 'email') {
            await promisePool.query("SET FOREIGN_KEY_CHECKS=0");
            await promisePool.query(`UPDATE student_profile SET email = ? WHERE LOWER(email) = LOWER(?)`, [value.toLowerCase(), targetEmail]);
            await promisePool.query(`UPDATE student_courses SET student_email = ? WHERE LOWER(student_email) = LOWER(?)`, [value.toLowerCase(), targetEmail]);
            await promisePool.query(`UPDATE student_skills SET student_email = ? WHERE LOWER(student_email) = LOWER(?)`, [value.toLowerCase(), targetEmail]);
            await promisePool.query(`UPDATE student_sem_gpa SET student_email = ? WHERE LOWER(student_email) = LOWER(?)`, [value.toLowerCase(), targetEmail]);
            await promisePool.query(`UPDATE placement_student_profile SET student_email = ? WHERE LOWER(student_email) = LOWER(?)`, [value.toLowerCase(), targetEmail]);
            await promisePool.query(`UPDATE placement_apps SET student_email = ? WHERE LOWER(student_email) = LOWER(?)`, [value.toLowerCase(), targetEmail]);
            await promisePool.query("SET FOREIGN_KEY_CHECKS=1");
        } else {
            await promisePool.query(`UPDATE student_profile SET ${field} = ? WHERE LOWER(email) = LOWER(?)`, [value, targetEmail]);
        }
        res.json({ success: true });
    } catch (e) { res.json({ success: false }); }
});

app.post('/api/admin/update-sem-gpa', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        await promisePool.query("INSERT INTO student_sem_gpa (student_email, semester, gpa) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE gpa = VALUES(gpa)", [req.body.targetEmail.toLowerCase(), req.body.semester, req.body.gpa]);
        res.json({ success: true });
    } catch (e) { res.json({ success: false }); }
});

app.post('/api/admin/update-global-stat', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        await promisePool.query(`UPDATE placement_global SET ${req.body.field} = ? WHERE id = 1`, [req.body.value]);
        res.json({ success: true });
    } catch (e) { res.json({ success: false }); }
});

app.post('/api/admin/add-drive', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        await promisePool.query("INSERT INTO placement_drives (company, role, appeared, selected, ctc) VALUES (?, ?, ?, ?, ?)", [req.body.company, req.body.role, req.body.appeared, req.body.selected, req.body.ctc]);
        res.json({ success: true });
    } catch (e) { res.json({ success: false }); }
});

app.post('/api/admin/update-drive', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        await promisePool.query(`UPDATE placement_drives SET ${req.body.field} = ? WHERE id = ?`, [req.body.value, req.body.id]);
        res.json({ success: true });
    } catch (e) { res.json({ success: false }); }
});

app.post('/api/admin/delete-drive', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        await promisePool.query("DELETE FROM placement_drives WHERE id = ?", [req.body.id]);
        res.json({ success: true });
    } catch (e) { res.json({ success: false }); }
});

app.post('/api/admin/update-placement-profile', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        await promisePool.query(`INSERT IGNORE INTO placement_student_profile (student_email) VALUES (?)`, [req.body.targetEmail.toLowerCase()]);
        await promisePool.query(`UPDATE placement_student_profile SET ${req.body.field} = ? WHERE student_email = ?`, [req.body.value, req.body.targetEmail.toLowerCase()]);
        res.json({ success: true });
    } catch (e) { res.json({ success: false }); }
});

app.post('/api/admin/add-app', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        await promisePool.query("INSERT INTO placement_apps (student_email, company, role, date_applied, status) VALUES (?, ?, ?, ?, ?)", [req.body.targetEmail.toLowerCase(), req.body.company, req.body.role, req.body.date_applied, req.body.status]);
        res.json({ success: true });
    } catch (e) { res.json({ success: false }); }
});

app.post('/api/admin/update-app', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        await promisePool.query(`UPDATE placement_apps SET ${req.body.field} = ? WHERE id = ?`, [req.body.value, req.body.id]);
        res.json({ success: true });
    } catch (e) { res.json({ success: false }); }
});

app.post('/api/admin/delete-app', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        await promisePool.query("DELETE FROM placement_apps WHERE id = ?", [req.body.id]);
        res.json({ success: true });
    } catch (e) { res.json({ success: false }); }
});

app.post('/api/admin/add-student', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        const sql = `INSERT INTO student_profile (email, full_name, roll_no, department) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE full_name=VALUES(full_name), roll_no=VALUES(roll_no), department=VALUES(department)`;
        await promisePool.query(sql, [req.body.email.toLowerCase(), req.body.full_name, req.body.roll_no, req.body.department]);
        res.json({ success: true });
    } catch (e) { res.json({ success: false }); }
});

app.post('/api/admin/delete-student', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        const email = req.body.email;
        await promisePool.query("SET FOREIGN_KEY_CHECKS=0");
        await promisePool.query("DELETE FROM student_profile WHERE LOWER(email) = LOWER(?)", [email]);
        await promisePool.query("DELETE FROM student_courses WHERE LOWER(student_email) = LOWER(?)", [email]);
        await promisePool.query("DELETE FROM student_skills WHERE LOWER(student_email) = LOWER(?)", [email]);
        await promisePool.query("DELETE FROM student_sem_gpa WHERE LOWER(student_email) = LOWER(?)", [email]);
        await promisePool.query("DELETE FROM placement_student_profile WHERE LOWER(student_email) = LOWER(?)", [email]);
        await promisePool.query("DELETE FROM placement_apps WHERE LOWER(student_email) = LOWER(?)", [email]);
        await promisePool.query("SET FOREIGN_KEY_CHECKS=1");
        res.json({ success: true });
    } catch (e) { res.json({ success: false }); }
});

app.post('/api/admin/add-skill', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        await promisePool.query("INSERT INTO student_skills (student_email, skill_name, total_levels, completed_levels, category) VALUES (?, ?, ?, ?, ?)", [req.body.targetEmail, req.body.skill_name, req.body.total_levels, req.body.completed_levels, req.body.category]);
        res.json({ success: true });
    } catch (e) { res.json({ success: false }); }
});

app.post('/api/admin/update-skill', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        await promisePool.query(`UPDATE student_skills SET ${req.body.field} = ? WHERE id = ?`, [req.body.value, req.body.id]);
        res.json({ success: true });
    } catch (e) { res.json({ success: false }); }
});

app.post('/api/admin/delete-skill', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        await promisePool.query("DELETE FROM student_skills WHERE id = ?", [req.body.id]);
        res.json({ success: true });
    } catch (e) { res.json({ success: false }); }
});

app.post('/api/admin/add-course', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        await promisePool.query("INSERT INTO student_courses (student_email, semester, course_name, marks, grade) VALUES (?, ?, ?, ?, ?)", [req.body.targetEmail, req.body.semester, req.body.course_name, req.body.marks, req.body.grade]);
        res.json({ success: true });
    } catch (e) { res.json({ success: false }); }
});

app.post('/api/admin/update-course', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        await promisePool.query(`UPDATE student_courses SET ${req.body.field} = ? WHERE id = ?`, [req.body.value, req.body.id]);
        res.json({ success: true });
    } catch (e) { res.json({ success: false }); }
});

app.post('/api/admin/delete-course', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        await promisePool.query("DELETE FROM student_courses WHERE id = ?", [req.body.id]);
        res.json({ success: true });
    } catch (e) { res.json({ success: false }); }
});

// ==============================================================================
// --- MASTER COURSE APIS FOR PCDP & ADMIN PORTALS ---
// ==============================================================================

app.post('/api/pcdp/master/add', async (req, res) => {
    try {
        await verifyPcdpAdmin(req.body.adminToken);
        await promisePool.query(
            "INSERT INTO pcdp_master_courses (course_name, description, total_levels, category, image_url) VALUES (?, ?, ?, ?, ?)", 
            [req.body.course_name, req.body.description, req.body.total_levels, req.body.category, req.body.image_url]
        );
        res.json({ success: true });
    } catch (e) { res.json({ success: false }); }
});

app.post('/api/pcdp/master/courses', async (req, res) => {
    try {
        await verifyPcdpAdmin(req.body.adminToken);
        const [courses] = await promisePool.query("SELECT * FROM pcdp_master_courses ORDER BY id DESC");
        res.json({ success: true, courses: courses });
    } catch (e) { res.json({ success: false }); }
});

app.post('/api/pcdp/master/delete', async (req, res) => {
    try {
        await verifyPcdpAdmin(req.body.adminToken);
        await promisePool.query("DELETE FROM pcdp_master_courses WHERE id = ?", [req.body.id]);
        res.json({ success: true });
    } catch (e) { res.json({ success: false }); }
});

app.post('/api/admin/pcdp-master-list', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        const [courses] = await promisePool.query("SELECT * FROM pcdp_master_courses ORDER BY course_name ASC");
        res.json({ success: true, courses: courses });
    } catch (e) { res.json({ success: false }); }
});

app.post('/api/admin/assign-pcdp', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        const { targetEmail, masterCourseId } = req.body;
        const [master] = await promisePool.query("SELECT * FROM pcdp_master_courses WHERE id = ?", [masterCourseId]);
        if(master.length === 0) throw new Error("Course not found");
        const mc = master[0];
        
        await promisePool.query(
            "INSERT INTO student_skills (student_email, skill_name, description, total_levels, completed_levels, category, image_url) VALUES (?, ?, ?, ?, 0, ?, ?)",
            [targetEmail, mc.course_name, mc.description, mc.total_levels, mc.category, mc.image_url]
        );
        res.json({ success: true });
    } catch (e) { res.json({ success: false }); }
});

app.post('/api/pcdp/master/edit', async (req, res) => {
    try {
        await verifyPcdpAdmin(req.body.adminToken);
        const { id, course_name, description, total_levels, category, image_url } = req.body;
        await promisePool.query(
            "UPDATE pcdp_master_courses SET course_name = ?, description = ?, total_levels = ?, category = ?, image_url = ? WHERE id = ?", 
            [course_name, description, total_levels, category, image_url, id]
        );
        res.json({ success: true });
    } catch (e) { res.json({ success: false }); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 BACKEND READY ON PORT ${PORT}`));