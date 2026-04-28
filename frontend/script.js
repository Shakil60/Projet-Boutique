const fallbackApiUrl = "http://localhost:3000"
const itemsContainer = document.querySelector("#items")
const statusText = document.querySelector("#status")

function getApiBaseUrl() {
    if (window.location.origin.startsWith("http")) {
        return window.location.origin === "null" ? fallbackApiUrl : window.location.origin
    }

    return fallbackApiUrl
}

function renderItems(items) {
    if (!itemsContainer) {
        return
    }

    itemsContainer.innerHTML = items.map((item) => `
        <article class="card">
            <h2>${item.name}</h2>
            <p>${item.description}</p>
            <span class="price">${item.price} EUR</span>
            <p class="meta">Categorie : ${item.category}</p>
            <p class="meta">Stock disponible : ${item.stock}</p>
        </article>
    `).join("")
}

async function getAllItems() {
    if (!itemsContainer || !statusText) {
        console.error("Required DOM elements are missing.")
        return
    }

    try {
        const response = await fetch(`${getApiBaseUrl()}/api/items`)

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
        }

        const data = await response.json()
        const items = Array.isArray(data.items) ? data.items : []

        renderItems(items)
        statusText.textContent = items.length ? "" : "Aucun produit disponible."
    } catch (error) {
        statusText.textContent = "Impossible de charger les produits."
        console.error("Error fetching data:", error)
    }
}

getAllItems()