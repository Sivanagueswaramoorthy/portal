// ==============================================================================
// 🛑 GLOBAL VARIABLES & SETUP
// ==============================================================================
const BASE_URL = 'https://portal-6crm.onrender.com';
let adminToken = localStorage.getItem('pcdp_session_token');
let masterCoursesData = []; 
let allStudentsList = [];
let targetStudentEmail = "";
let currentStudentSkills = [];
let originalValues = {}; 

// Arrays/Vars for Multi-Select Assignment
let assignSelectedStudentEmail = null;
let assignSelectedCourseIds = []; 
let currentlyVisibleCourseIds = []; // Tracks filtered list for "Select All"

if (!adminToken) window.location.href = 'index.html';

const esc = (str) => { if (!str) return '--'; return String(str).replace(/'/g, "&#39;").replace(/"/g, '&quot;'); };

window.onload = async () => { 
    injectPremiumStyles(); 
    loadMasterCourses(); 
    fetchStudents(); 
};

// ==============================================================================
// 🛑 UI CONTROLS & NAVIGATION 
// ==============================================================================
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar'); 
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('open');
    if (sidebar.classList.contains('open')) { overlay.classList.add('show'); } else { overlay.classList.remove('show'); }
}

function switchTab(tabId, element) { 
    try {
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active')); 
        if(element) element.classList.add('active'); 
        
        document.querySelectorAll('.view-section').forEach(view => {
            view.classList.remove('active');
            view.style.display = 'none';
        }); 
        
        const targetView = document.getElementById('view-' + tabId);
        if(targetView) {
            targetView.classList.add('active'); 
            targetView.style.display = 'block';
        }
        
        if(window.innerWidth <= 768) { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebar-overlay').classList.remove('show'); } 

        if(tabId === 'assign') {
            renderAssignStudentList();
            renderAssignCourseList();
        }
    } catch(e) { console.error("Tab switch error:", e); }
}

function signOut() { localStorage.removeItem('pcdp_session_token'); window.location.href = 'index.html'; }
function openModal(modalId) { const modal = document.getElementById(modalId); if(modal) modal.style.display = 'flex'; }
function closeModal(modalId) { const modal = document.getElementById(modalId); if(modal) modal.style.display = 'none'; }


// ==============================================================================
// 🛑 TOAST NOTIFICATIONS & CSS INJECTION
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
        .select-list-item { padding: 12px 16px; border: 1px solid #E2E8F0; border-radius: 8px; background: white; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: space-between; }
        .select-list-item:hover { border-color: #C084FC; background: #FAF5FF; }
        .select-list-item.selected { border-color: #7E22CE; background: #F3E8FF; box-shadow: 0 0 0 1px #7E22CE; }
    `;
    document.head.appendChild(style);
}

function showToast(title, message, type = 'success') {
    let container = document.getElementById('toast-container');
    if(!container) { container = document.createElement('div'); container.id = 'toast-container'; container.className = 'toast-container'; document.body.appendChild(container); }
    const toast = document.createElement('div'); toast.className = `toast-box ${type}`;
    let icon = 'fa-circle-check'; if(type === 'error') icon = 'fa-circle-xmark'; if(type === 'warning') icon = 'fa-triangle-exclamation';
    toast.innerHTML = `<i class="fa-solid ${icon} toast-icon"></i><div class="toast-content"><div class="toast-title">${title}</div><div class="toast-msg">${message}</div></div><i class="fa-solid fa-xmark toast-close" onclick="this.parentElement.remove()"></i>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 4500);
}


// ==============================================================================
// 🛑 REPOSITORY & LEVELS
// ==============================================================================
function processImageUrl(url) {
    if (!url || url.trim() === "") return 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=500&q=80';
    let finalUrl = url.trim();
    const driveMatch = finalUrl.match(/drive\.google\.com\/file\/d\/([^\/]+)/);
    if (driveMatch && driveMatch[1]) { return `https://drive.google.com/uc?id=${driveMatch[1]}`; }
    return finalUrl;
}

async function loadMasterCourses() {
    const grid = document.getElementById('pcdp-courses-grid');
    if(grid) grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 60px;"><i class="fa-solid fa-spinner fa-spin fa-2x" style="color: #7E22CE;"></i></div>`;
    try {
        const req = await fetch(`${BASE_URL}/api/pcdp/master/courses`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pcdpToken: adminToken }) });
        const data = await req.json();
        if (data.success) { 
            masterCoursesData = data.courses; 
            renderMasterGrid(masterCoursesData); 
            renderLevelsTable(masterCoursesData); 
            if(document.getElementById('stat-courses')) document.getElementById('stat-courses').innerText = masterCoursesData.length;
        } else { signOut(); }
    } catch(e) { 
        if(grid) grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 60px; color: #EF4444;">Network Error.</div>`; 
    }
}

