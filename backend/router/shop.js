const express = require('express')
const router = express.Router()

const shop = require('../controller/shop')

// liste des produits, avec filtres et tri en query string
router.get('/products', shop.getAll)

// détail d'un seul produit par son id
router.get('/products/:id', shop.getOne)

// produits similaires (même type ou même gender)
router.get('/products/:id/similar', shop.getSimilar)

// MAJ du stock d'une variante après un achat
router.patch('/products/:id/stock', shop.updateStock)

module.exports = router
