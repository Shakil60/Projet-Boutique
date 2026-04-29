// utilitaires partagés entre toutes les pages — panier, favoris, fetch, badges

const API_URL = 'http://localhost:3000'

const CART_KEY = 'mirage_cart'
const FAV_KEY = 'mirage_favs'
const AUTH_KEY = 'mirage_auth'

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
            <a href="./compte.html" title="${u.name}">${u.name.split(' ')[0]}</a>
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
        cartBadge.textContent = n
        cartBadge.classList.toggle('empty', n === 0)
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

// au chargement on met les badges à jour, comme ça si on revient sur le site
// avec un panier en cours, le compteur est correct dès la première frame
document.addEventListener('DOMContentLoaded', () => {
    updateBadges()
    updateHeaderAuth()
})
