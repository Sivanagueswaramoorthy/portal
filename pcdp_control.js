let adminToken = localStorage.getItem('bit_session_token');
let currentStudentEmail = null;

const BASE_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') 
    ? 'http://localhost:10000' 
    : 'https://portal-6crm.onrender.com';

if (!adminToken) window.location.href = 'index.html';

// 🛠️ PCDP Course Config: Maps Category/Skill Name to visual assets
const PCDP_CONFIG = {
    // Technical Skills
    "C Programming": { icon: "fa-solid fa-computer", bg: "linear-gradient(to bottom right, #f8fafc, #cbd5e1)" },
    "Python Programming": { icon: "fa-solid fa-file-code", bg: "linear-gradient(to bottom right, #f8fafc, #cbd5e1)" },
    "Java Programming": { icon: "fa-solid fa-terminal", bg: "linear-gradient(to bottom right, #f8fafc, #cbd5e1)" },
    "Data Structures": { icon: "fa-solid fa-project-diagram", bg: "linear-gradient(to bottom right, #f8fafc, #cbd5e1)" },
    
    // Categorical Icons based on DB 'category' field if specific skill not found
    "_DEFAULT_Aptitude": { icon: "fa-solid fa-brain" },
    "_DEFAULT_Communication": { icon: "fa-solid fa-comments" },
    "_DEFAULT_Technical": { icon: "fa-solid fa-code" },
    "_DEFAULT_DEFAULT": { icon: "fa-solid fa-star" }
};

function getAvatar(name) { 
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4F46E5&color=fff&bold=true&rounded=true`; 
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open'); 
    document.getElementById('sidebar-overlay').classList.toggle('show');
}

window.onload = async () => {
    try {
        const req = await fetch(`${BASE_URL}/api/pcdp/admin/students`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ adminToken: adminToken }) 
        });
        const data = await req.json();
        if (!data.success) { signOut(); return; }
        populateStudentNav(data.students);
    } catch (e) { signOut(); }
};

function signOut() { localStorage.removeItem('bit_session_token'); window.location.href = 'index.html'; }

function populateStudentNav(students) {
    const nav = document.getElementById('student-list-nav');
    if(students.length === 0) { nav.innerHTML = '<div class="student-nav-label">No Students Found</div>'; return; }
    
    nav.innerHTML = students.map(s => `
        <a class="nav-item" onclick="loadStudentPcdp('${s.email}', this)" style="padding-top:14px; padding-bottom:14px;">
            <div>
                <div class="flex-center"><i class="fa-solid fa-user"></i> ${s.full_name}</div>
                <div class="student-roll" style="padding-left: 28px;">${s.roll_no || '--'}</div>
            </div>
        </a>`).join('');
}

async function loadStudentPcdp(email, element) {
    currentStudentEmail = email;
    
    // UI Switching
    document.getElementById('no-student-placeholder').style.display = 'none';
    document.getElementById('student-pcdp-view').style.display = 'block';
    const grid = document.getElementById('pcdp-courses-grid');
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 60px; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin fa-3x"></i> Loading Pipeline...</div>`;

    // Highlighting current Nav item
    document.querySelectorAll('#student-list-nav .nav-item').forEach(n => n.classList.remove('active'));
    element.classList.add('active');

    if(window.innerWidth <= 768) toggleSidebar(); // close sidebar on mobile

    try {
        const req = await fetch(`${BASE_URL}/api/pcdp/admin/student-courses`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ adminToken: adminToken, targetEmail: email }) 
        });
        const data = await req.json();
        
        if (data.success) {
            updateHeader(data.profile, email);
            renderCoursesGrid(data.courses);
        }
    } catch(e) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--danger);">Network Error. Backend server might be sleeping.</div>`;
    }
}

function updateHeader(p, email) {
    document.getElementById('p-header-img').src = getAvatar(p.full_name);
    document.getElementById('p-header-name').innerText = p.full_name;
    document.getElementById('p-header-dept').innerText = p.department;
    document.getElementById('p-header-roll').innerText = p.roll_no;
    document.getElementById('p-header-points').innerText = p.reward_points;
}

function renderCoursesGrid(courses) {
    const grid = document.getElementById('pcdp-courses-grid');
    if(courses.length === 0) { grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 60px; color: var(--text-muted); border: 1px dashed var(--border); border-radius: 12px;">No PCDP skills added for this student in database yet.</div>`; return; }
    
    grid.innerHTML = courses.map(c => {
        // Map data based on image reference requirements
        const completed = c.completed_levels || 0;
        const total = c.total_levels || 1; // prevent divide by zero
        const percent = Math.round((completed / total) * 100);
        
        // 🛑 VISUAL PROGRESS CLASSIFICATION 🛑
        let status = 'is-locked'; let badgeText = 'GET STARTED'; let badgeIcon = 'fa-play';
        
        if (completed > 0 && completed < total) { 
            status = 'is-in-progress'; badgeText = 'IN PROGRESS'; badgeIcon = 'fa-hourglass-half';
        } else if (completed >= total) { 
            status = 'is-completed'; badgeText = 'COMPLETED'; badgeIcon = 'fa-check-circle';
        }

        // Get visual config (Icon based on skill name)
        let visual = PCDP_CONFIG[c.skill_name];
        if(!visual) visual = PCDP_CONFIG[`_DEFAULT_${c.category}`] || PCDP_CONFIG[`_DEFAULT_DEFAULT`];

        return `
        <div class="pcdp-card ${status}">
            <div class="pcdp-card-graphic" style="${visual.bg || ''}">
                <i class="${visual.icon} pcdp-category-icon"></i>
                
                <div class="level-selector-container">
                    <span class="level-label">Completed</span>
                    <div class="flex-center">
                        <input type="number" class="pcdp-level-input" value="${completed}" min="0" max="${total}" onchange="updateCourseLevel(${c.id}, this)">
                        <span class="level-slash">/</span>
                        <span class="total-level-text">${total} Lvl</span>
                    </div>
                </div>
            </div>

            <div class="pcdp-card-body">
                <div class="pcdp-course-title">${c.skill_name}</div>
                
                <div class="pcdp-progress-bar-area">
                    <div class="pcdp-native-track">
                        <div class="pcdp-native-fill" style="width: ${percent}%;"></div>
                    </div>
                    <div class="pcdp-status-badge">
                        <i class="fa-solid ${badgeIcon}"></i> ${badgeText}
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

async function updateCourseLevel(courseId, inputElement) {
    const newLevel = parseInt(inputElement.value);
    const maxLevel = parseInt(inputElement.getAttribute('max'));
    
    if(isNaN(newLevel) || newLevel < 0 || newLevel > maxLevel) {
        alert("❌ ERROR: Level must be a number between 0 and " + maxLevel);
        loadStudentPcdp(currentStudentEmail, document.querySelector('#student-list-nav .nav-item.active')); // Refresh to fix input
        return;
    }

    // Lock input during save
    inputElement.disabled = true;
    inputElement.style.borderColor = 'var(--primary)';

    try {
        const req = await fetch(`${BASE_URL}/api/pcdp/admin/update-level`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminToken: adminToken, courseId: courseId, newLevel: newLevel })
        });
        const data = await req.json();
        if(data.success) {
            // Reload the view to update percentages and coloring instantly
            loadStudentPcdp(currentStudentEmail, document.querySelector('#student-list-nav .nav-item.active'));
        } else { alert("❌ UPDATE FAILED: " + data.message); }
    } catch(e) { alert("❌ NETWORK ERROR: Ensure backend is running."); }
    
    inputElement.disabled = false;
}