const BASE_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') 
    ? 'http://localhost:10000' 
    : 'https://portal-6crm.onrender.com';

const hrToken = localStorage.getItem('hr_session_token');
let allApplicants = []; 

// Redirect if no session
if (!hrToken) {
    window.location.href = 'index.html';
} else {
    window.onload = initializeHRPortal;
}

// 1. Verify HR Session & Load Profile
async function initializeHRPortal() {
    try {
        const req = await fetch(`${BASE_URL}/api/hr/verify`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ token: hrToken }) 
        });
        const data = await req.json();
        
        if (!data.success) { signOut(); return; }
        
        document.getElementById('headerEmail').innerText = data.email; 
        document.getElementById('hr-company').innerText = data.company;
        
        fetchApplicants();
    } catch (e) { 
        console.error("Dashboard Error:", e);
        showToast("Connection to server failed.", "danger");
    }
}

// 2. Fetch Data from Backend DB
async function fetchApplicants() {
    const tbody = document.getElementById('hr-applicants-tbody');
    try {
        const req = await fetch(`${BASE_URL}/api/hr/applicants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: hrToken })
        });
        const data = await req.json();

        if (data.success) {
            allApplicants = data.applicants;
            calculateStats(allApplicants);
            applyFilters(); 
        } else {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger); padding: 20px;">${data.message || 'No applicants found for your company.'}</td></tr>`;
        }
    } catch(e) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger); padding: 20px;">Server Error. Please refresh.</td></tr>`;
    }
}

// 3. Update Dashboard Stats
function calculateStats(list) {
    document.getElementById('total-count').innerText = list.length;
    const cgpas = list.map(a => parseFloat(a.cgpa) || 0).filter(c => c > 0);
    const avg = cgpas.length ? (cgpas.reduce((a, b) => a + b, 0) / cgpas.length).toFixed(2) : "0.00";
    document.getElementById('avg-cgpa').innerText = avg;
}

// 4. Live Filtering Logic
function applyFilters() {
    const searchTerm = document.getElementById('nameSearch').value.toLowerCase();
    const branch = document.getElementById('branchFilter').value;
    const minCgpa = parseFloat(document.getElementById('cgpaRange').value);
    
    document.getElementById('cgpaVal').innerText = minCgpa.toFixed(1);

    const filtered = allApplicants.filter(a => {
        const name = a.full_name ? a.full_name.toLowerCase() : "";
        const roll = a.roll_no ? a.roll_no.toLowerCase() : "";
        const role = a.role ? a.role.toLowerCase() : "";
        
        const matchesSearch = name.includes(searchTerm) || roll.includes(searchTerm) || role.includes(searchTerm);
        const matchesBranch = (branch === 'all' || a.department === branch);
        const matchesCgpa = (parseFloat(a.cgpa) || 0) >= minCgpa;
        
        return matchesSearch && matchesBranch && matchesCgpa;
    });

    document.getElementById('filtered-count').innerText = filtered.length;
    renderTable(filtered);
}

