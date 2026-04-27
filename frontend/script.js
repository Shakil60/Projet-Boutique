// page catalogue — récupère la liste produits, gère filtres et tri

const grid = document.getElementById('grid')
const emptyEl = document.getElementById('empty')
const countEl = document.getElementById('count')

const filterEls = {
    gender: document.getElementById('f-gender'),
    type: document.getElementById('f-type'),
    color: document.getElementById('f-color'),
    size: document.getElementById('f-size'),
    minPrice: document.getElementById('f-min'),
    maxPrice: document.getElementById('f-max'),
    sort: document.getElementById('f-sort')
}

// on garde la liste complète en mémoire, et on relance simplement un fetch
// quand un filtre change. C'est l'API qui filtre, pas nous, ça fait moins de
// JS côté client à maintenir.
async function loadProducts() {
    const params = new URLSearchParams()
    Object.keys(filterEls).forEach(key => {
        const v = filterEls[key].value
        if (v) params.set(key, v)
    })

    const url = '/products' + (params.toString() ? '?' + params.toString() : '')

    try {
        const list = await api(url)
        console.log(list.length + ' produits récupérés')
        renderGrid(list)
    } catch (e) {
        grid.innerHTML = ''
        emptyEl.hidden = false
        emptyEl.textContent = 'Impossible de charger le catalogue. L\'API est peut-être hors ligne.'
        console.error(e)
    }
}

function renderGrid(list) {
    grid.innerHTML = ''
    if (list.length === 0) {
        emptyEl.hidden = false
        countEl.textContent = ''
        return
    }
    emptyEl.hidden = true
    countEl.textContent = list.length + ' produit' + (list.length > 1 ? 's' : '')

    list.forEach(p => grid.appendChild(buildCard(p)))
}

function buildCard(p) {
    const card = document.createElement('a')
    card.className = 'card'
    card.href = './produit.html?id=' + encodeURIComponent(p.id)

    // on regarde si le produit a un prix de drop limité (39.90 chez nous),
    // pour afficher un petit badge "drop" en surcouche
    const isDrop = p.price >= 39
    // image alt = la 2e si elle existe, sinon on retombe sur la 1re
    const altImg = p.images[1] || p.images[0]

    card.innerHTML = `
        <div class="thumb">
            ${isDrop ? '<span class="badge-drop">drop</span>' : ''}
            <img class="main" src="${p.images[0]}" alt="${p.name}" loading="lazy">
            <img class="alt" src="${altImg}" alt="" loading="lazy">
        </div>
        <div class="info">
            <div class="name">${p.name}</div>
            <div class="meta">${p.gender} · ${p.type}</div>
            <div class="price">${formatPrice(p.price)}</div>
        </div>
    `
    return card
}

// debounce pour les inputs prix, sinon ça refetch à chaque touche tapée
let priceTimer = null
function debouncedLoad() {
    clearTimeout(priceTimer)
    priceTimer = setTimeout(loadProducts, 250)
}

// on branche les listeners
filterEls.gender.addEventListener('change', loadProducts)
filterEls.type.addEventListener('change', loadProducts)
filterEls.color.addEventListener('change', loadProducts)
filterEls.size.addEventListener('change', loadProducts)
filterEls.sort.addEventListener('change', loadProducts)
filterEls.minPrice.addEventListener('input', debouncedLoad)
filterEls.maxPrice.addEventListener('input', debouncedLoad)

document.getElementById('reset').addEventListener('click', () => {
    Object.values(filterEls).forEach(el => { el.value = '' })
    loadProducts()
})

// premier chargement
loadProducts()
