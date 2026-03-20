const express = require('express');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library');
const mysql = require('mysql2');

const app = express();
app.use(cors()); 
app.use(express.json());

// 🛑 ANTI-CRASH SHIELDS
process.on('uncaughtException', err => console.error('Uncaught Exception:', err));
process.on('unhandledRejection', err => console.error('Unhandled Rejection:', err));

const CLIENT_ID = "159246343111-o9bv4lgk1hmmvdkef0qnq0ih9qefjhmj.apps.googleusercontent.com";
const googleClient = new OAuth2Client(CLIENT_ID);

// 🛑 DATABASE CONNECTION
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

// 🛑 AUTOMATIC DATABASE INITIALIZATION
(async function initializeDatabase() {
    try {
        await promisePool.query(`CREATE TABLE IF NOT EXISTS student_profile (email VARCHAR(255) PRIMARY KEY, full_name VARCHAR(255), roll_no VARCHAR(50), department VARCHAR(100))`);
        try { await promisePool.query(`ALTER TABLE student_profile ADD COLUMN cgpa VARCHAR(10) DEFAULT '0'`); } catch(e){}
        try { await promisePool.query(`ALTER TABLE student_profile ADD COLUMN sgpa VARCHAR(10) DEFAULT '0'`); } catch(e){}
        try { await promisePool.query(`ALTER TABLE student_profile ADD COLUMN attendance VARCHAR(10) DEFAULT '0'`); } catch(e){}
        try { await promisePool.query(`ALTER TABLE student_profile ADD COLUMN reward_points VARCHAR(10) DEFAULT '0'`); } catch(e){}
        try { await promisePool.query(`ALTER TABLE student_profile ADD COLUMN arrears VARCHAR(10) DEFAULT '0'`); } catch(e){}
        try { await promisePool.query(`ALTER TABLE student_profile ADD COLUMN leaves VARCHAR(10) DEFAULT '0'`); } catch(e){}
        try { await promisePool.query(`ALTER TABLE student_profile ADD COLUMN mentor_id INT DEFAULT NULL`); } catch(e){}
        
        await promisePool.query(`CREATE TABLE IF NOT EXISTS pcdp_master_courses (id INT AUTO_INCREMENT PRIMARY KEY, course_name VARCHAR(255), description TEXT, total_levels INT DEFAULT 1, category VARCHAR(100), image_url TEXT)`);
        await promisePool.query(`CREATE TABLE IF NOT EXISTS student_courses (id INT AUTO_INCREMENT PRIMARY KEY, student_email VARCHAR(255), semester INT, course_name VARCHAR(255), marks VARCHAR(50), grade VARCHAR(10))`);
        await promisePool.query(`CREATE TABLE IF NOT EXISTS student_skills (id INT AUTO_INCREMENT PRIMARY KEY, student_email VARCHAR(255), skill_name VARCHAR(255), total_levels INT, completed_levels INT, category VARCHAR(100), image_url TEXT)`);
        await promisePool.query(`CREATE TABLE IF NOT EXISTS pcdp_courses (id INT AUTO_INCREMENT PRIMARY KEY, course_name VARCHAR(255) UNIQUE, total_levels INT DEFAULT 1, category VARCHAR(100), image_url TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`);
        await promisePool.query(`CREATE TABLE IF NOT EXISTS student_sem_gpa (id INT AUTO_INCREMENT PRIMARY KEY, student_email VARCHAR(255) NOT NULL, semester INT NOT NULL, gpa VARCHAR(10), UNIQUE KEY unique_sem (student_email, semester))`);
        
        await promisePool.query(`CREATE TABLE IF NOT EXISTS placement_global (id INT PRIMARY KEY, total_placed VARCHAR(50), ongoing_drives VARCHAR(50), highest_ctc VARCHAR(50), avg_ctc VARCHAR(50))`);
        await promisePool.query(`INSERT IGNORE INTO placement_global (id, total_placed, ongoing_drives, highest_ctc, avg_ctc) VALUES (1, '0', '0', '0', '0')`);
        await promisePool.query(`CREATE TABLE IF NOT EXISTS placement_drives (id INT AUTO_INCREMENT PRIMARY KEY, company VARCHAR(255), role VARCHAR(255), appeared VARCHAR(50), selected VARCHAR(50), ctc VARCHAR(50))`);
        
        await promisePool.query(`CREATE TABLE IF NOT EXISTS placement_student_profile (student_email VARCHAR(255) PRIMARY KEY, offer_role VARCHAR(255) DEFAULT '--', offer_company VARCHAR(255) DEFAULT '--', offer_ctc VARCHAR(50) DEFAULT '--', status VARCHAR(50) DEFAULT 'Unplaced', assessments VARCHAR(50) DEFAULT '0', interviews VARCHAR(50) DEFAULT '0', offers VARCHAR(50) DEFAULT '0', tech_dsa VARCHAR(50) DEFAULT '0', tech_oop VARCHAR(50) DEFAULT '0', tech_core VARCHAR(50) DEFAULT '0', apt_quant VARCHAR(50) DEFAULT '0', apt_logical VARCHAR(50) DEFAULT '0', apt_hr VARCHAR(50) DEFAULT '0', resume_url LONGTEXT)`);
        try { await promisePool.query(`ALTER TABLE placement_student_profile ADD COLUMN resume_url LONGTEXT`); } catch(e){}

        await promisePool.query(`CREATE TABLE IF NOT EXISTS active_drives (id INT AUTO_INCREMENT PRIMARY KEY, company_name VARCHAR(255), role VARCHAR(255), ctc VARCHAR(100), eligibility VARCHAR(255), description TEXT, deadline VARCHAR(100), target_year VARCHAR(50) DEFAULT 'ALL', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
        await promisePool.query(`CREATE TABLE IF NOT EXISTS placement_apps (id INT AUTO_INCREMENT PRIMARY KEY, student_email VARCHAR(255), company VARCHAR(255), role VARCHAR(255), date_applied VARCHAR(50), status VARCHAR(50))`);
        try { await promisePool.query(`ALTER TABLE placement_apps ADD COLUMN salary_package VARCHAR(50) DEFAULT '--'`); } catch(e){}
        try { await promisePool.query(`ALTER TABLE placement_apps ADD COLUMN call_letter_url LONGTEXT`); } catch(e){}
        try { await promisePool.query(`ALTER TABLE placement_apps ADD COLUMN internship_period VARCHAR(100) DEFAULT '--'`); } catch(e){}

        await promisePool.query(`CREATE TABLE IF NOT EXISTS announcements (id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(255), type VARCHAR(50), content TEXT, date_posted TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
        try { await promisePool.query(`ALTER TABLE announcements ADD COLUMN target_department VARCHAR(100) DEFAULT 'ALL'`); } catch(e){}

        await promisePool.query(`CREATE TABLE IF NOT EXISTS staff_directory (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255), email VARCHAR(255), role VARCHAR(100), dept VARCHAR(100))`);
        await promisePool.query(`CREATE TABLE IF NOT EXISTS departments (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255), code VARCHAR(50), students INT DEFAULT 0, faculty INT DEFAULT 0, icon VARCHAR(100), color VARCHAR(50), bg VARCHAR(50))`);

        console.log("✅ Database Verified: All Tables Ready.");
    } catch (err) { console.error("❌ DB Init Error:", err.message); }
})();

function getDepartmentFromEmail(email) {
    let department = 'Not Assigned';
    try {
        const localPart = email.split('@')[0]; const parts = localPart.split('.'); 
        if (parts.length > 1) {
            const codePart = parts[parts.length - 1]; const branchCode = codePart.replace(/[0-9]/g, '').toLowerCase();
            const deptMap = { 'cs': 'Computer Science Engineering', 'it': 'Information Technology', 'ec': 'Electronics and Communication Engineering', 'ee': 'Electrical and Electronics Engineering', 'me': 'Mechanical Engineering', 'ce': 'Civil Engineering', 'ad': 'Artificial Intelligence and Data Science', 'cb': 'Computer Science and Business Systems', 'al': 'Artificial Intelligence and Machine Learning', 'mz': 'Mechatronics Engineering', 'ei': 'Electronics and Instrumentation Engineering', 'tx': 'Textile Technology', 'ft': 'Food Technology' };
            if (deptMap[branchCode]) { department = deptMap[branchCode]; }
        }
    } catch (e) {} return department;
}

async function verifyAdmin(reqBody) {
    const rawToken = reqBody.adminToken || reqBody.token; 
    if (!rawToken) throw new Error("No token provided");
    const token = String(rawToken).replace(/['"]+/g, ''); 
    if (token === 'custom_admin_token_pc123') return true; 
    const ticket = await googleClient.verifyIdToken({ idToken: token, audience: CLIENT_ID });
    const email = ticket.getPayload().email.toLowerCase();
    if (email !== 'sivanagu7771@gmail.com' && email !== 'placement@gmail.com' && email !== 'admin@gmail.com') {
        throw new Error("Unauthorized Email: " + email); 
    }
    return true;
}

async function verifyPCDP(reqBody) {
    const token = reqBody.token || reqBody.pcdpToken || reqBody.adminToken;
    if (!token) throw new Error("No token provided");
    const cleanToken = String(token).replace(/['"]+/g, '');
    if (cleanToken === 'pcdp_admin_authorized_token_7771') return true;
    throw new Error("Unauthorized PCDP Access");
}

app.post('/api/hr/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if ((email === 'placement@gmail.com' || email === 'admin@gmail.com') && password === 'pc123') {
            return res.json({ success: true, token: 'custom_admin_token_pc123', redirect: 'placement_portal.html' });
        }
        res.json({ success: false, message: "Invalid Email or Password." });
    } catch (e) { res.json({ success: false, message: "Server Error." }); }
});

app.post('/api/auth', async (req, res) => {
    try {
        let incomingToken = req.body.token || "";
        if (typeof incomingToken === 'string') incomingToken = incomingToken.replace(/['"]+/g, '');

        if (incomingToken === 'custom_admin_token_pc123') {
            const [globalStats] = await promisePool.query("SELECT * FROM placement_global WHERE id = 1");
            const [globalDrives] = await promisePool.query("SELECT * FROM placement_drives ORDER BY id DESC");
            return res.json({ success: true, isAdmin: true, isPlacementAdmin: true, isStaffAdmin: false, profile: { full_name: 'Placement Coordinator', email: 'placement@gmail.com' }, globalStats: globalStats ? globalStats[0] : null, globalDrives });
        }

        if (incomingToken === 'pcdp_admin_authorized_token_7771') {
            return res.json({ success: true, isAdmin: true, isPcdpAdmin: true, profile: { full_name: 'PCDP Controller', email: 'pcdp@gmail.com', picture: 'https://ui-avatars.com/api/?name=PCDP&background=8B5CF6&color=fff' } });
        }
        
        const ticket = await googleClient.verifyIdToken({ idToken: incomingToken, audience: CLIENT_ID });
        const payload = ticket.getPayload(); const email = payload.email.toLowerCase();
        
        if (email === 'placement@gmail.com' || email === 'admin@gmail.com') {
            const [globalStats] = await promisePool.query("SELECT * FROM placement_global WHERE id = 1");
            const [globalDrives] = await promisePool.query("SELECT * FROM placement_drives ORDER BY id DESC");
            return res.json({ success: true, isAdmin: true, isPlacementAdmin: true, isStaffAdmin: false, profile: { full_name: payload.name, email: email, picture: payload.picture }, globalStats: globalStats[0], globalDrives });
        }

        if (email === 'sivanagu7771@gmail.com') {
            const [globalStats] = await promisePool.query("SELECT * FROM placement_global WHERE id = 1");
            const [globalDrives] = await promisePool.query("SELECT * FROM placement_drives ORDER BY id DESC");
            return res.json({ success: true, isAdmin: true, isPlacementAdmin: false, isStaffAdmin: true, profile: { full_name: payload.name, email: email, picture: payload.picture }, globalStats: globalStats[0], globalDrives });
        }
        
        if (!email.endsWith('@bitsathy.ac.in')) return res.json({ success: false, message: "Access Denied. Use BIT Sathy Email." });
        
        let [profile] = await promisePool.query("SELECT * FROM student_profile WHERE email = ?", [email]);
        if (profile.length === 0) {
            const autoDepartment = getDepartmentFromEmail(email);
            await promisePool.query("INSERT INTO student_profile (email, full_name, department, reward_points) VALUES (?, ?, ?, '0')", [email, payload.name, autoDepartment]);
            [profile] = await promisePool.query("SELECT * FROM student_profile WHERE email = ?", [email]);
        }
        
        const [courses] = await promisePool.query("SELECT * FROM student_courses WHERE student_email = ? ORDER BY semester ASC", [email]);
        const [skills] = await promisePool.query("SELECT * FROM student_skills WHERE student_email = ?", [email]);
        const [semGpas] = await promisePool.query("SELECT semester, gpa FROM student_sem_gpa WHERE student_email = ?", [email]);
        const [placeProfile] = await promisePool.query("SELECT * FROM placement_student_profile WHERE student_email = ?", [email]);
        const [placeApps] = await promisePool.query("SELECT * FROM placement_apps WHERE student_email = ? ORDER BY id DESC", [email]);
        const [globalStats] = await promisePool.query("SELECT * FROM placement_global WHERE id = 1");
        const [globalDrives] = await promisePool.query("SELECT * FROM placement_drives ORDER BY id DESC");
        
        res.json({ success: true, isAdmin: false, isPlacementAdmin: false, isStaffAdmin: false, profile: profile[0], courses, skills, semGpas, globalStats: globalStats[0], globalDrives, placeProfile: placeProfile[0], placeApps, picture: payload.picture });
    } catch (error) { res.json({ success: false, message: `Login Error: ${error.message}` }); }
});


// ============================================================================
// --- PCDP MASTER ROUTES ---
// ============================================================================
app.post(['/api/pcdp/list', '/api/pcdp/master/courses', '/api/admin/pcdp-master-list', '/api/pcdp-master-list'], async (req, res) => {
    try { let isAllowed = false; try { await verifyPCDP(req.body); isAllowed = true; } catch(e) {} if(!isAllowed) { await verifyAdmin(req.body); isAllowed = true; } if (!isAllowed) throw new Error("Unauthorized"); const [rows] = await promisePool.query("SELECT * FROM pcdp_master_courses ORDER BY id DESC"); res.json({ success: true, courses: rows }); } catch (e) { res.json({ success: false, message: e.message }); }
});
app.post(['/api/pcdp/add', '/api/pcdp/master/add-course', '/api/pcdp/master/add'], async (req, res) => {
    try { await verifyPCDP(req.body); await promisePool.query("INSERT INTO pcdp_master_courses (course_name, description, total_levels, category, image_url) VALUES (?, ?, ?, ?, ?)", [req.body.course_name, req.body.description, req.body.total_levels || 1, req.body.category || 'General', req.body.image_url || '']); res.json({ success: true }); } catch (e) { res.json({ success: false, message: e.message }); }
});
app.post(['/api/pcdp/edit', '/api/pcdp/master/edit'], async (req, res) => {
    try { await verifyPCDP(req.body); await promisePool.query("UPDATE pcdp_master_courses SET course_name = ?, description = ?, total_levels = ?, category = ?, image_url = ? WHERE id = ?", [req.body.course_name, req.body.description, req.body.total_levels || 1, req.body.category || 'General', req.body.image_url || '', req.body.id]); res.json({ success: true }); } catch (e) { res.json({ success: false, message: e.message }); }
});
app.post(['/api/pcdp/delete', '/api/pcdp/master/delete-course', '/api/pcdp/master/delete'], async (req, res) => {
    try { await verifyPCDP(req.body); await promisePool.query("DELETE FROM pcdp_master_courses WHERE id = ?", [req.body.id]); res.json({ success: true }); } catch (e) { res.json({ success: false, message: e.message }); }
});
app.post(['/api/admin/assign-pcdp', '/api/admin/assign-course', '/api/pcdp/assign', '/api/assign-skill'], async (req, res) => {
    try {
        let isAllowed = false; try { await verifyAdmin(req.body); isAllowed = true; } catch(e) {} try { if(!isAllowed) { await verifyPCDP(req.body); isAllowed = true; } } catch(e) {} if(!isAllowed) throw new Error("Unauthorized");
        const rawEmail = req.body.targetEmail || req.body.email || req.body.student_email; if(!rawEmail) return res.json({ success: false, message: "Missing email." }); const email = rawEmail.toLowerCase();
        if (req.body.course_id) { const [courses] = await promisePool.query("SELECT * FROM pcdp_master_courses WHERE id = ?", [req.body.course_id]); if(courses.length === 0) return res.json({ success: false, message: "Course not found" }); const c = courses[0]; const [existing] = await promisePool.query("SELECT id FROM student_skills WHERE student_email = ? AND skill_name = ?", [email, c.course_name]); if(existing.length > 0) return res.json({ success: false, message: "Already assigned." }); await promisePool.query("INSERT INTO student_skills (student_email, skill_name, total_levels, completed_levels, category, image_url) VALUES (?, ?, ?, 0, ?, ?)", [email, c.course_name, c.total_levels, c.category, c.image_url]); return res.json({ success: true }); }
        res.json({ success: false, message: "Invalid data." });
    } catch (e) { res.json({ success: false, message: e.message }); }
});
app.post('/api/admin/update-skill', async (req, res) => { try { await verifyAdmin(req.body); const { id, completed_levels } = req.body; if(!id) return res.json({ success: false, message: "Missing ID" }); const [skill] = await promisePool.query("SELECT total_levels FROM student_skills WHERE id = ?", [id]); if(skill.length === 0) return res.json({ success: false, message: "Not found." }); const max = Number(skill[0].total_levels); const comp = Number(completed_levels); if (comp > max || comp < 0) return res.json({ success: false, message: "Invalid level." }); await promisePool.query(`UPDATE student_skills SET completed_levels = ? WHERE id = ?`, [comp, id]); res.json({ success: true }); } catch (e) { res.json({ success: false, message: e.message }); } });
app.post('/api/admin/remove-skill', async (req, res) => { try { await verifyAdmin(req.body); await promisePool.query("DELETE FROM student_skills WHERE id = ?", [req.body.id]); res.json({ success: true }); } catch (e) { res.json({ success: false, message: e.message }); } });

// ============================================================================
// --- STUDENT GLOBAL ROUTES ---
// ============================================================================
app.post('/api/student/update-resume', async (req, res) => { try { const ticket = await googleClient.verifyIdToken({ idToken: req.body.token, audience: CLIENT_ID }); const email = ticket.getPayload().email.toLowerCase(); await promisePool.query(`INSERT INTO placement_student_profile (student_email, resume_url) VALUES (?, ?) ON DUPLICATE KEY UPDATE resume_url = ?`, [email, req.body.resume_url, req.body.resume_url]); res.json({ success: true }); } catch(e) { res.json({ success: false, message: "Session Expired" }); } });
app.post('/api/student/all-rewards', async (req, res) => { try { await googleClient.verifyIdToken({ idToken: req.body.token, audience: CLIENT_ID }); let [rows] = await promisePool.query("SELECT full_name, roll_no, department, reward_points FROM student_profile"); res.json({ success: true, students: rows || [] }); } catch (e) { res.json({ success: false, message: "Session expired." }); } });
app.post('/api/student/set-primary', async (req, res) => { try { const ticket = await googleClient.verifyIdToken({ idToken: req.body.token, audience: CLIENT_ID }); const email = ticket.getPayload().email.toLowerCase(); await promisePool.query(`INSERT INTO placement_student_profile (student_email, offer_company, offer_role, offer_ctc, status) VALUES (?, ?, ?, ?, 'Placed') ON DUPLICATE KEY UPDATE offer_company = ?, offer_role = ?, offer_ctc = ?, status = 'Placed'`, [email, req.body.company, req.body.role, req.body.ctc, req.body.company, req.body.role, req.body.ctc]); res.json({ success: true }); } catch (e) { res.json({ success: false, message: "Session Expired" }); } });
app.post('/api/student/apply-drive', async (req, res) => { try { const ticket = await googleClient.verifyIdToken({ idToken: req.body.token, audience: CLIENT_ID }); const email = ticket.getPayload().email.toLowerCase(); const [existing] = await promisePool.query("SELECT id FROM placement_apps WHERE student_email=? AND company=? AND role=?", [email, req.body.company, req.body.role]); if(existing.length > 0) return res.json({ success: false, message: "Already applied!" }); const dateStr = new Date().toLocaleDateString('en-GB'); await promisePool.query("INSERT INTO placement_apps (student_email, company, role, date_applied, status) VALUES (?, ?, ?, ?, 'Applied')", [email, req.body.company, req.body.role, dateStr]); res.json({ success: true }); } catch(e) { res.json({ success: false, message: "Session expired" }); } });


// ============================================================================
// 🛑 ADMIN DIRECTORY & MENTOR MAPPING ROUTES (FULLY FIXED)
// ============================================================================
app.post('/api/admin/list', async (req, res) => { 
    try { 
        let isAllowed = false; try { await verifyAdmin(req.body); isAllowed = true; } catch(e) {}
        try { if(!isAllowed) { await verifyPCDP(req.body); isAllowed = true; } } catch(e) {}
        if(!isAllowed) throw new Error("Unauthorized");

        const [rows] = await promisePool.query(`SELECT sp.email, sp.full_name, sp.roll_no, sp.department, sp.cgpa, sp.mentor_id, psp.offer_company, psp.status, psp.resume_url FROM student_profile sp LEFT JOIN placement_student_profile psp ON LOWER(sp.email) = LOWER(psp.student_email) ORDER BY sp.full_name ASC`); 
        res.json({ success: true, students: rows }); 
    } catch (e) { res.json({ success: false, message: e.message }); } 
});

app.post('/api/admin/save-mentors', async (req, res) => {
    try {
        await verifyAdmin(req.body);
        const { staffId, studentEmails, unassignedEmails } = req.body;
        
        // 🛑 BULLETPROOF ARRAYS: MySQL throws errors if you pass an empty array to IN (?)
        if (studentEmails && Array.isArray(studentEmails) && studentEmails.length > 0) {
            await promisePool.query(`UPDATE student_profile SET mentor_id = ? WHERE email IN (?)`, [staffId, studentEmails]);
        }

        if (unassignedEmails && Array.isArray(unassignedEmails) && unassignedEmails.length > 0) {
            await promisePool.query(`UPDATE student_profile SET mentor_id = NULL WHERE email IN (?)`, [unassignedEmails]);
        }

        res.json({ success: true });
    } catch (e) {
        console.error("Save Mentors Error:", e);
        res.json({ success: false, message: e.message });
    }
});

app.post('/api/admin/student-data', async (req, res) => { 
    try { 
        let isAllowed = false; try { await verifyAdmin(req.body); isAllowed = true; } catch(e) {}
        try { if(!isAllowed) { await verifyPCDP(req.body); isAllowed = true; } } catch(e) {}
        if(!isAllowed) throw new Error("Unauthorized");

        const rawEmail = req.body.targetEmail || req.body.email; if(!rawEmail) throw new Error("Email not provided"); const email = rawEmail.toLowerCase(); 
        const [profile] = await promisePool.query("SELECT * FROM student_profile WHERE LOWER(email) = ?", [email]); 
        const [courses] = await promisePool.query("SELECT * FROM student_courses WHERE student_email = ? ORDER BY semester ASC", [email]); 
        const [skills] = await promisePool.query("SELECT * FROM student_skills WHERE student_email = ?", [email]); 
        const [semGpas] = await promisePool.query("SELECT semester, gpa FROM student_sem_gpa WHERE student_email = ?", [email]); 
        const [placeProfile] = await promisePool.query("SELECT * FROM placement_student_profile WHERE student_email = ?", [email]); 
        const [placeApps] = await promisePool.query("SELECT * FROM placement_apps WHERE student_email = ? ORDER BY id DESC", [email]); 
        res.json({ success: true, profile: profile[0], courses, skills, semGpas, placeProfile: placeProfile[0], placeApps }); 
    } catch (e) { res.json({ success: false, message: e.message }); } 
});

// Admin Deletes/Updates
app.post('/api/admin/delete-student', async (req, res) => { try { await verifyAdmin(req.body); const rawEmail = req.body.targetEmail || req.body.email; if(!rawEmail) return res.json({ success: false, message: "No email" }); const targetEmail = rawEmail.toLowerCase(); await promisePool.query("DELETE FROM student_profile WHERE LOWER(email) = ?", [targetEmail]); await promisePool.query("DELETE FROM student_courses WHERE LOWER(student_email) = ?", [targetEmail]); await promisePool.query("DELETE FROM student_skills WHERE LOWER(student_email) = ?", [targetEmail]); await promisePool.query("DELETE FROM student_sem_gpa WHERE LOWER(student_email) = ?", [targetEmail]); await promisePool.query("DELETE FROM placement_student_profile WHERE LOWER(student_email) = ?", [targetEmail]); await promisePool.query("DELETE FROM placement_apps WHERE LOWER(student_email) = ?", [targetEmail]); res.json({ success: true }); } catch (e) { res.json({ success: false, message: e.message }); } });
app.post('/api/admin/update-field', async (req, res) => { try { await verifyAdmin(req.body); const rawEmail = req.body.targetEmail || req.body.email; await promisePool.query(`UPDATE student_profile SET ${req.body.field} = ? WHERE LOWER(email) = LOWER(?)`, [req.body.value, rawEmail.toLowerCase()]); res.json({ success: true }); } catch (e) { res.json({ success: false, message: e.message }); } });

// ============================================================================
// 🛑 STAFF & DEPARTMENT ROUTES (CRUD)
// ============================================================================
app.post('/api/admin/staff/list', async (req, res) => { try { await verifyAdmin(req.body); const [rows] = await promisePool.query("SELECT * FROM staff_directory ORDER BY id DESC"); res.json({ success: true, staff: rows }); } catch (e) { res.json({ success: false, message: e.message }); } });
app.post('/api/admin/staff/add', async (req, res) => { try { await verifyAdmin(req.body); await promisePool.query("INSERT INTO staff_directory (name, email, role, dept) VALUES (?, ?, ?, ?)", [req.body.name, req.body.email, req.body.role, req.body.dept]); res.json({ success: true }); } catch (e) { res.json({ success: false, message: e.message }); } });
app.post('/api/admin/staff/edit', async (req, res) => { try { await verifyAdmin(req.body); await promisePool.query("UPDATE staff_directory SET name=?, email=?, role=?, dept=? WHERE id=?", [req.body.name, req.body.email, req.body.role, req.body.dept, req.body.id]); res.json({ success: true }); } catch (e) { res.json({ success: false, message: e.message }); } });
app.post('/api/admin/staff/delete', async (req, res) => { try { await verifyAdmin(req.body); await promisePool.query("DELETE FROM staff_directory WHERE id=?", [req.body.id]); res.json({ success: true }); } catch (e) { res.json({ success: false, message: e.message }); } });

app.post('/api/admin/departments/list', async (req, res) => { try { await verifyAdmin(req.body); const [rows] = await promisePool.query("SELECT * FROM departments ORDER BY id DESC"); res.json({ success: true, departments: rows }); } catch (e) { res.json({ success: false, message: e.message }); } });
app.post('/api/admin/departments/add', async (req, res) => { try { await verifyAdmin(req.body); await promisePool.query("INSERT INTO departments (name, code, students, faculty, icon, color, bg) VALUES (?, ?, ?, ?, ?, ?, ?)", [req.body.name, req.body.code, req.body.students, req.body.faculty, req.body.icon, req.body.color, req.body.bg]); res.json({ success: true }); } catch (e) { res.json({ success: false, message: e.message }); } });
app.post('/api/admin/departments/edit', async (req, res) => { try { await verifyAdmin(req.body); await promisePool.query("UPDATE departments SET name=?, code=?, students=?, faculty=? WHERE id=?", [req.body.name, req.body.code, req.body.students, req.body.faculty, req.body.id]); res.json({ success: true }); } catch (e) { res.json({ success: false, message: e.message }); } });
app.post('/api/admin/departments/delete', async (req, res) => { try { await verifyAdmin(req.body); await promisePool.query("DELETE FROM departments WHERE id=?", [req.body.id]); res.json({ success: true }); } catch (e) { res.json({ success: false, message: e.message }); } });

// ============================================================================
// --- PLACEMENT ROUTES ---
// ============================================================================
app.post('/api/admin/update-placement-profile', async (req, res) => { try { await verifyAdmin(req.body); const rawEmail = req.body.targetEmail || req.body.email; await promisePool.query(`INSERT IGNORE INTO placement_student_profile (student_email) VALUES (?)`, [rawEmail.toLowerCase()]); await promisePool.query(`UPDATE placement_student_profile SET ${req.body.field} = ? WHERE student_email = ?`, [req.body.value, rawEmail.toLowerCase()]); res.json({ success: true }); } catch (e) { res.json({ success: false, message: e.message }); } });
app.post('/api/admin/update-global-stat', async (req, res) => { try { await verifyAdmin(req.body); await promisePool.query(`UPDATE placement_global SET ${req.body.field} = ? WHERE id = 1`, [req.body.value]); res.json({ success: true }); } catch (e) { res.json({ success: false, message: e.message }); } });
app.post('/api/admin/add-drive', async (req, res) => { try { await verifyAdmin(req.body); await promisePool.query("INSERT INTO placement_drives (company, role, appeared, selected, ctc) VALUES (?, ?, ?, ?, ?)", [req.body.company, req.body.role, req.body.appeared, req.body.selected, req.body.ctc]); res.json({ success: true }); } catch (e) { res.json({ success: false, message: e.message }); } });
app.post('/api/admin/update-drive', async (req, res) => { try { await verifyAdmin(req.body); await promisePool.query(`UPDATE placement_drives SET ${req.body.field} = ? WHERE id = ?`, [req.body.value, req.body.id]); res.json({ success: true }); } catch (e) { res.json({ success: false, message: e.message }); } });
app.post('/api/admin/delete-drive', async (req, res) => { try { await verifyAdmin(req.body); await promisePool.query("DELETE FROM placement_drives WHERE id = ?", [req.body.id]); res.json({ success: true }); } catch (e) { res.json({ success: false, message: e.message }); } });

app.post('/api/drives/active-list', async (req, res) => { try { let incomingToken = req.body.token || ""; if (typeof incomingToken === 'string') incomingToken = incomingToken.replace(/['"]+/g, ''); if (incomingToken === 'custom_admin_token_pc123') { const [rows] = await promisePool.query("SELECT * FROM active_drives ORDER BY id DESC"); return res.json({ success: true, drives: rows }); } const ticket = await googleClient.verifyIdToken({ idToken: req.body.token, audience: CLIENT_ID }); const email = ticket.getPayload().email.toLowerCase(); if(email === 'sivanagu7771@gmail.com' || email === 'placement@gmail.com' || email === 'admin@gmail.com') { const [rows] = await promisePool.query("SELECT * FROM active_drives ORDER BY id DESC"); return res.json({ success: true, drives: rows }); } const localPart = email.split('@')[0]; const yearMatch = localPart.match(/\d+$/); const studentYear = yearMatch ? yearMatch[0] : 'NONE'; const [rows] = await promisePool.query("SELECT * FROM active_drives WHERE target_year = 'ALL' OR target_year = ? ORDER BY id DESC", [studentYear]); res.json({ success: true, drives: rows }); } catch (e) { res.json({ success: false, message: e.message }); } });
app.post('/api/admin/add-active-drive', async (req, res) => { try { await verifyAdmin(req.body); const ctcVal = req.body.ctc && req.body.ctc.trim() !== '' ? req.body.ctc : 'Not Disclosed'; const targetYear = req.body.target_year || 'ALL'; await promisePool.query("INSERT INTO active_drives (company_name, role, ctc, eligibility, description, deadline, target_year) VALUES (?, ?, ?, ?, ?, ?, ?)", [req.body.company_name, req.body.role, ctcVal, req.body.eligibility, req.body.description, req.body.deadline, targetYear]); res.json({ success: true }); } catch (e) { res.json({ success: false, message: e.message }); } });
app.post('/api/admin/delete-active-drive', async (req, res) => { try { await verifyAdmin(req.body); const [drive] = await promisePool.query("SELECT company_name, role FROM active_drives WHERE id = ?", [req.body.id]); if (drive.length > 0) { const comp = drive[0].company_name; const role = drive[0].role; await promisePool.query("DELETE FROM placement_apps WHERE company = ? AND role = ?", [comp, role]); await promisePool.query("UPDATE placement_student_profile SET offer_company = '--', offer_role = '--', offer_ctc = '--', status = 'Unplaced' WHERE offer_company = ? AND offer_role = ?", [comp, role]); } await promisePool.query("DELETE FROM active_drives WHERE id = ?", [req.body.id]); res.json({ success: true }); } catch (e) { res.json({ success: false, message: e.message }); } });
app.post('/api/admin/all-applications', async (req, res) => { try { await verifyAdmin(req.body); const [rows] = await promisePool.query(`SELECT pa.id as app_id, pa.student_email, pa.company, pa.role, pa.status, pa.date_applied, sp.full_name, sp.department FROM placement_apps pa JOIN student_profile sp ON pa.student_email = sp.email ORDER BY pa.id DESC`); res.json({ success: true, applications: rows }); } catch (e) { res.json({ success: false, message: e.message }); } });
app.post('/api/admin/update-app-status', async (req, res) => { try { await verifyAdmin(req.body); await promisePool.query(`UPDATE placement_apps SET status = ? WHERE id = ?`, [req.body.status, req.body.app_id]); res.json({ success: true }); } catch (e) { res.json({ success: false, message: e.message }); } });
app.post('/api/admin/mark-placed', async (req, res) => { try { await verifyAdmin(req.body); await promisePool.query(`UPDATE placement_apps SET status = ?, salary_package = ?, internship_period = ?, call_letter_url = ? WHERE id = ?`, [req.body.status, req.body.package, req.body.internship, req.body.offer_link, req.body.app_id]); if(req.body.status === 'Placed' || req.body.status === 'Selected') { const [app] = await promisePool.query(`SELECT student_email, company, role FROM placement_apps WHERE id = ?`, [req.body.app_id]); if(app.length > 0) { await promisePool.query(`INSERT INTO placement_student_profile (student_email, offer_company, offer_role, offer_ctc, status) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE offer_company = ?, offer_role = ?, offer_ctc = ?, status = ?`, [app[0].student_email, app[0].company, app[0].role, req.body.package, req.body.status, app[0].company, app[0].role, req.body.package, req.body.status]); } } res.json({ success: true }); } catch (e) { res.json({ success: false, message: e.message }); } });
app.post('/api/admin/drive-applicants', async (req, res) => { try { await verifyAdmin(req.body); const [rows] = await promisePool.query(`SELECT pa.id as app_id, pa.student_email, pa.status, pa.date_applied, sp.full_name, sp.department, sp.roll_no, psp.resume_url FROM placement_apps pa JOIN student_profile sp ON pa.student_email = sp.email LEFT JOIN placement_student_profile psp ON pa.student_email = psp.student_email WHERE pa.company = ? AND pa.role = ? ORDER BY pa.id DESC`, [req.body.company, req.body.role]); res.json({ success: true, applicants: rows }); } catch (e) { res.json({ success: false, message: e.message }); } });

// --- Announcements ---
app.post('/api/announcements/list', async (req, res) => { try { let incomingToken = req.body.token || ""; if (typeof incomingToken === 'string') incomingToken = incomingToken.replace(/['"]+/g, ''); if (incomingToken === 'custom_admin_token_pc123') { const [rows] = await promisePool.query("SELECT * FROM announcements ORDER BY date_posted DESC"); return res.json({ success: true, announcements: rows }); } const ticket = await googleClient.verifyIdToken({ idToken: req.body.token, audience: CLIENT_ID }); const email = ticket.getPayload().email.toLowerCase(); if (email === 'sivanagu7771@gmail.com' || email === 'placement@gmail.com' || email === 'admin@gmail.com') { const [rows] = await promisePool.query("SELECT * FROM announcements ORDER BY date_posted DESC"); return res.json({ success: true, announcements: rows }); } const [profile] = await promisePool.query("SELECT department FROM student_profile WHERE email = ?", [email]); const studentDept = (profile.length > 0) ? profile[0].department : 'Not Assigned'; const [rows] = await promisePool.query("SELECT * FROM announcements WHERE target_department = 'ALL' OR target_department = ? ORDER BY date_posted DESC", [studentDept]); res.json({ success: true, announcements: rows }); } catch (e) { res.json({ success: false, message: e.message }); } });
app.post('/api/admin/add-announcement', async (req, res) => { try { await verifyAdmin(req.body); await promisePool.query("INSERT INTO announcements (title, type, content, target_department) VALUES (?, ?, ?, ?)", [req.body.title, req.body.type, req.body.content, req.body.target_department || 'ALL']); res.json({ success: true }); } catch (e) { res.json({ success: false, message: e.message }); } });
app.post('/api/admin/delete-announcement', async (req, res) => { try { await verifyAdmin(req.body); await promisePool.query("DELETE FROM announcements WHERE id = ?", [req.body.id]); res.json({ success: true }); } catch (e) { res.json({ success: false, message: e.message }); } });

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 BACKEND READY ON PORT ${PORT}`));