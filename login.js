window.onload = () => {
    google.accounts.id.initialize({ 
        client_id: "159246343111-o9bv4lgk1hmmvdkef0qnq0ih9qefjhmj.apps.googleusercontent.com", 
        callback: handleLogin,
        hosted_domain: "bitsathy.ac.in" 
    });
    
    google.accounts.id.renderButton(
        document.getElementById("g_id_signin"), 
        { theme: "outline", size: "large", shape: "rectangular", width: 380, logo_alignment: "center" }
    );

    const savedToken = localStorage.getItem('bit_session_token');
    if (savedToken) {
        document.getElementById('g_id_signin').style.display = 'none';
        const errMsg = document.getElementById('error-msg');
        errMsg.style.color = '#0F172A';
        errMsg.style.background = '#F8FAFC';
        errMsg.style.borderColor = '#E2E8F0';
        errMsg.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Authenticating Session...';
        errMsg.style.display = 'block';
        handleLogin({ credential: savedToken });
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
    errBox.style.display = 'none'; 

    try {
        const req = await fetch('https://portal-6crm.onrender.com/api/auth', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ token: globalToken })
        });
        const data = await req.json();

        if (data.success) {
            localStorage.setItem('bit_session_token', globalToken);
            if (data.isAdmin) {
                window.location.href = 'admin.html';
            } else if (data.isHR) {
                window.location.href = 'hr.html';
            } else {
                window.location.href = 'student.html';
            }
        } else {
            localStorage.removeItem('bit_session_token');
            document.getElementById('g_id_signin').style.display = 'block';
            errBox.style.color = '#EF4444'; 
            errBox.style.background = '#FEF2F2';
            errBox.style.borderColor = '#FECACA';
            errBox.innerText = data.message || "Session expired. Please sign in again."; 
            errBox.style.display = 'block'; 
        }
    } catch (e) {
        localStorage.removeItem('bit_session_token');
        document.getElementById('g_id_signin').style.display = 'block';
        errBox.style.color = '#EF4444'; 
        errBox.style.background = '#FEF2F2';
        errBox.style.borderColor = '#FECACA';
        errBox.innerText = "Connection Failed. Backend might be sleeping, try again in 1 minute."; 
        errBox.style.display = 'block'; 
    }
}