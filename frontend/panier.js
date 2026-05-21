// page panier - affichage des lignes, modif qty, suppression, validation

const area = document.getElementById('cart-area')
const sub = document.getElementById('sub')

render()

function render() {
    const cart = getCart()

    if (cart.length === 0) {
        sub.textContent = 'Ton panier est vide pour l\'instant.'
        area.innerHTML = `
            <div class="empty-state">
                <p>Pas encore d'articles dans le panier.</p>
                <p style="margin-top:18px"><a class="btn" href="./index.html">Voir le catalogue</a></p>
            </div>
        `
        return
    }

    sub.textContent = cart.length + ' ligne' + (cart.length > 1 ? 's' : '') + ' dans le panier'

    const rowsHtml = cart.map((it, idx) => `
        <div class="cart-row" data-idx="${idx}">
            <div class="thumb"><img src="${it.image}" alt=""></div>
            <div>
                <div class="name">${it.name}</div>
                <div class="variant">${it.color} · ${it.size}</div>
                <div class="variant" style="margin-top:4px">${formatPrice(it.price)} l'unité</div>
            </div>
            <div class="qty">
                <input type="number" min="1" value="${it.qty}" data-action="qty">
            </div>
            <div class="line-total">${formatPrice(it.price * it.qty)}</div>
            <button class="remove" data-action="remove">retirer</button>
        </div>
    `).join('')

    const total = cartTotal()

    area.innerHTML = `
        <div class="cart-list">${rowsHtml}</div>
        <div class="cart-summary">
            <div class="total"><span class="label">sous-total</span>${formatPrice(total)}</div>
            <a class="btn" href="./checkout.html">passer la commande →</a>
        </div>
    `

    bindRows()
}

function bindRows() {
    document.querySelectorAll('.cart-row').forEach(row => {
        const idx = Number(row.dataset.idx)
        const cart = getCart()
        const item = cart[idx]
        if (!item) return

        // changement de qty
        row.querySelector('[data-action="qty"]').addEventListener('change', (e) => {
            const v = parseInt(e.target.value, 10)
            const qty = isNaN(v) || v < 1 ? 1 : v
            updateCartQty(item.id, item.color, item.size, qty)
            render()
        })

        // suppression
        row.querySelector('[data-action="remove"]').addEventListener('click', () => {
            removeFromCart(item.id, item.color, item.size)
            showToast('Article retiré')
            render()
        })
    })
}

// note : la validation effective est passée dans la page checkout, ici on garde
// juste l'affichage du panier et le bouton qui redirige vers checkout.html.
