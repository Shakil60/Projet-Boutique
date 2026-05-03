const express = require('express')
const router = express.Router()

const orders = require('../controller/orders')
const auth = require('../controller/auth')

// toutes ces routes nécessitent d'être connecté
router.post('/orders', auth.requireAuth, orders.create)
router.get('/orders/me', auth.requireAuth, orders.mine)
router.get('/orders/:id', auth.requireAuth, orders.getOne)

// admin seulement
router.get('/orders', auth.requireAdmin, orders.getAll)

module.exports = router
