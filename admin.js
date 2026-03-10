let globalToken = localStorage.getItem('bit_session_token');
let isAdminMode = true; 
let targetStudentEmail = ""; 
let originalValues = {}; 
let gpaChartInstance = null; 
let allStudentsList = []; 

let loggedInName = ""; 
let loggedInEmail = ""; 
let loggedInPic = ""; 
let currentGlobalStats = null; 
let currentGlobalDrives = [];

// SMART URL: Auto-detects local vs live
const BASE_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') 
    ? 'http://localhost:10000' 
    : 'https://portal-6crm.onrender.com';

if (!globalToken) window.location.href = 'index.html';

function getAvatar(name) { 
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4F46E5&color=fff&bold=true&rounded=true`; 
}

function setTopHeader(name, email, pic) { 
    document.getElementById('headerName').innerText = name; 
    document.getElementById('headerEmail').innerText = email; 
    document.getElementById('headerImage').src = pic || getAvatar(name); 
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar'); 
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('open');
    if (sidebar.classList.contains('open')) {
        overlay.classList.add('show'); 
    } else {
        overlay.classList.remove('show');
    }
}

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
    
    if(window.innerWidth <= 768) { 
        document.getElementById('sidebar').classList.remove('open'); 
        document.getElementById('sidebar-overlay').classList.remove('show'); 
    }
}

function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

window.onload = async () => {
    try {
        const req = await fetch(`${BASE_URL}/api/auth`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ token: globalToken }) 
        });
        const data = await req.json();
        
        if (!data.success || !data.isAdmin) { 
            localStorage.removeItem('bit_session_token'); 
            window.location.href = 'index.html'; 
            return; 
        }
        
        loggedInName = data.profile.full_name; 
        loggedInEmail = data.profile.email; 
        loggedInPic = data.profile.picture || getAvatar(loggedInName);
        currentGlobalStats = data.globalStats; 
        currentGlobalDrives = data.globalDrives;
        
        setTopHeader(loggedInName, loggedInEmail, loggedInPic); 
        populateGlobalPlacement(currentGlobalStats, currentGlobalDrives);
        
        updateSidebarNav(); 
        fetchDirectory();
    } catch (e) { 
        window.location.href = 'index.html'; 
    }
};

async function fetchDirectory() {
    try {
        const req = await fetch(`${BASE_URL}/api/admin/list`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ adminToken: globalToken }) 
        });
        const data = await req.json();
        
        if (data.success) {
            allStudentsList = data.students;
            const deptSelect = document.getElementById('dirFilter');
            const depts = [...new Set(allStudentsList.map(s => s.department).filter(d => d))];
            deptSelect.innerHTML = '<option value="ALL">All Departments</option>';
            depts.forEach(d => { deptSelect.innerHTML += `<option value="${d}">${d}</option>`; });
            
            renderDirectoryTable(allStudentsList);
            switchTab('directory', document.getElementById('nav-dir'));
        } else {
            signOut();
        }
    } catch(e) {
        document.getElementById('directoryBody').innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--danger);">Server is waking up. Please refresh.</td></tr>`;
    }
}

function renderDirectoryTable(students) {
    const tbody = document.getElementById('directoryBody');
    if(students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">No students found.</td></tr>`;
        return;
    }
    
    tbody.innerHTML = students.map(s => `
        <tr class="dir-row" onclick="loadStudentData('${s.email}')">
            <td style="font-weight:600; color: var(--text-main); padding-left: 24px;">${s.full_name}</td>
            <td style="color:var(--text-muted);">${s.email}</td>
            <td style="font-family: monospace; font-size: 0.95rem;">${s.roll_no || '--'}</td>
            <td><span class="badge badge-primary">${s.department || '--'}</span></td>
            <td style="text-align: right; color: #CBD5E1; padding-right: 24px; white-space: nowrap;">
                <i class="fa-solid fa-trash admin-table-del" title="Delete Student" onclick="event.stopPropagation(); deleteStudent('${s.email}')" style="margin-right: 16px; font-size: 1rem;"></i>
                <i class="fa-solid fa-chevron-right"></i>
            </td>
        </tr>
    `).join('');
}

function filterDirectory() {
    const searchTerm = document.getElementById('dirSearch').value.toLowerCase();
    const selectedDept = document.getElementById('dirFilter').value;
    
    const filtered = allStudentsList.filter(s => {
        const matchesSearch = (s.full_name && s.full_name.toLowerCase().includes(searchTerm)) || 
                              (s.email && s.email.toLowerCase().includes(searchTerm)) || 
                              (s.roll_no && s.roll_no.toLowerCase().includes(searchTerm));
        const matchesDept = selectedDept === "ALL" || s.department === selectedDept;
        return matchesSearch && matchesDept;
    });
    
    renderDirectoryTable(filtered);
}