// 5. Render Table with Action Buttons
function renderTable(list) {
    const tbody = document.getElementById('hr-applicants-tbody');
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">No candidates match your criteria.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(a => {
        const hasResume = a.resume_url && a.resume_url !== '--' && a.resume_url.trim() !== '';
        const resumeBtn = hasResume 
            ? `<a href="${a.resume_url}" target="_blank" class="action-icon" style="background: var(--primary-light); color: var(--primary); border: 1px solid var(--primary-light);" title="View Resume"><i class="fa-solid fa-file-pdf"></i> View</a>`
            : `<button class="action-icon" style="background: var(--bg-app); color: var(--text-muted); border: 1px solid var(--border); opacity: 0.5; cursor: not-allowed;" title="No Resume Uploaded"><i class="fa-solid fa-file-pdf"></i> N/A</button>`;

        let statusClass = 'badge-warning';
        if(a.status && a.status.toLowerCase().includes('shortlist') || a.status.toLowerCase().includes('placed')) statusClass = 'badge-success';
        if(a.status && a.status.toLowerCase().includes('reject')) statusClass = 'badge-danger';

        return `
        <tr class="dir-row">
            <td data-label="Candidate Details">
                <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${a.full_name || 'N/A'}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">${a.roll_no || '--'} | ${a.role || 'General App'}</div>
            </td>
            <td data-label="CGPA">
                <span class="badge badge-primary" style="font-size: 0.85rem;">${a.cgpa ? parseFloat(a.cgpa).toFixed(2) : '0.00'}</span>
            </td>
            <td data-label="Department">
                <span class="badge" style="border: 1px solid var(--border);">${a.department || '--'}</span>
            </td>
            <td data-label="Tech / Core">
                <div style="font-size: 0.7rem; font-weight: 700; text-align: right;">
                    <span style="color:var(--primary);">DSA: ${a.tech_dsa || 0}%</span> | 
                    <span style="color:var(--success);">OOP: ${a.tech_oop || 0}%</span><br>
                    <span style="color:#B45309;">CORE: ${a.tech_core || 0}%</span>
                </div>
            </td>
            <td data-label="Resume">
                ${resumeBtn}
            </td>
            <td data-label="Status">
                <span class="badge ${statusClass}">${a.status || 'Pending'}</span>
            </td>
            <td data-label="Actions">
                <div class="flex-center">
                    <button class="action-icon save" onclick="openOfferModal('${a.app_id}', '${a.email}', '${a.role}')" title="Select Candidate & Send Offer">
                        <i class="fa-solid fa-check"></i>
                    </button>
                    <button class="action-icon cancel" onclick="rejectCandidate('${a.app_id}', '${a.email}', '${a.role}')" title="Disqualify/Reject">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

// 6. --- NEW OFFER MODAL & REJECTION LOGIC ---
function openOfferModal(appId, email, role) {
    document.getElementById('offer-appid').value = appId;
    document.getElementById('offer-email').value = email;
    document.getElementById('offer-role').value = role;
    document.getElementById('offer-ctc').value = '';
    document.getElementById('offer-link').value = '';
    document.getElementById('offer-modal').style.display = 'flex';
}

function closeOfferModal() {
    document.getElementById('offer-modal').style.display = 'none';
}

async function submitOffer() {
    const appId = document.getElementById('offer-appid').value;
    const email = document.getElementById('offer-email').value;
    const role = document.getElementById('offer-role').value;
    const ctc = document.getElementById('offer-ctc').value;
    const link = document.getElementById('offer-link').value;

    if(!ctc) return showToast("Please enter the Salary Package.", "danger");

    document.querySelector('#offer-modal .btn-success').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

    try {
        const req = await fetch(`${BASE_URL}/api/hr/update-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                token: hrToken, app_id: appId, status: 'Placed', 
                ctc: ctc, offer_link: link, student_email: email, role: role 
            })
        });
        const data = await req.json();

        if (data.success) {
            showToast("Offer Sent! Student Dashboard Updated.", "success");
            closeOfferModal();
            fetchApplicants(); 
        } else {
            showToast("Failed to process offer.", "danger");
        }
    } catch (e) { showToast("Server error.", "danger"); }
    
    document.querySelector('#offer-modal .btn-success').innerHTML = 'Confirm Placement';
}

async function rejectCandidate(appId, email, role) {
    if(!confirm("Are you sure you want to disqualify this candidate?")) return;
    
    try {
        const req = await fetch(`${BASE_URL}/api/hr/update-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: hrToken, app_id: appId, status: 'Rejected', student_email: email, role: role })
        });
        const data = await req.json();
        if (data.success) {
            showToast("Candidate Rejected.", "danger");
            fetchApplicants();
        }
    } catch(e) { showToast("Error connecting to server.", "danger"); }
}

// 7. Export Data to CSV
function exportToExcel() {
    if(allApplicants.length === 0) return showToast("No data to export.", "danger");

    let csvContent = "data:text/csv;charset=utf-8,Name,Roll No,Email,Department,Role Applied,CGPA,DSA Score,OOP Score,Core Score,Status\n";
    allApplicants.forEach(a => {
        csvContent += `"${a.full_name || ''}","${a.roll_no || ''}","${a.email || ''}","${a.department || ''}","${a.role || ''}","${a.cgpa || '0'}","${a.tech_dsa || '0'}","${a.tech_oop || '0'}","${a.tech_core || '0'}","${a.status || 'Pending'}"\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Candidates_${document.getElementById('hr-company').innerText}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 8. UI Helpers
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('show');
}

function showToast(msg, type = "success") {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    
    const icon = type === 'success' ? '<i class="fa-solid fa-circle-check" style="color:var(--success);"></i>' : '<i class="fa-solid fa-circle-exclamation" style="color:var(--danger);"></i>';
    
    toast.innerHTML = `${icon} <span>${msg}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function signOut() { 
    localStorage.removeItem('hr_session_token'); 
    window.location.href = 'index.html'; 
}