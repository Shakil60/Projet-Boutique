const fs = require('fs')
const path = require('path')

const dataFile = path.join(__dirname, '..', 'data.json')

// petit helper pour relire le fichier à chaque requête, comme ça on a toujours
// l'état à jour si on a touché aux stocks juste avant
function readData() {
    const raw = fs.readFileSync(dataFile, 'utf8')
    return JSON.parse(raw)
}

function writeData(data) {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8')
}

// GET /products — renvoie la liste, avec filtres optionnels en query string
exports.getAll = function (req, res) {
    const data = readData()
    let list = data.products.slice()

    const q = req.query

    if (q.gender) {
        list = list.filter(p => p.gender === q.gender)
    }
    if (q.type) {
        list = list.filter(p => p.type === q.type)
    }
    if (q.color) {
        list = list.filter(p => p.colors.includes(q.color))
    }
    if (q.size) {
        list = list.filter(p => p.sizes.includes(q.size))
    }
    if (q.minPrice) {
        list = list.filter(p => p.price >= Number(q.minPrice))
    }
    if (q.maxPrice) {
        list = list.filter(p => p.price <= Number(q.maxPrice))
    }
    // recherche texte simple sur le nom (utile pour une barre de recherche plus tard)
    if (q.search) {
        const needle = q.search.toLowerCase()
        list = list.filter(p => p.name.toLowerCase().includes(needle))
    }

    // tri
    if (q.sort === 'price_asc') list.sort((a, b) => a.price - b.price)
    else if (q.sort === 'price_desc') list.sort((a, b) => b.price - a.price)
    else if (q.sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name))

    // pagination — si limit est fourni, on renvoie un objet avec total + items + hasMore.
    // sinon on garde le comportement initial (juste un tableau).
    if (q.limit) {
        const limit = Math.max(1, Math.min(100, Number(q.limit)))
        const offset = Math.max(0, Number(q.offset) || 0)
        const total = list.length
        const items = list.slice(offset, offset + limit)
        return res.json({
            items,
            total,
            offset,
            limit,
            hasMore: offset + items.length < total
        })
    }

    res.json(list)
}

// GET /products/:id
exports.getOne = function (req, res) {
    const data = readData()
    const prod = data.products.find(p => p.id === req.params.id)

    if (!prod) {
        return res.status(404).json({ error: 'Produit introuvable' })
    }
    res.json(prod)
}

// GET /products/:id/similar — sortie : 4 produits maxi qui partagent le type
// ou à défaut le gender. On évite de proposer le produit lui-même.
exports.getSimilar = function (req, res) {
    const data = readData()
    const id = req.params.id
    const ref = data.products.find(p => p.id === id)
    if (!ref) {
        return res.status(404).json({ error: 'Produit introuvable' })
    }

    const sameType = data.products.filter(p => p.id !== id && p.type === ref.type)
    let similar = sameType.slice(0, 4)

    // si pas assez, on complète avec des produits du même genre
    if (similar.length < 4) {
        const fallback = data.products.filter(p => {
            return p.id !== id && !similar.includes(p) && p.gender === ref.gender
        })
        similar = similar.concat(fallback).slice(0, 4)
    }

    res.json(similar)
}

// PATCH /products/:id/stock — body : { color, size, qty }
// On retire qty au stock de la variante donnée. Renvoie le stock restant.
exports.updateStock = function (req, res) {
    const data = readData()
    const prod = data.products.find(p => p.id === req.params.id)
    if (!prod) {
        return res.status(404).json({ error: 'Produit introuvable' })
    }

    const { color, size, qty } = req.body
    if (!color || !size || !qty) {
        return res.status(400).json({ error: 'color, size et qty sont requis' })
    }

    const variant = prod.stock.find(v => v.color === color && v.size === size)
    if (!variant) {
        return res.status(400).json({ error: 'Cette variante n\'existe pas' })
    }
    if (variant.quantity < qty) {
        return res.status(400).json({ error: 'Stock insuffisant', remaining: variant.quantity })
    }

    variant.quantity -= qty
    writeData(data)
    console.log('stock maj :', req.params.id, color, size, '->', variant.quantity)

    res.json({ ok: true, remaining: variant.quantity })
}

// ---- routes admin ----

// POST /products — admin seulement
exports.create = function (req, res) {
    const data = readData()
    const body = req.body || {}

    if (!body.id || !body.name || !body.description || !body.price) {
        return res.status(400).json({ error: 'champs manquants (id, name, description, price)' })
    }
    if (data.products.find(p => p.id === body.id)) {
        return res.status(409).json({ error: 'un produit avec cet id existe déjà' })
    }

    // si pas de stock fourni, on en met un vide pour chaque variante
    if (!Array.isArray(body.stock)) {
        body.stock = []
        ;(body.colors || []).forEach(c =>
            (body.sizes || []).forEach(s =>
                body.stock.push({ color: c, size: s, quantity: 0 })
            )
        )
    }
    if (!body.currency) body.currency = 'EUR'

    data.products.push(body)
    writeData(data)
    res.status(201).json(body)
}

// PUT /products/:id — remplace le produit complet (admin)
exports.update = function (req, res) {
    const data = readData()
    const idx = data.products.findIndex(p => p.id === req.params.id)
    if (idx === -1) return res.status(404).json({ error: 'Produit introuvable' })

    const body = req.body || {}
    body.id = req.params.id

    if (!body.name || !body.description || !body.price) {
        return res.status(400).json({ error: 'champs manquants' })
    }

    // si pas de stock dans la maj, on garde celui d'avant
    if (!Array.isArray(body.stock)) body.stock = data.products[idx].stock
    if (!body.currency) body.currency = 'EUR'

    data.products[idx] = body
    writeData(data)
    res.json(body)
}

// DELETE /products/:id — admin
exports.remove = function (req, res) {
    const data = readData()
    const before = data.products.length
    data.products = data.products.filter(p => p.id !== req.params.id)
    if (data.products.length === before) {
        return res.status(404).json({ error: 'Produit introuvable' })
    }
    writeData(data)
    res.json({ ok: true })
}
