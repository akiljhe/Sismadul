/**
 * =====================================================
 * SISMADUL - Authentication Middleware
 * Middleware untuk verifikasi JWT token
 * =====================================================
 */

const jwt = require('jsonwebtoken');

/**
 * Middleware untuk memverifikasi JWT token
 * Menambahkan objek 'user' ke request jika token valid
 */
const authenticateToken = (req, res, next) => {
    // Ambil token dari header Authorization
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

    // Jika tidak ada token
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Akses ditolak. Token tidak ditemukan.'
        });
    }

    // Verifikasi token
    jwt.verify(token, process.env.JWT_SECRET || 'sismadul_secret_key', (err, decoded) => {
        if (err) {
            // Jenis error JWT
            let message = 'Token tidak valid.';
            if (err.name === 'TokenExpiredError') {
                message = 'Token sudah expired. Silakan login kembali.';
            } else if (err.name === 'JsonWebTokenError') {
                message = 'Token tidak valid.';
            }

            return res.status(403).json({
                success: false,
                message: message
            });
        }

        // Simpan data user dari token ke request object
        req.user = decoded;
        next();
    });
};

/**
 * Middleware opsional - tidak memblokir jika token tidak ada
 * Tetapi akan menambahkan user data jika token valid
 */
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return next(); // Lanjut tanpa user data
    }

    jwt.verify(token, process.env.JWT_SECRET || 'sismadul_secret_key', (err, decoded) => {
        if (!err) {
            req.user = decoded;
        }
        next();
    });
};

/**
 * Generate JWT token
 * @param {Object} payload - Data yang akan di-encode ke token
 * @param {string} expiresIn - Waktu expired (default: 24 jam)
 * @returns {string} - JWT token
 */
const generateToken = (payload, expiresIn = '24h') => {
    return jwt.sign(
        payload,
        process.env.JWT_SECRET || 'sismadul_secret_key',
        { expiresIn }
    );
};

module.exports = {
    authenticateToken,
    optionalAuth,
    generateToken
};