function renderMasterGrid(courses) {
    const grid = document.getElementById('pcdp-courses-grid');
    if(!grid) return;
    if(courses.length === 0) { grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 60px; border: 1px dashed #CBD5E1; background: white; color: #64748B; border-radius: 12px;">No global courses created yet.</div>`; return; }
    
    grid.innerHTML = courses.map(c => {
        const imgUrl = processImageUrl(c.image_url);
        return `
        <div class="skill-card" style="padding: 0; display: flex; flex-direction: column; height: 100%; min-height: 380px; border: 1px solid #E2E8F0; border-radius: 12px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition: all 0.2s ease;">
            <div style="height: 160px; width: 100%; position: relative; flex-shrink: 0; border-radius: 12px 12px 0 0; overflow: hidden; background: #F8FAFC;">
                <img src="${imgUrl}" onerror="this.src='https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=500&q=80';" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                <div style="position: absolute; top: 12px; right: 12px; background: rgba(255,255,255,0.95); padding: 4px 10px; border-radius: 8px; font-size: 0.7rem; font-weight: 800; color: #7E22CE; box-shadow: 0 2px 4px rgba(0,0,0,0.05); backdrop-filter: blur(4px);"><i class="fa-solid fa-medal"></i> ${esc(c.category) || 'General'}</div>
            </div>
            <div style="padding: 20px; flex: 1; display: flex; flex-direction: column;">
                <h4 style="margin: 0 0 8px 0; font-size: 1.1rem; color: #0F172A; font-weight: 800; line-height: 1.3;">${esc(c.course_name)}</h4>
                <p style="font-size: 0.8rem; color: #64748B; margin-bottom: 20px; line-height: 1.6; flex: 1; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">${esc(c.description) || 'No description provided.'}</p>
                <div style="background: #F8FAFC; padding: 12px; border-radius: 8px; border: 1px solid #E2E8F0; margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; font-weight: 700; color: #64748B;">
                        <span><i class="fa-solid fa-layer-group" style="color: #7E22CE; opacity: 0.8; margin-right: 4px;"></i> Max Levels</span>
                        <span style="color: #0F172A; font-size: 1.1rem; font-weight: 800;">${c.total_levels}</span>
                    </div>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button onclick="openEditModal(${c.id})" class="action-btn btn-outline" style="flex: 1; justify-content: center; color: #7E22CE; border-color: #E9D5FF; padding: 10px;"><i class="fa-solid fa-pen"></i> Edit</button>
                    <button onclick="deleteMasterCourse(${c.id})" class="action-btn btn-outline" style="justify-content: center; color: #EF4444; border-color: #FECACA; padding: 10px 14px;"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        </div>`;
    }).join('');
}

function renderLevelsTable(courses) {
    const tbody = document.getElementById('levels-tbody');
    if(!tbody) return;
    if(courses.length === 0) { tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 40px; color: #94A3B8;">No courses available.</td></tr>`; return; }
    
    tbody.innerHTML = courses.map(c => {
        return `
        <tr style="border-bottom: 1px solid #E2E8F0;">
            <td style="font-weight: 700; color: #0F172A;">${esc(c.course_name)}</td>
            <td><span class="badge" style="background:#F3E8FF; color:#7E22CE;">${esc(c.category) || 'General'}</span></td>
            <td style="font-weight: 800; color: #0F172A;">${c.total_levels} Levels</td>
            <td style="text-align: right;">
                <button class="action-btn btn-outline" style="padding: 6px 12px; font-size: 0.8rem; border-color: #7E22CE; color: #7E22CE;" onclick="openEditModal(${c.id})"><i class="fa-solid fa-sliders"></i> Configure</button>
            </td>
        </tr>`;
    }).join('');
}

// 🛑 CREATE & EDIT MASTER COURSES
async function submitPageCreateCourse() {
    const name = document.getElementById('page-c-name').value.trim();
    const desc = document.getElementById('page-c-desc').value.trim();
    const levels = document.getElementById('page-c-levels').value;
    const cat = document.getElementById('page-c-cat').value.trim();
    const img = document.getElementById('page-c-img').value.trim();
    
    if(!name || !levels) return showToast("Missing Fields", "Course Title and Max Levels are required.", "warning");

    const btn = document.getElementById('btn-page-create');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...'; btn.disabled = true;

    try {
        const req = await fetch(`${BASE_URL}/api/pcdp/master/add`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pcdpToken: adminToken, course_name: name, description: desc, total_levels: levels, category: cat, image_url: img }) });
        const res = await req.json();
        if(res.success) {
            document.getElementById('page-c-name').value = ''; document.getElementById('page-c-desc').value = ''; document.getElementById('page-c-levels').value = ''; document.getElementById('page-c-cat').value = ''; document.getElementById('page-c-img').value = '';
            loadMasterCourses(); 
            showToast("Created", "New master course published globally.", "success");
            switchTab('repository', document.getElementById('nav-repository'));
        } else { showToast("Error", res.message, "error"); }
    } catch(e) { showToast("Error", "Could not add course.", "error"); }
    
    btn.innerHTML = 'Save to Global Repository'; btn.disabled = false;
}

