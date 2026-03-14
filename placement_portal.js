const BASE_URL = 'https://portal-6crm.onrender.com';

let globalToken = localStorage.getItem('bit_session_token'); 
let allStudentsList = [];

if (!globalToken) window.location.href = 'index.html';

window.onload = async () => {
    try {
        const req = await fetch(`${BASE_URL}/api/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: globalToken }) });
        const data = await req.json();
        if (!data.success || !data.isAdmin) { localStorage.removeItem('bit_session_token'); window.location.href = 'index.html'; return; }
        document.getElementById('headerName').innerText = data.profile.full_name;
        document.getElementById('headerEmail').innerText = data.profile.email;
        document.getElementById('headerImage').src = data.profile.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.profile.full_name)}&background=4F46E5&color=fff`;

        fetchDirectory();
        loadAnnouncements();
    } catch (e) { window.location.href = 'index.html'; }
};

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('sidebar-overlay').classList.toggle('show'); }
function switchTab(tabId, element) { document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active')); if(element) element.classList.add('active'); document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active')); document.getElementById('view-' + tabId).classList.add('active'); if(window.innerWidth <= 768) { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebar-overlay').classList.remove('show'); } }
function signOut() { localStorage.removeItem('bit_session_token'); window.location.href = 'index.html'; }

async function fetchDirectory() {
    try {
        const req = await fetch(`${BASE_URL}/api/admin/list`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken }) });
        const data = await req.json();
        if (data.success) {
            allStudentsList = data.students;
            const deptSelect = document.getElementById('deptFilter');
            const depts = [...new Set(allStudentsList.map(s => s.department).filter(d => d))];
            deptSelect.innerHTML = '<option value="ALL">All Departments</option>';
            depts.forEach(d => { deptSelect.innerHTML += `<option value="${d}">${d}</option>`; });
            renderTable(allStudentsList);
        }
    } catch(e) { document.getElementById('student-list-tbody').innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger);">Server Error. Please refresh.</td></tr>`; }
}

function renderTable(students) {
    const tbody = document.getElementById('student-list-tbody');
    if(students.length === 0) { tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">No students found.</td></tr>`; return; }
    tbody.innerHTML = students.map(s => {
        const resumeLink = (s.resume_url && s.resume_url !== '--' && s.resume_url.trim() !== '') ? `<a href="${s.resume_url}" target="_blank" class="action-btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem; border-color: var(--primary); color: var(--primary); text-decoration: none;"><i class="fa-solid fa-file-pdf"></i> View</a>` : `<span style="font-size: 0.75rem; color: var(--text-muted); background: #f1f5f9; padding: 4px 8px; border-radius: 4px;">Not Uploaded</span>`;
        const currentStatus = s.status || 'Unplaced';
        return `<tr class="dir-row"><td style="font-weight:600; color: var(--text-main); cursor: pointer;" onclick="openStudentDetail('${s.email}', '${s.full_name}', '${s.roll_no}', '${s.department}')"><div style="display: flex; align-items: center; gap: 12px;"><img src="https://ui-avatars.com/api/?name=${encodeURIComponent(s.full_name)}&background=random&color=fff&rounded=true" style="width: 32px; height: 32px;"><div><div>${s.full_name}</div><div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 400;">${s.email} | ${s.roll_no || '--'}</div></div></div></td><td><span class="badge badge-primary">${s.department || '--'}</span></td><td style="font-weight: 600; color: var(--text-main); font-size: 0.9rem;">${s.offer_company && s.offer_company !== '--' ? s.offer_company : '<span style="color:#94a3b8; font-weight:400;">N/A</span>'}</td><td>${resumeLink}</td><td><select onchange="updateStudentStatus('${s.email}', this.value)" class="control-input" style="padding: 6px; font-size: 0.8rem; width: 120px; cursor: pointer; border-color: var(--border); font-weight: 600; color: var(--text-main);"><option value="Unplaced" ${currentStatus === 'Unplaced' ? 'selected' : ''}>Unplaced</option><option value="Ongoing" ${currentStatus === 'Ongoing' ? 'selected' : ''}>Ongoing / In-Process</option><option value="Placed" ${currentStatus === 'Placed' ? 'selected' : ''}>Placed</option><option value="Rejected" ${currentStatus === 'Rejected' ? 'selected' : ''}>Rejected</option></select></td><td><button class="action-btn btn-outline" style="padding: 6px 12px; font-size: 0.8rem;" onclick="openStudentDetail('${s.email}', '${s.full_name}', '${s.roll_no}', '${s.department}')">Full Profile <i class="fa-solid fa-arrow-right" style="margin-left: 6px;"></i></button></td></tr>`;
    }).join('');
}

async function updateStudentStatus(email, newStatus) {
    try { await fetch(`${BASE_URL}/api/admin/update-placement-profile`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, targetEmail: email, field: 'status', value: newStatus }) });
        showToast(`Profile status updated!`); const student = allStudentsList.find(s => s.email === email); if (student) student.status = newStatus;
    } catch (e) { showToast("Network Error updating status."); }
}

