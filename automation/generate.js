// CLI : ajoute un nouveau produit MIRAGE au catalogue à partir d'un simple thème.
//
// usage :
//   node generate.js --theme "forêt cybernétique"           (mode réel si GEMINI_API_KEY dispo)
//   node generate.js --theme "forêt cybernétique" --mock    (force le mock)
//
// pipeline :
//   1. on prend un thème
//   2. on demande à Gemini un nom + une description (gemini-3 flash, JSON mode)
//   3. on demande à Imagen une image du print (imagen 4, format 1:1)
//   4. on enregistre l'image dans frontend/img/products/<slug>-1.<ext>
//   5. si CLOUDINARY_URL est défini, on upload l'image et on récupère
//      une URL publique (sinon Printful ne pourra pas la fetcher)
//   6. on ajoute le produit dans backend/data.json
//
// que des modules natifs (https, fs, path, crypto) — pas de npm install à faire.

const fs = require('fs')
const path = require('path')
const https = require('https')
const crypto = require('crypto')

// modèles Google utilisés. Centralisés ici pour qu'on puisse swap facilement
// quand de nouvelles versions sortent (gemini-3.5, imagen-5…).
// gemini-3-flash est encore en preview, le suffixe -preview est obligatoire dans l'URL.
const TEXT_MODEL = 'gemini-3-flash-preview'
const IMAGE_MODEL = 'imagen-4.0-generate-001'

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
const uploadEnabled = useReal && !!process.env.CLOUDINARY_URL

console.log(useReal ? '[mode] réel — Gemini/Imagen activés' : '[mode] mock — aucun appel d\'API')
console.log('[upload]', uploadEnabled ? 'Cloudinary activé' : 'désactivé (image locale uniquement)')
console.log('[thème]', theme)

run().catch(err => {
    console.error('échec :', err.message || err)
    process.exit(1)
})

async function run() {
    // étape 1 et 2 — meta produit
    const meta = useReal ? await generateMetaWithGemini(theme) : generateMetaMock(theme)
    console.log('[design]', meta.name, '(' + meta.slug + ')')

    // étape 3 et 4 — image
    const productsDir = path.join(__dirname, '..', 'frontend', 'img', 'products')
    fs.mkdirSync(productsDir, { recursive: true })

    let ext = 'jpg'
    let imagePath
    if (useReal) {
        const { buffer, mime } = await generateImageWithImagen(theme)
        ext = (mime || 'image/png').split('/')[1] || 'png'
        imagePath = path.join(productsDir, meta.slug + '-1.' + ext)
        fs.writeFileSync(imagePath, buffer)
    } else {
        imagePath = path.join(productsDir, meta.slug + '-1.jpg')
        await downloadToFile('https://picsum.photos/seed/' + meta.slug + '/600/750', imagePath)
    }
    console.log('[image] ' + path.relative(process.cwd(), imagePath))

    // étape 5 — upload public si Cloudinary configuré
    let publicUrl = null
    if (uploadEnabled) {
        publicUrl = await uploadToCloudinary(imagePath, meta.slug)
        console.log('[upload]', publicUrl)
    }

    // étape 6 — catalogue
    const localRel = './img/products/' + path.basename(imagePath)
    const added = appendToCatalog(meta, publicUrl || localRel)
    if (added) {
        console.log('[catalogue] produit ajouté à backend/data.json')
    } else {
        console.log('[catalogue] un produit avec ce slug existe déjà, on ne touche pas')
    }
}

// ---------- mock ----------

function generateMetaMock(theme) {
    // quelques mots forts à recombiner pour fabriquer un nom dans le ton du catalogue
    const suffixes = ['Drift', 'Bloom', 'Static', 'Halo', 'Code', 'Skin', 'Dust', 'Loop', 'Ghost', 'Wolf']
    const words = theme.split(/\s+/).filter(Boolean)
    const headword = words[words.length - 1] || 'design'
    const cap = headword.charAt(0).toUpperCase() + headword.slice(1).toLowerCase()
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)]
    const name = cap + ' ' + suffix
    const slug = slugify(name)
    const description = 'Design inspiré du thème "' + theme + '". Print recto pleine taille, encres mates, finition à plat. Coupe oversized boxy, coton bio 220g. Nouveau drop ajouté au catalogue par notre pipeline interne, à valider visuellement avant la mise en vente publique.'
    return { name, slug, description }
}

