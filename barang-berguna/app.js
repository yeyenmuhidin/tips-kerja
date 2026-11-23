(() => {
  const list = document.getElementById("daftar-produk");
  const year = document.getElementById("tahun");
  if (year) year.textContent = String(new Date().getFullYear());

  const arrow = `
    <svg class="btn-arrow" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M3 8h8.2L8.1 4.9 9.2 3.8 13.9 8l-4.7 4.2-1.1-1.1L11.2 8H3z"/>
    </svg>`;

  const isFilled = (link) => {
    if (!link) return false;
    const value = String(link).trim();
    return value.startsWith("http://") || value.startsWith("https://");
  };

  const isLocalImage = (value) => {
    const image = String(value || "").trim();
    if (!image) return false;
    if (image.includes("..") || image.includes("\\") || image.includes(":") || image.startsWith("/")) {
      return false;
    }
    return /^img\/[A-Za-z0-9._-]+\.(webp|jpg|jpeg|png)$/i.test(image);
  };

  const escapeHtml = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const renderMedia = (item, name, accent) => {
    const rawImage = String(item.image || "").trim();
    if (isLocalImage(rawImage)) {
      const src = escapeHtml(rawImage);
      return `<div class="media media-photo" style="--card-accent: ${accent}">
            <img src="${src}" alt="${name}" width="400" height="400" loading="lazy" decoding="async">
          </div>`;
    }

    const icon = escapeHtml(item.ikon || "🛒");
    return `<div class="media" style="--card-accent: ${accent}" aria-hidden="true">${icon}</div>`;
  };

  const render = (items) => {
    if (!Array.isArray(items) || items.length === 0) {
      list.innerHTML = '<p class="error">Daftar produk masih kosong. Isi file products.json.</p>';
      return;
    }

    const html = items
      .map((item) => {
        const name = escapeHtml(item.nama || "Produk");
        const desc = escapeHtml(item.deskripsi || "");
        const accent = escapeHtml(item.warna || "#FFE4D6");
        const rawLink = String(item.link || "#ISI-LINK-AFFILIATE").trim();
        const filled = isFilled(rawLink);
        const href = escapeHtml(rawLink || "#ISI-LINK-AFFILIATE");
        const rel = filled ? ' rel="sponsored nofollow noopener noreferrer"' : "";
        const target = filled ? ' target="_blank"' : "";
        const pendingLabel = filled ? "" : " (link belum diisi)";

        return `
          <article class="card" id="${escapeHtml(item.id || "")}">
            ${renderMedia(item, name, accent)}
            <h3>${name}</h3>
            <p>${desc}</p>
            <footer>
              <a class="btn" href="${href}"${rel}${target}>
                Cek di Shopee${arrow}
                <span class="visually-hidden">: ${name}${pendingLabel}</span>
              </a>
            </footer>
          </article>`;
      })
      .join("");

    list.innerHTML = html;
  };

  fetch("products.json", { cache: "no-cache" })
    .then((res) => {
      if (!res.ok) throw new Error("Gagal memuat products.json");
      return res.json();
    })
    .then((data) => render(data.produk))
    .catch(() => {
      list.innerHTML =
        '<p class="error">Gagal memuat daftar produk. Buka halaman ini lewat server lokal (lihat README), jangan langsung klik file HTML-nya.</p>';
    });
})();
