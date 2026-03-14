const BASE_URL = 'https://portal-6crm.onrender.com';

// We will use the admin token structure since this portal requires broad access
let globalToken = localStorage.getItem('bit_session_token'); 
let allStudentsList = [];

// Static Mock Data for Announcements (since there isn't a DB table for it yet)
const mockAnnouncements = [
    { id: 1, title: "Zoho Corp - Phase 1 Recruitment", date: "March 15, 2026", type: "Drive", content: "Zoho is visiting for the Software Developer role. Make sure your resume is updated and your DSA score is above 75%. Registration closes tomorrow at 5 PM." },
    { id: 2, title: "TCS Ninja Assessment Scheduled", date: "March 12, 2026", type: "Assessment", content: "The mandatory aptitude test for TCS Ninja is scheduled for this Friday. Check your emails for the assessment link." },
    { id: 3, title: "Mock Interview Week - Action Required", date: "March 10, 2026", type: "Training", content: "All unplaced students must book a 1-on-1 mock interview slot with their assigned trainer before the end of the week." }
];

if (!globalToken) window.location.href = 'index.html';

window.onload = async () => {
    // Verify admin/staff access
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

        document.getElementById('headerName').innerText = data.profile.full_name;
        document.getElementById('headerEmail').innerText = data.profile.email;
        document.getElementById('headerImage').src = data.profile.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.profile.full_name)}&background=4F46E5&color=fff`;

        fetchDirectory();
        loadAnnouncements();
    } catch (e) { window.location.href = 'index.html'; }
};

// --- NAVIGATION ---
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('show');
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

function signOut() { 
    localStorage.removeItem('bit_session_token'); 
    window.location.href = 'index.html'; 
}

// --- STUDENT DIRECTORY ---
async function fetchDirectory() {
    try {
        const req = await fetch(`${BASE_URL}/api/admin/list`, { 
            method: 'POST', headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ adminToken: globalToken }) 
        });
        const data = await req.json();
        
        if (data.success) {
            allStudentsList = data.students;
            
            // Populate Department Filter
            const deptSelect = document.getElementById('deptFilter');
            const depts = [...new Set(allStudentsList.map(s => s.department).filter(d => d))];
            deptSelect.innerHTML = '<option value="ALL">All Departments</option>';
            depts.forEach(d => { deptSelect.innerHTML += `<option value="${d}">${d}</option>`; });
            
            renderTable(allStudentsList);
        }
    } catch(e) { 
        document.getElementById('student-list-tbody').innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--danger);">Server Error.</td></tr>`; 
    }
}

function renderTable(students) {
    const tbody = document.getElementById('student-list-tbody');
    if(students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">No students found.</td></tr>`;
        return;
    }
    
    tbody.innerHTML = students.map(s => {
        // 1. Check if resume exists
        const resumeLink = (s.resume_url && s.resume_url !== '--' && s.resume_url.trim() !== '')
            ? `<a href="${s.resume_url}" target="_blank" class="action-btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem; border-color: var(--primary); color: var(--primary); text-decoration: none;"><i class="fa-solid fa-file-pdf"></i> View</a>`
            : `<span style="font-size: 0.75rem; color: var(--text-muted); background: #f1f5f9; padding: 4px 8px; border-radius: 4px;">Not Uploaded</span>`;
            
        // 2. Set default status if null
        const currentStatus = s.status || 'Unplaced';
        
        return `
        <tr class="dir-row">
            <td style="font-weight:600; color: var(--text-main); cursor: pointer;" onclick="openStudentDetail('${s.email}', '${s.full_name}', '${s.roll_no}', '${s.department}')">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(s.full_name)}&background=random&color=fff&rounded=true" style="width: 32px; height: 32px;">
                    <div>
                        <div>${s.full_name}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 400;">${s.email} | ${s.roll_no || '--'}</div>
                    </div>
                </div>
            </td>
            <td><span class="badge badge-primary">${s.department || '--'}</span></td>
            
            <td style="font-weight: 600; color: var(--text-main); font-size: 0.9rem;">
                ${s.offer_company && s.offer_company !== '--' ? s.offer_company : '<span style="color:#94a3b8; font-weight:400;">N/A</span>'}
            </td>
            
            <td>${resumeLink}</td>
            
            <td>
                <select onchange="updateStudentStatus('${s.email}', this.value)" class="control-input" style="padding: 6px; font-size: 0.8rem; width: 120px; cursor: pointer; border-color: var(--border); font-weight: 600; color: var(--text-main);">
                    <option value="Unplaced" ${currentStatus === 'Unplaced' ? 'selected' : ''}>Unplaced</option>
                    <option value="Ongoing" ${currentStatus === 'Ongoing' ? 'selected' : ''}>Ongoing / In-Process</option>
                    <option value="Placed" ${currentStatus === 'Placed' ? 'selected' : ''}>Placed</option>
                    <option value="Rejected" ${currentStatus === 'Rejected' ? 'selected' : ''}>Rejected</option>
                </select>
            </td>
            
            <td>
                <button class="action-btn btn-outline" style="padding: 6px 12px; font-size: 0.8rem;" onclick="openStudentDetail('${s.email}', '${s.full_name}', '${s.roll_no}', '${s.department}')">
                    Full Profile <i class="fa-solid fa-arrow-right" style="margin-left: 6px;"></i>
                </button>
            </td>
        </tr>
    `}).join('');
}

