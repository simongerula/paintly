const path = require('path');
const fs = require('fs');

const CATEGORIES = {
  'van-gogh': {
    name: 'Van Gogh',
    folder: 'van-gogh',
    width: 960,
    height: 540,
    background: '#1a1a3e'
  },
  'wellington': {
    name: 'Wellington',
    folder: 'wellington',
    width: 960,
    height: 540,
    background: '#2c3e50'
  }
};

function getImagesInCategory(categoryKey) {
  const cat = CATEGORIES[categoryKey];
  if (!cat) return [];
  const mapsDir = path.join(__dirname, '..', '..', 'public', 'maps', cat.folder);
  if (!fs.existsSync(mapsDir)) return [];
  return fs.readdirSync(mapsDir)
    .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
    .map(f => ({
      name: path.parse(f).name.replace(/-/g, ' '),
      image: `/maps/${cat.folder}/${f}`,
      width: cat.width,
      height: cat.height,
      background: cat.background
    }));
}

function getCategoryList() {
  const list = [];
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    const images = getImagesInCategory(key);
    if (images.length > 0) {
      list.push({ key, name: cat.name, imageCount: images.length });
    }
  }
  return list;
}

module.exports = { CATEGORIES, getImagesInCategory, getCategoryList };
