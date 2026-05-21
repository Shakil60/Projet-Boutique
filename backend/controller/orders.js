const fs = require('fs')
const path = require('path')

const ordersFile = path.join(__dirname, '..', 'orders.json')
const productsFile = path.join(__dirname, '..', 'data.json')

const SHIPPING_FREE = 50
const SHIPPING_COST = 4.90

function readOrders() {
    return JSON.parse(fs.readFileSync(ordersFile, 'utf8'))
}
function writeOrders(d) {
    fs.writeFileSync(ordersFile, JSON.stringify(d, null, 2), 'utf8')
}
function readProducts() {
    return JSON.parse(fs.readFileSync(productsFile, 'utf8'))
}
function writeProducts(d) {
    fs.writeFileSync(productsFile, JSON.stringify(d, null, 2), 'utf8')
}

// POST /orders - crée une commande à partir du panier reçu
exports.create = function (req, res) {
    const { items, shipping, promoCode } = req.body || {}

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'panier vide' })
    }
    if (!shipping || !shipping.name || !shipping.address || !shipping.zip || !shipping.city || !shipping.email) {
        return res.status(400).json({ error: 'adresse de livraison incomplète' })
    }

    const products = readProducts()
    const lines = []
    let subtotal = 0

    // TODO atomicité : si une ligne foire après les premières, le stock est
    // déjà décrémenté pour celles avant. on accepte le risque pour le rendu.
    for (const it of items) {
        const p = products.products.find(pp => pp.id === it.id)
        if (!p) return res.status(400).json({ error: 'produit introuvable : ' + it.id })

        const variant = p.stock.find(v => v.color === it.color && v.size === it.size)
        if (!variant) return res.status(400).json({ error: 'variante inconnue' })
        if (variant.quantity < it.qty) {
            return res.status(409).json({ error: 'stock insuffisant pour ' + p.name })
        }

        variant.quantity -= it.qty
        const lineTotal = p.price * it.qty
        subtotal += lineTotal
        lines.push({
            productId: p.id,
            name: p.name,
            image: p.images[0],
            color: it.color,
            size: it.size,
            qty: it.qty,
            unitPrice: p.price,
            lineTotal
        })
    }

    writeProducts(products)

    // codes promo en dur (deux pour la démo)
    let discount = 0
    if (promoCode === 'MIRAGE10') discount = subtotal * 0.10
    else if (promoCode === 'WELCOME5') discount = 5

    const shippingCost = subtotal >= SHIPPING_FREE ? 0 : SHIPPING_COST
    const total = (subtotal - discount) + shippingCost

    const order = {
        id: 'ord-' + Date.now(),
        userId: req.user.id,
        items: lines,
        shipping,
        subtotal: Number(subtotal.toFixed(2)),
        discount: Number(discount.toFixed(2)),
        promoCode: discount > 0 ? promoCode : null,
        shippingCost,
        total: Number(total.toFixed(2)),
        status: 'pending',
        createdAt: new Date().toISOString()
    }

    const data = readOrders()
    data.orders.push(order)
    writeOrders(data)

    console.log('commande', order.id, 'créée pour', req.user.email, '- total', order.total)
    res.status(201).json(order)
}

// GET /orders/me - commandes de l'utilisateur connecté
exports.mine = function (req, res) {
    const data = readOrders()
    const list = data.orders
        .filter(o => o.userId === req.user.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    res.json(list)
}

// GET /orders/:id - détail (owner ou admin)
exports.getOne = function (req, res) {
    const data = readOrders()
    const order = data.orders.find(o => o.id === req.params.id)
    if (!order) return res.status(404).json({ error: 'commande introuvable' })
    if (order.userId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'pas autorisé' })
    }
    res.json(order)
}

// GET /orders - admin uniquement
exports.getAll = function (req, res) {
    const data = readOrders()
    res.json(data.orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
}