// ---------- Gemini (texte) ----------

async function generateMetaWithGemini(theme) {
    const prompt = 'Tu fais partie de l\'équipe créative d\'une marque streetwear FR appelée MIRAGE. ' +
        'Pour le thème "' + theme + '", propose UN design de t-shirt unique. ' +
        'Réponds en JSON strict : { "name": "<2 mots, ex \'Cosmic Wolf\'>", "slug": "<kebab-case>", "description": "<entre 200 et 400 caractères, en français, ton cool, à la première personne>" }. ' +
        'Pas de texte autour du JSON.'

    const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.9
        }
    }
    const res = await geminiCall('/v1beta/models/' + TEXT_MODEL + ':generateContent', body)
    const text = res.candidates && res.candidates[0] && res.candidates[0].content.parts[0].text
    if (!text) throw new Error('Gemini n\'a rien retourné de lisible')

    const parsed = JSON.parse(text)
    if (!parsed.slug) parsed.slug = slugify(parsed.name)
    return parsed
}

// ---------- Imagen (image) ----------

async function generateImageWithImagen(theme) {
    // on garde un prompt orienté print streetwear, sans texte/logo, format carré
    const prompt = 'Streetwear t-shirt graphic print, dreamcore aesthetic, theme: ' + theme + '. ' +
        'Square composition, cinematic lighting, dark contrasting palette, no text, no logo, surreal, high detail.'

    const body = {
        instances: [{ prompt }],
        parameters: {
            sampleCount: 1,
            aspectRatio: '1:1',
            personGeneration: 'allow_adult'
        }
    }
    const res = await geminiCall('/v1beta/models/' + IMAGE_MODEL + ':predict', body)
    const pred = res.predictions && res.predictions[0]
    if (!pred || !pred.bytesBase64Encoded) {
        throw new Error('Imagen n\'a pas renvoyé d\'image (peut-être bloqué par le safety filter)')
    }
    return {
        buffer: Buffer.from(pred.bytesBase64Encoded, 'base64'),
        mime: pred.mimeType || 'image/png'
    }
}

function geminiCall(endpoint, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body)
        const req = https.request({
            method: 'POST',
            hostname: 'generativelanguage.googleapis.com',
            path: endpoint + '?key=' + encodeURIComponent(process.env.GEMINI_API_KEY),
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
                if (json.error) return reject(new Error('Gemini : ' + (json.error.message || JSON.stringify(json.error))))
                if (res.statusCode >= 400) return reject(new Error('HTTP ' + res.statusCode + ' : ' + buf.slice(0, 200)))
                resolve(json)
            })
        })
        req.on('error', reject)
        req.write(data)
        req.end()
    })
}

// ---------- Cloudinary (signed upload) ----------

