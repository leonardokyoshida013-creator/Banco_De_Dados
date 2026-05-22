const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');
const path = require('path');

// Usa melhor compatibilidade com ambientes sem build tools nativas
// (sqlite3 pode exigir Python/build no Windows; melhor-sqlite3 costuma ser mais simples)
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'db.sqlite'),
  logging: false
});

const Admin = sequelize.define(
  'Admin',
  {
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING, allowNull: false }
  },
  {
    tableName: 'admins'
  }
);

const LogEntry = sequelize.define(
  'LogEntry',
  {
    adminId: { type: DataTypes.INTEGER, allowNull: false },
    action: { type: DataTypes.STRING, allowNull: false }
  },
  {
    tableName: 'log_entries'
  }
);

Admin.hasMany(LogEntry, { foreignKey: 'adminId' });
LogEntry.belongsTo(Admin, { foreignKey: 'adminId' });

async function initDb() {
  await sequelize.sync();
}

async function ensureDefaultAdmin() {
  const email = 'admin@admin.com';
  const password = 'admin123';

  const existing = await Admin.findOne({ where: { email } });
  if (existing) return;

  const passwordHash = await bcrypt.hash(password, 10);
  await Admin.create({ email, passwordHash });
  console.log('Admin padrão criado:', { email, password });
}

module.exports = {
  sequelize,
  initDb,
  Admin,
  LogEntry,
  ensureDefaultAdmin
};

