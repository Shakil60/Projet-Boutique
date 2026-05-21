// page checkout - formulaire livraison + récap panier + création commande

const area = document.getElementById('checkout-area')

// si pas connecté on redirige sur connexion (avec un retour automatique après login)
if (!isLoggedIn()) {
    location.href = './connexion.html'
}

const cart = getCart()
if (cart.length === 0) {
    area.innerHTML = `
        <div class="empty-state">
            <p>Ton panier est vide.</p>
            <p style="margin-top:18px"><a class="btn" href="./index.html">Voir le catalogue</a></p>
        </div>
    `
} else {
    render()
}

function render() {
    const subtotal = cartTotal()
    const shippingCost = subtotal >= 50 ? 0 : 4.90
    const total = subtotal + shippingCost
    const u = currentUser()

    area.innerHTML = `
        <div class="checkout-grid">
            <form class="auth-form" id="checkout-form" novalidate>
                <h2 class="section-title">Adresse de livraison</h2>
                <div class="form-grid">
                    <label class="full"><span>nom complet</span><input type="text" name="name" value="${u.name}" required></label>
                    <label class="full"><span>email</span><input type="email" name="email" value="${u.email}" required></label>
                    <label class="full"><span>adresse</span><input type="text" name="address" required></label>
                    <label><span>code postal</span><input type="text" name="zip" required></label>
                    <label><span>ville</span><input type="text" name="city" required></label>
                    <label><span>pays</span><input type="text" name="country" value="France" required></label>
                    <label><span>téléphone (facultatif)</span><input type="tel" name="phone"></label>
                </div>

                <h2 class="section-title" style="margin-top:18px">Code promo</h2>
                <div class="promo-row">
                    <input type="text" name="promo" placeholder="ex: MIRAGE10">
                    <span class="promo-hint">essaie <code>MIRAGE10</code> ou <code>WELCOME5</code></span>
                </div>

                <div class="form-error" id="error" hidden></div>
                <button type="submit" class="btn btn-block" id="submit">Passer la commande - ${formatPrice(total)}</button>
            </form>

            <aside class="checkout-summary">
                <h2 class="section-title">Ta commande</h2>
                <div class="summary-list">
                    ${cart.map(it => `
                        <div class="summary-row">
                            <img src="${it.image}" alt="">
                            <div class="summary-info">
                                <div class="summary-name">${it.name}</div>
                                <div class="summary-meta">${it.color} · ${it.size} · x${it.qty}</div>
                            </div>
                            <div class="summary-price">${formatPrice(it.price * it.qty)}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="summary-totals">
                    <div><span>sous-total</span><span>${formatPrice(subtotal)}</span></div>
                    <div><span>livraison</span><span>${shippingCost === 0 ? 'offerte' : formatPrice(shippingCost)}</span></div>
                    <div class="grand"><span>total</span><span>${formatPrice(total)}</span></div>
                </div>
            </aside>
        </div>
    `

    document.getElementById('checkout-form').addEventListener('submit', onSubmit)
}

async function onSubmit(e) {
    e.preventDefault()
    const form = e.target
    const fd = new FormData(form)
    const errEl = document.getElementById('error')
    const btn = document.getElementById('submit')

    const shipping = {
        name: fd.get('name').trim(),
        email: fd.get('email').trim(),
        address: fd.get('address').trim(),
        zip: fd.get('zip').trim(),
        city: fd.get('city').trim(),
        country: fd.get('country').trim(),
        phone: fd.get('phone').trim()
    }
    const promoCode = (fd.get('promo') || '').trim().toUpperCase() || null

    btn.disabled = true
    btn.textContent = 'Validation…'
    errEl.hidden = true

    try {
        const order = await api('/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: cart.map(it => ({ id: it.id, color: it.color, size: it.size, qty: it.qty })),
                shipping,
                promoCode
            })
        })
        clearCart()
        showToast('Commande passée - merci !')
        setTimeout(() => location.href = './commandes.html?id=' + order.id, 600)
    } catch (err) {
        const msg = err.body?.error || err.message || 'erreur de validation'
        errEl.textContent = msg
        errEl.hidden = false
        btn.disabled = false
        btn.textContent = 'Réessayer'
    }
}
