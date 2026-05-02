// page catalogue — récupère la liste produits, gère filtres, tri, pagination

const PAGE_SIZE = 12

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

// si on arrive depuis la barre de recherche du header, on récupère la query et on
// l'injecte dans le filtre search. on l'affiche aussi sur la page.
const initialSearch = new URLSearchParams(location.search).get('search') || ''

let offset = 0
let total = 0

// "voir plus" ajouté en bas de la grille
const moreWrap = document.createElement('div')
moreWrap.className = 'see-more-wrap'
grid.after(moreWrap)

// on garde la liste complète en mémoire entre les "voir plus", c'est plus simple
// et l'API filtre côté serveur, donc pas de duplication
async function loadProducts(reset = true) {
    if (reset) {
        offset = 0
        renderSkeletons()
    }

    const params = new URLSearchParams()
    Object.keys(filterEls).forEach(key => {
        const v = filterEls[key].value
        if (v) params.set(key, v)
    })
    if (initialSearch) params.set('search', initialSearch)
    params.set('limit', PAGE_SIZE)
    params.set('offset', offset)

    try {
        const res = await api('/products?' + params.toString())
        const items = res.items
        total = res.total
        console.log(items.length + ' produits récupérés (' + total + ' au total)')

        if (reset) grid.innerHTML = ''
        renderItems(items)
        offset += items.length
        renderMoreButton(res.hasMore)
        updateCount()
    } catch (e) {
        grid.innerHTML = ''
        moreWrap.innerHTML = ''
        emptyEl.hidden = false
        emptyEl.innerHTML = `<p>Impossible de charger le catalogue.</p><p style="margin-top:8px;color:#6b6357;">L'API est peut-être hors ligne.</p>`
        console.error(e)
    }
}

function renderSkeletons() {
    grid.innerHTML = ''
    moreWrap.innerHTML = ''
    emptyEl.hidden = true
    for (let i = 0; i < 8; i++) {
        const s = document.createElement('div')
        s.className = 'card skeleton'
        s.innerHTML = '<div class="thumb skel"></div><div class="info"><div class="skel-line"></div><div class="skel-line short"></div></div>'
        grid.appendChild(s)
    }
}

function renderItems(list) {
    if (list.length === 0 && offset === 0) {
        emptyEl.hidden = false
        emptyEl.innerHTML = `
            <svg class="empty-art" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="28" cy="28" r="14"></circle>
                <line x1="38" y1="38" x2="50" y2="50"></line>
            </svg>
            <p>Aucun produit ne correspond à ces filtres.</p>
            <p style="margin-top:8px;color:#6b6357;">Essaie d'élargir la sélection ou réinitialise les filtres.</p>
        `
        return
    }
    list.forEach(p => grid.appendChild(buildCard(p)))
}

function renderMoreButton(hasMore) {
    moreWrap.innerHTML = ''
    if (!hasMore) return
    const btn = document.createElement('button')
    btn.className = 'btn btn-outline'
    btn.textContent = 'voir plus'
    btn.addEventListener('click', () => loadProducts(false))
    moreWrap.appendChild(btn)
}

function updateCount() {
    let txt = total + ' produit' + (total > 1 ? 's' : '')
    if (initialSearch) txt += ' pour « ' + initialSearch + ' »'
    countEl.textContent = txt
}

function buildCard(p) {
    const card = document.createElement('a')
    card.className = 'card'
    card.href = './produit.html?id=' + encodeURIComponent(p.id)

    const isDrop = p.price >= 39
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

let priceTimer = null
function debouncedLoad() {
    clearTimeout(priceTimer)
    priceTimer = setTimeout(loadProducts, 250)
}

filterEls.gender.addEventListener('change', () => loadProducts())
filterEls.type.addEventListener('change', () => loadProducts())
filterEls.color.addEventListener('change', () => loadProducts())
filterEls.size.addEventListener('change', () => loadProducts())
filterEls.sort.addEventListener('change', () => loadProducts())
filterEls.minPrice.addEventListener('input', debouncedLoad)
filterEls.maxPrice.addEventListener('input', debouncedLoad)

document.getElementById('reset').addEventListener('click', () => {
    Object.values(filterEls).forEach(el => { el.value = '' })
    // on efface aussi le param search dans l'URL
    if (initialSearch) {
        location.href = './index.html'
    } else {
        loadProducts()
    }
})

// premier chargement
loadProducts()
