/**
 * =====================================================
 * SISMADUL - Notification Service
 * Service untuk mengelola pengiriman notifikasi dengan
 * sistem antrean (Queue) untuk mencegah spam
 * =====================================================
 */

const Schedule = require('../models/Schedule');
const whatsappService = require('./whatsappService');

class NotificationService {
    constructor() {
        // Queue untuk menyimpan pesan yang akan dikirim
        this.messageQueue = [];
        
        // Status apakah sedang memproses queue
        this.isProcessing = false;
        
        // Delay antar pengiriman (dalam ms) - 3-5 detik
        this.minDelay = 3000;  // 3 detik
        this.maxDelay = 5000;  // 5 detik
        
        // Tracking untuk mencegah duplikat dalam satu menit
        this.sentNotifications = new Map();
        
        // Interval pembersihan cache (setiap 10 menit)
        setInterval(() => this.cleanupCache(), 10 * 60 * 1000);
    }

    /**
     * Generate delay acak antara minDelay dan maxDelay
     * @returns {number}
     */
    getRandomDelay() {
        return Math.floor(Math.random() * (this.maxDelay - this.minDelay + 1)) + this.minDelay;
    }

    /**
     * Format pesan notifikasi
     * @param {Object} schedule - Data jadwal
     * @returns {string}
     */
    formatMessage(schedule) {
        const { matkul, hari, jam_mulai, ruangan, dosen, user_nama } = schedule;
        
        // Format jam (hanya HH:MM)
        const jam = jam_mulai.substring(0, 5);
        
        let message = `📚 *PENGINGAT KULIAH* 📚\n\n`;
        message += `Halo ${user_nama || 'Mahasiswa'}!\n\n`;
        message += `⏰ Kuliah akan dimulai *15 menit lagi*\n\n`;
        message += `📖 *Mata Kuliah:* ${matkul}\n`;
        message += `📅 *Hari:* ${hari}\n`;
        message += `🕐 *Jam:* ${jam}\n`;
        message += `🏫 *Ruangan:* ${ruangan}\n`;
        
        if (dosen) {
            message += `👨‍🏫 *Dosen:* ${dosen}\n`;
        }
        
        message += `\nSemangat belajar! 💪📖`;
        
        return message;
    }

    /**
     * Cek apakah notifikasi sudah dikirim dalam 5 menit terakhir
     * Mencegah duplikat jika cron job berjalan lebih dari sekali
     * @param {number} scheduleId - ID jadwal
     * @returns {boolean}
     */
    isRecentlySent(scheduleId) {
        const key = `${scheduleId}_${this.getCurrentTimeKey()}`;
        return this.sentNotifications.has(key);
    }

    /**
     * Tandai notifikasi sebagai sudah dikirim
     * @param {number} scheduleId - ID jadwal
     */
    markAsSent(scheduleId) {
        const key = `${scheduleId}_${this.getCurrentTimeKey()}`;
        this.sentNotifications.set(key, Date.now());
    }

