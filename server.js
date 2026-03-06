const express = require('express');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library');
const mysql = require('mysql2');

const app = express();
app.use(cors()); 
app.use(express.json());

const CLIENT_ID = "159246343111-o9bv4lgk1hmmvdkef0qnq0ih9qefjhmj.apps.googleusercontent.com";
const googleClient = new OAuth2Client(CLIENT_ID);

const dbPool = mysql.createPool({
    host: 'mysql-32a5e69e-sivanagu7771-74ba.d.aivencloud.com',
    port: 17949, 
    user: 'avnadmin', 
    password: process.env.DB_PASSWORD, 
    database: 'defaultdb', 
    waitForConnections: true,
    connectionLimit: 10,
    ssl: { rejectUnauthorized: false } 
});
const promisePool = dbPool.promise();

// --- DB AUTO-INITIALIZER ---
(async function initializeDatabase() {
    try {
        await promisePool.query(`CREATE TABLE IF NOT EXISTS student_sem_gpa (id INT AUTO_INCREMENT PRIMARY KEY, student_email VARCHAR(255) NOT NULL, semester INT NOT NULL, gpa VARCHAR(10), UNIQUE KEY unique_sem (student_email, semester))`);
        await promisePool.query(`CREATE TABLE IF NOT EXISTS placement_global (id INT PRIMARY KEY, total_placed VARCHAR(50), ongoing_drives VARCHAR(50), highest_ctc VARCHAR(50), avg_ctc VARCHAR(50))`);
        await promisePool.query(`INSERT IGNORE INTO placement_global (id, total_placed, ongoing_drives, highest_ctc, avg_ctc) VALUES (1, '0', '0', '0', '0')`);
        await promisePool.query(`CREATE TABLE IF NOT EXISTS placement_drives (id INT AUTO_INCREMENT PRIMARY KEY, company VARCHAR(255), role VARCHAR(255), appeared VARCHAR(50), selected VARCHAR(50), ctc VARCHAR(50))`);
        await promisePool.query(`CREATE TABLE IF NOT EXISTS placement_student_profile (student_email VARCHAR(255) PRIMARY KEY, offer_role VARCHAR(255) DEFAULT '--', offer_company VARCHAR(255) DEFAULT '--', offer_ctc VARCHAR(50) DEFAULT '--', status VARCHAR(50) DEFAULT 'Unplaced', assessments VARCHAR(50) DEFAULT '0', interviews VARCHAR(50) DEFAULT '0', offers VARCHAR(50) DEFAULT '0', tech_dsa VARCHAR(50) DEFAULT '0', tech_oop VARCHAR(50) DEFAULT '0', tech_core VARCHAR(50) DEFAULT '0', apt_quant VARCHAR(50) DEFAULT '0', apt_logical VARCHAR(50) DEFAULT '0', apt_hr VARCHAR(50) DEFAULT '0')`);
        await promisePool.query(`CREATE TABLE IF NOT EXISTS placement_apps (id INT AUTO_INCREMENT PRIMARY KEY, student_email VARCHAR(255), company VARCHAR(255), role VARCHAR(255), date_applied VARCHAR(50), status VARCHAR(50))`);
        console.log("Database Verified: Enterprise tables ready.");
    } catch (err) { console.error("DB Init Error:", err.message); }
})();

