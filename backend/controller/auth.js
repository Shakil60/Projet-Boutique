const fs = require('fs')
const path = require('path')

const usersFile = path.join(__dirname, '..', 'users.json')

// note pour nous : on stocke les mots de passe en clair, c'est pas top mais c'est
// largement suffisant pour le projet école. en prod on hasherait avec bcrypt.

function readUsers() {
    if (!fs.existsSync(usersFile)) {
        return { users: [] }
    }
    return JSON.parse(fs.readFileSync(usersFile, 'utf8'))
}

function writeUsers(data) {
    fs.writeFileSync(usersFile, JSON.stringify(data, null, 2), 'utf8')
}

// retire le password avant de renvoyer un user au front
function publicUser(u) {
    const safe = Object.assign({}, u)
    delete safe.password
    return safe
}

// POST /auth/signup
exports.signup = function (req, res) {
    const { email, password, name } = req.body || {}
    if (!email || !password || !name) {
        return res.status(400).json({ error: 'email, password et name sont requis' })
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'mot de passe trop court (6 minimum)' })
    }

    const data = readUsers()
    const exists = data.users.find(u => u.email.toLowerCase() === email.toLowerCase())
    if (exists) {
        return res.status(409).json({ error: 'cet email est déjà pris' })
    }

    const user = {
        id: 'u-' + Date.now(),
        email: email.toLowerCase(),
        password,
        name,
        role: 'user',
        createdAt: new Date().toISOString()
    }
    data.users.push(user)
    writeUsers(data)

    // le "token" c'est juste l'id user — on n'a pas mis de JWT, c'est un projet école
    res.json({ token: user.id, user: publicUser(user) })
}

// POST /auth/login
exports.login = function (req, res) {
    const { email, password } = req.body || {}
    if (!email || !password) {
        return res.status(400).json({ error: 'email et password requis' })
    }

    const data = readUsers()
    const user = data.users.find(u =>
        u.email.toLowerCase() === email.toLowerCase() && u.password === password
    )
    if (!user) {
        return res.status(401).json({ error: 'email ou mot de passe invalide' })
    }

    res.json({ token: user.id, user: publicUser(user) })
}

// GET /auth/me — renvoie le user courant si l'header X-User-Id est présent et valide
exports.me = function (req, res) {
    const userId = req.headers['x-user-id']
    if (!userId) return res.status(401).json({ error: 'non connecté' })

    const data = readUsers()
    const user = data.users.find(u => u.id === userId)
    if (!user) return res.status(401).json({ error: 'utilisateur introuvable' })

    res.json(publicUser(user))
}

// middleware : exige une session utilisateur
exports.requireAuth = function (req, res, next) {
    const userId = req.headers['x-user-id']
    if (!userId) return res.status(401).json({ error: 'non connecté' })

    const data = readUsers()
    const user = data.users.find(u => u.id === userId)
    if (!user) return res.status(401).json({ error: 'session invalide' })

    req.user = user
    next()
}

// middleware : exige une session ET un rôle admin
exports.requireAdmin = function (req, res, next) {
    exports.requireAuth(req, res, function () {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'accès admin requis' })
        }
        next()
    })
}
