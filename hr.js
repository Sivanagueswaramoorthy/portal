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
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger); padding: 20px;">${data.message || 'No applicants found.'}</td></tr>`;
        }
    } catch(e) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger); padding: 20px;">Server Error. Please refresh.</td></tr>`;
    }
}

// 3. Update Dashboard Stats
function calculateStats(list) {
    document.getElementById('total-count').innerText = list.length;
    const cgpas = list.map(a => parseFloat(a.cgpa) || 0).filter(c => c > 0);
    const avg = cgpas.length ? (cgpas.reduce((a, b) => a + b, 0) / cgpas.length).toFixed(2) : "0.0";
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
        
        const matchesSearch = name.includes(searchTerm) || roll.includes(searchTerm);
        const matchesBranch = (branch === 'all' || a.department === branch);
        const matchesCgpa = (parseFloat(a.cgpa) || 0) >= minCgpa;
        
        return matchesSearch && matchesBranch && matchesCgpa;
    });

    document.getElementById('filtered-count').innerText = filtered.length;
    renderTable(filtered);
}

// 5. Render Table with Database Data
function renderTable(list) {
    const tbody = document.getElementById('hr-applicants-tbody');
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">No candidates match your criteria.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(a => `
        <tr class="dir-row">
            <td>
                <div style="font-weight: 700; color: var(--text-main);">${a.full_name || 'N/A'}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">${a.roll_no || '--'} | ${a.email || '--'}</div>
            </td>
            <td><span class="badge badge-primary">${a.cgpa ? parseFloat(a.cgpa).toFixed(2) : '0.00'}</span></td>
            <td><span class="badge" style="border: 1px solid var(--border);">${a.department || '--'}</span></td>
            <td>
                <div style="font-size: 0.75rem; font-weight: 700;">
                    <span style="color:var(--primary);">DSA: ${a.tech_dsa || 0}%</span><br>
                    <span style="color:var(--success);">OOP: ${a.tech_oop || 0}%</span>
                </div>
            </td>
            <td><span class="badge ${a.status === 'Shortlisted' ? 'badge-success' : 'badge-warning'}">${a.status || 'Pending'}</span></td>
            <td>
                <div class="flex-center">
                    <a href="${a.resume_url || '#'}" target="_blank" class="action-icon" style="background: var(--bg-app); color: var(--primary); border: 1px solid var(--border);" title="View Resume">
                        <i class="fa-solid fa-file-pdf"></i>
                    </a>
                    <button class="action-icon save" onclick="updateStatus('${a.roll_no}', 'Shortlisted')" title="Shortlist Candidate">
                        <i class="fa-solid fa-check"></i>
                    </button>
                    <a href="mailto:${a.email || ''}" class="action-icon cancel" title="Email Candidate">
                        <i class="fa-solid fa-envelope"></i>
                    </a>
                </div>
            </td>
        </tr>`).join('');
}

// 6. Update Shortlist Status to Database
async function updateStatus(rollNo, status) {
    try {
        const req = await fetch(`${BASE_URL}/api/hr/update-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: hrToken, roll_no: rollNo, status: status })
        });
        const data = await req.json();

        if (data.success) {
            showToast(`Candidate ${rollNo} has been ${status}!`, "success");
            fetchApplicants(); // Refresh list from DB
        } else {
            showToast(data.message || "Failed to update status", "danger");
        }
    } catch (e) {
        showToast("Server connection error.", "danger");
    }
}

// 7. Export Data to CSV
function exportToExcel() {
    if(allApplicants.length === 0) return showToast("No data to export.", "danger");

    let csvContent = "data:text/csv;charset=utf-8,Name,Roll No,Email,Department,CGPA,Status\n";
    allApplicants.forEach(a => {
        csvContent += `"${a.full_name}","${a.roll_no}","${a.email}","${a.department}","${a.cgpa}","${a.status}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "BIT_Placement_Applicants.csv");
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