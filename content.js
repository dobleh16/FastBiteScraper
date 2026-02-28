// FastBiteScraper v2.0 - Content Script
// Auto-scroll + Enhanced scraping + Partial saves + Better WA detection

async function scrapeData() {
  const isMaps = window.location.href.includes('google.com/maps');
  const results = [];

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  function sendMsg(msg) {
    try { chrome.runtime.sendMessage(msg).catch(() => { }); } catch (e) { }
  }

  async function savePartial() {
    try {
      await chrome.storage.local.set({
        fastbite_partial: results.slice(),
        fastbite_status: 'running',
        fastbite_progress: { done: results.length, time: Date.now() }
      });
    } catch (e) { }
  }

  // ── Auto-scroll Maps sidebar to load ALL results ──
  async function autoScrollMapsList() {
    const selectors = ['div[role="feed"]', '.m6QErb.WNBkOb', '.DxyBCb .m6QErb'];
    let scrollBox = null;
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.scrollHeight > el.clientHeight) { scrollBox = el; break; }
    }
    if (!scrollBox) {
      for (const p of document.querySelectorAll('[role="feed"], .m6QErb')) {
        if (p.scrollHeight > p.clientHeight) { scrollBox = p; break; }
      }
    }
    if (!scrollBox) return;

    let prevHeight = 0, stalls = 0;
    sendMsg({ type: 'scrolling' });

    while (stalls < 3) {
      scrollBox.scrollTop = scrollBox.scrollHeight;
      await delay(1500);
      if (scrollBox.scrollHeight === prevHeight) stalls++;
      else stalls = 0;
      prevHeight = scrollBox.scrollHeight;

      const endMarker = scrollBox.querySelector('.HlvSq, .lXJj5c.Hk4XGb');
      if (endMarker) break;

      const loaded = document.querySelectorAll('a.hfpxzc, a[href*="/maps/place/"]').length;
      sendMsg({ type: 'scroll_progress', loaded });
    }
  }

  // ── Helper: get visible element ──
  function getVisible(container, selector) {
    for (const el of container.querySelectorAll(selector)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el;
    }
    return null;
  }

  // ── Score calculation ──
  function calcScore(phone, rating, reviews) {
    const numR = parseFloat(rating.replace(',', '.')) || 0;
    const numRev = parseInt(reviews.replace(/\D/g, '')) || 0;
    const hasPhone = phone !== 'N/A' && phone.length > 6;
    if (hasPhone && numR >= 4.0 && numRev >= 50) return '🔥 Caliente';
    if (hasPhone && (numR < 4.0 || numRev < 50)) return '🟡 Tibio';
    return '❄️ Frío';
  }

  sendMsg({ type: 'start' });

  if (isMaps) {
    // ── PHASE 1: Auto-scroll ──
    await autoScrollMapsList();

    // ── PHASE 2: Collect unique links ──
    const links = Array.from(document.querySelectorAll('a.hfpxzc, a[href*="/maps/place/"]'));
    const uniqueLinks = [], seen = new Set();
    links.forEach(l => { if (l.href && !seen.has(l.href)) { seen.add(l.href); uniqueLinks.push(l); } });

    // ── PHASE 3: Scrape each restaurant ──
    for (let i = 0; i < uniqueLinks.length; i++) {
      const link = uniqueLinks[i];
      const url = link.href;
      const name = link.getAttribute('aria-label') || link.textContent.trim() || 'Desconocido';
      if (!name || name === 'Desconocido') continue;

      sendMsg({ type: 'progress', current: i + 1, total: uniqueLinks.length, name });

      try {
        link.click();

        let phone = 'N/A', rating = 'N/A', reviews = 'N/A', address = 'N/A';
        let category = 'N/A', website = 'N/A', tieneWa = 'No', horario = 'N/A';
        let attempts = 0;

        while (attempts < 25) {
          await delay(200);
          let container = document.querySelector(`div[role="main"][aria-label="${name}"]`);
          if (!container) {
            const panels = Array.from(document.querySelectorAll('.bJzME.tTVLSc, .Nv2PK, div[role="main"]'));
            container = panels.find(p => p.getBoundingClientRect().width > 0 && p.textContent.includes(name)) || document;
          }

          // Phone
          const phoneBtn = getVisible(container, 'button[data-item-id^="phone:tel:"]');
          if (phoneBtn) {
            const lbl = phoneBtn.getAttribute('aria-label');
            if (lbl) phone = lbl.replace('Teléfono:', '').replace('Phone:', '').trim();
            if (!phone || phone === 'N/A') {
              const inner = phoneBtn.querySelector('.Io6YTe');
              if (inner) phone = inner.textContent.trim();
            }
          }

          // Address
          const addrBtn = getVisible(container, 'button[data-item-id="address"]');
          if (addrBtn) { const inner = addrBtn.querySelector('.Io6YTe'); if (inner) address = inner.textContent.trim(); }

          // Category
          const catBtn = getVisible(container, 'button.DkEaL');
          if (catBtn && catBtn.textContent) category = catBtn.textContent.trim();
          else { const fb = getVisible(container, 'h1.DUwDvf + div span'); if (fb) category = fb.textContent.trim(); }

          // Website
          const webBtn = getVisible(container, 'a[data-item-id="authority"]');
          if (webBtn && webBtn.href) website = webBtn.href;

          // Rating
          const ratingEl = getVisible(container, 'div.F7nice span[aria-hidden="true"]');
          if (ratingEl) rating = ratingEl.textContent.trim();
          const revEl = getVisible(container, 'div.F7nice span[aria-label*="reseñas"], div.F7nice span[aria-label*="reviews"]');
          if (revEl) reviews = revEl.textContent.replace(/[()]/g, '').trim();

          // Hours
          const hoursBtn = getVisible(container, 'button[data-item-id="oh"]');
          if (hoursBtn) { const hl = hoursBtn.getAttribute('aria-label'); if (hl) horario = hl; }

          // WhatsApp in Maps panel
          const waLinks = Array.from(container.querySelectorAll('a[href*="wa.me"], a[href*="api.whatsapp.com"]'));
          if (waLinks.some(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; })) tieneWa = 'Sí';

          const titleLoaded = getVisible(container, 'h1.DUwDvf');
          if (titleLoaded && titleLoaded.textContent.trim() === name) {
            if (phone !== 'N/A' || attempts > 5) break;
          }
          attempts++;
        }

        // Global phone fallback
        if (phone === 'N/A') {
          const anyPhone = document.querySelector('button[data-item-id^="phone:tel:"]');
          if (anyPhone && anyPhone.getBoundingClientRect().width > 0) {
            const inner = anyPhone.querySelector('.Io6YTe');
            if (inner) phone = inner.textContent.trim();
          }
        }

        results.push({
          Nombre: name, Calificacion: rating, Resenas: reviews, Telefono: phone,
          Detalles: address, Enlace: url, Tiene_WhatsApp: tieneWa, Sitio_Web: website,
          Categoria: category, Score_Prospecto: calcScore(phone, rating, reviews),
          Horario: horario, Estado_Contacto: 'Sin contactar',
          Fecha_Extraccion: new Date().toISOString().split('T')[0]
        });

        if (results.length % 5 === 0) await savePartial();
      } catch (err) { console.error('Error procesando', name, err); }
    }

  } else {
    // ── Google Search (Local Pack) ──
    const cards = document.querySelectorAll('.VkpGBb, .LxpZhd, .rllt__details, div[data-cid]');
    let i = 0;
    cards.forEach(card => {
      try {
        i++;
        const nameEl = card.querySelector('.OSrXXb, .dbg0pd, .BNeawe');
        const name = nameEl ? nameEl.textContent.trim() : 'Nombre no encontrado';
        sendMsg({ type: 'progress', current: i, total: cards.length, name });

        const ratingEl = card.querySelector('span.yi40Hd, span.Y0A0hc');
        const rating = ratingEl ? ratingEl.textContent.trim() : 'N/A';
        const reviewsEl = card.querySelector('span.RDApPh');
        const reviews = reviewsEl ? reviewsEl.textContent.trim().replace(/[()]/g, '') : 'N/A';
        const urlEl = card.querySelector('a');
        const url = urlEl ? urlEl.href : '';

        let phone = 'N/A';
        const phoneRegex = /(?:\+?\d{1,3}[\s.-]*)?\(?\d{2,5}\)?[\s.-]*\d{3,4}[\s.-]*\d{3,4}/g;
        const matches = card.textContent.match(phoneRegex);
        if (matches) {
          const valid = matches.filter(p => { const d = p.replace(/\D/g, ''); return d.length >= 7 && d.length <= 15; });
          if (valid.length > 0) phone = valid[valid.length - 1].trim();
        }

        let website = 'N/A';
        const webBtn = card.querySelector('a.yYlJEf.L48Cpd, a.VGHmvd');
        if (webBtn && webBtn.href && !webBtn.href.includes('google.com')) website = webBtn.href;

        if (name && name !== 'Nombre no encontrado') {
          results.push({
            Nombre: name, Calificacion: rating, Resenas: reviews, Telefono: phone,
            Detalles: 'Búsqueda web', Enlace: url, Tiene_WhatsApp: 'N/A',
            Sitio_Web: website, Categoria: 'N/A',
            Score_Prospecto: calcScore(phone, rating, reviews),
            Horario: 'N/A', Estado_Contacto: 'Sin contactar',
            Fecha_Extraccion: new Date().toISOString().split('T')[0]
          });
        }
      } catch (e) { console.error('Error en Búsqueda', e); }
    });

    if (results.length === 0) {
      document.querySelectorAll('a[href*="/maps/place/"]').forEach(link => {
        try {
          results.push({
            Nombre: link.textContent.trim() || 'Desconocido', Calificacion: 'N/A',
            Resenas: 'N/A', Telefono: 'N/A', Detalles: 'Solo enlace', Enlace: link.href,
            Tiene_WhatsApp: 'N/A', Sitio_Web: 'N/A', Categoria: 'N/A',
            Score_Prospecto: '❄️ Frío', Horario: 'N/A', Estado_Contacto: 'Sin contactar',
            Fecha_Extraccion: new Date().toISOString().split('T')[0]
          });
        } catch (e) { }
      });
    }
  }

  // Sort: hot first
  results.sort((a, b) => {
    const v = x => x.Score_Prospecto.includes('Caliente') ? 2 : x.Score_Prospecto.includes('Tibio') ? 1 : 0;
    return v(b) - v(a);
  });

  // Clear partial, save final status
  await chrome.storage.local.set({ fastbite_partial: null, fastbite_status: 'done' });

  return results;
}

scrapeData();
