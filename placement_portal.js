const BASE_URL = 'https://portal-6crm.onrender.com';

let globalToken = localStorage.getItem('bit_session_token'); 
let allStudentsList = [];
let targetStudentEmail = ""; 
let originalValues = {}; 
window.currentDriveApplicants = [];
window.allGlobalPlacements = []; // 🛑 NEW: Stores all global applications

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

function switchTab(tabId, element) { 
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active')); 
    if(element) element.classList.add('active'); 
    document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active')); 
    document.getElementById('view-' + tabId).classList.add('active'); 
    if(window.innerWidth <= 768) { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebar-overlay').classList.remove('show'); } 
}

function signOut() { localStorage.removeItem('bit_session_token'); window.location.href = 'index.html'; }

// --- STUDENT DIRECTORY ---
async function fetchDirectory() {
    try {
        const req = await fetch(`${BASE_URL}/api/admin/list`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken }) });
        const data = await req.json();
        if (data.success) {
            allStudentsList = data.students;
            const deptSelect = document.getElementById('deptFilter');
            const deptEditSelect = document.getElementById('deptEditFilter');
            const depts = [...new Set(allStudentsList.map(s => s.department).filter(d => d))];
            
            deptSelect.innerHTML = '<option value="ALL">All Departments</option>';
            deptEditSelect.innerHTML = '<option value="ALL">All Departments</option>';
            
            depts.forEach(d => { 
                deptSelect.innerHTML += `<option value="${d}">${d}</option>`; 
                deptEditSelect.innerHTML += `<option value="${d}">${d}</option>`;
            });
            
            renderTable(allStudentsList);
            renderEditTable(allStudentsList);
        }
    } catch(e) { document.getElementById('student-list-tbody').innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger);">Server Error. Please refresh.</td></tr>`; }
}

