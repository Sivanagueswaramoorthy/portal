let globalToken = localStorage.getItem('bit_session_token');
const BASE_URL = 'https://portal-6crm.onrender.com';

if (!globalToken) window.location.href = 'index.html';

window.onload = async () => {
    try {
        const req = await fetch(`${BASE_URL}/api/auth`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ token: globalToken }) 
        });
        const data = await req.json();
        
        if (!data.success || !data.isHR) { 
            signOut(); return; 
        }
        
        document.getElementById('headerName').innerText = data.name; 
        document.getElementById('headerEmail').innerText = data.email; 
        document.getElementById('headerImage').src = data.picture; 
        document.getElementById('hr-company').innerText = data.hrData.company_name;

        fetchApplicants();
    } catch (e) { signOut(); }
};

async function fetchApplicants() {
    const tbody = document.getElementById('hr-applicants-tbody');
    try {
        const req = await fetch(`${BASE_URL}/api/hr/applicants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: globalToken })
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
                    : `<span style="font-size: 0.7rem; color: var(--danger); font-weight: 700;">No Resume Uploaded</span>`;

                return `
                <tr class="dir-row">
                    <td>
                        <div style="font-weight: 700; color: var(--text-main);">${a.full_name}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">${a.roll_no} | ${a.email}</div>
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
        } else {
            signOut();
        }
    } catch(e) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--danger);">Failed to load candidates. Server might be sleeping.</td></tr>`;
    }
}

function signOut() { localStorage.removeItem('bit_session_token'); window.location.href = 'index.html'; }