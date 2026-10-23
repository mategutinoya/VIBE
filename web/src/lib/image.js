/**
 * Prepara una foto para subirla: corrige la orientación, reduce a 1600 px y la recodifica en JPEG.
 * Al recodificar se descartan TODOS los metadatos (incluida la ubicación GPS) antes de salir del dispositivo.
 */
export async function prepareImage(file, { max = 1600, quality = 0.86 } = {}) {
  if (!file.type.startsWith('image/')) throw new Error('El archivo no es una imagen');
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    bitmap = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No pudimos leer esta imagen. Prueba con otra (JPG o PNG).'));
      img.src = URL.createObjectURL(file);
    });
  }
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality));
  if (!blob) throw new Error('No pudimos procesar la imagen');
  return new File([blob], 'foto.jpg', { type: 'image/jpeg' });
}