async function loadStudentData(email) {
    targetStudentEmail = email;
    const req = await fetch(`${BASE_URL}/api/admin/student-data`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ adminToken: globalToken, targetEmail: email }) 
    });
    const data = await req.json();
    
    if (data.success) { 
        populateDashboard(data.profile, getAvatar(data.profile.full_name), data.courses, data.skills, data.semGpas); 
        populatePersonalPlacement(data.placeProfile, data.placeApps);
        
        updateSidebarNav();
        let activeTab = document.querySelector('.nav-item.active');
        if(!activeTab || activeTab.id === 'nav-dir' || activeTab.id === 'nav-col-place') {
            switchTab('dashboard', document.getElementById('nav-dash'));
        }
    }
}

function backToDirectory() { targetStudentEmail = ""; updateSidebarNav(); fetchDirectory(); }
function signOut() { localStorage.removeItem('bit_session_token'); location.href = 'index.html'; }

function quickAddCourse(semNumber) { 
    document.getElementById('crs-sem').value = semNumber; 
    document.getElementById('crs-name').value = ''; 
    document.getElementById('crs-mark').value = ''; 
    document.getElementById('crs-grade').value = ''; 
    openModal('add-course-modal'); 
}

function renderChart(courses, semGpas) {
    const ctx = document.getElementById('gpaChart').getContext('2d');
    let labels = []; let dataPoints = [];
    let gpaMap = {}; 
    
    if(semGpas) semGpas.forEach(g => gpaMap[g.semester] = g.gpa);

    if (courses && courses.length > 0) {
        let semData = {};
        courses.forEach(c => {
            if (!semData[c.semester]) semData[c.semester] = { total: 0, count: 0 };
            let pts = 0;
            if(c.grade.includes('O')) pts = 10; 
            else if(c.grade === 'A+') pts = 9; 
            else if(c.grade === 'A') pts = 8; 
            else if(c.grade === 'B+') pts = 7; 
            else if(c.grade === 'B') pts = 6; 
            else if(c.grade === 'C') pts = 5;
            
            semData[c.semester].total += pts; 
            semData[c.semester].count += 1;
        });
        Object.keys(semData).sort((a,b) => a-b).forEach(sem => {
            labels.push(`Sem ${sem}`); 
            if(gpaMap[sem] && gpaMap[sem] !== '--') {
                dataPoints.push(parseFloat(gpaMap[sem]));
            } else {
                dataPoints.push((semData[sem].total / semData[sem].count).toFixed(2));
            }
        });
    } else { 
        labels = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6']; 
        dataPoints = [0,0,0,0,0,0]; 
    }

    if (gpaChartInstance) gpaChartInstance.destroy(); 
    let gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(79, 70, 229, 0.15)'); 
    gradient.addColorStop(1, 'rgba(79, 70, 229, 0)');
    
    gpaChartInstance = new Chart(ctx, { 
        type: 'line', 
        data: { 
            labels: labels, 
            datasets: [{ 
                label: 'Avg SGPA', data: dataPoints, borderColor: '#4F46E5', backgroundColor: gradient, 
                borderWidth: 3, pointBackgroundColor: '#FFF', pointBorderColor: '#4F46E5', 
                pointBorderWidth: 2, pointRadius: 4, fill: true, tension: 0.3 
            }] 
        }, 
        options: { 
            responsive: true, maintainAspectRatio: false, 
            plugins: { legend: { display: false } }, 
            scales: { y: { min: 0, max: 10, border: {display: false} }, x: { grid: { display: false }, border: {display: false} } }, 
            interaction: { mode: 'index', intersect: false } 
        } 
    });
}

