const BASE_URL = 'https://portal-6crm.onrender.com';

window.onload = () => {
    google.accounts.id.initialize({ 
        client_id: "159246343111-o9bv4lgk1hmmvdkef0qnq0ih9qefjhmj.apps.googleusercontent.com", 
        callback: handleLogin
    });
    
    google.accounts.id.renderButton(
        document.getElementById("g_id_signin"), 
        { theme: "outline", size: "large", shape: "rectangular", width: "100%", logo_alignment: "center", text: "continue_with" }
    );

    const savedToken = localStorage.getItem('bit_session_token');
    const pcdpToken = localStorage.getItem('pcdp_session_token');

    // Safe session restore
    if (pcdpToken) { window.location.href = 'pcdp_control.html'; return; }
    if (savedToken) {
        document.getElementById('g_id_signin').style.display = 'none';
        showError("Authenticating your secure session...", true);
        handleLogin({ credential: savedToken });
    }

    const loginForm = document.getElementById('traditional-login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault(); 
            const email = document.getElementById('email').value.trim();
            const pass = document.getElementById('password').value.trim();

            showError("Verifying Credentials. Please wait...", true);

            try {
                const req = await fetch(`${BASE_URL}/api/hr/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email, password: pass })
                });

                if (!req.ok) throw new Error("Server rejected request.");
                const data = await req.json();

                if (data.success) {
                    showSuccess(`Verified! Opening ${data.redirect}...`);
                    
                    if (data.redirect === 'pcdp_control.html') {
                        localStorage.setItem('pcdp_session_token', data.token);
                    } else {
                        localStorage.setItem('bit_session_token', data.token); 
                    }
                    setTimeout(() => { window.location.href = data.redirect; }, 500);
                } else {
                    showError(data.message || "Invalid Email or Password.");
                }
            } catch(err) {
                showError("Backend server is waking up (takes ~30s on free tier). Please wait and try again.", true);
            }
        });
    }
};

function togglePass() {
    const passInput = document.getElementById("password");
    const passIcon = document.getElementById("togglePassword");
    if (passInput.type === "password") { passInput.type = "text"; passIcon.classList.remove("fa-eye"); passIcon.classList.add("fa-eye-slash"); } 
    else { passInput.type = "password"; passIcon.classList.remove("fa-eye-slash"); passIcon.classList.add("fa-eye"); }
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
            if (data.redirect === 'pcdp_control.html') {
                localStorage.setItem('pcdp_session_token', globalToken);
            } else {
                localStorage.setItem('bit_session_token', globalToken);
            }
            window.location.href = data.redirect; // 🛑 STRICT ROUTING
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

function showError(message, isWorking = false) {
    const errBox = document.getElementById('error-msg');
    if(!errBox) return;
    errBox.style.display = 'flex';
    if (isWorking) {
        errBox.style.background = '#F8FAFC'; errBox.style.color = '#0F172A'; errBox.style.borderColor = '#E2E8F0';
        errBox.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>${message}</span>`;
    } else {
        errBox.style.background = '#FEF2F2'; errBox.style.color = '#EF4444'; errBox.style.borderColor = '#FECACA';
        errBox.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> <span>${message}</span>`;
    }
}

function showSuccess(message) {
    const errBox = document.getElementById('error-msg');
    if(!errBox) return;
    errBox.style.display = 'flex'; errBox.style.background = '#ECFDF5'; errBox.style.color = '#10B981'; errBox.style.borderColor = '#A7F3D0';
    errBox.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>${message}</span>`;
}