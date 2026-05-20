// page produit — détail, carrousel, variantes, ajout panier, similaires

const root = document.getElementById('root')
const similarSection = document.getElementById('similar-section')
const similarGrid = document.getElementById('similar-grid')

const productId = new URLSearchParams(location.search).get('id')

// état local de la page : sélection en cours de l'utilisateur
const state = {
    product: null,
    selectedColor: null,
    selectedSize: null,
    qty: 1,
    slide: 0,
    descExpanded: false
}

if (!productId) {
    root.innerHTML = '<p class="empty-state">Aucun produit demandé.</p>'
} else {
    loadProduct()
}

async function loadProduct() {
    try {
        const p = await api('/products/' + encodeURIComponent(productId))
        console.log('produit', p.id)
        state.product = p
        // par défaut on présélectionne la première couleur dispo
        state.selectedColor = p.colors[0]
        state.selectedSize = null
        render()
        loadSimilar()
    } catch (e) {
        if (e.status === 404) {
            root.innerHTML = '<p class="empty-state">Produit introuvable.</p>'
        } else {
            root.innerHTML = '<p class="empty-state">Erreur de chargement.</p>'
            console.error(e)
        }
    }
}

async function loadSimilar() {
    try {
        const list = await api('/products/' + encodeURIComponent(productId) + '/similar')
        if (list.length === 0) return
        similarSection.hidden = false
        similarGrid.innerHTML = ''
        list.forEach(p => similarGrid.appendChild(buildSimilarCard(p)))
    } catch (e) {
        // les similaires c'est pas critique, on n'affiche rien si ça échoue
    }
}