function populateDashboard(p, img, courses, skills, semGpas) {
    document.getElementById('cardProfileName').innerText = p.full_name; 
    document.getElementById('cardProfileImg').src = img || getAvatar(p.full_name);
    document.getElementById('val-email').innerText = p.email; 
    document.getElementById('val-roll_no').innerText = p.roll_no || '--'; 
    document.getElementById('val-department').innerText = p.department || '--';
    document.getElementById('val-cgpa').innerText = parseFloat(p.cgpa || 0).toFixed(2); 
    document.getElementById('val-sgpa').innerText = parseFloat(p.sgpa || 0).toFixed(2);
    document.getElementById('val-attendance').innerText = p.attendance; 
    document.getElementById('val-reward_points').innerText = p.reward_points;
    document.getElementById('val-arrears').innerText = p.arrears; 
    document.getElementById('val-leaves').innerText = p.leaves;
    
    renderChart(courses, semGpas);

    // 🛠️ RENDER SKILLS: Notice only "Completed" can be modified
    const skillsContainer = document.getElementById('admin-skills-container');
    if(skills && skills.length > 0) {
        document.getElementById('act-total-skills').innerText = skills.length; 
        document.getElementById('act-mastered').innerText = skills.filter(s => s.completed_levels >= s.total_levels).length; 
        document.getElementById('act-progress').innerText = skills.filter(s => s.completed_levels < s.total_levels).length;

        skillsContainer.innerHTML = skills.map(c => {
            const total = c.total_levels || 1;
            const comp = c.completed_levels || 0;
            const pct = Math.round((comp / total) * 100);
            const imgUrl = c.image_url || 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=500&q=80';

            let segmentsHtml = '';
            for(let i=0; i<total; i++) { segmentsHtml += `<div class="segment ${i < comp ? 'filled' : ''}"></div>`; }

            return `
            <div class="img-card" id="card-sk-${c.id}">
                <div class="card-img-wrapper"><img src="${imgUrl}"></div>
                <div class="card-body">
                    <div class="card-title" style="color: var(--primary);">${c.skill_name}</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 16px; line-height: 1.5; flex: 1;">
                        ${c.description || 'Assigned PCDP Course'}
                    </div>
                    <div class="card-meta">
                        <div style="color: #9CA3AF;"><i class="fa-solid fa-layer-group"></i> Total Levels: <span id="sk-t-${c.id}">${total}</span></div>
                        <div style="color: #4B5563;"><i class="fa-solid fa-medal"></i> ${c.category || 'General'}</div>
                    </div>
                    <div class="segmented-track">${segmentsHtml}</div>
                    <div class="progress-text">Progress: <span id="sk-c-${c.id}">${comp}</span>/${total} levels (${pct}%)</div>
                </div>
                
                <div class="admin-level-update">
                    <button class="action-btn btn-outline" style="font-size: 0.7rem; padding: 4px 8px;" onclick="editSkillCard(${c.id})"><i class="fa-solid fa-pen"></i> Update Progress</button>
                    <i class="fa-solid fa-trash delete-btn" title="Remove Course" onclick="deleteSkill(${c.id})"></i>
                </div>
            </div>`;
        }).join('');
    } else { 
        document.getElementById('act-total-skills').innerText = "0"; 
        document.getElementById('act-mastered').innerText = "0"; 
        document.getElementById('act-progress').innerText = "0";
        skillsContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 60px; color:var(--text-muted); font-weight: 500; border: 1px dashed var(--border); border-radius: 12px;">No PCDP courses assigned for this student yet.</div>`; 
    }

    if(courses && courses.length > 0) {
        let sems = {}; 
        courses.forEach(c => { if(!sems[c.semester]) sems[c.semester]=[]; sems[c.semester].push(c); });
        let gpaMap = {}; 
        if (semGpas) semGpas.forEach(g => gpaMap[g.semester] = g.gpa);
        
        document.getElementById('academics-container').innerHTML = Object.keys(sems).sort((a,b)=>b-a).map(sem => {
            let semGpaVal = gpaMap[sem] || '--';
            return `
            <div class="sem-card">
                <div class="sem-header">
                    <div class="flex-center">
                        <div class="sem-title">Semester ${sem}</div>
                        <div class="sem-gpa-badge">
                            <span class="lbl">GPA</span>
                            <div id="wrap-semgpa-${sem}" class="flex-center">
                                <span id="val-semgpa-${sem}" class="val">${semGpaVal}</span>
                                <i class="fa-solid fa-pen admin-table-edit" style="padding: 2px;" onclick="openSemGpaEdit(${sem})"></i>
                            </div>
                        </div>
                    </div>
                    <button class="action-btn btn-outline" style="padding: 4px 10px; font-size:0.75rem;" onclick="quickAddCourse(${sem})"><i class="fa-solid fa-plus"></i> Add Subject</button>
                </div>
                <table class="clean-table">
                    <thead><tr><th style="padding-left:24px;">Subject</th><th>Marks</th><th>Grade</th><th></th></tr></thead>
                    <tbody>
                        ${sems[sem].map(c => `
                        <tr id="row-crs-${c.id}">
                            <td style="padding-left:24px; color: var(--text-main); font-weight: 600;">${c.course_name}</td>
                            <td style="color: var(--primary); font-weight: 700; font-family: monospace; font-size:0.9rem;">${c.marks || '--'}</td>
                            <td><span class="badge ${c.grade && (c.grade.includes('A')||c.grade==='O')?'badge-success':'badge-primary'}">${c.grade || '--'}</span></td>
                            <td style="text-align:right; padding-right:24px; white-space:nowrap;">
                                <i class="fa-solid fa-pen admin-table-edit" onclick="editCourseRow(${c.id})"></i>
                                <i class="fa-solid fa-trash admin-table-del" onclick="deleteCourse(${c.id})"></i>
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`
        }).join('');
    } else { 
        document.getElementById('academics-container').innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color:var(--text-muted); font-size:0.85rem; border: 1px dashed var(--border); border-radius: 12px;">No academic records found.</div>`; 
    }
}

function populateGlobalPlacement(gStats, gDrives) {
    gStats = gStats || {};
    document.getElementById('val-g-total').innerText = gStats.total_placed || '0';
    document.getElementById('val-g-ongoing').innerText = gStats.ongoing_drives || '0';
    document.getElementById('val-g-highest').innerText = gStats.highest_ctc || '0';
    document.getElementById('val-g-avg').innerText = gStats.avg_ctc || '0';
    
    const drvBody = document.getElementById('global-drives-tbody');
    if (gDrives && gDrives.length > 0) {
        drvBody.innerHTML = gDrives.map(d => `
        <tr id="row-drv-${d.id}">
            <td style="font-weight: 700; color: var(--text-main);">${d.company}</td>
            <td>${d.role}</td>
            <td style="font-family: monospace;">${d.appeared}</td>
            <td><span class="badge badge-success">${d.selected}</span></td>
            <td style="font-weight: 700; color: var(--primary);">${d.ctc}</td>
            <td style="text-align:right; padding-right: 24px; white-space:nowrap;">
                <i class="fa-solid fa-pen admin-table-edit" onclick="editDriveRow(${d.id})"></i>
                <i class="fa-solid fa-trash admin-table-del" onclick="deleteDrive(${d.id})"></i>
            </td>
        </tr>`).join('');
    } else { 
        drvBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 30px; color:var(--text-muted);">No campus drives recorded.</td></tr>`; 
    }
}

function populatePersonalPlacement(pProfile, pApps) {
    pProfile = pProfile || {};
    const prf = pProfile;
    document.getElementById('val-p-role').innerText = prf.offer_role || '--'; 
    document.getElementById('val-p-comp').innerText = prf.offer_company || '--';
    document.getElementById('val-p-ctc').innerText = prf.offer_ctc || '--'; 
    document.getElementById('val-p-status').innerText = prf.status || 'Unplaced';
    document.getElementById('val-p-assess').innerText = prf.assessments || '0'; 
    document.getElementById('val-p-int').innerText = prf.interviews || '0'; 
    document.getElementById('val-p-off').innerText = prf.offers || '0';
    
    const dsa = prf.tech_dsa || '0'; document.getElementById('val-t-dsa').innerText = dsa; document.getElementById('bar-t-dsa').style.width = `${dsa}%`;
    const oop = prf.tech_oop || '0'; document.getElementById('val-t-oop').innerText = oop; document.getElementById('bar-t-oop').style.width = `${oop}%`;
    const core = prf.tech_core || '0'; document.getElementById('val-t-core').innerText = core; document.getElementById('bar-t-core').style.width = `${core}%`;
    const quant = prf.apt_quant || '0'; document.getElementById('val-a-quant').innerText = quant; document.getElementById('bar-a-quant').style.width = `${quant}%`;
    const logical = prf.apt_logical || '0'; document.getElementById('val-a-log').innerText = logical; document.getElementById('bar-a-log').style.width = `${logical}%`;
    const hr = prf.apt_hr || '0'; document.getElementById('val-a-hr').innerText = hr; document.getElementById('bar-a-hr').style.width = `${hr}%`;

    const resumeDisp = document.getElementById('admin-resume-display');
    const resumeBtn = document.getElementById('admin-view-resume-btn');
    if (resumeDisp && resumeBtn) {
        if (prf.resume_url && prf.resume_url !== '--') {
            resumeDisp.value = prf.resume_url;
            resumeBtn.href = prf.resume_url;
            resumeBtn.style.display = 'inline-flex';
        } else {
            resumeDisp.value = '';
            resumeBtn.style.display = 'none';
        }
    }

    const appBody = document.getElementById('student-apps-tbody');
    if (pApps && pApps.length > 0) {
        appBody.innerHTML = pApps.map(a => {
            let bClass = 'badge-primary';
            if(a.status.toLowerCase().includes('select') || a.status.toLowerCase().includes('offer')) bClass = 'badge-success';
            if(a.status.toLowerCase().includes('clear') || a.status.toLowerCase().includes('reject')) bClass = 'badge-danger';
            if(a.status.toLowerCase().includes('pend') || a.status.toLowerCase().includes('wait')) bClass = 'badge-warning';
            return `
            <tr id="row-app-${a.id}">
                <td style="font-weight: 700; color: var(--text-main);">${a.company}</td>
                <td style="color: var(--text-muted);">${a.role}</td>
                <td>${a.date_applied}</td>
                <td><span class="badge ${bClass}">${a.status}</span></td>
                <td style="text-align:right; padding-right: 24px; white-space:nowrap;">
                    <i class="fa-solid fa-pen admin-table-edit" onclick="editAppRow(${a.id})"></i>
                    <i class="fa-solid fa-trash admin-table-del" onclick="deleteApp(${a.id})"></i>
                </td>
            </tr>`;
        }).join('');
    } else { 
        appBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 30px; color:var(--text-muted);">No applications logged.</td></tr>`; 
    }
}

// --- 🛠️ NEW: ASSIGN COURSE FROM MASTER LIST ---
async function openAssignSkillModal() {
    openModal('add-skill-modal');
    const sel = document.getElementById('sk-master-select');
    sel.innerHTML = '<option value="">Fetching global courses...</option>';
    try {
        const req = await fetch(`${BASE_URL}/api/admin/pcdp-master-list`, { 
            method: 'POST', headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ adminToken: globalToken }) 
        });
        const data = await req.json();
        
        if(data.success) {
            if(data.courses.length === 0) {
                sel.innerHTML = '<option value="" disabled selected>No Master Courses created yet!</option>';
            } else {
                sel.innerHTML = '<option value="" disabled selected>-- Select a Course to Assign --</option>';
                data.courses.forEach(c => {
                    sel.innerHTML += `<option value="${c.id}">${c.course_name} (${c.category}) - ${c.total_levels} Lvl</option>`;
                });
            }
        }
    } catch(e) { sel.innerHTML = '<option value="">Error fetching courses</option>'; }
}

