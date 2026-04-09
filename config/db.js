/**
 * =====================================================
 * SISMADUL - Database Configuration
 * Konfigurasi koneksi MySQL dengan connection pooling
 * untuk performa yang lebih baik saat multi-user
 * =====================================================
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// Konfigurasi Connection Pool
// Pooling sangat penting untuk aplikasi dengan banyak user
// karena mengelola koneksi database secara efisien
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sismadul',
    port: process.env.DB_PORT || 3306,
    
    // Konfigurasi Pooling untuk performa optimal
    waitForConnections: true,      // Tunggu koneksi tersedia jika pool penuh
    connectionLimit: 20,           // Maksimal 20 koneksi simultan
    queueLimit: 0,                 // Tidak ada batas antrian (0 = unlimited)
    
    // Timeout settings
    connectTimeout: 10000,         // 10 detik timeout untuk koneksi baru
    acquireTimeout: 10000,         // 10 detik timeout untuk mendapatkan koneksi dari pool
    
    // Keep-alive untuk mencegah koneksi putus
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000   // 10 detik
});

// Test koneksi saat aplikasi start
const testConnection = async () => {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Database connected successfully!');
        console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
        console.log(`   Database: ${process.env.DB_NAME || 'sismadul'}`);
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        console.error('   Pastikan MySQL sudah running dan konfigurasi .env benar.');
        return false;
    }
};

// Helper function untuk query dengan error handling
const query = async (sql, params = []) => {
    try {
        const [results] = await pool.execute(sql, params);
        return results;
    } catch (error) {
        console.error('Database Query Error:', error.message);
        throw error;
    }
};

// Helper function untuk transaction
const transaction = async (callback) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const result = await callback(connection);
        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

module.exports = {
    pool,
    query,
    transaction,
    testConnection
};
