const fs = require('fs')
const path = require('path')

const reviewsFile = path.join(__dirname, '..', 'reviews.json')

function readReviews() {
    return JSON.parse(fs.readFileSync(reviewsFile, 'utf8'))
}
function writeReviews(d) {
    fs.writeFileSync(reviewsFile, JSON.stringify(d, null, 2), 'utf8')
}

// GET /products/:id/reviews — public
exports.list = function (req, res) {
    const data = readReviews()
    const list = data.reviews
        .filter(r => r.productId === req.params.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    res.json(list)
}

// POST /products/:id/reviews — connecté
exports.create = function (req, res) {
    const { rating, comment } = req.body || {}

    const r = Number(rating)
    if (!r || r < 1 || r > 5) {
        return res.status(400).json({ error: 'note entre 1 et 5 requise' })
    }
    if (!comment || comment.trim().length < 5) {
        return res.status(400).json({ error: 'commentaire trop court' })
    }

    const data = readReviews()
    const review = {
        id: 'rev-' + Date.now(),
        productId: req.params.id,
        userId: req.user.id,
        userName: req.user.name,
        rating: r,
        comment: comment.trim(),
        createdAt: new Date().toISOString()
    }
    data.reviews.push(review)
    writeReviews(data)
    res.status(201).json(review)
}