async function submitNewSkill() {
    const masterId = document.getElementById('sk-master-select').value;
    if(!masterId) return alert("Please select a course to assign.");
    
    await fetch(`${BASE_URL}/api/admin/assign-pcdp`, { 
        method: 'POST', headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ adminToken: globalToken, targetEmail: targetStudentEmail, masterCourseId: masterId }) 
    });
    closeModal('add-skill-modal'); 
    loadStudentData(targetStudentEmail); 
}

// 🛠️ NEW: EDIT ONLY COMPLETED LEVELS ON ASSIGNED CARD
function editSkillCard(id) {
    const card = document.getElementById(`card-sk-${id}`);
    const comp = document.getElementById(`sk-c-${id}`).innerText;
    const total = document.getElementById(`sk-t-${id}`).innerText;
    
    card.innerHTML = `
        <div style="padding: 16px; flex: 1; display: flex; flex-direction: column; justify-content: center;">
            <div style="margin-bottom:16px; font-weight:800; font-size:1.1rem; color:var(--text-main); text-align:center;">Update Progress</div>
            <div class="flex-center" style="margin-bottom: 20px; justify-content: center;">
                <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Completed:</span>
                <input type="number" id="edit-sk-c-${id}" class="inline-input" style="width: 80px; text-align:center; font-size:1.2rem; padding: 12px;" value="${comp}" max="${total}" min="0">
                <span style="font-size:1rem; font-weight:800; color:var(--text-muted); margin-left:8px;">/ ${total}</span>
            </div>
            <div style="display:flex; justify-content: center; gap: 10px;">
                <button class="action-btn btn-success" style="width: 100px;" onclick="saveSkillCard(${id}, ${total})">Save</button>
                <button class="action-btn btn-outline" style="width: 100px;" onclick="loadStudentData(targetStudentEmail)">Cancel</button>
            </div>
        </div>`;
}

