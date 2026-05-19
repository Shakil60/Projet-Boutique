// CLI : ajoute un nouveau produit MIRAGE au catalogue à partir d'un thème.
//
// usage :
//   node generate.js --theme "forêt cybernétique"           (mode réel si GEMINI_API_KEY dispo)
//   node generate.js --theme "forêt cybernétique" --mock    (force le mock)
//
// pipeline :
//   1. on prend un thème
//   2. on demande à Gemini un nom + une description
//   3. on demande à Imagen une image du print
//   4. on enregistre l'image dans frontend/img/products/<slug>-1.<ext>
//   5. on ajoute le produit dans backend/data.json
//
// note : pour l'instant l'image vit en local. dans une vraie pipeline POD il
// faudrait l'uploader sur un host public (S3, Cloudinary…) avant de la passer
// à Printful, on a pas eu le temps de faire la partie upload pour le rendu.

const fs = require('fs')
const path = require('path')
const https = require('https')

const args = process.argv.slice(2)
const themeIdx = args.indexOf('--theme')
const theme = themeIdx === -1 ? null : args[themeIdx + 1]
const forceMock = args.includes('--mock')

if (!theme) {
    console.error('argument --theme manquant.')
    console.error('exemple : node generate.js --theme "forêt cybernétique"')
    process.exit(1)
}

const useReal = !forceMock && !!process.env.GEMINI_API_KEY

console.log(useReal ? '[mode] réel — Gemini activé' : '[mode] mock — pas d\'appel API')
console.log('[thème]', theme)

run().catch(err => {
    console.error('échec :', err.message || err)
    process.exit(1)
})

async function run() {
    // 1+2 — meta produit (nom + description)
    const meta = useReal ? await metaWithGemini(theme) : metaMock(theme)
    console.log('[design]', meta.name, '(' + meta.slug + ')')

    // 3+4 — image
    const productsDir = path.join(__dirname, '..', 'frontend', 'img', 'products')
    fs.mkdirSync(productsDir, { recursive: true })
    const imagePath = path.join(productsDir, meta.slug + '-1.jpg')

    if (useReal) {
        const buffer = await imageWithImagen(theme)
        fs.writeFileSync(imagePath, buffer)
    } else {
        // mock : on récupère une image picsum déterministe (à partir du slug)
        await downloadToFile('https://picsum.photos/seed/' + meta.slug + '/600/750', imagePath)
    }
    console.log('[image]', path.relative(process.cwd(), imagePath))

    // 5 — catalogue
    const added = appendToCatalog(meta)
    if (added) {
        console.log('[catalogue] produit ajouté à backend/data.json')
    } else {
        console.log('[catalogue] un produit avec ce slug existe déjà, on touche pas')
    }
}

// ---------- mock ----------

function metaMock(theme) {
    // on combine un mot du thème avec un suffixe pour fabriquer un nom dans le ton du catalogue
    const suffixes = ['Drift', 'Bloom', 'Static', 'Halo', 'Code', 'Skin', 'Dust', 'Loop', 'Ghost']
    const words = theme.split(/\s+/).filter(Boolean)
    const head = words[words.length - 1] || 'design'
    const cap = head.charAt(0).toUpperCase() + head.slice(1).toLowerCase()
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)]
    const name = cap + ' ' + suffix
    const slug = slugify(name)
    const description = 'Design inspiré du thème "' + theme + '". Print recto pleine taille, encres mates. Coupe oversized boxy, coton bio 220g. Nouveau drop ajouté par le pipeline auto, à valider visuellement avant la mise en vente.'
    return { name, slug, description }
}

// ---------- Gemini (texte) ----------

async function metaWithGemini(theme) {
    const prompt = 'Tu fais partie de l\'équipe créative d\'une marque streetwear FR appelée MIRAGE. ' +
        'Pour le thème "' + theme + '", propose UN design de t-shirt unique. ' +
        'Réponds en JSON strict : { "name": "<2 mots>", "slug": "<kebab-case>", "description": "<200-400 caractères, en français, ton cool>" }. ' +
        'Pas de texte autour du JSON.'

    const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
    }
    const res = await geminiCall('gemini-3-flash-preview:generateContent', body)
    const text = res.candidates[0].content.parts[0].text
    const parsed = JSON.parse(text)
    if (!parsed.slug) parsed.slug = slugify(parsed.name)
    return parsed
}

// ---------- Imagen (image) ----------

async function imageWithImagen(theme) {
    const prompt = 'Streetwear t-shirt graphic print, dreamcore aesthetic, theme: ' + theme +
        '. Square composition, dark contrasting palette, no text, no logo.'

    const body = {
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio: '1:1' }
    }
    const res = await geminiCall('imagen-4.0-generate-001:predict', body)
    const pred = res.predictions[0]
    if (!pred || !pred.bytesBase64Encoded) {
        throw new Error('imagen n\'a pas renvoyé d\'image (peut-être bloqué par le safety filter)')
    }
    return Buffer.from(pred.bytesBase64Encoded, 'base64')
}

function geminiCall(modelEndpoint, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body)
        const req = https.request({
            method: 'POST',
            hostname: 'generativelanguage.googleapis.com',
            path: '/v1beta/models/' + modelEndpoint + '?key=' + encodeURIComponent(process.env.GEMINI_API_KEY),
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        }, res => {
            let buf = ''
            res.on('data', c => buf += c)
            res.on('end', () => {
                let json
                try { json = JSON.parse(buf) } catch (e) { return reject(new Error('réponse non-JSON : ' + buf.slice(0, 200))) }
                if (json.error) return reject(new Error('Gemini : ' + json.error.message))
                resolve(json)
            })
        })
        req.on('error', reject)
        req.write(data)
        req.end()
    })
}

// ---------- helpers ----------

function slugify(s) {
    return String(s)
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

function downloadToFile(url, dest) {
    return new Promise((resolve, reject) => {
        https.get(url, res => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return downloadToFile(res.headers.location, dest).then(resolve, reject)
            }
            if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode))
            const file = fs.createWriteStream(dest)
            res.pipe(file)
            file.on('finish', () => file.close(resolve))
            file.on('error', reject)
        }).on('error', reject)
    })
}

function appendToCatalog(meta) {
    const dataFile = path.join(__dirname, '..', 'backend', 'data.json')
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'))
    if (data.products.find(p => p.id === meta.slug)) return false

    const relImage = './img/products/' + meta.slug + '-1.jpg'

    // stock par défaut à 10 sur toutes les variantes
    const stock = []
    const colors = ['noir', 'blanc', 'sand']
    const sizes = ['S', 'M', 'L', 'XL', 'XXL']
    colors.forEach(c => sizes.forEach(s => stock.push({ color: c, size: s, quantity: 10 })))

    data.products.push({
        id: meta.slug,
        name: meta.name,
        description: meta.description,
        price: 34.90,
        currency: 'EUR',
        gender: 'unisexe',
        type: 'graphique',
        fit: 'oversized',
        material: 'Coton bio 220 g/m²',
        colors,
        sizes,
        images: [relImage, relImage],
        stock
    })

    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8')
    return true
}
