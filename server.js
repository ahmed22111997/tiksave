/**
 * TikSave Backend - Node.js + Express
 * 
 * التثبيت: npm install
 * التشغيل: node server.js أو npm start
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 3000;

// yt-dlp - نجرب عدة طرق لأن Windows أحياناً ما يضيفه لـ PATH
const YTDLP_CANDIDATES = ['yt-dlp', 'python -m yt_dlp', 'python3 -m yt_dlp', 'yt-dlp.exe'];
let YTDLP_PATH = null;

async function detectYtDlp() {
  if (YTDLP_PATH) return YTDLP_PATH;
  for (const candidate of YTDLP_CANDIDATES) {
    try {
      await execAsync(`${candidate} --version`, { timeout: 5000 });
      YTDLP_PATH = candidate;
      console.log(`✅ yt-dlp found: ${candidate}`);
      return YTDLP_PATH;
    } catch {}
  }
  return null;
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== Helper: التحقق من رابط تيك توك =====
function isValidTikTokURL(url) {
  const patterns = [
    /https?:\/\/(?:www\.)?tiktok\.com\/@[\w.]+\/video\/\d+/,
    /https?:\/\/vm\.tiktok\.com\/\w+/,
    /https?:\/\/vt\.tiktok\.com\/\w+/,
    /https?:\/\/(?:www\.)?tiktok\.com\/t\/\w+/,
  ];
  return patterns.some(p => p.test(url));
}

async function checkYtDlp() {
  const path = await detectYtDlp();
  return !!path;
}

async function getVideoInfo(url) {
  try {
    // الخطوة 1: جيب الـ token من ssstik
    const pageRes = await fetch('https://ssstik.io/en', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(15000)
    });

    const pageHtml = await pageRes.text();

    // استخراج الـ tt token
    const tokenMatch = pageHtml.match(/s_tt\s*=\s*['"](.*?)['"]/);
    if (!tokenMatch) throw new Error('فشل استخراج token');
    const token = tokenMatch[1];

    // الخطوة 2: أرسل الرابط لـ ssstik
    const formData = new URLSearchParams();
    formData.append('id', url);
    formData.append('locale', 'en');
    formData.append('tt', token);

    const apiRes = await fetch('https://ssstik.io/abc?url=dl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Origin': 'https://ssstik.io',
        'Referer': 'https://ssstik.io/en',
        'HX-Request': 'true',
        'HX-Target': 'target',
        'HX-Current-URL': 'https://ssstik.io/en',
      },
      body: formData.toString(),
      signal: AbortSignal.timeout(20000)
    });

    const html = await apiRes.text();
    console.log('ssstik response preview:', html.slice(0, 500));

    if (!html || html.includes('error') && html.length < 200) {
      throw new Error('فشل استخراج الفيديو');
    }

    // استخراج الروابط من الـ HTML
    const noWatermarkMatch = html.match(/href="(https:\/\/[^"]*)"[^>]*>.*?Without watermark/i) ||
                             html.match(/href="(https:\/\/tikcdn[^"]*\.mp4[^"]*)"/i) ||
                             html.match(/href="(https:\/\/[^"]*\.mp4[^"]*)"/i);

    const mp3Match = html.match(/href="(https:\/\/[^"]*)"[^>]*>.*?MP3/i) ||
                     html.match(/href="(https:\/\/[^"]*)"[^>]*class="[^"]*music[^"]*"/i);

    const titleMatch = html.match(/<p[^>]*>\s*([^<]{5,100})\s*<\/p>/);
    const authorMatch = html.match(/@([\w.]+)/);
    const thumbMatch = html.match(/src="(https:\/\/[^"]*\.(jpg|jpeg|webp)[^"]*)"/i);

    const noWatermarkUrl = noWatermarkMatch?.[1] || null;
    const mp3Url = mp3Match?.[1] || null;

    if (!noWatermarkUrl && !mp3Url) {
      throw new Error('لم يتم العثور على روابط تحميل');
    }

    return {
      title: titleMatch?.[1]?.trim() || 'فيديو تيك توك',
      author: authorMatch?.[1] || 'unknown',
      thumbnail: thumbMatch?.[1] || null,
      duration: null,
      download_no_watermark: noWatermarkUrl,
      download_mp3: mp3Url,
      download_original: noWatermarkUrl,
    };

  } catch (err) {
    console.error('ssstik error:', err.message);
    if (err.name === 'TimeoutError') throw new Error('انتهت المهلة، يرجى المحاولة مرة أخرى');
    throw new Error(err.message);
  }
}

// ===== Routes =====

// الصفحة الرئيسية
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API: استخراج روابط التحميل
app.post('/api/download', async (req, res) => {
  const { url, format = 'mp4' } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'الرابط مطلوب' });
  }

  const cleanUrl = url.trim();

  if (!cleanUrl.includes('tiktok.com')) {
    return res.status(400).json({ error: 'يجب أن يكون رابط تيك توك صحيحاً' });
  }

  try {
    const info = await getVideoInfo(cleanUrl);
    return res.json(info);
  } catch (err) {
    return res.status(422).json({ error: err.message });
  }
});

// API: Health check + تشخيص
app.get('/api/health', async (req, res) => {
  const ytdlp = await detectYtDlp();
  let ytdlpVersion = 'غير مثبت ❌';
  if (ytdlp) {
    try {
      const { stdout } = await execAsync(`${ytdlp} --version`);
      ytdlpVersion = stdout.trim() + ' ✅';
    } catch {}
  }
  res.json({
    status: ytdlp ? 'ok' : 'error',
    yt_dlp: ytdlpVersion,
    yt_dlp_cmd: ytdlp || 'not found',
    node: process.version,
    platform: process.platform,
    fix: ytdlp ? null : 'شغّل: pip install yt-dlp ثم أعد تشغيل السيرفر'
  });
});

// تشغيل السيرفر
app.listen(PORT, () => {
  console.log(`\n🚀 TikSave Server شتغّل على: http://localhost:${PORT}\n`);
});