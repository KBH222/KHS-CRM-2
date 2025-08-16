export default function handler(req, res) {
  res.status(200).json({ 
    message: 'API is working!',
    path: req.url,
    method: req.method,
    time: new Date().toISOString()
  });
}