function filterStudents() {
    const search = document.getElementById('searchStudent').value.toLowerCase(); const dept = document.getElementById('deptFilter').value;
    const filtered = allStudentsList.filter(s => { const matchesSearch = (s.full_name && s.full_name.toLowerCase().includes(search)) || (s.email && s.email.toLowerCase().includes(search)) || (s.roll_no && s.roll_no.toLowerCase().includes(search)); const matchesDept = dept === "ALL" || s.department === dept; return matchesSearch && matchesDept; });
    renderTable(filtered);
}

// 🛑 NEW: ACTIVE DRIVES LOGIC 
async function loadActiveDrives() {
    const feed = document.getElementById('active-drives-feed');
    feed.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading Drives...</div>`;
    try {
        const req = await fetch(`${BASE_URL}/api/drives/active-list`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: globalToken }) });
        const data = await req.json();
        if (data.success) {
            if(data.drives.length === 0) { feed.innerHTML = `<div class="card" style="text-align:center; padding: 40px; color:var(--text-muted);">No active drives posted yet.</div>`; return; }
            feed.innerHTML = data.drives.map(d => `
                <div class="card" style="padding: 24px; border-left: 4px solid var(--primary);">
                    <div class="flex-between">
                        <div>
                            <h3 style="margin: 0 0 8px 0; font-size: 1.2rem; color: var(--text-main); font-weight: 800;">${d.company_name}</h3>
                            <span class="badge badge-primary">${d.role}</span>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-weight: 800; color: var(--success); font-size: 1.1rem;">${d.ctc}</div>
                            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">Deadline: ${d.deadline}</div>
                        </div>
                    </div>
                    <p style="font-size: 0.9rem; color: var(--text-muted); margin: 16px 0; line-height: 1.5; white-space: pre-wrap;">${d.description}</p>
                    <div class="flex-between" style="border-top: 1px solid var(--border); padding-top: 16px; margin-top: 16px;">
                        <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-main);"><i class="fa-solid fa-graduation-cap"></i> Eligibility: ${d.eligibility}</span>
                        <div>
                            <button class="action-btn btn-outline" style="font-size: 0.8rem; margin-right: 8px;" onclick="viewDriveApplicants('${d.company_name}', '${d.role}')">View Applicants</button>
                            <button class="action-icon cancel" onclick="deleteActiveDrive(${d.id})"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    } catch(e) { feed.innerHTML = `<div class="card" style="color:var(--danger); text-align:center;">Network Error</div>`; }
}

async function submitActiveDrive() {
    const comp = document.getElementById('ad-comp').value; const role = document.getElementById('ad-role').value; const ctc = document.getElementById('ad-ctc').value; const elig = document.getElementById('ad-elig').value; const desc = document.getElementById('ad-desc').value; const dead = document.getElementById('ad-dead').value;
    if(!comp || !role) return alert("Company and Role are required!");
    document.querySelector('#add-active-drive-modal .btn-primary').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Posting...';
    try {
        await fetch(`${BASE_URL}/api/admin/add-active-drive`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, company_name: comp, role: role, ctc: ctc, eligibility: elig, description: desc, deadline: dead }) });
    } catch(e) { alert("Error posting drive."); }
    document.getElementById('add-active-drive-modal').style.display = 'none';
    document.querySelector('#add-active-drive-modal .btn-primary').innerHTML = 'Post Drive to Students';
    loadActiveDrives();
}

async function deleteActiveDrive(id) {
    if(!confirm("Delete this active drive? Students will no longer see it.")) return;
    await fetch(`${BASE_URL}/api/admin/delete-active-drive`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, id: id }) });
    loadActiveDrives();
}