// --- SMART LOGIN WITH AUTO-REGISTRATION ---
app.post('/api/auth', async (req, res) => {
    try {
        const ticket = await googleClient.verifyIdToken({ idToken: req.body.token, audience: CLIENT_ID });
        const payload = ticket.getPayload();
        const email = payload.email;
        const name = payload.name; // Get their actual Google Name
        const picture = payload.picture;

        // 1. STRICT DOMAIN CHECK
        // If not your admin email and not a bitsathy email, kick them out.
        if (!email.endsWith('@bitsathy.ac.in') && email.toLowerCase() !== 'sivanagu7771@gmail.com') {
            return res.status(403).json({ success: false, message: "Access Denied. You must use your official @bitsathy.ac.in email." });
        }

        const [globalStats] = await promisePool.query("SELECT * FROM placement_global WHERE id = 1");
        const [globalDrives] = await promisePool.query("SELECT * FROM placement_drives ORDER BY id DESC");

        // 2. ADMIN LOGIN
        if (email.toLowerCase() === 'sivanagu7771@gmail.com') {
            return res.json({ success: true, isAdmin: true, profile: { full_name: name, email: email, picture: picture }, globalStats: globalStats[0], globalDrives });
        }

        // 3. STUDENT LOGIN & AUTO-REGISTRATION
        let [profile] = await promisePool.query("SELECT * FROM student_profile WHERE LOWER(email) = LOWER(?)", [email]);
        
        // If they are a bitsathy student but not in the database yet, auto-create their account!
        if (profile.length === 0) {
            await promisePool.query(
                "INSERT INTO student_profile (email, full_name, department, reward_points) VALUES (?, ?, 'Not Assigned', '0')", 
                [email.toLowerCase(), name]
            );
            // Re-fetch the newly created profile
            [profile] = await promisePool.query("SELECT * FROM student_profile WHERE LOWER(email) = LOWER(?)", [email]);
        }

        // 4. FETCH STUDENT DATA
        const [courses] = await promisePool.query("SELECT * FROM student_courses WHERE student_email = ? ORDER BY semester ASC", [profile[0].email]);
        const [skills] = await promisePool.query("SELECT * FROM student_skills WHERE student_email = ?", [profile[0].email]);
        const [semGpas] = await promisePool.query("SELECT semester, gpa FROM student_sem_gpa WHERE student_email = ?", [profile[0].email]);
        const [placeProfile] = await promisePool.query("SELECT * FROM placement_student_profile WHERE student_email = ?", [profile[0].email]);
        const [placeApps] = await promisePool.query("SELECT * FROM placement_apps WHERE student_email = ? ORDER BY id DESC", [profile[0].email]);
        
        res.json({ success: true, isAdmin: false, profile: profile[0], courses, skills, semGpas, globalStats: globalStats[0], globalDrives, placeProfile: placeProfile[0], placeApps, picture: picture });
    } catch (error) { res.status(500).json({ success: false, message: "Server authentication failed." }); }
});

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
    } catch (e) { res.status(403).json({ success: false }); }
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
    } catch (e) { res.status(500).json({ success: false }); }
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
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/admin/update-sem-gpa', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        await promisePool.query("INSERT INTO student_sem_gpa (student_email, semester, gpa) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE gpa = VALUES(gpa)", [req.body.targetEmail.toLowerCase(), req.body.semester, req.body.gpa]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/admin/update-global-stat', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        await promisePool.query(`UPDATE placement_global SET ${req.body.field} = ? WHERE id = 1`, [req.body.value]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/admin/add-drive', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        await promisePool.query("INSERT INTO placement_drives (company, role, appeared, selected, ctc) VALUES (?, ?, ?, ?, ?)", [req.body.company, req.body.role, req.body.appeared, req.body.selected, req.body.ctc]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/admin/update-drive', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        await promisePool.query(`UPDATE placement_drives SET ${req.body.field} = ? WHERE id = ?`, [req.body.value, req.body.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/admin/delete-drive', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        await promisePool.query("DELETE FROM placement_drives WHERE id = ?", [req.body.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/admin/update-placement-profile', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        await promisePool.query(`INSERT IGNORE INTO placement_student_profile (student_email) VALUES (?)`, [req.body.targetEmail.toLowerCase()]);
        await promisePool.query(`UPDATE placement_student_profile SET ${req.body.field} = ? WHERE student_email = ?`, [req.body.value, req.body.targetEmail.toLowerCase()]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/admin/add-app', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        await promisePool.query("INSERT INTO placement_apps (student_email, company, role, date_applied, status) VALUES (?, ?, ?, ?, ?)", [req.body.targetEmail.toLowerCase(), req.body.company, req.body.role, req.body.date_applied, req.body.status]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/admin/update-app', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        await promisePool.query(`UPDATE placement_apps SET ${req.body.field} = ? WHERE id = ?`, [req.body.value, req.body.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/admin/delete-app', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        await promisePool.query("DELETE FROM placement_apps WHERE id = ?", [req.body.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/admin/add-student', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        const sql = `INSERT INTO student_profile (email, full_name, roll_no, department) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE full_name=VALUES(full_name), roll_no=VALUES(roll_no), department=VALUES(department)`;
        await promisePool.query(sql, [req.body.email.toLowerCase(), req.body.full_name, req.body.roll_no, req.body.department]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
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
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/admin/add-skill', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        await promisePool.query("INSERT INTO student_skills (student_email, skill_name, total_levels, completed_levels, category) VALUES (?, ?, ?, ?, ?)", [req.body.targetEmail, req.body.skill_name, req.body.total_levels, req.body.completed_levels, req.body.category]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/admin/update-skill', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        await promisePool.query(`UPDATE student_skills SET ${req.body.field} = ? WHERE id = ?`, [req.body.value, req.body.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/admin/delete-skill', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        await promisePool.query("DELETE FROM student_skills WHERE id = ?", [req.body.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/admin/add-course', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        await promisePool.query("INSERT INTO student_courses (student_email, semester, course_name, marks, grade) VALUES (?, ?, ?, ?, ?)", [req.body.targetEmail, req.body.semester, req.body.course_name, req.body.marks, req.body.grade]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/admin/update-course', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        await promisePool.query(`UPDATE student_courses SET ${req.body.field} = ? WHERE id = ?`, [req.body.value, req.body.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/admin/delete-course', async (req, res) => {
    try {
        await verifyAdmin(req.body.adminToken);
        await promisePool.query("DELETE FROM student_courses WHERE id = ?", [req.body.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`UNIFIED BACKEND ACTIVE ON PORT ${PORT}`));