function renderTable(students) {
    const tbody = document.getElementById('student-list-tbody');
    if(students.length === 0) { tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 40px; color: var(--text-muted);">No students found.</td></tr>`; return; }
    tbody.innerHTML = students.map(s => {
        const currentStatus = s.status || 'Unplaced';
        let statusClass = 'badge-primary';
        if(currentStatus === 'Placed') statusClass = 'badge-success';
        if(currentStatus === 'Ongoing') statusClass = 'badge-warning';
        if(currentStatus === 'Rejected') statusClass = 'badge-danger';

        return `<tr class="dir-row"><td style="font-weight:600; color: var(--text-main); cursor: pointer;" onclick="openReadOnlyDetail('${s.email}', '${s.full_name}', '${s.roll_no}', '${s.department}')"><div style="display: flex; align-items: center; gap: 12px;"><img src="https://ui-avatars.com/api/?name=${encodeURIComponent(s.full_name)}&background=random&color=fff&rounded=true" style="width: 32px; height: 32px;"><div><div>${s.full_name}</div><div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 400;">${s.email} | ${s.roll_no || '--'}</div></div></div></td><td><span class="badge badge-primary">${s.department || '--'}</span></td><td><span class="badge ${statusClass}">${currentStatus}</span></td><td><button class="action-btn btn-outline" style="padding: 6px 12px; font-size: 0.8rem;" onclick="openReadOnlyDetail('${s.email}', '${s.full_name}', '${s.roll_no}', '${s.department}')">View Skills <i class="fa-solid fa-eye" style="margin-left: 6px;"></i></button></td></tr>`;
    }).join('');
}

function filterStudents() {
    const search = document.getElementById('searchStudent').value.toLowerCase(); const dept = document.getElementById('deptFilter').value;
    const filtered = allStudentsList.filter(s => { const matchesSearch = (s.full_name && s.full_name.toLowerCase().includes(search)) || (s.email && s.email.toLowerCase().includes(search)) || (s.roll_no && s.roll_no.toLowerCase().includes(search)); const matchesDept = dept === "ALL" || s.department === dept; return matchesSearch && matchesDept; });
    renderTable(filtered);
}

// --- READ ONLY MODAL (For Table View) ---
async function openReadOnlyDetail(email, name, roll_no, department) {
    document.getElementById('student-detail-modal').style.display = 'flex'; 
    document.getElementById('ro-modal-content-body').style.display = 'none'; 
    document.getElementById('ro-modal-loading').style.display = 'block'; 
    document.getElementById('ro-detail-name').innerText = name; 
    document.getElementById('ro-detail-sub').innerText = `${roll_no || 'No Roll No'} | ${department || 'No Dept'}`; 
    document.getElementById('ro-detail-img').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4F46E5&color=fff`;

    try {
        const req = await fetch(`${BASE_URL}/api/admin/student-data`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, targetEmail: email }) });
        const data = await req.json();
        if (data.success) { 
            populateReadOnlyModal(data.placeProfile || {}); 
            document.getElementById('ro-modal-loading').style.display = 'none'; 
            document.getElementById('ro-modal-content-body').style.display = 'block'; 
        } else { alert("Failed to fetch placement data."); document.getElementById('student-detail-modal').style.display = 'none'; }
    } catch(e) { alert("Network error."); document.getElementById('student-detail-modal').style.display = 'none'; }
}

function populateReadOnlyModal(prf) {
    document.getElementById('ro-t-dsa').innerText = prf.tech_dsa || '0'; document.getElementById('ro-bar-t-dsa').style.width = `${prf.tech_dsa || 0}%`; 
    document.getElementById('ro-t-oop').innerText = prf.tech_oop || '0'; document.getElementById('ro-bar-t-oop').style.width = `${prf.tech_oop || 0}%`; 
    document.getElementById('ro-t-core').innerText = prf.tech_core || '0'; document.getElementById('ro-bar-t-core').style.width = `${prf.tech_core || 0}%`; 
    document.getElementById('ro-a-quant').innerText = prf.apt_quant || '0'; document.getElementById('ro-bar-a-quant').style.width = `${prf.apt_quant || 0}%`; 
    document.getElementById('ro-a-log').innerText = prf.apt_logical || '0'; document.getElementById('ro-bar-a-log').style.width = `${prf.apt_logical || 0}%`; 
    document.getElementById('ro-a-hr').innerText = prf.apt_hr || '0'; document.getElementById('ro-bar-a-hr').style.width = `${prf.apt_hr || 0}%`;
}


// --- 🛑 NEW: STUDENT PLACEMENTS (ALL APPS) BOARD ---
async function loadAllPlacements() {
    const tbody = document.getElementById('all-placements-tbody');
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 40px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading all applications...</td></tr>`;
    
    try {
        const req = await fetch(`${BASE_URL}/api/admin/all-applications`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken }) });
        const data = await req.json();
        
        if (data.success) {
            window.allGlobalPlacements = data.applications;
            
            // Build Company Filter
            const filterDropdown = document.getElementById('placementCompanyFilter');
            const companies = [...new Set(data.applications.map(a => a.company).filter(c => c))];
            filterDropdown.innerHTML = '<option value="ALL">All Companies</option>';
            companies.forEach(c => { filterDropdown.innerHTML += `<option value="${c}">${c}</option>`; });
            
            renderAllPlacementsTable();
        }
    } catch(e) { tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--danger);">Error loading placements.</td></tr>`; }
}

function renderAllPlacementsTable() {
    const tbody = document.getElementById('all-placements-tbody');
    const selectedComp = document.getElementById('placementCompanyFilter').value;
    
    const filteredApps = selectedComp === 'ALL' 
        ? window.allGlobalPlacements 
        : window.allGlobalPlacements.filter(a => a.company === selectedComp);

    if(filteredApps.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 40px; color: var(--text-muted);">No applications found.</td></tr>`;
        return;
    }

    tbody.innerHTML = filteredApps.map(a => {
        return `
        <tr>
            <td style="font-weight:600; color: var(--text-main);"><div style="font-size:0.95rem;">${a.full_name}</div><div style="font-size:0.75rem; color:var(--text-muted); font-weight:400;">${a.student_email}</div></td>
            <td><span class="badge badge-primary" style="background:#EEF2FF; color:#4F46E5;">${a.department || '--'}</span></td>
            <td><div style="font-weight:700; color:var(--text-main);">${a.company}</div><div style="font-size:0.8rem; color:var(--text-muted);">${a.role}</div></td>
            <td>
                <select onchange="handlePlacementStatusChange(${a.app_id}, this)" class="control-input" style="padding: 6px; font-size: 0.8rem; width: 140px; border-color: var(--border); font-weight: 600; color: var(--text-main);">
                    <option value="Applied" ${a.status === 'Applied' ? 'selected' : ''}>Applied (Pending)</option>
                    <option value="Shortlisted" ${a.status === 'Shortlisted' ? 'selected' : ''}>Shortlisted</option>
                    <option value="Interview" ${a.status === 'Interview' ? 'selected' : ''}>In Interview</option>
                    <option value="Selected" ${a.status === 'Selected' ? 'selected' : ''}>Selected / Placed</option>
                    <option value="Rejected" ${a.status === 'Rejected' ? 'selected' : ''}>Rejected</option>
                </select>
            </td>
        </tr>`;
    }).join('');
}

