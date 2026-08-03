class DemoCanvas {
  constructor(canvasEl) {
    this.cvs = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.time = 0;
    this.mode = 'drag';
    this.painting = false;
    this.color = '#ef4444';
    this.size = 10;
    this.strokes = [];
    this.body = { x: 0, y: 0 };
    this.drag = false;
    this.dragOff = { x: 0, y: 0 };
    this.mouse = { x: 0, y: 0 };
    this.W = 0;
    this.H = 0;
    this.bgImg = null;
    this.initBg();
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Re-resize when room screen becomes visible
    const roomScreen = document.getElementById('room-screen');
    if (roomScreen) {
      new MutationObserver(() => {
        if (roomScreen.classList.contains('active')) this.resize();
      }).observe(roomScreen, { attributes: true, attributeFilter: ['class'] });
    }

    this.bindInput();
    this.loop();
  }

  initBg() {
    this.bgImg = new Image();
    this.bgImg.src = 'background-demo.jpg';
    this.bgOffscreen = null;
    this.bgImg.onload = () => {
      this.bgOffscreen = document.createElement('canvas');
      this.bgOffscreen.width = this.bgImg.width;
      this.bgOffscreen.height = this.bgImg.height;
      this.bgOffscreen.getContext('2d').drawImage(this.bgImg, 0, 0);
    };
  }

  resize() {
    const wrap = this.cvs.parentElement;
    const rect = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.cvs.width = rect.width * dpr;
    this.cvs.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.W = rect.width;
    this.H = rect.height;
    this.body.x = this.W / 2;
    this.body.y = this.H / 2;
  }

  bindInput() {
    const c = this.cvs;

    c.addEventListener('mousedown', e => {
      const r = c.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;

      if (this.mode === 'drag') {
        const dx = this.mouse.x - this.body.x;
        const dy = this.mouse.y - this.body.y;
        if (Math.abs(dx) < 20 && Math.abs(dy) < 30) {
          this.drag = true;
          this.dragOff.x = dx;
          this.dragOff.y = dy;
        }
      } else if (this.mode === 'paint') {
        this.painting = true;
        this.addStroke();
      }
    });

    c.addEventListener('mousemove', e => {
      const r = c.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;

      if (this.drag) {
        this.body.x = this.mouse.x - this.dragOff.x;
        this.body.y = this.mouse.y - this.dragOff.y;
      }
      if (this.painting) {
        this.addStroke();
      }
    });

    c.addEventListener('mouseup', () => {
      this.painting = false;
      this.drag = false;
    });

    c.addEventListener('mouseleave', () => {
      this.painting = false;
      this.drag = false;
    });

    window.addEventListener('keydown', e => {
      if (!document.getElementById('room-screen')?.classList.contains('active')) return;

      if (e.key === 'd' || e.key === 'D') {
        this.mode = 'drag';
        this.painting = false;
      }
      if (e.key === 'p' || e.key === 'P') {
        this.mode = 'paint';
      }
      if (e.key === 'q' || e.key === 'Q') {
        this.size = Math.max(2, this.size - 2);
      }
      if (e.key === 'e' || e.key === 'E') {
        this.size = Math.min(16, this.size + 2);
      }
      if (e.key === ' ') {
        e.preventDefault();
        this.pickColor();
        this.mode = 'paint';
      }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.strokes.pop();
      }
    });
  }

  addStroke() {
    this.strokes.push({
      x: this.mouse.x - this.body.x,
      y: this.mouse.y - this.body.y,
      color: this.color,
      size: this.size
    });
  }

  pickColor() {
    if (!this.W || !this.H) return;
    if (!this.bgOffscreen) return;
    const bg = this.bgOffscreen;
    const scale = Math.min(this.W / bg.width, this.H / bg.height);
    const iw = bg.width * scale;
    const ih = bg.height * scale;
    const ix = (this.W - iw) / 2;
    const iy = (this.H - ih) / 2;
    const bx = (this.mouse.x - ix) / scale;
    const by = (this.mouse.y - iy) / scale;
    if (bx < 0 || by < 0 || bx >= bg.width || by >= bg.height) return;
    const data = bg.getContext('2d').getImageData(Math.floor(bx), Math.floor(by), 1, 1).data;
    const hex = '#' + [data[0], data[1], data[2]].map(v => v.toString(16).padStart(2, '0')).join('');
    this.color = hex;
  }

  loop() {
    this.time += 0.016;
    this.render();
    requestAnimationFrame(() => this.loop());
  }

  render() {
    const ctx = this.ctx;
    const W = this.W;
    const H = this.H;
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = 1;

    this.drawBackground(ctx, W, H);
    this.drawBody(ctx);

    if (this.mode === 'paint') {
      this.drawCursor(ctx);
    }

    this.drawModeBadge(ctx);
  }

  drawBackground(ctx, W, H) {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, W, H);

    if (this.bgImg.complete && this.bgImg.naturalWidth) {
      const img = this.bgImg;
      const scale = Math.min(W / img.width, H / img.height);
      const iw = img.width * scale;
      const ih = img.height * scale;
      const ix = (W - iw) / 2;
      const iy = (H - ih) / 2;
      ctx.drawImage(img, ix, iy, iw, ih);
    }
  }

  drawBody(ctx) {
    const bx = this.body.x;
    const by = this.body.y;

    // Draw body shape first
    ctx.fillStyle = '#e5e7eb';
    ctx.strokeStyle = 'rgba(255,255,255,.3)';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.arc(bx, by - 16, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(bx - 8, by - 6, 16, 20);
    ctx.fillRect(bx - 10, by + 14, 8, 14);
    ctx.fillRect(bx + 2, by + 14, 8, 14);

    // Clip strokes to body shape
    ctx.save();
    ctx.beginPath();
    ctx.arc(bx, by - 16, 10, 0, Math.PI * 2);
    ctx.rect(bx - 8, by - 6, 16, 20);
    ctx.rect(bx - 10, by + 14, 8, 14);
    ctx.rect(bx + 2, by + 14, 8, 14);
    ctx.clip();

    for (const s of this.strokes) {
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(bx + s.x, by + s.y, s.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Label
    ctx.fillStyle = this.mode === 'drag' ? '#3b82f6' : '#9ca3af';
    ctx.font = 'bold 11px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.mode === 'drag' ? 'Drag me!' : 'Paint on me!', bx, by + 38);
  }

  drawCursor(ctx) {
    const r = this.size / 2;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.mouse.x, this.mouse.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.mouse.x, this.mouse.y, r / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  drawCrosshair(ctx) {
    const mx = this.mouse.x;
    const my = this.mouse.y;
    const r = 12;
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mx - r, my); ctx.lineTo(mx + r, my);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mx, my - r); ctx.lineTo(mx, my + r);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawModeBadge(ctx) {
    const label = this.mode === 'drag' ? 'DRAG' : 'PAINT';
    const color = this.mode === 'drag' ? '#3b82f6' : '#ef4444';
    const x = 14;
    const y = 14;
    const w = 56;
    const h = 24;

    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.font = 'bold 10px "Segoe UI", system-ui, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2);
  }
}

window.DemoCanvas = DemoCanvas;
