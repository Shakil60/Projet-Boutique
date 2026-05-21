// page admin - gérer les produits (créer, modifier, supprimer)

// si on n'est pas admin on dégage tout de suite
if (!isAdmin()) {
    location.href = './connexion.html'
}

const area = document.getElementById('admin-area')
const sub = document.getElementById('sub')
const formModal = document.getElementById('form-modal')
const form = document.getElementById('product-form')
const formTitle = document.getElementById('form-title')
const formError = document.getElementById('form-error')

// id du produit en cours d'édition (null = création)
let editingId = null

document.getElementById('new-product').addEventListener('click', () => openForm(null))
formModal.addEventListener('click', (e) => {
    if (e.target.dataset.close !== undefined || e.target === formModal) closeForm()
})
form.addEventListener('submit', onSubmit)

loadList()

async function loadList() {
    area.innerHTML = '<div class="empty-state">chargement…</div>'
    try {
        const list = await api('/products')
        sub.textContent = list.length + ' produit' + (list.length > 1 ? 's' : '') + ' dans le catalogue'

        const rows = list.map(p => {
            const total = p.stock.reduce((s, v) => s + v.quantity, 0)
            return `
                <tr data-id="${p.id}">
                    <td><img src="${p.images[0]}" alt="" class="admin-thumb"></td>
                    <td><strong>${p.name}</strong><br><span class="mono">${p.id}</span></td>
                    <td>${formatPrice(p.price)}</td>
                    <td>${p.gender} · ${p.type} · ${p.fit}</td>
                    <td>${total} en stock</td>
                    <td class="row-actions">
                        <button class="link-btn" data-action="edit">éditer</button>
                        <button class="link-btn danger" data-action="delete">supprimer</button>
                    </td>
                </tr>
            `
        }).join('')

        area.innerHTML = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th></th>
                        <th>produit</th>
                        <th>prix</th>
                        <th>caractéristiques</th>
                        <th>stock</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `

        area.querySelectorAll('button[data-action]').forEach(btn => {
            btn.addEventListener('click', onRowAction)
        })
    } catch (e) {
        area.innerHTML = '<div class="empty-state">erreur de chargement</div>'
    }
}

async function onRowAction(e) {
    const action = e.target.dataset.action
    const id = e.target.closest('tr').dataset.id
    if (action === 'edit') {
        const p = await api('/products/' + encodeURIComponent(id))
        openForm(p)
    } else if (action === 'delete') {
        if (!confirm('supprimer définitivement le produit "' + id + '" ?')) return
        try {
            await api('/products/' + encodeURIComponent(id), { method: 'DELETE' })
            showToast('produit supprimé')
            loadList()
        } catch (err) {
            showToast(err.body?.error || 'erreur suppression')
        }
    }
}

function openForm(product) {
    editingId = product ? product.id : null
    formTitle.textContent = product ? 'Éditer ' + product.name : 'Nouveau produit'
    formError.hidden = true
    form.reset()

    // si on édite, on pré-remplit les champs avec les valeurs actuelles
    if (product) {
        form.id.value = product.id
        form.id.readOnly = true
        form.name.value = product.name
        form.description.value = product.description
        form.price.value = product.price
        form.gender.value = product.gender
        form.type.value = product.type
        form.fit.value = product.fit
        form.material.value = product.material
        form.colors.value = product.colors.join(',')
        form.sizes.value = product.sizes.join(',')
        form.images.value = product.images.join('\n')
    } else {
        form.id.readOnly = false
    }

    formModal.hidden = false
    document.body.style.overflow = 'hidden'
}

function closeForm() {
    formModal.hidden = true
    document.body.style.overflow = ''
}

async function onSubmit(e) {
    e.preventDefault()
    formError.hidden = true

    const fd = new FormData(form)
    const colors = fd.get('colors').split(',').map(s => s.trim()).filter(Boolean)
    const sizes = fd.get('sizes').split(',').map(s => s.trim()).filter(Boolean)
    const images = fd.get('images').split(/\n/).map(s => s.trim()).filter(Boolean)

    const payload = {
        id: fd.get('id').trim(),
        name: fd.get('name').trim(),
        description: fd.get('description').trim(),
        price: Number(fd.get('price')),
        currency: 'EUR',
        gender: fd.get('gender'),
        type: fd.get('type'),
        fit: fd.get('fit'),
        material: fd.get('material').trim(),
        colors,
        sizes,
        images: images.length ? images : ['https://picsum.photos/seed/' + fd.get('id').trim() + '/600/750']
    }

    try {
        if (editingId) {
            await api('/products/' + encodeURIComponent(editingId), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            showToast('produit modifié')
        } else {
            await api('/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            showToast('produit créé')
        }
        closeForm()
        loadList()
    } catch (err) {
        const msg = err.body?.details ? err.body.details.join(', ') : (err.body?.error || err.message)
        formError.textContent = msg
        formError.hidden = false
    }
}
