const BASE_URL = 'https://portal-6crm.onrender.com';

let globalToken = localStorage.getItem('bit_session_token'); 
if (globalToken) { globalToken = globalToken.replace(/['"]+/g, ''); } 
else { window.location.href = 'index.html'; }

// Global Data Arrays
let allStudentsList = []; 
let targetStudentEmail = ""; 
let originalValues = {}; 
let gpaChartInstance = null;
let currentStudentSkills = []; 

let staffDirectoryList = [];
let departmentsList = [];

// Mapping State
let activeMappingStaffId = null;
let selectedUnassigned = new Set();
let selectedAssigned = new Set();

const esc = (str) => { if (!str) return '--'; return String(str).replace(/'/g, "&#39;").replace(/"/g, '&quot;'); };

window.onload = async () => {
    try {
        const req = await fetch(`${BASE_URL}/api/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: globalToken }) });
        const data = await req.json();
        
        if (!data.success || !data.isStaffAdmin) { 
            localStorage.removeItem('bit_session_token'); 
            window.location.href = 'index.html'; 
            return; 
        }

        document.getElementById('headerName').innerText = data.profile.full_name || 'Staff Admin';
        document.getElementById('headerEmail').innerText = data.profile.email || '';
        document.getElementById('headerImage').src = data.profile.picture || `https://ui-avatars.com/api/?name=Admin&background=4F46E5&color=fff`;

        // Initialize All Data
        fetchDirectory();
        fetchAdminAnnouncements();
        fetchStaffDirectory();
        fetchDepartments();
        injectMappingStyles();
    } catch (e) { 
        console.error("Dashboard Load Warning: Backend sleeping.", e);
    }
};

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('sidebar-overlay').classList.toggle('show'); }

function switchTab(tabId, element) { 
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active')); 
    if(element) element.classList.add('active'); 
    document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active')); 
    const targetView = document.getElementById('view-' + tabId);
    if(targetView) targetView.classList.add('active'); 
    if(window.innerWidth <= 768) { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebar-overlay').classList.remove('show'); } 
    
    // Trigger render logic if tab needs it
    if(tabId === 'mapping') {
        renderMappingStaffList();
    }
}

function signOut() { localStorage.removeItem('bit_session_token'); window.location.href = 'index.html'; }
function openModal(modalId) { const modal = document.getElementById(modalId); if (modal) modal.style.display = 'flex'; }
function closeModal(modalId) { const modal = document.getElementById(modalId); if (modal) modal.style.display = 'none'; }


// ==============================================================================
// 🛑 PREMIUM STUDENT-STAFF MAPPING LOGIC
// ==============================================================================
function injectMappingStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
        /* Left Staff Panel Items */
        .staff-map-item { padding: 16px 20px; border-bottom: 1px solid var(--border); cursor: pointer; transition: all 0.2s ease; border-left: 4px solid transparent; display: flex; align-items: center; gap: 14px; background: white; }
        .staff-map-item:hover { background: #F8FAFC; }
        .staff-map-item.active { background: #EEF2FF; border-left-color: var(--primary); }
        
        /* Right Panel Student Items */
        .student-map-item { padding: 12px 16px; border-radius: 10px; border: 1px solid var(--border); background: white; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; justify-content: space-between; gap: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.02); user-select: none; }
        .student-map-item:hover { border-color: #A5B4FC; transform: translateY(-1px); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .student-map-item.selected { background: #F8FAFC; border-color: var(--primary); box-shadow: 0 0 0 1px var(--primary); }
        
        /* Custom Checkbox UI */
        .custom-checkbox { width: 22px; height: 22px; border-radius: 6px; border: 2px solid #CBD5E1; display: flex; align-items: center; justify-content: center; transition: 0.2s ease; background: white; flex-shrink: 0; }
        .student-map-item.selected .custom-checkbox { background: var(--primary); border-color: var(--primary); }
        .student-map-item.selected .custom-checkbox::after { content: '\\f00c'; font-family: "Font Awesome 6 Free"; font-weight: 900; color: white; font-size: 12px; }
    `;
    document.head.appendChild(style);
}

function renderMappingStaffList() {
    const container = document.getElementById('mapping-staff-list');
    const search = document.getElementById('map-staff-search').value.toLowerCase();
    
    const filteredStaff = staffDirectoryList.filter(s => s.name.toLowerCase().includes(search) || s.dept.toLowerCase().includes(search));
    
    if(filteredStaff.length === 0) {
        container.innerHTML = `<div style="padding: 40px 24px; text-align: center; color: var(--text-muted); font-size: 0.9rem;"><i class="fa-solid fa-search" style="font-size: 2rem; opacity: 0.3; margin-bottom: 12px; display: block;"></i>No staff match your search.</div>`;
        return;
    }

    container.innerHTML = filteredStaff.map(s => {
        const assignedCount = allStudentsList.filter(st => st.mentor_id == s.id).length;
        
        // Smart Color Logic for Badges
        let badgeClass = 'badge-primary';
        if (assignedCount >= 20) badgeClass = 'badge-danger';
        else if (assignedCount >= 15) badgeClass = 'badge-warning';
        else if (assignedCount > 0) badgeClass = 'badge-success';
        else badgeClass = ''; // Default gray if 0
        
        const badgeHtml = badgeClass ? `<span class="badge ${badgeClass}" style="font-size: 0.7rem;">${assignedCount}/20</span>` : `<span class="badge" style="background: #E2E8F0; color: #475569; font-size: 0.7rem;">0/20</span>`;

        return `
        <div class="staff-map-item ${activeMappingStaffId == s.id ? 'active' : ''}" onclick="selectMappingStaff(${s.id})">
            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=random&color=fff&rounded=true" style="width: 42px; height: 42px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="flex: 1;">
                <div style="font-weight: 800; color: var(--text-main); font-size: 0.95rem; margin-bottom: 2px;">${esc(s.name)}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">${esc(s.dept)}</div>
            </div>
            ${badgeHtml}
        </div>`;
    }).join('');
}

function selectMappingStaff(id) {
    activeMappingStaffId = id;
    selectedUnassigned.clear();
    selectedAssigned.clear();
    
    const staff = staffDirectoryList.find(s => s.id == id);
    if(!staff) return;

    document.getElementById('mapping-header-empty').style.display = 'none';
    document.getElementById('mapping-workspace').style.display = 'flex';
    
    document.getElementById('map-active-name').innerText = staff.name;
    document.getElementById('map-active-dept').innerText = staff.dept;
    document.getElementById('map-active-img').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(staff.name)}&background=random&color=fff`;

    renderMappingStaffList(); // Updates active blue highlight on the left
    renderMappingWorkspace();
}

function renderMappingWorkspace() {
    if(!activeMappingStaffId) return;

    const unassignedList = document.getElementById('map-unassigned-list');
    const assignedList = document.getElementById('map-assigned-list');
    const search = document.getElementById('map-student-search').value.toLowerCase();

    let assignedPool = allStudentsList.filter(s => s.mentor_id == activeMappingStaffId);
    let unassignedPool = allStudentsList.filter(s => !s.mentor_id || s.mentor_id == null || s.mentor_id === "");

    // Update Progress Bar & Counters
    const currentCount = assignedPool.length;
    document.getElementById('map-capacity-text').innerText = `${currentCount} / 20`;
    
    const bar = document.getElementById('map-capacity-bar');
    bar.style.width = `${(currentCount / 20) * 100}%`;
    if (currentCount >= 20) { bar.style.background = 'var(--danger)'; document.getElementById('map-capacity-text').style.color = 'var(--danger)'; }
    else if (currentCount >= 15) { bar.style.background = '#F59E0B'; document.getElementById('map-capacity-text').style.color = '#B45309'; }
    else { bar.style.background = 'var(--primary)'; document.getElementById('map-capacity-text').style.color = 'var(--text-main)'; }
    
    document.getElementById('map-unassigned-count').innerText = unassignedPool.length;
    document.getElementById('map-assigned-count').innerText = currentCount;

    // Apply Search Filter to Unassigned ONLY
    unassignedPool = unassignedPool.filter(s => s.full_name.toLowerCase().includes(search) || s.roll_no.toLowerCase().includes(search));

    // Render Unassigned (Left)
    if(unassignedPool.length === 0) {
        unassignedList.innerHTML = `
        <div style="text-align: center; margin-top: 40px; color: var(--text-muted);">
            <i class="fa-solid fa-inbox" style="font-size: 2.5rem; color: #CBD5E1; margin-bottom: 12px;"></i>
            <div style="font-size: 0.9rem; font-weight: 600;">No students available.</div>
        </div>`;
    } else {
        unassignedList.innerHTML = unassignedPool.map(s => `
            <div class="student-map-item ${selectedUnassigned.has(s.email) ? 'selected' : ''}" onclick="toggleMapSelect('${s.email}', 'unassigned')">
                <div class="custom-checkbox"></div>
                <div style="flex: 1;">
                    <div style="font-weight: 800; color: var(--text-main); font-size: 0.9rem;">${esc(s.full_name)}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">${esc(s.roll_no || '--')} • ${esc(s.department)}</div>
                </div>
            </div>
        `).join('');
    }

    // Render Assigned (Right)
    if(assignedPool.length === 0) {
        assignedList.innerHTML = `
        <div style="text-align: center; margin-top: 40px; color: var(--text-muted);">
            <i class="fa-solid fa-user-xmark" style="font-size: 2.5rem; color: #C7D2FE; margin-bottom: 12px;"></i>
            <div style="font-size: 0.9rem; font-weight: 600;">Batch is empty.</div>
            <div style="font-size: 0.8rem; margin-top: 4px;">Select students from the left and click the arrow to assign them.</div>
        </div>`;
    } else {
        assignedList.innerHTML = assignedPool.map(s => `
            <div class="student-map-item ${selectedAssigned.has(s.email) ? 'selected' : ''}" style="border-color: #E2E8F0;" onclick="toggleMapSelect('${s.email}', 'assigned')">
                <div class="custom-checkbox"></div>
                <div style="flex: 1; display: flex; align-items: center; gap: 12px;">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(s.full_name)}&background=random&color=fff&rounded=true" style="width: 32px; height: 32px;">
                    <div>
                        <div style="font-weight: 800; color: var(--text-main); font-size: 0.9rem;">${esc(s.full_name)}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">${esc(s.roll_no || '--')}</div>
                    </div>
                </div>
            </div>
        `).join('');
    }
}

function toggleMapSelect(email, type) {
    if(type === 'unassigned') {
        if(selectedUnassigned.has(email)) selectedUnassigned.delete(email);
        else selectedUnassigned.add(email);
    } else {
        if(selectedAssigned.has(email)) selectedAssigned.delete(email);
        else selectedAssigned.add(email);
    }
    renderMappingWorkspace(); // Re-render to update checkbox visuals
}

function assignSelected() {
    if(!activeMappingStaffId) return;
    if(selectedUnassigned.size === 0) return;

    const currentCount = allStudentsList.filter(s => s.mentor_id == activeMappingStaffId).length;
    if(currentCount + selectedUnassigned.size > 20) {
        alert(`❌ Capacity Exceeded!\n\nA mentor can only handle a maximum of 20 students. You are trying to assign ${selectedUnassigned.size} students to a batch that already has ${currentCount}.`);
        return;
    }

    allStudentsList.forEach(s => {
        if(selectedUnassigned.has(s.email)) s.mentor_id = activeMappingStaffId;
    });
    
    selectedUnassigned.clear();
    renderMappingWorkspace();
    renderMappingStaffList(); // Update capacity badges
}

function unassignSelected() {
    if(selectedAssigned.size === 0) return;

    allStudentsList.forEach(s => {
        if(selectedAssigned.has(s.email)) s.mentor_id = null;
    });
    
    selectedAssigned.clear();
    renderMappingWorkspace();
    renderMappingStaffList();
}

async function saveMentorMappings() {
    const btn = document.querySelector('#view-mapping .btn-success');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;
    
    // Simulate API Call delay
    setTimeout(() => {
        btn.innerHTML = originalHtml;
        alert("✅ Student-Mentor batch assignments saved successfully!");
    }, 800);
}

// ==============================================================================
// --- DIRECTORY & STUDENT PROFILES (CRUD) ---
// ==============================================================================
async function fetchDirectory() {
    const tbody = document.getElementById('directoryBody');
    if(!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading directory...</td></tr>`;
    try {
        const req = await fetch(`${BASE_URL}/api/admin/list`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken }) });
        const data = await req.json();
        if (data.success) {
            // Inject empty mentor_id if missing to support mapping UX
            allStudentsList = data.students.map(s => ({ ...s, mentor_id: s.mentor_id || null }));
            const depts = [...new Set(allStudentsList.map(s => s.department).filter(d => d))];
            const deptSelect = document.getElementById('dirFilter');
            if(deptSelect) deptSelect.innerHTML = '<option value="ALL">All Departments</option>' + depts.map(d => `<option value="${d}">${d}</option>`).join('');
            renderDirectory(allStudentsList);
        }
    } catch(e) { tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger);">Network Error. Backend offline.</td></tr>`; }
}

function renderDirectory(students) {
    const tbody = document.getElementById('directoryBody');
    if(!tbody) return;
    if(students.length === 0) { tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">No students found.</td></tr>`; return; }
    tbody.innerHTML = students.map(s => {
        return `<tr class="dir-row">
            <td style="font-weight:600; color: var(--text-main); cursor: pointer;" onclick="loadStudentData('${esc(s.email)}')"><div style="display: flex; align-items: center; gap: 12px;"><img src="https://ui-avatars.com/api/?name=${encodeURIComponent(s.full_name)}&background=random&color=fff&rounded=true" style="width: 32px; height: 32px;"><div>${s.full_name}</div></div></td>
            <td style="color: var(--text-muted); cursor: pointer;" onclick="loadStudentData('${esc(s.email)}')">${s.email}</td>
            <td style="font-family: monospace; cursor: pointer;" onclick="loadStudentData('${esc(s.email)}')">${s.roll_no || '--'}</td>
            <td><span class="badge badge-primary">${s.department || '--'}</span></td>
            <td style="text-align: right;">
                <button class="action-icon cancel" style="padding: 6px; border: 1px solid var(--danger); border-radius: 6px;" onclick="deleteStudent('${esc(s.email)}', '${esc(s.full_name)}')"><i class="fa-solid fa-trash" style="color: var(--danger);"></i></button>
            </td>
        </tr>`;
    }).join('');
}

function filterDirectory() {
    const search = document.getElementById('dirSearch').value.toLowerCase(); const dept = document.getElementById('dirFilter').value;
    const filtered = allStudentsList.filter(s => { const matchesSearch = ((s.full_name||'').toLowerCase().includes(search)) || ((s.email||'').toLowerCase().includes(search)) || ((s.roll_no||'').toLowerCase().includes(search)); const matchesDept = dept === "ALL" || s.department === dept; return matchesSearch && matchesDept; });
    renderDirectory(filtered);
}

async function submitNewStudent() {
    const email = document.getElementById('new-email').value.trim();
    const name = document.getElementById('new-name').value.trim();
    const roll = document.getElementById('new-roll').value.trim();
    const dept = document.getElementById('new-dept').value.trim();
    if(!email || !name) return alert("Email and Student Name are required.");
    try {
        await fetch(`${BASE_URL}/api/admin/update-field`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, targetEmail: email, field: 'full_name', value: name }) });
        await fetch(`${BASE_URL}/api/admin/update-field`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, targetEmail: email, field: 'roll_no', value: roll }) });
        await fetch(`${BASE_URL}/api/admin/update-field`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, targetEmail: email, field: 'department', value: dept }) });
        closeModal('add-modal');
        document.getElementById('new-email').value = ''; document.getElementById('new-name').value = '';
        fetchDirectory();
    } catch (e) { alert("Network Error: Could not add student."); }
}

