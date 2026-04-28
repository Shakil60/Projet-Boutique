const express = require('express')
const path = require('path')
const app = express()
const port = 3000

const cors = require('cors')
app.use(cors({ origin: '*' }))

const shopRouter = require('./router/shop')

app.use('/images', express.static(path.join(__dirname, 'static', 'images')))
app.use(express.static(path.join(__dirname, '..', 'frontend')))
app.use('/api/items', shopRouter)

app.listen(port, () => console.log('Server listening on port 3000!'))