const BASE_URL = 'https://portal-6crm.onrender.com';

let globalToken = localStorage.getItem('bit_session_token'); 
if (globalToken) { globalToken = globalToken.replace(/['"]+/g, ''); } 
else { window.location.href = 'index.html'; }

// Global State Arrays
let allStudentsList = []; 
let staffDirectoryList = [];
let departmentsList = [];
let targetStudentEmail = ""; 
let originalValues = {}; 
let gpaChartInstance = null;
let currentStudentSkills = []; 

// Mentor Mapping State
let activeMappingStaffId = null;
let selectedUnassigned = new Set();
let selectedAssigned = new Set();

const esc = (str) => { if (!str) return '--'; return String(str).replace(/'/g, "&#39;").replace(/"/g, '&quot;'); };

window.onload = async () => {
    injectPremiumStyles(); 
    try {
        const req = await fetch(`${BASE_URL}/api/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: globalToken }) });
        const data = await req.json();
        
        if (!data.success || !data.isStaffAdmin) { 
            localStorage.removeItem('bit_session_token'); window.location.href = 'index.html'; return; 
        }
        document.getElementById('headerName').innerText = data.profile.full_name || 'Administrator';
        document.getElementById('headerEmail').innerText = data.profile.email || '';
        document.getElementById('headerImage').src = data.profile.picture || `https://ui-avatars.com/api/?name=Admin&background=4F46E5&color=fff`;

        fetchStaffDirectory(); 
        fetchAdminAnnouncements();
        fetchDepartments();
    } catch (e) { showToast("Connection Error", "Failed to connect to the server.", "error"); }
};

// ==============================================================================
// 🛑 PREMIUM TOAST NOTIFICATION SYSTEM
// ==============================================================================
function injectPremiumStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
        .toast-container { position: fixed; bottom: 24px; right: 24px; display: flex; flex-direction: column; gap: 12px; z-index: 999999; }
        .toast-box { min-width: 320px; max-width: 400px; background: white; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1); display: flex; align-items: flex-start; padding: 16px; gap: 14px; transform: translateX(120%); transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1); border-left: 4px solid var(--primary); }
        .toast-box.show { transform: translateX(0); }
        .toast-box.success { border-left-color: #10B981; }
        .toast-box.error { border-left-color: #EF4444; }
        .toast-box.warning { border-left-color: #F59E0B; }
        .toast-icon { font-size: 1.4rem; flex-shrink: 0; margin-top: 2px; }
        .toast-box.success .toast-icon { color: #10B981; }
        .toast-box.error .toast-icon { color: #EF4444; }
        .toast-box.warning .toast-icon { color: #F59E0B; }
        .toast-content { flex: 1; }
        .toast-title { font-weight: 800; color: #0F172A; font-size: 0.95rem; margin-bottom: 4px; }
        .toast-msg { color: #64748B; font-size: 0.85rem; line-height: 1.4; }
        .toast-close { color: #94A3B8; cursor: pointer; transition: 0.2s; font-size: 1.1rem; }
        .toast-close:hover { color: #0F172A; }
    `;
    document.head.appendChild(style);
}

function showToast(title, message, type = 'success') {
    let container = document.getElementById('toast-container');
    if(!container) { container = document.createElement('div'); container.id = 'toast-container'; container.className = 'toast-container'; document.body.appendChild(container); }
    const toast = document.createElement('div'); toast.className = `toast-box ${type}`;
    let icon = 'fa-circle-check'; if(type === 'error') icon = 'fa-circle-xmark'; if(type === 'warning') icon = 'fa-triangle-exclamation';
    toast.innerHTML = `<i class="fa-solid ${icon} toast-icon"></i><div class="toast-content"><div class="toast-title">${title}</div><div class="toast-msg">${message}</div></div><i class="fa-solid fa-xmark toast-close" onclick="this.parentElement.remove()"></i>`;
    container.appendChild(toast); setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 4500);
}

// ==============================================================================
// 🛑 NAVIGATION & MODALS
// ==============================================================================
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('sidebar-overlay').classList.toggle('show'); }
function switchTab(tabId, element) { 
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active')); 
    if(element) element.classList.add('active'); 
    document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active')); 
    const targetView = document.getElementById('view-' + tabId); if(targetView) targetView.classList.add('active'); 
    if(window.innerWidth <= 768) { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebar-overlay').classList.remove('show'); } 
    if(tabId === 'mapping') renderMappingStaffList();
}
function signOut() { localStorage.removeItem('bit_session_token'); window.location.href = 'index.html'; }
function openModal(modalId) { const modal = document.getElementById(modalId); if (modal) modal.style.display = 'flex'; }
function closeModal(modalId) { const modal = document.getElementById(modalId); if (modal) modal.style.display = 'none'; }
function switchModalTab(tabId, element) {
    document.querySelectorAll('.modal-tab').forEach(el => el.classList.remove('active')); element.classList.add('active');
    document.querySelectorAll('.modal-body-section').forEach(el => el.classList.remove('active')); document.getElementById('mod-tab-' + tabId).classList.add('active');
}

// ==============================================================================
// 🛑 STUDENT DIRECTORY
// ==============================================================================
async function fetchDirectory() {
    const tbody = document.getElementById('directoryBody'); if(!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: #94A3B8;"><i class="fa-solid fa-spinner fa-spin"></i> Loading data...</td></tr>`;
    try {
        const req = await fetch(`${BASE_URL}/api/admin/list`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken }) });
        const data = await req.json();
        if (data.success) {
            allStudentsList = data.students.map(s => ({ ...s, mentor_id: s.mentor_id || null }));
            const depts = [...new Set(allStudentsList.map(s => s.department).filter(d => d))];
            const deptSelect = document.getElementById('dirFilter');
            if(deptSelect) deptSelect.innerHTML = '<option value="ALL">All Departments</option>' + depts.map(d => `<option value="${d}">${d}</option>`).join('');
            renderDirectory(allStudentsList);
            if(activeMappingStaffId) renderMappingWorkspace();
        }
    } catch(e) { tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #EF4444;">Network Error.</td></tr>`; }
}
function renderDirectory(students) {
    const tbody = document.getElementById('directoryBody'); if(!tbody) return;
    if(students.length === 0) { tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: #94A3B8;">No students found.</td></tr>`; return; }
    tbody.innerHTML = students.map(s => {
        const match = (s.email || '').split('@')[0].match(/\d{2}$/); const year = match ? "20" + match[0] : '--';
        const mentor = staffDirectoryList.find(staff => staff.id == s.mentor_id);
        const mentorBadge = mentor ? `<span class="badge" style="background:#ECFDF5; color:#059669; border: 1px solid #A7F3D0;"><i class="fa-solid fa-user-tie" style="margin-right:4px;"></i>${esc(mentor.name)}</span>` : `<span class="badge" style="background:#F1F5F9; color:#64748B; border: 1px solid #E2E8F0;">Unassigned</span>`;
        return `<tr class="dir-row" style="transition: 0.2s;" onmouseover="this.style.background='#F8FAFC'" onmouseout="this.style.background='white'">
            <td style="font-weight:600; color: #0F172A; cursor: pointer;" onclick="loadStudentModal('${esc(s.email)}')"><div style="display: flex; align-items: center; gap: 12px;"><img src="https://ui-avatars.com/api/?name=${encodeURIComponent(s.full_name)}&background=random&color=fff&rounded=true" style="width: 32px; height: 32px; border-radius: 8px;"><div>${esc(s.full_name)}</div></div></td>
            <td style="color: #64748B; cursor: pointer;" onclick="loadStudentModal('${esc(s.email)}')">${esc(s.email)}</td>
            <td style="font-weight: 700; color: #334155; cursor: pointer;" onclick="loadStudentModal('${esc(s.email)}')">Batch '${match ? match[0] : '--'}</td>
            <td><span class="badge" style="background:#EEF2FF; color:#4F46E5;">${esc(s.department)}</span></td>
            <td>${mentorBadge}</td>
            <td style="text-align: right;"><button class="action-icon cancel" style="padding: 6px; border: 1px solid #FECACA; border-radius: 6px; background: #FEF2F2;" onclick="deleteStudent('${esc(s.email)}', '${esc(s.full_name)}')"><i class="fa-solid fa-trash" style="color: #EF4444;"></i></button></td>
        </tr>`;
    }).join('');
}
function filterDirectory() {
    const search = document.getElementById('dirSearch').value.toLowerCase(); const dept = document.getElementById('dirFilter').value;
    const filtered = allStudentsList.filter(s => { const matchesSearch = ((s.full_name||'').toLowerCase().includes(search)) || ((s.email||'').toLowerCase().includes(search)) || ((s.roll_no||'').toLowerCase().includes(search)); const matchesDept = dept === "ALL" || s.department === dept; return matchesSearch && matchesDept; });
    renderDirectory(filtered);
}

// 🛑 PREMIUM MENTOR MAPPING LOGIC (LIVE DB + SELECT ALL)
function renderMappingStaffList() {
    const container = document.getElementById('mapping-staff-list'); if(!container) return;
    const search = document.getElementById('map-staff-search').value.toLowerCase();
    const filteredStaff = staffDirectoryList.filter(s => s.name.toLowerCase().includes(search) || s.dept.toLowerCase().includes(search));
    if(filteredStaff.length === 0) { container.innerHTML = `<div style="padding: 40px 24px; text-align: center; color: #94A3B8;"><i class="fa-solid fa-search" style="font-size: 2rem; opacity: 0.3; margin-bottom: 12px; display: block;"></i>No staff match your search.</div>`; return; }
    container.innerHTML = filteredStaff.map(s => {
        const assignedCount = allStudentsList.filter(st => st.mentor_id == s.id).length;
        let badgeClass = 'badge-primary'; if (assignedCount >= 20) badgeClass = 'badge-danger'; else if (assignedCount >= 15) badgeClass = 'badge-warning'; else if (assignedCount > 0) badgeClass = 'badge-success'; else badgeClass = '';
        const badgeHtml = badgeClass ? `<span class="badge ${badgeClass}" style="font-size: 0.7rem;">${assignedCount}/20</span>` : `<span class="badge" style="background: #F1F5F9; color: #64748B; font-size: 0.7rem; border: 1px solid #E2E8F0;">0/20</span>`;
        return `<div class="staff-map-item ${activeMappingStaffId == s.id ? 'active' : ''}" onclick="selectMappingStaff(${s.id})"><img src="https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=random&color=fff&rounded=true" style="width: 44px; height: 44px; border-radius: 12px; border: 1px solid #E2E8F0;"><div style="flex: 1;"><div style="font-weight: 700; color: #0F172A; font-size: 0.95rem; margin-bottom: 2px;">${esc(s.name)}</div><div style="font-size: 0.75rem; color: #64748B;">${esc(s.dept)}</div></div>${badgeHtml}</div>`;
    }).join('');
}
function selectMappingStaff(id) {
    activeMappingStaffId = id; selectedUnassigned.clear(); selectedAssigned.clear();
    const staff = staffDirectoryList.find(s => s.id == id); if(!staff) return;
    document.getElementById('mapping-header-empty').style.display = 'none'; document.getElementById('mapping-workspace').style.display = 'flex';
    document.getElementById('map-active-name').innerText = staff.name; document.getElementById('map-active-dept').innerText = staff.dept; document.getElementById('map-active-img').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(staff.name)}&background=random&color=fff`;
    renderMappingStaffList(); renderMappingWorkspace();
}
function selectAllMapping(type) {
    const search = document.getElementById('map-student-search').value.toLowerCase();
    if(type === 'unassigned') {
        let unassignedPool = allStudentsList.filter(s => !s.mentor_id || s.mentor_id == null || s.mentor_id === "");
        unassignedPool = unassignedPool.filter(s => s.full_name.toLowerCase().includes(search) || (s.roll_no && s.roll_no.toLowerCase().includes(search)));
        let allSelected = unassignedPool.length > 0 && unassignedPool.every(s => selectedUnassigned.has(s.email));
        if (allSelected) { unassignedPool.forEach(s => selectedUnassigned.delete(s.email)); } else { unassignedPool.forEach(s => selectedUnassigned.add(s.email)); }
    } else {
        let assignedPool = allStudentsList.filter(s => s.mentor_id == activeMappingStaffId);
        let allSelected = assignedPool.length > 0 && assignedPool.every(s => selectedAssigned.has(s.email));
        if (allSelected) { assignedPool.forEach(s => selectedAssigned.delete(s.email)); } else { assignedPool.forEach(s => selectedAssigned.add(s.email)); }
    }
    renderMappingWorkspace();
}
function renderMappingWorkspace() {
    if(!activeMappingStaffId) return;
    const unassignedList = document.getElementById('map-unassigned-list'); const assignedList = document.getElementById('map-assigned-list'); const search = document.getElementById('map-student-search').value.toLowerCase();
    let assignedPool = allStudentsList.filter(s => s.mentor_id == activeMappingStaffId); let unassignedPool = allStudentsList.filter(s => !s.mentor_id || s.mentor_id == null || s.mentor_id === "");
    const currentCount = assignedPool.length; document.getElementById('map-capacity-text').innerText = `${currentCount} / 20`;
    const bar = document.getElementById('map-capacity-bar'); bar.style.width = `${(currentCount / 20) * 100}%`;
    if (currentCount >= 20) { bar.style.background = '#EF4444'; document.getElementById('map-capacity-text').style.color = '#EF4444'; } else if (currentCount >= 15) { bar.style.background = '#F59E0B'; document.getElementById('map-capacity-text').style.color = '#D97706'; } else { bar.style.background = '#4F46E5'; document.getElementById('map-capacity-text').style.color = '#0F172A'; }
    
    const unassignedHeader = document.getElementById('map-unassigned-count').parentElement;
    if (!document.getElementById('btn-sel-unassigned')) { unassignedHeader.innerHTML = `<div style="display: flex; align-items: center; gap: 10px;"><span style="font-weight: 800; font-size: 0.95rem; color: #334155;">Unassigned Students</span><span id="map-unassigned-count" class="badge" style="background: #F1F5F9; color: #475569;">${unassignedPool.length}</span></div><button id="btn-sel-unassigned" class="action-btn btn-outline" style="padding: 4px 12px; font-size: 0.75rem; color: var(--primary); border-color: #E2E8F0; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);" onclick="selectAllMapping('unassigned')">Select All</button>`; } else { document.getElementById('map-unassigned-count').innerText = unassignedPool.length; }
    const assignedHeader = document.getElementById('map-assigned-count').parentElement;
    if (!document.getElementById('btn-sel-assigned')) { assignedHeader.innerHTML = `<div style="display: flex; align-items: center; gap: 10px;"><span style="font-weight: 800; font-size: 0.95rem; color: #4338CA;">Current Batch</span><span id="map-assigned-count" class="badge" style="background: #4F46E5; color: white;">${currentCount}</span></div><button id="btn-sel-assigned" class="action-btn btn-outline" style="padding: 4px 12px; font-size: 0.75rem; color: #4338CA; border-color: #C7D2FE; background: white; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);" onclick="selectAllMapping('assigned')">Select All</button>`; } else { document.getElementById('map-assigned-count').innerText = currentCount; }

    unassignedPool = unassignedPool.filter(s => s.full_name.toLowerCase().includes(search) || (s.roll_no && s.roll_no.toLowerCase().includes(search)));
    const uBtn = document.getElementById('btn-sel-unassigned'); if(uBtn) { const allUSelected = unassignedPool.length > 0 && unassignedPool.every(s => selectedUnassigned.has(s.email)); uBtn.innerHTML = allUSelected ? `<i class="fa-solid fa-xmark"></i> Deselect All` : `<i class="fa-solid fa-check-double"></i> Select All`; }
    const aBtn = document.getElementById('btn-sel-assigned'); if(aBtn) { const allASelected = assignedPool.length > 0 && assignedPool.every(s => selectedAssigned.has(s.email)); aBtn.innerHTML = allASelected ? `<i class="fa-solid fa-xmark"></i> Deselect All` : `<i class="fa-solid fa-check-double"></i> Select All`; }

    if(unassignedPool.length === 0) { unassignedList.innerHTML = `<div style="text-align: center; margin-top: 60px; color: #94A3B8;"><i class="fa-solid fa-users-slash" style="font-size: 2.5rem; color: #E2E8F0; margin-bottom: 16px;"></i><div style="font-size: 0.95rem; font-weight: 600;">No students found.</div></div>`; } else { unassignedList.innerHTML = unassignedPool.map(s => `<div class="student-map-item ${selectedUnassigned.has(s.email) ? 'selected' : ''}" onclick="toggleMapSelect('${s.email}', 'unassigned')"><div class="custom-checkbox"></div><div style="flex: 1;"><div style="font-weight: 700; color: #1E293B; font-size: 0.9rem;">${esc(s.full_name)}</div><div style="font-size: 0.75rem; color: #64748B; margin-top: 4px;"><span style="font-family: monospace; background: #F1F5F9; padding: 2px 4px; border-radius: 4px; border: 1px solid #E2E8F0;">${esc(s.roll_no)}</span> <span style="margin-left: 6px;">${esc(s.department)}</span></div></div></div>`).join(''); }
    if(assignedPool.length === 0) { assignedList.innerHTML = `<div style="text-align: center; margin-top: 60px; color: #94A3B8;"><i class="fa-solid fa-user-plus" style="font-size: 2.5rem; color: #C7D2FE; margin-bottom: 16px;"></i><div style="font-size: 0.95rem; font-weight: 600;">Batch is empty.</div></div>`; } else { assignedList.innerHTML = assignedPool.map(s => `<div class="student-map-item ${selectedAssigned.has(s.email) ? 'selected' : ''}" style="border-color: #E2E8F0;" onclick="toggleMapSelect('${s.email}', 'assigned')"><div class="custom-checkbox"></div><div style="flex: 1; display: flex; align-items: center; gap: 12px;"><img src="https://ui-avatars.com/api/?name=${encodeURIComponent(s.full_name)}&background=random&color=fff&rounded=true" style="width: 36px; height: 36px; border-radius: 8px;"><div><div style="font-weight: 700; color: #1E293B; font-size: 0.9rem;">${esc(s.full_name)}</div><div style="font-size: 0.75rem; color: #64748B; margin-top: 2px; font-family: monospace;">${esc(s.roll_no)}</div></div></div></div>`).join(''); }
}
function toggleMapSelect(email, type) { if(type === 'unassigned') { if(selectedUnassigned.has(email)) selectedUnassigned.delete(email); else selectedUnassigned.add(email); } else { if(selectedAssigned.has(email)) selectedAssigned.delete(email); else selectedAssigned.add(email); } renderMappingWorkspace(); }
function assignSelected() { if(!activeMappingStaffId || selectedUnassigned.size === 0) return; const currentCount = allStudentsList.filter(s => s.mentor_id == activeMappingStaffId).length; if(currentCount + selectedUnassigned.size > 20) return showToast("Capacity Exceeded", "A mentor can only handle a maximum of 20 students.", "error"); allStudentsList.forEach(s => { if(selectedUnassigned.has(s.email)) s.mentor_id = activeMappingStaffId; }); selectedUnassigned.clear(); renderMappingWorkspace(); renderMappingStaffList(); showToast("Assigned", "Students moved to batch. Remember to save.", "warning"); }
function unassignSelected() { if(selectedAssigned.size === 0) return; allStudentsList.forEach(s => { if(selectedAssigned.has(s.email)) s.mentor_id = null; }); selectedAssigned.clear(); renderMappingWorkspace(); renderMappingStaffList(); showToast("Removed", "Students removed from batch. Remember to save.", "warning"); }

async function saveMentorMappings() {
    if(!activeMappingStaffId) return showToast("Notice", "Select a mentor before saving.", "warning");
    const btn = document.querySelector('#view-mapping .btn-success'); const originalHtml = btn.innerHTML; btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;
    
    const assignedEmails = allStudentsList.filter(s => s.mentor_id == activeMappingStaffId).map(s => s.email);
    const unassignedEmails = allStudentsList.filter(s => s.mentor_id == null).map(s => s.email);
    
    try {
        const req = await fetch(`${BASE_URL}/api/admin/save-mentors`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, staffId: activeMappingStaffId, studentEmails: assignedEmails, unassignedEmails: unassignedEmails }) });
        const res = await req.json();
        if(res.success) { showToast("Saved!", "Mentor batch assignments successfully saved.", "success"); fetchDirectory(); } 
        else { showToast("Database Error", res.message, "error"); }
    } catch (e) { showToast("Network Error", "Could not connect to the database to save mappings.", "error"); }
    btn.innerHTML = originalHtml;
}

// ==============================================================================
// 🛑 OTHER CRUD (Staff, Depts)
// ==============================================================================
async function fetchStaffDirectory() { 
    try { 
        const req = await fetch(`${BASE_URL}/api/admin/staff/list`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken }) }); 
        const res = await req.json(); 
        if(res.success) { 
            staffDirectoryList = res.staff; 
            renderStaffDirectory(); 
            if(activeMappingStaffId) renderMappingStaffList(); 
            fetchDirectory(); 
        } 
    } catch(e) { } 
}
function renderStaffDirectory() {
    const tbody = document.querySelector('#view-staff tbody'); if(!tbody) return;
    if(staffDirectoryList.length === 0) { tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">No staff found.</td></tr>`; return; }
    tbody.innerHTML = staffDirectoryList.map(staff => `<tr><td style="font-weight:600; color: var(--text-main);"><div style="display: flex; align-items: center; gap: 12px;"><img src="https://ui-avatars.com/api/?name=${encodeURIComponent(staff.name)}&background=random&color=fff&rounded=true" style="width: 32px; height: 32px;"><div>${esc(staff.name)}</div></div></td><td style="color: var(--text-muted);">${esc(staff.email)}</td><td><span class="badge" style="background: #FEF3C7; color: #92400E;">${esc(staff.role)}</span></td><td>${esc(staff.dept)}</td><td><div style="display: flex; gap: 8px;"><i class="fa-solid fa-pen admin-table-edit" onclick="openStaffModal(${staff.id})"></i><i class="fa-solid fa-trash admin-table-del" style="color: var(--danger);" onclick="deleteStaff(${staff.id})"></i></div></td></tr>`).join('');
}
function openStaffModal(id = null) {
    if(id) { const staff = staffDirectoryList.find(s => s.id === id); if(!staff) return; document.getElementById('staff-modal-title').innerText = "Edit Staff"; document.getElementById('staff-id').value = staff.id; document.getElementById('staff-name').value = staff.name; document.getElementById('staff-email').value = staff.email; document.getElementById('staff-role').value = staff.role; document.getElementById('staff-dept').value = staff.dept; } 
    else { document.getElementById('staff-modal-title').innerText = "Add Staff"; document.getElementById('staff-id').value = ""; document.getElementById('staff-name').value = ""; document.getElementById('staff-email').value = ""; document.getElementById('staff-role').value = ""; document.getElementById('staff-dept').value = ""; }
    openModal('staff-modal');
}
async function submitStaffForm() { 
    const id = document.getElementById('staff-id').value; const name = document.getElementById('staff-name').value.trim(); const email = document.getElementById('staff-email').value.trim(); const role = document.getElementById('staff-role').value.trim(); const dept = document.getElementById('staff-dept').value.trim(); 
    if(!name || !email) return showToast("Missing Fields", "Name and Email are required.", "warning"); 
    const endpoint = id ? '/api/admin/staff/edit' : '/api/admin/staff/add'; const payload = { adminToken: globalToken, name, email, role, dept }; if(id) payload.id = id; 
    try { await fetch(`${BASE_URL}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); closeModal('staff-modal'); fetchStaffDirectory(); showToast("Success", "Staff updated.", "success"); } catch(e) { } 
}
async function deleteStaff(id) { if(!confirm("Remove staff member?")) return; try { await fetch(`${BASE_URL}/api/admin/staff/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, id }) }); fetchStaffDirectory(); showToast("Deleted", "Staff removed.", "success"); } catch(e) { } }

async function fetchDepartments() { try { const req = await fetch(`${BASE_URL}/api/admin/departments/list`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken }) }); const res = await req.json(); if(res.success) { departmentsList = res.departments; renderDepartments(); } } catch(e) { } }
function renderDepartments() {
    const grid = document.getElementById('deptGrid'); if(!grid) return;
    if(departmentsList.length === 0) { grid.innerHTML = `<div class="card" style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">No departments configured.</div>`; return; }
    grid.innerHTML = departmentsList.map(dept => `<div class="card" style="padding: 24px; display: flex; flex-direction: column;"><div class="flex-between" style="align-items: flex-start; margin-bottom: 16px;"><div style="background: ${dept.bg || '#EEF2FF'}; color: ${dept.color || '#4F46E5'}; width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;"><i class="fa-solid ${dept.icon || 'fa-building'}"></i></div><div style="display: flex; gap: 8px;"><i class="fa-solid fa-pen" style="color: var(--primary); cursor: pointer; padding: 4px;" onclick="openDeptModal(${dept.id})"></i><i class="fa-solid fa-trash" style="color: var(--danger); cursor: pointer; padding: 4px;" onclick="deleteDepartment(${dept.id})"></i></div></div><h3 style="font-size: 1.2rem; font-weight: 800; color: var(--text-main); margin: 0 0 4px 0;">${esc(dept.name)}</h3><p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 20px 0;">Dept. Code: ${esc(dept.code)}</p><div style="background: #F8FAFC; border-radius: 8px; padding: 12px; display: flex; justify-content: space-between; border: 1px solid var(--border); margin-top: auto;"><div style="text-align: center;"><div style="font-size: 1.2rem; font-weight: 800; color: var(--primary);">${dept.students || 0}</div><div style="font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Students</div></div><div style="width: 1px; background: var(--border);"></div><div style="text-align: center;"><div style="font-size: 1.2rem; font-weight: 800; color: var(--success);">${dept.faculty || 0}</div><div style="font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Faculty</div></div></div></div>`).join('');
}
function openDeptModal(id = null) {
    if(id) { const dept = departmentsList.find(d => d.id === id); if(!dept) return; document.getElementById('dept-modal-title').innerText = "Edit Department"; document.getElementById('dept-id').value = dept.id; document.getElementById('dept-name').value = dept.name; document.getElementById('dept-code').value = dept.code; document.getElementById('dept-students').value = dept.students || 0; document.getElementById('dept-faculty').value = dept.faculty || 0; } 
    else { document.getElementById('dept-modal-title').innerText = "Add Department"; document.getElementById('dept-id').value = ""; document.getElementById('dept-name').value = ""; document.getElementById('dept-code').value = ""; document.getElementById('dept-students').value = ""; document.getElementById('dept-faculty').value = ""; }
    openModal('dept-modal');
}
async function submitDepartmentForm() { 
    const id = document.getElementById('dept-id').value; const name = document.getElementById('dept-name').value.trim(); const code = document.getElementById('dept-code').value.trim(); const students = document.getElementById('dept-students').value || 0; const faculty = document.getElementById('dept-faculty').value || 0; 
    if(!name || !code) return showToast("Missing Fields", "Department Name and Code are required.", "error"); 
    const endpoint = id ? '/api/admin/departments/edit' : '/api/admin/departments/add'; const payload = { adminToken: globalToken, name, code, students, faculty, icon: 'fa-building', color: '#4F46E5', bg: '#EEF2FF' }; if(id) payload.id = id; 
    try { await fetch(`${BASE_URL}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); closeModal('dept-modal'); fetchDepartments(); showToast("Success", "Department saved.", "success"); } catch(e) { } 
}
async function deleteDepartment(id) { if(!confirm("Delete this department?")) return; try { await fetch(`${BASE_URL}/api/admin/departments/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, id }) }); fetchDepartments(); showToast("Deleted", "Department block removed.", "success"); } catch(e) { } }

// 🛑 MODALS & PROFILE EDIT LOGIC
async function loadStudentModal(email) {
    targetStudentEmail = email; const overviewTab = document.querySelector('.modal-tab'); if(overviewTab) switchModalTab('overview', overviewTab);
    document.getElementById('modal-student-name').innerText = "Loading data..."; document.getElementById('modal-student-email').innerText = email; openModal('student-edit-modal');
    try {
        const req = await fetch(`${BASE_URL}/api/admin/student-data`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, targetEmail: email }) });
        const data = await req.json();
        if (data.success) { currentStudentSkills = data.skills || []; populateModalDashboard(data.profile, data.courses, data.skills, data.semGpas); } else { showToast("Error", "Failed to fetch student data.", "error"); closeModal('student-edit-modal'); }
    } catch(e) { showToast("Network Error", "Could not load data.", "error"); closeModal('student-edit-modal'); }
}
function populateModalDashboard(p, courses, skills, semGpas) {
    if(!p) return;
    document.getElementById('modal-student-name').innerText = p.full_name; document.getElementById('modal-student-dept').innerText = p.department || 'No Dept'; document.getElementById('modal-student-img').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(p.full_name)}&background=4F46E5&color=fff&bold=true`;
    document.getElementById('val-cgpa').innerText = parseFloat(p.cgpa || 0).toFixed(2); document.getElementById('val-sgpa').innerText = parseFloat(p.sgpa || 0).toFixed(2); document.getElementById('val-attendance').innerText = p.attendance || '0'; document.getElementById('val-reward_points').innerText = p.reward_points || '0'; document.getElementById('val-arrears').innerText = p.arrears || '0'; document.getElementById('val-leaves').innerText = p.leaves || '0';
    renderChart(courses, semGpas);

    const skillsContainer = document.getElementById('skills-container');
    if (skillsContainer) {
        if(skills && skills.length > 0) {
            skillsContainer.innerHTML = skills.map(c => {
                const total = Number(c.total_levels) || 1; const comp = Number(c.completed_levels) || 0; const pct = Math.round((comp / total) * 100);
                let segmentsHtml = ''; for(let i=0; i<total; i++) { segmentsHtml += `<div style="flex: 1; border-radius: 4px; background: ${i < comp ? '#8B5CF6' : '#E2E8F0'}; height: 6px;"></div>`; }
                return `<div class="card" style="padding: 0; overflow: hidden; border: 1px solid #E2E8F0;"><div style="height: 120px; width: 100%; position: relative; background: #F8FAFC;"><img src="${processImageUrl(c.image_url)}" onerror="this.src='https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=500&q=80';" style="width: 100%; height: 100%; object-fit: cover;"></div><div style="padding: 16px;"><h4 style="margin: 0 0 12px 0; font-size: 0.95rem; color: #0F172A; font-weight: 800;">${esc(c.skill_name)}</h4><div style="display: flex; justify-content: space-between; align-items: center; color: #64748B; font-size: 0.8rem; font-weight: 700; margin-bottom: 12px;"><span>Levels: ${total}</span><span id="wrap-lvl-${c.id}" style="color: var(--primary);"><span id="val-lvl-${c.id}">${comp}</span> comp <i class="fa-solid fa-pen admin-table-edit" onclick="openProfileEdit('completed_levels', 'val-lvl-${c.id}', '40px', '${c.id}', '${total}')"></i></span></div><div style="display: flex; gap: 4px; height: 6px; margin-bottom: 8px;">${segmentsHtml}</div><div style="display: flex; justify-content: space-between; align-items: center;"><div style="font-size: 0.7rem; color: #64748B; font-weight: 600;">${pct}%</div><i class="fa-solid fa-trash admin-table-del" title="Remove Course" style="color: #EF4444;" onclick="removeAssignedSkill(${c.id}, '${esc(c.skill_name)}')"></i></div></div></div>`;
            }).join('');
        } else { skillsContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color:#94A3B8; font-weight: 500; border: 1px dashed #CBD5E1; border-radius: 12px;">No PCDP courses assigned.</div>`; }
    }
    const acadContainer = document.getElementById('academics-container');
    if (acadContainer) {
        if(courses && courses.length > 0) {
            let sems = {}; courses.forEach(c => { if(!sems[c.semester]) sems[c.semester]=[]; sems[c.semester].push(c); }); let gpaMap = {}; if (semGpas) semGpas.forEach(g => gpaMap[g.semester] = g.gpa);
            acadContainer.innerHTML = Object.keys(sems).sort((a,b)=>b-a).map(sem => {
                let semGpaVal = gpaMap[sem] || '--';
                return `<div class="card" style="padding:0; overflow:hidden; border: 1px solid #E2E8F0; margin-bottom: 16px;"><div style="background: #EEF2FF; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #C7D2FE;"><div style="font-weight: 800; color: var(--primary);">Semester ${sem}</div><div style="display:flex; align-items:center; gap:8px;"><span style="font-size:0.75rem; font-weight:700; color:#4F46E5;">GPA</span><div class="flex-center" id="wrap-gpa-${sem}" style="background:white; padding:4px 10px; border-radius:6px; font-weight:800; color:var(--primary); box-shadow:0 1px 2px rgba(0,0,0,0.05);"><span id="val-gpa-${sem}">${semGpaVal}</span><i class="fa-solid fa-pen admin-table-edit" style="color:#64748B;" onclick="openGpaEdit(${sem}, '${semGpaVal}')"></i></div></div></div><table class="clean-table" style="margin:0;"><thead><tr><th style="padding-left:20px;">Subject</th><th>Marks</th><th>Grade</th><th></th></tr></thead><tbody>${sems[sem].map(c => `<tr id="row-crs-${c.id}"><td style="padding-left:20px; color: #0F172A; font-weight: 600;">${esc(c.course_name)}</td><td style="color: var(--primary); font-weight: 700; font-family: monospace;">${c.marks || '--'}</td><td><span class="badge ${c.grade && (c.grade.includes('A')||c.grade==='O')?'badge-success':'badge-primary'}">${c.grade || '--'}</span></td><td style="text-align:right;"><i class="fa-solid fa-trash admin-table-del" style="color:#EF4444;" onclick="deleteCourse(${c.id})"></i></td></tr>`).join('')}</tbody></table></div>`
            }).join('');
        } else { acadContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color:#94A3B8; border: 1px dashed #CBD5E1; border-radius: 12px;">No academic records logged yet.</div>`; }
    }
}
function renderChart(courses, semGpas) {
    const ctx = document.getElementById('gpaChart'); if(!ctx) return; let labels = []; let dataPoints = []; let gpaMap = {}; if(semGpas) semGpas.forEach(g => gpaMap[g.semester] = g.gpa);
    if (courses && courses.length > 0) {
        let semData = {}; courses.forEach(c => { if (!semData[c.semester]) semData[c.semester] = { total: 0, count: 0 }; let pts = 0; if((c.grade||'').includes('O')) pts = 10; else if(c.grade === 'A+') pts = 9; else if(c.grade === 'A') pts = 8; else if(c.grade === 'B+') pts = 7; else if(c.grade === 'B') pts = 6; else if(c.grade === 'C') pts = 5; semData[c.semester].total += pts; semData[c.semester].count += 1; });
        Object.keys(semData).sort((a,b) => a-b).forEach(sem => { labels.push(`Sem ${sem}`); if(gpaMap[sem] && gpaMap[sem] !== '--') { dataPoints.push(parseFloat(gpaMap[sem])); } else { dataPoints.push((semData[sem].total / semData[sem].count).toFixed(2)); } });
    } else { labels = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6']; dataPoints = [0,0,0,0,0,0]; }
    if (gpaChartInstance) gpaChartInstance.destroy(); let gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300); gradient.addColorStop(0, 'rgba(79, 70, 229, 0.15)'); gradient.addColorStop(1, 'rgba(79, 70, 229, 0)');
    gpaChartInstance = new Chart(ctx, { type: 'line', data: { labels: labels, datasets: [{ label: 'Avg SGPA', data: dataPoints, borderColor: '#4F46E5', backgroundColor: gradient, borderWidth: 3, pointBackgroundColor: '#FFF', pointBorderColor: '#4F46E5', pointBorderWidth: 2, pointRadius: 4, fill: true, tension: 0.3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 10, border: {display: false} }, x: { grid: { display: false }, border: {display: false} } }, interaction: { mode: 'index', intersect: false } } });
}
function openProfileEdit(field, spanId, width, customId, totalLevels) { const span = document.getElementById(spanId); originalValues[spanId] = span.innerText.trim(); span.parentElement.innerHTML = `<div class="flex-center" style="width: 100%; gap:4px;"><input type="text" id="in-${spanId}" class="search-wrapper" style="width: ${width}; padding:6px 10px; margin:0; border: 1px solid var(--primary); border-radius: 6px; outline:none;" value="${originalValues[spanId]}"><i class="fa-solid fa-check action-icon save" style="width:28px; height:28px;" onclick="saveProfileEdit('${field}', '${spanId}', '${width}', '${customId || ''}', '${totalLevels || ''}')"></i><i class="fa-solid fa-xmark action-icon cancel" style="width:28px; height:28px;" onclick="cancelProfileEdit('${spanId}', '${field}', '${width}', '${customId || ''}', '${totalLevels || ''}')"></i></div>`; }
function cancelProfileEdit(spanId, field, width, customId, totalLevels) { const wrapper = document.getElementById(`in-${spanId}`).parentElement.parentElement; wrapper.innerHTML = `<span id="${spanId}">${originalValues[spanId]}</span><i class="fa-solid fa-pen admin-table-edit" onclick="openProfileEdit('${field}', '${spanId}', '${width}', '${customId}', '${totalLevels}')"></i>`; }
async function saveProfileEdit(field, spanId, width, customId, totalLevels) {
    const val = document.getElementById(`in-${spanId}`).value; 
    if (field === 'completed_levels' && totalLevels) { if (Number(val) > Number(totalLevels)) { showToast("Invalid Input", `Max levels is ${totalLevels}.`, "error"); cancelProfileEdit(spanId, field, width, customId, totalLevels); return; } if (Number(val) < 0) { showToast("Invalid Input", "Levels cannot be negative.", "error"); cancelProfileEdit(spanId, field, width, customId, totalLevels); return; } }
    const wrapper = document.getElementById(`in-${spanId}`).parentElement.parentElement; wrapper.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color: var(--primary);"></i>`;
    try { if(field === 'completed_levels') { await fetch(`${BASE_URL}/api/admin/update-skill`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, id: customId, completed_levels: val }) }); } else { await fetch(`${BASE_URL}/api/admin/update-field`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, targetEmail: targetStudentEmail, field: field, value: val }) }); }
        loadStudentModal(targetStudentEmail); showToast("Profile Updated", "Record saved successfully.", "success");
    } catch(e) { cancelProfileEdit(spanId, field, width, customId, totalLevels); showToast("Update Failed", "Could not save changes.", "error"); }
}
function openGpaEdit(sem, currentVal) { originalValues[`gpa-${sem}`] = currentVal; document.getElementById(`wrap-gpa-${sem}`).innerHTML = `<input type="text" id="in-gpa-${sem}" class="search-wrapper" style="width: 50px; padding:4px; border: 1px solid var(--primary); outline: none; border-radius: 4px;" value="${currentVal}"><i class="fa-solid fa-check action-icon save" onclick="saveGpaEdit(${sem})"></i>`; }
async function saveGpaEdit(sem) { const val = document.getElementById(`in-gpa-${sem}`).value; document.getElementById(`wrap-gpa-${sem}`).innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color: var(--primary);"></i>`; try { await fetch(`${BASE_URL}/api/admin/update-gpa`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, targetEmail: targetStudentEmail, semester: sem, gpa: val }) }); loadStudentModal(targetStudentEmail); showToast("GPA Updated", `Semester ${sem} GPA saved.`, "success"); } catch(e) { showToast("Update Failed", "Could not save GPA.", "error"); } }
async function submitNewStudent() { const email = document.getElementById('new-email').value.trim(); const name = document.getElementById('new-name').value.trim(); const roll = document.getElementById('new-roll').value.trim(); const dept = document.getElementById('new-dept').value.trim(); if(!email || !name) return showToast("Missing Fields", "Email and Student Name are required.", "warning"); try { await fetch(`${BASE_URL}/api/admin/update-field`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, targetEmail: email, field: 'full_name', value: name }) }); await fetch(`${BASE_URL}/api/admin/update-field`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, targetEmail: email, field: 'roll_no', value: roll }) }); await fetch(`${BASE_URL}/api/admin/update-field`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, targetEmail: email, field: 'department', value: dept }) }); closeModal('add-modal'); fetchDirectory(); showToast("Student Added", `${name} has been added.`, "success"); } catch (e) { showToast("Network Error", "Could not add student.", "error"); } }
async function deleteStudent(email, name) { if(!confirm(`⚠️ CRITICAL: Are you sure you want to completely delete ${name} (${email})?`)) return; try { await fetch(`${BASE_URL}/api/admin/delete-student`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, targetEmail: email }) }); fetchDirectory(); showToast("Student Deleted", "Record permanently removed.", "success"); } catch(e) { showToast("Deletion Failed", "Could not delete student.", "error"); } }
async function submitNewCourse() { const sem = document.getElementById('crs-sem').value; const name = document.getElementById('crs-name').value; const mark = document.getElementById('crs-mark').value; const grade = document.getElementById('crs-grade').value; if(!sem || !name || !mark || !grade) return showToast("Missing fields", "All fields are required.", "warning"); try { await fetch(`${BASE_URL}/api/admin/add-course`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, targetEmail: targetStudentEmail, semester: sem, course_name: name, marks: mark, grade: grade }) }); closeModal('add-course-modal'); document.getElementById('crs-sem').value=''; document.getElementById('crs-name').value=''; document.getElementById('crs-mark').value=''; document.getElementById('crs-grade').value=''; loadStudentModal(targetStudentEmail); showToast("Added", "Academic course logged.", "success"); } catch(e) {} }
async function deleteCourse(id) { if(!confirm("Delete subject record?")) return; try { await fetch(`${BASE_URL}/api/admin/delete-course`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, id: id }) }); loadStudentModal(targetStudentEmail); showToast("Deleted", "Course removed.", "success"); } catch(e) {} }
async function removeAssignedSkill(id, skillName) { if(!confirm(`Are you sure you want to completely remove "${skillName}"?`)) return; try { await fetch(`${BASE_URL}/api/admin/remove-skill`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, id: id }) }); loadStudentModal(targetStudentEmail); showToast("Removed", "Skill removed.", "success"); } catch(e) { showToast("Error", "Could not remove skill.", "error"); } }