async function deleteStudent(email, name) {
    if(!confirm(`⚠️ WARNING: Are you sure you want to completely delete ${name} (${email})?\n\nThis will erase their profile, academic records, and skills.`)) return;
    try {
        const req = await fetch(`${BASE_URL}/api/admin/delete-student`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, targetEmail: email }) });
        const res = await req.json();
        if(res.success) { fetchDirectory(); } else { alert("Failed to delete student."); }
    } catch(e) { alert("Network error while trying to delete."); }
}

function backToDirectory() {
    document.querySelectorAll('.admin-global').forEach(e => e.style.display = 'flex');
    document.querySelectorAll('.student-nav').forEach(e => e.style.display = 'none');
    switchTab('students', document.getElementById('nav-students'));
    targetStudentEmail = ""; currentStudentSkills = []; 
}

async function loadStudentData(email) {
    targetStudentEmail = email;
    document.querySelectorAll('.admin-global').forEach(e => e.style.display = 'none');
    document.querySelectorAll('.student-nav').forEach(e => e.style.display = 'flex');
    switchTab('dashboard', document.getElementById('nav-dash'));
    if(document.getElementById('cardProfileName')) document.getElementById('cardProfileName').innerText = "Loading...";

    try {
        const req = await fetch(`${BASE_URL}/api/admin/student-data`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, targetEmail: email }) });
        const data = await req.json();
        if (data.success) {
            currentStudentSkills = data.skills || []; 
            populateDashboard(data.profile, data.courses, data.skills, data.semGpas);
        } else { alert("Failed to fetch student data."); backToDirectory(); }
    } catch(e) { alert("Network Error"); backToDirectory(); }
}

