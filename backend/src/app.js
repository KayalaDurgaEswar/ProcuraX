const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const procurementRoutes = require('./routes/procurementRoutes');
const becknRoutes = require('./routes/becknRoutes');

const app = express();

app.use(cors());
app.use(express.json({
  verify: (req, res, buffer) => {
    req.rawBody = Buffer.from(buffer);
  }
}));

// Determine Angular build directory path
const angularBrowserPath = path.join(__dirname, '../../frontend/dist/procure-ai-angular/browser');
const angularDistPath = path.join(__dirname, '../../frontend/dist/procure-ai-angular');
const rawFrontendPath = path.join(__dirname, '../../frontend');

let staticPath = rawFrontendPath;
if (fs.existsSync(angularBrowserPath)) {
  staticPath = angularBrowserPath;
} else if (fs.existsSync(angularDistPath)) {
  staticPath = angularDistPath;
}

console.log(`[Express] Serving static frontend from: ${staticPath}`);
app.use(express.static(staticPath));

// API Routes
app.use('/api', procurementRoutes);
app.use('/beckn', becknRoutes);

// Healthcheck
app.get('/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'Agentic AI Procurement Agent',
    protocol: 'Beckn / ONDC',
    frontend: 'Angular 17 Enterprise Dashboard',
    timestamp: new Date().toISOString()
  });
});

// Fallback to Angular SPA index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/beckn')) {
    return next();
  }
  const indexPath = path.join(staticPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.sendFile(path.join(rawFrontendPath, 'index.html'));
});

module.exports = app;