async function saveSkillCard(id, totalLevels) {
    let comp = parseInt(document.getElementById(`edit-sk-c-${id}`).value);
    if(isNaN(comp) || comp < 0) comp = 0;
    if(comp > totalLevels) { alert(`Cannot exceed total levels (${totalLevels})!`); return; }
    
    const card = document.getElementById(`card-sk-${id}`); 
    card.innerHTML = `<div style="text-align:center; padding: 60px;"><i class="fa-solid fa-spinner fa-spin" style="color: var(--primary); font-size: 2rem;"></i></div>`;
    
    await fetch(`${BASE_URL}/api/admin/update-skill-level`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminToken: globalToken, courseId: id, newLevel: comp })
    });
    loadStudentData(targetStudentEmail);
}

// --- STANDARD CRUD ---
async function submitNewStudent() {
    const email = document.getElementById('new-email').value;
    const full_name = document.getElementById('new-name').value;
    const roll_no = document.getElementById('new-roll').value;
    const department = document.getElementById('new-dept').value;
    
    if(!email || !full_name) return alert("Email and Name are required.");
    
    await fetch(`${BASE_URL}/api/admin/add-student`, { 
        method: 'POST', headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ adminToken: globalToken, email: email, full_name: full_name, roll_no: roll_no, department: department }) 
    });
    closeModal('add-modal'); 
    fetchDirectory();
}

