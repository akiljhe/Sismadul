-- =====================================================
-- SISMADUL - Database Schema
-- Sistem Mahasiswa Penjadwalan & Notifikasi
-- =====================================================

-- Buat database (jalankan ini terlebih dahulu jika belum ada)
-- CREATE DATABASE IF NOT EXISTS sismadul CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE sismadul;

-- =====================================================
-- TABEL USERS
-- Menyimpan data mahasiswa yang terdaftar
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nama VARCHAR(100) NOT NULL COMMENT 'Nama lengkap mahasiswa',
    email VARCHAR(100) NOT NULL UNIQUE COMMENT 'Email mahasiswa (untuk login)',
    password VARCHAR(255) NOT NULL COMMENT 'Password yang sudah di-hash dengan bcrypt',
    no_wa VARCHAR(20) NOT NULL COMMENT 'Nomor WhatsApp (format: 628xxxxxxxxxx)',
    is_active BOOLEAN DEFAULT TRUE COMMENT 'Status aktif akun',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Index untuk pencarian cepat
    INDEX idx_email (email),
    INDEX idx_no_wa (no_wa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tabel data mahasiswa';

-- =====================================================
-- TABEL SCHEDULES
-- Menyimpan jadwal kuliah setiap mahasiswa
-- =====================================================
CREATE TABLE IF NOT EXISTS schedules (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL COMMENT 'Foreign key ke tabel users',
    matkul VARCHAR(100) NOT NULL COMMENT 'Nama mata kuliah',
    hari ENUM('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu') NOT NULL COMMENT 'Hari kuliah',
    jam_mulai TIME NOT NULL COMMENT 'Jam mulai kuliah (format: HH:MM:SS)',
    jam_selesai TIME COMMENT 'Jam selesai kuliah (opsional)',
    ruangan VARCHAR(50) NOT NULL COMMENT 'Ruangan/Ruang kelas',
    dosen VARCHAR(100) COMMENT 'Nama dosen pengajar (opsional)',
    is_active BOOLEAN DEFAULT TRUE COMMENT 'Status jadwal aktif',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Key Constraint
    CONSTRAINT fk_schedules_user_id 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    
    -- INDEXING untuk performa query yang cepat
    -- Index untuk pencarian berdasarkan user
    INDEX idx_user_id (user_id),
    
    -- Index untuk query pencarian jadwal berdasarkan hari
    INDEX idx_hari (hari),
    
    -- Index untuk query pencarian berdasarkan jam (penting untuk notifikasi)
    INDEX idx_jam_mulai (jam_mulai),
    
    -- Composite Index untuk query notifikasi (JOIN + WHERE hari AND jam_mulai)
    INDEX idx_hari_jam (hari, jam_mulai),
    
    -- Index untuk pencarian kombinasi user dan hari
    INDEX idx_user_hari (user_id, hari)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tabel jadwal kuliah mahasiswa';

-- =====================================================
-- TABEL NOTIFICATION_LOGS (Opsional - untuk tracking)
-- Menyimpan history pengiriman notifikasi
-- =====================================================
CREATE TABLE IF NOT EXISTS notification_logs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    schedule_id INT UNSIGNED NOT NULL COMMENT 'Foreign key ke tabel schedules',
    user_id INT UNSIGNED NOT NULL COMMENT 'Foreign key ke tabel users',
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Waktu notifikasi dikirim',
    status ENUM('pending', 'sent', 'failed') DEFAULT 'pending' COMMENT 'Status pengiriman',
    message TEXT COMMENT 'Isi pesan yang dikirim',
    error_message TEXT COMMENT 'Pesan error jika gagal',
    
    -- Foreign Keys
    CONSTRAINT fk_logs_schedule_id 
        FOREIGN KEY (schedule_id) 
        REFERENCES schedules(id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_logs_user_id 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE,
    
    -- Index untuk tracking
    INDEX idx_sent_at (sent_at),
    INDEX idx_status (status)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Log pengiriman notifikasi';

-- =====================================================
-- VIEW untuk Query Notifikasi (Memudahkan JOIN)
-- =====================================================
CREATE OR REPLACE VIEW vw_schedules_with_users AS
SELECT 
    s.id AS schedule_id,
    s.matkul,
    s.hari,
    s.jam_mulai,
    s.ruangan,
    s.dosen,
    u.id AS user_id,
    u.nama,
    u.no_wa,
    u.email
FROM schedules s
INNER JOIN users u ON s.user_id = u.id
WHERE s.is_active = TRUE AND u.is_active = TRUE;

-- =====================================================
-- CONTOH QUERY UNTUK NOTIFIKASI (15 MENIT SEBELUM KULIAH)
-- =====================================================
-- Query ini digunakan oleh background job untuk mencari
-- jadwal yang akan dimulai dalam 15 menit
-- 
-- SELECT * FROM vw_schedules_with_users
-- WHERE hari = 'Senin'
-- AND jam_mulai BETWEEN '07:45:00' AND '08:15:00';
-- 
-- Atau dengan pendekatan yang lebih presisi:
-- 
-- SELECT * FROM vw_schedules_with_users
-- WHERE hari = 'Senin'
-- AND TIME(jam_mulai) = TIME(DATE_ADD(NOW(), INTERVAL 15 MINUTE));
-- =====================================================
