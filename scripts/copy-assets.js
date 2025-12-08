const fs = require('fs');
const path = require('path');

// Ensure dist directory exists
const distDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy renderer files (HTML, CSS)
const rendererSrc = path.join(__dirname, '..', 'src', 'renderer');
const rendererDist = path.join(__dirname, '..', 'dist', 'renderer');

if (!fs.existsSync(rendererDist)) {
  fs.mkdirSync(rendererDist, { recursive: true });
}

// Copy HTML
fs.copyFileSync(
  path.join(rendererSrc, 'index.html'),
  path.join(rendererDist, 'index.html')
);

// Copy CSS
fs.copyFileSync(
  path.join(rendererSrc, 'styles.css'),
  path.join(rendererDist, 'styles.css')
);

// Copy assets (icon)
const assetsSrc = path.join(__dirname, '..', 'src', 'assets');
const assetsDist = path.join(__dirname, '..', 'dist', 'assets');

if (!fs.existsSync(assetsDist)) {
  fs.mkdirSync(assetsDist, { recursive: true });
}

if (fs.existsSync(assetsSrc)) {
  const files = fs.readdirSync(assetsSrc);
  files.forEach(file => {
    fs.copyFileSync(
      path.join(assetsSrc, file),
      path.join(assetsDist, file)
    );
  });
}

console.log('Assets copied successfully');