// 🛑 NEW FUNCTION: This saves the dropdown change to the database immediately
async function updateStudentStatus(email, newStatus) {
    try {
        const req = await fetch(`${BASE_URL}/api/admin/update-placement-profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminToken: globalToken, targetEmail: email, field: 'status', value: newStatus })
        });
        const data = await req.json();
        
        if (data.success) {
            showToast(`Status updated to ${newStatus}!`);
            
            // Update the local list so the filter still works properly
            const student = allStudentsList.find(s => s.email === email);
            if (student) student.status = newStatus;
        } else {
            showToast("Failed to update status in database.");
        }
    } catch (e) {
        showToast("Network Error updating status.");
    }
}

function filterStudents() {
    const search = document.getElementById('searchStudent').value.toLowerCase();
    const dept = document.getElementById('deptFilter').value;
    
    const filtered = allStudentsList.filter(s => {
        const matchesSearch = (s.full_name && s.full_name.toLowerCase().includes(search)) || 
                              (s.email && s.email.toLowerCase().includes(search)) || 
                              (s.roll_no && s.roll_no.toLowerCase().includes(search));
        const matchesDept = dept === "ALL" || s.department === dept;
        return matchesSearch && matchesDept;
    });
    renderTable(filtered);
}

// --- DETAILED MODAL LOGIC ---
async function openStudentDetail(email, name, roll_no, department) {
    // 1. Show modal and set basic header info immediately
    document.getElementById('student-detail-modal').style.display = 'flex';
    document.getElementById('modal-content-body').style.display = 'none';
    document.getElementById('modal-loading').style.display = 'block';
    
    document.getElementById('detail-name').innerText = name;
    document.getElementById('detail-sub').innerText = `${roll_no || 'No Roll No'} | ${department || 'No Dept'}`;
    document.getElementById('detail-img').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4F46E5&color=fff`;

    // 2. Fetch deep placement data for this specific student
    try {
        const req = await fetch(`${BASE_URL}/api/admin/student-data`, { 
            method: 'POST', headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ adminToken: globalToken, targetEmail: email }) 
        });
        const data = await req.json();
        
        if (data.success) {
            populateDetailModal(data.placeProfile || {}, data.placeApps || []);
            document.getElementById('modal-loading').style.display = 'none';
            document.getElementById('modal-content-body').style.display = 'block';
        } else {
            alert("Failed to fetch placement data.");
            closeDetailModal();
        }
    } catch(e) {
        alert("Network error.");
        closeDetailModal();
    }
}

function closeDetailModal() {
    document.getElementById('student-detail-modal').style.display = 'none';
}

function populateDetailModal(prf, apps) {
    // Offer Card
    document.getElementById('val-p-role').innerText = prf.offer_role || '--'; 
    document.getElementById('val-p-comp').innerText = prf.offer_company || '--';
    document.getElementById('val-p-ctc').innerText = prf.offer_ctc || '--'; 
    
    // Stats Grid
    document.getElementById('val-p-status').innerText = prf.status || 'Unplaced';
    document.getElementById('val-p-assess').innerText = prf.assessments || '0'; 
    document.getElementById('val-p-int').innerText = prf.interviews || '0'; 
    document.getElementById('val-p-off').innerText = prf.offers || '0';
    
    // Progress Bars (Tech)
    const dsa = prf.tech_dsa || '0'; document.getElementById('val-t-dsa').innerText = dsa; document.getElementById('bar-t-dsa').style.width = `${dsa}%`;
    const oop = prf.tech_oop || '0'; document.getElementById('val-t-oop').innerText = oop; document.getElementById('bar-t-oop').style.width = `${oop}%`;
    const core = prf.tech_core || '0'; document.getElementById('val-t-core').innerText = core; document.getElementById('bar-t-core').style.width = `${core}%`;
    
    // Progress Bars (Aptitude)
    const quant = prf.apt_quant || '0'; document.getElementById('val-a-quant').innerText = quant; document.getElementById('bar-a-quant').style.width = `${quant}%`;
    const logical = prf.apt_logical || '0'; document.getElementById('val-a-log').innerText = logical; document.getElementById('bar-a-log').style.width = `${logical}%`;
    const hr = prf.apt_hr || '0'; document.getElementById('val-a-hr').innerText = hr; document.getElementById('bar-a-hr').style.width = `${hr}%`;

    // Applications Table
    const appBody = document.getElementById('student-apps-tbody');
    if (apps && apps.length > 0) {
        appBody.innerHTML = apps.map(a => {
            let bClass = 'badge-primary';
            let statusLower = a.status.toLowerCase();
            if(statusLower.includes('select') || statusLower.includes('offer') || statusLower.includes('placed')) bClass = 'badge-success';
            if(statusLower.includes('clear') || statusLower.includes('reject')) bClass = 'badge-danger';
            if(statusLower.includes('pend') || statusLower.includes('wait')) bClass = 'badge-warning';

            return `
            <tr>
                <td style="font-weight: 700; color: var(--text-main);">${a.company}</td>
                <td style="color: var(--text-muted);">${a.role}</td>
                <td>${a.date_applied}</td>
                <td><span class="badge ${bClass}">${a.status}</span></td>
            </tr>`;
        }).join('');
    } else { 
        appBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 30px; color:var(--text-muted);">No applications logged.</td></tr>`; 
    }
}

