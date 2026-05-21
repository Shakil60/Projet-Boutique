// page favoris - on ne stocke que les ids en localStorage, du coup ici on doit
// refetch chaque produit pour avoir les infos à jour (prix, image…)
// TODO ajouter une petite anim quand on retire un favori, ça fait un peu sec

const area = document.getElementById('fav-area')
const sub = document.getElementById('sub')

render()

async function render() {
    const ids = getFavs()

    if (ids.length === 0) {
        sub.textContent = 'Tu n\'as encore mis aucun produit en favori.'
        area.innerHTML = `
            <div class="empty-state">
                <p>Aucun favori pour le moment.</p>
                <p style="margin-top:18px"><a class="btn" href="./index.html">Voir le catalogue</a></p>
            </div>
        `
        return
    }

    sub.textContent = ids.length + ' produit' + (ids.length > 1 ? 's' : '') + ' en favori'

    // on récupère chaque produit en parallèle. Si un id ne renvoie plus rien
    // (genre supprimé du catalogue), on l'ignore proprement.
    const results = await Promise.all(ids.map(id =>
        api('/products/' + encodeURIComponent(id)).catch(() => null)
    ))

    const products = results.filter(p => p !== null)

    if (products.length === 0) {
        area.innerHTML = '<div class="empty-state">Tes favoris ne sont plus disponibles.</div>'
        return
    }

    area.innerHTML = '<div class="grid"></div>'
    const grid = area.querySelector('.grid')
    products.forEach(p => grid.appendChild(buildFavCard(p)))
}

function buildFavCard(p) {
    const wrap = document.createElement('div')
    wrap.className = 'card'
    const altImg = p.images[1] || p.images[0]
    wrap.innerHTML = `
        <a href="./produit.html?id=${encodeURIComponent(p.id)}">
            <div class="thumb">
                <img class="main" src="${p.images[0]}" alt="${p.name}" loading="lazy">
                <img class="alt" src="${altImg}" alt="" loading="lazy">
            </div>
            <div class="info">
                <div class="name">${p.name}</div>
                <div class="meta">${p.gender} · ${p.type}</div>
                <div class="price">${formatPrice(p.price)}</div>
            </div>
        </a>
        <div style="padding:0 16px 16px">
            <button class="fav-btn" data-id="${p.id}" style="width:100%">retirer des favoris</button>
        </div>
    `

    // on branche le bouton "retirer" directement ici
    wrap.querySelector('button').addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        removeFav(p.id)
        showToast('Retiré des favoris')
        render()
    })

    return wrap
}