function renderChart(courses, semGpas) {
    const ctx = document.getElementById('gpaChart');
    if(!ctx) return;
    let labels = []; let dataPoints = []; let gpaMap = {}; 
    if(semGpas) semGpas.forEach(g => gpaMap[g.semester] = g.gpa);

    if (courses && courses.length > 0) {
        let semData = {};
        courses.forEach(c => {
            if (!semData[c.semester]) semData[c.semester] = { total: 0, count: 0 };
            let pts = 0; if((c.grade||'').includes('O')) pts = 10; else if(c.grade === 'A+') pts = 9; else if(c.grade === 'A') pts = 8; else if(c.grade === 'B+') pts = 7; else if(c.grade === 'B') pts = 6; else if(c.grade === 'C') pts = 5;
            semData[c.semester].total += pts; semData[c.semester].count += 1;
        });
        Object.keys(semData).sort((a,b) => a-b).forEach(sem => {
            labels.push(`Sem ${sem}`); 
            if(gpaMap[sem] && gpaMap[sem] !== '--') { dataPoints.push(parseFloat(gpaMap[sem])); } else { dataPoints.push((semData[sem].total / semData[sem].count).toFixed(2)); }
        });
    } else { labels = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6']; dataPoints = [0,0,0,0,0,0]; }

    if (gpaChartInstance) gpaChartInstance.destroy(); 
    let gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300); gradient.addColorStop(0, 'rgba(79, 70, 229, 0.15)'); gradient.addColorStop(1, 'rgba(79, 70, 229, 0)');
    gpaChartInstance = new Chart(ctx, { type: 'line', data: { labels: labels, datasets: [{ label: 'Avg SGPA', data: dataPoints, borderColor: '#4F46E5', backgroundColor: gradient, borderWidth: 3, pointBackgroundColor: '#FFF', pointBorderColor: '#4F46E5', pointBorderWidth: 2, pointRadius: 4, fill: true, tension: 0.3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 10, border: {display: false} }, x: { grid: { display: false }, border: {display: false} } }, interaction: { mode: 'index', intersect: false } } });
}

