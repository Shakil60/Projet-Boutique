const express = require('express')
const router = express.Router()
const controller = require('../controller/items')

router.get('/', controller.getAllItems)
router.get('/:id', controller.getItemById)

module.exports = router