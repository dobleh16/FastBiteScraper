async function scrapeData() {
  const isMaps = window.location.href.includes('google.com/maps');
  const results = [];

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Notificamos inicio
  try {
    chrome.runtime.sendMessage({ type: "start" }).catch(() => { });
  } catch (e) { }

  if (isMaps) {
    // Selectores actualizados (2025/2026): 'a.hfpxzc' para enlaces en lista lateral de Maps.
    // Fallback: enlaces que contienen '/maps/place/'
    const links = Array.from(document.querySelectorAll('a.hfpxzc, a[href*="/maps/place/"]'));

    const uniqueLinks = [];
    const seen = new Set();
    links.forEach(l => {
      if (l.href && !seen.has(l.href)) {
        seen.add(l.href);
        uniqueLinks.push(l);
      }
    });

    for (let i = 0; i < uniqueLinks.length; i++) {
      const link = uniqueLinks[i];
      const url = link.href;
      const name = link.getAttribute('aria-label') || link.textContent.trim() || 'Desconocido';

      if (!name || name === 'Desconocido') continue;

      try {
        chrome.runtime.sendMessage({ type: "progress", current: i + 1, total: uniqueLinks.length, name: name }).catch(() => { });
      } catch (e) { }

      try {
        link.click();

        let phone = "N/A";
        let rating = "N/A";
        let reviews = "N/A";
        let address = "N/A";
        let category = "N/A";
        let website = "N/A";
        let tieneWa = "No";

        let attempts = 0;
        const maxAttempts = 25; // Aumentado a 25 según req

        while (attempts < maxAttempts) {
          await delay(200); // Aumentado a 200ms para conexiones lentas

          // Telefono
          // Selector act: 'button[data-item-id^="phone:tel:"]'. Fallback texto interno: '.Io6YTe'
          const phoneBtn = document.querySelector('button[data-item-id^="phone:tel:"]');
          if (phoneBtn) {
            const lbl = phoneBtn.getAttribute('aria-label');
            if (lbl) {
              phone = lbl.replace('Teléfono:', '').replace('Phone:', '').trim();
            }
            if (!phone || phone === "N/A") {
              const inner = phoneBtn.querySelector('.Io6YTe');
              if (inner) phone = inner.textContent.trim();
            }
          }

          // Direccion
          // Selector act: 'button[data-item-id="address"]'. Fallback texto interno: '.Io6YTe'
          const addrBtn = document.querySelector('button[data-item-id="address"]');
          if (addrBtn) {
            const inner = addrBtn.querySelector('.Io6YTe');
            if (inner) address = inner.textContent.trim();
          }

          // Categoria 
          // Selector act: 'button.DkEaL' (botón de la categoría bajo el título). Fallback: buscar cerca de h1.
          const catBtn = document.querySelector('button.DkEaL');
          if (catBtn && catBtn.textContent) {
            category = catBtn.textContent.trim();
          } else {
            const fallbackCat = document.querySelector('h1.DUwDvf + div span');
            if (fallbackCat) category = fallbackCat.textContent.trim();
          }

          // Sitio_Web 
          // Selector act: 'a[data-item-id="authority"]'. Fallback: 'a.QqG1Nd' (icon de web)
          const webBtn = document.querySelector('a[data-item-id="authority"]');
          if (webBtn && webBtn.href) {
            website = webBtn.href;
          }

          // Calificacion
          // Selector act: 'div.F7nice span[aria-hidden="true"]'.
          const ratingEl = document.querySelector('div.F7nice span[aria-hidden="true"]');
          if (ratingEl) rating = ratingEl.textContent.trim();

          const revEl = document.querySelector('div.F7nice span[aria-label*="reseñas"], div.F7nice span[aria-label*="reviews"]');
          if (revEl) reviews = revEl.textContent.replace(/[()]/g, '').trim();

          // WhatsApp 
          // Buscar enlaces comunes de WhatsApp en el panel.
          const waLinks = document.querySelectorAll('a[href*="wa.me"], a[href*="api.whatsapp.com"]');
          if (waLinks.length > 0) tieneWa = "Sí";

          const titleLoaded = document.querySelector('h1.DUwDvf');
          if (titleLoaded && titleLoaded.textContent.trim() === name) {
            if (phone !== "N/A" || attempts > 5) { // Esperar un par de intentos extras si el teléfono no carga inmediato
              break;
            }
          }
          attempts++;
        }

        // Calcular Score_Prospecto
        const numRating = parseFloat(rating.replace(',', '.')) || 0;
        const numReviews = parseInt(reviews.replace(/\D/g, '')) || 0;
        const hasPhone = phone !== "N/A" && phone.length > 6;

        let score = "❄️ Frío";
        if (hasPhone && numRating >= 4.0 && numReviews >= 50) {
          score = "🔥 Caliente";
        } else if (hasPhone && (numRating < 4.0 || numReviews < 50)) {
          score = "🟡 Tibio";
        }

        results.push({
          Nombre: name,
          Calificacion: rating,
          Resenas: reviews,
          Telefono: phone,
          Detalles: address,
          Enlace: url,
          Tiene_WhatsApp: tieneWa,
          Sitio_Web: website,
          Categoria: category,
          Score_Prospecto: score
        });
      } catch (err) {
        console.error("Error procesando", name, err);
      }
    }
  } else {
    // Para la búsqueda tradicional de Google (Local Pack)
    const cards = document.querySelectorAll('.VkpGBb, .LxpZhd, .rllt__details, div[data-cid]');

    let i = 0;
    cards.forEach(card => {
      try {
        i++;
        const nameEl = card.querySelector('.OSrXXb, .dbg0pd, .BNeawe');
        const name = nameEl ? nameEl.textContent.trim() : 'Nombre no encontrado';

        try {
          chrome.runtime.sendMessage({ type: "progress", current: i, total: cards.length, name: name }).catch(() => { });
        } catch (e) { }

        const ratingEl = card.querySelector('span.yi40Hd, span.Y0A0hc');
        const rating = ratingEl ? ratingEl.textContent.trim() : 'N/A';

        const reviewsEl = card.querySelector('span.RDApPh');
        const reviews = reviewsEl ? reviewsEl.textContent.trim().replace(/[()]/g, '') : 'N/A';

        const urlEl = card.querySelector('a');
        const url = urlEl ? urlEl.href : '';

        let phone = "N/A";
        const textToSearch = card.textContent;
        const phoneRegex = /(?:\+?\d{1,3}[\s.-]*)?\(?\d{2,5}\)?[\s.-]*\d{3,4}[\s.-]*\d{3,4}/g;
        const phoneMatches = textToSearch.match(phoneRegex);
        if (phoneMatches) {
          const validPhones = phoneMatches.filter(p => {
            const digits = p.replace(/\D/g, '');
            return digits.length >= 7 && digits.length <= 15;
          });
          if (validPhones.length > 0) {
            phone = validPhones[validPhones.length - 1].trim();
          }
        }

        // Calcular Score
        const numRating = parseFloat(rating.replace(',', '.')) || 0;
        const numReviews = parseInt(reviews.replace(/\D/g, '')) || 0;
        const hasPhone = phone !== "N/A" && phone.length > 6;

        let score = "❄️ Frío";
        if (hasPhone && numRating >= 4.0 && numReviews >= 50) {
          score = "🔥 Caliente";
        } else if (hasPhone && (numRating < 4.0 || numReviews < 50)) {
          score = "🟡 Tibio";
        }

        let website = "N/A";
        const webButton = card.querySelector('a.yYlJEf.L48Cpd, a.VGHmvd');
        if (webButton && webButton.href && !webButton.href.includes('google.com')) {
          website = webButton.href;
        }

        if (name && name !== 'Nombre no encontrado') {
          results.push({
            Nombre: name,
            Calificacion: rating,
            Resenas: reviews,
            Telefono: phone,
            Detalles: "Búsqueda web",
            Enlace: url,
            Tiene_WhatsApp: "N/A", // Dificil detectar de search snippet sin click
            Sitio_Web: website,
            Categoria: "N/A",
            Score_Prospecto: score
          });
        }
      } catch (e) {
        console.error("Error procesando un restaurante en Búsqueda", e);
      }
    });

    if (results.length === 0) {
      const mapLinks = document.querySelectorAll('a[href*="/maps/place/"]');
      mapLinks.forEach(link => {
        try {
          const container = link.closest('div');
          if (container) {
            results.push({
              Nombre: link.textContent.trim() || 'Desconocido',
              Calificacion: 'N/A',
              Resenas: 'N/A',
              Telefono: 'N/A',
              Detalles: 'Solo enlace encontrado',
              Enlace: link.href,
              Tiene_WhatsApp: "N/A",
              Sitio_Web: "N/A",
              Categoria: "N/A",
              Score_Prospecto: "❄️ Frío"
            });
          }
        } catch (e) { console.debug(e); }
      });
    }
  }

  // Ordenar para que 🔥 Calientes estén primero
  results.sort((a, b) => {
    const getVal = x => x.Score_Prospecto === "🔥 Caliente" ? 2 : (x.Score_Prospecto === "🟡 Tibio" ? 1 : 0);
    return getVal(b) - getVal(a);
  });

  return results;
}

scrapeData();
