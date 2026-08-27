/* PixelSwap — vanilla port
 * ---------------------------------------------------------------------------
 * Adapted from the React component at reactbits.dev/animations/pixel-swap.
 * Same technique, no framework: the original is really just DOM cloning plus
 * the Web Animations API, both of which plain JavaScript already has.
 *
 * How it works. Each "pixel" is a small overflow-hidden box holding a full-size
 * clone of the incoming content, shifted by exactly its own position — so every
 * pixel is a window onto the same image, locked to the same origin. Scaling a
 * pixel up while scaling its content down by the reciprocal means the content
 * never moves or distorts; only the aperture grows. Stagger the pixels and the
 * new phrase assembles itself out of the old one.
 *
 * Usage:
 *   const swap = new PixelSwap(el, { interval: 2000 });
 *   swap.start([
 *     { html: 'Find the people your team is <em>missing</em>.' },
 *     { html: 'Your next teammate isn\u2019t in your <em>contacts</em>.' }
 *   ]);
 */

(function (global) {
  'use strict';

  const MAX_PIXELS = 260;      // upper bound on grid size, whatever the box
  const STEPS = 14;            // keyframes generated per animation

  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

  // Deterministic pseudo-random, so a given pixel always gets the same delay.
  const noise = seed => {
    const v = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return v - Math.floor(v);
  };

  const PATTERNS = {
    random: () => null,
    diagonal: (x, y) => (x + y) / 2,
    'left-to-right': x => x,
    center: (x, y) => Math.hypot(x - 0.5, y - 0.5) / Math.SQRT1_2
  };

  // Pixels grow a little past their own box so gaps close completely by the
  // end. The overlap is invisible because every pixel shows the same content.
  const coverScale = (size, gap) => (size + gap) / size;

  function buildGrid(width, height, opts) {
    let size = opts.pixelSize;
    let cols = Math.max(1, Math.ceil((width + opts.gap) / (size + opts.gap)));
    let rows = Math.max(1, Math.ceil((height + opts.gap) / (size + opts.gap)));

    if (cols * rows > MAX_PIXELS) {
      size = Math.ceil(size * Math.sqrt((cols * rows) / MAX_PIXELS));
      cols = Math.max(1, Math.ceil((width + opts.gap) / (size + opts.gap)));
      rows = Math.max(1, Math.ceil((height + opts.gap) / (size + opts.gap)));
    }

    const stride = size + opts.gap;
    const originX = (width - (cols * stride - opts.gap)) / 2;
    const originY = (height - (rows * stride - opts.gap)) / 2;
    const order = PATTERNS[opts.pattern] || PATTERNS.random;
    const mix = clamp(opts.randomness, 0, 1);
    const pixels = [];

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const i = r * cols + c;
        const x = cols <= 1 ? 0.5 : c / (cols - 1);
        const y = rows <= 1 ? 0.5 : r / (rows - 1);
        const base = order(x, y);
        const rand = noise(i + 1);
        pixels.push({
          left: originX + c * stride,
          top: originY + r * stride,
          offset: base === null ? rand : base * (1 - mix) + rand * mix
        });
      }
    }
    return { pixels, size, width, height, gap: opts.gap };
  }

  // One shared pair of keyframe lists: the aperture transform and its exact
  // inverse, so the revealed content never drifts.
  function buildKeyframes(startScale, endScale) {
    const aperture = [];
    const content = [];
    for (let step = 0; step <= STEPS; step += 1) {
      const p = step / STEPS;
      const eased = 1 - Math.pow(1 - p, 3);          // ease-out cubic
      const scale = startScale + (endScale - startScale) * eased;
      aperture.push({
        offset: p,
        opacity: Math.min(1, eased * 1.7),
        transform: `scale(${scale})`
      });
      content.push({ offset: p, transform: `scale(${1 / scale})` });
    }
    return { aperture, content };
  }

  function PixelSwap(el, options) {
    const o = Object.assign({
      pixelSize: 34,
      gap: 2,
      pixelScale: 0.3,
      duration: 900,        // whole sweep, including stagger
      pixelDuration: 380,   // one pixel's own animation
      pattern: 'diagonal',
      randomness: 0.55,
      interval: 2000        // time on screen before swapping
    }, options || {});

    this.el = el;
    this.o = o;
    this.phrases = [];
    this.index = 0;
    this.animations = [];
    this.timers = [];
    this.busy = false;

    el.classList.add('pxs');

    this.stage = document.createElement('div');
    this.stage.className = 'pxs__stage';
    el.appendChild(this.stage);

    this.grid = document.createElement('div');
    this.grid.className = 'pxs__grid';
    this.grid.setAttribute('aria-hidden', 'true');
    el.appendChild(this.grid);
  }

  PixelSwap.prototype._layer = function (html) {
    const layer = document.createElement('div');
    layer.className = 'pxs__layer';
    layer.innerHTML = html;
    return layer;
  };

  PixelSwap.prototype._clear = function () {
    this.animations.forEach(a => a.cancel());
    this.animations = [];
    this.grid.replaceChildren();
  };

  PixelSwap.prototype.start = function (phrases) {
    this.phrases = phrases;
    if (!phrases.length) return;

    this.current = this._layer(phrases[0].html);
    this.stage.replaceChildren(this.current);

    if (phrases.length < 2) return;

    // Respect the OS setting: no dissolve, just a plain cross-fade.
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const tick = () => {
      this.next();
      this.timers.push(window.setTimeout(tick, this.o.interval));
    };
    this.timers.push(window.setTimeout(tick, this.o.interval));
  };

  PixelSwap.prototype.next = function () {
    if (this.busy || this.phrases.length < 2) return;

    const width = this.el.clientWidth;
    const height = this.el.clientHeight;
    if (!width || !height) return;

    this.index = (this.index + 1) % this.phrases.length;
    const incoming = this._layer(this.phrases[this.index].html);

    if (this.reduced) {
      this.stage.replaceChildren(incoming);
      this.current = incoming;
      return;
    }

    this.busy = true;

    // Render the incoming layer offscreen so it can be measured and cloned,
    // but never seen until the pixels reveal it.
    incoming.classList.add('pxs__layer--pending');
    this.stage.appendChild(incoming);

    const grid = buildGrid(width, height, this.o);
    const endScale = coverScale(grid.size, grid.gap);
    const keys = buildKeyframes(clamp(this.o.pixelScale, 0.05, 1) * endScale, endScale);

    const total = Math.max(200, this.o.duration);
    const pixelMs = clamp(this.o.pixelDuration, 60, total);
    const spread = Math.max(0, total - pixelMs);

    const frag = document.createDocumentFragment();

    grid.pixels.forEach(p => {
      const box = document.createElement('div');
      box.className = 'pxs__pixel';
      box.style.left = p.left + 'px';
      box.style.top = p.top + 'px';
      box.style.width = grid.size + 'px';
      box.style.height = grid.size + 'px';

      const inner = document.createElement('div');
      inner.className = 'pxs__pixel-content';
      inner.style.left = -p.left + 'px';
      inner.style.top = -p.top + 'px';
      inner.style.width = grid.width + 'px';
      inner.style.height = grid.height + 'px';
      // Counter-transform about the PIXEL's centre, not the content's, so the
      // two transforms cancel to an exact identity on every frame.
      inner.style.transformOrigin =
        (p.left + grid.size / 2) + 'px ' + (p.top + grid.size / 2) + 'px';

      const clone = incoming.cloneNode(true);
      clone.classList.remove('pxs__layer--pending');
      inner.appendChild(clone);
      box.appendChild(inner);
      frag.appendChild(box);

      const timing = {
        duration: pixelMs,
        delay: p.offset * spread,
        easing: 'linear',
        fill: 'both'
      };
      this.animations.push(
        box.animate(keys.aperture, timing),
        inner.animate(keys.content, timing)
      );
    });

    this.grid.replaceChildren(frag);

    this.timers.push(window.setTimeout(() => {
      incoming.classList.remove('pxs__layer--pending');
      this.stage.replaceChildren(incoming);
      this.current = incoming;
      this._clear();
      this.busy = false;
    }, total));
  };

  PixelSwap.prototype.destroy = function () {
    this.timers.forEach(t => window.clearTimeout(t));
    this.timers = [];
    this._clear();
  };

  global.PixelSwap = PixelSwap;
})(window);
