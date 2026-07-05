// ==================== تنظیمات اولیه ====================
const APP_VERSION = "1.0";
const DEFAULT_GROUPS = [
  "غذاهای ایرانی",
  "غذاهای فست‌فود",
  "غذاهای دریایی",
  "غذاهای گیاهی",
  "خوراک‌های محلی",
  "دسر و شیرینی",
  "صبحانه",
  "سوپ و آش",
];

// ==================== مدیریت ذخیره‌سازی ====================
function getData(key, def = []) {
  const v = localStorage.getItem(key);
  return v ? JSON.parse(v) : def;
}

function setData(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

function loadFoods() { return getData("foods", []); }
function saveFoods(f) { setData("foods", f); }
function loadGroups() { return getData("groups", DEFAULT_GROUPS); }
function saveGroups(g) { setData("groups", g); }

// ==================== راه‌اندازی ====================
document.addEventListener("DOMContentLoaded", () => {
  if (!localStorage.getItem("groups")) saveGroups(DEFAULT_GROUPS);

  document.getElementById("app-version").textContent = APP_VERSION;
  document.querySelector(".version-badge").textContent = "v" + APP_VERSION;

  initTabs();
  refreshGroupDropdown();
  renderGroups();
  renderStats();

  document.getElementById("btn-add-food").addEventListener("click", addFood);
  document.getElementById("btn-add-group").addEventListener("click", addGroup);
  document.getElementById("btn-check-update").addEventListener("click", checkUpdate);
  document.getElementById("btn-export").addEventListener("click", exportBackup);
  document.getElementById("btn-import").addEventListener("click", () => {
    document.getElementById("import-file").click();
  });
  document.getElementById("import-file").addEventListener("change", importBackup);

  document.getElementById("search-food").addEventListener("input", renderHistory);
});

// ==================== تب‌ها ====================
function initTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });
}

// ==================== ثبت غذا ====================
function addFood() {
  const name = document.getElementById("food-name").value.trim();
  const group = document.getElementById("food-group").value;
  const date = document.getElementById("food-date").value.trim();
  const maker = document.getElementById("food-maker").value.trim();

  if (!name) { alert("⚠️ نام غذا را وارد کنید."); return; }
  if (!group) { alert("⚠️ گروه غذا را انتخاب کنید."); return; }

  const foods = loadFoods();
  foods.push({
    name, group,
    date: date || new Date().toLocaleDateString("fa-IR"),
    maker: maker || "نامشخص",
    timestamp: Date.now(),
  });
  saveFoods(foods);

  document.getElementById("food-name").value = "";
  document.getElementById("food-date").value = "";
  document.getElementById("food-maker").value = "";

  alert("✅ غذا ثبت شد!");
  renderStats();
}

// ==================== تاریخچه ====================
function renderHistory() {
  const query = document.getElementById("search-food").value.trim().toLowerCase();
  const container = document.getElementById("history-results");
  const foods = loadFoods();

  if (!query) {
    container.innerHTML = '<div class="empty-msg">🔍 نام غذا را برای مشاهده ۳ رکورد آخر وارد کنید.</div>';
    return;
  }

  const matches = foods
    .filter(f => f.name.toLowerCase().includes(query))
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  if (matches.length === 0) {
    container.innerHTML = '<div class="empty-msg">⚠️ هیچ رکوردی پیدا نشد.</div>';
    return;
  }

  const last3 = matches.slice(0, 3);
  let html = `<div class="history-card">
    <div class="h-name">🍽️ ${matches[0].name}</div>
    <div class="h-count">🔢 تعداد کل دفعات صرف: ${matches.length} بار</div>
  </div>`;

  last3.forEach((r, i) => {
    html += `<div class="history-card">
      <div class="h-name">رکورد ${i + 1}</div>
      <div class="h-detail">📂 گروه: ${r.group}</div>
      <div class="h-detail">📅 تاریخ: ${r.date}</div>
      <div class="h-detail">👨‍🍳 تهیه‌کننده/مکان: ${r.maker}</div>
    </div>`;
  });

  container.innerHTML = html;
}

