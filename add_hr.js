const mysql = require('mysql2');

const dbPool = mysql.createPool({
    host: 'mysql-32a5e69e-sivanagu7771-74ba.d.aivencloud.com',
    port: 17949, 
    user: 'avnadmin', 
    password: 'AVNS_x5GIyjOoanVqXlKMi0w', 
    database: 'defaultdb', 
    ssl: { rejectUnauthorized: false } 
});

// Here is your exact email being authorized as an HR!
const email = 'sivanagueswaramoorthy@gmail.com'; 
const company = 'Zoho';

dbPool.query(
    `INSERT INTO hr_profile (email, company_name) VALUES (?, ?) ON DUPLICATE KEY UPDATE company_name = VALUES(company_name)`, 
    [email, company],
    (err) => {
        if (err) {
            console.error("❌ Error:", err.message);
        } else {
            console.log(`✅ Success! ${email} is now officially registered as an HR for ${company}.`);
        }
        process.exit(); 
    }
);