function openEditModal(id) {
    const course = masterCoursesData.find(c => c.id == id);
    if(!course) return;
    document.getElementById('edit-c-id').value = course.id;
    document.getElementById('edit-c-name').value = course.course_name || '';
    document.getElementById('edit-c-desc').value = course.description || '';
    document.getElementById('edit-c-levels').value = course.total_levels || 1;
    document.getElementById('edit-c-cat').value = course.category || '';
    document.getElementById('edit-c-img').value = course.image_url || '';
    openModal('edit-course-modal');
}

async function submitEditMasterCourse() {
    const btn = document.querySelector('#edit-course-modal .btn-success');
    if(btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    try {
        await fetch(`${BASE_URL}/api/pcdp/master/edit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pcdpToken: adminToken, id: document.getElementById('edit-c-id').value, course_name: document.getElementById('edit-c-name').value, description: document.getElementById('edit-c-desc').value, total_levels: document.getElementById('edit-c-levels').value, category: document.getElementById('edit-c-cat').value, image_url: document.getElementById('edit-c-img').value }) });
        closeModal('edit-course-modal'); loadMasterCourses(); showToast("Updated", "Master course modified.", "success");
    } catch(e) { showToast("Error", "Could not update course.", "error"); } 
    if(btn) btn.innerHTML = 'Save Changes';
}

async function deleteMasterCourse(id) {
    if(!confirm("Are you sure you want to delete this master course?\n\n(Note: This will not remove it from students who already have it assigned in their personal profiles.)")) return;
    try { await fetch(`${BASE_URL}/api/pcdp/master/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pcdpToken: adminToken, id: id }) }); loadMasterCourses(); showToast("Deleted", "Master course removed.", "success"); } catch(e) {}
}


// ==============================================================================
// 🛑 STUDENT PROGRESS & SKILL MANAGEMENT
// ==============================================================================
async function fetchStudents() {
    const tbody = document.getElementById('student-progress-tbody');
    if(!tbody) return;
    try {
        const req = await fetch(`${BASE_URL}/api/admin/list`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pcdpToken: adminToken }) });
        const data = await req.json();
        if (data.success) {
            allStudentsList = data.students;
            if(document.getElementById('stat-students')) document.getElementById('stat-students').innerText = allStudentsList.length;
            
            populateDeptFilter();
            renderProgressTable(allStudentsList);
            
            const assignView = document.getElementById('view-assign');
            if(assignView && assignView.style.display !== 'none' && assignView.classList.contains('active')) {
                renderAssignStudentList();
            }
        } else { tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #EF4444;">Failed to load students.</td></tr>`; }
    } catch(e) { tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #EF4444;">Network Error.</td></tr>`; }
}

