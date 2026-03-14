let globalToken = localStorage.getItem('bit_session_token');
let isAdminMode = true; 
let targetStudentEmail = ""; 
let originalValues = {}; 
let gpaChartInstance = null; 
let allStudentsList = []; 
let currentStudentSkills = []; 

let loggedInName = ""; 
let loggedInEmail = ""; 
let loggedInPic = ""; 

const BASE_URL = 'https://portal-6crm.onrender.com';

if (!globalToken) window.location.href = 'index.html';

function getAvatar(name) { return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4F46E5&color=fff&bold=true&rounded=true`; }
function setTopHeader(name, email, pic) { document.getElementById('headerName').innerText = name; document.getElementById('headerEmail').innerText = email; document.getElementById('headerImage').src = pic || getAvatar(name); }
function toggleSidebar() { const sidebar = document.getElementById('sidebar'); const overlay = document.getElementById('sidebar-overlay'); sidebar.classList.toggle('open'); if (sidebar.classList.contains('open')) overlay.classList.add('show'); else overlay.classList.remove('show'); }

function updateSidebarNav() {
    const adminGlobals = document.querySelectorAll('.admin-global'); 
    const studentNavs = document.querySelectorAll('.student-nav'); 
    const backBtn = document.getElementById('nav-back');
    if (targetStudentEmail === "") {
        adminGlobals.forEach(el => el.style.display = 'flex'); 
        studentNavs.forEach(el => el.style.display = 'none'); 
        backBtn.style.display = 'none';
    } else {
        adminGlobals.forEach(el => el.style.display = 'none'); 
        studentNavs.forEach(el => el.style.display = 'flex'); 
        backBtn.style.display = 'flex';
    }
}

function switchTab(tabId, element) {
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active')); 
    if(element) element.classList.add('active');
    document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active')); 
    document.getElementById('view-' + tabId).classList.add('active');
    if(window.innerWidth <= 768) { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebar-overlay').classList.remove('show'); }
}

function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

window.onload = async () => {
    try {
        const req = await fetch(`${BASE_URL}/api/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: globalToken }) });
        const data = await req.json();
        
        if (!data.success || !data.isAdmin) { localStorage.removeItem('bit_session_token'); window.location.href = 'index.html'; return; }
        
        loggedInName = data.profile.full_name; loggedInEmail = data.profile.email; loggedInPic = data.profile.picture || getAvatar(loggedInName);
        setTopHeader(loggedInName, loggedInEmail, loggedInPic); 
        updateSidebarNav(); fetchDirectory();
    } catch (e) { console.error("Initialization Error:", e); window.location.href = 'index.html'; }
};

async function fetchDirectory() {
    try {
        const req = await fetch(`${BASE_URL}/api/admin/list`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken }) });
        const data = await req.json();
        if (data.success) {
            allStudentsList = data.students;
            const deptSelect = document.getElementById('dirFilter');
            const depts = [...new Set(allStudentsList.map(s => s.department).filter(d => d))];
            deptSelect.innerHTML = '<option value="ALL">All Departments</option>';
            depts.forEach(d => { deptSelect.innerHTML += `<option value="${d}">${d}</option>`; });
            renderDirectoryTable(allStudentsList);
            switchTab('directory', document.getElementById('nav-dir'));
        } else { signOut(); }
    } catch(e) { document.getElementById('directoryBody').innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--danger);">Server Error.</td></tr>`; }
}

