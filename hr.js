let allApplicants = []; 

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
            document.getElementById('stat-total').innerText = allApplicants.length;
            applyFilters(); // Initial render
        }
    } catch(e) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Failed to load data.</td></tr>`;
    }
}

function applyFilters() {
    const searchTerm = document.getElementById('nameSearch').value.toLowerCase();
    const branch = document.getElementById('branchFilter').value;
    const minCgpa = parseFloat(document.getElementById('cgpaRange').value);
    
    // Update Labels
    document.getElementById('cgpaLabel').innerText = minCgpa.toFixed(1);
    document.getElementById('stat-min-cgpa').innerText = minCgpa.toFixed(1);

    const filtered = allApplicants.filter(a => {
        const matchesSearch = a.full_name.toLowerCase().includes(searchTerm) || 
                              a.roll_no.includes(searchTerm) || 
                              a.role.toLowerCase().includes(searchTerm);
        const matchesBranch = (branch === 'all' || a.department === branch);
        const matchesCgpa = (parseFloat(a.cgpa) || 0) >= minCgpa;

        return matchesSearch && matchesBranch && matchesCgpa;
    });

    document.getElementById('stat-filtered').innerText = filtered.length;
    renderTable(filtered);
}

function renderTable(list) {
    const tbody = document.getElementById('hr-applicants-tbody');
    if(list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:50px;">No candidates match these filters.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(a => `
        <tr class="dir-row">
            <td>
                <div style="font-weight:700;">${a.full_name}</div>
                <div style="font-size:0.75rem; color:var(--text-muted);">${a.department} | ${a.role}</div>
            </td>
            <td><span class="cgpa-badge">${a.cgpa || '0.0'}</span></td>
            <td>
                <span style="color:var(--primary); font-weight:600;">DSA: ${a.tech_dsa}%</span><br>
                <span style="color:var(--success); font-size:0.8rem;">OOP: ${a.tech_oop}%</span>
            </td>
            <td><span class="status-pill status-${a.status.toLowerCase()}">${a.status}</span></td>
            <td>
                <div style="display:flex; gap:8px;">
                    <a href="${a.resume_url}" target="_blank" class="icon-btn" style="color:var(--primary);" title="View Resume">
                        <i class="fa-solid fa-file-pdf"></i>
                    </a>
                    <button class="icon-btn" style="color:var(--success);" onclick="updateStatus('${a.id}', 'Shortlisted')" title="Shortlist">
                        <i class="fa-solid fa-check-circle"></i>
                    </button>
                    <button class="icon-btn" style="color:var(--danger);" onclick="sendEmail('${a.email}')" title="Email Candidate">
                        <i class="fa-solid fa-envelope"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Simple CSV Export Function
function exportToExcel() {
    let csvContent = "data:text/csv;charset=utf-8,Name,Roll No,Department,CGPA,Status\n";
    allApplicants.forEach(a => {
        csvContent += `${a.full_name},${a.roll_no},${a.department},${a.cgpa},${a.status}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "placement_applicants.csv");
    document.body.appendChild(link);
    link.click();
}

function sendEmail(email) {
    window.location.href = `mailto:${email}?subject=Placement Interview Invitation&body=Dear Student, you have been invited for an interview...`;
}