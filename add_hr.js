const mysql = require('mysql2');

const dbPool = mysql.createPool({
    host: 'mysql-32a5e69e-sivanagu7771-74ba.d.aivencloud.com',
    port: 17949, 
    user: 'avnadmin', 
    password: 'AVNS_x5GIyjOoanVqXlKMi0w', 
    database: 'defaultdb', 
    ssl: { rejectUnauthorized: false } 
});

// The exact HR credentials you requested
const email = 'sivanagueswaramoorthy@gmail.com'; 
const company = 'Zoho';
const password = 'hr@123'; 

dbPool.query(
    `INSERT INTO hr_profile (email, company_name, password) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE company_name = VALUES(company_name), password = VALUES(password)`, 
    [email, company, password],
    (err) => {
        if (err) {
            console.error("❌ Error:", err.message);
        } else {
            console.log(`✅ Success! HR Account updated.\nEmail: ${email}\nPassword: ${password}\nCompany: ${company}`);
        }
        process.exit(); 
    }
);