// page panier — affichage des lignes, modif qty, suppression, validation

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
            <div class="total"><span class="label">total</span>${formatPrice(total)}</div>
            <button class="btn" id="checkout">Valider la commande</button>
        </div>
    `

    bindRows()
    document.getElementById('checkout').addEventListener('click', checkout)
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

// validation : on décrémente le stock côté API ligne par ligne, puis on vide le panier.
// si une ligne échoue (genre stock insuffisant entre-temps), on affiche l'erreur
// et on laisse le panier en place pour que l'utilisateur puisse ajuster.
async function checkout() {
    const btn = document.getElementById('checkout')
    btn.disabled = true
    btn.textContent = 'Validation…'

    const cart = getCart()
    console.log('checkout', cart.length, 'lignes')
    // ancienne version qui faisait tout en parallèle, mais en cas d'erreur
    // sur une ligne ça décrémentait quand même les autres → on fait en série
    // const promises = cart.map(it => api('/products/'+it.id+'/stock', {...}))
    // await Promise.all(promises)
    try {
        for (const item of cart) {
            await api('/products/' + encodeURIComponent(item.id) + '/stock', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    color: item.color,
                    size: item.size,
                    qty: item.qty
                })
            })
        }
        clearCart()
        showToast('Commande validée, merci !')
        render()
    } catch (e) {
        const msg = e.body && e.body.error ? e.body.error : 'Erreur pendant la validation'
        showToast(msg)
        btn.disabled = false
        btn.textContent = 'Valider la commande'
    }
}
