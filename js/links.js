(() => {
  const root = document.getElementById("daftar-tautan");
  if (!root) return;

  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  const hostOf = (url) =>
    String(url).replace(/^https?:\/\/(?:www\.)?/i, "").split("/")[0];

  const cardHtml = (item) => {
    const title = escapeHtml(item.title);
    const desc = escapeHtml(item.description);
    const url = escapeHtml(item.url);
    const host = escapeHtml(hostOf(item.url));
    const badge = item.badge ? `<span class="badge-demo">${escapeHtml(item.badge)}</span>` : "";
    let label = item.title;
    if (item.badge) label += `, ${item.badge}`;
    label += `. ${item.description} Buka di tab baru.`;
    return `<a class="link-card" href="${url}" target="_blank" rel="noopener" aria-label="${escapeHtml(label)}">
            <span class="link-card-body">${badge}
              <strong class="link-card-title">${title}</strong>
              <span class="link-card-desc">${desc}</span>
              <span class="link-card-host">${host}</span>
            </span>
            <span class="link-card-go" aria-hidden="true">Buka</span>
          </a>`;
  };

  const groupHtml = (group) => {
    const cards = (group.items || []).map(cardHtml).join("");
    return `<section class="section section-tint-${escapeHtml(group.tint)}" aria-labelledby="kelompok-${escapeHtml(group.id)}">
      <div class="wrap">
        <div class="section-head">
          <h2 id="kelompok-${escapeHtml(group.id)}">${escapeHtml(group.title)}</h2>
          <p>${escapeHtml(group.intro)}</p>
        </div>
        <div class="link-grid">${cards}</div>
      </div>
    </section>`;
  };

  const render = (data) => {
    const groups = data && Array.isArray(data.groups) ? data.groups : [];
    if (!groups.length) return;
    root.innerHTML = groups.map(groupHtml).join("");
  };

  fetch("js/links.json")
    .then((response) => {
      if (!response.ok) throw new Error(String(response.status));
      return response.json();
    })
    .then(render)
    .catch(() => {
      /* Biarkan markup statis di halaman jika data gagal dimuat. */
    });
})();
