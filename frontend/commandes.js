// page mes commandes — liste les commandes du user, met en évidence celle qui
// vient d'être passée si on arrive avec ?id=ord-xxxx

if (!isLoggedIn()) {
    location.href = './connexion.html'
}

const area = document.getElementById('orders-area')
const sub = document.getElementById('sub')
const highlightId = new URLSearchParams(location.search).get('id')

load()

async function load() {
    area.innerHTML = '<div class="empty-state">chargement…</div>'
    try {
        const list = await api('/orders/me')

        if (list.length === 0) {
            sub.textContent = 'Tu n\'as pas encore passé de commande.'
            area.innerHTML = `
                <div class="empty-state">
                    <p>Aucune commande pour l'instant.</p>
                    <p style="margin-top:18px"><a class="btn" href="./index.html">Voir le catalogue</a></p>
                </div>
            `
            return
        }

        sub.textContent = list.length + ' commande' + (list.length > 1 ? 's' : '') + ' au total'

        area.innerHTML = list.map(o => renderOrder(o)).join('')

        // si on vient de passer une commande, on scroll dessus et on met en valeur
        if (highlightId) {
            const el = document.getElementById('order-' + highlightId)
            if (el) {
                el.classList.add('highlight')
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
        }
    } catch (e) {
        area.innerHTML = '<div class="empty-state">erreur de chargement</div>'
    }
}

function renderOrder(o) {
    const date = new Date(o.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    const time = new Date(o.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    const itemsCount = o.items.reduce((s, i) => s + i.qty, 0)

    return `
        <article class="order-card" id="order-${o.id}">
            <header class="order-head">
                <div>
                    <div class="order-num"># ${o.id}</div>
                    <div class="order-date">${date} à ${time}</div>
                </div>
                <div class="order-status status-${o.status}">${labelStatus(o.status)}</div>
            </header>
            <div class="order-items">
                ${o.items.map(it => `
                    <div class="order-item">
                        <img src="${it.image}" alt="">
                        <div class="order-item-info">
                            <div class="order-item-name">${it.name}</div>
                            <div class="order-item-meta">${it.color} · ${it.size} · x${it.qty}</div>
                        </div>
                        <div class="order-item-price">${formatPrice(it.lineTotal)}</div>
                    </div>
                `).join('')}
            </div>
            <footer class="order-foot">
                <div class="order-totals">
                    <div><span>sous-total</span> <span>${formatPrice(o.subtotal)}</span></div>
                    ${o.discount > 0 ? `<div><span>code ${o.promoCode}</span> <span>-${formatPrice(o.discount)}</span></div>` : ''}
                    <div><span>livraison</span> <span>${o.shippingCost === 0 ? 'offerte' : formatPrice(o.shippingCost)}</span></div>
                    <div class="grand"><span>total</span> <span>${formatPrice(o.total)}</span></div>
                </div>
                <div class="order-shipping">
                    <div class="order-shipping-label">livré à</div>
                    <div>${o.shipping.name}</div>
                    <div>${o.shipping.address}</div>
                    <div>${o.shipping.zip} ${o.shipping.city}, ${o.shipping.country}</div>
                </div>
            </footer>
        </article>
    `
}

function labelStatus(s) {
    if (s === 'pending') return 'en préparation'
    if (s === 'shipped') return 'expédiée'
    if (s === 'delivered') return 'livrée'
    return s
}
