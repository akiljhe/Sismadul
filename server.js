/**
 * =====================================================
 * SISMADUL - Main Server
 * Sistem Mahasiswa Penjadwalan & Notifikasi
 * =====================================================
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Import config
const { testConnection } = require('./config/db');

// Import routes
const authRoutes = require('./routes/auth');
const scheduleRoutes = require('./routes/schedules');

// Import services
const whatsappService = require('./services/whatsappService');
const cronService = require('./services/cronService');
const notificationService = require('./services/notificationService');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// =====================================================
// MIDDLEWARE
// =====================================================

// Enable CORS untuk akses dari frontend
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse JSON body
app.use(express.json());

// Parse URL-encoded body
app.use(express.urlencoded({ extended: true }));

// =====================================================
// ROUTES
// =====================================================

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'SISMADUL API is running!',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: {
            auth: '/api/auth',
            schedules: '/api/schedules',
            status: '/api/status',
            whatsapp: '/api/whatsapp/status'
        }
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/schedules', scheduleRoutes);

// Status endpoint (untuk monitoring)
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        data: {
            server: {
                status: 'running',
                uptime: process.uptime(),
                timestamp: new Date().toISOString()
            },
            whatsapp: whatsappService.getStatus(),
            cron: cronService.getStatus(),
            notification: notificationService.getQueueStatus()
        }
    });
});

// WhatsApp status endpoint
app.get('/api/whatsapp/status', (req, res) => {
    const status = whatsappService.getStatus();
    res.json({
        success: true,
        data: status
    });
});

// WhatsApp test message endpoint
app.post('/api/whatsapp/test', async (req, res) => {
    try {
        const { to, message } = req.body;
        
        if (!to || !message) {
            return res.status(400).json({
                success: false,
                message: 'Parameter "to" dan "message" diperlukan'
            });
        }

        const result = await notificationService.sendTestMessage(to, message);
        
        if (result.success) {
            res.json({
                success: true,
                message: 'Pesan berhasil dikirim',
                data: result.data
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Gagal mengirim pesan',
                error: result.error
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan',
            error: error.message
        });
    }
});

// Cron control endpoints (untuk admin)
app.post('/api/cron/start', (req, res) => {
    cronService.start();
    res.json({
        success: true,
        message: 'Cron job dimulai',
        data: cronService.getStatus()
    });
});

app.post('/api/cron/stop', (req, res) => {
    cronService.stop();
    res.json({
        success: true,
        message: 'Cron job dihentikan',
        data: cronService.getStatus()
    });
});

app.post('/api/cron/check', async (req, res) => {
    await cronService.runManualCheck();
    res.json({
        success: true,
        message: 'Manual check selesai'
    });
});

// =====================================================
// ERROR HANDLING
// =====================================================

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint tidak ditemukan',
        path: req.originalUrl
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// =====================================================
// SERVER STARTUP
// =====================================================

const startServer = async () => {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                                                            ║');
    console.log('║     🎓 SISMADUL - Sistem Mahasiswa Penjadwalan           ║');
    console.log('║              & Notifikasi WhatsApp                         ║');
    console.log('║                                                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');

    // Test database connection
    console.log('📡 Menghubungkan ke database...');
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
        console.error('');
        console.error('❌ Gagal terhubung ke database!');
        console.error('   Pastikan MySQL sudah running dan konfigurasi .env benar.');
        console.error('');
        process.exit(1);
    }

    // Start HTTP server
    app.listen(PORT, () => {
        console.log('');
        console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
        console.log('');
        console.log('📚 API Endpoints:');
        console.log(`   • GET  http://localhost:${PORT}/           - Health check`);
        console.log(`   • GET  http://localhost:${PORT}/api/status - System status`);
        console.log(`   • POST http://localhost:${PORT}/api/auth/register - Register`);
        console.log(`   • POST http://localhost:${PORT}/api/auth/login    - Login`);
        console.log(`   • GET  http://localhost:${PORT}/api/schedules     - Get schedules`);
        console.log(`   • POST http://localhost:${PORT}/api/schedules     - Create schedule`);
        console.log('');
    });

    // Initialize WhatsApp (async, tidak blocking)
    console.log('📱 Menginisialisasi WhatsApp...');
    // WhatsApp service sudah diinisialisasi saat import
    
    // Start cron job setelah delay (tunggu WhatsApp siap)
    setTimeout(() => {
        cronService.start();
    }, 5000);
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    console.log('');
    console.log('🛑 SIGTERM received. Shutting down gracefully...');
    cronService.stop();
    await whatsappService.logout();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('');
    console.log('🛑 SIGINT received. Shutting down gracefully...');
    cronService.stop();
    await whatsappService.logout();
    process.exit(0);
});

// Start the server
startServer();