async function deleteStudent(email) {
    if(!confirm("Delete this student and ALL records permanently?")) return;
    await fetch(`${BASE_URL}/api/admin/delete-student`, { 
        method: 'POST', headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ adminToken: globalToken, email: email }) 
    });
    fetchDirectory(); 
}

async function submitNewCourse() {
    const semester = document.getElementById('crs-sem').value;
    const course_name = document.getElementById('crs-name').value;
    const marks = document.getElementById('crs-mark').value;
    const grade = document.getElementById('crs-grade').value;
    
    await fetch(`${BASE_URL}/api/admin/add-course`, { 
        method: 'POST', headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ adminToken: globalToken, targetEmail: targetStudentEmail, semester: semester, course_name: course_name, marks: marks, grade: grade }) 
    });
    closeModal('add-course-modal'); 
    loadStudentData(targetStudentEmail); 
}

async function deleteSkill(id) { 
    if(!confirm("Remove this assigned course?")) return; 
    await fetch(`${BASE_URL}/api/admin/delete-skill`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, id: id }) }); 
    loadStudentData(targetStudentEmail); 
}

async function deleteCourse(id) { 
    if(!confirm("Delete this subject?")) return; 
    await fetch(`${BASE_URL}/api/admin/delete-course`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, id: id }) }); 
    loadStudentData(targetStudentEmail); 
}

async function submitNewDrive() {
    const company = document.getElementById('drv-comp').value;
    const role = document.getElementById('drv-role').value;
    const appeared = document.getElementById('drv-app').value;
    const selected = document.getElementById('drv-sel').value;
    const ctc = document.getElementById('drv-ctc').value;
    
    await fetch(`${BASE_URL}/api/admin/add-drive`, { 
        method: 'POST', headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ adminToken: globalToken, company: company, role: role, appeared: appeared, selected: selected, ctc: ctc }) 
    });
    closeModal('add-drive-modal'); 
    window.location.reload(); 
}

async function submitNewApp() {
    const company = document.getElementById('app-comp').value;
    const role = document.getElementById('app-role').value;
    const date_applied = document.getElementById('app-date').value;
    const status = document.getElementById('app-stat').value;
    
    await fetch(`${BASE_URL}/api/admin/add-app`, { 
        method: 'POST', headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ adminToken: globalToken, targetEmail: targetStudentEmail, company: company, role: role, date_applied: date_applied, status: status }) 
    });
    closeModal('add-app-modal'); 
    loadStudentData(targetStudentEmail); 
}

async function deleteDrive(id) { 
    if(!confirm("Delete this drive?")) return; 
    await fetch(`${BASE_URL}/api/admin/delete-drive`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, id: id }) }); 
    window.location.reload(); 
}

async function deleteApp(id) { 
    if(!confirm("Delete application?")) return; 
    await fetch(`${BASE_URL}/api/admin/delete-app`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, id: id }) }); 
    loadStudentData(targetStudentEmail); 
}

// --- INLINE EDITING ---
function openProfileEdit(field, spanId, width) {
    const span = document.getElementById(spanId); 
    originalValues[spanId] = span.innerText.trim();
    span.parentElement.innerHTML = `
        <div class="flex-center" style="width: 100%;">
            <input type="text" id="in-${spanId}" class="inline-input" style="width: ${width};" value="${originalValues[spanId]}">
            <i class="fa-solid fa-check action-icon save" onclick="saveProfileEdit('${field}', '${spanId}', '${width}')"></i>
            <i class="fa-solid fa-xmark action-icon cancel" onclick="cancelProfileEdit('${spanId}', '${field}', '${width}')"></i>
        </div>`;
}

function cancelProfileEdit(spanId, field, width) { 
    document.getElementById(`in-${spanId}`).parentElement.parentElement.innerHTML = `
        <span id="${spanId}" style="${field==='email'?'word-break:break-all;':''}">${originalValues[spanId]}</span>
        <i class="fa-solid fa-pen admin-table-edit" onclick="openProfileEdit('${field}', '${spanId}', '${width}')"></i>`; 
}

