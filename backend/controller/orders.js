const fs = require('fs')
const path = require('path')

const ordersFile = path.join(__dirname, '..', 'orders.json')
const productsFile = path.join(__dirname, '..', 'data.json')

const SHIPPING_FREE_THRESHOLD = 50
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

// validation rapide d'une adresse de livraison
function checkShipping(s) {
    if (!s) return 'adresse manquante'
    const required = ['name', 'address', 'city', 'zip', 'country', 'email']
    for (const k of required) {
        if (!s[k] || String(s[k]).trim() === '') return 'champ ' + k + ' manquant'
    }
    if (!/^.+@.+\..+$/.test(s.email)) return 'email invalide'
    return null
}

// POST /orders — crée une commande à partir du panier qu'on reçoit dans le body
// + adresse de livraison. nécessite d'être connecté.
exports.create = function (req, res) {
    const { items, shipping, promoCode } = req.body || {}

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'panier vide' })
    }
    const shipErr = checkShipping(shipping)
    if (shipErr) return res.status(400).json({ error: shipErr })

    const products = readProducts()
    const enrichedItems = []
    let subtotal = 0

    // 1ère passe — on vérifie chaque ligne avant de toucher au stock
    for (const it of items) {
        const p = products.products.find(pp => pp.id === it.id)
        if (!p) return res.status(400).json({ error: 'produit introuvable : ' + it.id })

        const variant = p.stock.find(v => v.color === it.color && v.size === it.size)
        if (!variant) return res.status(400).json({ error: 'variante inconnue : ' + it.color + ' ' + it.size + ' (' + it.id + ')' })
        if (variant.quantity < it.qty) {
            return res.status(409).json({
                error: 'stock insuffisant pour ' + p.name + ' (' + it.color + ' ' + it.size + ')',
                remaining: variant.quantity
            })
        }

        const lineTotal = p.price * it.qty
        subtotal += lineTotal
        enrichedItems.push({
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

    // appli code promo (très simple, en dur)
    let discount = 0
    if (promoCode === 'MIRAGE10') discount = subtotal * 0.10
    else if (promoCode === 'WELCOME5') discount = 5

    const shippingCost = subtotal >= SHIPPING_FREE_THRESHOLD ? 0 : SHIPPING_COST
    const total = Math.max(0, subtotal - discount) + shippingCost

    // 2nde passe — on décrémente vraiment maintenant qu'on est sûrs
    for (const it of items) {
        const p = products.products.find(pp => pp.id === it.id)
        const variant = p.stock.find(v => v.color === it.color && v.size === it.size)
        variant.quantity -= it.qty
    }
    writeProducts(products)

    const order = {
        id: 'ord-' + Date.now(),
        userId: req.user.id,
        items: enrichedItems,
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

    console.log('commande créée', order.id, 'pour', req.user.email, '— total', order.total)
    res.status(201).json(order)
}

// GET /orders/me — commandes de l'utilisateur connecté
exports.mine = function (req, res) {
    const data = readOrders()
    const list = data.orders
        .filter(o => o.userId === req.user.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    res.json(list)
}

// GET /orders/:id — détail d'une commande (owner ou admin)
exports.getOne = function (req, res) {
    const data = readOrders()
    const order = data.orders.find(o => o.id === req.params.id)
    if (!order) return res.status(404).json({ error: 'commande introuvable' })
    if (order.userId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'pas autorisé' })
    }
    res.json(order)
}

// GET /orders — admin uniquement, toutes les commandes
exports.getAll = function (req, res) {
    const data = readOrders()
    const list = data.orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    res.json(list)
}
