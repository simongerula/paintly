class GameMap {
  constructor(mapData) {
    this.data = mapData;
    this.width = mapData.width;
    this.height = mapData.height;
    this.background = mapData.background;
    this.image = null;
    this.imageReady = false;
    this.loadImage(mapData.image);
  }

  loadImage(src) {
    if (!src) return;
    const img = new Image();
    img.onload = () => {
      this.image = img;
      this.imageReady = true;
    };
    img.onerror = () => {
      console.warn('Failed to load map image:', src, '- using fallback');
    };
    img.src = src;
  }

  draw(ctx) {
    if (this.imageReady) {
      ctx.drawImage(this.image, 0, 0, this.width, this.height);
    } else {
      ctx.fillStyle = this.background;
      ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  getColorAt(x, y) {
    // For eyedropper - sample from the actual image if loaded
    if (this.imageReady) {
      const c = document.createElement('canvas');
      c.width = this.width;
      c.height = this.height;
      const offCtx = c.getContext('2d');
      offCtx.drawImage(this.image, 0, 0, this.width, this.height);
      const pixel = offCtx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
      return '#' + [pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2, '0')).join('');
    }
    return this.background;
  }
}

window.GameMap = GameMap;