    /**
     * Get current time key (untuk tracking)
     * Format: YYYY-MM-DD_HH-MM (per menit)
     * @returns {string}
     */
    getCurrentTimeKey() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    }

    /**
     * Bersihkan cache notifikasi yang sudah lama (> 10 menit)
     */
    cleanupCache() {
        const now = Date.now();
        const maxAge = 10 * 60 * 1000; // 10 menit
        
        for (const [key, timestamp] of this.sentNotifications.entries()) {
            if (now - timestamp > maxAge) {
                this.sentNotifications.delete(key);
            }
        }
        
        console.log(`🧹 Cache notifikasi dibersihkan. Sisa: ${this.sentNotifications.size} items`);
    }

    /**
     * Tambahkan pesan ke queue
     * @param {Object} schedule - Data jadwal lengkap dengan user info
     */
    enqueue(schedule) {
        // Cek duplikat
        if (this.isRecentlySent(schedule.schedule_id)) {
            console.log(`⚠️  Notifikasi untuk jadwal #${schedule.schedule_id} sudah dikirim, melewati...`);
            return;
        }

        const messageData = {
            scheduleId: schedule.schedule_id,
            to: schedule.user_no_wa,
            message: this.formatMessage(schedule),
            userName: schedule.user_nama,
            matkul: schedule.matkul,
            timestamp: Date.now()
        };

        this.messageQueue.push(messageData);
        console.log(`📥 Pesan ditambahkan ke antrean: ${schedule.user_nama} - ${schedule.matkul}`);

        // Mulai proses queue jika belum berjalan
        if (!this.isProcessing) {
            this.processQueue();
        }
    }

    /**
     * Proses queue dengan delay antar pesan
     * Ini adalah logika ANTI-SPAM yang penting!
     */
    async processQueue() {
        if (this.isProcessing || this.messageQueue.length === 0) {
            return;
        }

        this.isProcessing = true;
        console.log('');
        console.log(`🔄 Memulai pengiriman ${this.messageQueue.length} pesan...`);
        console.log('   (Dengan delay 3-5 detik antar pesan untuk mencegah spam)');
        console.log('');

        while (this.messageQueue.length > 0) {
            const messageData = this.messageQueue.shift();
            
            try {
                // Cek apakah WhatsApp siap
                const status = whatsappService.getStatus();
                if (!status.isReady) {
                    console.log('⚠️  WhatsApp belum siap, menunda pengiriman...');
                    // Kembalikan ke queue dan coba lagi nanti
                    this.messageQueue.unshift(messageData);
                    await this.sleep(10000); // Tunggu 10 detik
                    continue;
                }

                // Kirim pesan
                console.log(`📤 Mengirim ke ${messageData.userName} (${messageData.to})...`);
                const result = await whatsappService.sendMessage(messageData.to, messageData.message);
                
                // Tandai sebagai sudah dikirim
                this.markAsSent(messageData.scheduleId);
                
                console.log(`✅ Berhasil: ${messageData.userName} - ${messageData.matkul}`);

                // Delay acak sebelum pengiriman berikutnya (ANTI-SPAM)
                if (this.messageQueue.length > 0) {
                    const delay = this.getRandomDelay();
                    console.log(`⏳ Menunggu ${delay / 1000} detik...`);
                    await this.sleep(delay);
                }

            } catch (error) {
                console.error(`❌ Gagal kirim ke ${messageData.userName}:`, error.message);
                
                // Jika gagal, bisa dicoba lagi (max 3 kali)
                messageData.retryCount = (messageData.retryCount || 0) + 1;
                if (messageData.retryCount < 3) {
                    this.messageQueue.push(messageData);
                    console.log(`   🔄 Akan dicoba lagi (${messageData.retryCount}/3)`);
                } else {
                    console.log(`   ❌ Gagal setelah 3 kali percobaan`);
                }
                
                // Delay lebih lama jika error
                await this.sleep(5000);
            }
        }

        this.isProcessing = false;
        console.log('');
        console.log('✅ Semua pesan dalam antrean telah diproses.');
        console.log('');
    }

    /**
     * Cek dan kirim notifikasi untuk jadwal yang akan dimulai
     * Fungsi ini dipanggil oleh cron job setiap menit
     */
    async checkAndSendNotifications() {
        try {
            const now = new Date();
            
            // Get nama hari dalam bahasa Indonesia
            const hariIndonesia = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const hariIni = hariIndonesia[now.getDay()];
            
            // Hitung waktu 15 menit dari sekarang
            const waktu15MenitLagi = new Date(now.getTime() + 15 * 60000);
            
            // Format jam untuk query
            const jamMulaiLower = this.formatTimeForQuery(waktu15MenitLagi, -2); // -2 menit tolerance
            const jamMulaiUpper = this.formatTimeForQuery(waktu15MenitLagi, 2);  // +2 menit tolerance
            
            console.log('');
            console.log('🔍 Mengecek jadwal kuliah...');
            console.log(`   Hari: ${hariIni}`);
            console.log(`   Waktu target: ${this.formatTimeForQuery(waktu15MenitLagi, 0)} (±2 menit)`);
            console.log(`   Range: ${jamMulaiLower} - ${jamMulaiUpper}`);

            // Query jadwal yang akan dimulai dalam 15 menit
            const schedules = await Schedule.getSchedulesForNotification(
                hariIni,
                jamMulaiLower,
                jamMulaiUpper
            );

            if (schedules.length === 0) {
                console.log('   📭 Tidak ada jadwal yang perlu diberi notifikasi.');
                return;
            }

            console.log(`   📋 Ditemukan ${schedules.length} jadwal yang akan dikirim notifikasi.`);
            console.log('');

            // Tambahkan ke queue untuk diproses
            schedules.forEach(schedule => {
                this.enqueue(schedule);
            });

        } catch (error) {
            console.error('❌ Error checking schedules:', error);
        }
    }

    /**
     * Format waktu untuk query SQL
     * @param {Date} date - Objek Date
     * @param {number} offsetMinutes - Offset dalam menit
     * @returns {string} - Format HH:MM:SS
     */
    formatTimeForQuery(date, offsetMinutes = 0) {
        const adjusted = new Date(date.getTime() + offsetMinutes * 60000);
        const hours = String(adjusted.getHours()).padStart(2, '0');
        const minutes = String(adjusted.getMinutes()).padStart(2, '0');
        const seconds = String(adjusted.getSeconds()).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    /**
     * Utility: Sleep function
     * @param {number} ms - Milliseconds
     * @returns {Promise}
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get status queue
     * @returns {Object}
     */
    getQueueStatus() {
        return {
            queueLength: this.messageQueue.length,
            isProcessing: this.isProcessing,
            sentCount: this.sentNotifications.size
        };
    }

    /**
     * Test kirim pesan manual
     * @param {string} to - Nomor tujuan
     * @param {string} message - Pesan
     */
    async sendTestMessage(to, message) {
        try {
            const result = await whatsappService.sendMessage(to, message);
            return {
                success: true,
                data: result
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Export singleton instance
module.exports = new NotificationService();
