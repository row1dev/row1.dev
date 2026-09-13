async function loadProjects() {
  const grid = document.getElementById("grid");
  const empty = document.getElementById("empty");

  let projects = [];
  try {
    const res = await fetch("/app/data/projects.json", { cache: "no-store" });
    projects = await res.json();
  } catch (err) {
    console.error("Kon projecten niet laden:", err);
  }

  if (!projects.length) {
    empty.hidden = false;
    return;
  }

  grid.innerHTML = projects.map(renderCard).join("");
}

function renderCard(p) {
  const tags = (p.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("");
  const link = p.url
    ? `<a class="btn" href="${escapeAttr(p.url)}" target="_blank" rel="noopener">open ↗</a>`
    : "";

  return `
    <div class="card">
      <span class="status">${escapeHtml(p.status || "")}</span>
      <h3>${escapeHtml(p.name)}</h3>
      <p>${escapeHtml(p.description || "")}</p>
      <div class="tags">${tags}</div>
      ${link}
    </div>
  `;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function escapeAttr(str) {
  return escapeHtml(str);
}

loadProjects();
