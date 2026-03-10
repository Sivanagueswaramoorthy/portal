let adminToken = localStorage.getItem('pcdp_session_token');

const BASE_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') 
    ? 'http://localhost:10000' 
    : 'https://portal-6crm.onrender.com';

if (!adminToken) window.location.href = 'index.html';

window.onload = async () => { loadMasterCourses(); };

function signOut() { localStorage.removeItem('pcdp_session_token'); window.location.href = 'index.html'; }

async function loadMasterCourses() {
    document.getElementById('pcdp-courses-grid').innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 60px;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>`;
    try {
        const req = await fetch(`${BASE_URL}/api/pcdp/master/courses`, { 
            method: 'POST', headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ adminToken: adminToken }) 
        });
        const data = await req.json();
        if (data.success) { renderMasterGrid(data.courses); } else { signOut(); }
    } catch(e) { }
}

function renderMasterGrid(courses) {
    const grid = document.getElementById('pcdp-courses-grid');
    if(courses.length === 0) { 
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; border: 1px dashed var(--border); color: var(--text-muted); border-radius: 12px;">No global courses created yet.</div>`; 
        return; 
    }
    
    grid.innerHTML = courses.map(c => {
        const imgUrl = c.image_url || 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=500&q=80';
        return `
        <div class="img-card" style="border: 1px solid var(--primary-light);">
            <div class="card-img-wrapper" style="height: 140px;"><img src="${imgUrl}"></div>
            <div class="card-body">
                <div class="card-title" style="color: var(--primary);">${c.course_name}</div>
                <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 16px; line-height: 1.5; flex: 1;">
                    ${c.description || 'No description provided.'}
                </div>
                <div class="card-meta" style="margin-bottom: 0; padding-top: 12px; border-top: 1px solid #E5E7EB;">
                    <div style="color: #9CA3AF;"><i class="fa-solid fa-layer-group"></i> Levels: ${c.total_levels}</div>
                    <div style="color: #4B5563;"><i class="fa-solid fa-medal"></i> ${c.category || 'General'}</div>
                </div>
            </div>
            <div class="admin-level-update" style="justify-content: flex-end; background: #FEF2F2; border-top-color: #FECACA;">
                <button class="action-btn" style="background: transparent; color: var(--danger); font-size: 0.8rem; padding: 4px;" onclick="deleteMasterCourse(${c.id})"><i class="fa-solid fa-trash"></i> Delete Global Course</button>
            </div>
        </div>`;
    }).join('');
}

async function submitNewMasterCourse() {
    const name = document.getElementById('c-name').value;
    const desc = document.getElementById('c-desc').value;
    const levels = document.getElementById('c-levels').value;
    const cat = document.getElementById('c-cat').value;
    const img = document.getElementById('c-img').value;
    
    if(!name || !levels) return alert("Course name and Total Levels required.");

    await fetch(`${BASE_URL}/api/pcdp/master/add`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            adminToken: adminToken, 
            course_name: name, 
            description: desc, 
            total_levels: levels, 
            category: cat, 
            image_url: img 
        })
    });
    
    // Clear inputs after successful submission
    document.getElementById('c-name').value = ''; 
    document.getElementById('c-desc').value = '';
    document.getElementById('c-levels').value = ''; 
    document.getElementById('c-cat').value = ''; 
    document.getElementById('c-img').value = '';
    
    closeModal('add-course-modal'); 
    loadMasterCourses();
}

async function deleteMasterCourse(id) {
    if(!confirm("Delete this master course? (Note: This will not remove it from students who already have it assigned)")) return;
    await fetch(`${BASE_URL}/api/pcdp/master/delete`, { 
        method: 'POST', headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ adminToken: adminToken, id: id }) 
    });
    loadMasterCourses();
}