// 🛑 ANNOUNCEMENTS
async function fetchAdminAnnouncements() { const feed = document.getElementById('admin-ann-feed'); if(!feed) return; feed.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i></div>`; try { const req = await fetch(`${BASE_URL}/api/announcements/list`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken }) }); const data = await req.json(); if (data.success) { if(data.announcements.length === 0) { feed.innerHTML = `<div class="card" style="text-align:center; padding: 40px; color:var(--text-muted);">No announcements posted yet.</div>`; return; } feed.innerHTML = data.announcements.map(ann => { let dateStr = new Date(ann.date_posted).toLocaleDateString('en-GB'); let targetLabel = ann.target_department || 'ALL'; let deptBadge = targetLabel === 'ALL' ? `<span class="badge" style="background: #E2E8F0; color: #475569; margin-right: 10px;"><i class="fa-solid fa-globe"></i> Global</span>` : `<span class="badge" style="background: var(--purple-light); color: var(--purple); margin-right: 10px;"><i class="fa-solid fa-bullseye"></i> ${targetLabel}</span>`; return `<div class="card" style="display: flex; gap: 20px; align-items: flex-start; padding: 24px; position: relative;"><button class="action-icon cancel" style="position: absolute; top: 16px; right: 16px;" onclick="deleteAnnouncement(${ann.id})"><i class="fa-solid fa-trash"></i></button><div style="background: #EEF2FF; color: #4F46E5; width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;"><i class="fa-solid fa-bullhorn"></i></div><div style="flex: 1; padding-right: 40px;"><h3 style="margin: 0 0 8px 0; font-size: 1.1rem; color: var(--text-main); font-weight: 800;">${esc(ann.title)}</h3><div style="margin-bottom: 12px;">${deptBadge}<span style="font-size: 0.8rem; color: var(--text-muted);"><i class="fa-regular fa-clock"></i> ${dateStr}</span></div><p style="margin: 0; color: var(--text-muted); line-height: 1.6; font-size: 0.95rem; white-space: pre-wrap;">${esc(ann.content)}</p></div></div>`; }).join(''); } } catch(e) { } }
async function submitAnnouncement() { const title = document.getElementById('ann-title').value.trim(); const content = document.getElementById('ann-content').value.trim(); const targetDept = document.getElementById('ann-target-dept').value; if(!title || !content) return showToast("Missing Fields", "Title and content required.", "warning"); try { await fetch(`${BASE_URL}/api/admin/add-announcement`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, title: title, type: 'College Announcement', content: content, target_department: targetDept }) }); closeModal('add-ann-modal'); document.getElementById('ann-title').value=''; document.getElementById('ann-content').value=''; fetchAdminAnnouncements(); showToast("Posted", "Announcement sent.", "success"); } catch(e) {} }
async function deleteAnnouncement(id) { if(!confirm("Delete announcement?")) return; await fetch(`${BASE_URL}/api/admin/delete-announcement`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, id: id }) }); fetchAdminAnnouncements(); showToast("Deleted", "Announcement removed.", "success"); }