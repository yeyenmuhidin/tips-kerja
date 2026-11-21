(() => {
  const form = document.getElementById("form-cari");
  const input = document.getElementById("q");
  const status = document.getElementById("hasil-cari");
  const grid = document.querySelector("[data-article-grid]");
  if (!form || !input || !grid) return;

  const cards = [...grid.querySelectorAll("[data-slug]")];
  const catalogUrl = new URL("../js/articles.json", window.location.href);

  let catalog = cards.map((card) => ({
    slug: card.dataset.slug,
    title: card.querySelector(".title")?.textContent.trim() || "",
    description: card.querySelector("p:not(.meta)")?.textContent.trim() || "",
    card,
  }));

  const normalize = (value) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const apply = (rawQuery) => {
    const query = normalize(rawQuery);
    let visible = 0;

    catalog.forEach((item) => {
      const haystack = normalize(`${item.title} ${item.description}`);
      const match = !query || haystack.includes(query);
      item.card.hidden = !match;
      if (match) visible += 1;
    });

    if (!status) return;
    if (!query) {
      status.textContent = "";
      return;
    }
    if (visible === 0) {
      status.textContent = `Tidak ada artikel yang cocok dengan “${rawQuery.trim()}”. Coba kata lain, misalnya CV, operator, atau interview.`;
      return;
    }
    status.textContent =
      visible === 1
        ? `Ditemukan 1 artikel untuk “${rawQuery.trim()}”.`
        : `Ditemukan ${visible} artikel untuk “${rawQuery.trim()}”.`;
  };

  const syncUrl = (query) => {
    const url = new URL(window.location.href);
    if (query.trim()) url.searchParams.set("q", query.trim());
    else url.searchParams.delete("q");
    history.replaceState(null, "", url);
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = input.value;
    syncUrl(value);
    apply(value);
    status?.focus?.();
  });

  input.addEventListener("input", () => {
    const value = input.value;
    syncUrl(value);
    apply(value);
  });

  const params = new URLSearchParams(window.location.search);
  const initial = params.get("q") || "";
  if (initial) {
    input.value = initial;
    apply(initial);
  }

  const hashTarget = () => {
    if (location.hash === "#cari") {
      input.focus();
    }
  };
  hashTarget();
  window.addEventListener("hashchange", hashTarget);

  fetch(catalogUrl)
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (!Array.isArray(data)) return;
      const bySlug = new Map(data.map((item) => [item.slug, item]));
      catalog = catalog.map((item) => {
        const extra = bySlug.get(item.slug);
        if (!extra) return item;
        return {
          ...item,
          title: extra.title || item.title,
          description: extra.description || item.description,
        };
      });
      apply(input.value);
    })
    .catch(() => {
      /* Tetap memakai teks di kartu jika berkas JSON tidak bisa diambil. */
    });
})();
