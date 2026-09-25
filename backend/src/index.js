const app = require('./app');
const config = require('./config');
const { connectDB } = require('./db/mongoConfig');

const DEFAULT_PORT = parseInt(config.port, 10) || 3000;

function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`
============================================================
🤖 BECKN AGENTIC AI PROCUREMENT PLATFORM IS READY
============================================================
🌐 Dashboard running on: http://localhost:${port}
🚀 Environment:          ${config.env}
🧠 AI LLM Provider:      ${config.ai.provider} (Model: ${config.ai.model})
⚡ Commerce Provider:    ${config.beckn.defaultProvider.toUpperCase()} Network Node
🛡️ Auto-Approval Limit:   ₹${(config.approvalPolicy.autoApprovalLimitPaise / 100).toLocaleString('en-IN')}
🗄️  Database:             MongoDB (${config.db.mongoUri})
============================================================
    `);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`\n⚠️  Port ${port} is already in use.`);
      const nextPort = port + 1;
      console.log(`🔄 Attempting fallback to port ${nextPort}...\n`);
      startServer(nextPort);
    } else {
      console.error('Server error:', err);
    }
  });
}

async function main() {
  try {
    // Connect to MongoDB FIRST before accepting any HTTP traffic
    await connectDB();
    startServer(DEFAULT_PORT);
  } catch (err) {
    console.error('[FATAL] Failed to connect to MongoDB. Cannot start server.', err);
    process.exit(1);
  }
}

main();
