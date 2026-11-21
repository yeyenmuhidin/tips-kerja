(() => {
  const bars = document.querySelectorAll("[data-share]");
  if (!bars.length) return;

  const canonical =
    document.querySelector('link[rel="canonical"]')?.href ||
    location.href;
  const title =
    document.querySelector("h1")?.textContent.trim() ||
    document.title;
  const shareText = `${title} ${canonical}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(canonical)}`;

  const copyText = async (value) => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.insetInlineStart = "-9999px";
    document.body.append(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  };

  bars.forEach((bar) => {
    const waLink = bar.querySelector("[data-share-wa]");
    const fbLink = bar.querySelector("[data-share-fb]");
    const copyBtn = bar.querySelector("[data-share-copy]");

    if (waLink) {
      waLink.href = wa;
      waLink.target = "_blank";
      waLink.rel = "noopener noreferrer";
    }
    if (fbLink) {
      fbLink.href = fb;
      fbLink.target = "_blank";
      fbLink.rel = "noopener noreferrer";
    }
    if (copyBtn) {
      const label = copyBtn.textContent;
      copyBtn.addEventListener("click", async () => {
        try {
          await copyText(canonical);
          copyBtn.textContent = "Tersalin";
          window.setTimeout(() => {
            copyBtn.textContent = label;
          }, 2000);
        } catch (_) {
          copyBtn.textContent = "Gagal menyalin";
          window.setTimeout(() => {
            copyBtn.textContent = label;
          }, 2000);
        }
      });
    }
  });
})();
