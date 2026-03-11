let adminToken = localStorage.getItem('pcdp_session_token');
let masterCoursesData = []; // Stores all data so we can edit it

const BASE_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') 
    ? 'http://localhost:10000' 
    : 'https://portal-6crm.onrender.com';

if (!adminToken) window.location.href = 'index.html';

window.onload = async () => { loadMasterCourses(); };

// Mobile Sidebar Toggle
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

function signOut() { 
    localStorage.removeItem('pcdp_session_token'); 
    window.location.href = 'index.html'; 
}

async function loadMasterCourses() {
    document.getElementById('pcdp-courses-grid').innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 60px;"><i class="fa-solid fa-spinner fa-spin fa-2x" style="color: var(--purple);"></i></div>`;
    try {
        const req = await fetch(`${BASE_URL}/api/pcdp/master/courses`, { 
            method: 'POST', headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ adminToken: adminToken }) 
        });
        const data = await req.json();
        if (data.success) { 
            masterCoursesData = data.courses; 
            renderMasterGrid(masterCoursesData); 
        } else { signOut(); }
    } catch(e) { 
        document.getElementById('pcdp-courses-grid').innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 60px; color: var(--danger); background: var(--danger-bg); border-radius: 12px; border: 1px solid var(--danger-light);">Network Error. Backend might be sleeping.</div>`;
    }
}

function renderMasterGrid(courses) {
    const grid = document.getElementById('pcdp-courses-grid');
    if(courses.length === 0) { 
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 60px; border: 1px dashed var(--border); background: white; color: var(--text-muted); border-radius: 12px;">No global courses created yet.<br><br>Click "Create Master Course" to begin.</div>`; 
        return; 
    }
    
    grid.innerHTML = courses.map(c => {
        const fallbackImg = 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=500&q=80';
        const imgUrl = (c.image_url && c.image_url.trim() !== "") ? c.image_url : fallbackImg;
        
        return `
        <div class="skill-card" id="master-card-${c.id}" style="padding: 0; display: flex; flex-direction: column; height: 100%; min-height: 380px; border: 1px solid var(--border); border-radius: 12px; background: white; box-shadow: var(--shadow-sm); transition: all 0.2s ease;">
            <div style="height: 160px; width: 100%; position: relative; flex-shrink: 0; border-radius: 12px 12px 0 0; overflow: hidden; background: var(--bg-app);">
                <img src="${imgUrl}" onerror="this.onerror=null; this.src='${fallbackImg}';" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                <div style="position: absolute; top: 12px; right: 12px; background: rgba(255,255,255,0.95); padding: 4px 10px; border-radius: 8px; font-size: 0.7rem; font-weight: 800; color: var(--purple); box-shadow: var(--shadow-sm); backdrop-filter: blur(4px);">
                    <i class="fa-solid fa-medal"></i> ${c.category || 'General'}
                </div>
            </div>
            
            <div style="padding: 20px; flex: 1; display: flex; flex-direction: column;">
                <h4 style="margin: 0 0 8px 0; font-size: 1.1rem; color: var(--text-main); font-weight: 800; line-height: 1.3;">${c.course_name}</h4>
                <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 20px; line-height: 1.6; flex: 1;">${c.description || 'No description provided.'}</p>
                
                <div style="background: var(--bg-app); padding: 12px; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; font-weight: 700; color: var(--text-muted);">
                        <span><i class="fa-solid fa-layer-group" style="color: var(--purple); opacity: 0.8; margin-right: 4px;"></i> Max Levels</span>
                        <span style="color: var(--text-main); font-size: 1.1rem; font-weight: 800;" id="m-lvl-${c.id}">${c.total_levels}</span>
                    </div>
                </div>
                
                <div style="display: flex; gap: 10px;">
                    <button onclick="openEditModal(${c.id})" class="action-btn btn-outline" style="flex: 1; justify-content: center; color: var(--purple); border-color: rgba(139, 92, 246, 0.3); padding: 10px;"><i class="fa-solid fa-pen"></i> Edit</button>
                    <button onclick="deleteMasterCourse(${c.id})" class="action-btn btn-outline" style="justify-content: center; color: var(--danger); border-color: rgba(239, 68, 68, 0.3); padding: 10px 14px;"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        </div>`;
    }).join('');
}

// Open the Edit Modal and populate it with existing data
function openEditModal(id) {
    const course = masterCoursesData.find(c => c.id == id);
    
    if(!course) {
        alert("Error: Could not locate course data. Please refresh the page.");
        return;
    }
    
    try {
        document.getElementById('edit-c-id').value = course.id;
        document.getElementById('edit-c-name').value = course.course_name || '';
        document.getElementById('edit-c-desc').value = course.description || '';
        document.getElementById('edit-c-levels').value = course.total_levels || 1;
        document.getElementById('edit-c-cat').value = course.category || '';
        document.getElementById('edit-c-img').value = course.image_url || '';
        
        openModal('edit-course-modal');
    } catch (e) {
        alert("Error rendering modal.");
    }
}

// Send the edited data to the server
async function submitEditMasterCourse() {
    const id = document.getElementById('edit-c-id').value;
    const name = document.getElementById('edit-c-name').value;
    const desc = document.getElementById('edit-c-desc').value;
    const levels = document.getElementById('edit-c-levels').value;
    const cat = document.getElementById('edit-c-cat').value;
    const img = document.getElementById('edit-c-img').value;

    if(!name || !levels) return alert("Course Title and Max Levels are required.");

    const btn = document.querySelector('#edit-course-modal .btn-success');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

    await fetch(`${BASE_URL}/api/pcdp/master/edit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            adminToken: adminToken, 
            id: id, 
            course_name: name, 
            description: desc, 
            total_levels: levels, 
            category: cat, 
            image_url: img 
        })
    });

    btn.innerHTML = 'Save Changes';
    closeModal('edit-course-modal');
    loadMasterCourses();
}

// Create new data
async function submitNewMasterCourse() {
    const name = document.getElementById('c-name').value;
    const desc = document.getElementById('c-desc').value;
    const levels = document.getElementById('c-levels').value;
    const cat = document.getElementById('c-cat').value;
    const img = document.getElementById('c-img').value;
    
    if(!name || !levels) return alert("Course Title and Max Levels are required.");

    const btn = document.querySelector('#add-course-modal .btn-primary');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

    await fetch(`${BASE_URL}/api/pcdp/master/add`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminToken: adminToken, course_name: name, description: desc, total_levels: levels, category: cat, image_url: img })
    });
    
    // Clear inputs
    document.getElementById('c-name').value = ''; 
    document.getElementById('c-desc').value = '';
    document.getElementById('c-levels').value = ''; 
    document.getElementById('c-cat').value = ''; 
    document.getElementById('c-img').value = '';
    
    btn.innerHTML = '<i class="fa-solid fa-plus"></i> Save to Global Hub';
    closeModal('add-course-modal'); 
    loadMasterCourses();
}

async function deleteMasterCourse(id) {
    if(!confirm("Are you sure you want to delete this master course?\n\n(Note: This will not remove it from students who already have it assigned in their personal profiles.)")) return;
    
    await fetch(`${BASE_URL}/api/pcdp/master/delete`, { 
        method: 'POST', headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ adminToken: adminToken, id: id }) 
    });
    
    loadMasterCourses();
}