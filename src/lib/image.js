// Yüklenen görseli tarayıcıda küçültüp sıkıştırır → küçük bir data URL üretir.
// Böylece fotoğraf doğrudan veritabanında saklanır (ayrı depolama gerekmez)
// ve tüm cihazlarda görünür.

// Bir <img> kaynağını (herhangi bir src) canvas'ta küçültüp sıkıştırır.
// fileToCompressedDataURL ve AI üretimi aynı mantığı kullanır.
function srcToCompressedDataURL(src, { maxSize = 720, quality = 0.72, isPng = false } = {}) {
  return new Promise((resolve, reject) => {
    const imgEl = new Image()
    imgEl.onerror = () => reject(new Error('Görsel yüklenemedi'))
    imgEl.onload = () => {
      let { width, height } = imgEl
      if (width > height && width > maxSize) {
        height = Math.round((height * maxSize) / width)
        width = maxSize
      } else if (height > maxSize) {
        width = Math.round((width * maxSize) / height)
        height = maxSize
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(imgEl, 0, 0, width, height)
      const dataUrl = canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', isPng ? undefined : quality)
      resolve(dataUrl)
    }
    imgEl.src = src
  })
}

export function fileToCompressedDataURL(file, opts = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Geçerli bir görsel dosyası seçin'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Dosya okunamadı'))
    reader.onload = () => {
      // PNG şeffaflığı kaybetmemek için png, diğerleri jpeg
      srcToCompressedDataURL(reader.result, { ...opts, isPng: file.type === 'image/png' }).then(resolve, reject)
    }
    reader.readAsDataURL(file)
  })
}

// AI ile üretilen (veya herhangi bir URL/data URL) görseli aynı standarda sıkıştırır.
export function urlToCompressedDataURL(url, opts = {}) {
  return srcToCompressedDataURL(url, { ...opts, isPng: false })
}
