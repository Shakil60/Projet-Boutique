const express = require('express')
const router = express.Router()

const auth = require('../controller/auth')

router.post('/auth/signup', auth.signup)
router.post('/auth/login', auth.login)
router.get('/auth/me', auth.me)

module.exports = router
