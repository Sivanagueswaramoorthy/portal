// 🛑 FORCED LIVE SERVER: This tells your local computer AND GitHub to always use the live Render backend.
const BASE_URL = 'https://portal-6crm.onrender.com';

window.onload = () => {
    // Initialize Google Auth (Students & Admin)
    google.accounts.id.initialize({ 
        client_id: "159246343111-o9bv4lgk1hmmvdkef0qnq0ih9qefjhmj.apps.googleusercontent.com", 
        callback: handleLogin
    });
    
    google.accounts.id.renderButton(
        document.getElementById("g_id_signin"), 
        { theme: "outline", size: "large", shape: "rectangular", width: "100%", logo_alignment: "center", text: "continue_with" }
    );

    const savedToken = localStorage.getItem('bit_session_token');
    const hrToken = localStorage.getItem('hr_session_token');
    const pcdpToken = localStorage.getItem('pcdp_session_token');

    // 🛑 Check for existing sessions
    if (pcdpToken) { 
        window.location.href = 'pcdp_control.html'; 
        return; 
    }
    if (hrToken) {
        window.location.href = 'hr.html';
        return;
    } else if (savedToken) {
        document.getElementById('g_id_signin').style.display = 'none';
        showError("Authenticating your secure session...", true);
        handleLogin({ credential: savedToken });
    }

    // Traditional Manual Login Form
    const loginForm = document.getElementById('traditional-login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault(); 
            
            const email = document.getElementById('email').value.trim();
            const pass = document.getElementById('password').value.trim();
            
            // 🛑 Intercept PCDP Manual Login
            if (email === 'pcdp@gmail.com' && pass === 'pcdp@123') {
                localStorage.setItem('pcdp_session_token', 'pcdp_admin_authorized_token_7771');
                showSuccess("PCDP Access Verified! Opening Control Center...");
                setTimeout(() => { window.location.href = 'pcdp_control.html'; }, 500);
                return;
            }

            showError("Verifying Credentials. Please wait...", true);

            try {
                // Send to the unified HR/Coordinator login route
                const req = await fetch(`${BASE_URL}/api/hr/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email, password: pass })
                });

                if (!req.ok) throw new Error("Server rejected request.");

                const data = await req.json();

                if (data.success) {
                    // 🛑 NEW LOGIC: Check where the server wants to redirect us
                    if (data.redirect === 'placement_hub.html') {
                        // It's the Coordinator
                        localStorage.setItem('bit_session_token', data.token); 
                        showSuccess("Coordinator Verified! Opening Placement Hub...");
                        setTimeout(() => { window.location.href = data.redirect; }, 500);
                    } else {
                        // It's a Trainer (HR)
                        localStorage.setItem('hr_session_token', data.token); 
                        showSuccess("Trainer Verified! Opening Training Portal...");
                        setTimeout(() => { window.location.href = data.redirect || 'hr.html'; }, 500);
                    }
                } else {
                    showError(data.message || "Invalid Email or Password.");
                }
            } catch(err) {
                console.error(err);
                showError("Backend server is waking up (takes ~30s on free tier). Please wait and try again.", true);
            }
        });
    }
};

function togglePass() {
    const passInput = document.getElementById("password");
    const passIcon = document.getElementById("togglePassword");
    
    if (passInput.type === "password") {
        passInput.type = "text";
        passIcon.classList.remove("fa-eye");
        passIcon.classList.add("fa-eye-slash");
    } else {
        passInput.type = "password";
        passIcon.classList.remove("fa-eye-slash");
        passIcon.classList.add("fa-eye");
    }
}

async function handleLogin(response) {
    const globalToken = response.credential;
    showError("Connecting to live server, please wait...", true);

    try {
        const req = await fetch(`${BASE_URL}/api/auth`, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ token: globalToken })
        });
        const data = await req.json();

        if (data.success) {
            localStorage.setItem('bit_session_token', globalToken);
            if (data.isAdmin) {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'student.html';
            }
        } else {
            localStorage.removeItem('bit_session_token');
            document.getElementById('g_id_signin').style.display = 'block';
            showError(data.message);
        }
    } catch (e) {
        localStorage.removeItem('bit_session_token');
        document.getElementById('g_id_signin').style.display = 'block';
        showError("Server is waking up from sleep. Please try logging in again in 10 seconds.", true);
    }
}

// UI Helper Functions
function showError(message, isWorking = false) {
    const errBox = document.getElementById('error-msg');
    errBox.style.display = 'flex';
    
    if (isWorking) {
        errBox.style.background = '#F8FAFC';
        errBox.style.color = '#0F172A';
        errBox.style.borderColor = '#E2E8F0';
        errBox.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>${message}</span>`;
    } else {
        errBox.style.background = '#FEF2F2';
        errBox.style.color = '#EF4444';
        errBox.style.borderColor = '#FECACA';
        errBox.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> <span>${message}</span>`;
    }
}

function showSuccess(message) {
    const errBox = document.getElementById('error-msg');
    errBox.style.display = 'flex';
    errBox.style.background = '#ECFDF5';
    errBox.style.color = '#10B981';
    errBox.style.borderColor = '#A7F3D0';
    errBox.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>${message}</span>`;
}