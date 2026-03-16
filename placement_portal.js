const BASE_URL = 'https://portal-6crm.onrender.com';

let globalToken = localStorage.getItem('bit_session_token'); 
if (globalToken) { globalToken = globalToken.replace(/['"]+/g, ''); } 
else { window.location.href = 'index.html'; }

let allStudentsList = [];
let targetStudentEmail = ""; 
let originalValues = {}; 
window.currentDriveApplicants = [];
window.allGlobalPlacements = []; 
window.globalDrivesList = [];

// Helper to prevent HTML button breaks
const esc = (str) => (str || '--').toString().replace(/'/g, "\\'").replace(/"/g, '&quot;');

window.onload = async () => {
    try {
        const req = await fetch(`${BASE_URL}/api/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: globalToken }) });
        if (!req.ok) throw new Error("HTTP Error " + req.status);
        const data = await req.json();
        
        if (!data.success || !data.isAdmin) { 
            alert(`Authentication Failed: ${data.message || 'Not authorized'}`);
            localStorage.removeItem('bit_session_token'); 
            window.location.href = 'index.html'; 
            return; 
        }

        // Safe DOM Updates
        if(document.getElementById('headerName')) document.getElementById('headerName').innerText = data.profile.full_name || 'Admin';
        if(document.getElementById('headerEmail')) document.getElementById('headerEmail').innerText = data.profile.email || '';
        if(document.getElementById('headerImage')) document.getElementById('headerImage').src = data.profile.picture || `https://ui-avatars.com/api/?name=Admin&background=4F46E5&color=fff`;

        // Load Data Silently
        try { populateGlobalPlacement(data.globalStats, data.globalDrives); } catch(e){}
        try { await fetchDirectory(); } catch(e){}
        try { loadAnnouncements(); } catch(e){}
        try { loadAllPlacements(); } catch(e){}
        try { loadActiveDrives(); } catch(e){}

    } catch (e) { 
        console.error("Dashboard Load Error:", e);
        alert("Warning: Could not connect to the backend. Please refresh the page.");
    }
};

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('sidebar-overlay').classList.toggle('show'); }

function switchTab(tabId, element) { 
    if (tabId !== 'edit-list' && tabId !== 'edit-detail' && tabId !== 'student-login') {
        if(document.getElementById('nav-student-login')) document.getElementById('nav-student-login').style.display = 'flex';
        if(document.getElementById('nav-edit-list')) document.getElementById('nav-edit-list').style.display = 'none';
        if(document.getElementById('nav-edit-detail')) document.getElementById('nav-edit-detail').style.display = 'none';
        if(document.getElementById('edit-login-id')) document.getElementById('edit-login-id').value = '';
        if(document.getElementById('edit-login-pass')) document.getElementById('edit-login-pass').value = '';
    }

    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active')); 
    if(element) element.classList.add('active'); 
    document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active')); 
    
    const targetView = document.getElementById('view-' + tabId);
    if(targetView) targetView.classList.add('active'); 
    
    const titles = {
        'dashboard': 'Dashboard Overview', 'students': 'Student Management', 'companies': 'Company Management',
        'drives': 'Job / Internship Drives', 'applications': 'Applications Management', 'statistics': 'Placement Statistics',
        'events': 'Events / Training', 'announcements': 'Notifications / Updates', 'eligibility': 'Eligibility Criteria', 'settings': 'Admin Settings',
        'analysis-list': 'Student Analysis Dashboard', 'analysis-detail': 'Student Profile Analysis'
    };
    if(titles[tabId] && document.getElementById('top-title-bar')) document.getElementById('top-title-bar').innerText = titles[tabId];

    try {
        if (tabId === 'dashboard') updateDashboardOverview();
        if (tabId === 'students' || tabId === 'edit-list' || tabId === 'analysis-list') fetchDirectory();
        if (tabId === 'companies' || tabId === 'drives') loadActiveDrives();
        if (tabId === 'applications') loadAllPlacements();
        if (tabId === 'statistics') refreshGlobalPlacementData();
        if (tabId === 'announcements') loadAnnouncements();
    } catch(e) {}

    if(window.innerWidth <= 768) { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebar-overlay').classList.remove('show'); } 
}

function signOut() { localStorage.removeItem('bit_session_token'); window.location.href = 'index.html'; }

// --- DASHBOARD UPDATER ---
function updateDashboardOverview() {
    if(document.getElementById('dash-total-students')) document.getElementById('dash-total-students').innerText = allStudentsList.length || '0';
    const placed = allStudentsList.filter(s => s.status === 'Placed' || s.status === 'Selected').length;
    if(document.getElementById('dash-placed-students')) document.getElementById('dash-placed-students').innerText = placed || '0';
    
    const tbody = document.getElementById('dash-recent-apps-tbody');
    if(tbody) {
        if(window.allGlobalPlacements && window.allGlobalPlacements.length > 0) {
            const recent = window.allGlobalPlacements.slice(0, 5);
            tbody.innerHTML = recent.map(a => {
                let bClass = 'badge-primary'; let s = (a.status || '').toLowerCase(); 
                if(s.includes('select') || s.includes('plac')) bClass = 'badge-success'; 
                if(s.includes('clear') || s.includes('reject')) bClass = 'badge-danger'; 
                if(s.includes('pend') || s.includes('short')) bClass = 'badge-warning'; 
                return `<tr><td style="font-weight:600; font-size:0.85rem;">${a.full_name}</td><td style="font-size:0.85rem;">${a.company}</td><td><span class="badge ${bClass}" style="font-size:0.7rem;">${a.status}</span></td></tr>`;
            }).join('');
        } else {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 20px; color:var(--text-muted); font-size:0.85rem;">No recent applications.</td></tr>`;
        }
    }
}

// --- 1. STUDENT MANAGEMENT DB ---
async function fetchDirectory() {
    try {
        const req = await fetch(`${BASE_URL}/api/admin/list`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken }) });
        const data = await req.json();
        
        if (data.success) {
            allStudentsList = data.students;
            const deptSelect = document.getElementById('deptFilter');
            const deptEditSelect = document.getElementById('deptEditFilter');
            const deptAnalysisSelect = document.getElementById('deptAnalysisFilter');
            
            const depts = [...new Set(allStudentsList.map(s => s.department).filter(d => d))];
            
            let allYears = new Set();
            allStudentsList.forEach(s => {
                const yMatch = (s.email || '').split('@')[0].match(/\d{2}$/);
                if(yMatch) allYears.add(yMatch[0]);
            });
            const years = [...allYears].sort();

            let deptOpts = '<option value="ALL">All Departments</option>' + depts.map(d => `<option value="${d}">${d}</option>`).join('');
            let yearOpts = '<option value="ALL">All Batch Years</option>' + years.map(y => `<option value="${y}">Batch '${y}</option>`).join('');
            
            if(deptSelect) deptSelect.innerHTML = deptOpts;
            if(deptEditSelect) deptEditSelect.innerHTML = deptOpts;
            if(deptAnalysisSelect) deptAnalysisSelect.innerHTML = deptOpts;
            
            if(document.getElementById('yearEditFilter')) document.getElementById('yearEditFilter').innerHTML = yearOpts;
            if(document.getElementById('yearAnalysisFilter')) document.getElementById('yearAnalysisFilter').innerHTML = yearOpts;
            
            renderTable(allStudentsList);
            if(document.getElementById('analysis-list-tbody')) renderAnalysisTable(allStudentsList);
            if(document.getElementById('edit-student-list-tbody')) renderEditTable(allStudentsList);
            updateDashboardOverview();
        }
    } catch(e) {}
}

function renderTable(students) {
    const tbody = document.getElementById('student-list-tbody');
    if(!tbody) return;
    if(students.length === 0) { tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">No students found.</td></tr>`; return; }
    tbody.innerHTML = students.map(s => {
        const resumeLink = (s.resume_url && s.resume_url !== '--' && s.resume_url.trim() !== '') ? `<a href="${s.resume_url}" target="_blank" class="action-btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem; border-color: var(--primary); color: var(--primary); text-decoration: none;"><i class="fa-solid fa-file-pdf"></i> View</a>` : `<span style="font-size: 0.75rem; color: var(--text-muted); background: #f1f5f9; padding: 4px 8px; border-radius: 4px;">Not Uploaded</span>`;
        const cgpa = s.cgpa ? parseFloat(s.cgpa).toFixed(2) : '--';

        return `<tr class="dir-row">
            <td style="font-weight:600; color: var(--text-main); cursor: pointer;" onclick="openReadOnlyDetail('${esc(s.email)}', '${esc(s.full_name)}', '${esc(s.roll_no)}', '${esc(s.department)}')"><div style="display: flex; align-items: center; gap: 12px;"><img src="https://ui-avatars.com/api/?name=${encodeURIComponent(s.full_name)}&background=random&color=fff&rounded=true" style="width: 32px; height: 32px;"><div>${s.full_name}<div style="font-size:0.75rem; color:var(--text-muted); font-weight:400;">${s.email}</div></div></div></td>
            <td style="font-family: monospace;">${s.roll_no || '--'}</td>
            <td><span class="badge badge-primary">${s.department || '--'}</span></td>
            <td style="font-weight: 700; color: var(--primary);">${cgpa}</td>
            <td>${resumeLink}</td>
            <td>
                <div style="display: flex; gap: 8px;">
                    <button class="action-btn btn-outline" style="padding: 4px 10px; font-size: 0.75rem; border-color: var(--primary); color: var(--primary);" onclick="openReadOnlyDetail('${esc(s.email)}', '${esc(s.full_name)}', '${esc(s.roll_no)}', '${esc(s.department)}')"><i class="fa-solid fa-eye"></i> View</button>
                    <button class="action-btn btn-outline" style="padding: 4px 10px; font-size: 0.75rem; border-color: var(--danger); color: var(--danger);" onclick="deleteStudent('${esc(s.email)}', '${esc(s.full_name)}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function filterStudents() {
    const search = document.getElementById('searchStudent').value.toLowerCase(); const dept = document.getElementById('deptFilter').value;
    const filtered = allStudentsList.filter(s => { const matchesSearch = ((s.full_name||'').toLowerCase().includes(search)) || ((s.email||'').toLowerCase().includes(search)) || ((s.roll_no||'').toLowerCase().includes(search)); const matchesDept = dept === "ALL" || s.department === dept; return matchesSearch && matchesDept; });
    renderTable(filtered);
}

async function deleteStudent(email, name) {
    if(!confirm(`⚠️ CRITICAL WARNING: Are you sure you want to completely delete ${name} (${email})?\n\nThis will erase their profile, academic records, skills, and ALL placement applications. This CANNOT be undone.`)) return;

    try {
        const req = await fetch(`${BASE_URL}/api/admin/delete-student`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminToken: globalToken, targetEmail: email })
        });
        const res = await req.json();
        
        if(res.success) {
            alert(`✅ ${name} has been deleted.`);
            fetchDirectory(); 
            loadAllPlacements(); 
        } else { alert("❌ Failed to delete student."); }
    } catch(e) { alert("Network error while trying to delete."); }
}

// 🛑 READ-ONLY QUICK VIEW MODAL
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
            populateReadOnlyModal(data.placeProfile || {}, data.placeApps || []); 
            document.getElementById('ro-modal-loading').style.display = 'none'; 
            document.getElementById('ro-modal-content-body').style.display = 'block'; 
        } else { alert("Failed to fetch placement data."); document.getElementById('student-detail-modal').style.display = 'none'; }
    } catch(e) { alert("Network error."); document.getElementById('student-detail-modal').style.display = 'none'; }
}

function populateReadOnlyModal(prf, apps) {
    if(document.getElementById('ro-p-role')) document.getElementById('ro-p-role').innerText = prf.offer_role || '--'; 
    if(document.getElementById('ro-p-comp')) document.getElementById('ro-p-comp').innerText = prf.offer_company || '--'; 
    if(document.getElementById('ro-p-ctc')) document.getElementById('ro-p-ctc').innerText = prf.offer_ctc || '--'; 
    if(document.getElementById('ro-p-status')) document.getElementById('ro-p-status').innerText = prf.status || 'Unplaced'; 
    if(document.getElementById('ro-p-assess')) document.getElementById('ro-p-assess').innerText = prf.assessments || '0'; 
    if(document.getElementById('ro-p-int')) document.getElementById('ro-p-int').innerText = prf.interviews || '0'; 
    if(document.getElementById('ro-p-off')) document.getElementById('ro-p-off').innerText = prf.offers || '0';

    if(document.getElementById('ro-t-dsa')) document.getElementById('ro-t-dsa').innerText = prf.tech_dsa || '0'; 
    if(document.getElementById('ro-bar-t-dsa')) document.getElementById('ro-bar-t-dsa').style.width = `${prf.tech_dsa || 0}%`; 
    if(document.getElementById('ro-t-oop')) document.getElementById('ro-t-oop').innerText = prf.tech_oop || '0'; 
    if(document.getElementById('ro-bar-t-oop')) document.getElementById('ro-bar-t-oop').style.width = `${prf.tech_oop || 0}%`; 
    if(document.getElementById('ro-t-core')) document.getElementById('ro-t-core').innerText = prf.tech_core || '0'; 
    if(document.getElementById('ro-bar-t-core')) document.getElementById('ro-bar-t-core').style.width = `${prf.tech_core || 0}%`; 
    if(document.getElementById('ro-a-quant')) document.getElementById('ro-a-quant').innerText = prf.apt_quant || '0'; 
    if(document.getElementById('ro-bar-a-quant')) document.getElementById('ro-bar-a-quant').style.width = `${prf.apt_quant || 0}%`; 
    if(document.getElementById('ro-a-log')) document.getElementById('ro-a-log').innerText = prf.apt_logical || '0'; 
    if(document.getElementById('ro-bar-a-log')) document.getElementById('ro-bar-a-log').style.width = `${prf.apt_logical || 0}%`; 
    if(document.getElementById('ro-a-hr')) document.getElementById('ro-a-hr').innerText = prf.apt_hr || '0'; 
    if(document.getElementById('ro-bar-a-hr')) document.getElementById('ro-bar-a-hr').style.width = `${prf.apt_hr || 0}%`;

    const appBody = document.getElementById('ro-student-apps-tbody');
    if(!appBody) return;
    if (apps && apps.length > 0) {
        appBody.innerHTML = apps.map(a => { 
            let bClass = 'badge-primary'; let s = (a.status || '').toLowerCase(); 
            if(s.includes('select') || s.includes('offer') || s.includes('placed')) bClass = 'badge-success'; 
            if(s.includes('clear') || s.includes('reject')) bClass = 'badge-danger'; 
            if(s.includes('pend') || s.includes('wait') || s.includes('short')) bClass = 'badge-warning'; 
            
            const ctcBadge = (a.salary_package && a.salary_package !== '--') ? `<span style="display: inline-flex; align-items: center; gap: 4px; background: #DCFCE7; color: #166534; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 700;"><i class="fa-solid fa-sack-dollar"></i> ${a.salary_package}</span>` : '';
            const internBadge = (a.internship_period && a.internship_period !== '--') ? `<span style="display: inline-flex; align-items: center; gap: 4px; background: #E0E7FF; color: #3730A3; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 700;"><i class="fa-solid fa-stopwatch"></i> ${a.internship_period}</span>` : '';
            const extraDetails = (ctcBadge || internBadge) ? `<div style="display: flex; gap: 8px; margin-top: 6px;">${ctcBadge}${internBadge}</div>` : '';
            
            return `<tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 16px 24px;"><div style="font-weight: 800; color: #1E293B; font-size: 1rem;">${a.company}</div></td><td style="padding: 16px 24px;"><div style="font-weight: 600; color: #475569; font-size: 0.9rem;">${a.role}</div>${extraDetails}</td><td style="padding: 16px 24px; color: #64748B; font-size: 0.85rem; font-weight: 500;">${a.date_applied}</td><td style="padding: 16px 24px;"><span class="badge ${bClass}" style="font-size: 0.75rem; padding: 4px 10px;">${a.status}</span></td></tr>`; 
        }).join('');
    } else { appBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 30px; color:var(--text-muted);">No applications logged.</td></tr>`; }
}


// --- 2. STUDENT ANALYSIS LIST (FULL PAGE RO) ---
function renderAnalysisTable(students) {
    const tbody = document.getElementById('analysis-list-tbody');
    if(!tbody) return;
    if(students.length === 0) { tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">No students match filter.</td></tr>`; return; }
    tbody.innerHTML = students.map(s => {
        const yMatch = (s.email||'').split('@')[0].match(/\d{2}$/); const year = yMatch ? yMatch[0] : '--';
        return `<tr class="dir-row"><td style="font-weight:600; color: var(--text-main);"><div style="display: flex; align-items: center; gap: 12px;"><img src="https://ui-avatars.com/api/?name=${encodeURIComponent(s.full_name)}&background=random&color=fff&rounded=true" style="width: 32px; height: 32px;"><div>${s.full_name}</div></div></td><td style="color: var(--text-muted); font-size: 0.9rem;">${s.email}</td><td><span class="badge badge-primary">${s.department || '--'}</span></td><td style="font-weight: 700; color: var(--primary);">Batch '${year}</td><td style="text-align: right;"><button class="action-btn btn-outline" style="padding: 6px 12px; font-size: 0.8rem; border-color: #4F46E5; color: #4F46E5;" onclick="openAnalysisDetail('${esc(s.email)}', '${esc(s.full_name)}', '${esc(s.roll_no)}', '${esc(s.department)}')">Full Analysis <i class="fa-solid fa-arrow-right" style="margin-left: 6px;"></i></button></td></tr>`;
    }).join('');
}

function filterAnalysisStudents() {
    const search = document.getElementById('searchAnalysis').value.toLowerCase(); 
    const dept = document.getElementById('deptAnalysisFilter').value;
    const yearFilter = document.getElementById('yearAnalysisFilter').value;

    const filtered = allStudentsList.filter(s => { 
        const matchesSearch = ((s.full_name||'').toLowerCase().includes(search)) || ((s.email||'').toLowerCase().includes(search)); 
        const matchesDept = dept === "ALL" || s.department === dept; 
        const yMatch = (s.email||'').split('@')[0].match(/\d{2}$/);
        const yExtracted = yMatch ? yMatch[0] : '';
        const matchesYear = yearFilter === "ALL" || yExtracted === yearFilter;
        return matchesSearch && matchesDept && matchesYear; 
    });
    renderAnalysisTable(filtered);
}

// 🛑 FULL PAGE ANALYSIS DASHBOARD
async function openAnalysisDetail(email, name, roll_no, department) {
    switchTab('analysis-detail', document.getElementById('nav-analysis-list'));
    document.getElementById('ana-modal-content-body').style.display = 'none'; 
    document.getElementById('ana-modal-loading').style.display = 'block'; 
    document.getElementById('ana-detail-name').innerText = name; 
    document.getElementById('ana-detail-sub').innerText = `${roll_no || 'No Roll No'} | ${department || 'No Dept'}`; 
    document.getElementById('ana-detail-img').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4F46E5&color=fff`;

    try {
        const req = await fetch(`${BASE_URL}/api/admin/student-data`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, targetEmail: email }) });
        const data = await req.json();
        if (data.success) { 
            populateAnalysisModal(data.placeProfile || {}, data.placeApps || []); 
            document.getElementById('ana-modal-loading').style.display = 'none'; 
            document.getElementById('ana-modal-content-body').style.display = 'block'; 
        } else { alert("Failed to fetch placement data."); switchTab('analysis-list', document.getElementById('nav-analysis-list')); }
    } catch(e) { alert("Network error."); switchTab('analysis-list', document.getElementById('nav-analysis-list')); }
}

function populateAnalysisModal(prf, apps) {
    if(document.getElementById('ana-p-role')) document.getElementById('ana-p-role').innerText = prf.offer_role || '--'; 
    if(document.getElementById('ana-p-comp')) document.getElementById('ana-p-comp').innerText = prf.offer_company || '--'; 
    if(document.getElementById('ana-p-ctc')) document.getElementById('ana-p-ctc').innerText = prf.offer_ctc || '--'; 
    if(document.getElementById('ana-p-status')) document.getElementById('ana-p-status').innerText = prf.status || 'Unplaced'; 
    if(document.getElementById('ana-p-assess')) document.getElementById('ana-p-assess').innerText = prf.assessments || '0'; 
    if(document.getElementById('ana-p-int')) document.getElementById('ana-p-int').innerText = prf.interviews || '0'; 
    if(document.getElementById('ana-p-off')) document.getElementById('ana-p-off').innerText = prf.offers || '0';

    if(document.getElementById('ana-t-dsa')) document.getElementById('ana-t-dsa').innerText = prf.tech_dsa || '0'; 
    if(document.getElementById('ana-bar-t-dsa')) document.getElementById('ana-bar-t-dsa').style.width = `${prf.tech_dsa || 0}%`; 
    if(document.getElementById('ana-t-oop')) document.getElementById('ana-t-oop').innerText = prf.tech_oop || '0'; 
    if(document.getElementById('ana-bar-t-oop')) document.getElementById('ana-bar-t-oop').style.width = `${prf.tech_oop || 0}%`; 
    if(document.getElementById('ana-t-core')) document.getElementById('ana-t-core').innerText = prf.tech_core || '0'; 
    if(document.getElementById('ana-bar-t-core')) document.getElementById('ana-bar-t-core').style.width = `${prf.tech_core || 0}%`; 
    if(document.getElementById('ana-a-quant')) document.getElementById('ana-a-quant').innerText = prf.apt_quant || '0'; 
    if(document.getElementById('ana-bar-a-quant')) document.getElementById('ana-bar-a-quant').style.width = `${prf.apt_quant || 0}%`; 
    if(document.getElementById('ana-a-log')) document.getElementById('ana-a-log').innerText = prf.apt_logical || '0'; 
    if(document.getElementById('ana-bar-a-log')) document.getElementById('ana-bar-a-log').style.width = `${prf.apt_logical || 0}%`; 
    if(document.getElementById('ana-a-hr')) document.getElementById('ana-a-hr').innerText = prf.apt_hr || '0'; 
    if(document.getElementById('ana-bar-a-hr')) document.getElementById('ana-bar-a-hr').style.width = `${prf.apt_hr || 0}%`;

    const appBody = document.getElementById('ana-student-apps-tbody');
    if(!appBody) return;
    if (apps && apps.length > 0) {
        appBody.innerHTML = apps.map(a => { 
            let bClass = 'badge-primary'; let s = (a.status||'').toLowerCase(); 
            if(s.includes('select') || s.includes('offer') || s.includes('placed')) bClass = 'badge-success'; 
            if(s.includes('clear') || s.includes('reject')) bClass = 'badge-danger'; 
            if(s.includes('pend') || s.includes('wait') || s.includes('short')) bClass = 'badge-warning'; 
            return `<tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 16px 24px; font-weight: 800; color: #1E293B;">${a.company}</td><td style="padding: 16px 24px; font-weight: 600; color: #475569;">${a.role}</td><td style="padding: 16px 24px; color: #64748B;">${a.date_applied}</td><td style="padding: 16px 24px;"><span class="badge ${bClass}" style="font-size: 0.75rem; padding: 4px 10px;">${a.status}</span></td></tr>`; 
        }).join('');
    } else { appBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 40px; color:var(--text-muted);">No applications logged.</td></tr>`; }
}


// --- 3. STUDENT LOGIN & SECURE EDITING GATEWAY ---
function loginAsStudent() {
    const loginId = document.getElementById('edit-login-id').value.trim();
    const password = document.getElementById('edit-login-pass').value.trim();
    
    if(loginId === "1234" && password === "1234") {
        document.getElementById('nav-student-login').style.display = 'none';
        
        const editNav = document.getElementById('nav-edit-list');
        const detailNav = document.getElementById('nav-edit-detail');
        if(editNav) editNav.style.display = 'flex';

        switchTab('edit-list', editNav);
        
        if(document.getElementById('edit-login-id')) document.getElementById('edit-login-id').value = '';
        if(document.getElementById('edit-login-pass')) document.getElementById('edit-login-pass').value = '';
    } else { alert("Invalid Login ID or Password! Access Denied."); }
}

function lockEditor() {
    if(document.getElementById('nav-student-login')) document.getElementById('nav-student-login').style.display = 'flex';
    if(document.getElementById('nav-edit-list')) document.getElementById('nav-edit-list').style.display = 'none';
    if(document.getElementById('nav-edit-detail')) document.getElementById('nav-edit-detail').style.display = 'none';
    switchTab('student-login', document.getElementById('nav-student-login'));
}

function renderEditTable(students) {
    const tbody = document.getElementById('edit-student-list-tbody');
    if(!tbody) return;
    if(students.length === 0) { tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">No students found.</td></tr>`; return; }
    tbody.innerHTML = students.map(s => {
        const yMatch = (s.email||'').split('@')[0].match(/\d{2}$/); const year = yMatch ? yMatch[0] : '--';
        return `<tr class="dir-row"><td style="font-weight:600; color: var(--text-main);"><div style="display: flex; align-items: center; gap: 12px;"><img src="https://ui-avatars.com/api/?name=${encodeURIComponent(s.full_name)}&background=random&color=fff&rounded=true" style="width: 32px; height: 32px;"><div>${s.full_name}</div></div></td><td style="color: var(--text-muted); font-size: 0.9rem;">${s.email}</td><td><span class="badge badge-primary">${s.department || '--'}</span></td><td style="font-weight: 700; color: #B91C1C;">Batch '${year}</td><td style="text-align: right;"><button class="action-btn btn-outline" style="padding: 6px 12px; font-size: 0.8rem; border-color:#B91C1C; color:#B91C1C;" onclick="openEditableStudentDetail('${esc(s.email)}', '${esc(s.full_name)}', '${esc(s.roll_no)}', '${esc(s.department)}')">Edit Skills <i class="fa-solid fa-pen" style="margin-left: 6px;"></i></button></td></tr>`;
    }).join('');
}

function filterEditStudents() {
    const search = document.getElementById('searchEditStudent').value.toLowerCase(); 
    const dept = document.getElementById('deptEditFilter').value;
    const yearFilter = document.getElementById('yearEditFilter').value;

    const filtered = allStudentsList.filter(s => { 
        const matchesSearch = ((s.full_name||'').toLowerCase().includes(search)) || ((s.email||'').toLowerCase().includes(search)); 
        const matchesDept = dept === "ALL" || s.department === dept; 
        const yMatch = (s.email||'').split('@')[0].match(/\d{2}$/);
        const yExtracted = yMatch ? yMatch[0] : '';
        const matchesYear = yearFilter === "ALL" || yExtracted === yearFilter;
        return matchesSearch && matchesDept && matchesYear; 
    });
    renderEditTable(filtered);
}

// 🛑 FULL PAGE EDITABLE PROFILE (SKILLS ONLY)
async function openEditableStudentDetail(email, name, roll_no, department) {
    targetStudentEmail = email;
    if(document.getElementById('nav-edit-detail')) document.getElementById('nav-edit-detail').style.display = 'flex';
    switchTab('edit-detail', document.getElementById('nav-edit-detail'));
    
    if(document.getElementById('edit-modal-content-body')) document.getElementById('edit-modal-content-body').style.display = 'none';
    if(document.getElementById('edit-modal-loading')) document.getElementById('edit-modal-loading').style.display = 'block';

    if (name) {
        if(document.getElementById('edit-detail-name')) document.getElementById('edit-detail-name').innerText = name;
        if(document.getElementById('edit-detail-sub')) document.getElementById('edit-detail-sub').innerText = `${roll_no || 'No Roll No'} | ${department || 'No Dept'}`;
        if(document.getElementById('edit-detail-img')) document.getElementById('edit-detail-img').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4F46E5&color=fff`;
    }

    try {
        const req = await fetch(`${BASE_URL}/api/admin/student-data`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, targetEmail: email }) });
        const data = await req.json();
        if (data.success) { 
            populateEditorPerformance(data.placeProfile || {}, data.placeApps || []); 
            if(document.getElementById('edit-modal-loading')) document.getElementById('edit-modal-loading').style.display = 'none';
            if(document.getElementById('edit-modal-content-body')) document.getElementById('edit-modal-content-body').style.display = 'block';
        } else { alert("Failed to fetch placement data."); switchTab('edit-list', document.getElementById('nav-edit-list')); }
    } catch(e) { alert("Network error."); switchTab('edit-list', document.getElementById('nav-edit-list')); }
}

function populateEditorPerformance(prf, apps) {
    if(document.getElementById('val-p-role')) document.getElementById('val-p-role').innerText = prf.offer_role || '--'; 
    if(document.getElementById('val-p-comp')) document.getElementById('val-p-comp').innerText = prf.offer_company || '--'; 
    if(document.getElementById('val-p-ctc')) document.getElementById('val-p-ctc').innerText = prf.offer_ctc || '--'; 
    if(document.getElementById('val-p-status')) document.getElementById('val-p-status').innerText = prf.status || 'Unplaced'; 
    if(document.getElementById('val-p-assess')) document.getElementById('val-p-assess').innerText = prf.assessments || '0'; 
    if(document.getElementById('val-p-int')) document.getElementById('val-p-int').innerText = prf.interviews || '0'; 
    if(document.getElementById('val-p-off')) document.getElementById('val-p-off').innerText = prf.offers || '0';
    
    if(document.getElementById('val-t-dsa')) document.getElementById('val-t-dsa').innerText = prf.tech_dsa || '0'; 
    if(document.getElementById('bar-t-dsa')) document.getElementById('bar-t-dsa').style.width = `${prf.tech_dsa || 0}%`; 
    if(document.getElementById('val-t-oop')) document.getElementById('val-t-oop').innerText = prf.tech_oop || '0'; 
    if(document.getElementById('bar-t-oop')) document.getElementById('bar-t-oop').style.width = `${prf.tech_oop || 0}%`; 
    if(document.getElementById('val-t-core')) document.getElementById('val-t-core').innerText = prf.tech_core || '0'; 
    if(document.getElementById('bar-t-core')) document.getElementById('bar-t-core').style.width = `${prf.tech_core || 0}%`; 
    if(document.getElementById('val-a-quant')) document.getElementById('val-a-quant').innerText = prf.apt_quant || '0'; 
    if(document.getElementById('bar-a-quant')) document.getElementById('bar-a-quant').style.width = `${prf.apt_quant || 0}%`; 
    if(document.getElementById('val-a-log')) document.getElementById('val-a-log').innerText = prf.apt_logical || '0'; 
    if(document.getElementById('bar-a-log')) document.getElementById('bar-a-log').style.width = `${prf.apt_logical || 0}%`; 
    if(document.getElementById('val-a-hr')) document.getElementById('val-a-hr').innerText = prf.apt_hr || '0'; 
    if(document.getElementById('bar-a-hr')) document.getElementById('bar-a-hr').style.width = `${prf.apt_hr || 0}%`;

    const appBody = document.getElementById('edit-student-apps-tbody');
    if(!appBody) return;
    if (apps && apps.length > 0) {
        appBody.innerHTML = apps.map(a => { 
            let bClass = 'badge-primary'; let s = (a.status||'').toLowerCase(); 
            if(s.includes('select') || s.includes('offer') || s.includes('placed')) bClass = 'badge-success'; 
            if(s.includes('clear') || s.includes('reject')) bClass = 'badge-danger'; 
            if(s.includes('pend') || s.includes('wait') || s.includes('short')) bClass = 'badge-warning'; 
            return `<tr style="border-bottom: 1px solid #F1F5F9;"><td style="padding: 16px 24px; font-weight: 800; color: #1E293B;">${a.company}</td><td style="padding: 16px 24px; font-weight: 600; color: #475569;">${a.role}</td><td style="padding: 16px 24px; color: #64748B;">${a.date_applied}</td><td style="padding: 16px 24px;"><span class="badge ${bClass}" style="font-size: 0.75rem; padding: 4px 10px;">${a.status}</span></td></tr>`; 
        }).join('');
    } else { appBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 30px; color:var(--text-muted);">No applications logged.</td></tr>`; }
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
        const barId = spanId.replace('val-', 'bar-'); const bar = document.getElementById(barId); if(bar) bar.style.width = `${val}%`;
    } catch(e) { cancelPlacementProfileEdit(spanId, field, width); }
}


// --- COLLEGE PLACEMENT STATS ---
async function refreshGlobalPlacementData() {
    try {
        const req = await fetch(`${BASE_URL}/api/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: globalToken }) });
        const data = await req.json();
        if (data.success) { populateGlobalPlacement(data.globalStats, data.globalDrives); }
    } catch(e) {}
}

function populateGlobalPlacement(gStats, gDrives) {
    gStats = gStats || {};
    if(document.getElementById('wrap-g-total')) document.getElementById('wrap-g-total').innerHTML = `<span id="val-g-total">${gStats.total_placed || '0'}</span><i class="fa-solid fa-pen admin-table-edit" onclick="openGlobalStatEdit('total_placed', 'val-g-total', '90px')"></i>`;
    if(document.getElementById('wrap-g-ongoing')) document.getElementById('wrap-g-ongoing').innerHTML = `<span id="val-g-ongoing">${gStats.ongoing_drives || '0'}</span><i class="fa-solid fa-pen admin-table-edit" onclick="openGlobalStatEdit('ongoing_drives', 'val-g-ongoing', '90px')"></i>`;
    if(document.getElementById('wrap-g-highest')) document.getElementById('wrap-g-highest').innerHTML = `<div><span id="val-g-highest">${gStats.highest_ctc || '0'}</span> <span style="font-size: 0.8rem; color: var(--text-muted);">LPA</span></div><i class="fa-solid fa-pen admin-table-edit" onclick="openGlobalStatEdit('highest_ctc', 'val-g-highest', '90px')"></i>`;
    if(document.getElementById('wrap-g-avg')) document.getElementById('wrap-g-avg').innerHTML = `<div><span id="val-g-avg">${gStats.avg_ctc || '0'}</span> <span style="font-size: 0.8rem; color: var(--text-muted);">LPA</span></div><i class="fa-solid fa-pen admin-table-edit" onclick="openGlobalStatEdit('avg_ctc', 'val-g-avg', '90px')"></i>`;
    
    if(document.getElementById('dash-highest-pkg')) document.getElementById('dash-highest-pkg').innerText = `${gStats.highest_ctc || '0'} LPA`;

    const drvBody = document.getElementById('global-drives-tbody');
    if(!drvBody) return;
    if (gDrives && gDrives.length > 0) {
        drvBody.innerHTML = gDrives.map(d => `<tr id="row-drv-${d.id}"><td style="font-weight: 700; color: var(--text-main);">${d.company}</td><td>${d.role}</td><td style="font-family: monospace;">${d.appeared}</td><td><span class="badge badge-success">${d.selected}</span></td><td style="font-weight: 700; color: var(--primary);">${d.ctc}</td><td style="text-align:right; white-space:nowrap;"><i class="fa-solid fa-pen admin-table-edit" onclick="editDriveRow(${d.id})"></i><i class="fa-solid fa-trash admin-table-del" onclick="deleteGlobalDrive(${d.id})"></i></td></tr>`).join('');
    } else { drvBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 30px; color:var(--text-muted);">No campus drives recorded.</td></tr>`; }
}
function cancelGlobalStatEdit() { refreshGlobalPlacementData(); }
function openGlobalStatEdit(field, spanId, width) {
    const span = document.getElementById(spanId); originalValues[spanId] = span.innerText.trim(); const wrapId = spanId.replace('val-', 'wrap-');
    document.getElementById(wrapId).innerHTML = `<div class="flex-center"><input type="text" id="in-${spanId}" class="inline-input" style="width: ${width}; padding: 4px;" value="${originalValues[spanId]}"><i class="fa-solid fa-check action-icon save" style="width:28px; height:28px;" onclick="saveGlobalStat('${field}', '${spanId}', '${width}')"></i><i class="fa-solid fa-xmark action-icon cancel" style="width:28px; height:28px;" onclick="cancelGlobalStatEdit()"></i></div>`;
}
async function saveGlobalStat(field, spanId, width) {
    const val = document.getElementById(`in-${spanId}`).value; const wrapId = spanId.replace('val-', 'wrap-');
    document.getElementById(wrapId).innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color: var(--primary);"></i>`;
    try { await fetch(`${BASE_URL}/api/admin/update-global-stat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, field: field, value: val }) }); } catch(e) {}
    refreshGlobalPlacementData(); 
}
function editDriveRow(id) {
    const tr = document.getElementById(`row-drv-${id}`); const comp = tr.children[0].innerText; const role = tr.children[1].innerText; const app = tr.children[2].innerText; const sel = tr.children[3].innerText; const ctc = tr.children[4].innerText;
    tr.innerHTML = `<td><input type="text" id="e-drv-c-${id}" class="inline-input" style="width: 100%;" value="${comp}"></td><td><input type="text" id="e-drv-r-${id}" class="inline-input" style="width: 100%;" value="${role}"></td><td><input type="number" id="e-drv-a-${id}" class="inline-input" style="width: 60px;" value="${app}"></td><td><input type="number" id="e-drv-s-${id}" class="inline-input" style="width: 60px;" value="${sel}"></td><td><input type="text" id="e-drv-ctc-${id}" class="inline-input" style="width: 80px;" value="${ctc}"></td><td style="text-align:right; white-space: nowrap;"><i class="fa-solid fa-check action-icon save" onclick="saveDriveRow(${id})"></i><i class="fa-solid fa-xmark action-icon cancel" onclick="refreshGlobalPlacementData()"></i></td>`;
}
async function saveDriveRow(id) {
    const tr = document.getElementById(`row-drv-${id}`); tr.lastElementChild.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color: var(--primary);"></i>`;
    const updates = [{ field: 'company', value: document.getElementById(`e-drv-c-${id}`).value }, { field: 'role', value: document.getElementById(`e-drv-r-${id}`).value }, { field: 'appeared', value: document.getElementById(`e-drv-a-${id}`).value }, { field: 'selected', value: document.getElementById(`e-drv-s-${id}`).value }, { field: 'ctc', value: document.getElementById(`e-drv-ctc-${id}`).value }];
    for (let u of updates) { await fetch(`${BASE_URL}/api/admin/update-drive`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, id: id, field: u.field, value: u.value }) }); }
    refreshGlobalPlacementData(); 
}
async function deleteGlobalDrive(id) { if(!confirm("Delete this completed drive record?")) return; await fetch(`${BASE_URL}/api/admin/delete-drive`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, id: id }) }); refreshGlobalPlacementData(); }
async function submitGlobalDrive() {
    const btn = document.querySelector('#add-global-drive-modal .btn-primary'); const ogText = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    try { await fetch(`${BASE_URL}/api/admin/add-drive`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, company: document.getElementById('g-drv-comp').value, role: document.getElementById('g-drv-role').value, appeared: document.getElementById('g-drv-app').value, selected: document.getElementById('g-drv-sel').value, ctc: document.getElementById('g-drv-ctc').value }) }); } catch(e) {}
    document.getElementById('add-global-drive-modal').style.display='none'; btn.innerHTML = ogText;
    document.getElementById('g-drv-comp').value = ''; document.getElementById('g-drv-role').value = ''; document.getElementById('g-drv-app').value = ''; document.getElementById('g-drv-sel').value = ''; document.getElementById('g-drv-ctc').value = '';
    refreshGlobalPlacementData(); 
}