function renderDirectoryTable(students) {
    const tbody = document.getElementById('directoryBody');
    if(students.length === 0) { tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">No students found.</td></tr>`; return; }
    tbody.innerHTML = students.map(s => `
        <tr class="dir-row" onclick="loadStudentData('${s.email}')">
            <td style="font-weight:600; color: var(--text-main); padding-left: 24px;">${s.full_name}</td>
            <td style="color:var(--text-muted);">${s.email}</td>
            <td style="font-family: monospace; font-size: 0.95rem;">${s.roll_no || '--'}</td>
            <td><span class="badge badge-primary">${s.department || '--'}</span></td>
            <td style="text-align: right; color: #CBD5E1; padding-right: 24px; white-space: nowrap;"><i class="fa-solid fa-trash admin-table-del" title="Delete Student" onclick="event.stopPropagation(); deleteStudent('${s.email}')" style="margin-right: 16px; font-size: 1rem;"></i><i class="fa-solid fa-chevron-right"></i></td>
        </tr>
    `).join('');
}

function filterDirectory() {
    const searchTerm = document.getElementById('dirSearch').value.toLowerCase(); const selectedDept = document.getElementById('dirFilter').value;
    const filtered = allStudentsList.filter(s => {
        const matchesSearch = (s.full_name && s.full_name.toLowerCase().includes(searchTerm)) || (s.email && s.email.toLowerCase().includes(searchTerm)) || (s.roll_no && s.roll_no.toLowerCase().includes(searchTerm));
        const matchesDept = selectedDept === "ALL" || s.department === selectedDept;
        return matchesSearch && matchesDept;
    });
    renderDirectoryTable(filtered);
}

async function loadStudentData(email) {
    targetStudentEmail = email;
    const req = await fetch(`${BASE_URL}/api/admin/student-data`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, targetEmail: email }) });
    const data = await req.json();
    
    if (data.success) { 
        currentStudentSkills = data.skills || [];
        populateDashboard(data.profile, getAvatar(data.profile.full_name), data.courses, data.skills, data.semGpas); 
        updateSidebarNav();
        let activeTab = document.querySelector('.nav-item.active');
        if(!activeTab || activeTab.id === 'nav-dir') switchTab('dashboard', document.getElementById('nav-dash'));
    }
}

function backToDirectory() { targetStudentEmail = ""; updateSidebarNav(); fetchDirectory(); }
function signOut() { localStorage.removeItem('bit_session_token'); location.href = 'index.html'; }

function quickAddCourse(semNumber) { document.getElementById('crs-sem').value = semNumber; document.getElementById('crs-name').value = ''; document.getElementById('crs-mark').value = ''; document.getElementById('crs-grade').value = ''; openModal('add-course-modal'); }

