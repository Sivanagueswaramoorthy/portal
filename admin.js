const BASE_URL = 'https://portal-6crm.onrender.com';

let globalToken = localStorage.getItem('bit_session_token'); 
if (globalToken) { globalToken = globalToken.replace(/['"]+/g, ''); } 
else { window.location.href = 'index.html'; }

let allStudentsList = []; 
let targetStudentEmail = ""; 
let originalValues = {}; 
let gpaChartInstance = null;

let currentStudentSkills = []; 

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

        fetchDirectory();
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
}

function signOut() { localStorage.removeItem('bit_session_token'); window.location.href = 'index.html'; }
function openModal(modalId) { const modal = document.getElementById(modalId); if (modal) modal.style.display = 'flex'; }
function closeModal(modalId) { const modal = document.getElementById(modalId); if (modal) modal.style.display = 'none'; }


// ==============================================================================
// --- DIRECTORY & STUDENT PROFILES ---
// ==============================================================================

async function fetchDirectory() {
    const tbody = document.getElementById('directoryBody');
    if(!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading directory...</td></tr>`;
    try {
        const req = await fetch(`${BASE_URL}/api/admin/list`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken }) });
        const data = await req.json();
        if (data.success) {
            allStudentsList = data.students;
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
        return `<tr class="dir-row" onclick="loadStudentData('${esc(s.email)}')">
            <td style="font-weight:600; color: var(--text-main);"><div style="display: flex; align-items: center; gap: 12px;"><img src="https://ui-avatars.com/api/?name=${encodeURIComponent(s.full_name)}&background=random&color=fff&rounded=true" style="width: 32px; height: 32px;"><div>${s.full_name}</div></div></td>
            <td style="color: var(--text-muted);">${s.email}</td>
            <td style="font-family: monospace;">${s.roll_no || '--'}</td>
            <td><span class="badge badge-primary">${s.department || '--'}</span></td>
            <td style="text-align: right; color: var(--text-muted);"><i class="fa-solid fa-chevron-right"></i></td>
        </tr>`;
    }).join('');
}

function filterDirectory() {
    const search = document.getElementById('dirSearch').value.toLowerCase(); const dept = document.getElementById('dirFilter').value;
    const filtered = allStudentsList.filter(s => { const matchesSearch = ((s.full_name||'').toLowerCase().includes(search)) || ((s.email||'').toLowerCase().includes(search)) || ((s.roll_no||'').toLowerCase().includes(search)); const matchesDept = dept === "ALL" || s.department === dept; return matchesSearch && matchesDept; });
    renderDirectory(filtered);
}

function backToDirectory() {
    document.querySelectorAll('.admin-global').forEach(e => e.style.display = 'flex');
    document.querySelectorAll('.student-nav').forEach(e => e.style.display = 'none');
    switchTab('directory', document.getElementById('nav-dir'));
    targetStudentEmail = "";
    currentStudentSkills = []; 
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
    // Auto-convert Google Drive view links to direct image links!
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
                
                // 🛑 Note the total parameter passed in openProfileEdit
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

// ==============================================================================
// --- INLINE EDITING LOGIC (WITH STRICT UX VALIDATION) ---
// ==============================================================================

function openProfileEdit(field, spanId, width, customId, totalLevels) {
    const span = document.getElementById(spanId); originalValues[spanId] = span.innerText.trim();
    span.parentElement.innerHTML = `<div class="flex-center" style="width: 100%;"><input type="text" id="in-${spanId}" class="inline-input" style="width: ${width}; color: var(--text-main);" value="${originalValues[spanId]}"><i class="fa-solid fa-check action-icon save" style="width:28px; height:28px;" onclick="saveProfileEdit('${field}', '${spanId}', '${width}', '${customId || ''}', '${totalLevels || ''}')"></i><i class="fa-solid fa-xmark action-icon cancel" style="width:28px; height:28px;" onclick="cancelProfileEdit('${spanId}', '${field}', '${width}', '${customId || ''}', '${totalLevels || ''}')"></i></div>`;
}

function cancelProfileEdit(spanId, field, width, customId, totalLevels) {
    const wrapper = document.getElementById(`in-${spanId}`).parentElement.parentElement;
    wrapper.innerHTML = `<span id="${spanId}">${originalValues[spanId]}</span><i class="fa-solid fa-pen admin-table-edit" onclick="openProfileEdit('${field}', '${spanId}', '${width}', '${customId}', '${totalLevels}')"></i>`;
}

// 🛑 UPDATED: Blocks impossible levels (e.g. 15 completed levels out of 10 total)
async function saveProfileEdit(field, spanId, width, customId, totalLevels) {
    const val = document.getElementById(`in-${spanId}`).value; 
    
    // 🛑 VALIDATION LOGIC
    if (field === 'completed_levels' && totalLevels) {
        if (Number(val) > Number(totalLevels)) {
            alert(`❌ Invalid Input!\n\nYou entered ${val}, but the maximum levels for this course is ${totalLevels}.`);
            cancelProfileEdit(spanId, field, width, customId, totalLevels);
            return;
        }
        if (Number(val) < 0) {
            alert(`❌ Invalid Input!\n\nLevels cannot be negative.`);
            cancelProfileEdit(spanId, field, width, customId, totalLevels);
            return;
        }
    }

    const wrapper = document.getElementById(`in-${spanId}`).parentElement.parentElement;
    wrapper.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color: var(--primary);"></i>`;
    try {
        if(field === 'completed_levels') {
            const req = await fetch(`${BASE_URL}/api/admin/update-skill`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, id: customId, completed_levels: val }) });
            const res = await req.json();
            if(!res.success) throw new Error(res.message);
        } else {
            await fetch(`${BASE_URL}/api/admin/update-field`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, targetEmail: targetStudentEmail, field: field, value: val }) });
        }
        loadStudentData(targetStudentEmail);
    } catch(e) { 
        alert(e.message || "Failed to update record.");
        cancelProfileEdit(spanId, field, width, customId, totalLevels); 
    }
}

