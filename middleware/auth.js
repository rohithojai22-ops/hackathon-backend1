import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'devjwt';

export const auth = (requiredRole = null) => {
  return (req, res, next) => {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
      const data = jwt.verify(token, JWT_SECRET);
      if (requiredRole && data.role !== requiredRole) return res.status(403).json({ error: 'Forbidden' });
      req.user = data;
      return next();
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
};

export const signToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};

