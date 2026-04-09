const { validationResult, body } = require('express-validator');
const User = require('../models/User');
const { generateToken } = require('../middleware/auth');

class AuthController {
    
    static registerValidation = [
        body('nama')
            .trim()
            .notEmpty().withMessage('Nama tidak boleh kosong')
            .isLength({ min: 3, max: 100 }).withMessage('Nama harus 3-100 karakter'),
        body('email')
            .trim()
            .notEmpty().withMessage('Email tidak boleh kosong')
            .isEmail().withMessage('Format email tidak valid')
            .normalizeEmail(),
        body('password')
            .notEmpty().withMessage('Password tidak boleh kosong')
            .isLength({ min: 6 }).withMessage('Password minimal 6 karakter'),
        body('no_wa')
            .trim()
            .notEmpty().withMessage('Nomor WhatsApp tidak boleh kosong')
            .matches(/^[0-9+\-\s]+$/).withMessage('Nomor WA hanya boleh berisi angka')
    ];

    
    static loginValidation = [
        body('email')
            .trim()
            .notEmpty().withMessage('Email tidak boleh kosong')
            .isEmail().withMessage('Format email tidak valid'),
        body('password')
            .notEmpty().withMessage('Password tidak boleh kosong')
    ];

    
    static async register(req, res) {
        try {
            
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validasi gagal',
                    errors: errors.array()
                });
            }

            const { nama, email, password, no_wa } = req.body;

            
            const emailExists = await User.emailExists(email);
            if (emailExists) {
                return res.status(409).json({
                    success: false,
                    message: 'Email sudah terdaftar. Silakan gunakan email lain atau login.'
                });
            }

            
            const noWAExists = await User.noWAExists(no_wa);
            if (noWAExists) {
                return res.status(409).json({
                    success: false,
                    message: 'Nomor WhatsApp sudah terdaftar.'
                });
            }

            
            const newUser = await User.create({
                nama,
                email,
                password,
                no_wa
            });

            
            const token = generateToken({
                userId: newUser.id,
                email: newUser.email,
                nama: newUser.nama
            });

            
            res.status(201).json({
                success: true,
                message: 'Registrasi berhasil! Silakan login.',
                data: {
                    user: newUser,
                    token: token
                }
            });

        } catch (error) {
            console.error('Register Error:', error);
            res.status(500).json({
                success: false,
                message: 'Terjadi kesalahan server. Silakan coba lagi.',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    
    static async login(req, res) {
        try {
            
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validasi gagal',
                    errors: errors.array()
                });
            }

            const { email, password } = req.body;

            
            const user = await User.findByEmail(email);
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Email atau password salah.'
                });
            }

            
            const isPasswordValid = await User.verifyPassword(password, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({
                    success: false,
                    message: 'Email atau password salah.'
                });
            }

            
            const token = generateToken({
                userId: user.id,
                email: user.email,
                nama: user.nama
            });

            
            res.status(200).json({
                success: true,
                message: 'Login berhasil!',
                data: {
                    user: {
                        id: user.id,
                        nama: user.nama,
                        email: user.email,
                        no_wa: user.no_wa,
                        created_at: user.created_at
                    },
                    token: token
                }
            });

        } catch (error) {
            console.error('Login Error:', error);
            res.status(500).json({
                success: false,
                message: 'Terjadi kesalahan server. Silakan coba lagi.',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    
    static async getMe(req, res) {
        try {
            const userId = req.user.userId;
            const user = await User.findById(userId);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User tidak ditemukan.'
                });
            }

            res.status(200).json({
                success: true,
                data: { user }
            });

        } catch (error) {
            console.error('GetMe Error:', error);
            res.status(500).json({
                success: false,
                message: 'Terjadi kesalahan server.'
            });
        }
    }

    
    static async updateProfile(req, res) {
        try {
            const userId = req.user.userId;
            const { nama, no_wa } = req.body;

            const updated = await User.update(userId, { nama, no_wa });

            if (!updated) {
                return res.status(400).json({
                    success: false,
                    message: 'Gagal mengupdate profil.'
                });
            }

            const user = await User.findById(userId);

            res.status(200).json({
                success: true,
                message: 'Profil berhasil diupdate.',
                data: { user }
            });

        } catch (error) {
            console.error('UpdateProfile Error:', error);
            res.status(500).json({
                success: false,
                message: 'Terjadi kesalahan server.'
            });
        }
    }

    
    static async changePassword(req, res) {
        try {
            const userId = req.user.userId;
            const { oldPassword, newPassword } = req.body;

            
            const user = await User.findById(userId);
            
            
            const isValid = await User.verifyPassword(oldPassword, user.password);
            if (!isValid) {
                return res.status(400).json({
                    success: false,
                    message: 'Password lama tidak sesuai.'
                });
            }

            
            await User.updatePassword(userId, newPassword);

            res.status(200).json({
                success: true,
                message: 'Password berhasil diubah.'
            });

        } catch (error) {
            console.error('ChangePassword Error:', error);
            res.status(500).json({
                success: false,
                message: 'Terjadi kesalahan server.'
            });
        }
    }
}

module.exports = AuthController;