// 🛑 REMOVE SKILL FROM STUDENT
async function removeAssignedSkill(id, skillName) {
    if(!confirm(`Are you sure you want to completely remove "${skillName}" from this student's profile?`)) return;
    try {
        await fetch(`${BASE_URL}/api/admin/remove-skill`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, id: id }) });
        loadStudentData(targetStudentEmail);
    } catch(e) { alert("Failed to remove course."); }
}

function openGpaEdit(sem, currentVal) {
    originalValues[`gpa-${sem}`] = currentVal;
    document.getElementById(`wrap-gpa-${sem}`).innerHTML = `<input type="text" id="in-gpa-${sem}" class="inline-input" style="width: 50px; background:rgba(255,255,255,0.2); color:white; border-color:rgba(255,255,255,0.4);" value="${currentVal}"><i class="fa-solid fa-check action-icon save" style="color:white;" onclick="saveGpaEdit(${sem})"></i>`;
}
async function saveGpaEdit(sem) {
    const val = document.getElementById(`in-gpa-${sem}`).value;
    document.getElementById(`wrap-gpa-${sem}`).innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color: white;"></i>`;
    try {
        await fetch(`${BASE_URL}/api/admin/update-gpa`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, targetEmail: targetStudentEmail, semester: sem, gpa: val }) });
        loadStudentData(targetStudentEmail);
    } catch(e) { }
}

async function submitNewCourse() {
    const sem = document.getElementById('crs-sem').value; const name = document.getElementById('crs-name').value; const mark = document.getElementById('crs-mark').value; const grade = document.getElementById('crs-grade').value;
    if(!sem || !name || !mark || !grade) return alert("All fields are required.");
    try {
        await fetch(`${BASE_URL}/api/admin/add-course`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, targetEmail: targetStudentEmail, semester: sem, course_name: name, marks: mark, grade: grade }) });
        closeModal('add-course-modal'); document.getElementById('crs-sem').value=''; document.getElementById('crs-name').value=''; document.getElementById('crs-mark').value=''; document.getElementById('crs-grade').value=''; loadStudentData(targetStudentEmail);
    } catch(e) {}
}
async function deleteCourse(id) { if(!confirm("Delete subject record?")) return; try { await fetch(`${BASE_URL}/api/admin/delete-course`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, id: id }) }); loadStudentData(targetStudentEmail); } catch(e) {} }


// =========================================================
// 🛑 ANNOUNCEMENTS LOGIC
// =========================================================
// ... (The rest of the file remains exactly as provided before for announcements and course assignments)
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

window.masterPcdpCourses = [];

