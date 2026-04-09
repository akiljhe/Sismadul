

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

class WhatsAppService {
    constructor() {
        this.client = null;
        this.isReady = false;
        this.isInitializing = false;
        this.qrCodeData = null;
        this.init();
    }

    /**
     * Inisialisasi WhatsApp client
     */
    init() {
        if (this.isInitializing || this.client) {
            console.log('⚠️  WhatsApp client sudah diinisialisasi atau sedang inisialisasi');
            return;
        }

        this.isInitializing = true;
        console.log('🚀 Memulai inisialisasi WhatsApp...');
        console.log('   Mode: Headless (tanpa GUI)');
        console.log('   Session: LocalAuth (data tersimpan di .wwebjs_auth)');
        console.log('');

        // Konfigurasi client dengan LocalAuth untuk menyimpan session
        // Sehingga tidak perlu scan QR setiap restart
        this.client = new Client({
            authStrategy: new LocalAuth({
                dataPath: './.wwebjs_auth'
            }),
            puppeteer: {
                headless: true,  // Mode tanpa GUI
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu'
                ]
            }
        });

        // Event: QR Code generated
        this.client.on('qr', (qr) => {
            this.qrCodeData = qr;
            console.log('');
            console.log('╔════════════════════════════════════════════════════════════╗');
            console.log('║                    SCAN QR CODE INI                        ║');
            console.log('║              Buka WhatsApp > Menu > Linked Devices         ║');
            console.log('╚════════════════════════════════════════════════════════════╝');
            console.log('');
            
            // Tampilkan QR Code di terminal
            qrcode.generate(qr, { small: true });
            
            console.log('');
            console.log('⏳ Menunggu scan QR Code...');
        });

        // Event: Client ready
        this.client.on('ready', () => {
            this.isReady = true;
            this.isInitializing = false;
            this.qrCodeData = null;
            console.log('');
            console.log('✅ WhatsApp Client siap!');
            console.log('   Status: Connected');
            console.log('   Notifikasi aktif dan berjalan...');
            console.log('');
        });

        // Event: Authentication failure
        this.client.on('auth_failure', (msg) => {
            this.isReady = false;
            this.isInitializing = false;
            console.error('❌ Autentikasi WhatsApp gagal:', msg);
            console.log('   Silakan restart aplikasi dan scan QR code lagi.');
        });

        // Event: Disconnected
        this.client.on('disconnected', (reason) => {
            this.isReady = false;
            this.isInitializing = false;
            console.log('');
            console.log('⚠️  WhatsApp terputus:', reason);
            console.log('   Mencoba menghubungkan kembali...');
            console.log('');
            
            // Reinitialize setelah 5 detik
            setTimeout(() => {
                this.client = null;
                this.init();
            }, 5000);
        });

        // Event: Loading screen
        this.client.on('loading_screen', (percent, message) => {
            console.log(`⏳ Loading: ${percent}% - ${message}`);
        });

        // Initialize client
        this.client.initialize().catch(err => {
            console.error('❌ Gagal menginisialisasi WhatsApp:', err.message);
            this.isInitializing = false;
        });
    }

    /**
     * Kirim pesan WhatsApp
     * @param {string} to - Nomor tujuan (format: 628xxxxxxxxxx@c.us)
     * @param {string} message - Isi pesan
     * @returns {Promise<Object>}
     */
    async sendMessage(to, message) {
        if (!this.isReady) {
            throw new Error('WhatsApp client belum siap. Silakan tunggu atau scan QR code.');
        }

        try {
            // Format nomor jika belum ada @c.us
            const chatId = to.includes('@c.us') ? to : `${to}@c.us`;
            
            const response = await this.client.sendMessage(chatId, message);
            
            return {
                success: true,
                messageId: response.id.id,
                timestamp: response.timestamp,
                to: to
            };
        } catch (error) {
            console.error('Error sending message:', error);
            throw new Error(`Gagal mengirim pesan: ${error.message}`);
        }
    }

    /**
     * Cek status koneksi WhatsApp
     * @returns {Object}
     */
    getStatus() {
        return {
            isReady: this.isReady,
            isInitializing: this.isInitializing,
            hasQRCode: !!this.qrCodeData
        };
    }

    /**
     * Get QR Code (jika ada)
     * @returns {string|null}
     */
    getQRCode() {
        return this.qrCodeData;
    }

    /**
     * Logout dan hapus session
     */
    async logout() {
        if (this.client) {
            try {
                await this.client.logout();
                console.log('✅ Berhasil logout dari WhatsApp');
            } catch (error) {
                console.error('Error logout:', error);
            }
        }
    }

    /**
     * Get info tentang client yang terhubung
     */
    async getInfo() {
        if (!this.isReady) {
            return null;
        }

        try {
            return await this.client.getState();
        } catch (error) {
            console.error('Error getting info:', error);
            return null;
        }
    }
}

// Export singleton instance
module.exports = new WhatsAppService();