// upload d'un fichier via l'API Cloudinary v1.1, méthode signée.
// l'auth se fait via CLOUDINARY_URL = cloudinary://api_key:api_secret@cloud_name
// (format officiel Cloudinary, qu'on retrouve dans le dashboard de chaque compte).
async function uploadToCloudinary(filePath, slug) {
    const cfg = parseCloudinaryUrl(process.env.CLOUDINARY_URL)

    const timestamp = Math.floor(Date.now() / 1000)
    const folder = 'mirage/designs'
    const publicId = slug

    // params signés (tout ce qu'on envoie hors file/api_key/signature/resource_type)
    const signedParams = { folder, public_id: publicId, timestamp }
    const signature = signCloudinary(signedParams, cfg.apiSecret)

    const fileBuffer = fs.readFileSync(filePath)
    const filename = path.basename(filePath)

    const boundary = '----mirage' + Date.now()
    const parts = []

    function addField(name, value) {
        parts.push(Buffer.from(
            '--' + boundary + '\r\n' +
            'Content-Disposition: form-data; name="' + name + '"\r\n\r\n' +
            value + '\r\n'
        ))
    }

    addField('api_key', cfg.apiKey)
    addField('timestamp', String(timestamp))
    addField('signature', signature)
    addField('folder', folder)
    addField('public_id', publicId)

    parts.push(Buffer.from(
        '--' + boundary + '\r\n' +
        'Content-Disposition: form-data; name="file"; filename="' + filename + '"\r\n' +
        'Content-Type: application/octet-stream\r\n\r\n'
    ))
    parts.push(fileBuffer)
    parts.push(Buffer.from('\r\n--' + boundary + '--\r\n'))

    const body = Buffer.concat(parts)

    return new Promise((resolve, reject) => {
        const req = https.request({
            method: 'POST',
            hostname: 'api.cloudinary.com',
            path: '/v1_1/' + cfg.cloudName + '/image/upload',
            headers: {
                'Content-Type': 'multipart/form-data; boundary=' + boundary,
                'Content-Length': body.length
            }
        }, res => {
            let buf = ''
            res.on('data', c => buf += c)
            res.on('end', () => {
                let json
                try { json = JSON.parse(buf) } catch (e) { return reject(new Error('cloudinary non-JSON : ' + buf.slice(0, 200))) }
                if (json.error) return reject(new Error('Cloudinary : ' + json.error.message))
                if (res.statusCode >= 400) return reject(new Error('Cloudinary HTTP ' + res.statusCode))
                resolve(json.secure_url)
            })
        })
        req.on('error', reject)
        req.write(body)
        req.end()
    })
}

function parseCloudinaryUrl(url) {
    const m = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/)
    if (!m) throw new Error('CLOUDINARY_URL doit ressembler à cloudinary://api_key:api_secret@cloud_name')
    return { apiKey: m[1], apiSecret: decodeURIComponent(m[2]), cloudName: m[3] }
}

function signCloudinary(params, apiSecret) {
    // règle Cloudinary : trier les clés, joindre en key=value&key=value, puis SHA-1 avec le secret en suffixe
    const sorted = Object.keys(params).sort().map(k => k + '=' + params[k]).join('&')
    return crypto.createHash('sha1').update(sorted + apiSecret).digest('hex')
}

// ---------- helpers ----------

function slugify(s) {
    return String(s)
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '') // dégage les accents
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

function downloadToFile(url, dest) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, res => {
            // suit les redirections (utile pour picsum qui en renvoie)
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return downloadToFile(res.headers.location, dest).then(resolve, reject)
            }
            if (res.statusCode !== 200) {
                return reject(new Error('HTTP ' + res.statusCode + ' sur ' + url))
            }
            const file = fs.createWriteStream(dest)
            res.pipe(file)
            file.on('finish', () => file.close(() => resolve()))
            file.on('error', err => fs.unlink(dest, () => reject(err)))
        })
        req.on('error', reject)
    })
}

function appendToCatalog(meta, imageRefForCatalog) {
    const dataFile = path.join(__dirname, '..', 'backend', 'data.json')
    const raw = fs.readFileSync(dataFile, 'utf8')
    const data = JSON.parse(raw)

    if (data.products.find(p => p.id === meta.slug)) {
        return false
    }

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
        colors: ['noir', 'blanc', 'sand'],
        sizes: ['S', 'M', 'L', 'XL', 'XXL'],
        // les 2 images pointent au meme endroit pour l'instant
        // TODO faire la 2e image (verso) plus tard, ça demande un autre appel Imagen
        images: [imageRefForCatalog, imageRefForCatalog],
        stock: defaultStock(['noir', 'blanc', 'sand'], ['S', 'M', 'L', 'XL', 'XXL'])
    })

    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8')
    return true
}

function defaultStock(colors, sizes) {
    const out = []
    colors.forEach(c => {
        sizes.forEach(s => {
            out.push({ color: c, size: s, quantity: 10 })
        })
    })
    return out
}
