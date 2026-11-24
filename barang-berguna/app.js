(() => {
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

  const formatRupiah = (value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "";
    return `Rp${amount.toLocaleString("id-ID")}`;
  };

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

  const renderList = (list, items, options) => {
    if (!list) return;

    if (!Array.isArray(items) || items.length === 0) {
      list.innerHTML = `<p class="error">${escapeHtml(options.emptyMessage)}</p>`;
      return;
    }

    const html = items
      .map((item) => {
        const name = escapeHtml(item.nama || "Produk");
        const desc = escapeHtml(item.deskripsi || "");
        const accent = escapeHtml(item.warna || "#FFE4D6");
        const rawLink = String(item.link || options.placeholderLink || "#").trim();
        const filled = isFilled(rawLink);
        const href = escapeHtml(rawLink || options.placeholderLink || "#");
        const rel = filled ? ` rel="${options.rel}"` : "";
        const target = filled ? ' target="_blank"' : "";
        const pendingLabel = filled ? "" : " (link belum diisi)";
        const priceText = options.showPrice ? formatRupiah(item.harga) : "";
        const price = priceText ? `<p class="price">${escapeHtml(priceText)}</p>` : "";

        return `
          <article class="card" id="${escapeHtml(item.id || "")}">
            ${renderMedia(item, name, accent)}
            <h3>${name}</h3>
            <p>${desc}</p>
            <footer>
              ${price}
              <a class="btn" href="${href}"${rel}${target}>
                ${escapeHtml(options.buttonLabel)}${arrow}
                <span class="visually-hidden">: ${name}${pendingLabel}</span>
              </a>
            </footer>
          </article>`;
      })
      .join("");

    list.innerHTML = html;
  };

  const loadList = (url, listId, options) => {
    const list = document.getElementById(listId);
    if (!list) return;

    fetch(url, { cache: "no-cache" })
      .then((res) => {
        if (!res.ok) throw new Error(`Gagal memuat ${url}`);
        return res.json();
      })
      .then((data) => renderList(list, data.produk, options))
      .catch(() => {
        list.innerHTML = `<p class="error">${escapeHtml(options.errorMessage)}</p>`;
      });
  };

  loadList("lynk.json", "daftar-digital", {
    buttonLabel: "Lihat di Lynk",
    showPrice: true,
    rel: "noopener noreferrer",
    placeholderLink: "#",
    emptyMessage: "Daftar produk digital masih kosong. Isi file lynk.json.",
    errorMessage: "Gagal memuat daftar produk digital. Buka halaman ini lewat server lokal (lihat README), jangan langsung klik file HTML-nya.",
  });

  loadList("products.json", "daftar-produk", {
    buttonLabel: "Cek di Shopee",
    showPrice: false,
    rel: "sponsored nofollow noopener noreferrer",
    placeholderLink: "#ISI-LINK-AFFILIATE",
    emptyMessage: "Daftar produk masih kosong. Isi file products.json.",
    errorMessage: "Gagal memuat daftar produk. Buka halaman ini lewat server lokal (lihat README), jangan langsung klik file HTML-nya.",
  });
})();