function renderProgressTable(students) {
    const tbody = document.getElementById('student-progress-tbody');
    if(!tbody) return;
    if(students.length === 0) { tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 40px; color: #94A3B8;">No students found.</td></tr>`; return; }
    
    tbody.innerHTML = students.map(s => `
        <tr class="dir-row" style="transition: 0.2s;" onmouseover="this.style.background='#F8FAFC'" onmouseout="this.style.background='white'">
            <td style="font-weight:600; color: #0F172A; cursor: pointer;" onclick="openManageSkillsModal('${esc(s.email)}', '${esc(s.full_name)}', '${esc(s.roll_no)}', '${esc(s.department)}')">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(s.full_name)}&background=random&color=fff&rounded=true" style="width: 36px; height: 36px; border-radius: 8px;">
                    <div>${esc(s.full_name)}<div style="font-size:0.75rem; color:#64748B; font-weight:400; font-family:monospace; margin-top:2px;">${esc(s.roll_no)}</div></div>
                </div>
            </td>
            <td><span class="badge" style="background:#F3E8FF; color:#7E22CE;">${esc(s.department)}</span></td>
            <td><span style="font-size:0.8rem; color:#64748B;"><i class="fa-solid fa-chart-bar" style="margin-right:4px;"></i> Click Manage to view</span></td>
            <td style="text-align: right;">
                <button class="action-btn btn-outline" style="padding: 6px 12px; font-size: 0.8rem; border-color: #7E22CE; color: #7E22CE;" onclick="openManageSkillsModal('${esc(s.email)}', '${esc(s.full_name)}', '${esc(s.roll_no)}', '${esc(s.department)}')">
                    <i class="fa-solid fa-sliders"></i> Manage Skills
                </button>
            </td>
        </tr>
    `).join('');
}

function filterProgressStudents() {
    const search = document.getElementById('search-student').value.toLowerCase();
    const filtered = allStudentsList.filter(s => ((s.full_name||'').toLowerCase().includes(search)) || ((s.roll_no||'').toLowerCase().includes(search)));
    renderProgressTable(filtered);
}

// 🛑 THE SKILL EDITOR MODAL
async function openManageSkillsModal(email, name, roll, dept) {
    targetStudentEmail = email;
    document.getElementById('ms-student-name').innerText = name;
    document.getElementById('ms-student-roll').innerText = roll || 'No Roll';
    document.getElementById('ms-student-dept').innerText = dept || 'No Dept';
    document.getElementById('ms-student-img').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=7E22CE&color=fff&bold=true`;
    
    document.getElementById('ms-skills-container').innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 60px; color: #7E22CE;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>`;
    openModal('manage-skills-modal');

    try {
        const req = await fetch(`${BASE_URL}/api/admin/student-data`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pcdpToken: adminToken, targetEmail: email }) });
        const data = await req.json();
        if (data.success) { 
            currentStudentSkills = data.skills || []; 
            renderStudentSkills(currentStudentSkills); 
        } else { showToast("Error", "Failed to fetch student data.", "error"); closeModal('manage-skills-modal'); }
    } catch(e) { showToast("Network Error", "Could not load data.", "error"); closeModal('manage-skills-modal'); }
}

