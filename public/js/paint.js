const PALETTE = [
  { name: 'Red', hex: '#e74c3c' },
  { name: 'Orange', hex: '#e67e22' },
  { name: 'Yellow', hex: '#f1c40f' },
  { name: 'Green', hex: '#27ae60' },
  { name: 'Blue', hex: '#2980b9' },
  { name: 'Purple', hex: '#8e44ad' },
  { name: 'Brown', hex: '#8b4513' },
  { name: 'White', hex: '#ffffff' },
  { name: 'Black', hex: '#2c3e50' },
  { name: 'Grey', hex: '#7f8c8d' }
];

class Paint {
  constructor() {
    this.color = PALETTE[0].hex;
    this.size = 10;
    this.strokes = new Map();
    this.active = false;
  }

  addStroke(id, s) {
    if (!this.strokes.has(id)) this.strokes.set(id, []);
    this.strokes.get(id).push(s);
  }

  clearStrokes(id) { this.strokes.set(id, []); }
  undoStroke(id) { const s = this.strokes.get(id); if (s?.length) s.pop(); }

  drawBody(ctx, x, y, strokes, opts = {}) {
    const W = 24, H = 48;
    const headR = 9, bw = 16, bh = 18;
    const hx = x + W / 2, hy = y + headR + 1;
    const bx = x + (W - bw) / 2, by = hy + headR + 2;
    const legW = bw / 2 - 1, legH = 12;

    ctx.save();

    // Build body path
    const bodyPath = new Path2D();
    bodyPath.arc(hx, hy, headR, 0, Math.PI * 2);
    bodyPath.rect(bx, by, bw, bh);
    bodyPath.rect(bx, by + bh, legW, legH);
    bodyPath.rect(bx + legW + 2, by + bh, legW, legH);

    // White base so body is never transparent
    ctx.fillStyle = '#ffffff';
    ctx.fill(bodyPath);

    // Paint strokes on top (clipped to body)
    if (strokes && strokes.length > 0) {
      ctx.save();
      ctx.clip(bodyPath);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      let i = 0;
      while (i < strokes.length) {
        const start = strokes[i];
        let j = i + 1;
        while (j < strokes.length && strokes[j].color === start.color && strokes[j].size === start.size) j++;
        const group = strokes.slice(i, j);
        if (group.length === 1) {
          ctx.fillStyle = start.color;
          ctx.beginPath();
          ctx.arc(x + group[0].x, y + group[0].y, start.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.strokeStyle = start.color;
          ctx.lineWidth = start.size;
          ctx.beginPath();
          ctx.moveTo(x + group[0].x, y + group[0].y);
          for (let k = 1; k < group.length; k++) {
            ctx.lineTo(x + group[k].x, y + group[k].y);
          }
          ctx.stroke();
        }
        i = j;
      }
      ctx.restore();
    }

    // Highlight ring
    if (opts.ring) {
      ctx.strokeStyle = opts.ring;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(x - 4, y - 4, W + 8, H + 8);
      ctx.setLineDash([]);
    }

    // Tint overlay
    if (opts.tint) {
      ctx.fillStyle = opts.tint;
      ctx.fill(bodyPath);
    }

    // Label
    if (opts.label) {
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lw = ctx.measureText(opts.label).width;
      const lx = x + W / 2;
      const ly = y - 8;
      const pad = 4;
      ctx.fillStyle = 'rgba(0,0,0,.7)';
      ctx.beginPath();
      const rx = lx - lw / 2 - pad, ry = ly - 6, rw = lw + pad * 2, rh = 12, rr = 3;
      ctx.moveTo(rx + rr, ry);
      ctx.lineTo(rx + rw - rr, ry);
      ctx.arcTo(rx + rw, ry, rx + rw, ry + rr, rr);
      ctx.lineTo(rx + rw, ry + rh - rr);
      ctx.arcTo(rx + rw, ry + rh, rx + rw - rr, ry + rh, rr);
      ctx.lineTo(rx + rr, ry + rh);
      ctx.arcTo(rx, ry + rh, rx, ry + rh - rr, rr);
      ctx.lineTo(rx, ry + rr);
      ctx.arcTo(rx, ry, rx + rr, ry, rr);
      ctx.fill();
      ctx.fillStyle = opts.labelColor || '#fff';
      ctx.fillText(opts.label, lx, ly);
    }

    ctx.restore();
  }

  hitTest(px, py, bx, by) {
    return px >= bx && px <= bx + 24 && py >= by && py <= by + 48;
  }
}

window.Paint = Paint;
window.PALETTE = PALETTE;
