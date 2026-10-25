/**
 * Скрипт для генерации иконок PWA (icon-192.png и icon-512.png)
 * 
 * Для работы требуется установленный пакет: npm install canvas
 * Установка: npm install --save-dev canvas
 * 
 * Запуск: node generate-icons.js
 */

const fs = require('fs');
const path = require('path');

// Проверяем, установлен ли canvas
let canvas;
try {
  canvas = require('canvas');
} catch (error) {
  console.error('❌ Ошибка: пакет "canvas" не установлен.');
  console.log('📦 Установите его командой: npm install --save-dev canvas');
  console.log('🔄 После установки запустите скрипт снова: node generate-icons.js');
  process.exit(1);
}

// Конфигурация иконок
const ICONS = [
  { size: 192, filename: 'icon-192.png' },
  { size: 512, filename: 'icon-512.png' },
];

// Цвета (соответствуют теме приложения)
const BACKGROUND_COLOR = '#0f172a'; // slate-900
const TEXT_COLOR = '#ffffff';
const ACCENT_COLOR = '#3b82f6'; // blue-500

/**
 * Генерирует иконку заданного размера
 */
function generateIcon(size, filename) {
  console.log(`🎨 Генерация иконки ${size}x${size}...`);
  
  // Создаем canvas
  const cv = canvas.createCanvas(size, size);
  const ctx = cv.getContext('2d');
  
  // Фон
  ctx.fillStyle = BACKGROUND_COLOR;
  ctx.fillRect(0, 0, size, size);
  
  // Добавляем градиент
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#0f172a');
  gradient.addColorStop(1, '#1e293b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  
  // Рисуем круг с акцентным цветом
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = size * 0.35;
  
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fillStyle = ACCENT_COLOR;
  ctx.fill();
  
  // Добавляем текст "ST" (StudyTracker)
  ctx.fillStyle = TEXT_COLOR;
  ctx.font = `bold ${size * 0.35}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ST', centerX, centerY);
  
  // Сохраняем в PNG
  const buffer = cv.toBuffer('image/png');
  const outputPath = path.join(__dirname, 'public', filename);
  
  fs.writeFileSync(outputPath, buffer);
  console.log(`✅ Иконка сохранена: ${outputPath}`);
}

/**
 * Главная функция
 */
function main() {
  console.log('🚀 Начинаем генерацию иконок PWA...\n');
  
  // Проверяем существование папки public
  const publicDir = path.join(__dirname, 'public');
  if (!fs.existsSync(publicDir)) {
    console.log('📁 Создание папки public...');
    fs.mkdirSync(publicDir, { recursive: true });
  }
  
  // Генерируем все иконки
  ICONS.forEach(({ size, filename }) => {
    generateIcon(size, filename);
  });
  
  console.log('\n✨ Все иконки успешно сгенерированы!');
  console.log('📦 Файлы:');
  ICONS.forEach(({ filename }) => {
    console.log(`   - public/${filename}`);
  });
  console.log('\n💡 Теперь можно обновить страницу и проверить PWA в DevTools (Application > Manifest)');
}

// Запуск
main();
