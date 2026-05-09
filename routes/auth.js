const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

const adminlar = [
  {
    username: process.env.ADMIN1_USERNAME,
    passwordHash: bcrypt.hashSync(process.env.ADMIN1_PASSWORD, 10)
  },
  {
    username: process.env.ADMIN2_USERNAME,
    passwordHash: bcrypt.hashSync(process.env.ADMIN2_PASSWORD, 10)
  }
];

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli.' });
  }
  const admin = adminlar.find(a => a.username === username);
  if (!admin) {
    return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre.' });
  }
  const eslesme = await bcrypt.compare(password, admin.passwordHash);
  if (!eslesme) {
    return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre.' });
  }
  req.session.user = { username: admin.username };
  res.json({ success: true });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

router.get('/me', (req, res) => {
  if (req.session.user) {
    res.json({ loggedIn: true, username: req.session.user.username });
  } else {
    res.json({ loggedIn: false });
  }
});

module.exports = router;

