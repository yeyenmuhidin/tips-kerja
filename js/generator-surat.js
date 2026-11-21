(() => {
  const form = document.getElementById("form-surat");
  const preview = document.getElementById("surat-preview");
  const copyBtn = document.getElementById("salin-surat");
  const printBtn = document.getElementById("cetak-surat");
  if (!form || !preview) return;

  const fields = {
    nama: form.elements.namedItem("nama"),
    ttl: form.elements.namedItem("ttl"),
    pendidikan: form.elements.namedItem("pendidikan"),
    alamat: form.elements.namedItem("alamat"),
    hp: form.elements.namedItem("hp"),
    posisi: form.elements.namedItem("posisi"),
    perusahaan: form.elements.namedItem("perusahaan"),
    sumber: form.elements.namedItem("sumber"),
    pengalaman: form.elements.namedItem("pengalaman"),
  };

  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];

  const todayLabel = () => {
    const now = new Date();
    return `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  };

  const valueOf = (el) => (el && typeof el.value === "string" ? el.value.trim() : "");

  const placeholder = (text, filled) => (filled ? text : "[................]");

  const buildLetter = () => {
    const nama = valueOf(fields.nama);
    const ttl = valueOf(fields.ttl);
    const pendidikan = valueOf(fields.pendidikan);
    const alamat = valueOf(fields.alamat);
    const hp = valueOf(fields.hp);
    const posisi = valueOf(fields.posisi);
    const perusahaan = valueOf(fields.perusahaan);
    const sumber = valueOf(fields.sumber);
    const pengalaman = valueOf(fields.pengalaman);

    const cityGuess = (() => {
      if (!alamat) return "...............";
      const first = alamat.split(",")[0].trim();
      if (first && first.length <= 40 && !/\d{3,}/.test(first)) return first;
      return "...............";
    })();

    const lines = [];
    lines.push(`${cityGuess}, ${todayLabel()}`);
    lines.push("");
    lines.push("Kepada Yth.");
    lines.push("Bagian Personalia");
    lines.push(placeholder(perusahaan, perusahaan));
    lines.push("di tempat");
    lines.push("");
    lines.push(`Perihal: Lamaran pekerjaan sebagai ${placeholder(posisi, posisi)}`);
    lines.push("");
    lines.push("Dengan hormat,");
    lines.push("");
    lines.push("Yang bertanda tangan di bawah ini:");
    lines.push("");
    const row = (label, value) => `${label}: ${value}`;
    lines.push(row("Nama", placeholder(nama, nama)));
    lines.push(row("Tempat, tanggal lahir", placeholder(ttl, ttl)));
    lines.push(row("Pendidikan", placeholder(pendidikan, pendidikan)));
    lines.push(row("Alamat", placeholder(alamat, alamat)));
    lines.push(row("Nomor HP", placeholder(hp, hp)));
    lines.push("");

    const perusahaanFrasa = perusahaan
      ? perusahaan
      : "[Nama Perusahaan]";
    const posisiFrasa = posisi ? posisi : "[posisi]";
    const sumberFrasa = sumber
      ? sumber
      : "[sumber lowongan]";

    lines.push(
      `dengan ini mengajukan lamaran pekerjaan sebagai ${posisiFrasa} di ${perusahaanFrasa}. Informasi lowongan ini saya peroleh dari ${sumberFrasa}.`
    );
    lines.push("");

    if (pengalaman) {
      lines.push(pengalaman);
      lines.push("");
      lines.push(
        "Saya siap mengikuti aturan kerja yang berlaku dan bersedia mengikuti tes atau wawancara sesuai jadwal yang ditentukan."
      );
    } else if (pendidikan) {
      lines.push(
        `Saya lulusan ${pendidikan} dan tertarik pada posisi ini. Saya siap belajar, mengikuti arahan atasan, serta menaati aturan kerja yang berlaku di perusahaan.`
      );
    } else {
      lines.push(
        "Saya siap belajar, mengikuti arahan atasan, serta menaati aturan kerja yang berlaku di perusahaan."
      );
    }
    lines.push("");
    lines.push(
      "Sebagai bahan pertimbangan, bersama ini saya lampirkan kelengkapan berkas sesuai ketentuan perusahaan, antara lain CV, fotokopi KTP, dan dokumen lain yang diminta."
    );
    lines.push("");
    lines.push(
      "Demikian surat lamaran ini saya buat dengan sebenar-benarnya. Besar harapan saya untuk dapat diberikan kesempatan mengikuti seleksi. Atas perhatian Bapak/Ibu, saya ucapkan terima kasih."
    );
    lines.push("");
    lines.push("Hormat saya,");
    lines.push("");
    lines.push("");
    lines.push(placeholder(nama, nama));

    return lines.join("\n");
  };

  const render = () => {
    preview.textContent = buildLetter();
  };

  form.addEventListener("input", render);
  form.addEventListener("change", render);
  form.addEventListener("reset", () => {
    window.setTimeout(render, 0);
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    render();
    preview.focus();
  });

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

  if (copyBtn) {
    const label = copyBtn.textContent;
    copyBtn.addEventListener("click", async () => {
      try {
        await copyText(buildLetter());
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

  if (printBtn) {
    printBtn.addEventListener("click", () => {
      window.print();
    });
  }

  render();
})();