function renderChart(courses, semGpas) {
    const ctx = document.getElementById('gpaChart').getContext('2d');
    let labels = []; let dataPoints = []; let gpaMap = {}; 
    if(semGpas) semGpas.forEach(g => gpaMap[g.semester] = g.gpa);
    if (courses && courses.length > 0) {
        let semData = {};
        courses.forEach(c => {
            if (!semData[c.semester]) semData[c.semester] = { total: 0, count: 0 };
            let pts = 0; if(c.grade.includes('O')) pts = 10; else if(c.grade === 'A+') pts = 9; else if(c.grade === 'A') pts = 8; else if(c.grade === 'B+') pts = 7; else if(c.grade === 'B') pts = 6; else if(c.grade === 'C') pts = 5;
            semData[c.semester].total += pts; semData[c.semester].count += 1;
        });
        Object.keys(semData).sort((a,b) => a-b).forEach(sem => { labels.push(`Sem ${sem}`); if(gpaMap[sem] && gpaMap[sem] !== '--') dataPoints.push(parseFloat(gpaMap[sem])); else dataPoints.push((semData[sem].total / semData[sem].count).toFixed(2)); });
    } else { labels = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6']; dataPoints = [0,0,0,0,0,0]; }

    if (gpaChartInstance) gpaChartInstance.destroy(); 
    let gradient = ctx.createLinearGradient(0, 0, 0, 300); gradient.addColorStop(0, 'rgba(79, 70, 229, 0.15)'); gradient.addColorStop(1, 'rgba(79, 70, 229, 0)');
    gpaChartInstance = new Chart(ctx, { type: 'line', data: { labels: labels, datasets: [{ label: 'Avg SGPA', data: dataPoints, borderColor: '#4F46E5', backgroundColor: gradient, borderWidth: 3, pointBackgroundColor: '#FFF', pointBorderColor: '#4F46E5', pointBorderWidth: 2, pointRadius: 4, fill: true, tension: 0.3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 10, border: {display: false} }, x: { grid: { display: false }, border: {display: false} } }, interaction: { mode: 'index', intersect: false } } });
}

function populateDashboard(p, img, courses, skills, semGpas) {
    document.getElementById('cardProfileName').innerText = p.full_name; document.getElementById('cardProfileImg').src = img || getAvatar(p.full_name);
    document.getElementById('val-email').innerText = p.email; document.getElementById('val-roll_no').innerText = p.roll_no || '--'; document.getElementById('val-department').innerText = p.department || '--';
    document.getElementById('val-cgpa').innerText = parseFloat(p.cgpa || 0).toFixed(2); document.getElementById('val-sgpa').innerText = parseFloat(p.sgpa || 0).toFixed(2);
    document.getElementById('val-attendance').innerText = p.attendance; document.getElementById('val-reward_points').innerText = p.reward_points;
    document.getElementById('val-arrears').innerText = p.arrears; document.getElementById('val-leaves').innerText = p.leaves;
    renderChart(courses, semGpas);

    const skillsContainer = document.getElementById('skills-container');
    if(skills && skills.length > 0) {
        document.getElementById('act-total-skills').innerText = skills.length; document.getElementById('act-mastered').innerText = skills.filter(s => s.completed_levels >= s.total_levels).length; document.getElementById('act-progress').innerText = skills.filter(s => s.completed_levels < s.total_levels).length;
        skillsContainer.innerHTML = skills.map(c => {
            const total = c.total_levels || 1; const comp = c.completed_levels || 0; const pct = Math.round((comp / total) * 100);
            const fallbackImg = 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=500&q=80'; const imgUrl = (c.image_url && c.image_url.trim() !== "") ? c.image_url : fallbackImg;
            let segmentsHtml = ''; for(let i=0; i<total; i++) { segmentsHtml += `<div style="flex: 1; border-radius: 4px; background: ${i < comp ? '#8B5CF6' : '#E2E8F0'}; height: 6px;"></div>`; }
            return `
            <div id="card-sk-${c.id}" style="background: white; border-radius: 8px; border: 1px solid #E2E8F0; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <img src="${imgUrl}" onerror="this.onerror=null; this.src='${fallbackImg}';" style="width: 100%; height: 140px; object-fit: cover;">
                <div style="padding: 16px; flex: 1; display: flex; flex-direction: column;">
                    <h4 style="margin: 0 0 12px 0; font-size: 0.95rem; color: #1e293b; font-weight: 700; line-height: 1.3;">${c.skill_name}</h4>
                    <div style="display: flex; justify-content: space-between; align-items: center; color: #64748b; font-size: 0.75rem; font-weight: 600; margin-bottom: 12px;"><span><i class="fa-solid fa-layer-group" style="opacity: 0.7;"></i> Levels: <span id="sk-t-${c.id}">${total}</span></span><span><i class="fa-solid fa-medal" style="opacity: 0.7;"></i> ${c.category || 'General'}</span></div>
                    <div style="margin-top: auto;"><div style="display: flex; gap: 4px; height: 6px; margin-bottom: 8px;">${segmentsHtml}</div><div style="text-align: center; font-size: 0.7rem; color: #64748b;">Progress: <span id="sk-c-${c.id}">${comp}</span>/${total} levels (${pct}%)</div></div>
                </div>
                <div style="display: flex; border-top: 1px solid #E2E8F0; background: #F8FAFC;"><button onclick="editSkillCard(${c.id})" style="flex: 1; padding: 10px; border: none; background: none; color: #4F46E5; font-size: 0.8rem; font-weight: 700; cursor: pointer; border-right: 1px solid #E2E8F0; transition: background 0.2s;" onmouseover="this.style.background='#EEF2FF'" onmouseout="this.style.background='none'"><i class="fa-solid fa-pen"></i> Update Progress</button><button onclick="deleteSkill(${c.id})" style="padding: 10px 16px; border: none; background: none; color: #EF4444; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#FEF2F2'" onmouseout="this.style.background='none'"><i class="fa-solid fa-trash"></i></button></div>
            </div>`;
        }).join('');
    } else { 
        document.getElementById('act-total-skills').innerText = "0"; document.getElementById('act-mastered').innerText = "0"; document.getElementById('act-progress').innerText = "0";
        skillsContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 60px; color:var(--text-muted); font-weight: 500; border: 1px dashed var(--border); border-radius: 12px;">No PCDP courses assigned for this student yet.</div>`; 
    }

    if(courses && courses.length > 0) {
        let sems = {}; courses.forEach(c => { if(!sems[c.semester]) sems[c.semester]=[]; sems[c.semester].push(c); });
        let gpaMap = {}; if (semGpas) semGpas.forEach(g => gpaMap[g.semester] = g.gpa);
        document.getElementById('academics-container').innerHTML = Object.keys(sems).sort((a,b)=>b-a).map(sem => {
            let semGpaVal = gpaMap[sem] || '--';
            return `<div class="sem-card"><div class="sem-header"><div class="flex-center"><div class="sem-title">Semester ${sem}</div><div class="sem-gpa-badge"><span class="lbl">GPA</span><div id="wrap-semgpa-${sem}" class="flex-center"><span id="val-semgpa-${sem}" class="val">${semGpaVal}</span><i class="fa-solid fa-pen admin-table-edit" style="padding: 2px;" onclick="openSemGpaEdit(${sem})"></i></div></div></div><button class="action-btn btn-outline" style="padding: 4px 10px; font-size:0.75rem;" onclick="quickAddCourse(${sem})"><i class="fa-solid fa-plus"></i> Add Subject</button></div><table class="clean-table"><thead><tr><th style="padding-left:24px;">Subject</th><th>Marks</th><th>Grade</th><th></th></tr></thead><tbody>${sems[sem].map(c => `<tr id="row-crs-${c.id}"><td style="padding-left:24px; color: var(--text-main); font-weight: 600;">${c.course_name}</td><td style="color: var(--primary); font-weight: 700; font-family: monospace; font-size:0.9rem;">${c.marks || '--'}</td><td><span class="badge ${c.grade && (c.grade.includes('A')||c.grade==='O')?'badge-success':'badge-primary'}">${c.grade || '--'}</span></td><td style="text-align:right; padding-right:24px; white-space:nowrap;"><i class="fa-solid fa-pen admin-table-edit" onclick="editCourseRow(${c.id})"></i><i class="fa-solid fa-trash admin-table-del" onclick="deleteCourse(${c.id})"></i></td></tr>`).join('')}</tbody></table></div>`
        }).join('');
    } else { document.getElementById('academics-container').innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color:var(--text-muted); font-size:0.85rem; border: 1px dashed var(--border); border-radius: 12px;">No academic records found.</div>`; }
}

async function openAssignSkillModal() {
    openModal('add-skill-modal'); const sel = document.getElementById('sk-master-select'); sel.innerHTML = '<option value="">Fetching global courses...</option>';
    try {
        const req = await fetch(`${BASE_URL}/api/admin/pcdp-master-list`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken }) }); const data = await req.json();
        if(data.success) {
            const assignedNames = currentStudentSkills.map(s => s.skill_name.toLowerCase()); const availableCourses = data.courses.filter(c => !assignedNames.includes(c.course_name.toLowerCase()));
            if(data.courses.length === 0) { sel.innerHTML = '<option value="" disabled selected>No Master Courses created yet!</option>'; } else if (availableCourses.length === 0) { sel.innerHTML = '<option value="" disabled selected>Student already has all available courses!</option>'; } else { sel.innerHTML = '<option value="" disabled selected>-- Select a Course to Assign --</option>'; availableCourses.forEach(c => { sel.innerHTML += `<option value="${c.id}">${c.course_name} (${c.category}) - ${c.total_levels} Lvl</option>`; }); }
        }
    } catch(e) { sel.innerHTML = '<option value="">Error fetching courses</option>'; }
}

