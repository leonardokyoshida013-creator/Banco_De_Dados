const path = require('path');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const flash = require('connect-flash');
const bcrypt = require('bcrypt');

const { initDb, Admin, LogEntry, ensureDefaultAdmin } = require('./db');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());

app.use(
  session({
    secret: 'replace-with-a-long-random-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true }
  })
);
app.use(flash());

function isAuthed(req) {
  return req.session && req.session.adminId;
}

function requireAdmin(req, res, next) {
  if (!isAuthed(req)) return res.redirect('/admin/login');
  next();
}

app.get('/', (req, res) => {
  res.redirect('/admin');
});

app.get('/admin/login', (req, res) => {
  res.render('login', {
    error: req.flash('error')[0],
    success: req.flash('success')[0]
  });
});

app.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const admin = await Admin.findOne({ where: { email } });
    if (!admin) {
      req.flash('error', 'Credenciais inválidas');
      return res.redirect('/admin/login');
    }

    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) {
      req.flash('error', 'Credenciais inválidas');
      return res.redirect('/admin/login');
    }

    req.session.adminId = admin.id;
    req.session.adminEmail = admin.email;

    await LogEntry.create({
      adminId: admin.id,
      action: 'login'
    });

    req.flash('success', 'Login realizado com sucesso');
    return res.redirect('/admin');
  } catch (e) {
    req.flash('error', 'Erro ao autenticar');
    return res.redirect('/admin/login');
  }
});

app.post('/admin/logout', requireAdmin, async (req, res) => {
  try {
    const adminId = req.session.adminId;
    await LogEntry.create({ adminId, action: 'logout' });
  } catch (_) {}

  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
});

app.get('/admin', requireAdmin, async (req, res) => {
  const logs = await LogEntry.findAll({
    order: [['createdAt', 'DESC']],
    limit: 20
  });

  res.render('dashboard', {
    adminEmail: req.session.adminEmail,
    logs: logs.map(l => ({
      id: l.id,
      action: l.action,
      createdAt: l.createdAt
    }))
  });
});

// Exemplo de tabela (ADM) - CRUD de “Registros”
// Para manter simples, vamos usar a tabela LogEntry como exemplo.

app.get('/admin/logs', requireAdmin, async (req, res) => {
  const logs = await LogEntry.findAll({ order: [['createdAt', 'DESC']] });
  res.render('logs', { adminEmail: req.session.adminEmail, logs });
});

app.post('/admin/logs/clear', requireAdmin, async (req, res) => {
  await LogEntry.destroy({ where: {}, truncate: true });
  req.flash('success', 'Logs removidos');
  res.redirect('/admin/logs');
});

async function main() {
  await initDb();
  await ensureDefaultAdmin();

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

