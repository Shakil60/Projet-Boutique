const express = require('express')
const app = express()
const port = 3000

const cors = require('cors')
app.use(cors({origin: '*'}))

const studentRouter = require('./router/students')
app.use(studentRouter)

app.listen(port, () => console.log('Server listening on port 3000!'))