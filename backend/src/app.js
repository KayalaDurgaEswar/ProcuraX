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

// Serve only the canonical Angular production build. Never expose the raw
// frontend source tree as a fallback.
const angularBrowserPath = path.join(
  __dirname,
  '../../frontend/dist/procure-ai-angular/browser'
);
const angularDistPath = path.join(
  __dirname,
  '../../frontend/dist/procure-ai-angular'
);

const staticPath = fs.existsSync(path.join(angularBrowserPath, 'index.html'))
  ? angularBrowserPath
  : fs.existsSync(path.join(angularDistPath, 'index.html'))
    ? angularDistPath
    : null;

if (staticPath) {
  console.log(`[Express] Serving Angular frontend from: ${staticPath}`);
  app.use(express.static(staticPath));
} else {
  console.warn(
    '[Express] Angular build not found. Run "npm run build" in frontend/ before opening the dashboard.'
  );
}

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
    frontendReady: Boolean(staticPath),
    timestamp: new Date().toISOString()
  });
});

// Angular SPA fallback.
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/beckn')) {
    return next();
  }

  if (!staticPath) {
    return res.status(503).json({
      error: 'Angular frontend build not found',
      action: 'Run "npm install && npm run build" inside frontend/'
    });
  }

  return res.sendFile(path.join(staticPath, 'index.html'));
});

module.exports = app;
