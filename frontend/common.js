// utilitaires partagés entre toutes les pages - panier, favoris, fetch, badges

const API_URL = 'http://localhost:3000'

const CART_KEY = 'mirage_cart'
const FAV_KEY = 'mirage_favs'
const AUTH_KEY = 'mirage_auth'
const THEME_KEY = 'mirage_theme'

// applique le thème dès le tout début (avant DOMContentLoaded), sinon on a un
// flash de blanc pour les utilisateurs en mode sombre
;(function applyThemeEarly() {
    const t = localStorage.getItem(THEME_KEY)
    if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark')
})()

// petit helper fetch qui retourne déjà du JSON, et qui jette si l'API renvoie pas du 2xx
async function api(path, options) {
    options = options || {}
    options.headers = options.headers || {}
    // si on est connecté on glisse le token dans tous les appels, comme ça
    // les routes protégées côté back peuvent reconnaître l'utilisateur
    const auth = getAuth()
    if (auth && auth.token) {
        options.headers['X-User-Id'] = auth.token
    }
    const res = await fetch(API_URL + path, options)
    if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const err = new Error(body.error || 'Erreur API')
        err.status = res.status
        err.body = body
        throw err
    }
    return res.json()
}

// ---- panier ----

function getCart() {
    try {
        const raw = localStorage.getItem(CART_KEY)
        return raw ? JSON.parse(raw) : []
    } catch (e) {
        // au cas ou le localstorage est corrompu, on repart de zero
        return []
    }
}

function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart))
    updateBadges()
}

// retourne la même ligne si on a déjà ce produit dans la même variante
function findCartLine(cart, id, color, size) {
    return cart.find(it => it.id === id && it.color === color && it.size === size)
}

function addToCart(item) {
    const cart = getCart()
    const existing = findCartLine(cart, item.id, item.color, item.size)
    if (existing) {
        existing.qty += item.qty
    } else {
        cart.push(item)
    }
    saveCart(cart)
}

function updateCartQty(id, color, size, qty) {
    const cart = getCart()
    const line = findCartLine(cart, id, color, size)
    if (!line) return
    if (qty <= 0) {
        removeFromCart(id, color, size)
        return
    }
    line.qty = qty
    saveCart(cart)
}

function removeFromCart(id, color, size) {
    let cart = getCart()
    cart = cart.filter(it => !(it.id === id && it.color === color && it.size === size))
    saveCart(cart)
}

function clearCart() {
    saveCart([])
}

function cartCount() {
    return getCart().reduce((s, it) => s + it.qty, 0)
}

function cartTotal() {
    return getCart().reduce((s, it) => s + it.price * it.qty, 0)
}

// ---- favoris ----

function getFavs() {
    try {
        const raw = localStorage.getItem(FAV_KEY)
        return raw ? JSON.parse(raw) : []
    } catch (e) {
        return []
    }
}

function saveFavs(list) {
    localStorage.setItem(FAV_KEY, JSON.stringify(list))
    updateBadges()
}

function isFav(id) {
    return getFavs().includes(id)
}

function toggleFav(id) {
    const favs = getFavs()
    const i = favs.indexOf(id)
    if (i === -1) {
        favs.push(id)
    } else {
        favs.splice(i, 1)
    }
    saveFavs(favs)
    return favs.includes(id)
}

function removeFav(id) {
    const favs = getFavs().filter(f => f !== id)
    saveFavs(favs)
}

function favCount() {
    return getFavs().length
}

// ---- auth ----

function getAuth() {
    try {
        const raw = localStorage.getItem(AUTH_KEY)
        return raw ? JSON.parse(raw) : null
    } catch (e) {
        return null
    }
}

function setAuth(authData) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(authData))
    updateHeaderAuth()
}

function logout() {
    localStorage.removeItem(AUTH_KEY)
    updateHeaderAuth()
    // si on est sur une page protégée (admin / commandes), on ramène à l'accueil
    const protectedPages = ['admin.html', 'commandes.html', 'checkout.html']
    if (protectedPages.some(p => location.pathname.endsWith(p))) {
        location.href = './index.html'
    }
}

function isLoggedIn() {
    return !!getAuth()
}

function isAdmin() {
    const a = getAuth()
    return !!a && a.user && a.user.role === 'admin'
}

function currentUser() {
    const a = getAuth()
    return a ? a.user : null
}

// met à jour le bloc compte/connexion dans le header selon l'état
function updateHeaderAuth() {
    const slot = document.querySelector('[data-auth-slot]')
    if (!slot) return
    const u = currentUser()
    if (u) {
        slot.innerHTML = `
            <a href="./commandes.html" title="${u.name} - voir mes commandes">${u.name.split(' ')[0]}</a>
            ${u.role === 'admin' ? '<a href="./admin.html" class="nav-admin">admin</a>' : ''}
            <button class="nav-logout" data-action="logout">déconnexion</button>
        `
        const btn = slot.querySelector('[data-action="logout"]')
        if (btn) btn.addEventListener('click', logout)
    } else {
        slot.innerHTML = '<a href="./connexion.html">se connecter</a>'
    }
}

// ---- header / badges ----

