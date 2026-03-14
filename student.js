const BASE_URL = 'https://portal-6crm.onrender.com';

let globalToken = localStorage.getItem('bit_session_token');
let gpaChartInstance = null;
let allRewardsData = [];

// Track picture for use in polling loop
let studentProfilePicture = "";

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

function signOut() { localStorage.removeItem('bit_session_token'); window.location.href = 'index.html'; }

// -----------------------------------------------------------------------------
// Core Initialization & Auto-Refresh Polling Logic
// -----------------------------------------------------------------------------
window.onload = async () => {
    // Initial critical check
    const initialReq = await fetch(`${BASE_URL}/api/auth`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ token: globalToken }) 
    });
    const initialData = await initialReq.json();
    
    if (!initialData.success) { 
        localStorage.removeItem('bit_session_token'); 
        window.location.href = 'index.html'; 
        return; 
    }
    
    if (initialData.isAdmin) { window.location.href = 'admin.html'; return; }
    if (initialData.isHR) { window.location.href = 'hr.html'; return; }
    
    // Setup Header & Global variables
    let loggedInName = initialData.profile.full_name; 
    let loggedInEmail = initialData.profile.email; 
    studentProfilePicture = initialData.picture || getAvatar(loggedInName);
    
    setTopHeader(loggedInName, loggedInEmail, studentProfilePicture);
    
    // Initial Render
    renderDataViews(initialData);

    // --- Start Auto-Refresh Polling Loop ---
    // Every 5 seconds, check for progress updates in the background
    setInterval(backgroundRefreshLoop, 5000);
};

// Polling function that runs in background
async function backgroundRefreshLoop() {
    if(!globalToken) return;
    try {
        const req = await fetch(`${BASE_URL}/api/auth`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ token: globalToken }) 
        });
        const data = await req.json();
        
        if (data.success && !data.isAdmin && !data.isHR) {
            renderDataViews(data);
        } else if (data.success === false) {
            signOut();
        }
    } catch(e) { }
}

