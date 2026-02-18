# TikSave 🎵 - موقع تحميل تيك توك

## هيكل المشروع
```
📁 tiksave/
├── server.js          ← Backend (Node.js + Express)
├── package.json       ← اعدادات npm
├── README.md
└── public/
    └── index.html     ← Frontend (HTML/CSS/JS)
```

---

## التثبيت والتشغيل

### 1. تثبيت Node.js dependencies
```bash
npm install
```

### 2. تثبيت yt-dlp (مطلوب لاستخراج الفيديوهات)
```bash
# على Mac
brew install yt-dlp

# على Linux/Ubuntu
sudo apt install yt-dlp
# أو
pip install yt-dlp

# على Windows
pip install yt-dlp
# أو حمّل yt-dlp.exe من: https://github.com/yt-dlp/yt-dlp/releases
```

### 3. شغّل السيرفر
```bash
node server.js
# أو للـ dev مع auto-reload:
npm run dev
```

### 4. افتح المتصفح
```
http://localhost:3000
```

---

## كيف يعمل؟

```
المستخدم يلصق رابط تيك توك
        ↓
Frontend يرسل POST /api/download
        ↓
Express يستقبل الطلب
        ↓
server.js يشغّل yt-dlp على الرابط
        ↓
yt-dlp يستخرج روابط التحميل المباشرة من TikTok
        ↓
السيرفر يرجع الروابط للـ Frontend
        ↓
المستخدم يضغط تحميل ← يحمّل مباشرة من TikTok
```

### لماذا yt-dlp وليس API رسمية؟
TikTok لا تقدم API عامة للتحميل. yt-dlp هي أداة مفتوحة المصدر تستطيع:
- استخراج رابط الفيديو المباشر بدون علامة مائية
- استخراج الصوت MP3
- دعم أكثر من 1000 موقع

---

## النشر على الإنترنت

### Railway.app (مجاني وسهل)
```bash
# 1. ارفع الكود على GitHub
# 2. ادخل railway.app وربط الـ repo
# 3. Railway يشغّل npm start تلقائياً
# ملاحظة: تحتاج تثبيت yt-dlp في Dockerfile
```

### Dockerfile للنشر
```dockerfile
FROM node:18-alpine

# تثبيت python و yt-dlp
RUN apk add --no-cache python3 py3-pip ffmpeg
RUN pip3 install yt-dlp

WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
```

### VPS (DigitalOcean / Hetzner)
```bash
# على السيرفر
git clone <your-repo>
cd tiksave
npm install
pip install yt-dlp
# شغّل مع PM2
npm install -g pm2
pm2 start server.js --name tiksave
pm2 startup
```

---

## المتغيرات البيئية (اختياري)
```bash
PORT=3000        # رقم البورت (افتراضي 3000)
```

---

## ملاحظات قانونية
- المشروع للأغراض التعليمية
- احترم حقوق الملكية الفكرية لصانعي المحتوى
- لا تستخدم لتحميل محتوى محمي بحقوق الطبع والنشر
