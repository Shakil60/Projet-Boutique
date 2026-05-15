// petits tests d'intégration sur l'API. on utilise rien de plus que node:assert
// et fetch — pas de framework de test à installer.
//
// avant de lancer : `npm start` côté backend, puis dans un autre terminal :
//   node tests/api.test.js
//
// le but c'est de valider les routes principales, pas de tout couvrir.

const assert = require('node:assert/strict')

const BASE = 'http://localhost:3000'

let pass = 0
let fail = 0

async function test(name, fn) {
    try {
        await fn()
        console.log('  ✓', name)
        pass++
    } catch (e) {
        console.log('  ✗', name)
        console.log('    ', e.message)
        fail++
    }
}

async function run() {
    console.log('--- /products ---')

    await test('GET /products renvoie un tableau de 20 produits minimum', async () => {
        const r = await fetch(BASE + '/products')
        const data = await r.json()
        assert.equal(r.status, 200)
        assert.ok(Array.isArray(data))
        assert.ok(data.length >= 20, 'attendu >= 20, eu ' + data.length)
    })

    await test('GET /products?gender=femme filtre bien', async () => {
        const r = await fetch(BASE + '/products?gender=femme')
        const data = await r.json()
        assert.ok(data.every(p => p.gender === 'femme'))
    })

    await test('GET /products?limit=5 renvoie une page paginée', async () => {
        const r = await fetch(BASE + '/products?limit=5')
        const data = await r.json()
        assert.equal(data.items.length, 5)
        assert.ok(data.hasMore === true)
    })

    await test('GET /products?sort=price_asc trie bien', async () => {
        const r = await fetch(BASE + '/products?sort=price_asc')
        const data = await r.json()
        for (let i = 1; i < data.length; i++) {
            assert.ok(data[i].price >= data[i - 1].price, 'tri cassé à l\'index ' + i)
        }
    })

    await test('GET /products/:id sur un id inconnu renvoie 404', async () => {
        const r = await fetch(BASE + '/products/n-existe-pas')
        assert.equal(r.status, 404)
    })

    await test('GET /products/:id/similar renvoie au plus 4 produits', async () => {
        const r = await fetch(BASE + '/products/cosmic-wolf/similar')
        const data = await r.json()
        assert.ok(data.length <= 4)
    })

    console.log('\n--- /auth ---')

    await test('POST /auth/login avec admin retourne un token', async () => {
        const r = await fetch(BASE + '/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@mirage.fr', password: 'admin123' })
        })
        const data = await r.json()
        assert.equal(r.status, 200)
        assert.ok(data.token)
        assert.equal(data.user.role, 'admin')
    })

    await test('POST /auth/login avec mauvais password renvoie 401', async () => {
        const r = await fetch(BASE + '/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@mirage.fr', password: 'WRONG' })
        })
        assert.equal(r.status, 401)
    })

    console.log('\n--- /products (admin CRUD) ---')

    // récup token admin pour les tests qui suivent
    const adminLogin = await fetch(BASE + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@mirage.fr', password: 'admin123' })
    }).then(r => r.json())
    const adminToken = adminLogin.token

    await test('POST /products sans token renvoie 401', async () => {
        const r = await fetch(BASE + '/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: 'test-fixture' })
        })
        assert.equal(r.status, 401)
    })

    await test('POST /products avec admin et payload valide → 201 puis DELETE → 200', async () => {
        const payload = {
            id: 'test-fixture',
            name: 'Test Fixture',
            description: 'description suffisamment longue pour passer la validation requise par l api',
            price: 29.90,
            colors: ['noir'],
            sizes: ['M'],
            images: ['https://picsum.photos/seed/test/600/750'],
            gender: 'unisexe',
            type: 'graphique',
            fit: 'oversized',
            material: 'Coton bio 220 g/m²'
        }
        const post = await fetch(BASE + '/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-Id': adminToken },
            body: JSON.stringify(payload)
        })
        assert.equal(post.status, 201)

        const del = await fetch(BASE + '/products/test-fixture', {
            method: 'DELETE',
            headers: { 'X-User-Id': adminToken }
        })
        assert.equal(del.status, 200)
    })

    console.log('\n=> ' + pass + ' tests passés, ' + fail + ' échec(s)')
    if (fail > 0) process.exit(1)
}

run().catch(err => {
    console.error('erreur globale dans les tests :', err.message)
    console.error('le serveur tourne bien sur ' + BASE + ' ? lance `npm start` côté backend.')
    process.exit(1)
})
