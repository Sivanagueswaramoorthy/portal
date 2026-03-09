let adminToken = localStorage.getItem('pcdp_session_token');
let currentStudentEmail = null;

const BASE_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') 
    ? 'http://localhost:10000' 
    : 'https://portal-6crm.onrender.com';

if (!adminToken) window.location.href = 'index.html';

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open'); 
    document.getElementById('sidebar-overlay').classList.toggle('show');
}

window.onload = async () => {
    try {
        const req = await fetch(`${BASE_URL}/api/pcdp/admin/students`, { 
            method: 'POST', headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ adminToken: adminToken }) 
        });
        const data = await req.json();
        if (!data.success) { signOut(); return; }
        populateStudentNav(data.students);
    } catch (e) { signOut(); }
};

function signOut() { localStorage.removeItem('pcdp_session_token'); window.location.href = 'index.html'; }

function populateStudentNav(students) {
    const nav = document.getElementById('student-list-nav');
    nav.innerHTML = students.map(s => `
        <a class="nav-item" onclick="loadStudentPcdp('${s.email}', this)" style="padding:14px;">
            <div>
                <div class="flex-center"><i class="fa-solid fa-user"></i> ${s.full_name}</div>
                <div class="student-roll" style="padding-left: 28px;">${s.roll_no || '--'}</div>
            </div>
        </a>`).join('');
}

async function loadStudentPcdp(email, element) {
    currentStudentEmail = email;
    document.getElementById('student-pcdp-view').style.display = 'flex';
    document.getElementById('pcdp-courses-grid').innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 60px;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>`;

    document.querySelectorAll('#student-list-nav .nav-item').forEach(n => n.classList.remove('active'));
    if(element) element.classList.add('active');
    if(window.innerWidth <= 768) toggleSidebar(); 

    try {
        const req = await fetch(`${BASE_URL}/api/pcdp/admin/student-courses`, { 
            method: 'POST', headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ adminToken: adminToken, targetEmail: email }) 
        });
        const data = await req.json();
        if (data.success) {
            document.getElementById('p-header-name').innerText = data.profile.full_name;
            document.getElementById('p-header-roll').innerText = data.profile.roll_no;
            renderCoursesGrid(data.courses);
        }
    } catch(e) { }
}

function renderCoursesGrid(courses) {
    const grid = document.getElementById('pcdp-courses-grid');
    if(courses.length === 0) { grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">No assigned courses.</div>`; return; }
    
    grid.innerHTML = courses.map(c => {
        const total = c.total_levels || 1;
        const comp = c.completed_levels || 0;
        const pct = Math.round((comp / total) * 100);
        const imgUrl = c.image_url || 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=500&q=80';

        // Segmented Bar HTML
        let segmentsHtml = '';
        for(let i=0; i<total; i++) { segmentsHtml += `<div class="segment ${i < comp ? 'filled' : ''}"></div>`; }

        // Level Dropdown HTML
        let optionsHtml = '';
        for(let i=0; i<=total; i++) { optionsHtml += `<option value="${i}" ${i === comp ? 'selected' : ''}>${i}</option>`; }

        return `
        <div class="img-card">
            <div class="card-img-wrapper"><img src="${imgUrl}"></div>
            <div class="card-body">
                <div class="card-title">${c.skill_name}</div>
                <div class="card-meta">
                    <div style="color: #9CA3AF;"><i class="fa-solid fa-layer-group"></i> Levels: ${total}</div>
                    <div style="color: #4B5563;"><i class="fa-solid fa-medal"></i> ${c.category || 'Skill'}</div>
                </div>
                <div class="segmented-track">${segmentsHtml}</div>
                <div class="progress-text">Progress: ${comp}/${total} levels (${pct}%)</div>
            </div>
            <div class="admin-level-update">
                <div class="flex-center">
                    <span style="font-size: 0.75rem; font-weight: 700; color: #6B7280; margin-right: 8px;">Assign Level:</span>
                    <select onchange="updateLevel(${c.id}, this.value)">${optionsHtml}</select>
                </div>
                <i class="fa-solid fa-trash delete-btn" onclick="deleteCourse(${c.id})"></i>
            </div>
        </div>`;
    }).join('');
}

async function updateLevel(courseId, newLevel) {
    await fetch(`${BASE_URL}/api/pcdp/admin/update-level`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminToken: adminToken, courseId: courseId, newLevel: parseInt(newLevel) })
    });
    loadStudentPcdp(currentStudentEmail, document.querySelector('#student-list-nav .nav-item.active'));
}

async function submitNewCourse() {
    const name = document.getElementById('c-name').value;
    const levels = document.getElementById('c-levels').value;
    const cat = document.getElementById('c-cat').value;
    const img = document.getElementById('c-img').value;
    
    await fetch(`${BASE_URL}/api/pcdp/admin/add-skill`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminToken: adminToken, targetEmail: currentStudentEmail, skill_name: name, total_levels: levels, category: cat, image_url: img })
    });
    closeModal('add-course-modal');
    loadStudentPcdp(currentStudentEmail, document.querySelector('#student-list-nav .nav-item.active'));
}

async function deleteCourse(id) {
    if(!confirm("Remove this course?")) return;
    await fetch(`${BASE_URL}/api/pcdp/admin/delete-skill`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: adminToken, id: id }) });
    loadStudentPcdp(currentStudentEmail, document.querySelector('#student-list-nav .nav-item.active'));
}