// SMART URL: Auto-detects if you are testing locally or on live GitHub Pages!
const BASE_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') 
    ? 'http://localhost:10000' 
    : 'https://portal-6crm.onrender.com';

window.onload = () => {
    google.accounts.id.initialize({ 
        client_id: "159246343111-o9bv4lgk1hmmvdkef0qnq0ih9qefjhmj.apps.googleusercontent.com", 
        callback: handleLogin
    });
    
    google.accounts.id.renderButton(
        document.getElementById("g_id_signin"), 
        { theme: "outline", size: "large", shape: "rectangular", width: 380, logo_alignment: "center", text: "continue_with" }
    );

    const savedToken = localStorage.getItem('bit_session_token');
    const hrToken = localStorage.getItem('hr_session_token');

    if (hrToken) {
        window.location.href = 'hr.html';
        return;
    } else if (savedToken) {
        document.getElementById('g_id_signin').style.display = 'none';
        document.getElementById('error-msg').style.display = 'block';
        document.getElementById('error-msg').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Authenticating Session...';
        handleLogin({ credential: savedToken });
    }

    const loginForm = document.getElementById('traditional-login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault(); 
            
            const email = document.getElementById('email').value.trim();
            const pass = document.getElementById('password').value.trim();
            const errBox = document.getElementById('error-msg');
            
            errBox.style.display = 'block';
            errBox.style.color = '#0F172A';
            errBox.style.background = '#F8FAFC';
            errBox.style.borderColor = '#E2E8F0';
            errBox.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying HR Credentials...';

            try {
                const req = await fetch(`${BASE_URL}/api/hr/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email, password: pass })
                });

                if (!req.ok) throw new Error("Server rejected request.");

                const data = await req.json();

                if (data.success) {
                    localStorage.setItem('hr_session_token', data.token); 
                    errBox.innerHTML = '<i class="fa-solid fa-check"></i> Login Successful! Redirecting...';
                    errBox.style.color = '#10B981';
                    errBox.style.background = '#ECFDF5';
                    setTimeout(() => { window.location.href = 'hr.html'; }, 500);
                } else {
                    errBox.style.color = '#EF4444'; 
                    errBox.style.background = '#FEF2F2';
                    errBox.innerText = data.message || "Invalid Email or Password.";
                }
            } catch(err) {
                console.error(err);
                errBox.style.color = '#EF4444'; 
                errBox.style.background = '#FEF2F2';
                errBox.innerHTML = "<b>Connection Failed.</b> Ensure backend is running!";
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
    const errBox = document.getElementById('error-msg');

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
            errBox.style.color = '#EF4444'; 
            errBox.style.background = '#FEF2F2';
            errBox.innerText = data.message; 
            errBox.style.display = 'block'; 
        }
    } catch (e) {
        localStorage.removeItem('bit_session_token');
        document.getElementById('g_id_signin').style.display = 'block';
        errBox.style.color = '#EF4444'; 
        errBox.style.background = '#FEF2F2';
        errBox.innerText = "Connection Failed. Backend sleeping, try again in 1 minute."; 
        errBox.style.display = 'block'; 
    }
}