function buildSimilarCard(p) {
    const card = document.createElement('a')
    card.className = 'card'
    card.href = './produit.html?id=' + encodeURIComponent(p.id)
    const altImg = p.images[1] || p.images[0]
    card.innerHTML = `
        <div class="thumb">
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

// --- rendu principal ---

function render() {
    const p = state.product

    // description tronquée à 150 caractères, comme demandé dans l'énoncé
    let desc = p.description
    let toggleBtn = ''
    if (desc.length > 150 && !state.descExpanded) {
        desc = desc.slice(0, 150).trimEnd() + '…'
        toggleBtn = '<button class="desc-toggle" id="desc-toggle">voir plus</button>'
    } else if (state.descExpanded) {
        toggleBtn = '<button class="desc-toggle" id="desc-toggle">réduire</button>'
    }

    root.innerHTML = `
        <div class="product">
            <div class="carousel" id="carousel">
                ${p.images.map((src, i) => `
                    <div class="slide ${i === state.slide ? 'active' : ''}">
                        <img src="${src}" alt="${p.name} ${i + 1}">
                    </div>
                `).join('')}
                ${p.images.length > 1 ? `
                    <button class="nav-btn prev" id="prev" aria-label="précédent">‹</button>
                    <button class="nav-btn next" id="next" aria-label="suivant">›</button>
                    <div class="dots">
                        ${p.images.map((_, i) => `<span class="dot ${i === state.slide ? 'active' : ''}" data-slide="${i}"></span>`).join('')}
                    </div>
                ` : ''}
            </div>

            <div class="product-info">
                <h1>${p.name}</h1>
                <div class="meta-row">${p.gender} · ${p.type} · ${p.fit} · ${p.material}</div>
                <div class="price-big">${formatPrice(p.price)}</div>

                <p class="desc">${escapeHtml(desc)} ${toggleBtn}</p>

                <div class="variant-group">
                    <div class="label">Couleur — <strong>${state.selectedColor}</strong></div>
                    <div class="colors">
                        ${p.colors.map(c => `
                            <button class="swatch ${c === state.selectedColor ? 'selected' : ''}" data-color="${c}" aria-label="${c}"></button>
                        `).join('')}
                    </div>
                </div>

                <div class="variant-group">
                    <div class="label">Taille</div>
                    <div class="sizes">
                        ${p.sizes.map(s => {
                            const variant = p.stock.find(v => v.color === state.selectedColor && v.size === s)
                            const out = !variant || variant.quantity === 0
                            const sel = state.selectedSize === s
                            return `<button class="size-btn ${sel ? 'selected' : ''}" data-size="${s}" ${out ? 'disabled' : ''}>${s}</button>`
                        }).join('')}
                    </div>
                </div>

                <div class="qty-row">
                    <label for="qty" class="label" style="text-transform:uppercase;letter-spacing:1.5px;font-size:12px;color:#6b6357;">Quantité</label>
                    <input type="number" id="qty" min="1" value="${state.qty}" aria-label="quantité">
                </div>

                <div class="actions">
                    <button class="btn" id="add-cart">Ajouter au panier</button>
                    <button class="fav-btn ${isFav(p.id) ? 'active' : ''}" id="fav">
                        ${isFav(p.id) ? '★ Retirer des favoris' : '☆ Ajouter aux favoris'}
                    </button>
                </div>

                <div class="stock-info" id="stock-info"></div>
            </div>
        </div>
    `

    bindEvents()
    refreshStockInfo()
}

function bindEvents() {
    // carrousel
    const prev = document.getElementById('prev')
    const next = document.getElementById('next')
    if (prev) prev.addEventListener('click', () => slideTo(state.slide - 1))
    if (next) next.addEventListener('click', () => slideTo(state.slide + 1))
    document.querySelectorAll('.dot').forEach(d => {
        d.addEventListener('click', () => slideTo(Number(d.dataset.slide)))
    })

    // variantes
    document.querySelectorAll('.swatch').forEach(btn => {
        btn.addEventListener('click', () => {
            state.selectedColor = btn.dataset.color
            // si la taille déjà choisie n'est plus dispo dans la nouvelle couleur, on la décoche
            const variant = state.product.stock.find(v => v.color === state.selectedColor && v.size === state.selectedSize)
            if (!variant || variant.quantity === 0) state.selectedSize = null
            render()
        })
    })
    document.querySelectorAll('.size-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return
            state.selectedSize = btn.dataset.size
            render()
        })
    })

    // qty
    const qtyInput = document.getElementById('qty')
    qtyInput.addEventListener('input', () => {
        const v = parseInt(qtyInput.value, 10)
        state.qty = isNaN(v) || v < 1 ? 1 : v
        refreshStockInfo()
    })

    // toggle description
    const toggle = document.getElementById('desc-toggle')
    if (toggle) {
        toggle.addEventListener('click', () => {
            state.descExpanded = !state.descExpanded
            render()
        })
    }

    // ajout panier
    document.getElementById('add-cart').addEventListener('click', onAddCart)

    // favoris
    document.getElementById('fav').addEventListener('click', () => {
        const nowFav = toggleFav(state.product.id)
        showToast(nowFav ? 'Ajouté aux favoris' : 'Retiré des favoris')
        render()
    })
}

function slideTo(i) {
    const total = state.product.images.length
    // wrap autour pour revenir au début si on dépasse
    // TODO le carrousel saute parfois sur safari ios, à voir
    if (i < 0) i = total - 1
    if (i >= total) i = 0
    state.slide = i
    document.querySelectorAll('.slide').forEach((el, idx) => {
        el.classList.toggle('active', idx === i)
    })
    document.querySelectorAll('.dot').forEach((el, idx) => {
        el.classList.toggle('active', idx === i)
    })
}

function refreshStockInfo() {
    const el = document.getElementById('stock-info')
    if (!el) return
    if (!state.selectedSize) {
        el.textContent = ''
        el.className = 'stock-info'
        return
    }
    const variant = state.product.stock.find(v => v.color === state.selectedColor && v.size === state.selectedSize)
    const remaining = variant ? variant.quantity : 0
    if (remaining === 0) {
        el.textContent = 'rupture'
        el.className = 'stock-info out'
    } else if (remaining < 5) {
        el.textContent = 'plus que ' + remaining + ' en stock'
        el.className = 'stock-info warn'
    } else {
        el.textContent = remaining + ' disponibles'
        el.className = 'stock-info'
    }
}

function onAddCart() {
    if (!state.selectedSize) {
        showToast('Choisis une taille')
        return
    }
    const p = state.product
    const variant = p.stock.find(v => v.color === state.selectedColor && v.size === state.selectedSize)
    if (!variant || variant.quantity < state.qty) {
        showToast('Stock insuffisant')
        return
    }

    addToCart({
        id: p.id,
        name: p.name,
        image: p.images[0],
        price: p.price,
        currency: p.currency,
        color: state.selectedColor,
        size: state.selectedSize,
        qty: state.qty
    })
    showToast('Ajouté au panier')
}

// échappe le HTML pour éviter qu'une description avec un guillemet bizarre casse l'affichage
// note : on utilise .replace avec regex au lieu de .replaceAll, sinon ça plante sur safari ios un peu vieux
function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
}