async function saveProfileEdit(field, spanId, width) {
    const val = document.getElementById(`in-${spanId}`).value; 
    document.getElementById(`in-${spanId}`).parentElement.parentElement.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color: var(--primary);"></i>`;
    
    const req = await fetch(`${BASE_URL}/api/admin/update-field`, { 
        method: 'POST', headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ adminToken: globalToken, targetEmail: targetStudentEmail, field: field, value: val }) 
    });
    const res = await req.json(); 
    if (res.success) { 
        if (field === 'email') targetStudentEmail = val; 
        loadStudentData(targetStudentEmail); 
    } else { cancelProfileEdit(spanId, field, width); }
}

function openSemGpaEdit(sem) {
    const span = document.getElementById(`val-semgpa-${sem}`); 
    const val = span.innerText === '--' ? '' : span.innerText;
    span.parentElement.innerHTML = `
        <input type="text" id="in-semgpa-${sem}" class="inline-input" style="width: 60px; padding: 4px; font-size: 0.8rem;" value="${val}">
        <i class="fa-solid fa-check action-icon save" style="width:24px; height:24px; font-size:0.75rem;" onclick="saveSemGpa(${sem})"></i>
        <i class="fa-solid fa-xmark action-icon cancel" style="width:24px; height:24px; font-size:0.75rem;" onclick="loadStudentData(targetStudentEmail)"></i>`;
}

async function saveSemGpa(sem) {
    const val = document.getElementById(`in-semgpa-${sem}`).value; 
    document.getElementById(`wrap-semgpa-${sem}`).innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color:var(--primary); font-size:0.8rem;"></i>`;
    await fetch(`${BASE_URL}/api/admin/update-sem-gpa`, { 
        method: 'POST', headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify({ adminToken: globalToken, targetEmail: targetStudentEmail, semester: sem, gpa: val }) 
    });
    loadStudentData(targetStudentEmail);
}

function openGlobalStatEdit(field, spanId, width) {
    const span = document.getElementById(spanId); 
    originalValues[spanId] = span.innerText.trim();
    span.parentElement.innerHTML = `
        <div class="flex-center">
            <input type="text" id="in-${spanId}" class="inline-input" style="width: ${width}; padding: 4px;" value="${originalValues[spanId]}">
            <i class="fa-solid fa-check action-icon save" style="width:28px; height:28px;" onclick="saveGlobalStat('${field}', '${spanId}', '${width}')"></i>
            <i class="fa-solid fa-xmark action-icon cancel" style="width:28px; height:28px;" onclick="window.location.reload()"></i>
        </div>`;
}

async function saveGlobalStat(field, spanId, width) {
    const val = document.getElementById(`in-${spanId}`).value; 
    document.getElementById(`in-${spanId}`).parentElement.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color: var(--primary);"></i>`;
    await fetch(`${BASE_URL}/api/admin/update-global-stat`, { 
        method: 'POST', headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ adminToken: globalToken, field: field, value: val }) 
    });
    window.location.reload();
}

function openPlacementProfileEdit(field, spanId, width) {
    const span = document.getElementById(spanId); 
    originalValues[spanId] = span.innerText.trim();
    span.parentElement.innerHTML = `
        <div class="flex-center" style="width: 100%;">
            <input type="text" id="in-${spanId}" class="inline-input" style="width: ${width}; color: var(--text-main);" value="${originalValues[spanId]}">
            <i class="fa-solid fa-check action-icon save" style="width:28px; height:28px;" onclick="savePlacementProfileEdit('${field}', '${spanId}', '${width}')"></i>
            <i class="fa-solid fa-xmark action-icon cancel" style="width:28px; height:28px;" onclick="loadStudentData(targetStudentEmail)"></i>
        </div>`;
}

async function savePlacementProfileEdit(field, spanId, width) {
    const val = document.getElementById(`in-${spanId}`).value; 
    document.getElementById(`in-${spanId}`).parentElement.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color: var(--primary);"></i>`;
    await fetch(`${BASE_URL}/api/admin/update-placement-profile`, { 
        method: 'POST', headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ adminToken: globalToken, targetEmail: targetStudentEmail, field: field, value: val }) 
    });
    loadStudentData(targetStudentEmail);
}

function editDriveRow(id) {
    const tr = document.getElementById(`row-drv-${id}`);
    const comp = tr.children[0].innerText; const role = tr.children[1].innerText; const app = tr.children[2].innerText; const sel = tr.children[3].innerText; const ctc = tr.children[4].innerText;
    tr.innerHTML = `
        <td><input type="text" id="e-drv-c-${id}" class="inline-input" style="width: 100%;" value="${comp}"></td>
        <td><input type="text" id="e-drv-r-${id}" class="inline-input" style="width: 100%;" value="${role}"></td>
        <td><input type="number" id="e-drv-a-${id}" class="inline-input" style="width: 60px;" value="${app}"></td>
        <td><input type="number" id="e-drv-s-${id}" class="inline-input" style="width: 60px;" value="${sel}"></td>
        <td><input type="text" id="e-drv-ctc-${id}" class="inline-input" style="width: 80px;" value="${ctc}"></td>
        <td style="text-align:right; white-space: nowrap;">
            <i class="fa-solid fa-check action-icon save" onclick="saveDriveRow(${id})"></i>
            <i class="fa-solid fa-xmark action-icon cancel" onclick="window.location.reload()"></i>
        </td>`;
}