function processImageUrl(url) {
    if (!url || url.trim() === "") return 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=500&q=80';
    let finalUrl = url.trim();
    const driveMatch = finalUrl.match(/drive\.google\.com\/file\/d\/([^\/]+)/);
    if (driveMatch && driveMatch[1]) { return `https://drive.google.com/uc?id=${driveMatch[1]}`; }
    return finalUrl;
}

function populateDashboard(p, courses, skills, semGpas) {
    if(!p) return;
    if(document.getElementById('cardProfileName')) document.getElementById('cardProfileName').innerText = p.full_name; 
    if(document.getElementById('cardProfileImg')) document.getElementById('cardProfileImg').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(p.full_name)}&background=4F46E5&color=fff&bold=true&rounded=true`;
    if(document.getElementById('val-email')) document.getElementById('val-email').innerText = p.email; 
    if(document.getElementById('val-roll_no')) document.getElementById('val-roll_no').innerText = p.roll_no || '--'; 
    if(document.getElementById('val-department')) document.getElementById('val-department').innerText = p.department || '--';
    if(document.getElementById('val-cgpa')) document.getElementById('val-cgpa').innerText = parseFloat(p.cgpa || 0).toFixed(2); 
    if(document.getElementById('val-sgpa')) document.getElementById('val-sgpa').innerText = parseFloat(p.sgpa || 0).toFixed(2);
    if(document.getElementById('val-attendance')) document.getElementById('val-attendance').innerText = p.attendance || '0'; 
    if(document.getElementById('val-reward_points')) document.getElementById('val-reward_points').innerText = p.reward_points || '0';
    if(document.getElementById('val-arrears')) document.getElementById('val-arrears').innerText = p.arrears || '0'; 
    if(document.getElementById('val-leaves')) document.getElementById('val-leaves').innerText = p.leaves || '0';
    
    renderChart(courses, semGpas);

    const skillsContainer = document.getElementById('skills-container');
    if (skillsContainer) {
        if(skills && skills.length > 0) {
            if(document.getElementById('act-total-skills')) document.getElementById('act-total-skills').innerText = skills.length; 
            if(document.getElementById('act-mastered')) document.getElementById('act-mastered').innerText = skills.filter(s => s.completed_levels >= s.total_levels).length; 
            if(document.getElementById('act-progress')) document.getElementById('act-progress').innerText = skills.filter(s => s.completed_levels < s.total_levels).length;
            skillsContainer.innerHTML = skills.map(c => {
                const total = Number(c.total_levels) || 1; const comp = Number(c.completed_levels) || 0; const pct = Math.round((comp / total) * 100);
                const imgUrl = processImageUrl(c.image_url);
                const fallbackImg = 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=500&q=80'; 
                let segmentsHtml = ''; for(let i=0; i<total; i++) { segmentsHtml += `<div style="flex: 1; border-radius: 4px; background: ${i < comp ? '#8B5CF6' : '#E2E8F0'}; height: 6px;"></div>`; }
                
                return `
                <div class="skill-card">
                    <div style="height: 140px; width: 100%; position: relative; flex-shrink: 0; border-radius: 12px 12px 0 0; overflow: hidden; background: var(--bg-app);">
                        <img src="${imgUrl}" onerror="this.onerror=null; this.src='${fallbackImg}';" style="width: 100%; height: 100%; object-fit: cover;">
                        <div style="position: absolute; top: 12px; right: 12px; background: rgba(255,255,255,0.95); padding: 4px 10px; border-radius: 8px; font-size: 0.7rem; font-weight: 800; color: var(--purple); box-shadow: var(--shadow-sm); backdrop-filter: blur(4px);">
                            <i class="fa-solid fa-medal"></i> ${c.category || 'General'}
                        </div>
                    </div>
                    <div style="padding: 20px; flex: 1; display: flex; flex-direction: column;">
                        <h4 style="margin: 0 0 12px 0; font-size: 1rem; color: var(--text-main); font-weight: 800; line-height: 1.3;">${c.skill_name}</h4>
                        <div style="display: flex; justify-content: space-between; align-items: center; color: var(--text-muted); font-size: 0.8rem; font-weight: 700; margin-bottom: 16px;">
                            <span><i class="fa-solid fa-layer-group" style="opacity: 0.7;"></i> Levels: ${total}</span>
                            <span id="wrap-lvl-${c.id}" style="color: var(--primary);">
                                <span id="val-lvl-${c.id}">${comp}</span> completed 
                                <i class="fa-solid fa-pen admin-table-edit" onclick="openProfileEdit('completed_levels', 'val-lvl-${c.id}', '40px', '${c.id}', '${total}')"></i>
                            </span>
                        </div>
                        <div style="margin-top: auto;">
                            <div style="display: flex; gap: 4px; height: 6px; margin-bottom: 8px;">${segmentsHtml}</div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600;">Overall Progress (${pct}%)</div>
                                <i class="fa-solid fa-trash admin-table-del" title="Remove Course" style="color: var(--danger); font-size: 0.85rem;" onclick="removeAssignedSkill(${c.id}, '${esc(c.skill_name)}')"></i>
                            </div>
                        </div>
                    </div>
                </div>`;
            }).join('');
        } else { 
            if(document.getElementById('act-total-skills')) document.getElementById('act-total-skills').innerText = "0"; 
            if(document.getElementById('act-mastered')) document.getElementById('act-mastered').innerText = "0"; 
            if(document.getElementById('act-progress')) document.getElementById('act-progress').innerText = "0";
            skillsContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color:var(--text-muted); font-weight: 500; border: 1px dashed var(--border); border-radius: 12px;">No PCDP courses assigned for this student yet.</div>`; 
        }
    }

    const acadContainer = document.getElementById('academics-container');
    if (acadContainer) {
        if(courses && courses.length > 0) {
            let sems = {}; courses.forEach(c => { if(!sems[c.semester]) sems[c.semester]=[]; sems[c.semester].push(c); });
            let gpaMap = {}; if (semGpas) semGpas.forEach(g => gpaMap[g.semester] = g.gpa);
            acadContainer.innerHTML = Object.keys(sems).sort((a,b)=>b-a).map(sem => {
                let semGpaVal = gpaMap[sem] || '--';
                return `<div class="sem-card"><div class="sem-header"><div class="flex-between"><div class="sem-title">Semester ${sem}</div><div class="sem-gpa-badge"><span class="lbl">GPA</span><div class="flex-center" id="wrap-gpa-${sem}"><span class="val" id="val-gpa-${sem}">${semGpaVal}</span><i class="fa-solid fa-pen admin-table-edit" style="color:white; background:rgba(255,255,255,0.2);" onclick="openGpaEdit(${sem}, '${semGpaVal}')"></i></div></div></div></div><table class="clean-table"><thead><tr><th style="padding-left:24px;">Subject</th><th>Marks</th><th>Grade</th><th>Actions</th></tr></thead><tbody>${sems[sem].map(c => `<tr id="row-crs-${c.id}"><td style="padding-left:24px; color: var(--text-main); font-weight: 600;">${c.course_name}</td><td style="color: var(--primary); font-weight: 700; font-family: monospace; font-size:0.9rem;">${c.marks || '--'}</td><td><span class="badge ${c.grade && (c.grade.includes('A')||c.grade==='O')?'badge-success':'badge-primary'}">${c.grade || '--'}</span></td><td><div style="display: flex; gap:8px;"><i class="fa-solid fa-trash admin-table-del" onclick="deleteCourse(${c.id})"></i></div></td></tr>`).join('')}</tbody></table></div>`
            }).join('');
        } else { 
            acadContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color:var(--text-muted); font-size:0.85rem; border: 1px dashed var(--border); border-radius: 12px;">No academic records logged yet.</div>`; 
        }
    }
}

