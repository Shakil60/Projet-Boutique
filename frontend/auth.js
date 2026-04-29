// gère les pages connexion + inscription. on détecte la page via l'id du form

const loginForm = document.getElementById('login-form')
const signupForm = document.getElementById('signup-form')
const errorEl = document.getElementById('error')

if (loginForm) loginForm.addEventListener('submit', handleLogin)
if (signupForm) signupForm.addEventListener('submit', handleSignup)

// si l'utilisateur est déjà connecté on le renvoie sur le catalogue, pas besoin
// de réafficher un form de login
if (isLoggedIn()) {
    location.href = './index.html'
}

async function handleLogin(e) {
    e.preventDefault()
    hideError()

    const fd = new FormData(loginForm)
    const payload = {
        email: fd.get('email').trim(),
        password: fd.get('password')
    }

    try {
        const res = await api('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        setAuth(res)
        showToast('Connecté')
        // petit délai pour laisser le toast s'afficher avant de rediriger
        setTimeout(() => location.href = './index.html', 400)
    } catch (err) {
        showError(err.body?.error || err.message || 'Connexion impossible')
    }
}

async function handleSignup(e) {
    e.preventDefault()
    hideError()

    const fd = new FormData(signupForm)
    const payload = {
        name: fd.get('name').trim(),
        email: fd.get('email').trim(),
        password: fd.get('password')
    }

    if (payload.password.length < 6) {
        showError('Le mot de passe doit faire au moins 6 caractères')
        return
    }

    try {
        const res = await api('/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        setAuth(res)
        showToast('Compte créé, bienvenue')
        setTimeout(() => location.href = './index.html', 400)
    } catch (err) {
        showError(err.body?.error || err.message || 'Inscription impossible')
    }
}

function showError(msg) {
    errorEl.textContent = msg
    errorEl.hidden = false
}

function hideError() {
    errorEl.textContent = ''
    errorEl.hidden = true
}