// Reusable function to render data to dashboard
function renderDataViews(data) {
    populateDashboard(data.profile, studentProfilePicture, data.courses, data.skills, data.semGpas);
    populatePersonalPlacement(data.placeProfile, data.placeApps);
    populateGlobalPlacement(data.globalStats, data.globalDrives); 
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

    if(skills && skills.length > 0) {
        document.getElementById('act-total-skills').innerText = skills.length; 
        document.getElementById('act-mastered').innerText = skills.filter(s => s.completed_levels >= s.total_levels).length; 
        document.getElementById('act-progress').innerText = skills.filter(s => s.completed_levels < s.total_levels).length;
        
        document.getElementById('skills-container').innerHTML = skills.map(c => {
            const total = c.total_levels || 1;
            const comp = c.completed_levels || 0;
            const pct = Math.round((comp / total) * 100);
            const fallbackImg = 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=500&q=80';
            const imgUrl = (c.image_url && c.image_url.trim() !== "") ? c.image_url : fallbackImg;

            let segmentsHtml = '';
            for(let i=0; i<total; i++) { 
                segmentsHtml += `<div style="flex: 1; border-radius: 4px; background: ${i < comp ? '#8B5CF6' : '#E2E8F0'}; height: 6px;"></div>`; 
            }

            return `
            <div style="background: white; border-radius: 8px; border: 1px solid #E2E8F0; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: transform 0.2s;">
                <img src="${imgUrl}" onerror="this.onerror=null; this.src='${fallbackImg}';" style="width: 100%; height: 140px; object-fit: cover;">
                <div style="padding: 16px; flex: 1; display: flex; flex-direction: column;">
                    <h4 style="margin: 0 0 12px 0; font-size: 0.95rem; color: #1e293b; font-weight: 700; line-height: 1.3;">${c.skill_name}</h4>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; color: #64748b; font-size: 0.75rem; font-weight: 600; margin-bottom: 12px;">
                        <span><i class="fa-solid fa-layer-group" style="opacity: 0.7;"></i> Levels: ${total}</span>
                        <span><i class="fa-solid fa-medal" style="opacity: 0.7;"></i> ${c.category || 'General'}</span>
                    </div>
                    
                    <div style="margin-top: auto;">
                        <div style="display: flex; gap: 4px; height: 6px; margin-bottom: 8px;">
                            ${segmentsHtml}
                        </div>
                        <div style="text-align: center; font-size: 0.7rem; color: #64748b;">Progress: ${comp}/${total} levels (${pct}%)</div>
                    </div>
                </div>
            </div>`;
        }).join('');
    } else { 
        document.getElementById('act-total-skills').innerText = "0"; 
        document.getElementById('act-mastered').innerText = "0"; 
        document.getElementById('act-progress').innerText = "0";
        document.getElementById('skills-container').innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color:var(--text-muted); font-weight: 500; border: 1px dashed var(--border); border-radius: 12px;">No PCDP courses assigned yet.</div>`; 
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
                            <div class="flex-center"><span class="val">${semGpaVal}</span></div>
                        </div>
                    </div>
                </div>
                <table class="clean-table">
                    <thead><tr><th style="padding-left:24px;">Subject</th><th>Marks</th><th>Grade</th></tr></thead>
                    <tbody>
                        ${sems[sem].map(c => `
                        <tr>
                            <td style="padding-left:24px; color: var(--text-main); font-weight: 600;">${c.course_name}</td>
                            <td style="color: var(--primary); font-weight: 700; font-family: monospace; font-size:0.9rem;">${c.marks || '--'}</td>
                            <td><span class="badge ${c.grade && (c.grade.includes('A')||c.grade==='O')?'badge-success':'badge-primary'}">${c.grade || '--'}</span></td>
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
        <tr>
            <td style="font-weight: 700; color: var(--text-main);">${d.company}</td>
            <td>${d.role}</td>
            <td style="font-family: monospace;">${d.appeared}</td>
            <td><span class="badge badge-success">${d.selected}</span></td>
            <td style="font-weight: 700; color: var(--primary);">${d.ctc}</td>
        </tr>`).join('');
    } else { 
        drvBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 30px; color:var(--text-muted);">No campus drives recorded.</td></tr>`; 
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

    document.getElementById('resume-link-input').value = (prf.resume_url && prf.resume_url !== '--') ? prf.resume_url : '';
    if (prf.resume_url && prf.resume_url !== '--') {
        document.getElementById('view-resume-btn').href = prf.resume_url;
        document.getElementById('view-resume-btn').style.display = 'inline-flex';
    }

    const appBody = document.getElementById('student-apps-tbody');
    if (pApps && pApps.length > 0) {
        appBody.innerHTML = pApps.map(a => {
            let bClass = 'badge-primary';
            if(a.status.toLowerCase().includes('select') || a.status.toLowerCase().includes('offer') || a.status.toLowerCase().includes('placed')) bClass = 'badge-success';
            if(a.status.toLowerCase().includes('clear') || a.status.toLowerCase().includes('reject')) bClass = 'badge-danger';
            if(a.status.toLowerCase().includes('pend') || a.status.toLowerCase().includes('wait')) bClass = 'badge-warning';
            
            // Format CTC text if provided
            const ctcText = (a.ctc_offered && a.ctc_offered !== '--') ? `<br><span style="font-size:0.75rem; color:var(--success); font-weight:800;"><i class="fa-solid fa-money-bill-wave"></i> ${a.ctc_offered}</span>` : '';
            
            // Generate Download Button if HR provided a link
            const letterBtn = (a.offer_link && a.offer_link.trim() !== '') 
                ? `<a href="${a.offer_link}" target="_blank" class="action-btn btn-outline" style="padding: 4px 8px; font-size: 0.7rem; margin-top: 6px; display: inline-flex; border-color: var(--primary); color: var(--primary);"><i class="fa-solid fa-download"></i> Call Letter</a>` 
                : '';

            return `
            <tr>
                <td style="font-weight: 700; color: var(--text-main);">${a.company}</td>
                <td style="color: var(--text-muted);">${a.role} ${ctcText}</td>
                <td>${a.date_applied}</td>
                <td>
                    <div style="display: flex; flex-direction: column; align-items: flex-start;">
                        <span class="badge ${bClass}">${a.status}</span>
                        ${letterBtn}
                    </div>
                </td>
            </tr>`;
        }).join('');
    } else { 
        appBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 30px; color:var(--text-muted);">No applications logged.</td></tr>`; 
    }
}

async function saveResume() {
    const link = document.getElementById('resume-link-input').value.trim();
    if (!link) return alert("Please paste a link first.");
    
    document.getElementById('resume-link-input').disabled = true;
    
    try {
        const req = await fetch(`${BASE_URL}/api/student/update-resume`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: globalToken, resume_url: link })
        });
        const data = await req.json();
        
        if(data.success) {
            alert("✅ UPDATE SUCCESS: Resume link saved! HR can now view it.");
            document.getElementById('view-resume-btn').href = link;
            document.getElementById('view-resume-btn').style.display = 'inline-flex';
        } else {
            alert(`❌ ERROR: ${data.details || data.message}\n\nYour Google Session has reached its 1-hour limit. You will now be redirected to log in again.`);
            signOut(); 
        }
    } catch(e) {
        alert("❌ CRITICAL NETWORK ERROR: Ensure your backend server is awake!");
    }
    document.getElementById('resume-link-input').disabled = false;
}