// Inline Editing Logic
function openProfileEdit(field, spanId, width, customId, totalLevels) {
    const span = document.getElementById(spanId); originalValues[spanId] = span.innerText.trim();
    span.parentElement.innerHTML = `<div class="flex-center" style="width: 100%;"><input type="text" id="in-${spanId}" class="inline-input" style="width: ${width}; color: var(--text-main);" value="${originalValues[spanId]}"><i class="fa-solid fa-check action-icon save" style="width:28px; height:28px;" onclick="saveProfileEdit('${field}', '${spanId}', '${width}', '${customId || ''}', '${totalLevels || ''}')"></i><i class="fa-solid fa-xmark action-icon cancel" style="width:28px; height:28px;" onclick="cancelProfileEdit('${spanId}', '${field}', '${width}', '${customId || ''}', '${totalLevels || ''}')"></i></div>`;
}

function cancelProfileEdit(spanId, field, width, customId, totalLevels) {
    const wrapper = document.getElementById(`in-${spanId}`).parentElement.parentElement;
    wrapper.innerHTML = `<span id="${spanId}">${originalValues[spanId]}</span><i class="fa-solid fa-pen admin-table-edit" onclick="openProfileEdit('${field}', '${spanId}', '${width}', '${customId}', '${totalLevels}')"></i>`;
}

async function saveProfileEdit(field, spanId, width, customId, totalLevels) {
    const val = document.getElementById(`in-${spanId}`).value; 
    if (field === 'completed_levels' && totalLevels) {
        if (Number(val) > Number(totalLevels)) { alert(`❌ Invalid Input!\n\nYou entered ${val}, but the maximum levels for this course is ${totalLevels}.`); cancelProfileEdit(spanId, field, width, customId, totalLevels); return; }
        if (Number(val) < 0) { alert(`❌ Invalid Input!\n\nLevels cannot be negative.`); cancelProfileEdit(spanId, field, width, customId, totalLevels); return; }
    }
    const wrapper = document.getElementById(`in-${spanId}`).parentElement.parentElement; wrapper.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color: var(--primary);"></i>`;
    try {
        if(field === 'completed_levels') { const req = await fetch(`${BASE_URL}/api/admin/update-skill`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, id: customId, completed_levels: val }) }); const res = await req.json(); if(!res.success) throw new Error(res.message); } 
        else { await fetch(`${BASE_URL}/api/admin/update-field`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, targetEmail: targetStudentEmail, field: field, value: val }) }); }
        loadStudentData(targetStudentEmail);
    } catch(e) { alert(e.message || "Failed to update record."); cancelProfileEdit(spanId, field, width, customId, totalLevels); }
}

async function removeAssignedSkill(id, skillName) {
    if(!confirm(`Are you sure you want to completely remove "${skillName}" from this student's profile?`)) return;
    try { await fetch(`${BASE_URL}/api/admin/remove-skill`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, id: id }) }); loadStudentData(targetStudentEmail); } catch(e) {}
}

