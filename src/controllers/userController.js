exports.me = (req, res) => {
  res.json({ user: req.user });
};

