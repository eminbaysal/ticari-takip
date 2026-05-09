function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  res.status(401).json({ error: 'Yetkisiz erişim. Lütfen giriş yapın.' });
}

module.exports = requireAuth;