function openGpaEdit(sem, currentVal) {
    originalValues[`gpa-${sem}`] = currentVal;
    document.getElementById(`wrap-gpa-${sem}`).innerHTML = `<input type="text" id="in-gpa-${sem}" class="inline-input" style="width: 50px; background:rgba(255,255,255,0.2); color:white; border-color:rgba(255,255,255,0.4);" value="${currentVal}"><i class="fa-solid fa-check action-icon save" style="color:white;" onclick="saveGpaEdit(${sem})"></i>`;
}
async function saveGpaEdit(sem) {
    const val = document.getElementById(`in-gpa-${sem}`).value; document.getElementById(`wrap-gpa-${sem}`).innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color: white;"></i>`;
    try { await fetch(`${BASE_URL}/api/admin/update-gpa`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, targetEmail: targetStudentEmail, semester: sem, gpa: val }) }); loadStudentData(targetStudentEmail); } catch(e) { }
}

async function submitNewCourse() {
    const sem = document.getElementById('crs-sem').value; const name = document.getElementById('crs-name').value; const mark = document.getElementById('crs-mark').value; const grade = document.getElementById('crs-grade').value;
    if(!sem || !name || !mark || !grade) return alert("All fields are required.");
    try { await fetch(`${BASE_URL}/api/admin/add-course`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, targetEmail: targetStudentEmail, semester: sem, course_name: name, marks: mark, grade: grade }) }); closeModal('add-course-modal'); document.getElementById('crs-sem').value=''; document.getElementById('crs-name').value=''; document.getElementById('crs-mark').value=''; document.getElementById('crs-grade').value=''; loadStudentData(targetStudentEmail); } catch(e) {}
}
async function deleteCourse(id) { if(!confirm("Delete subject record?")) return; try { await fetch(`${BASE_URL}/api/admin/delete-course`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, id: id }) }); loadStudentData(targetStudentEmail); } catch(e) {} }

