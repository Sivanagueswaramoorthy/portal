// SMART URL
const BASE_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') 
    ? 'http://localhost:10000' 
    : 'https://portal-6crm.onrender.com';

const hrToken = localStorage.getItem('hr_session_token');

if (!hrToken) {
    window.location.href = 'index.html';
} else {
    window.onload = initializeHRPortal;
}

async function initializeHRPortal() {
    try {
        const req = await fetch(`${BASE_URL}/api/hr/verify`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ token: hrToken }) 
        });
        
        if (!req.ok) throw new Error("Server not responding");

        const data = await req.json();
        
        if (!data.success) { 
            signOut(); 
            return; 
        }
        
        if(document.getElementById('headerName')) document.getElementById('headerName').innerText = "Recruiter"; 
        if(document.getElementById('headerEmail')) document.getElementById('headerEmail').innerText = data.email; 
        if(document.getElementById('hr-company')) document.getElementById('hr-company').innerText = data.company;
        if(document.getElementById('headerImage')) document.getElementById('headerImage').src = "https://ui-avatars.com/api/?name=HR&background=4F46E5&color=fff"; 

        fetchApplicants();
    } catch (e) { 
        console.error("Dashboard Error:", e);
        document.getElementById('hr-applicants-tbody').innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--danger); font-weight: bold;">Connection lost. Is backend running?</td></tr>`;
    }
}

async function fetchApplicants() {
    const tbody = document.getElementById('hr-applicants-tbody');
    try {
        const req = await fetch(`${BASE_URL}/api/hr/applicants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: hrToken })
        });
        const data = await req.json();

        if (data.success) {
            if(data.applicants.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">No candidates have applied to your company yet.</td></tr>`;
                return;
            }

            tbody.innerHTML = data.applicants.map(a => {
                let resumeBtn = a.resume_url && a.resume_url !== '--' 
                    ? `<a href="${a.resume_url}" target="_blank" class="action-btn btn-primary" style="padding: 6px 12px; font-size: 0.75rem;"><i class="fa-solid fa-file-pdf"></i> View Resume</a>`
                    : `<span style="font-size: 0.7rem; color: var(--danger); font-weight: 700;">No Resume</span>`;

                return `
                <tr class="dir-row">
                    <td>
                        <div style="font-weight: 700; color: var(--text-main);">${a.full_name}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">${a.roll_no || '--'} | ${a.email}</div>
                    </td>
                    <td><span class="badge badge-primary">${a.department || '--'}</span></td>
                    <td style="font-weight: 600; color: var(--text-main);">${a.role}</td>
                    <td style="font-size: 0.8rem; font-weight: 700;">
                        <span style="color:var(--primary);">${a.tech_dsa || 0}%</span> / 
                        <span style="color:var(--success);">${a.tech_oop || 0}%</span> / 
                        <span style="color:var(--warning);">${a.tech_core || 0}%</span>
                    </td>
                    <td><span class="badge badge-warning">${a.status}</span></td>
                    <td>${resumeBtn}</td>
                </tr>`;
            }).join('');
        }
    } catch(e) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--danger); font-weight: bold;">Failed to load candidates. Server disconnected.</td></tr>`;
    }
}

function signOut() { 
    localStorage.removeItem('hr_session_token'); 
    window.location.href = 'index.html'; 
}