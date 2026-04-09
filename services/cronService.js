/**
 * =====================================================
 * SISMADUL - Cron Service
 * Background Job menggunakan node-cron
 * Mengecek jadwal setiap menit dan mengirim notifikasi
 * =====================================================
 */

const cron = require('node-cron');
const notificationService = require('./notificationService');

class CronService {
    constructor() {
        this.task = null;
        this.isRunning = false;
        this.lastRun = null;
        this.runCount = 0;
    }

    /**
     * Start cron job
     * Mengecek jadwal setiap menit pada detik ke-0
     */
    start() {
        if (this.isRunning) {
            console.log('⚠️  Cron job sudah berjalan');
            return;
        }

        console.log('');
        console.log('⏰ Cron Service: Starting...');
        console.log('   Schedule: Setiap menit (*/1 * * * *)');
        console.log('   Fungsi: Cek jadwal 15 menit sebelum kuliah');
        console.log('');

        // Cron pattern: */1 * * * *
        // */1 = setiap 1 menit
        // *   = setiap jam
        // *   = setiap hari
        // *   = setiap bulan
        // *   = setiap hari dalam minggu
        this.task = cron.schedule('*/1 * * * *', async () => {
            this.lastRun = new Date();
            this.runCount++;
            
            console.log(`\n[CRON] Run #${this.runCount} - ${this.lastRun.toLocaleString('id-ID')}`);
            console.log('─────────────────────────────────────────');
            
            await notificationService.checkAndSendNotifications();
            
            console.log('─────────────────────────────────────────');
            console.log(`[CRON] Selesai - ${new Date().toLocaleString('id-ID')}\n`);
        }, {
            scheduled: true,
            timezone: 'Asia/Jakarta' // WIB (UTC+7)
        });

        this.isRunning = true;
        
        console.log('✅ Cron job berhasil dijalankan!');
        console.log('   Timezone: Asia/Jakarta (WIB)');
        console.log('   Status: ACTIVE');
        console.log('');
        console.log('💡 Tips:');
        console.log('   - Pastikan WhatsApp sudah terhubung');
        console.log('   - Sistem akan otomatis cek setiap menit');
        console.log('   - Notifikasi dikirim 15 menit sebelum kuliah');
        console.log('');
    }

    /**
     * Stop cron job
     */
    stop() {
        if (this.task) {
            this.task.stop();
            this.isRunning = false;
            console.log('⏹️  Cron job dihentikan');
        }
    }

    /**
     * Restart cron job
     */
    restart() {
        this.stop();
        setTimeout(() => this.start(), 1000);
    }

    /**
     * Get status cron job
     * @returns {Object}
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            lastRun: this.lastRun,
            runCount: this.runCount,
            schedule: '*/1 * * * * (Setiap menit)',
            timezone: 'Asia/Jakarta'
        };
    }

    /**
     * Run manual check (untuk testing)
     */
    async runManualCheck() {
        console.log('');
        console.log('🧪 Manual Check Triggered');
        console.log('─────────────────────────────────────────');
        
        await notificationService.checkAndSendNotifications();
        
        console.log('─────────────────────────────────────────');
        console.log('');
    }
}

// Export singleton instance
module.exports = new CronService();