function renderStudentSkills(skills) {
    const container = document.getElementById('ms-skills-container');
    if(!container) return;

    if(skills.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color:#94A3B8; border: 1px dashed #CBD5E1; border-radius: 12px; background: white;"><i class="fa-solid fa-folder-open" style="font-size: 2rem; color: #E2E8F0; margin-bottom: 12px;"></i><br>No PCDP courses assigned to this student yet.</div>`;
        return;
    }

    container.innerHTML = skills.map(c => {
        const total = Number(c.total_levels) || 1; const comp = Number(c.completed_levels) || 0; const pct = Math.round((comp / total) * 100);
        const imgUrl = processImageUrl(c.image_url);
        let segmentsHtml = ''; for(let i=0; i<total; i++) { segmentsHtml += `<div style="flex: 1; border-radius: 4px; background: ${i < comp ? '#A855F7' : '#E2E8F0'}; height: 6px;"></div>`; }
        return `
        <div class="card" style="padding: 0; overflow: hidden; border: 1px solid #E2E8F0; display: flex; flex-direction: column;">
            <div style="height: 120px; width: 100%; position: relative; background: #F8FAFC;">
                <img src="${imgUrl}" onerror="this.src='https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=500&q=80';" style="width: 100%; height: 100%; object-fit: cover;">
            </div>
            <div style="padding: 16px; flex: 1; display: flex; flex-direction: column;">
                <h4 style="margin: 0 0 12px 0; font-size: 0.95rem; color: #0F172A; font-weight: 800;">${esc(c.skill_name)}</h4>
                <div style="display: flex; justify-content: space-between; align-items: center; color: #64748B; font-size: 0.8rem; font-weight: 700; margin-bottom: 12px;">
                    <span>Max: ${total}</span>
                    <span id="wrap-lvl-${c.id}" style="color: #7E22CE;">
                        <span id="val-lvl-${c.id}">${comp}</span> done 
                        <i class="fa-solid fa-pen admin-table-edit" style="color: #7E22CE;" onclick="openProfileEdit('completed_levels', 'val-lvl-${c.id}', '40px', '${c.id}', '${total}')"></i>
                    </span>
                </div>
                <div style="display: flex; gap: 4px; height: 6px; margin-bottom: 12px;">${segmentsHtml}</div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: auto;">
                    <div style="font-size: 0.75rem; color: #64748B; font-weight: 600;">${pct}% Complete</div>
                    <button class="action-icon cancel" style="padding: 4px 8px; border: 1px solid #FECACA; border-radius: 6px; background: #FEF2F2;" onclick="removeAssignedSkill(${c.id}, '${esc(c.skill_name)}')"><i class="fa-solid fa-trash" style="color: #EF4444; font-size: 0.8rem;"></i></button>
                </div>
            </div>
        </div>`;
    }).join('');
}

// 🛑 INLINE SKILL EDITS
function openProfileEdit(field, spanId, width, customId, totalLevels) {
    const span = document.getElementById(spanId); originalValues[spanId] = span.innerText.trim();
    span.parentElement.innerHTML = `<div class="flex-center" style="width: 100%; gap:4px;"><input type="number" id="in-${spanId}" class="control-input" style="width: ${width}; padding:4px 8px; margin:0; border: 1px solid #7E22CE; outline:none;" value="${originalValues[spanId]}"><i class="fa-solid fa-check action-icon save" style="width:28px; height:28px; color: #7E22CE;" onclick="saveProfileEdit('${field}', '${spanId}', '${width}', '${customId}', '${totalLevels}')"></i><i class="fa-solid fa-xmark action-icon cancel" style="width:28px; height:28px;" onclick="cancelProfileEdit('${spanId}', '${field}', '${width}', '${customId}', '${totalLevels}')"></i></div>`;
}
function cancelProfileEdit(spanId, field, width, customId, totalLevels) {
    const wrapper = document.getElementById(`in-${spanId}`).parentElement.parentElement;
    wrapper.innerHTML = `<span id="${spanId}">${originalValues[spanId]}</span><i class="fa-solid fa-pen admin-table-edit" style="color: #7E22CE;" onclick="openProfileEdit('${field}', '${spanId}', '${width}', '${customId}', '${totalLevels}')"></i>`;
}
async function saveProfileEdit(field, spanId, width, customId, totalLevels) {
    const val = document.getElementById(`in-${spanId}`).value; 
    if (field === 'completed_levels' && totalLevels) {
        if (Number(val) > Number(totalLevels)) { showToast("Invalid Input", `Max levels is ${totalLevels}.`, "error"); cancelProfileEdit(spanId, field, width, customId, totalLevels); return; }
        if (Number(val) < 0) { showToast("Invalid Input", "Levels cannot be negative.", "error"); cancelProfileEdit(spanId, field, width, customId, totalLevels); return; }
    }
    const wrapper = document.getElementById(`in-${spanId}`).parentElement.parentElement; wrapper.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color: #7E22CE;"></i>`;
    try {
        await fetch(`${BASE_URL}/api/admin/update-skill`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: adminToken, id: customId, completed_levels: val }) }); 
        
        const req = await fetch(`${BASE_URL}/api/admin/student-data`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pcdpToken: adminToken, targetEmail: targetStudentEmail }) });
        const data = await req.json();
        currentStudentSkills = data.skills || []; renderStudentSkills(currentStudentSkills);
        showToast("Skill Updated", "Progress saved successfully.", "success");
    } catch(e) { cancelProfileEdit(spanId, field, width, customId, totalLevels); showToast("Update Failed", "Could not save changes.", "error"); }
}

