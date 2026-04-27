const express = require('express')
const cors = require('cors')

const app = express()
const port = 3000

app.use(cors({ origin: '*' }))
app.use(express.json())

const shopRouter = require('./router/shop')
app.use(shopRouter)

app.listen(port, () => {
    console.log('API MIRAGE en ligne sur le port ' + port)
})