// =========================================================
// 🛑 ANNOUNCEMENTS LOGIC
// =========================================================
async function fetchAdminAnnouncements() {
    const feed = document.getElementById('admin-ann-feed');
    if(!feed) return;
    feed.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>`;
    try {
        const req = await fetch(`${BASE_URL}/api/announcements/list`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken }) });
        const data = await req.json();
        if (data.success) {
            if(data.announcements.length === 0) { feed.innerHTML = `<div class="card" style="text-align:center; padding: 40px; color:var(--text-muted);">No announcements posted yet.</div>`; return; }
            feed.innerHTML = data.announcements.map(ann => {
                let dateStr = new Date(ann.date_posted).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                let targetLabel = ann.target_department || 'ALL'; let deptBadge = targetLabel === 'ALL' ? `<span class="badge" style="background: #E2E8F0; color: #475569; margin-right: 10px;"><i class="fa-solid fa-globe"></i> Global</span>` : `<span class="badge" style="background: var(--purple-light); color: var(--purple); margin-right: 10px;"><i class="fa-solid fa-bullseye"></i> ${targetLabel}</span>`;
                let icon = 'fa-bullhorn'; let color = 'var(--primary)';
                if(ann.type === 'Placement Drive') { icon = 'fa-briefcase'; color = 'var(--success)'; } else if (ann.type === 'Training Event') { icon = 'fa-chalkboard-user'; color = '#CA8A04'; }
                return `<div class="card" style="display: flex; gap: 20px; align-items: flex-start; padding: 24px; position: relative;"><button class="action-icon cancel" style="position: absolute; top: 16px; right: 16px;" onclick="deleteAnnouncement(${ann.id})"><i class="fa-solid fa-trash"></i></button><div style="background: ${color}20; color: ${color}; width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;"><i class="fa-solid ${icon}"></i></div><div style="flex: 1; padding-right: 40px;"><h3 style="margin: 0 0 8px 0; font-size: 1.1rem; color: var(--text-main); font-weight: 800;">${esc(ann.title)}</h3><div style="margin-bottom: 12px;"><span class="badge" style="background:${color}10; color:${color}; border: 1px solid ${color}; margin-right: 10px;">${esc(ann.type)}</span>${deptBadge}<span style="font-size: 0.8rem; color: var(--text-muted);"><i class="fa-regular fa-clock"></i> ${dateStr}</span></div><p style="margin: 0; color: var(--text-muted); line-height: 1.6; font-size: 0.95rem; white-space: pre-wrap;">${esc(ann.content)}</p></div></div>`;
            }).join('');
        }
    } catch(e) { feed.innerHTML = `<div class="card" style="color:var(--danger); text-align:center;">Network Error</div>`; }
}
async function submitAnnouncement() {
    const titleInput = document.getElementById('ann-title'); const contentInput = document.getElementById('ann-content'); const deptInput = document.getElementById('ann-target-dept'); const typeInput = document.getElementById('ann-type');
    if(!titleInput || !contentInput) return;
    const title = titleInput.value.trim(); const content = contentInput.value.trim(); const targetDept = deptInput ? deptInput.value : 'ALL'; const type = typeInput ? typeInput.value : 'College Announcement';
    if(!title || !content) return alert("Please enter both an Announcement Title and Content.");
    try { await fetch(`${BASE_URL}/api/admin/add-announcement`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, title: title, type: type, content: content, target_department: targetDept }) }); } catch(e) {} 
    closeModal('add-ann-modal'); titleInput.value = ''; contentInput.value = ''; if(deptInput) deptInput.value = 'ALL'; fetchAdminAnnouncements(); 
}
async function deleteAnnouncement(id) { if(!confirm("Delete this announcement?")) return; await fetch(`${BASE_URL}/api/admin/delete-announcement`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, id: id }) }); fetchAdminAnnouncements(); }

// =========================================================
// 🛑 PCDP COURSE ASSIGNMENT
// =========================================================
window.masterPcdpCourses = [];
function getAvailableCourses() { const assignedSkillNames = currentStudentSkills.map(s => s.skill_name.toLowerCase()); return window.masterPcdpCourses.filter(c => !assignedSkillNames.includes(c.course_name.toLowerCase())); }
async function loadMasterCoursesForDropdown() { try { const req = await fetch(`${BASE_URL}/api/pcdp/master/courses`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken }) }); const data = await req.json(); if (data.success) { window.masterPcdpCourses = data.courses; renderCourseDropdown(getAvailableCourses()); } } catch(e) { console.error("Failed to load master courses"); } }
function renderCourseDropdown(courses) {
    const listContainer = document.getElementById('pcdp-course-list'); if(!listContainer) return;
    if (!courses || courses.length === 0) { listContainer.innerHTML = `<div style="text-align: center; padding: 30px; background: #F8FAFC; border-radius: 12px; border: 1px dashed #CBD5E1; color: #64748B; font-size: 0.9rem;">No matching courses available to assign.</div>`; return; }
    listContainer.innerHTML = courses.map(c => {
        let iconHtml = '<i class="fa-solid fa-code"></i>'; const cat = (c.category || '').toLowerCase();
        if(cat.includes('design') || cat.includes('ui')) iconHtml = '<i class="fa-solid fa-palette"></i>'; else if(cat.includes('data') || cat.includes('ai') || cat.includes('machine')) iconHtml = '<i class="fa-solid fa-brain"></i>'; else if(cat.includes('cloud') || cat.includes('devops')) iconHtml = '<i class="fa-solid fa-cloud"></i>'; else if(cat.includes('core') || cat.includes('aptitude')) iconHtml = '<i class="fa-solid fa-book-open-reader"></i>';
        return `<div class="course-option-item" onclick="selectCourseOption(this, '${c.id}')"><div style="display: flex; align-items: center; gap: 14px;"><div style="background: #EEF2FF; width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: var(--primary); font-size: 1.1rem;">${iconHtml}</div><div><div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem; margin-bottom: 3px;">${esc(c.course_name)}</div><div style="display: flex; gap: 8px; align-items: center;"><span class="badge" style="background: #F1F5F9; color: #475569; border: none; padding: 2px 6px; font-size: 0.65rem;">${c.total_levels} Levels</span><span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">${esc(c.category || 'General')}</span></div></div></div><i class="fa-solid fa-circle-check check-icon"></i></div>`;
    }).join(''); document.getElementById('selected-pcdp-course-id').value = '';
}
function selectCourseOption(element, courseId) { document.querySelectorAll('.course-option-item').forEach(el => el.classList.remove('selected')); element.classList.add('selected'); document.getElementById('selected-pcdp-course-id').value = courseId; }
function filterCourseDropdown() { const search = document.getElementById('course-search-input').value.toLowerCase(); const availableCourses = getAvailableCourses(); const filtered = availableCourses.filter(c => c.course_name.toLowerCase().includes(search) || (c.category && c.category.toLowerCase().includes(search))); renderCourseDropdown(filtered); }
function openAssignModal() { document.getElementById('course-search-input').value = ''; document.getElementById('assign-course-modal').style.display = 'flex'; if(!window.masterPcdpCourses || window.masterPcdpCourses.length === 0) { loadMasterCoursesForDropdown(); } else { renderCourseDropdown(getAvailableCourses()); } }
async function submitCourseAssignment() {
    const courseId = document.getElementById('selected-pcdp-course-id').value; if(!courseId) return alert("Please click on a course from the list to select it."); if(!targetStudentEmail) return alert("No student selected. Please go back to the directory.");
    const btn = document.getElementById('btn-assign-course'); const originalText = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Assigning...'; btn.disabled = true;
    try {
        const req = await fetch(`${BASE_URL}/api/admin/assign-pcdp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, targetEmail: targetStudentEmail, course_id: courseId }) });
        const res = await req.json(); if (res.success) { document.getElementById('assign-course-modal').style.display = 'none'; if(typeof loadStudentData === 'function') { loadStudentData(targetStudentEmail); } } else { alert("❌ " + res.message); }
    } catch(e) { alert("❌ Network Error. Please check your connection."); } btn.innerHTML = originalText; btn.disabled = false;
}

// =========================================================
// 🛑 STAFF DIRECTORY (Live DB)
// =========================================================
async function fetchStaffDirectory() {
    const tbody = document.querySelector('#view-staff tbody');
    if(!tbody) return;
    try {
        const req = await fetch(`${BASE_URL}/api/admin/staff/list`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken }) });
        const res = await req.json();
        if(res.success) { staffDirectoryList = res.staff; renderStaffDirectory(); }
    } catch(e) { console.error("Error fetching staff."); }
}

function renderStaffDirectory() {
    const tbody = document.querySelector('#view-staff tbody');
    if(!tbody) return;
    if(staffDirectoryList.length === 0) { tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">No staff found.</td></tr>`; return; }
    
    tbody.innerHTML = staffDirectoryList.map(staff => `
        <tr>
            <td style="font-weight:600; color: var(--text-main);">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(staff.name)}&background=random&color=fff&rounded=true" style="width: 32px; height: 32px;">
                    <div>${esc(staff.name)}</div>
                </div>
            </td>
            <td style="color: var(--text-muted);">${esc(staff.email)}</td>
            <td><span class="badge" style="background: #FEF3C7; color: #92400E;">${esc(staff.role)}</span></td>
            <td>${esc(staff.dept)}</td>
            <td>
                <div style="display: flex; gap: 8px;">
                    <i class="fa-solid fa-pen admin-table-edit" onclick="openStaffModal(${staff.id})"></i>
                    <i class="fa-solid fa-trash admin-table-del" style="color: var(--danger);" onclick="deleteStaff(${staff.id})"></i>
                </div>
            </td>
        </tr>
    `).join('');
}

function openStaffModal(id = null) {
    if(id) {
        const staff = staffDirectoryList.find(s => s.id === id);
        if(!staff) return;
        document.getElementById('staff-modal-title').innerText = "Edit Staff Member";
        document.getElementById('staff-id').value = staff.id;
        document.getElementById('staff-name').value = staff.name;
        document.getElementById('staff-email').value = staff.email;
        document.getElementById('staff-role').value = staff.role;
        document.getElementById('staff-dept').value = staff.dept;
    } else {
        document.getElementById('staff-modal-title').innerText = "Add Staff Member";
        document.getElementById('staff-id').value = "";
        document.getElementById('staff-name').value = "";
        document.getElementById('staff-email').value = "";
        document.getElementById('staff-role').value = "";
        document.getElementById('staff-dept').value = "";
    }
    openModal('staff-modal');
}

async function submitStaffForm() {
    const id = document.getElementById('staff-id').value;
    const name = document.getElementById('staff-name').value.trim();
    const email = document.getElementById('staff-email').value.trim();
    const role = document.getElementById('staff-role').value.trim();
    const dept = document.getElementById('staff-dept').value.trim();
    
    if(!name || !email) return alert("Name and Email are required.");
    
    const endpoint = id ? '/api/admin/staff/edit' : '/api/admin/staff/add';
    const payload = { adminToken: globalToken, name, email, role, dept };
    if(id) payload.id = id;

    const btn = document.querySelector('#staff-modal .btn-primary');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

    try {
        const req = await fetch(`${BASE_URL}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const res = await req.json();
        if(res.success) {
            closeModal('staff-modal');
            fetchStaffDirectory();
        } else { alert("Failed to save staff: " + res.message); }
    } catch(e) { alert("Error connecting to server."); }
    btn.innerHTML = originalText;
}

async function deleteStaff(id) {
    if(!confirm("Are you sure you want to remove this staff member?")) return;
    try {
        await fetch(`${BASE_URL}/api/admin/staff/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, id }) });
        fetchStaffDirectory();
    } catch(e) { alert("Error deleting staff."); }
}

