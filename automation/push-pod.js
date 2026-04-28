// CLI : pousse le catalogue local vers un provider POD (Printful pour l'instant).
//
// usage :
//   node push-pod.js                  (pousse tous les produits absents côté Printful)
//   node push-pod.js --id glass-dragon (un seul produit)
//   node push-pod.js --mock           (force la simulation, même avec une clé)
//
// pré-requis pour le mode réel :
//   - PRINTFUL_API_KEY dans l'env (cf .env.example)
//   - un store Printful avec un Sync Product déjà existant pour récupérer les
//     variantes Printful → ici on les map à nos couleurs/tailles maison
//
// note : on n'effectue PAS le push réel par défaut. Le mode mock affiche juste
// ce qui serait envoyé. Ça permet de montrer la pipeline à l'oral sans payer
// un envoi accidentel à Printful.

const fs = require('fs')
const path = require('path')
const https = require('https')

// pour ne pas spammer le warning "image locale" (jusqu'à 16 fois par produit)
// on garde une trace des produits déjà signalés.
const warnedLocal = new Set()

const args = process.argv.slice(2)
const idArg = args.indexOf('--id') !== -1 ? args[args.indexOf('--id') + 1] : null
const forceMock = args.includes('--mock')
const useReal = !forceMock && !!process.env.PRINTFUL_API_KEY

console.log(useReal ? '[mode] réel — Printful activé' : '[mode] mock — aucun appel d\'API')

run().catch(e => {
    console.error('échec :', e.message || e)
    process.exit(1)
})

async function run() {
    const dataFile = path.join(__dirname, '..', 'backend', 'data.json')
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'))

    let products = data.products
    if (idArg) {
        products = products.filter(p => p.id === idArg)
        if (products.length === 0) {
            console.log('aucun produit avec l\'id', idArg)
            return
        }
    }

    console.log('[catalogue]', products.length, 'produit(s) à traiter')

    for (const p of products) {
        const payload = buildPrintfulPayload(p)
        if (useReal) {
            const res = await printful('/store/products', payload)
            console.log('[push]', p.id, '→ printful_id', res.result.id)
        } else {
            console.log('[mock]', p.id, '→', payload.sync_product.name, '(' + payload.sync_variants.length + ' variantes)')
        }
    }
}

// on transforme un produit MIRAGE en payload "Sync Product" Printful.
// le mapping couleur/taille → ID variante Printful est fictif ici, dans la
// vraie vie il faut interroger /products/{id}/variants côté Printful pour
// récupérer les bons IDs selon le tee qu'on choisit (ex : Bella+Canvas 3001).
function buildPrintfulPayload(p) {
    const sync_variants = p.stock
        .filter(v => v.quantity > 0)
        .map(v => ({
            // ces IDs sont des placeholders, à remplacer par les vrais
            // une fois le store Printful configuré.
            variant_id: fakePrintfulVariantId(v.color, v.size),
            retail_price: p.price.toFixed(2),
            files: [
                { type: 'front', url: imageAbsoluteUrl(p.images[0], p.id) }
            ]
        }))

    return {
        sync_product: {
            name: 'MIRAGE — ' + p.name,
            thumbnail: imageAbsoluteUrl(p.images[0], p.id)
        },
        sync_variants
    }
}

// hash bête pour générer un faux ID stable à partir d'une variante.
// utilisé uniquement en mock, juste pour que le payload ait quelque chose à imprimer.
function fakePrintfulVariantId(color, size) {
    const key = color + '-' + size
    let h = 0
    for (let i = 0; i < key.length; i++) {
        h = (h * 31 + key.charCodeAt(i)) | 0
    }
    return 4011 + Math.abs(h % 200) // borne arbitraire dans la plage Bella+Canvas
}

// si l'image est déjà une URL distante (Cloudinary/picsum/etc.) on la garde
// telle quelle. si c'est un chemin relatif local (./img/products/…), Printful
// ne saura pas la fetcher → on log un warning, mais une seule fois par produit
// pour ne pas spammer la sortie.
function imageAbsoluteUrl(src, productId) {
    if (/^https?:\/\//.test(src)) return src
    if (productId && !warnedLocal.has(productId)) {
        console.warn('[warn] ' + productId + ' : image locale non publique (' + src + ') — à uploader avant un vrai push')
        warnedLocal.add(productId)
    }
    return 'https://example.com' + src.replace(/^\.\//, '/')
}

function printful(endpoint, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body)
        const req = https.request({
            method: 'POST',
            hostname: 'api.printful.com',
            path: endpoint,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
                'Authorization': 'Bearer ' + process.env.PRINTFUL_API_KEY
            }
        }, res => {
            let buf = ''
            res.on('data', c => buf += c)
            res.on('end', () => {
                let json
                try { json = JSON.parse(buf) } catch (e) { return reject(new Error('réponse non-JSON : ' + buf.slice(0, 200))) }
                if (json.error) return reject(new Error(json.error.message || 'erreur Printful'))
                if (res.statusCode >= 400) return reject(new Error('HTTP ' + res.statusCode + ' : ' + buf.slice(0, 200)))
                resolve(json)
            })
        })
        req.on('error', reject)
        req.write(data)
        req.end()
    })
}