async function viewDriveApplicants(company, role) {
    document.getElementById('app-modal-title').innerText = `Applicants: ${company} - ${role}`;
    document.getElementById('view-applicants-modal').style.display = 'flex';
    document.getElementById('applicants-tbody').innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading applicants...</td></tr>`;
    
    try {
        const req = await fetch(`${BASE_URL}/api/admin/drive-applicants`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, company: company, role: role }) });
        const data = await req.json();
        
        if(data.success && data.applicants.length > 0) {
            document.getElementById('applicants-tbody').innerHTML = data.applicants.map(a => {
                const resumeLink = (a.resume_url && a.resume_url !== '--') ? `<a href="${a.resume_url}" target="_blank" style="color:var(--primary); font-weight:600; text-decoration:none;"><i class="fa-solid fa-file-pdf"></i> View</a>` : `<span style="color:var(--text-muted);">None</span>`;
                return `
                <tr>
                    <td style="font-weight:600; color: var(--text-main);"><div style="font-size:0.95rem;">${a.full_name}</div><div style="font-size:0.75rem; color:var(--text-muted); font-weight:400;">${a.student_email} | ${a.roll_no||'--'}</div></td>
                    <td><span class="badge badge-primary">${a.department || '--'}</span></td>
                    <td style="color:var(--text-muted); font-size:0.85rem;">${a.date_applied}</td>
                    <td>${resumeLink}</td>
                    <td>
                        <select onchange="updateApplicationStatus(${a.app_id}, this.value)" class="control-input" style="padding: 4px; font-size: 0.8rem; width: 130px; border-color: var(--border); font-weight: 600; color: var(--text-main);">
                            <option value="Applied" ${a.status === 'Applied' ? 'selected' : ''}>Applied (Pending)</option>
                            <option value="Shortlisted" ${a.status === 'Shortlisted' ? 'selected' : ''}>Shortlisted</option>
                            <option value="Interview" ${a.status === 'Interview' ? 'selected' : ''}>In Interview</option>
                            <option value="Selected" ${a.status === 'Selected' ? 'selected' : ''}>Selected / Placed</option>
                            <option value="Rejected" ${a.status === 'Rejected' ? 'selected' : ''}>Rejected</option>
                        </select>
                    </td>
                </tr>`;
            }).join('');
        } else {
            document.getElementById('applicants-tbody').innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">No students have applied yet.</td></tr>`;
        }
    } catch(e) { document.getElementById('applicants-tbody').innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger);">Error loading.</td></tr>`; }
}

async function updateApplicationStatus(appId, newStatus) {
    try {
        const req = await fetch(`${BASE_URL}/api/admin/update-app-status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, app_id: appId, status: newStatus }) });
        const res = await req.json();
        if(res.success) showToast("Application status updated!"); else showToast("Failed to update status.");
    } catch(e) { showToast("Network error."); }
}

async function openStudentDetail(email, name, roll_no, department) {
    document.getElementById('student-detail-modal').style.display = 'flex'; document.getElementById('modal-content-body').style.display = 'none'; document.getElementById('modal-loading').style.display = 'block'; document.getElementById('detail-name').innerText = name; document.getElementById('detail-sub').innerText = `${roll_no || 'No Roll No'} | ${department || 'No Dept'}`; document.getElementById('detail-img').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4F46E5&color=fff`;
    try { const req = await fetch(`${BASE_URL}/api/admin/student-data`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, targetEmail: email }) }); const data = await req.json(); if (data.success) { populateDetailModal(data.placeProfile || {}, data.placeApps || []); document.getElementById('modal-loading').style.display = 'none'; document.getElementById('modal-content-body').style.display = 'block'; } else { closeDetailModal(); } } catch(e) { closeDetailModal(); }
}
function closeDetailModal() { document.getElementById('student-detail-modal').style.display = 'none'; }