async function saveDriveRow(id) {
    const tr = document.getElementById(`row-drv-${id}`); tr.lastElementChild.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color: var(--primary);"></i>`;
    const updates = [{ field: 'company', value: document.getElementById(`e-drv-c-${id}`).value }, { field: 'role', value: document.getElementById(`e-drv-r-${id}`).value }, { field: 'appeared', value: document.getElementById(`e-drv-a-${id}`).value }, { field: 'selected', value: document.getElementById(`e-drv-s-${id}`).value }, { field: 'ctc', value: document.getElementById(`e-drv-ctc-${id}`).value }];
    await Promise.all(updates.map(u => fetch(`${BASE_URL}/api/admin/update-drive`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, id: id, field: u.field, value: u.value }) })));
    window.location.reload();
}

function editAppRow(id) {
    const tr = document.getElementById(`row-app-${id}`);
    const comp = tr.children[0].innerText; const role = tr.children[1].innerText; const date = tr.children[2].innerText; const stat = tr.children[3].innerText;
    tr.innerHTML = `
        <td><input type="text" id="e-app-c-${id}" class="inline-input" style="width: 100%;" value="${comp}"></td>
        <td><input type="text" id="e-app-r-${id}" class="inline-input" style="width: 100%;" value="${role}"></td>
        <td><input type="text" id="e-app-d-${id}" class="inline-input" style="width: 100px;" value="${date}"></td>
        <td><input type="text" id="e-app-s-${id}" class="inline-input" style="width: 120px;" value="${stat}"></td>
        <td style="text-align:right; white-space: nowrap;">
            <i class="fa-solid fa-check action-icon save" onclick="saveAppRow(${id})"></i>
            <i class="fa-solid fa-xmark action-icon cancel" onclick="loadStudentData(targetStudentEmail)"></i>
        </td>`;
}

async function saveAppRow(id) {
    const tr = document.getElementById(`row-app-${id}`); tr.lastElementChild.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color: var(--primary);"></i>`;
    const updates = [{ field: 'company', value: document.getElementById(`e-app-c-${id}`).value }, { field: 'role', value: document.getElementById(`e-app-r-${id}`).value }, { field: 'date_applied', value: document.getElementById(`e-app-d-${id}`).value }, { field: 'status', value: document.getElementById(`e-app-s-${id}`).value }];
    await Promise.all(updates.map(u => fetch(`${BASE_URL}/api/admin/update-app`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, id: id, field: u.field, value: u.value }) })));
    loadStudentData(targetStudentEmail);
}

function editCourseRow(id) {
    const tr = document.getElementById(`row-crs-${id}`);
    const name = tr.children[0].innerText; const marks = tr.children[1].innerText; const grade = tr.children[2].innerText;
    tr.innerHTML = `
        <td style="padding-left:24px;"><input type="text" id="edit-crs-n-${id}" class="inline-input" style="width: 100%; text-align:left;" value="${name}"></td>
        <td><input type="number" id="edit-crs-m-${id}" class="inline-input" style="width: 70px;" value="${marks}"></td>
        <td><input type="text" id="edit-crs-g-${id}" class="inline-input" style="width: 60px;" value="${grade}"></td>
        <td style="text-align:right; padding-right:24px; white-space: nowrap;">
            <i class="fa-solid fa-check action-icon save" onclick="saveCourseRow(${id})"></i>
            <i class="fa-solid fa-xmark action-icon cancel" onclick="loadStudentData(targetStudentEmail)"></i>
        </td>`;
}

async function saveCourseRow(id) {
    const tr = document.getElementById(`row-crs-${id}`); tr.lastElementChild.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color: var(--primary);"></i>`;
    const updates = [{ field: 'course_name', value: document.getElementById(`edit-crs-n-${id}`).value }, { field: 'marks', value: document.getElementById(`edit-crs-m-${id}`).value }, { field: 'grade', value: document.getElementById(`edit-crs-g-${id}`).value }];
    await Promise.all(updates.map(u => fetch(`${BASE_URL}/api/admin/update-course`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, id: id, field: u.field, value: u.value }) })));
    loadStudentData(targetStudentEmail);
}