function updateBadges() {
    const cartBadge = document.querySelector('[data-badge="cart"]')
    const favBadge = document.querySelector('[data-badge="fav"]')

    if (cartBadge) {
        const n = cartCount()
        const prev = parseInt(cartBadge.textContent, 10)
        cartBadge.textContent = n
        cartBadge.classList.toggle('empty', n === 0)
        if (!isNaN(prev) && n > prev) {
            // petit pop quand le compteur grimpe
            cartBadge.classList.remove('pulse')
            void cartBadge.offsetWidth
            cartBadge.classList.add('pulse')
        }
    }
    if (favBadge) {
        const n = favCount()
        favBadge.textContent = n
        favBadge.classList.toggle('empty', n === 0)
    }
}

// ---- helpers généraux ----

function formatPrice(n) {
    // on garde 2 décimales et la virgule à la française
    return n.toFixed(2).replace('.', ',') + ' €'
}

// petit toast en bas de l'écran pour confirmer une action
let toastTimer = null
function showToast(msg) {
    let el = document.querySelector('.toast')
    if (!el) {
        el = document.createElement('div')
        el.className = 'toast'
        document.body.appendChild(el)
    }
    el.textContent = msg
    el.classList.add('show')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200)
}

// ---- recherche header (autocomplete) ----

// on injecte la barre de recherche dans le header de chaque page sans avoir à
// la dupliquer dans tous les .html. plus pratique à maintenir.
function injectSearchBar() {
    const headerInner = document.querySelector('.site-header .inner')
    if (!headerInner || headerInner.querySelector('.header-search')) return

    const wrap = document.createElement('div')
    wrap.className = 'header-search'
    wrap.innerHTML = `
        <input type="search" placeholder="rechercher un design…" data-search-input>
        <div class="search-results" data-search-results hidden></div>
    `
    const brand = headerInner.querySelector('.brand')
    brand.insertAdjacentElement('afterend', wrap)
    wireSearch(wrap)
}

function wireSearch(wrap) {
    const input = wrap.querySelector('[data-search-input]')
    const out = wrap.querySelector('[data-search-results]')
    let timer = null

    input.addEventListener('input', () => {
        clearTimeout(timer)
        const q = input.value.trim()
        if (q.length < 2) {
            out.hidden = true
            out.innerHTML = ''
            return
        }
        timer = setTimeout(() => doSearch(q, out), 250)
    })

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const q = input.value.trim()
            if (q) location.href = './index.html?search=' + encodeURIComponent(q)
        }
        if (e.key === 'Escape') { out.hidden = true; input.blur() }
    })

    // si on clique en dehors on ferme
    document.addEventListener('click', (e) => {
        if (!wrap.contains(e.target)) out.hidden = true
    })
    input.addEventListener('focus', () => {
        if (out.innerHTML) out.hidden = false
    })
}

async function doSearch(q, out) {
    try {
        const list = await api('/products?search=' + encodeURIComponent(q) + '&limit=5')
        const items = Array.isArray(list) ? list : (list.items || [])
        if (items.length === 0) {
            out.innerHTML = '<div class="search-empty">aucun résultat</div>'
        } else {
            out.innerHTML = items.map(p => `
                <a href="./produit.html?id=${encodeURIComponent(p.id)}" class="search-item">
                    <img src="${p.images[0]}" alt="">
                    <div class="search-item-info">
                        <div class="search-item-name">${escapeText(p.name)}</div>
                        <div class="search-item-meta">${p.gender} · ${p.type}</div>
                    </div>
                    <div class="search-item-price">${formatPrice(p.price)}</div>
                </a>
            `).join('') + `
                <a href="./index.html?search=${encodeURIComponent(q)}" class="search-more">voir tous les résultats →</a>
            `
        }
        out.hidden = false
    } catch (e) {
        out.innerHTML = '<div class="search-empty">erreur</div>'
        out.hidden = false
    }
}

// petit helper pour ne pas injecter du HTML brut depuis une recherche
function escapeText(s) {
    const div = document.createElement('div')
    div.textContent = String(s)
    return div.innerHTML
}

// ---- thème (clair / sombre) ----

function getTheme() {
    return localStorage.getItem(THEME_KEY) || 'light'
}

function toggleTheme() {
    const next = getTheme() === 'dark' ? 'light' : 'dark'
    localStorage.setItem(THEME_KEY, next)
    if (next === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark')
    } else {
        document.documentElement.removeAttribute('data-theme')
    }
    updateThemeButton()
}

function injectThemeButton() {
    const headerInner = document.querySelector('.site-header .inner')
    if (!headerInner || headerInner.querySelector('.theme-toggle')) return

    const btn = document.createElement('button')
    btn.className = 'theme-toggle'
    btn.setAttribute('aria-label', 'changer de thème')
    btn.innerHTML = themeIcon()
    btn.addEventListener('click', toggleTheme)

    // on l'ajoute juste avant la nav
    const nav = headerInner.querySelector('.nav')
    nav.insertAdjacentElement('beforebegin', btn)
}

function updateThemeButton() {
    const btn = document.querySelector('.theme-toggle')
    if (btn) btn.innerHTML = themeIcon()
}

function themeIcon() {
    return getTheme() === 'dark'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="18" height="18"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="18" height="18"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>'
}

// au chargement on met les badges à jour, comme ça si on revient sur le site
// avec un panier en cours, le compteur est correct dès la première frame
document.addEventListener('DOMContentLoaded', () => {
    updateBadges()
    updateHeaderAuth()
    injectSearchBar()
    injectThemeButton()
})
