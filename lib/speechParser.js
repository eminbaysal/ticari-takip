// lib/speechParser.js — Türkçe konuşmadan hizmet kaydı çıkaran regex parser

const TIP_MAP = [
  { tip: 'urun-tedariki',  kelimeler: ['modem', 'router', 'switch', 'kamera', 'sunucu', 'server', 'bilgisayar', 'laptop', 'tablet', 'telefon', 'cihaz', 'ekipman', 'malzeme', 'ürün', 'access point', 'ups', 'nvr', 'dvr', 'kablosu', 'kablo'] },
  { tip: 'cihaz-kurulumu', kelimeler: ['kurulum', 'montaj', 'takma', 'takıldı', 'kuruldu', 'monte edildi', 'monte', 'yerleştirildi'] },
  { tip: 'teknik-destek',  kelimeler: ['internet', 'bağlantı', 'gbps', 'mbps', 'fiber', 'destek', 'arıza', 'bakım', 'güncelleme', 'servis', 'konfigürasyon', 'yapılandırma'] },
  { tip: 'danismanlik',    kelimeler: ['danışmanlık', 'danışman', 'konsültasyon', 'proje', 'analiz', 'rapor', 'eğitim'] },
  { tip: 'devreye-alma',   kelimeler: ['devreye alma', 'devreye', 'aktifleştirme', 'canlıya', 'başlatma', 'açılış'] },
  { tip: 'abonelik',       kelimeler: ['abonelik', 'üyelik', 'lisans', 'subscription'] },
];