// --- STUDENT PLACEMENTS (ALL APPS) BOARD ---
async function loadAllPlacements() {
    const tbody = document.getElementById('all-placements-tbody');
    if(!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading all applications...</td></tr>`;
    try {
        const req = await fetch(`${BASE_URL}/api/admin/all-applications`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken }) });
        const data = await req.json();
        if (data.success) {
            window.allGlobalPlacements = data.applications;
            const filterDropdown = document.getElementById('placementCompanyFilter');
            const companies = [...new Set(data.applications.map(a => a.company).filter(c => c))];
            if(filterDropdown) {
                filterDropdown.innerHTML = '<option value="ALL">All Companies</option>';
                companies.forEach(c => { filterDropdown.innerHTML += `<option value="${c}">${c}</option>`; });
            }
            renderAllPlacementsTable();
            updateDashboardOverview();
        }
    } catch(e) { tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger);">Error loading placements.</td></tr>`; }
}
function renderAllPlacementsTable() {
    const tbody = document.getElementById('all-placements-tbody');
    if(!tbody) return;
    const selectedComp = document.getElementById('placementCompanyFilter').value;
    const filteredApps = selectedComp === 'ALL' ? window.allGlobalPlacements : window.allGlobalPlacements.filter(a => a.company === selectedComp);
    if(filteredApps.length === 0) { tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">No applications found.</td></tr>`; return; }

    tbody.innerHTML = filteredApps.map(a => {
        return `<tr><td style="font-weight:600; color: var(--text-main);"><div style="font-size:0.95rem;">${a.full_name}</div><div style="font-size:0.75rem; color:var(--text-muted); font-weight:400;">${a.student_email}</div></td><td><span class="badge badge-primary" style="background:#EEF2FF; color:#4F46E5;">${a.department || '--'}</span></td><td><div style="font-weight:700; color:var(--text-main);">${a.company}</div><div style="font-size:0.8rem; color:var(--text-muted);">${a.role}</div></td><td style="font-size:0.85rem;">${a.date_applied}</td><td><select onchange="handlePlacementStatusChange(${a.app_id}, this)" class="control-input" style="padding: 6px; font-size: 0.8rem; width: 140px; border-color: var(--border); font-weight: 600; color: var(--text-main);"><option value="Applied" ${a.status === 'Applied' ? 'selected' : ''}>Applied (Pending)</option><option value="Shortlisted" ${a.status === 'Shortlisted' ? 'selected' : ''}>Shortlisted</option><option value="Interview" ${a.status === 'Interview' ? 'selected' : ''}>In Interview</option><option value="Selected" ${a.status === 'Selected' ? 'selected' : ''}>Selected / Placed</option><option value="Rejected" ${a.status === 'Rejected' ? 'selected' : ''}>Rejected</option></select></td></tr>`;
    }).join('');
}
function handlePlacementStatusChange(appId, selectElement) {
    const newStatus = selectElement.value;
    if(newStatus === 'Placed' || newStatus === 'Selected') { document.getElementById('placed-app-id').value = appId; document.getElementById('placed-status-val').value = newStatus; document.getElementById('mark-placed-modal').style.display = 'flex'; } else { updateApplicationStatus(appId, newStatus); }
}
async function updateApplicationStatus(appId, newStatus) {
    try { await fetch(`${BASE_URL}/api/admin/update-app-status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, app_id: appId, status: newStatus }) }); loadAllPlacements(); } catch(e) { }
}
async function submitPlacedDetails() {
    const appId = document.getElementById('placed-app-id').value; const status = document.getElementById('placed-status-val').value; const pack = document.getElementById('placed-package').value || '--'; const intern = document.getElementById('placed-internship').value || '--'; const link = document.getElementById('placed-offer-link').value || '';
    const btn = document.querySelector('#mark-placed-modal .btn-success'); btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    try { await fetch(`${BASE_URL}/api/admin/mark-placed`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, app_id: appId, status: status, package: pack, internship: intern, offer_link: link }) }); } catch(e) { }
    document.getElementById('mark-placed-modal').style.display = 'none'; btn.innerHTML = 'Save Placement Record'; loadAllPlacements(); 
}

// 🛑 MODAL APPLICANTS LIST 
async function viewDriveApplicants(company, role) {
    document.getElementById('app-modal-title').innerText = `Applicants: ${company} - ${role}`;
    document.getElementById('view-applicants-modal').style.display = 'flex';
    document.getElementById('applicants-tbody').innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</td></tr>`;
    try {
        const req = await fetch(`${BASE_URL}/api/admin/drive-applicants`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, company: company, role: role }) });
        const data = await req.json();
        if(data.success) {
            window.currentDriveApplicants = data.applicants; 
            const filterDropdown = document.getElementById('app-dept-filter');
            const depts = [...new Set(data.applicants.map(a => a.department).filter(d => d && d !== 'Not Assigned'))];
            filterDropdown.innerHTML = '<option value="ALL">All Departments</option>';
            depts.forEach(d => { filterDropdown.innerHTML += `<option value="${d}">${d}</option>`; });
            renderApplicantsTable();
        } else { document.getElementById('applicants-tbody').innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">Failed to load applicants.</td></tr>`; }
    } catch(e) { document.getElementById('applicants-tbody').innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger);">Error loading.</td></tr>`; }
}

function renderApplicantsTable() {
    const tbody = document.getElementById('applicants-tbody');
    const selectedDept = document.getElementById('app-dept-filter').value;
    const filteredApps = selectedDept === 'ALL' ? window.currentDriveApplicants : window.currentDriveApplicants.filter(a => a.department === selectedDept);
    if(!filteredApps || filteredApps.length === 0) { tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">No applicants found for this department.</td></tr>`; return; }
    tbody.innerHTML = filteredApps.map(a => {
        const resumeLink = (a.resume_url && a.resume_url !== '--' && a.resume_url.trim() !== '') ? `<a href="${a.resume_url}" target="_blank" style="color:var(--primary); font-weight:600; text-decoration:none;"><i class="fa-solid fa-file-pdf"></i> View</a>` : `<span style="color:var(--text-muted);">None</span>`;
        return `<tr><td style="font-weight:600; color: var(--text-main);"><div style="font-size:0.95rem;">${a.full_name}</div><div style="font-size:0.75rem; color:var(--text-muted); font-weight:400;">${a.student_email} | ${a.roll_no||'--'}</div></td><td><span class="badge badge-primary" style="background:#EEF2FF; color:#4F46E5;">${a.department || '--'}</span></td><td style="color:var(--text-muted); font-size:0.85rem; font-weight: 600;">${a.date_applied}</td><td>${resumeLink}</td><td><select onchange="updateApplicationStatus(${a.app_id}, this.value)" class="control-input" style="padding: 4px; font-size: 0.8rem; width: 130px; border-color: var(--border); font-weight: 600; color: var(--text-main);"><option value="Applied" ${a.status === 'Applied' ? 'selected' : ''}>Applied (Pending)</option><option value="Shortlisted" ${a.status === 'Shortlisted' ? 'selected' : ''}>Shortlisted</option><option value="Interview" ${a.status === 'Interview' ? 'selected' : ''}>In Interview</option><option value="Selected" ${a.status === 'Selected' ? 'selected' : ''}>Selected / Placed</option><option value="Rejected" ${a.status === 'Rejected' ? 'selected' : ''}>Rejected</option></select></td></tr>`;
    }).join('');
}

// --- ANNOUNCEMENTS LOGIC ---
async function loadAnnouncements() {
    const feed = document.getElementById('announcement-feed'); 
    if(!feed) return;
    feed.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>`;
    try {
        const req = await fetch(`${BASE_URL}/api/announcements/list`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: globalToken }) }); const data = await req.json();
        if (data.success) {
            if(data.announcements.length === 0) { feed.innerHTML = `<div class="card" style="text-align:center; padding: 40px; color:var(--text-muted);">No announcements posted yet.</div>`; return; }
            feed.innerHTML = data.announcements.map(ann => {
                let dateStr = new Date(ann.date_posted).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                let targetLabel = ann.target_department || 'ALL'; let deptBadge = targetLabel === 'ALL' ? `<span class="badge" style="background: #E2E8F0; color: #475569; margin-right: 10px;"><i class="fa-solid fa-globe"></i> Global</span>` : `<span class="badge" style="background: var(--purple-light); color: var(--purple); margin-right: 10px;"><i class="fa-solid fa-bullseye"></i> ${targetLabel}</span>`;
                
                let icon = 'fa-bullhorn'; let color = 'var(--primary)';
                if(ann.type === 'Placement Drive') { icon = 'fa-briefcase'; color = 'var(--success)'; }
                else if (ann.type === 'Training Event') { icon = 'fa-chalkboard-user'; color = '#CA8A04'; }

                return `<div class="card" style="display: flex; gap: 20px; align-items: flex-start; padding: 24px; position: relative;"><button class="action-icon cancel" style="position: absolute; top: 16px; right: 16px;" onclick="deleteAnnouncement(${ann.id})"><i class="fa-solid fa-trash"></i></button><div style="background: ${color}20; color: ${color}; width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;"><i class="fa-solid ${icon}"></i></div><div style="flex: 1; padding-right: 40px;"><h3 style="margin: 0 0 8px 0; font-size: 1.1rem; color: var(--text-main); font-weight: 800;">${ann.title}</h3><div style="margin-bottom: 12px;"><span class="badge" style="background:${color}10; color:${color}; border: 1px solid ${color}; margin-right: 10px;">${ann.type}</span>${deptBadge}<span style="font-size: 0.8rem; color: var(--text-muted);"><i class="fa-regular fa-clock"></i> ${dateStr}</span></div><p style="margin: 0; color: var(--text-muted); line-height: 1.6; font-size: 0.95rem; white-space: pre-wrap;">${ann.content}</p></div></div>`;
            }).join('');
        }
    } catch(e) { feed.innerHTML = `<div class="card" style="color:var(--danger); text-align:center;">Network Error</div>`; }
}
async function submitPlacementAnnouncement() {
    const titleInput = document.getElementById('ann-title'); const contentInput = document.getElementById('ann-content'); const deptInput = document.getElementById('ann-target-dept'); const typeInput = document.getElementById('ann-type');
    if(!titleInput || !contentInput) return;
    const title = titleInput.value.trim(); const content = contentInput.value.trim(); const targetDept = deptInput ? deptInput.value : 'ALL'; const type = typeInput ? typeInput.value : 'Announcement';
    if(!title || !content) return alert("Please enter both an Announcement Title and Content.");
    const btn = document.querySelector('#add-ann-modal .btn-primary'); const originalBtnText = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Posting...';
    try { await fetch(`${BASE_URL}/api/admin/add-announcement`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, title: title, type: type, content: content, target_department: targetDept }) }); } catch(e) {} 
    document.getElementById('add-ann-modal').style.display = 'none'; titleInput.value = ''; contentInput.value = ''; if(deptInput) deptInput.value = 'ALL'; btn.innerHTML = originalBtnText; loadAnnouncements(); 
}
async function deleteAnnouncement(id) { if(!confirm("Delete this announcement?")) return; await fetch(`${BASE_URL}/api/admin/delete-announcement`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, id: id }) }); loadAnnouncements(); }