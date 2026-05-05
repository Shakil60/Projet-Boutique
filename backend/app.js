const express = require('express')
const cors = require('cors')

const app = express()
const port = 3000

app.use(cors({ origin: '*' }))
app.use(express.json())

const shopRouter = require('./router/shop')
const authRouter = require('./router/auth')
const ordersRouter = require('./router/orders')
const reviewsRouter = require('./router/reviews')
app.use(shopRouter)
app.use(authRouter)
app.use(ordersRouter)
app.use(reviewsRouter)

app.listen(port, () => {
    console.log('API MIRAGE en ligne sur le port ' + port)
})