function handlePlacementStatusChange(appId, selectElement) {
    const newStatus = selectElement.value;
    if(newStatus === 'Placed' || newStatus === 'Selected') {
        document.getElementById('placed-app-id').value = appId;
        document.getElementById('placed-status-val').value = newStatus;
        document.getElementById('mark-placed-modal').style.display = 'flex';
    } else {
        updateApplicationStatus(appId, newStatus);
    }
}

async function updateApplicationStatus(appId, newStatus) {
    try {
        await fetch(`${BASE_URL}/api/admin/update-app-status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, app_id: appId, status: newStatus }) });
        showToast("Application status updated!");
    } catch(e) { showToast("Network error."); }
}

async function submitPlacedDetails() {
    const appId = document.getElementById('placed-app-id').value;
    const status = document.getElementById('placed-status-val').value;
    const pack = document.getElementById('placed-package').value || '--';
    const intern = document.getElementById('placed-internship').value || '--';
    const link = document.getElementById('placed-offer-link').value || '';

    const btn = document.querySelector('#mark-placed-modal .btn-success');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

    try {
        await fetch(`${BASE_URL}/api/admin/mark-placed`, { 
            method: 'POST', headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ adminToken: globalToken, app_id: appId, status: status, package: pack, internship: intern, offer_link: link }) 
        });
        showToast("Placement Record Saved Successfully!");
    } catch(e) { alert("Error saving placement details."); }

    document.getElementById('mark-placed-modal').style.display = 'none';
    btn.innerHTML = 'Save Placement Record';
    loadAllPlacements(); // Refresh table
}


// --- STUDENT LOGIN & EDITING GATEWAY ---
function loginAsStudent() {
    const loginId = document.getElementById('edit-login-id').value.trim();
    const password = document.getElementById('edit-login-pass').value.trim();
    
    if(loginId === "1234" && password === "ed@123") {
        document.getElementById('nav-student-login').style.display = 'none';
        const editNav = document.getElementById('nav-edit-list');
        editNav.style.display = 'flex';
        switchTab('edit-list', editNav);
        
        document.getElementById('edit-login-id').value = '';
        document.getElementById('edit-login-pass').value = '';
    } else {
        alert("Invalid Login ID or Password! Access Denied.");
    }
}

function lockEditor() {
    document.getElementById('nav-student-login').style.display = 'flex';
    document.getElementById('nav-edit-list').style.display = 'none';
    switchTab('student-login', document.getElementById('nav-student-login'));
}

function renderEditTable(students) {
    const tbody = document.getElementById('edit-student-list-tbody');
    if(students.length === 0) { tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 40px; color: var(--text-muted);">No students found.</td></tr>`; return; }
    tbody.innerHTML = students.map(s => {
        return `
        <tr class="dir-row">
            <td style="font-weight:600; color: var(--text-main);"><div style="display: flex; align-items: center; gap: 12px;"><img src="https://ui-avatars.com/api/?name=${encodeURIComponent(s.full_name)}&background=random&color=fff&rounded=true" style="width: 32px; height: 32px;"><div>${s.full_name}</div></div></td>
            <td style="color: var(--text-muted); font-size: 0.9rem;">${s.email}</td>
            <td><span class="badge badge-primary">${s.department || '--'}</span></td>
            <td style="text-align: right;"><button class="action-btn btn-outline" style="padding: 6px 12px; font-size: 0.8rem;" onclick="openEditableStudentDetail('${s.email}', '${s.full_name}', '${s.roll_no}', '${s.department}')">Edit Skills <i class="fa-solid fa-pen" style="margin-left: 6px;"></i></button></td>
        </tr>`;
    }).join('');
}

function filterEditStudents() {
    const search = document.getElementById('searchEditStudent').value.toLowerCase(); 
    const dept = document.getElementById('deptEditFilter').value;
    const filtered = allStudentsList.filter(s => { const matchesSearch = (s.full_name && s.full_name.toLowerCase().includes(search)) || (s.email && s.email.toLowerCase().includes(search)); const matchesDept = dept === "ALL" || s.department === dept; return matchesSearch && matchesDept; });
    renderEditTable(filtered);
}

// Modals
async function openEditableStudentDetail(email, name, roll_no, department) {
    targetStudentEmail = email;
    document.getElementById('edit-student-modal').style.display = 'flex';
    document.getElementById('edit-modal-content-body').style.display = 'none';
    document.getElementById('edit-modal-loading').style.display = 'block';

    if (name) {
        document.getElementById('edit-detail-name').innerText = name;
        document.getElementById('edit-detail-sub').innerText = `${roll_no || 'No Roll No'} | ${department || 'No Dept'}`;
        document.getElementById('edit-detail-img').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4F46E5&color=fff`;
    }

    try {
        const req = await fetch(`${BASE_URL}/api/admin/student-data`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, targetEmail: email }) });
        const data = await req.json();
        if (data.success) { 
            populatePerformance(data.placeProfile || {}); 
            document.getElementById('edit-modal-loading').style.display = 'none';
            document.getElementById('edit-modal-content-body').style.display = 'block';
        } else { alert("Failed to fetch placement data."); document.getElementById('edit-student-modal').style.display = 'none'; }
    } catch(e) { alert("Network error."); document.getElementById('edit-student-modal').style.display = 'none'; }
}

function populatePerformance(prf) {
    document.getElementById('val-t-dsa').innerText = prf.tech_dsa || '0'; document.getElementById('bar-t-dsa').style.width = `${prf.tech_dsa || 0}%`; 
    document.getElementById('val-t-oop').innerText = prf.tech_oop || '0'; document.getElementById('bar-t-oop').style.width = `${prf.tech_oop || 0}%`; 
    document.getElementById('val-t-core').innerText = prf.tech_core || '0'; document.getElementById('bar-t-core').style.width = `${prf.tech_core || 0}%`; 
    document.getElementById('val-a-quant').innerText = prf.apt_quant || '0'; document.getElementById('bar-a-quant').style.width = `${prf.apt_quant || 0}%`; 
    document.getElementById('val-a-log').innerText = prf.apt_logical || '0'; document.getElementById('bar-a-log').style.width = `${prf.apt_logical || 0}%`; 
    document.getElementById('val-a-hr').innerText = prf.apt_hr || '0'; document.getElementById('bar-a-hr').style.width = `${prf.apt_hr || 0}%`;
}

function openPlacementProfileEdit(field, spanId, width) {
    const span = document.getElementById(spanId); originalValues[spanId] = span.innerText.trim();
    span.parentElement.innerHTML = `<div class="flex-center" style="width: 100%;"><input type="text" id="in-${spanId}" class="inline-input" style="width: ${width}; color: var(--text-main);" value="${originalValues[spanId]}"><i class="fa-solid fa-check action-icon save" style="width:28px; height:28px;" onclick="savePlacementProfileEdit('${field}', '${spanId}', '${width}')"></i><i class="fa-solid fa-xmark action-icon cancel" style="width:28px; height:28px;" onclick="cancelPlacementProfileEdit('${spanId}', '${field}', '${width}')"></i></div>`;
}
function cancelPlacementProfileEdit(spanId, field, width) {
    const wrapper = document.getElementById(`in-${spanId}`).parentElement.parentElement;
    wrapper.innerHTML = `<span id="${spanId}">${originalValues[spanId]}</span><i class="fa-solid fa-pen admin-table-edit" onclick="openPlacementProfileEdit('${field}', '${spanId}', '${width}')"></i>`;
}
async function savePlacementProfileEdit(field, spanId, width) {
    const val = document.getElementById(`in-${spanId}`).value; 
    const wrapper = document.getElementById(`in-${spanId}`).parentElement.parentElement;
    wrapper.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color: var(--primary);"></i>`;
    try {
        await fetch(`${BASE_URL}/api/admin/update-placement-profile`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, targetEmail: targetStudentEmail, field: field, value: val }) });
        wrapper.innerHTML = `<span id="${spanId}">${val}</span><i class="fa-solid fa-pen admin-table-edit" onclick="openPlacementProfileEdit('${field}', '${spanId}', '${width}')"></i>`;
    } catch(e) { cancelPlacementProfileEdit(spanId, field, width); }
}