// ==================== آمار (۱۰ غذای پرتکرار) ====================
function renderStats() {
  const foods = loadFoods();
  const container = document.getElementById("stats-results");

  if (foods.length === 0) {
    container.innerHTML = '<div class="empty-msg">📭 هنوز غذایی ثبت نشده.</div>';
    return;
  }

  const counts = {};
  foods.forEach(f => { counts[f.name] = (counts[f.name] || 0) + 1; });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top10 = sorted.slice(0, 10);

  let html = "";
  top10.forEach(([name, count], i) => {
    const topClass = i < 3 ? " top-3" : "";
    html += `<div class="stat-row${topClass}">
      <span><span class="stat-rank">${i + 1}</span><span class="stat-name">🍽️ ${name}</span></span>
      <span class="stat-count">${count} بار</span>
    </div>`;
  });

  if (sorted.length > 10) {
    html += `<div class="empty-msg">📋 نمایش ۱۰ غذای پرتکرار از ${sorted.length} غذای ثبت‌شده</div>`;
  }

  container.innerHTML = html;
}

// ==================== مدیریت گروه‌ها ====================
function refreshGroupDropdown() {
  const sel = document.getElementById("food-group");
  const groups = loadGroups();
  sel.innerHTML = '<option value="">— انتخاب گروه —</option>' +
    groups.map(g => `<option value="${g}">${g}</option>`).join("");
}

function renderGroups() {
  const container = document.getElementById("groups-list");
  const groups = loadGroups();

  if (groups.length === 0) {
    container.innerHTML = '<div class="empty-msg">📭 هیچ گروهی وجود ندارد.</div>';
    return;
  }

  container.innerHTML = groups.map((g, i) => `
    <div class="group-item">
      <span class="g-name">📂 ${g}</span>
      <button class="btn-danger" onclick="deleteGroup(${i})">🗑️ حذف</button>
    </div>
  `).join("");
}

function addGroup() {
  const input = document.getElementById("new-group-name");
  const name = input.value.trim();
  if (!name) { alert("⚠️ نام گروه را وارد کنید."); return; }

  const groups = loadGroups();
  if (groups.includes(name)) { alert("⚠️ این گروه قبلاً وجود دارد."); return; }

  groups.push(name);
  saveGroups(groups);
  input.value = "";
  refreshGroupDropdown();
  renderGroups();
  alert("✅ گروه اضافه شد!");
}

function deleteGroup(index) {
  if (!confirm("آیا از حذف این گروه مطمئن هستید؟")) return;
  const groups = loadGroups();
  groups.splice(index, 1);
  saveGroups(groups);
  refreshGroupDropdown();
  renderGroups();
}

// ==================== تنظیمات: آپدیت ====================
function checkUpdate() {
  const status = document.getElementById("update-status");
  status.style.display = "block";
  status.style.background = "#fff3cd";
  status.style.color = "#856404";
  status.innerHTML = "ℹ️ برای بررسی آپدیت، از طریق پلتفرم هوشا (hoosha.com) نسخه جدید را دریافت کنید.<br>نسخه فعلی شما: " + APP_VERSION;
}

// ==================== پشتیبان‌گیری ====================
function exportBackup() {
  const backup = {
    version: APP_VERSION,
    exportDate: new Date().toISOString(),
    foods: loadFoods(),
    groups: loadGroups(),
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `food-app-backup-${new Date().toLocaleDateString("fa-IR").replace(/\//g, "-")}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importBackup(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if (!data.foods || !Array.isArray(data.foods)) {
        alert("❌ فایل پشتیبان نامعتبر است.");
        return;
      }
      if (!confirm("⚠️ این عملیات داده‌های فعلی را جایگزین می‌کند. ادامه می‌دهید؟")) return;

      saveFoods(data.foods);
      if (data.groups && Array.isArray(data.groups)) saveGroups(data.groups);

      refreshGroupDropdown();
      renderGroups();
      renderStats();

      alert("✅ داده‌ها با موفقیت بازیابی شدند!");
    } catch (err) {
      alert("❌ خطا در خواندن فایل: " + err.message);
    }
  };
  reader.readAsText(file);
}