async function fetchAllRewards() {
    const tbody = document.getElementById('all-rewards-tbody');
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading Leaderboard...</td></tr>`;

    try {
        const req = await fetch(`${BASE_URL}/api/student/all-rewards`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: globalToken })
        });
        const data = await req.json();

        if (data.success && Array.isArray(data.students)) {
            allRewardsData = data.students; 
            allRewardsData.sort((a, b) => (parseInt(b.reward_points) || 0) - (parseInt(a.reward_points) || 0));
            renderRewardsTable(allRewardsData);
        } else {
            signOut();
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--danger);">Server error or sleeping. Refresh the page.</td></tr>`;
    }
}

function renderRewardsTable(students) {
    const tbody = document.getElementById('all-rewards-tbody');
    if (!students || students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">No records found.</td></tr>`;
        return;
    }

    tbody.innerHTML = students.map((s, index) => {
        let rankBadge = `<span style="font-weight: 800; color: var(--text-muted);">${index + 1}</span>`;
        if (index === 0) rankBadge = `<span class="badge" style="background: #FEF08A; color: #854D0E; border: none;"><i class="fa-solid fa-trophy"></i> 1st</span>`;
        if (index === 1) rankBadge = `<span class="badge" style="background: #E2E8F0; color: #475569; border: none;">2nd</span>`;
        if (index === 2) rankBadge = `<span class="badge" style="background: #FFEDD5; color: #9A3412; border: none;">3rd</span>`;

        return `
        <tr class="dir-row">
            <td>${rankBadge}</td>
            <td style="font-weight:700; color: var(--text-main);">${s.full_name || '--'}</td>
            <td style="font-family: monospace; font-size: 0.95rem;">${s.roll_no || '--'}</td>
            <td><span class="badge badge-primary">${s.department || 'Not Assigned'}</span></td>
            <td style="font-weight: 800; color: #B45309; font-size: 1.1rem;">${s.reward_points || '0'}</td>
        </tr>`;
    }).join('');
}

function filterRewards() {
    const searchTerm = document.getElementById('rewardSearch').value.toLowerCase();
    const filtered = allRewardsData.filter(s => 
        (s.full_name || "").toLowerCase().includes(searchTerm) || 
        (s.roll_no || "").toLowerCase().includes(searchTerm)
    );
    renderRewardsTable(filtered);
}
// --- ANNOUNCEMENT LOGIC (STUDENT) ---
// 🛑 NEW: Student Notice Board Logic
async function fetchStudentAnnouncements() {
    const feed = document.getElementById('student-ann-feed');
    feed.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Checking for updates...</div>`;
    try {
        const req = await fetch(`${BASE_URL}/api/announcements/list`, { 
            method: 'POST', headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ token: globalToken }) 
        });
        const data = await req.json();
        
        if (data.success) {
            if(data.announcements.length === 0) {
                feed.innerHTML = `<div class="card" style="text-align:center; padding: 40px; color:var(--text-muted);">No new announcements.</div>`;
                return;
            }
            
            feed.innerHTML = data.announcements.map(ann => {
                let isPlacement = ann.type === "Placement Drive";
                let icon = isPlacement ? "fa-building-user" : "fa-building-columns";
                let color = isPlacement ? "var(--success)" : "var(--primary)";
                let dateStr = new Date(ann.date_posted).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                
                // Show target badge to student
                let targetLabel = ann.target_department || 'ALL';
                let deptBadge = targetLabel === 'ALL' 
                    ? `<span class="badge" style="background: #E2E8F0; color: #475569; margin-right: 10px;"><i class="fa-solid fa-globe"></i> Global Notice</span>`
                    : `<span class="badge" style="background: var(--purple-light); color: var(--purple); margin-right: 10px;"><i class="fa-solid fa-bullseye"></i> Specifically for ${targetLabel}</span>`;

                return `
                <div class="card" style="display: flex; gap: 20px; align-items: flex-start; padding: 24px; border-left: 4px solid ${color};">
                    <div style="background: ${color}20; color: ${color}; width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;"><i class="fa-solid ${icon}"></i></div>
                    <div style="flex: 1;">
                        <h3 style="margin: 0 0 8px 0; font-size: 1.1rem; color: var(--text-main); font-weight: 800;">${ann.title}</h3>
                        <div style="margin-bottom: 12px;">
                            <span class="badge" style="background: ${color}10; color: ${color}; border: 1px solid ${color}40; margin-right: 10px;">${ann.type}</span>
                            ${deptBadge}
                            <span style="font-size: 0.8rem; color: var(--text-muted);"><i class="fa-regular fa-clock"></i> ${dateStr}</span>
                        </div>
                        <p style="margin: 0; color: var(--text-muted); line-height: 1.6; font-size: 0.95rem; white-space: pre-wrap;">${ann.content}</p>
                    </div>
                </div>`;
            }).join('');
        }
    } catch(e) { 
        feed.innerHTML = `<div class="card" style="color:var(--danger); text-align:center;">Network Error. Refresh to try again.</div>`; 
    }
}