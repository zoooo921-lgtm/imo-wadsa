// IMO Watch 프론트엔드. 제목 등 외부 데이터는 textContent로만 넣어 XSS를 막습니다.
const SEEN_KEY = "imowatch.seen.v1";
const state = { items: [], newIds: new Set(), flag: "ALL", prio: "ALL", q: "" };
const $ = (sel) => document.querySelector(sel);

let seen = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"));

function saveSeen() {
  // 저장 용량을 줄이기 위해 최근 1000개만 유지
  const arr = [...seen].slice(-1000);
  localStorage.setItem(SEEN_KEY, JSON.stringify(arr));
}

async function load() {
  try {
    const res = await fetch("data/items.json", { cache: "no-store" });
    const data = await res.json();
    state.items = data.items || [];
    state.newIds = new Set(data.new_ids || []);
    $("#updated").textContent = "마지막 수집: " + new Date(data.generated_at).toLocaleString("ko-KR");
    buildFlagChips();
    render();
    notifyHighPriority();
  } catch (e) {
    $("#updated").textContent = "데이터를 불러오지 못했습니다.";
  }
}

function buildFlagChips() {
  const flags = ["ALL", ...new Set(state.items.map((i) => i.flag))];
  const box = $("#flagChips");
  box.replaceChildren();
  for (const f of flags) {
    const b = document.createElement("button");
    b.className = "chip" + (state.flag === f ? " on" : "");
    b.textContent = f === "ALL" ? "모든 기관" : f;
    b.onclick = () => { state.flag = f; buildFlagChips(); render(); };
    box.appendChild(b);
  }
}

function matches(item) {
  if (state.flag !== "ALL" && item.flag !== state.flag) return false;
  if (state.prio !== "ALL" && item.priority !== state.prio) return false;
  if (state.q && !item.title.toLowerCase().includes(state.q)) return false;
  return true;
}

function render() {
  const list = $("#list");
  list.replaceChildren();
  const items = state.items.filter(matches);
  if (!items.length) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "조건에 맞는 항목이 없습니다.";
    list.appendChild(p);
    return;
  }
  for (const it of items) {
    const card = document.createElement("article");
    card.className = "card" + (it.priority === "high" ? " high" : "");

    const meta = document.createElement("div");
    meta.className = "meta";
    const flag = document.createElement("span");
    flag.className = "badge";
    flag.textContent = it.flag;
    meta.appendChild(flag);
    if (it.priority === "high") {
      const h = document.createElement("span");
      h.className = "badge high";
      h.textContent = "HIGH";
      meta.appendChild(h);
    }
    if (state.newIds.has(it.id)) {
      const n = document.createElement("span");
      n.className = "badge new";
      n.textContent = "NEW";
      meta.appendChild(n);
    }
    const when = document.createElement("span");
    when.textContent = new Date(it.first_seen).toLocaleDateString("ko-KR");
    meta.appendChild(when);

    const title = document.createElement("h2");
    title.className = "title";
    const a = document.createElement("a");
    a.href = it.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = it.title;
    title.appendChild(a);

    card.append(meta, title);
    list.appendChild(card);
  }
}

// 고우선순위 알림: 앱이 열려 있을 때 새 HIGH 항목을 알림으로 보여줍니다.
// 완전한 백그라운드 푸시는 서버(Web Push)가 필요하므로 2단계에서 추가합니다.
function notifyHighPriority() {
  const highs = state.items.filter((i) => i.priority === "high");
  if (!seen.size && highs.length) {
    // 처음 방문: 기존 항목을 알림 없이 본 것으로 표시
    highs.forEach((i) => seen.add(i.id));
    saveSeen();
    return;
  }
  const fresh = highs.filter((i) => !seen.has(i.id));
  if (fresh.length && "Notification" in window && Notification.permission === "granted") {
    for (const it of fresh.slice(0, 3)) {
      new Notification("[HIGH] " + it.flag, { body: it.title, tag: it.id });
    }
  }
  highs.forEach((i) => seen.add(i.id));
  saveSeen();
}

function setupNotifyButton() {
  if (!("Notification" in window)) return;
  const btn = $("#notifyBtn");
  if (Notification.permission === "granted") return;
  btn.hidden = false;
  btn.onclick = async () => {
    const r = await Notification.requestPermission();
    if (r === "granted") btn.hidden = true;
  };
}

document.querySelectorAll("#prioChips .chip").forEach((b) => {
  b.onclick = () => {
    state.prio = b.dataset.prio;
    document.querySelectorAll("#prioChips .chip").forEach((x) => x.classList.toggle("on", x === b));
    render();
  };
});
$("#q").addEventListener("input", (e) => {
  state.q = e.target.value.trim().toLowerCase();
  render();
});

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
setupNotifyButton();
load();
