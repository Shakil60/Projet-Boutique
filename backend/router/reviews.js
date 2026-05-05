const express = require('express')
const router = express.Router()

const reviews = require('../controller/reviews')
const auth = require('../controller/auth')

router.get('/products/:id/reviews', reviews.list)
router.post('/products/:id/reviews', auth.requireAuth, reviews.create)

module.exports = router