// --- ACTIVE DRIVES LOGIC ---
async function loadActiveDrives() {
    const feed = document.getElementById('active-drives-feed');
    feed.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading Drives...</div>`;
    try {
        const req = await fetch(`${BASE_URL}/api/drives/active-list`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: globalToken }) });
        const data = await req.json();
        if (data.success) {
            if(data.drives.length === 0) { feed.innerHTML = `<div class="card" style="text-align:center; padding: 40px; color:var(--text-muted);">No active drives posted yet.</div>`; return; }
            
            feed.innerHTML = data.drives.map(d => {
                let isExpired = false;
                let displayDate = d.deadline;
                if(d.deadline && d.deadline.includes('-')) {
                    const deadDate = new Date(d.deadline);
                    displayDate = deadDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                    deadDate.setHours(23, 59, 59, 999);
                    if(deadDate < new Date()) isExpired = true;
                }
                const expiredBadge = isExpired ? `<span class="badge badge-danger" style="margin-left: 8px;">Expired</span>` : '';
                const targetBadge = d.target_year !== 'ALL' ? `<span class="badge" style="background:var(--purple-light); color:var(--purple); margin-left: 8px;"><i class="fa-solid fa-bullseye"></i> Batch '${d.target_year}</span>` : '';

                return `<div class="card" style="padding: 24px; border-left: 4px solid var(--primary); opacity: ${isExpired ? '0.7' : '1'};"><div class="flex-between"><div><h3 style="margin: 0 0 8px 0; font-size: 1.2rem; color: var(--text-main); font-weight: 800;">${d.company_name}</h3><span class="badge badge-primary">${d.role}</span>${targetBadge}${expiredBadge}</div><div style="text-align: right;"><div style="font-weight: 800; color: var(--success); font-size: 1.1rem;">${d.ctc}</div><div style="font-size: 0.8rem; color: ${isExpired ? 'var(--danger)' : 'var(--text-muted)'}; margin-top: 4px;">Deadline: ${displayDate}</div></div></div><p style="font-size: 0.9rem; color: var(--text-muted); margin: 16px 0; line-height: 1.5; white-space: pre-wrap;">${d.description}</p><div class="flex-between" style="border-top: 1px solid var(--border); padding-top: 16px; margin-top: 16px;"><span style="font-size: 0.85rem; font-weight: 600; color: var(--text-main);"><i class="fa-solid fa-graduation-cap"></i> Eligibility: ${d.eligibility}</span><div><button class="action-btn btn-outline" style="font-size: 0.8rem; margin-right: 8px;" onclick="switchTab('all-placements', document.getElementById('nav-all-placements')); loadAllPlacements();">View Apps in Placements Tab</button><button class="action-icon cancel" onclick="deleteActiveDrive(${d.id})"><i class="fa-solid fa-trash"></i></button></div></div></div>`;
            }).join('');
        }
    } catch(e) { feed.innerHTML = `<div class="card" style="color:var(--danger); text-align:center;">Network Error</div>`; }
}