async function removeAssignedSkill(id, skillName) {
    if(!confirm(`Are you sure you want to completely remove "${skillName}" from this student's profile?`)) return;
    try { 
        await fetch(`${BASE_URL}/api/admin/remove-skill`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: adminToken, id: id }) }); 
        const req = await fetch(`${BASE_URL}/api/admin/student-data`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pcdpToken: adminToken, targetEmail: targetStudentEmail }) });
        const data = await req.json();
        currentStudentSkills = data.skills || []; renderStudentSkills(currentStudentSkills);
        showToast("Removed", "Course removed from student.", "success");
    } catch(e) { showToast("Error", "Could not remove skill.", "error"); }
}


// ==============================================================================
// 🛑 FULL PAGE ASSIGN COURSES LOGIC (MULTI-SELECT & HIDE ALREADY ASSIGNED)
// ==============================================================================
function openPageAssignForStudent() {
    closeModal('manage-skills-modal');
    switchTab('assign', document.getElementById('nav-assign'));
    
    // Trigger the selection which fetches their current skills and cleans the view
    if (targetStudentEmail) {
        selectAssignStudent(targetStudentEmail);
    }
}

function populateDeptFilter() {
    const deptFilter = document.getElementById('assign-dept-filter');
    if(!deptFilter) return;
    
    const depts = [...new Set(allStudentsList.map(s => s.department).filter(Boolean))].sort();
    
    let html = '<option value="">All Departments</option>';
    depts.forEach(d => {
        html += `<option value="${esc(d)}">${esc(d)}</option>`;
    });
    deptFilter.innerHTML = html;
}

function renderAssignStudentList() {
    const listContainer = document.getElementById('assign-student-list');
    if(!listContainer) return;
    
    const search = document.getElementById('assign-student-search').value.toLowerCase();
    const deptFilter = document.getElementById('assign-dept-filter').value.toLowerCase();
    
    const filtered = allStudentsList.filter(s => {
        const matchesSearch = s.full_name.toLowerCase().includes(search) || (s.roll_no && s.roll_no.toLowerCase().includes(search));
        const sDept = (s.department || '').toLowerCase();
        const matchesDept = deptFilter === "" || sDept.includes(deptFilter);
        return matchesSearch && matchesDept;
    });
    
    if(filtered.length === 0) { listContainer.innerHTML = `<div style="text-align:center; padding:30px; color:#94A3B8; font-size:0.9rem;"><i class="fa-solid fa-users" style="font-size: 2rem; color: #E2E8F0; margin-bottom: 12px; display:block;"></i>No students found.</div>`; return; }
    
    listContainer.innerHTML = filtered.map(s => `
        <div class="select-list-item ${assignSelectedStudentEmail === s.email ? 'selected' : ''}" onclick="selectAssignStudent('${esc(s.email)}')">
            <div style="display: flex; align-items: center; gap: 12px;">
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(s.full_name)}&background=random&color=fff&rounded=true" style="width: 32px; height: 32px; border-radius: 8px;">
                <div>
                    <div style="font-weight: 700; color: #0F172A; font-size: 0.9rem;">${esc(s.full_name)}</div>
                    <div style="font-size: 0.75rem; color: #64748B;">${esc(s.roll_no)} • ${esc(s.department)}</div>
                </div>
            </div>
            <div class="multi-checkbox" style="border-radius: 50%;"><i class="fa-solid fa-check" style="font-size: 0.75rem;"></i></div>
        </div>
    `).join('');
}

