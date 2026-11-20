(() => {
  const header = document.querySelector(".site-header");
  const inner = header?.querySelector(".header-inner");
  const menu = document.getElementById("site-menu");
  if (!header || !inner || !menu) return;

  let lastCollapsedWidth = 0;

  const measure = () => {
    header.classList.add("is-measuring");
    const wasOpen = menu.matches(":popover-open");
    header.classList.add("is-wide");
    menu.removeAttribute("popover");

    const fits = inner.scrollWidth <= inner.clientWidth + 1;

    if (fits) {
      lastCollapsedWidth = 0;
    } else {
      header.classList.remove("is-wide");
      menu.setAttribute("popover", "auto");
      lastCollapsedWidth = inner.clientWidth;
      if (wasOpen && typeof menu.showPopover === "function") {
        try { menu.showPopover(); } catch (_) { /* already open or unsupported */ }
      }
    }

    requestAnimationFrame(() => header.classList.remove("is-measuring"));
  };

  const onResize = () => {
    if (header.classList.contains("is-wide")) {
      measure();
      return;
    }
    if (inner.clientWidth > lastCollapsedWidth) measure();
  };

  measure();
  const ro = new ResizeObserver(onResize);
  ro.observe(inner);
  ro.observe(menu);
})();