/// --- ANNOUNCEMENTS LOGIC ---
async function loadAnnouncements() {
    const feed = document.getElementById('announcement-feed');
    feed.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>`;
    try {
        const req = await fetch(`${BASE_URL}/api/announcements/list`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: globalToken }) });
        const data = await req.json();
        if (data.success) {
            // FILTER: Only show Placement Announcements
            const placeAnns = data.announcements.filter(a => a.type === 'Placement Drive');
            if(placeAnns.length === 0) { feed.innerHTML = `<div class="card" style="text-align:center; padding: 40px; color:var(--text-muted);">No placement announcements posted yet.</div>`; return; }
            
            feed.innerHTML = placeAnns.map(ann => {
                let dateStr = new Date(ann.date_posted).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                return `
                <div class="card" style="display: flex; gap: 20px; align-items: flex-start; padding: 24px; position: relative;">
                    <button class="action-icon cancel" style="position: absolute; top: 16px; right: 16px;" onclick="deleteAnnouncement(${ann.id})"><i class="fa-solid fa-trash"></i></button>
                    <div style="background: var(--success-light); color: var(--success); width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;"><i class="fa-solid fa-briefcase"></i></div>
                    <div style="flex: 1; padding-right: 40px;">
                        <h3 style="margin: 0 0 8px 0; font-size: 1.1rem; color: var(--text-main); font-weight: 800;">${ann.title}</h3>
                        <div style="margin-bottom: 12px;"><span class="badge badge-success" style="margin-right: 10px;">${ann.type}</span><span style="font-size: 0.8rem; color: var(--text-muted);"><i class="fa-regular fa-clock"></i> ${dateStr}</span></div>
                        <p style="margin: 0; color: var(--text-muted); line-height: 1.6; font-size: 0.95rem; white-space: pre-wrap;">${ann.content}</p>
                    </div>
                </div>`;
            }).join('');
        }
    } catch(e) { feed.innerHTML = `<div class="card" style="color:var(--danger); text-align:center;">Network Error</div>`; }
}

async function submitPlacementAnnouncement() {
    const title = document.getElementById('ann-title').value;
    const content = document.getElementById('ann-content').value;
    if(!title || !content) return alert("Title and Content are required!");
    
    await fetch(`${BASE_URL}/api/admin/add-announcement`, { 
        method: 'POST', headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ adminToken: globalToken, title: title, type: 'Placement Drive', content: content }) 
    });
    document.getElementById('add-ann-modal').style.display = 'none';
    document.getElementById('ann-title').value = ''; document.getElementById('ann-content').value = '';
    loadAnnouncements();
}

async function deleteAnnouncement(id) {
    if(!confirm("Delete this announcement?")) return;
    await fetch(`${BASE_URL}/api/admin/delete-announcement`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminToken: globalToken, id: id }) });
    loadAnnouncements();
}

// --- UTILS ---
function showToast(msg) {
    const container = document.getElementById('toast-container'); 
    const toast = document.createElement('div'); 
    toast.className = 'toast-msg';
    toast.innerHTML = `<i class="fa-solid fa-circle-info" style="color:var(--primary);"></i> <span>${msg}</span>`; 
    container.appendChild(toast);
    
    setTimeout(() => { 
        toast.style.opacity = '0'; 
        toast.style.transform = 'translateY(20px)'; 
        setTimeout(() => toast.remove(), 300); 
    }, 3000);
}