// =========================================================
// 🛑 DEPARTMENT MANAGEMENT (Live DB)
// =========================================================
async function fetchDepartments() {
    const grid = document.querySelector('#view-departments > div:nth-of-type(2)');
    if(!grid) return;
    try {
        const req = await fetch(`${BASE_URL}/api/admin/departments/list`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken }) });
        const res = await req.json();
        if(res.success) { departmentsList = res.departments; renderDepartments(); }
    } catch(e) { console.error("Error fetching departments."); }
}

function renderDepartments() {
    const grid = document.querySelector('#view-departments > div:nth-of-type(2)');
    if(!grid) return;
    
    if(departmentsList.length === 0) {
        grid.innerHTML = `<div class="card" style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">No departments configured.</div>`;
        return;
    }

    grid.innerHTML = departmentsList.map(dept => `
        <div class="card" style="padding: 24px; display: flex; flex-direction: column;">
            <div class="flex-between" style="align-items: flex-start; margin-bottom: 16px;">
                <div style="background: ${dept.bg || '#EEF2FF'}; color: ${dept.color || '#4F46E5'}; width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
                    <i class="fa-solid ${dept.icon || 'fa-building'}"></i>
                </div>
                <div style="display: flex; gap: 8px;">
                    <i class="fa-solid fa-pen" style="color: var(--primary); cursor: pointer; padding: 4px;" onclick="openDeptModal(${dept.id})"></i>
                    <i class="fa-solid fa-trash" style="color: var(--danger); cursor: pointer; padding: 4px;" onclick="deleteDepartment(${dept.id})"></i>
                </div>
            </div>
            <h3 style="font-size: 1.2rem; font-weight: 800; color: var(--text-main); margin: 0 0 4px 0;">${esc(dept.name)}</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 20px 0;">Dept. Code: ${esc(dept.code)}</p>
            
            <div style="background: #F8FAFC; border-radius: 8px; padding: 12px; display: flex; justify-content: space-between; border: 1px solid var(--border); margin-top: auto;">
                <div style="text-align: center;">
                    <div style="font-size: 1.2rem; font-weight: 800; color: var(--primary);">${dept.students || 0}</div>
                    <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Students</div>
                </div>
                <div style="width: 1px; background: var(--border);"></div>
                <div style="text-align: center;">
                    <div style="font-size: 1.2rem; font-weight: 800; color: var(--success);">${dept.faculty || 0}</div>
                    <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Faculty</div>
                </div>
            </div>
        </div>
    `).join('');
}

function openDeptModal(id = null) {
    if(id) {
        const dept = departmentsList.find(d => d.id === id);
        if(!dept) return;
        document.getElementById('dept-modal-title').innerText = "Edit Department";
        document.getElementById('dept-id').value = dept.id;
        document.getElementById('dept-name').value = dept.name;
        document.getElementById('dept-code').value = dept.code;
        document.getElementById('dept-students').value = dept.students || 0;
        document.getElementById('dept-faculty').value = dept.faculty || 0;
    } else {
        document.getElementById('dept-modal-title').innerText = "Add Department";
        document.getElementById('dept-id').value = "";
        document.getElementById('dept-name').value = "";
        document.getElementById('dept-code').value = "";
        document.getElementById('dept-students').value = "0";
        document.getElementById('dept-faculty').value = "0";
    }
    openModal('dept-modal');
}

async function submitDepartmentForm() {
    const id = document.getElementById('dept-id').value;
    const name = document.getElementById('dept-name').value.trim();
    const code = document.getElementById('dept-code').value.trim();
    const students = document.getElementById('dept-students').value || 0;
    const faculty = document.getElementById('dept-faculty').value || 0;
    
    if(!name || !code) return alert("Department Name and Code are required.");
    
    const endpoint = id ? '/api/admin/departments/edit' : '/api/admin/departments/add';
    const payload = { adminToken: globalToken, name, code, students, faculty, icon: 'fa-building', color: '#4F46E5', bg: '#EEF2FF' };
    if(id) payload.id = id;

    const btn = document.querySelector('#dept-modal .btn-primary');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

    try {
        const req = await fetch(`${BASE_URL}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const res = await req.json();
        if(res.success) {
            closeModal('dept-modal');
            fetchDepartments();
        } else { alert("Failed to save department: " + res.message); }
    } catch(e) { alert("Error connecting to server."); }
    btn.innerHTML = originalText;
}

async function deleteDepartment(id) {
    if(!confirm("Are you sure you want to delete this department block?")) return;
    try {
        await fetch(`${BASE_URL}/api/admin/departments/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, id }) });
        fetchDepartments();
    } catch(e) { alert("Error deleting department."); }
}