async function submitActiveDrive() {
    const comp = document.getElementById('ad-comp').value; const role = document.getElementById('ad-role').value; const ctc = document.getElementById('ad-ctc').value; const elig = document.getElementById('ad-elig').value; const desc = document.getElementById('ad-desc').value; const dead = document.getElementById('ad-dead').value; const targetYr = document.getElementById('ad-year').value;
    if(!comp || !role || !dead) return alert("Company, Role, and Deadline are required!");
    document.querySelector('#add-active-drive-modal .btn-primary').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Posting...';
    try { await fetch(`${BASE_URL}/api/admin/add-active-drive`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, company_name: comp, role: role, ctc: ctc, eligibility: elig, description: desc, deadline: dead, target_year: targetYr }) }); } catch(e) { alert("Error posting drive."); }
    document.getElementById('add-active-drive-modal').style.display = 'none'; document.querySelector('#add-active-drive-modal .btn-primary').innerHTML = 'Post Drive to Students'; loadActiveDrives();
}

async function deleteActiveDrive(id) {
    if(!confirm("Delete this active drive? Students will no longer see it.")) return;
    await fetch(`${BASE_URL}/api/admin/delete-active-drive`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, id: id }) }); loadActiveDrives();
}

// --- ANNOUNCEMENTS LOGIC ---
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