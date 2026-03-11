let adminToken = localStorage.getItem('pcdp_session_token');

// 🛑 SMART URL: Auto-detects local vs live
const BASE_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') 
    ? 'http://localhost:10000' 
    : 'https://portal-6crm.onrender.com';

if (!adminToken) window.location.href = 'index.html';

window.onload = async () => { loadMasterCourses(); };

function signOut() { localStorage.removeItem('pcdp_session_token'); window.location.href = 'index.html'; }

async function loadMasterCourses() {
    document.getElementById('pcdp-courses-grid').innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 60px;"><i class="fa-solid fa-spinner fa-spin fa-2x" style="color: var(--primary);"></i></div>`;
    try {
        const req = await fetch(`${BASE_URL}/api/pcdp/master/courses`, { 
            method: 'POST', headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ adminToken: adminToken }) 
        });
        const data = await req.json();
        if (data.success) { renderMasterGrid(data.courses); } else { signOut(); }
    } catch(e) { 
        document.getElementById('pcdp-courses-grid').innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 60px; color: var(--danger);">Network Error. Backend might be sleeping.</div>`;
    }
}

function renderMasterGrid(courses) {
    const grid = document.getElementById('pcdp-courses-grid');
    if(courses.length === 0) { 
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; border: 1px dashed var(--border); color: var(--text-muted); border-radius: 12px;">No global courses created yet. Click "Create Master Course" to begin.</div>`; 
        return; 
    }
    
    grid.innerHTML = courses.map(c => {
        // Image Fallback Logic
        const fallbackImg = 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=500&q=80';
        const imgUrl = (c.image_url && c.image_url.trim() !== "") ? c.image_url : fallbackImg;
        
        return `
        <div id="master-card-${c.id}" style="background: white; border-radius: 8px; border: 1px solid #E2E8F0; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: transform 0.2s;">
            <img src="${imgUrl}" onerror="this.onerror=null; this.src='${fallbackImg}';" style="width: 100%; height: 140px; object-fit: cover;">
            <div style="padding: 16px; flex: 1; display: flex; flex-direction: column;">
                <h4 style="margin: 0 0 12px 0; font-size: 1.05rem; color: #1e293b; font-weight: 800; line-height: 1.3;">${c.course_name}</h4>
                <p style="font-size: 0.8rem; color: #64748b; margin-bottom: 20px; line-height: 1.6; flex: 1;">${c.description || 'No description provided.'}</p>
                
                <div style="display: flex; justify-content: space-between; align-items: center; color: #64748b; font-size: 0.8rem; font-weight: 700; background: #F8FAFC; padding: 10px; border-radius: 8px; border: 1px solid #E2E8F0;">
                    <span><i class="fa-solid fa-layer-group" style="opacity: 0.7; color: var(--primary);"></i> Max Levels: <span id="m-lvl-${c.id}" style="color: var(--text-main); font-weight: 800;">${c.total_levels}</span></span>
                    <span><i class="fa-solid fa-medal" style="opacity: 0.7;"></i> ${c.category || 'General'}</span>
                </div>
            </div>
            
            <div style="display: flex; border-top: 1px solid #E2E8F0; background: #F8FAFC;">
                <button onclick="editMasterLevels(${c.id}, ${c.total_levels})" style="flex: 1; padding: 12px; border: none; background: none; color: #4F46E5; font-size: 0.85rem; font-weight: 700; cursor: pointer; border-right: 1px solid #E2E8F0; transition: background 0.2s;" onmouseover="this.style.background='#EEF2FF'" onmouseout="this.style.background='none'"><i class="fa-solid fa-pen"></i> Edit Levels</button>
                <button onclick="deleteMasterCourse(${c.id})" style="padding: 12px 16px; border: none; background: none; color: #EF4444; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#FEF2F2'" onmouseout="this.style.background='none'"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>`;
    }).join('');
}

// Inline edit for PCDP Admin to alter total levels
function editMasterLevels(id, currentTotal) {
    const card = document.getElementById(`master-card-${id}`);
    card.innerHTML = `
        <div style="padding: 30px 20px; flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; background: white; height: 100%; border-radius: 8px;">
            <div style="margin-bottom:8px; font-weight:800; font-size:1.1rem; color:#1e293b; text-align:center;"><i class="fa-solid fa-layer-group" style="color: #4F46E5; margin-right: 6px;"></i> Edit Total Levels</div>
            <p style="font-size: 0.8rem; color: #64748b; text-align: center; margin-bottom: 24px; line-height: 1.5;">Update the maximum level cap for this global course.</p>
            
            <input type="number" id="edit-m-lvl-${id}" style="width: 100px; text-align:center; font-size:1.4rem; padding: 10px; font-weight: 800; color: #4F46E5; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; margin-bottom: 24px; outline: none;" value="${currentTotal}" min="1">
            
            <div style="display:flex; justify-content: center; gap: 12px; width: 100%;">
                <button style="flex: 1; padding: 10px; border-radius: 8px; background: #10B981; color: white; border: none; font-weight: 600; cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'" onclick="saveMasterLevels(${id})"><i class="fa-solid fa-check"></i> Save</button>
                <button style="flex: 1; padding: 10px; border-radius: 8px; background: white; color: #64748b; border: 1px solid #E2E8F0; font-weight: 600; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#F8FAFC'" onmouseout="this.style.background='white'" onclick="loadMasterCourses()"><i class="fa-solid fa-xmark"></i> Cancel</button>
            </div>
        </div>`;
}

// Save adjusted levels to database
async function saveMasterLevels(id) {
    const newTotal = document.getElementById(`edit-m-lvl-${id}`).value;
    const card = document.getElementById(`master-card-${id}`);
    card.innerHTML = `<div style="text-align:center; padding: 60px;"><i class="fa-solid fa-spinner fa-spin fa-2x" style="color: #4F46E5;"></i></div>`;
    
    await fetch(`${BASE_URL}/api/pcdp/course/update`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminToken: adminToken, id: id, field: 'total_levels', value: newTotal })
    });
    
    loadMasterCourses();
}

async function submitNewMasterCourse() {
    const name = document.getElementById('c-name').value;
    const desc = document.getElementById('c-desc').value;
    const levels = document.getElementById('c-levels').value;
    const cat = document.getElementById('c-cat').value;
    const img = document.getElementById('c-img').value;
    
    if(!name || !levels) return alert("Course name and Total Levels are required.");

    await fetch(`${BASE_URL}/api/pcdp/master/add`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminToken: adminToken, course_name: name, description: desc, total_levels: levels, category: cat, image_url: img })
    });
    
    // Clear the modal inputs
    document.getElementById('c-name').value = ''; 
    document.getElementById('c-desc').value = '';
    document.getElementById('c-levels').value = ''; 
    document.getElementById('c-cat').value = ''; 
    document.getElementById('c-img').value = '';
    
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