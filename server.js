// 🛑 SMART URL: Auto-detects if you are testing locally or on live GitHub Pages!
const BASE_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') 
    ? 'http://localhost:10000' 
    : 'https://portal-6crm.onrender.com';

let globalToken = localStorage.getItem('bit_session_token');
let gpaChartInstance = null;
let allRewardsData = [];

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
    if (sidebar.classList.contains('open')) overlay.classList.add('show'); else overlay.classList.remove('show');
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

window.onload = async () => {
    try {
        const req = await fetch(`${BASE_URL}/api/auth`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ token: globalToken }) 
        });
        const data = await req.json();
        
        if (!data.success) { 
            localStorage.removeItem('bit_session_token'); 
            window.location.href = 'index.html'; 
            return; 
        }
        
        if (data.isAdmin) { window.location.href = 'admin.html'; return; }
        if (data.isHR) { window.location.href = 'hr.html'; return; }
        
        let loggedInName = data.profile.full_name; 
        let loggedInEmail = data.profile.email; 
        let loggedInPic = data.picture || getAvatar(loggedInName);
        
        setTopHeader(loggedInName, loggedInEmail, loggedInPic);
        
        populateDashboard(data.profile, loggedInPic, data.courses, data.skills, data.semGpas);
        populatePersonalPlacement(data.placeProfile, data.placeApps);
        populateGlobalPlacement(data.globalStats, data.globalDrives); 
        
    } catch (e) { 
        localStorage.removeItem('bit_session_token');
        window.location.href = 'index.html'; 
    }
};

function signOut() { localStorage.removeItem('bit_session_token'); window.location.href = 'index.html'; }

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
        
        document.getElementById('skills-container').innerHTML = skills.map(s => {
            let pct = Math.round((s.completed_levels / s.total_levels) * 100) || 0;
            return `
            <div class="skill-card">
                <div class="skill-header flex-between">
                    <div class="skill-title"><span>${s.skill_name}</span></div>
                </div>
                <div class="badge" style="margin-bottom: 12px;">${s.category || 'General'}</div>
                <div class="progress-track"><div class="progress-fill" style="width: ${pct}%;"></div></div>
                <div class="skill-footer flex-between">
                    <div class="flex-center">
                        <i class="fa-solid fa-layer-group" style="color: var(--primary);"></i> 
                        <span style="color: var(--text-main); font-weight:800;">${s.completed_levels}</span> / 
                        <span>${s.total_levels}</span> Lvl
                    </div>
                    <div style="color: var(--primary); font-weight: 800;">${pct}%</div>
                </div>
            </div>`;
        }).join('');
    } else { 
        document.getElementById('act-total-skills').innerText = "0"; 
        document.getElementById('act-mastered').innerText = "0"; 
        document.getElementById('act-progress').innerText = "0";
        document.getElementById('skills-container').innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color:var(--text-muted); font-weight: 500; border: 1px dashed var(--border); border-radius: 12px;">No PCDP activities logged yet.</div>`; 
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

    // Safely insert Resume Link
    document.getElementById('resume-link-input').value = (prf.resume_url && prf.resume_url !== '--') ? prf.resume_url : '';
    if (prf.resume_url && prf.resume_url !== '--') {
        document.getElementById('view-resume-btn').href = prf.resume_url;
        document.getElementById('view-resume-btn').style.display = 'inline-flex';
    }

    const appBody = document.getElementById('student-apps-tbody');
    if (pApps && pApps.length > 0) {
        appBody.innerHTML = pApps.map(a => {
            let bClass = 'badge-primary';
            if(a.status.toLowerCase().includes('select') || a.status.toLowerCase().includes('offer')) bClass = 'badge-success';
            if(a.status.toLowerCase().includes('clear') || a.status.toLowerCase().includes('reject')) bClass = 'badge-danger';
            if(a.status.toLowerCase().includes('pend') || a.status.toLowerCase().includes('wait')) bClass = 'badge-warning';
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

// 🛠️ FIX: ADVANCED RESUME SAVE WITH ERROR CATCHING
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