// Türkçe format: 10.000 (nokta=binlik), 10.000,50 (virgül=ondalık)
function parseSayi(str) {
  if (!str) return null;
  let s = str.trim().replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Metinden firma adı çıkar
function firmaAdiCikar(text) {
  let m;

  // "X Firmasına / Şirketine / A.Ş.'ye" vb.
  m = text.match(/^([\wÇĞİÖŞÜçğışöü\s\.\-&'"]{2,40}?)\s+(?:firmas[ıi]na|şirket[i]ne|a\.ş\.?|ltd\.?|holding[e]?ne?|grub[u]?na|kurumuna|kuruluşuna)/i);
  if (m) return m[1].trim();

  // "X Belediyesine/Belediyesi" → "X Belediyesi"
  m = text.match(/^([\wÇĞİÖŞÜçğışöü\s\.\-]{2,30}?)\s+belediye[s]?[i]?ne/i);
  if (m) return m[1].trim() + ' Belediyesi';

  m = text.match(/^([\wÇĞİÖŞÜçğışöü\s\.\-]{2,30}?\s+belediye[s]?i)/i);
  if (m) return m[1].trim();

  // "X'e / X'a / Xye / Xya / Xne / Xna" — dative case
  m = text.match(/^([A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜa-zçğışöü]*(?:\s+[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜa-zçğışöü]*)*)['']?(?:ne|ye|ya|na|e|a)\s/);
  if (m) return m[1].trim();

  // "SPN Clinic internet..." → cümle başında 1-3 büyük harfli kelime + küçük harf kelime
  // (dative eki yok ama aksiyon cümlesi devam ediyor)
  m = text.match(/^([A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜa-zçğışöü]*(?:\s+[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜa-zçğışöü]*){0,2})\s+[a-zçğışöü]/);
  if (m) return m[1].trim();

  return null;
}

// Hizmet tipi çıkar
function tipCikar(t) {
  for (const { tip, kelimeler } of TIP_MAP) {
    if (kelimeler.some(k => t.includes(k))) return tip;
  }
  return 'diger';
}

// Ürün adı çıkar
function urunAdiCikar(t) {
  // "10 adet <kelime>" → sadece ilk kelimeyi al
  let m = t.match(/\d+\s*adet\s+([\wçğışöü]+)/i);
  if (m) return m[1].charAt(0).toUpperCase() + m[1].slice(1);

  // Bilinen ürün kelimeleri
  const urunler = [
    'access point', 'modem', 'kamera', 'router', 'switch', 'sunucu', 'server',
    'bilgisayar', 'laptop', 'tablet', 'telefon', 'ups', 'nvr', 'dvr',
  ];
  for (const u of urunler) {
    if (t.includes(u)) return u.charAt(0).toUpperCase() + u.slice(1);
  }
  return null;
}

// Para sayısı çek: "X TL", "X lira", "$X", "X USD"
function fiyatCikar(pattern, t) {
  const m = t.match(pattern);
  return m ? parseSayi(m[1]) : null;
}

function parse(text) {
  const t = text.toLowerCase();

  const r = {
    firmaAd:           null,
    tip:               null,
    aciklama:          text.trim(),
    urunAdi:           null,
    adet:              null,
    birimFiyat:        null,
    toplamFiyat:       null,
    aylikUcret:        null,
    aktivasyonUcreti:  null,
    yillikUcret:       null,
    fiyat:             null,   // forma girilecek nihai değer
    paraBirimi:        'TRY',
  };

  // Para birimi
  if (/\$|dolar|usd/i.test(t)) r.paraBirimi = 'USD';

  // Firma
  r.firmaAd = firmaAdiCikar(text);

  // Tip
  r.tip = tipCikar(t);

  // Adet: "10 adet" önce, sonra "16 kamera" (sayı + ürün)
  let m = t.match(/(\d+)\s*adet/i);
  if (m) {
    r.adet = parseInt(m[1]);
  } else {
    m = t.match(/(\d+)\s+(?:modem|kamera|router|switch|sunucu|cihaz|bilgisayar|laptop|tablet|telefon|access point|ups)/i);
    if (m) r.adet = parseInt(m[1]);
  }

  // Ürün adı
  r.urunAdi = urunAdiCikar(t);

  // --- Fiyat çıkarma (öncelikli sıra) ---
  const PB = '(?:\\s*(?:tl|₺|lira|usd|\\$|dolar|euro|€))?';
  const NUM = '([0-9][0-9.,]*)';

  r.birimFiyat       = fiyatCikar(new RegExp(`birim\\s*(?:fiyat[ıi]?|ücret[i]?)\\s*[:\\s]*${NUM}${PB}`, 'i'), t);
  r.toplamFiyat      = fiyatCikar(new RegExp(`toplam\\s*(?:fiyat[ıi]?|ücret[i]?|tutar[ıi]?)?\\s*[:\\s]*${NUM}${PB}`, 'i'), t);
  r.aylikUcret       = fiyatCikar(new RegExp(`ayl[ıi]k\\s*(?:fiyat[ıi]?|ücret[i]?|tutar[ıi]?)?\\s*[:\\s]*${NUM}${PB}`, 'i'), t);
  r.aktivasyonUcreti = fiyatCikar(new RegExp(`aktivasyon\\s*(?:ücret[i]?|fiyat[ıi]?)?\\s*[:\\s]*${NUM}${PB}`, 'i'), t);
  r.yillikUcret      = fiyatCikar(new RegExp(`y[ıi]ll[ıi]k\\s*(?:fiyat[ıi]?|ücret[i]?|tutar[ıi]?)?\\s*[:\\s]*${NUM}${PB}`, 'i'), t);

  // Genel: "fiyat X TL" veya son sayı + TL
  if (!r.birimFiyat && !r.toplamFiyat && !r.aylikUcret) {
    m = t.match(new RegExp(`fiyat[ıi]?\\s*[:\\s]*${NUM}${PB}`, 'i'));
    if (m) {
      r.toplamFiyat = parseSayi(m[1]);
    } else {
      // Son "SAYI TL/₺/lira" kalıbını al
      const tümM = [...t.matchAll(/([0-9][0-9.,]*)\s*(?:tl|₺|lira)/gi)];
      if (tümM.length) r.toplamFiyat = parseSayi(tümM[tümM.length - 1][1]);
    }
  }

  // Birim × adet → toplam
  if (r.birimFiyat && r.adet && !r.toplamFiyat) {
    r.toplamFiyat = r.birimFiyat * r.adet;
  }

  // Forma girilecek nihai fiyat
  r.fiyat = r.birimFiyat || r.toplamFiyat || r.aylikUcret || r.yillikUcret || null;

  return r;
}

module.exports = { parse, escapeRegex };
