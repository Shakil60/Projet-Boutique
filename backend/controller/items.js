const data = require("../data.json");

const getAllItems = (req, res) => res.send(data)

const getItemById = (req, res) => {
    const id = parseInt(req.params.id)
    const items = data.items
    const item = items.find(item => item.id === id)
    if (!item) {
        res.status(404).json({
            message: 'Item not found'
        })
    } else {
    const itemName = item.name
    const itemPrice = item.price
    const itemDescription = item.description
    const itemImage = item.image
    const itemCategory = item.category
    const itemStock = item.stock
    res.status(200).json({
        message: 'Item found',
        itemName,
        itemPrice,
        itemDescription,
        itemImage,
        itemCategory,
        itemStock
    })
    }
}

module.exports = {getAllItems, getItemById}