function populateDetailModal(prf, apps) {
    document.getElementById('val-p-role').innerText = prf.offer_role || '--'; document.getElementById('val-p-comp').innerText = prf.offer_company || '--'; document.getElementById('val-p-ctc').innerText = prf.offer_ctc || '--'; document.getElementById('val-p-status').innerText = prf.status || 'Unplaced'; document.getElementById('val-p-assess').innerText = prf.assessments || '0'; document.getElementById('val-p-int').innerText = prf.interviews || '0'; document.getElementById('val-p-off').innerText = prf.offers || '0';
    document.getElementById('val-t-dsa').innerText = prf.tech_dsa || '0'; document.getElementById('bar-t-dsa').style.width = `${prf.tech_dsa || 0}%`; document.getElementById('val-t-oop').innerText = prf.tech_oop || '0'; document.getElementById('bar-t-oop').style.width = `${prf.tech_oop || 0}%`; document.getElementById('val-t-core').innerText = prf.tech_core || '0'; document.getElementById('bar-t-core').style.width = `${prf.tech_core || 0}%`; document.getElementById('val-a-quant').innerText = prf.apt_quant || '0'; document.getElementById('bar-a-quant').style.width = `${prf.apt_quant || 0}%`; document.getElementById('val-a-log').innerText = prf.apt_logical || '0'; document.getElementById('bar-a-log').style.width = `${prf.apt_logical || 0}%`; document.getElementById('val-a-hr').innerText = prf.apt_hr || '0'; document.getElementById('bar-a-hr').style.width = `${prf.apt_hr || 0}%`;
    const appBody = document.getElementById('student-apps-tbody');
    if (apps && apps.length > 0) {
        appBody.innerHTML = apps.map(a => { let bClass = 'badge-primary'; let s = a.status.toLowerCase(); if(s.includes('select') || s.includes('offer') || s.includes('placed')) bClass = 'badge-success'; if(s.includes('clear') || s.includes('reject')) bClass = 'badge-danger'; if(s.includes('pend') || s.includes('wait')) bClass = 'badge-warning'; return `<tr><td style="font-weight: 700; color: var(--text-main);">${a.company}</td><td style="color: var(--text-muted);">${a.role}</td><td>${a.date_applied}</td><td><span class="badge ${bClass}">${a.status}</span></td></tr>`; }).join('');
    } else { appBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 30px; color:var(--text-muted);">No applications logged.</td></tr>`; }
}

async function loadAnnouncements() {
    const feed = document.getElementById('announcement-feed'); feed.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>`;
    try {
        const req = await fetch(`${BASE_URL}/api/announcements/list`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: globalToken }) }); const data = await req.json();
        if (data.success) {
            const placeAnns = data.announcements.filter(a => a.type === 'Placement Drive');
            if(placeAnns.length === 0) { feed.innerHTML = `<div class="card" style="text-align:center; padding: 40px; color:var(--text-muted);">No placement announcements posted yet.</div>`; return; }
            feed.innerHTML = placeAnns.map(ann => {
                let dateStr = new Date(ann.date_posted).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                let targetLabel = ann.target_department || 'ALL'; let deptBadge = targetLabel === 'ALL' ? `<span class="badge" style="background: #E2E8F0; color: #475569; margin-right: 10px;"><i class="fa-solid fa-globe"></i> Global Notice</span>` : `<span class="badge" style="background: var(--purple-light); color: var(--purple); margin-right: 10px;"><i class="fa-solid fa-bullseye"></i> ${targetLabel}</span>`;
                return `<div class="card" style="display: flex; gap: 20px; align-items: flex-start; padding: 24px; position: relative;"><button class="action-icon cancel" style="position: absolute; top: 16px; right: 16px;" onclick="deleteAnnouncement(${ann.id})"><i class="fa-solid fa-trash"></i></button><div style="background: var(--success-light); color: var(--success); width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;"><i class="fa-solid fa-briefcase"></i></div><div style="flex: 1; padding-right: 40px;"><h3 style="margin: 0 0 8px 0; font-size: 1.1rem; color: var(--text-main); font-weight: 800;">${ann.title}</h3><div style="margin-bottom: 12px;"><span class="badge badge-success" style="margin-right: 10px;">${ann.type}</span>${deptBadge}<span style="font-size: 0.8rem; color: var(--text-muted);"><i class="fa-regular fa-clock"></i> ${dateStr}</span></div><p style="margin: 0; color: var(--text-muted); line-height: 1.6; font-size: 0.95rem; white-space: pre-wrap;">${ann.content}</p></div></div>`;
            }).join('');
        }
    } catch(e) { feed.innerHTML = `<div class="card" style="color:var(--danger); text-align:center;">Network Error</div>`; }
}
async function submitPlacementAnnouncement() {
    const titleInput = document.getElementById('ann-title'); const contentInput = document.getElementById('ann-content'); const deptInput = document.getElementById('ann-target-dept');
    if(!titleInput || !contentInput) return;
    const title = titleInput.value.trim(); const content = contentInput.value.trim(); const targetDept = deptInput ? deptInput.value : 'ALL';
    if(!title || !content) return alert("Please enter both an Announcement Title and Content.");
    const btn = document.querySelector('#add-ann-modal .btn-primary'); const originalBtnText = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Posting...';
    try { await fetch(`${BASE_URL}/api/admin/add-announcement`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, title: title, type: 'Placement Drive', content: content, target_department: targetDept }) }); } catch(e) { alert("Network error while posting."); } finally { document.getElementById('add-ann-modal').style.display = 'none'; titleInput.value = ''; contentInput.value = ''; if(deptInput) deptInput.value = 'ALL'; btn.innerHTML = originalBtnText; loadAnnouncements(); }
}
async function deleteAnnouncement(id) { if(!confirm("Delete this announcement?")) return; await fetch(`${BASE_URL}/api/admin/delete-announcement`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, id: id }) }); loadAnnouncements(); }
function showToast(msg) { const container = document.getElementById('toast-container'); const toast = document.createElement('div'); toast.className = 'toast-msg'; toast.innerHTML = `<i class="fa-solid fa-circle-info" style="color:var(--primary);"></i> <span>${msg}</span>`; container.appendChild(toast); setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(20px)'; setTimeout(() => toast.remove(), 300); }, 3000); }