async function selectAssignStudent(email) {
    assignSelectedStudentEmail = email;
    assignSelectedCourseIds = []; // Reset selections when student changes
    renderAssignStudentList();
    
    const listContainer = document.getElementById('assign-course-list');
    const btnSelectAll = document.getElementById('btn-select-all');
    const countLabel = document.getElementById('assign-course-count');
    
    if(listContainer) listContainer.innerHTML = `<div style="text-align:center; padding:30px; color:#94A3B8;"><i class="fa-solid fa-spinner fa-spin" style="font-size:1.5rem; color:#7E22CE; margin-bottom:12px;"></i><br>Loading student profile...</div>`;
    if(btnSelectAll) { btnSelectAll.disabled = true; btnSelectAll.innerText = "Select All"; }
    if(countLabel) countLabel.innerText = "Checking existing courses...";
    updateAssignSummary();

    // Fetch this specific student's current skills so we can hide them
    try {
        const req = await fetch(`${BASE_URL}/api/admin/student-data`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pcdpToken: adminToken, targetEmail: email }) });
        const data = await req.json();
        if (data.success) { 
            currentStudentSkills = data.skills || []; 
        } else {
            currentStudentSkills = [];
        }
    } catch(e) { 
        currentStudentSkills = []; 
        showToast("Warning", "Could not verify existing courses. Showing all.", "warning");
    }
    
    renderAssignCourseList();
    updateAssignSummary();
}

function renderAssignCourseList() {
    const listContainer = document.getElementById('assign-course-list');
    const countLabel = document.getElementById('assign-course-count');
    const btnSelectAll = document.getElementById('btn-select-all');
    if(!listContainer) return;
    
    // If no student is selected, wait for selection
    if (!assignSelectedStudentEmail) {
        listContainer.innerHTML = `<div style="text-align:center; padding:30px; color:#94A3B8; font-size:0.9rem;"><i class="fa-solid fa-user-check" style="font-size: 2rem; color: #E2E8F0; margin-bottom: 12px; display:block;"></i>Please select a student from the list on the left.</div>`;
        if(countLabel) countLabel.innerText = "Waiting for student selection";
        if(btnSelectAll) { btnSelectAll.disabled = true; btnSelectAll.innerText = "Select All"; }
        currentlyVisibleCourseIds = [];
        return;
    }

    const search = document.getElementById('assign-course-search').value.toLowerCase();
    const catFilter = document.getElementById('assign-cat-filter').value.toLowerCase();
    
    // Extract names of already assigned skills to filter them out
    const assignedSkillNames = currentStudentSkills.map(s => s.skill_name.toLowerCase());

    const filtered = masterCoursesData.filter(c => {
        // HIDE if the student already has it
        const isAlreadyAssigned = assignedSkillNames.includes(c.course_name.toLowerCase());
        if (isAlreadyAssigned) return false; 

        // Text and Category Filters
        const matchesSearch = c.course_name.toLowerCase().includes(search) || (c.category && c.category.toLowerCase().includes(search));
        const cCat = (c.category || 'General').toLowerCase();
        const matchesCat = catFilter === "" || cCat.includes(catFilter);
        return matchesSearch && matchesCat;
    });
    
    currentlyVisibleCourseIds = filtered.map(c => c.id);

    if(countLabel) countLabel.innerHTML = `<b>${filtered.length}</b> Unassigned Courses Available`;

    if(filtered.length === 0) { 
        listContainer.innerHTML = `<div style="text-align:center; padding:40px; color:#94A3B8; font-size:0.9rem;"><i class="fa-solid fa-check-double" style="font-size: 2.5rem; color: #10B981; margin-bottom: 12px; display:block;"></i>All caught up!<br>This student already has all available master courses in this category.</div>`; 
        if(btnSelectAll) btnSelectAll.disabled = true;
        return; 
    }
    
    // Check if all visible items are currently selected to toggle button state
    const allSelected = currentlyVisibleCourseIds.length > 0 && currentlyVisibleCourseIds.every(id => assignSelectedCourseIds.includes(id));
    if(btnSelectAll) {
        btnSelectAll.disabled = false;
        btnSelectAll.innerText = allSelected ? "Deselect All" : "Select All";
        btnSelectAll.style.background = allSelected ? "#F3E8FF" : "white";
        btnSelectAll.style.color = allSelected ? "#7E22CE" : "#475569";
        btnSelectAll.style.borderColor = allSelected ? "#7E22CE" : "#CBD5E1";
    }

    listContainer.innerHTML = filtered.map(c => `
        <div class="select-list-item ${assignSelectedCourseIds.includes(c.id) ? 'selected' : ''}" onclick="selectAssignCourse(${c.id})">
            <div style="display: flex; align-items: center; gap: 12px;">
                <div style="background: ${assignSelectedCourseIds.includes(c.id) ? '#7E22CE' : '#F3E8FF'}; width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: ${assignSelectedCourseIds.includes(c.id) ? 'white' : '#7E22CE'}; transition: 0.2s;"><i class="fa-solid fa-code"></i></div>
                <div>
                    <div style="font-weight: 700; color: #0F172A; font-size: 0.9rem;">${esc(c.course_name)}</div>
                    <div style="font-size: 0.75rem; color: #64748B;">${c.total_levels} Levels • ${esc(c.category || 'General')}</div>
                </div>
            </div>
            <div class="multi-checkbox"><i class="fa-solid fa-check" style="font-size: 0.75rem;"></i></div>
        </div>
    `).join('');
}

