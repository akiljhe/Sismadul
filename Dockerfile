# Pakai Node.js versi 20 yang ramping
FROM node:20-slim

# Install Chromium dan semua library pendukungnya di sistem Linux server
# Ini wajib ada supaya whatsapp-web.js bisa jalan di lingkungan cloud
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Beritahu library Puppeteer supaya pakai Chromium yang sudah kita install tadi
# Dan jangan download Chromium lagi biar hemat memori server
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Tentukan folder kerja di dalam server
WORKDIR /usr/src/app

# Copy file package.json dulu buat install library
COPY package*.json ./
RUN npm install

# Copy semua file kodingan kamu ke dalam server
COPY . .

# Beritahu server untuk jalanin file utama kamu
CMD [ "node", "server.js" ]