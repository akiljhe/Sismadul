/**
 * =====================================================
 * SISMADUL - Schedule Controller
 * Controller untuk mengelola jadwal kuliah (CRUD)
 * =====================================================
 */

const { validationResult, body, param } = require('express-validator');
const Schedule = require('../models/Schedule');

class ScheduleController {
    /**
     * Validation rules untuk create schedule
     */
    static createValidation = [
        body('matkul')
            .trim()
            .notEmpty().withMessage('Nama mata kuliah tidak boleh kosong')
            .isLength({ min: 2, max: 100 }).withMessage('Nama matkul 2-100 karakter'),
        body('hari')
            .trim()
            .notEmpty().withMessage('Hari tidak boleh kosong')
            .isIn(['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'])
            .withMessage('Hari harus: Senin, Selasa, Rabu, Kamis, Jumat, Sabtu, atau Minggu'),
        body('jam_mulai')
            .trim()
            .notEmpty().withMessage('Jam mulai tidak boleh kosong')
            .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/)
            .withMessage('Format jam mulai harus HH:MM atau HH:MM:SS'),
        body('jam_selesai')
            .optional()
            .trim()
            .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/)
            .withMessage('Format jam selesai harus HH:MM atau HH:MM:SS'),
        body('ruangan')
            .trim()
            .notEmpty().withMessage('Ruangan tidak boleh kosong')
            .isLength({ min: 1, max: 50 }).withMessage('Ruangan maksimal 50 karakter'),
        body('dosen')
            .optional()
            .trim()
            .isLength({ max: 100 }).withMessage('Nama dosen maksimal 100 karakter')
    ];

    /**
     * Validation rules untuk update schedule
     */
    static updateValidation = [
        param('id').isInt().withMessage('ID jadwal harus berupa angka'),
        body('matkul')
            .optional()
            .trim()
            .isLength({ min: 2, max: 100 }),
        body('hari')
            .optional()
            .trim()
            .isIn(['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']),
        body('jam_mulai')
            .optional()
            .trim()
            .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/),
        body('jam_selesai')
            .optional()
            .trim()
            .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/),
        body('ruangan')
            .optional()
            .trim()
            .isLength({ min: 1, max: 50 }),
        body('dosen')
            .optional()
            .trim()
            .isLength({ max: 100 })
    ];

    /**
     * Create new schedule
     * POST /api/schedules
     */
    static async create(req, res) {
        try {
            // Check validation errors
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validasi gagal',
                    errors: errors.array()
                });
            }

            const userId = req.user.userId;
            const { matkul, hari, jam_mulai, jam_selesai, ruangan, dosen } = req.body;

            // Format jam_mulai (tambahkan :00 jika hanya HH:MM)
            const formattedJamMulai = jam_mulai.includes(':') && jam_mulai.split(':').length === 2 
                ? `${jam_mulai}:00` 
                : jam_mulai;

            const formattedJamSelesai = jam_selesai 
                ? (jam_selesai.includes(':') && jam_selesai.split(':').length === 2 
                    ? `${jam_selesai}:00` 
                    : jam_selesai)
                : null;

            // Buat schedule baru
            const newSchedule = await Schedule.create({
                user_id: userId,
                matkul,
                hari,
                jam_mulai: formattedJamMulai,
                jam_selesai: formattedJamSelesai,
                ruangan,
                dosen
            });

            res.status(201).json({
                success: true,
                message: 'Jadwal berhasil ditambahkan!',
                data: { schedule: newSchedule }
            });

        } catch (error) {
            console.error('Create Schedule Error:', error);
            res.status(500).json({
                success: false,
                message: 'Terjadi kesalahan server.',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Get all schedules for current user
     * GET /api/schedules
     */
    static async getAll(req, res) {
        try {
            const userId = req.user.userId;
            const { hari } = req.query;

            const schedules = await Schedule.getByUserId(userId, { 
                hari: hari || null,
                is_active: true 
            });

            res.status(200).json({
                success: true,
                count: schedules.length,
                data: { schedules }
            });

        } catch (error) {
            console.error('Get All Schedules Error:', error);
            res.status(500).json({
                success: false,
                message: 'Terjadi kesalahan server.'
            });
        }
    }

    /**
     * Get schedule by ID
     * GET /api/schedules/:id
     */
    static async getById(req, res) {
        try {
            const scheduleId = req.params.id;
            const userId = req.user.userId;

            // Check if schedule belongs to user
            const belongsToUser = await Schedule.belongsToUser(scheduleId, userId);
            if (!belongsToUser) {
                return res.status(403).json({
                    success: false,
                    message: 'Anda tidak memiliki akses ke jadwal ini.'
                });
            }

            const schedule = await Schedule.findById(scheduleId);
            if (!schedule) {
                return res.status(404).json({
                    success: false,
                    message: 'Jadwal tidak ditemukan.'
                });
            }

            res.status(200).json({
                success: true,
                data: { schedule }
            });

        } catch (error) {
            console.error('Get Schedule Error:', error);
            res.status(500).json({
                success: false,
                message: 'Terjadi kesalahan server.'
            });
        }
    }

    /**
     * Update schedule
     * PUT /api/schedules/:id
     */
    static async update(req, res) {
        try {
            // Check validation errors
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validasi gagal',
                    errors: errors.array()
                });
            }

            const scheduleId = req.params.id;
            const userId = req.user.userId;

            // Check if schedule belongs to user
            const belongsToUser = await Schedule.belongsToUser(scheduleId, userId);
            if (!belongsToUser) {
                return res.status(403).json({
                    success: false,
                    message: 'Anda tidak memiliki akses untuk mengubah jadwal ini.'
                });
            }

            const updateData = {};
            const fields = ['matkul', 'hari', 'jam_mulai', 'jam_selesai', 'ruangan', 'dosen'];

            fields.forEach(field => {
                if (req.body[field] !== undefined) {
                    if (field === 'jam_mulai' || field === 'jam_selesai') {
                        // Format jam
                        const jam = req.body[field];
                        updateData[field] = jam && jam.includes(':') && jam.split(':').length === 2 
                            ? `${jam}:00` 
                            : jam;
                    } else {
                        updateData[field] = req.body[field];
                    }
                }
            });

            const updated = await Schedule.update(scheduleId, updateData);

            if (!updated) {
                return res.status(400).json({
                    success: false,
                    message: 'Gagal mengupdate jadwal.'
                });
            }

            const schedule = await Schedule.findById(scheduleId);

            res.status(200).json({
                success: true,
                message: 'Jadwal berhasil diupdate!',
                data: { schedule }
            });

        } catch (error) {
            console.error('Update Schedule Error:', error);
            res.status(500).json({
                success: false,
                message: 'Terjadi kesalahan server.'
            });
        }
    }

    /**
     * Delete schedule (soft delete)
     * DELETE /api/schedules/:id
     */
    static async delete(req, res) {
        try {
            const scheduleId = req.params.id;
            const userId = req.user.userId;

            // Check if schedule belongs to user
            const belongsToUser = await Schedule.belongsToUser(scheduleId, userId);
            if (!belongsToUser) {
                return res.status(403).json({
                    success: false,
                    message: 'Anda tidak memiliki akses untuk menghapus jadwal ini.'
                });
            }

            const deleted = await Schedule.delete(scheduleId);

            if (!deleted) {
                return res.status(400).json({
                    success: false,
                    message: 'Gagal menghapus jadwal.'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Jadwal berhasil dihapus.'
            });

        } catch (error) {
            console.error('Delete Schedule Error:', error);
            res.status(500).json({
                success: false,
                message: 'Terjadi kesalahan server.'
            });
        }
    }

    /**
     * Get schedules grouped by day
     * GET /api/schedules/by-day
     */
    static async getByDay(req, res) {
        try {
            const userId = req.user.userId;
            const schedules = await Schedule.getByUserId(userId, { is_active: true });

            // Group by day
            const grouped = {
                Senin: [],
                Selasa: [],
                Rabu: [],
                Kamis: [],
                Jumat: [],
                Sabtu: [],
                Minggu: []
            };

            schedules.forEach(schedule => {
                if (grouped[schedule.hari]) {
                    grouped[schedule.hari].push(schedule);
                }
            });

            res.status(200).json({
                success: true,
                data: { schedules_by_day: grouped }
            });

        } catch (error) {
            console.error('Get By Day Error:', error);
            res.status(500).json({
                success: false,
                message: 'Terjadi kesalahan server.'
            });
        }
    }
}

module.exports = ScheduleController;
