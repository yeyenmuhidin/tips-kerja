(() => {
  const year = document.getElementById("tahun");
  if (year) year.textContent = String(new Date().getFullYear());

  const arrow = `
    <svg class="btn-arrow" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M3 8h8.2L8.1 4.9 9.2 3.8 13.9 8l-4.7 4.2-1.1-1.1L11.2 8H3z"/>
    </svg>`;

  const CATEGORIES = [
    { id: "botol-minum", nama: "Botol minum", ikon: "🍶" },
    { id: "sepatu-kerja", nama: "Sepatu kerja", ikon: "👟" },
    { id: "tas-ransel", nama: "Tas & ransel", ikon: "🎒" },
    { id: "powerbank", nama: "Powerbank", ikon: "🔋" },
    { id: "alat-dapur", nama: "Alat dapur", ikon: "🍴" },
    { id: "kotak-bekal", nama: "Kotak bekal", ikon: "🍱" },
    { id: "jas-hujan", nama: "Jas hujan", ikon: "🌧️" },
    { id: "earphone", nama: "Earphone", ikon: "🎧" },
    { id: "senter-lampu", nama: "Senter & lampu", ikon: "🔦" },
    { id: "pakaian-harian", nama: "Pakaian harian", ikon: "👕" },
    { id: "sandal-rumah", nama: "Sandal rumah", ikon: "🩴" },
    { id: "kotak-p3k", nama: "Kotak P3K", ikon: "🩹" },
  ];

  const CATEGORY_IDS = new Set(CATEGORIES.map((item) => item.id));

  const CATEGORY_HINTS = [
    { id: "pakaian-harian", keys: ["blouse", "blus", "pashmina", "kaos", "kondangan", "pakaian", "hijab"] },
    { id: "alat-dapur", keys: ["panci", "steamer", "dapur"] },
    { id: "jas-hujan", keys: ["payung", "hujan", "jas hujan"] },
    { id: "kotak-bekal", keys: ["bekal"] },
    { id: "botol-minum", keys: ["botol", "termos"] },
    { id: "sepatu-kerja", keys: ["sepatu"] },
    { id: "tas-ransel", keys: ["tas", "ransel"] },
    { id: "powerbank", keys: ["powerbank"] },
    { id: "earphone", keys: ["earphone", "headset"] },
    { id: "senter-lampu", keys: ["senter", "lampu"] },
    { id: "sandal-rumah", keys: ["sandal"] },
    { id: "kotak-p3k", keys: ["p3k", "kesehatan"] },
  ];

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

  const isShopeeCdnImage = (value) => {
    const image = String(value || "").trim();
    return /^https:\/\/down-[a-z0-9-]+\.img\.susercontent\.com\/file\/[A-Za-z0-9._-]+$/i.test(image);
  };

  const isProductImage = (value) => isLocalImage(value) || isShopeeCdnImage(value);

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

  const hasPrice = (item) => {
    if (item == null || item.harga == null || item.harga === "") return false;
    return Number.isFinite(Number(item.harga));
  };

  const categoryLabel = (id) => {
    const found = CATEGORIES.find((item) => item.id === id);
    return found ? found.nama : "";
  };

  const inferCategory = (item) => {
    if (Object.prototype.hasOwnProperty.call(item, "kategori")) {
      const explicit = String(item.kategori || "").trim();
      if (explicit && CATEGORY_IDS.has(explicit)) return explicit;
      return "";
    }
    const id = String(item.id || "").trim();
    if (CATEGORY_IDS.has(id)) return id;
    const haystack = `${item.id || ""} ${item.nama || ""} ${item.deskripsi || ""}`.toLowerCase();
    for (const hint of CATEGORY_HINTS) {
      if (hint.keys.some((key) => haystack.includes(key))) return hint.id;
    }
    return "";
  };

  const renderMedia = (item, name, accent, options) => {
    const rawImage = String(item.image || "").trim();
    if (isProductImage(rawImage)) {
      const src = escapeHtml(rawImage);
      const priority = options && options.priority ? ' fetchpriority="high" loading="eager"' : ' loading="lazy"';
      return `<img class="media media-photo" src="${src}" alt="${name}" width="400" height="300"${priority} decoding="async" referrerpolicy="no-referrer">`;
    }

    const icon = escapeHtml(item.ikon || "🛒");
    return `<div class="media media-icon" style="--card-accent: ${accent}" aria-hidden="true">${icon}</div>`;
  };

  const renderCard = (item, options, index) => {
    const name = escapeHtml(item.nama || "Produk");
    const desc = escapeHtml(item.deskripsi || "");
    const accent = escapeHtml(item.warna || "#FFE4D6");
    const rawLink = String(item.link || options.placeholderLink || "#").trim();
    const filled = isFilled(rawLink);
    const href = escapeHtml(rawLink || options.placeholderLink || "#");
    const rel = filled ? ` rel="${options.rel}"` : "";
    const target = filled ? ' target="_blank"' : "";
    const pendingLabel = filled ? "" : " (link belum diisi)";
    const priceText = options.showPrice !== false && hasPrice(item) ? formatRupiah(item.harga) : "";
    const showCekHarga = options.cekHarga && !priceText;
    const price = priceText
      ? `<p class="price">${escapeHtml(priceText)}</p>`
      : showCekHarga
        ? `<p class="price price-cek">Cek harga</p>`
        : "";
    const kategori = inferCategory(item);
    const cat = kategori ? `<p class="card-cat">${escapeHtml(categoryLabel(kategori))}</p>` : "";
    const badge = options.featured ? `<p class="card-badge">Unggulan</p>` : "";
    const shareText = filled
      ? `${item.nama || "Produk"} — ${rawLink}`
      : `${item.nama || "Produk"} — https://yeyenmuhidin.github.io/tips-kerja/barang-berguna/`;
    const waHref = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    const wa = options.shareWa
      ? `<a class="btn btn-wa" href="${escapeHtml(waHref)}" target="_blank" rel="noopener noreferrer">Bagikan WA<span class="visually-hidden">: ${name}</span></a>`
      : "";

    return `
      <article class="card" id="${escapeHtml(item.id || "")}" data-kategori="${escapeHtml(kategori)}">
        ${badge}
        ${renderMedia(item, name, accent, { priority: options.featured && index === 0 })}
        ${cat}
        <h3>${name}</h3>
        ${desc ? `<p>${desc}</p>` : ""}
        <footer>
          ${price}
          <div class="card-actions">
            <a class="btn${filled ? "" : " is-pending"}" href="${href}"${rel}${target}>
              ${escapeHtml(options.buttonLabel)}${arrow}
              <span class="visually-hidden">: ${name}${pendingLabel}</span>
            </a>
            ${wa}
          </div>
        </footer>
      </article>`;
  };

  const renderList = (list, items, options) => {
    if (!list) return;

    if (!Array.isArray(items) || items.length === 0) {
      list.innerHTML = `<p class="error">${escapeHtml(options.emptyMessage)}</p>`;
      return;
    }

    list.innerHTML = items.map((item, index) => renderCard(item, options, index)).join("");
  };

  const loadJson = (url) =>
    fetch(url, { cache: "no-cache" }).then((res) => {
      if (!res.ok) throw new Error(`Gagal memuat ${url}`);
      return res.json();
    });

  const loadList = (url, listId, options) => {
    const list = document.getElementById(listId);
    if (!list) return;

    loadJson(url)
      .then((data) => renderList(list, data.produk, options))
      .catch(() => {
        list.innerHTML = `<p class="error">${escapeHtml(options.errorMessage)}</p>`;
      });
  };

  loadList("lynk.json", "daftar-digital", {
    buttonLabel: "Lihat di Lynk",
    showPrice: true,
    cekHarga: false,
    shareWa: false,
    featured: false,
    rel: "noopener noreferrer",
    placeholderLink: "#",
    emptyMessage: "Daftar produk digital masih kosong. Isi file lynk.json.",
    errorMessage: "Gagal memuat daftar produk digital. Buka halaman ini lewat server lokal (lihat README), jangan langsung klik file HTML-nya.",
  });

  const shopRoot = document.getElementById("daftar-produk");
  if (!shopRoot) return;

  const featuredRoot = document.getElementById("daftar-unggulan");
  const categoryRoot = document.getElementById("daftar-kategori");
  const searchForm = document.getElementById("form-cari");
  const searchInput = document.getElementById("cari-produk");
  const resultCount = document.getElementById("hasil-cari");

  const shopOptions = {
    buttonLabel: "Cek di Shopee",
    showPrice: true,
    cekHarga: true,
    shareWa: true,
    featured: false,
    rel: "sponsored nofollow noopener noreferrer",
    placeholderLink: "#ISI-LINK-AFFILIATE",
    emptyMessage: "Daftar produk masih kosong. Isi file products.json.",
    errorMessage: "Gagal memuat daftar produk. Buka halaman ini lewat server lokal (lihat README), jangan langsung klik file HTML-nya.",
  };

  const state = { items: [], query: "", category: "semua" };

  const matchesQuery = (item, query) => {
    if (!query) return true;
    const haystack = `${item.nama || ""} ${item.deskripsi || ""} ${categoryLabel(inferCategory(item))}`.toLowerCase();
    return haystack.includes(query);
  };

  const filteredItems = () => {
    const query = state.query.trim().toLowerCase();
    return state.items.filter((item) => {
      if (!matchesQuery(item, query)) return false;
      if (state.category === "semua") return true;
      return inferCategory(item) === state.category;
    });
  };

  const updateResultCount = (visible, total) => {
    if (!resultCount) return;
    if (state.query.trim() || state.category !== "semua") {
      resultCount.textContent = `Menampilkan ${visible} dari ${total} rekomendasi.`;
    } else {
      resultCount.textContent = `${total} rekomendasi.`;
    }
  };

  const renderShop = () => {
    const visible = filteredItems();
    if (visible.length === 0) {
      shopRoot.innerHTML = `<p class="error" role="status">Tidak ada produk yang cocok. Coba kata lain atau pilih kategori Semua.</p>`;
    } else {
      renderList(shopRoot, visible, shopOptions);
    }
    updateResultCount(visible.length, state.items.length);
  };

  const renderFeatured = () => {
    if (!featuredRoot) return;
    const featured = state.items.filter((item) => isProductImage(item.image) && isFilled(item.link));
    if (featured.length === 0) {
      featuredRoot.innerHTML = `<p class="error">Belum ada produk unggulan.</p>`;
      return;
    }
    renderList(featuredRoot, featured, { ...shopOptions, featured: true });
  };

  const setCategory = (id) => {
    state.category = id || "semua";
    if (!categoryRoot) return;
    categoryRoot.querySelectorAll("[data-kategori]").forEach((btn) => {
      const active = btn.getAttribute("data-kategori") === state.category;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
    renderShop();
  };

  const renderCategories = () => {
    if (!categoryRoot) return;
    const allBtn = `<button type="button" class="cat-chip is-active" data-kategori="semua" aria-pressed="true"><span class="cat-ikon" aria-hidden="true">🛒</span><span>Semua</span></button>`;
    const chips = CATEGORIES.map(
      (item) =>
        `<button type="button" class="cat-chip" data-kategori="${escapeHtml(item.id)}" aria-pressed="false"><span class="cat-ikon" aria-hidden="true">${escapeHtml(item.ikon)}</span><span>${escapeHtml(item.nama)}</span></button>`
    ).join("");
    categoryRoot.innerHTML = allBtn + chips;
    categoryRoot.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-kategori]");
      if (!btn || !categoryRoot.contains(btn)) return;
      setCategory(btn.getAttribute("data-kategori"));
      const products = document.getElementById("produk");
      if (products) products.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    });
  };

  const scrollBehavior = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

  renderCategories();

  if (searchForm) {
    searchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      state.query = searchInput ? searchInput.value : "";
      renderShop();
      const products = document.getElementById("produk");
      if (products) products.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      state.query = searchInput.value;
      renderShop();
    });
  }

  loadJson("products.json")
    .then((data) => {
      state.items = Array.isArray(data.produk) ? data.produk : [];
      renderFeatured();
      renderShop();
    })
    .catch(() => {
      const message = `<p class="error">${escapeHtml(shopOptions.errorMessage)}</p>`;
      shopRoot.innerHTML = message;
      if (featuredRoot) featuredRoot.innerHTML = message;
    });
})();