function getAvailableCourses() {
    const assignedSkillNames = currentStudentSkills.map(s => s.skill_name.toLowerCase());
    return window.masterPcdpCourses.filter(c => !assignedSkillNames.includes(c.course_name.toLowerCase()));
}

async function loadMasterCoursesForDropdown() {
    try {
        const req = await fetch(`${BASE_URL}/api/pcdp/master/courses`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminToken: globalToken })
        });
        const data = await req.json();
        if (data.success) {
            window.masterPcdpCourses = data.courses;
            renderCourseDropdown(getAvailableCourses()); 
        }
    } catch(e) { console.error("Failed to load master courses"); }
}

function renderCourseDropdown(courses) {
    const listContainer = document.getElementById('pcdp-course-list');
    if(!listContainer) return;
    if (!courses || courses.length === 0) {
        listContainer.innerHTML = `<div style="text-align: center; padding: 30px; background: #F8FAFC; border-radius: 12px; border: 1px dashed #CBD5E1; color: #64748B; font-size: 0.9rem;">No matching courses available to assign.</div>`;
        return;
    }
    listContainer.innerHTML = courses.map(c => {
        let iconHtml = '<i class="fa-solid fa-code"></i>';
        const cat = (c.category || '').toLowerCase();
        if(cat.includes('design') || cat.includes('ui')) iconHtml = '<i class="fa-solid fa-palette"></i>';
        else if(cat.includes('data') || cat.includes('ai') || cat.includes('machine')) iconHtml = '<i class="fa-solid fa-brain"></i>';
        else if(cat.includes('cloud') || cat.includes('devops')) iconHtml = '<i class="fa-solid fa-cloud"></i>';
        else if(cat.includes('core') || cat.includes('aptitude')) iconHtml = '<i class="fa-solid fa-book-open-reader"></i>';
        return `<div class="course-option-item" onclick="selectCourseOption(this, '${c.id}')"><div style="display: flex; align-items: center; gap: 14px;"><div style="background: #EEF2FF; width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: var(--primary); font-size: 1.1rem;">${iconHtml}</div><div><div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem; margin-bottom: 3px;">${esc(c.course_name)}</div><div style="display: flex; gap: 8px; align-items: center;"><span class="badge" style="background: #F1F5F9; color: #475569; border: none; padding: 2px 6px; font-size: 0.65rem;">${c.total_levels} Levels</span><span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">${esc(c.category || 'General')}</span></div></div></div><i class="fa-solid fa-circle-check check-icon"></i></div>`;
    }).join('');
    document.getElementById('selected-pcdp-course-id').value = '';
}

function selectCourseOption(element, courseId) {
    document.querySelectorAll('.course-option-item').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    document.getElementById('selected-pcdp-course-id').value = courseId;
}

function filterCourseDropdown() {
    const search = document.getElementById('course-search-input').value.toLowerCase();
    const availableCourses = getAvailableCourses();
    const filtered = availableCourses.filter(c => c.course_name.toLowerCase().includes(search) || (c.category && c.category.toLowerCase().includes(search)));
    renderCourseDropdown(filtered);
}

function openAssignModal() {
    document.getElementById('course-search-input').value = '';
    document.getElementById('assign-course-modal').style.display = 'flex';
    if(!window.masterPcdpCourses || window.masterPcdpCourses.length === 0) { loadMasterCoursesForDropdown(); } else { renderCourseDropdown(getAvailableCourses()); }
}

async function submitCourseAssignment() {
    const courseId = document.getElementById('selected-pcdp-course-id').value;
    if(!courseId) return alert("Please click on a course from the list to select it.");
    if(!targetStudentEmail) return alert("No student selected. Please go back to the directory.");
    const btn = document.getElementById('btn-assign-course');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Assigning...';
    btn.disabled = true;
    try {
        const req = await fetch(`${BASE_URL}/api/admin/assign-pcdp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, targetEmail: targetStudentEmail, course_id: courseId }) });
        const res = await req.json();
        if (res.success) {
            document.getElementById('assign-course-modal').style.display = 'none';
            if(typeof loadStudentData === 'function') { loadStudentData(targetStudentEmail); }
        } else { alert("❌ " + res.message); }
    } catch(e) { alert("❌ Network Error. Please check your connection."); }
    btn.innerHTML = originalText;
    btn.disabled = false;
}