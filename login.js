window.onload = () => {
    // --- NEW CLIENT ID ---
    google.accounts.id.initialize({ client_id: "159246343111-o9bv4lgk1hmmvdkef0qnq0ih9qefjhmj.apps.googleusercontent.com", callback: handleLogin });
    google.accounts.id.renderButton(document.getElementById("g_id_signin"), { theme: "filled_blue", size: "large", shape: "rectangular", width: 280 });

    const savedToken = localStorage.getItem('bit_session_token');
    if (savedToken) {
        document.getElementById('g_id_signin').style.display = 'none';
        const errMsg = document.getElementById('error-msg');
        errMsg.style.color = 'var(--text-main)';
        errMsg.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Authenticating Session...';
        errMsg.style.display = 'block';
        handleLogin({ credential: savedToken });
    }
};

async function handleLogin(response) {
    const globalToken = response.credential;
    const errBox = document.getElementById('error-msg');
    
    try {
        // --- NEW RENDER URL ---
        const req = await fetch('https://portal-6crm.onrender.com/api/auth', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: globalToken })
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
            errBox.style.color = 'var(--danger)'; errBox.innerText = data.message; errBox.style.display = 'block'; 
        }
    } catch (e) {
        localStorage.removeItem('bit_session_token');
        document.getElementById('g_id_signin').style.display = 'block';
        errBox.style.color = 'var(--danger)'; errBox.innerText = "Connection Failed. Check network."; errBox.style.display = 'block'; 
    }
}