function selectAssignCourse(id) {
    if (assignSelectedCourseIds.includes(id)) {
        assignSelectedCourseIds = assignSelectedCourseIds.filter(cid => cid !== id);
    } else {
        assignSelectedCourseIds.push(id);
    }
    renderAssignCourseList();
    updateAssignSummary();
}

function toggleSelectAllCourses() {
    if (!currentlyVisibleCourseIds || currentlyVisibleCourseIds.length === 0) return;

    const allSelected = currentlyVisibleCourseIds.every(id => assignSelectedCourseIds.includes(id));

    if (allSelected) {
        // Deselect all currently visible items
        assignSelectedCourseIds = assignSelectedCourseIds.filter(id => !currentlyVisibleCourseIds.includes(id));
    } else {
        // Select all currently visible items
        currentlyVisibleCourseIds.forEach(id => {
            if (!assignSelectedCourseIds.includes(id)) {
                assignSelectedCourseIds.push(id);
            }
        });
    }
    
    renderAssignCourseList();
    updateAssignSummary();
}

function updateAssignSummary() {
    const textEl = document.getElementById('assign-summary-text');
    const btn = document.getElementById('btn-execute-assign');
    if(!textEl || !btn) return;
    
    let sName = "Student";
    if(assignSelectedStudentEmail) {
        const student = allStudentsList.find(s => s.email === assignSelectedStudentEmail);
        if(student) sName = student.full_name;
    }

    const courseCount = assignSelectedCourseIds.length;

    if (assignSelectedStudentEmail && courseCount > 0) {
        const courseText = courseCount === 1 ? "1 Course" : `${courseCount} Courses`;
        textEl.innerHTML = `Assign <span style="color:#7E22CE; font-weight:800;">${courseText}</span> to <span style="color:#7E22CE; font-weight:800;">${esc(sName)}</span>`;
        btn.disabled = false;
        btn.style.opacity = '1';
    } else {
        textEl.innerHTML = "Select a student and at least one course.";
        btn.disabled = true;
        btn.style.opacity = '0.5';
    }
}

async function executePageAssignment() {
    if(!assignSelectedStudentEmail || assignSelectedCourseIds.length === 0) return;
    
    const btn = document.getElementById('btn-execute-assign'); 
    const originalText = btn.innerHTML; 
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Assigning...'; btn.disabled = true;
    
    let successCount = 0;
    let failCount = 0;

    try { 
        // Send requests concurrently for all selected courses
        const promises = assignSelectedCourseIds.map(cid => 
            fetch(`${BASE_URL}/api/admin/assign-pcdp`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ 
                    pcdpToken: adminToken, 
                    targetEmail: assignSelectedStudentEmail, 
                    course_id: cid 
                }) 
            }).then(res => res.json())
        );

        const results = await Promise.all(promises);

        results.forEach(res => {
            if(res.success) successCount++;
            else failCount++;
        });

        if (successCount > 0 && failCount === 0) {
            showToast("Success", `Assigned ${successCount} course(s) successfully.`, "success"); 
        } else if (successCount > 0 && failCount > 0) {
            showToast("Partial Success", `Assigned ${successCount} course(s), failed to assign ${failCount}.`, "warning");
        } else {
            showToast("Error", "Failed to assign the selected courses.", "error"); 
        }
        
        // Refetch the student's skills so the newly assigned ones disappear from the list
        await selectAssignStudent(assignSelectedStudentEmail);

    } catch(e) { 
        showToast("Error", "Network error while assigning courses.", "error"); 
        btn.innerHTML = originalText; 
        btn.disabled = false;
    } 
}