async function submitNewSkill() {
    const masterId = document.getElementById('sk-master-select').value; if(!masterId) return alert("Please select a course to assign.");
    await fetch(`${BASE_URL}/api/admin/assign-pcdp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, targetEmail: targetStudentEmail, masterCourseId: masterId }) });
    closeModal('add-skill-modal'); loadStudentData(targetStudentEmail); 
}

function editSkillCard(id) {
    const card = document.getElementById(`card-sk-${id}`); const comp = document.getElementById(`sk-c-${id}`).innerText; const total = document.getElementById(`sk-t-${id}`).innerText;
    card.innerHTML = `<div style="padding: 30px 20px; flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; background: white; height: 100%; border-radius: 8px;"><div style="margin-bottom:8px; font-weight:800; font-size:1.1rem; color:#1e293b; text-align:center;"><i class="fa-solid fa-sliders" style="color: #4F46E5; margin-right: 6px;"></i> Set Progress</div><p style="font-size: 0.8rem; color: #64748b; text-align: center; margin-bottom: 24px; line-height: 1.5;">Adjust completed levels for this student.</p><div style="display: flex; align-items: center; justify-content: center; margin-bottom: 24px; background: #F8FAFC; border: 1px solid #E2E8F0; padding: 12px; border-radius: 8px; width: 100%;"><input type="number" id="edit-sk-c-${id}" style="width: 70px; text-align:center; font-size:1.4rem; padding: 8px; font-weight: 800; color: #4F46E5; background: white; border: 1px solid #E2E8F0; border-radius: 6px; outline: none;" value="${comp}" max="${total}" min="0"><span style="font-size:1.4rem; font-weight:800; color:#64748b; margin-left:12px;">/ ${total}</span></div><div style="display:flex; justify-content: center; gap: 12px; width: 100%;"><button style="flex: 1; padding: 10px; border-radius: 8px; background: #10B981; color: white; border: none; font-weight: 600; cursor: pointer;" onclick="saveSkillCard(${id}, ${total})"><i class="fa-solid fa-check"></i> Save</button><button style="flex: 1; padding: 10px; border-radius: 8px; background: white; color: #64748b; border: 1px solid #E2E8F0; font-weight: 600; cursor: pointer;" onclick="loadStudentData(targetStudentEmail)"><i class="fa-solid fa-xmark"></i> Cancel</button></div></div>`;
}

async function saveSkillCard(id, totalLevels) {
    let comp = parseInt(document.getElementById(`edit-sk-c-${id}`).value); if(isNaN(comp) || comp < 0) comp = 0; if(comp > totalLevels) { alert(`Cannot exceed total levels (${totalLevels})!`); return; }
    document.getElementById(`card-sk-${id}`).innerHTML = `<div style="text-align:center; padding: 60px;"><i class="fa-solid fa-spinner fa-spin fa-2x" style="color: #4F46E5;"></i></div>`;
    await fetch(`${BASE_URL}/api/admin/update-skill`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, id: id, field: 'completed_levels', value: comp }) });
    loadStudentData(targetStudentEmail);
}

// STANDARD CRUD
async function submitNewStudent() { const email = document.getElementById('new-email').value; const full_name = document.getElementById('new-name').value; const roll_no = document.getElementById('new-roll').value; const department = document.getElementById('new-dept').value; if(!email || !full_name) return alert("Email and Name are required."); await fetch(`${BASE_URL}/api/admin/add-student`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, email: email, full_name: full_name, roll_no: roll_no, department: department }) }); closeModal('add-modal'); fetchDirectory(); }
async function deleteStudent(email) { if(!confirm("Delete this student and ALL records permanently?")) return; await fetch(`${BASE_URL}/api/admin/delete-student`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, email: email }) }); fetchDirectory(); }
async function submitNewCourse() { await fetch(`${BASE_URL}/api/admin/add-course`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, targetEmail: targetStudentEmail, semester: document.getElementById('crs-sem').value, course_name: document.getElementById('crs-name').value, marks: document.getElementById('crs-mark').value, grade: document.getElementById('crs-grade').value }) }); closeModal('add-course-modal'); loadStudentData(targetStudentEmail); }
async function deleteSkill(id) { if(!confirm("Remove this assigned course?")) return; await fetch(`${BASE_URL}/api/admin/delete-skill`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, id: id }) }); loadStudentData(targetStudentEmail); }
async function deleteCourse(id) { if(!confirm("Delete this subject?")) return; await fetch(`${BASE_URL}/api/admin/delete-course`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, id: id }) }); loadStudentData(targetStudentEmail); }

// Inline editing helpers
function openProfileEdit(field, spanId, width) { const span = document.getElementById(spanId); originalValues[spanId] = span.innerText.trim(); span.parentElement.innerHTML = `<div class="flex-center" style="width: 100%;"><input type="text" id="in-${spanId}" class="inline-input" style="width: ${width};" value="${originalValues[spanId]}"><i class="fa-solid fa-check action-icon save" onclick="saveProfileEdit('${field}', '${spanId}', '${width}')"></i><i class="fa-solid fa-xmark action-icon cancel" onclick="cancelProfileEdit('${spanId}', '${field}', '${width}')"></i></div>`; }
function cancelProfileEdit(spanId, field, width) { const wrapper = document.getElementById(`in-${spanId}`).parentElement.parentElement; wrapper.innerHTML = `<span id="${spanId}" style="${field==='email'?'word-break:break-all;':''}">${originalValues[spanId]}</span><i class="fa-solid fa-pen admin-table-edit" onclick="openProfileEdit('${field}', '${spanId}', '${width}')"></i>`; }
async function saveProfileEdit(field, spanId, width) { const val = document.getElementById(`in-${spanId}`).value; const wrapper = document.getElementById(`in-${spanId}`).parentElement.parentElement; wrapper.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color: var(--primary);"></i>`; try { const req = await fetch(`${BASE_URL}/api/admin/update-field`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, targetEmail: targetStudentEmail, field: field, value: val }) }); const res = await req.json(); if (res.success) { if (field === 'email') targetStudentEmail = val; wrapper.innerHTML = `<span id="${spanId}" style="${field==='email'?'word-break:break-all;':''}">${val}</span><i class="fa-solid fa-pen admin-table-edit" onclick="openProfileEdit('${field}', '${spanId}', '${width}')"></i>`; loadStudentData(targetStudentEmail); } else { cancelProfileEdit(spanId, field, width); } } catch(e) { cancelProfileEdit(spanId, field, width); } }
function openSemGpaEdit(sem) { const span = document.getElementById(`val-semgpa-${sem}`); const val = span.innerText === '--' ? '' : span.innerText; originalValues[`semgpa-${sem}`] = val; span.parentElement.innerHTML = `<input type="text" id="in-semgpa-${sem}" class="inline-input" style="width: 60px; padding: 4px; font-size: 0.8rem;" value="${val}"><i class="fa-solid fa-check action-icon save" style="width:24px; height:24px; font-size:0.75rem;" onclick="saveSemGpa(${sem})"></i><i class="fa-solid fa-xmark action-icon cancel" style="width:24px; height:24px; font-size:0.75rem;" onclick="cancelSemGpaEdit(${sem})"></i>`; }
function cancelSemGpaEdit(sem) { const wrapper = document.getElementById(`in-semgpa-${sem}`).parentElement; wrapper.innerHTML = `<span id="val-semgpa-${sem}" class="val">${originalValues[`semgpa-${sem}`] || '--'}</span><i class="fa-solid fa-pen admin-table-edit" style="padding: 2px;" onclick="openSemGpaEdit(${sem})"></i>`; }
async function saveSemGpa(sem) { const val = document.getElementById(`in-semgpa-${sem}`).value; const wrapper = document.getElementById(`in-semgpa-${sem}`).parentElement; wrapper.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color:var(--primary); font-size:0.8rem;"></i>`; try { await fetch(`${BASE_URL}/api/admin/update-sem-gpa`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ adminToken: globalToken, targetEmail: targetStudentEmail, semester: sem, gpa: val }) }); wrapper.innerHTML = `<span id="val-semgpa-${sem}" class="val">${val}</span><i class="fa-solid fa-pen admin-table-edit" style="padding: 2px;" onclick="openSemGpaEdit(${sem})"></i>`; loadStudentData(targetStudentEmail); } catch(e) { cancelSemGpaEdit(sem); } }
function editCourseRow(id) { const tr = document.getElementById(`row-crs-${id}`); const name = tr.children[0].innerText; const marks = tr.children[1].innerText; const grade = tr.children[2].innerText; tr.innerHTML = `<td style="padding-left:24px;"><input type="text" id="edit-crs-n-${id}" class="inline-input" style="width: 100%; text-align:left;" value="${name}"></td><td><input type="number" id="edit-crs-m-${id}" class="inline-input" style="width: 70px;" value="${marks}"></td><td><input type="text" id="edit-crs-g-${id}" class="inline-input" style="width: 60px;" value="${grade}"></td><td style="text-align:right; padding-right:24px; white-space: nowrap;"><i class="fa-solid fa-check action-icon save" onclick="saveCourseRow(${id})"></i><i class="fa-solid fa-xmark action-icon cancel" onclick="loadStudentData(targetStudentEmail)"></i></td>`; }
async function saveCourseRow(id) { const tr = document.getElementById(`row-crs-${id}`); tr.lastElementChild.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color: var(--primary);"></i>`; const updates = [{ field: 'course_name', value: document.getElementById(`edit-crs-n-${id}`).value }, { field: 'marks', value: document.getElementById(`edit-crs-m-${id}`).value }, { field: 'grade', value: document.getElementById(`edit-crs-g-${id}`).value }]; await Promise.all(updates.map(u => fetch(`${BASE_URL}/api/admin/update-course`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, id: id, field: u.field, value: u.value }) }))); loadStudentData(targetStudentEmail); }

// --- ANNOUNCEMENTS LOGIC (ADMIN) ---
async function fetchAdminAnnouncements() {
    const feed = document.getElementById('admin-ann-feed');
    feed.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>`;
    try {
        const req = await fetch(`${BASE_URL}/api/announcements/list`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: globalToken }) }); const data = await req.json();
        if (data.success) {
            const adminAnns = data.announcements.filter(a => a.type === 'College Announcement');
            if(adminAnns.length === 0) { feed.innerHTML = `<div class="card" style="text-align:center; padding: 40px; color:var(--text-muted);">No college announcements posted yet.</div>`; return; }
            feed.innerHTML = adminAnns.map(ann => {
                let dateStr = new Date(ann.date_posted).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                let targetLabel = ann.target_department || 'ALL'; let deptBadge = targetLabel === 'ALL' ? `<span class="badge" style="background: #E2E8F0; color: #475569; margin-right: 10px;"><i class="fa-solid fa-globe"></i> Global (All Depts)</span>` : `<span class="badge" style="background: var(--purple-light); color: var(--purple); margin-right: 10px;"><i class="fa-solid fa-users-viewfinder"></i> ${targetLabel}</span>`;
                return `<div class="card" style="display: flex; gap: 20px; align-items: flex-start; padding: 24px; position: relative;"><button class="action-icon cancel" style="position: absolute; top: 16px; right: 16px;" onclick="deleteAnnouncement(${ann.id})"><i class="fa-solid fa-trash"></i></button><div style="background: var(--primary-light); color: var(--primary); width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;"><i class="fa-solid fa-building-columns"></i></div><div style="flex: 1; padding-right: 40px;"><h3 style="margin: 0 0 8px 0; font-size: 1.1rem; color: var(--text-main); font-weight: 800;">${ann.title}</h3><div style="margin-bottom: 12px;"><span class="badge" style="background: var(--primary-light); color: var(--primary); border: 1px solid var(--primary); margin-right: 10px;">${ann.type}</span>${deptBadge}<span style="font-size: 0.8rem; color: var(--text-muted);"><i class="fa-regular fa-clock"></i> ${dateStr}</span></div><p style="margin: 0; color: var(--text-muted); line-height: 1.6; font-size: 0.95rem; white-space: pre-wrap;">${ann.content}</p></div></div>`;
            }).join('');
        }
    } catch(e) { feed.innerHTML = `<div class="card" style="color:var(--danger); text-align:center;">Network Error</div>`; }
}
async function submitAnnouncement() {
    const titleInput = document.getElementById('ann-title'); const contentInput = document.getElementById('ann-content'); const typeInput = document.getElementById('ann-type'); const deptInput = document.getElementById('ann-target-dept');
    if(!titleInput || !contentInput) return;
    const title = titleInput.value.trim(); const content = contentInput.value.trim(); const type = typeInput ? typeInput.value : 'College Announcement'; const targetDept = deptInput ? deptInput.value : 'ALL';
    if(!title || !content) return alert("Please enter both an Announcement Title and Content.");
    const btn = document.querySelector('#add-ann-modal .btn-primary'); const originalBtnText = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Posting...';
    try { await fetch(`${BASE_URL}/api/admin/add-announcement`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, title: title, type: type, content: content, target_department: targetDept }) }); } catch(e) { alert("Network error while posting."); } finally { closeModal('add-ann-modal'); titleInput.value = ''; contentInput.value = ''; if(deptInput) deptInput.value = 'ALL'; btn.innerHTML = originalBtnText; fetchAdminAnnouncements(); }
}
async function deleteAnnouncement(id) { if(!confirm("Delete this announcement?")) return; await fetch(`${BASE_URL}/api/admin/delete-announcement`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, id: id }) }); fetchAdminAnnouncements(); }