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
