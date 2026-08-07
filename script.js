// ==================== تنظیمات اولیه ====================
const APP_VERSION = "1.5";
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

const DEFAULT_GROUP_COLORS = {
  "غذاهای ایرانی": "#7dccae",
  "غذاهای فست‌فود": "#ffb5a7",
  "غذاهای دریایی": "#b5c7e8",
  "غذاهای گیاهی": "#c5e8a0",
  "خوراک‌های محلی": "#ffc78a",
  "دسر و شیرینی": "#f4a8c8",
  "صبحانه": "#d4b896",
  "سوپ و آش": "#c8b5e8",
};

// وضعیت ویرایش: اگر مقدار داشته باشد یعنی در حال ویرایش یک رکورد موجودیم
let editingFoodId = null;
let swRegistration = null;
let selectedMeal = "";        // وعده انتخاب‌شده در فرم ثبت/ویرایش
let statsMealFilter = "";     // فیلتر وعده در صفحه آمار ("" یعنی همه)

// ==================== Service Worker (کش آفلاین + بروزرسانی خودکار) ====================
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").then((reg) => {
      swRegistration = reg;

      // اگر همین الان یک نسخهٔ جدید در انتظار فعال‌سازی است
      if (reg.waiting && navigator.serviceWorker.controller) {
        showUpdateBanner();
      }

      // وقتی یک Service Worker جدید پیدا و نصب می‌شود
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            showUpdateBanner();
          }
        });
      });
    }).catch((err) => {
      console.warn("ثبت Service Worker ناموفق بود:", err);
    });

    // وقتی نسخهٔ جدید فعال شد، صفحه فقط یک‌بار رفرش شود
    let alreadyRefreshed = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (alreadyRefreshed) return;
      alreadyRefreshed = true;
      window.location.reload();
    });
  });
}

function showUpdateBanner() {
  if (document.getElementById("updateBanner")) return;
  const banner = document.createElement("div");
  banner.id = "updateBanner";
  banner.className = "update-banner";
  banner.innerHTML = '🆕 نسخهٔ جدید اپ آماده است <button id="btnApplyUpdate">اعمال و بارگذاری مجدد</button>';
  document.body.appendChild(banner);
  document.getElementById("btnApplyUpdate").addEventListener("click", () => {
    if (swRegistration && swRegistration.waiting) {
      swRegistration.waiting.postMessage("SKIP_WAITING");
    }
  });
}

// ==================== ابزار امنیتی (escape) ====================
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function generateId() {
  if (window.crypto && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "id_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
}

// ==================== مدیریت ذخیره‌سازی ====================
function getData(key, def) {
  const v = localStorage.getItem(key);
  return v ? JSON.parse(v) : def;
}

function setData(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

function loadFoods() { return getData("foods", []); }
function saveFoods(f) { setData("foods", f); }
function loadGroups() {
  const g = getData("groups", null);
  return g || [...DEFAULT_GROUPS];
}
function saveGroups(g) { setData("groups", g); }
function loadGroupColors() {
  const c = getData("groupColors", null);
  return c || { ...DEFAULT_GROUP_COLORS };
}
function saveGroupColors(c) { setData("groupColors", c); }

// ==================== مهاجرت داده‌های قدیمی (افزودن id) ====================
function migrateFoodIds() {
  const foods = loadFoods();
  let migrated = false;
  foods.forEach((f) => {
    if (!f.id) {
      f.id = generateId();
      migrated = true;
    }
  });
  if (migrated) saveFoods(foods);
}

// ==================== راه‌اندازی ====================
document.addEventListener("DOMContentLoaded", () => {
  if (!localStorage.getItem("groups")) saveGroups([...DEFAULT_GROUPS]);
  if (!localStorage.getItem("groupColors")) saveGroupColors({ ...DEFAULT_GROUP_COLORS });
  migrateFoodIds();

  document.getElementById("versionBadge").textContent = "v" + APP_VERSION;
  document.getElementById("currentVersionText").textContent = APP_VERSION;

  setTimeout(() => {
    document.getElementById("splash").style.display = "none";
    document.getElementById("appContainer").style.display = "block";
  }, 2800);

  document.getElementById("btnOpenAdd").addEventListener("click", () => openAddModal());
  document.getElementById("btnCloseAdd").addEventListener("click", closeAddModal);
  document.getElementById("btnOpenStats").addEventListener("click", openStatsTab);
  document.getElementById("btnBackFromStats").addEventListener("click", closeStatsTab);
  document.getElementById("btnOpenSettings").addEventListener("click", openSettingsModal);
  document.getElementById("btnCloseSettings").addEventListener("click", closeSettingsModal);
  document.getElementById("btnAddFood").addEventListener("click", saveFoodEntry);
  document.getElementById("btnAddGroup").addEventListener("click", addGroup);
  document.getElementById("btnCheckUpdate").addEventListener("click", checkUpdate);
  document.getElementById("btnExport").addEventListener("click", exportBackup);
  document.getElementById("btnImport").addEventListener("click", () => {
    document.getElementById("importFile").click();
  });
  document.getElementById("importFile").addEventListener("change", importBackup);
  document.getElementById("btnClearAll").addEventListener("click", clearAllData);

  document.getElementById("searchInput").addEventListener("input", renderFoodList);
  document.getElementById("filterGroup").addEventListener("change", renderFoodList);
  document.getElementById("filterMaker").addEventListener("change", renderFoodList);

  document.getElementById("foodName").addEventListener("input", showSuggestions);
  document.getElementById("foodName").addEventListener("blur", () => {
    setTimeout(() => { document.getElementById("suggestions").classList.remove("show"); }, 200);
  });

  // انتخاب وعده غذایی در فرم ثبت/ویرایش
  document.querySelectorAll("#mealPicker .meal-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const meal = btn.dataset.meal;
      // کلیک دوباره روی وعده انتخاب‌شده، آن را لغو می‌کند
      selectedMeal = (selectedMeal === meal) ? "" : meal;
      syncMealPicker();
    });
  });

  // فیلتر وعده در صفحه آمار
  document.querySelectorAll("#statsMealFilter .meal-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      statsMealFilter = btn.dataset.meal;
      document.querySelectorAll("#statsMealFilter .meal-btn").forEach((b) => {
        b.classList.toggle("active", b.dataset.meal === statsMealFilter);
      });
      renderStats();
    });
  });

  document.getElementById("foodServing").addEventListener("input", showServingSuggestions);
  document.getElementById("foodServing").addEventListener("blur", () => {
    setTimeout(() => { document.getElementById("servingSuggestions").classList.remove("show"); }, 200);
  });

  document.getElementById("foodMaker").addEventListener("input", showMakerSuggestions);
  document.getElementById("foodMaker").addEventListener("blur", () => {
    setTimeout(() => { document.getElementById("makerSuggestions").classList.remove("show"); }, 200);
  });

  const today = new Date().toISOString().split("T")[0];
  document.getElementById("foodDate").value = today;

  document.getElementById("addModal").addEventListener("click", (e) => {
    if (e.target.id === "addModal") closeAddModal();
  });
  document.getElementById("settingsModal").addEventListener("click", (e) => {
    if (e.target.id === "settingsModal") closeSettingsModal();
  });

  refreshGroupDropdowns();
  renderFoodList();
  renderGroupsInSettings();
  renderGroupColorPickers();
});

// ==================== Toast ====================
function showToast(msg, type = "") {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.className = "toast show " + type;
  setTimeout(() => { toast.className = "toast"; }, 2500);
}

// ==================== مودال ثبت/ویرایش ====================
// همگام‌سازی ظاهر دکمه‌های وعده با مقدار انتخاب‌شده
function syncMealPicker() {
  document.querySelectorAll("#mealPicker .meal-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.meal === selectedMeal);
  });
}

function openAddModal() {
  editingFoodId = null;
  document.getElementById("addModalTitle").textContent = "➕ ثبت غذای جدید";
  document.getElementById("btnAddFood").textContent = "✅ ثبت";
  document.getElementById("foodName").value = "";
  document.getElementById("foodMaker").value = "";
  document.getElementById("foodServing").value = "";
  document.getElementById("foodGroup").value = "";
  selectedMeal = "";
  syncMealPicker();
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("foodDate").value = today;
  document.getElementById("addModal").classList.add("show");
}

function openEditFood(id) {
  const foods = loadFoods();
  const food = foods.find((f) => f.id === id);
  if (!food) {
    showToast("❌ رکورد یافت نشد", "error");
    return;
  }
  editingFoodId = id;
  document.getElementById("addModalTitle").textContent = "✏️ ویرایش غذا";
  document.getElementById("btnAddFood").textContent = "💾 ذخیره تغییرات";
  document.getElementById("foodName").value = food.name;
  document.getElementById("foodGroup").value = food.group;
  document.getElementById("foodDate").value = food.date;
  document.getElementById("foodMaker").value = food.maker === "نامشخص" ? "" : food.maker;
  document.getElementById("foodServing").value = food.serving || "";
  selectedMeal = food.meal || "";
  syncMealPicker();
  document.getElementById("addModal").classList.add("show");
}

function closeAddModal() {
  document.getElementById("addModal").classList.remove("show");
  document.getElementById("foodName").value = "";
  document.getElementById("foodMaker").value = "";
  document.getElementById("foodServing").value = "";
  selectedMeal = "";
  syncMealPicker();
  document.getElementById("suggestions").classList.remove("show");
  document.getElementById("makerSuggestions").classList.remove("show");
  document.getElementById("servingSuggestions").classList.remove("show");
  editingFoodId = null;
  document.getElementById("addModalTitle").textContent = "➕ ثبت غذای جدید";
  document.getElementById("btnAddFood").textContent = "✅ ثبت";
}

// ==================== صفحه آمار ====================
function openStatsTab() {
  document.getElementById("main").classList.remove("active");
  document.getElementById("statsSection").classList.add("active");
  renderStats();
}

function closeStatsTab() {
  document.getElementById("statsSection").classList.remove("active");
  document.getElementById("main").classList.add("active");
}

function countBy(items, keyFn) {
  const counts = {};
  items.forEach((item) => {
    const key = keyFn(item);
    if (!key) return;
    counts[key] = (counts[key] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

function renderBarList(containerId, entries) {
  const container = document.getElementById(containerId);
  if (entries.length === 0) {
    container.innerHTML = '<div class="empty-msg">📭 داده‌ای برای نمایش وجود ندارد.</div>';
    return;
  }
  const max = entries[0][1];
  container.innerHTML = entries.map(([label, count]) => {
    const pct = Math.max(6, Math.round((count / max) * 100));
    return `<div class="stat-bar-row">
      <span class="stat-bar-name" title="${escapeHtml(label)}">${escapeHtml(label)}</span>
      <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${pct}%"></div></div>
      <span class="stat-bar-count">${count}</span>
    </div>`;
  }).join("");
}

function renderStats() {
  const allFoods = loadFoods();

  // اعمال فیلتر وعده (اگر انتخاب شده باشد)
  const foods = statsMealFilter
    ? allFoods.filter(f => f.meal === statsMealFilter)
    : allFoods;

  document.getElementById("statTotalRecords").textContent = foods.length;
  document.getElementById("statUniqueFoods").textContent = new Set(foods.map(f => f.name)).size;
  document.getElementById("statUniqueMakers").textContent =
    new Set(foods.map(f => f.maker).filter(m => m && m !== "نامشخص")).size;

  // توزیع وعده‌ها همیشه بر اساس کل داده‌ها محاسبه می‌شود تا نمای کلی حفظ شود
  const MEAL_ORDER = ["صبحانه", "ناهار", "شام"];
  const mealCounts = MEAL_ORDER
    .map(m => [m, allFoods.filter(f => f.meal === m).length])
    .filter(([, c]) => c > 0);
  const noMealCount = allFoods.filter(f => !f.meal).length;
  if (noMealCount > 0) mealCounts.push(["بدون وعده", noMealCount]);
  mealCounts.sort((a, b) => b[1] - a[1]);

  const foodCounts = countBy(foods, f => f.name);
  const makerCounts = countBy(foods, f => f.maker && f.maker !== "نامشخص" ? f.maker : null);

  renderBarList("statsMealList", mealCounts);
  renderBarList("statsFoodList", foodCounts);
  renderBarList("statsMakerList", makerCounts);
}

function openSettingsModal() {
  document.getElementById("settingsModal").classList.add("show");
  renderGroupsInSettings();
  renderGroupColorPickers();
}

function closeSettingsModal() {
  document.getElementById("settingsModal").classList.remove("show");
}

// ==================== Dropdown گروه‌ها ====================
// مرتب‌سازی الفبایی با پشتیبانی از حروف فارسی
function sortAlpha(arr) {
  return [...arr].sort((a, b) => String(a).localeCompare(String(b), "fa"));
}

function refreshGroupDropdowns() {
  const groups = sortAlpha(loadGroups());

  const sel1 = document.getElementById("foodGroup");
  const prevVal1 = sel1.value;
  sel1.innerHTML = '<option value="">— انتخاب گروه —</option>' +
    groups.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join("");
  sel1.value = prevVal1;

  const sel2 = document.getElementById("filterGroup");
  const prevVal2 = sel2.value;
  sel2.innerHTML = '<option value="">📂 همه گروه‌ها</option>' +
    groups.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join("");
  sel2.value = prevVal2;

  const foods = loadFoods();
  const makers = sortAlpha([...new Set(foods.map(f => f.maker).filter(m => m && m !== "نامشخص"))]);
  const sel3 = document.getElementById("filterMaker");
  const prevVal3 = sel3.value;
  sel3.innerHTML = '<option value="">👨‍🍳 همه تهیه‌کننده‌ها</option>' +
    makers.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join("");
  sel3.value = prevVal3;
}

// ==================== ثبت/ویرایش غذا ====================
function saveFoodEntry() {
  const name = document.getElementById("foodName").value.trim();
  const group = document.getElementById("foodGroup").value;
  const date = document.getElementById("foodDate").value;
  const maker = document.getElementById("foodMaker").value.trim();
  const serving = document.getElementById("foodServing").value.trim();

  if (!name) { showToast("⚠️ نام غذا را وارد کنید", "error"); return; }
  if (!group) { showToast("⚠️ گروه غذا را انتخاب کنید", "error"); return; }
  if (!date) { showToast("⚠️ تاریخ را انتخاب کنید", "error"); return; }

  const foods = loadFoods();

  if (editingFoodId) {
    const idx = foods.findIndex(f => f.id === editingFoodId);
    if (idx === -1) {
      showToast("❌ رکورد یافت نشد", "error");
      return;
    }
    foods[idx] = {
      ...foods[idx],
      name, group, date,
      maker: maker || "نامشخص",
      serving: serving,
      meal: selectedMeal,
    };
    saveFoods(foods);
    closeAddModal();
    refreshGroupDropdowns();
    renderFoodList();
    showToast("✅ تغییرات ذخیره شد!", "success");
    return;
  }

  foods.push({
    id: generateId(),
    name, group,
    date: date,
    maker: maker || "نامشخص",
    serving: serving,
    meal: selectedMeal,
    timestamp: Date.now(),
  });
  saveFoods(foods);

  closeAddModal();
  refreshGroupDropdowns();
  renderFoodList();
  showToast("✅ غذا ثبت شد!", "success");
}

function deleteFoodRecord(id) {
  if (!confirm("آیا از حذف این رکورد مطمئن هستید؟")) return;
  let foods = loadFoods();
  foods = foods.filter(f => f.id !== id);
  saveFoods(foods);
  refreshGroupDropdowns();
  renderFoodList();
  showToast("✅ رکورد حذف شد!", "success");
}

// ==================== پیشنهادات هوشمند (نام غذا) ====================
function showSuggestions() {
  const query = document.getElementById("foodName").value.trim().toLowerCase();
  const suggDiv = document.getElementById("suggestions");

  if (query.length < 2) {
    suggDiv.classList.remove("show");
    return;
  }

  const foods = loadFoods();
  const allNames = [...new Set(foods.map(f => f.name))];
  const matches = allNames.filter(n => n.toLowerCase().includes(query));

  if (matches.length === 0) {
    suggDiv.classList.remove("show");
    return;
  }

  suggDiv.innerHTML = matches.map(n =>
    `<div class="suggestion-item" onclick="selectSuggestion('${n.replace(/'/g, "\\'")}')">🍽️ ${escapeHtml(n)}</div>`
  ).join("");
  suggDiv.classList.add("show");
}

function selectSuggestion(name) {
  document.getElementById("foodName").value = name;
  document.getElementById("suggestions").classList.remove("show");

  const foods = loadFoods();
  const existing = foods.find(f => f.name === name);
  if (existing) {
    document.getElementById("foodGroup").value = existing.group;
  }
}

// ==================== پیشنهادات هوشمند (تهیه‌کننده / مکان) ====================
function showMakerSuggestions() {
  const query = document.getElementById("foodMaker").value.trim().toLowerCase();
  const suggDiv = document.getElementById("makerSuggestions");

  if (query.length < 1) {
    suggDiv.classList.remove("show");
    return;
  }

  const foods = loadFoods();
  const allMakers = [...new Set(foods.map(f => f.maker).filter(m => m && m !== "نامشخص"))];
  const matches = allMakers.filter(m => m.toLowerCase().includes(query));

  if (matches.length === 0) {
    suggDiv.classList.remove("show");
    return;
  }

  suggDiv.innerHTML = matches.map(m =>
    `<div class="suggestion-item" onclick="selectMakerSuggestion('${m.replace(/'/g, "\\'")}')">👨‍🍳 ${escapeHtml(m)}</div>`
  ).join("");
  suggDiv.classList.add("show");
}

function selectMakerSuggestion(name) {
  document.getElementById("foodMaker").value = name;
  document.getElementById("makerSuggestions").classList.remove("show");
}

// ==================== پیشنهادات هوشمند (نحوه صرف غذا) ====================
function showServingSuggestions() {
  const query = document.getElementById("foodServing").value.trim().toLowerCase();
  const suggDiv = document.getElementById("servingSuggestions");

  if (query.length < 1) {
    suggDiv.classList.remove("show");
    return;
  }

  const foods = loadFoods();
  const allServings = [...new Set(foods.map(f => f.serving).filter(v => v))];
  const matches = allServings.filter(v => v.toLowerCase().includes(query));

  if (matches.length === 0) {
    suggDiv.classList.remove("show");
    return;
  }

  suggDiv.innerHTML = matches.map(v =>
    `<div class="suggestion-item" onclick="selectServingSuggestion('${v.replace(/'/g, "\\'")}')">🍚 ${escapeHtml(v)}</div>`
  ).join("");
  suggDiv.classList.add("show");
}

function selectServingSuggestion(value) {
  document.getElementById("foodServing").value = value;
  document.getElementById("servingSuggestions").classList.remove("show");
}

// ==================== نمایش لیست غذاها ====================
function renderFoodList() {
  const searchQuery = document.getElementById("searchInput").value.trim().toLowerCase();
  const filterGroup = document.getElementById("filterGroup").value;
  const filterMaker = document.getElementById("filterMaker").value;
  const foods = loadFoods();
  const colors = loadGroupColors();
  const container = document.getElementById("foodList");

  if (foods.length === 0) {
    container.innerHTML = '<div class="empty-msg">📭 هنوز غذایی ثبت نشده.<br>برای ثبت غذا روی دکمه + بزنید.</div>';
    return;
  }

  let filtered = foods;
  if (searchQuery) {
    filtered = filtered.filter(f => f.name.toLowerCase().includes(searchQuery));
  }
  if (filterGroup) {
    filtered = filtered.filter(f => f.group === filterGroup);
  }
  if (filterMaker) {
    filtered = filtered.filter(f => f.maker === filterMaker);
  }

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-msg">🔍 نتیجه‌ای یافت نشد.</div>';
    return;
  }

  // گروه‌بندی رکوردها بر اساس نام غذا
  const grouped = {};
  filtered.forEach(f => {
    if (!grouped[f.name]) grouped[f.name] = [];
    grouped[f.name].push(f);
  });

  // هر غذا زیر «آخرین تاریخ تهیه»‌اش قرار می‌گیرد
  const byDate = {};
  Object.keys(grouped).forEach(name => {
    const records = grouped[name].sort((a, b) => b.date.localeCompare(a.date));
    const latestDate = records[0].date;
    if (!byDate[latestDate]) byDate[latestDate] = [];
    byDate[latestDate].push({ name, records });
  });

  // تاریخ‌ها از جدید به قدیم
  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  let html = "";
  sortedDates.forEach(date => {
    html += `<div class="date-group">
      <div class="date-header">📅 ${formatDate(date)}</div>`;

    // غذاهای هر تاریخ به ترتیب الفبا
    const items = byDate[date].sort((a, b) => a.name.localeCompare(b.name, "fa"));

    items.forEach(({ name, records }) => {
      const count = records.length;
      const groupColor = colors[records[0].group] || "#7dccae";
      const repeatBadge = count > 1 ? `<span class="food-count">${count} بار</span>` : "";

      html += `<div class="food-item">
        <div class="food-header" onclick="toggleDetails(this)">
          <div class="food-icon" style="background:${groupColor}20; color:${groupColor};">🍽️</div>
          <span class="food-name">${escapeHtml(name)}</span>
          ${repeatBadge}
          <span class="food-arrow">▼</span>
        </div>
        <div class="food-details">`;

      records.forEach(r => {
        const servingRow = r.serving
          ? `<div class="detail-row"><span class="detail-label">🍚 نحوه صرف:</span><span class="detail-value">${escapeHtml(r.serving)}</span></div>`
          : "";
        const mealRow = r.meal
          ? `<div class="detail-row"><span class="detail-label">🕐 وعده:</span><span class="detail-value">${escapeHtml(r.meal)}</span></div>`
          : "";
        html += `<div class="food-detail-entry">
          <div class="detail-row"><span class="detail-label">📅 تاریخ:</span><span class="detail-value">${formatDate(r.date)}</span></div>
          <div class="detail-row"><span class="detail-label">📂 گروه:</span><span class="detail-value">${escapeHtml(r.group)}</span></div>
          <div class="detail-row"><span class="detail-label">👨‍🍳 تهیه:</span><span class="detail-value">${escapeHtml(r.maker)}</span></div>
          ${mealRow}
          ${servingRow}
          <div class="detail-actions">
            <button class="btn-icon-sm" onclick="openEditFood('${r.id}')">✏️ ویرایش</button>
            <button class="btn-icon-sm btn-icon-danger" onclick="deleteFoodRecord('${r.id}')">🗑️ حذف</button>
          </div>
        </div>`;
      });

      html += `</div></div>`;
    });

    html += `</div>`;
  });

  container.innerHTML = html;
}

function toggleDetails(headerEl) {
  const details = headerEl.nextElementSibling;
  const arrow = headerEl.querySelector(".food-arrow");
  details.classList.toggle("open");
  arrow.classList.toggle("open");
}

function formatDate(dateStr) {
  if (!dateStr) return "نامشخص";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[0]}/${parts[1]}/${parts[2]}`;
  }
  return dateStr;
}

// ==================== مدیریت گروه‌ها در تنظیمات ====================
function renderGroupsInSettings() {
  const container = document.getElementById("groupsList");
  const groups = loadGroups();

  if (groups.length === 0) {
    container.innerHTML = '<div class="empty-msg">هیچ گروهی وجود ندارد.</div>';
    return;
  }

  container.innerHTML = groups.map((g, i) =>
    `<div class="group-item">
      <span class="g-name">📂 ${escapeHtml(g)}</span>
      <button class="btn-delete-sm" onclick="deleteGroup(${i})">🗑️ حذف</button>
    </div>`
  ).join("");
}

function addGroup() {
  const input = document.getElementById("newGroupName");
  const name = input.value.trim();
  if (!name) { showToast("⚠️ نام گروه را وارد کنید", "error"); return; }

  const groups = loadGroups();
  if (groups.includes(name)) { showToast("⚠️ این گروه قبلاً وجود دارد", "error"); return; }

  groups.push(name);
  saveGroups(groups);

  const colors = loadGroupColors();
  const palette = ["#7dccae", "#ffb5a7", "#b5c7e8", "#c5e8a0", "#ffc78a", "#f4a8c8", "#d4b896", "#c8b5e8"];
  colors[name] = palette[groups.length % palette.length];
  saveGroupColors(colors);

  input.value = "";
  refreshGroupDropdowns();
  renderGroupsInSettings();
  renderGroupColorPickers();
  showToast("✅ گروه اضافه شد!", "success");
}

function deleteGroup(index) {
  if (!confirm("آیا از حذف این گروه مطمئن هستید؟")) return;
  const groups = loadGroups();
  const name = groups[index];
  groups.splice(index, 1);
  saveGroups(groups);

  const colors = loadGroupColors();
  delete colors[name];
  saveGroupColors(colors);

  refreshGroupDropdowns();
  renderGroupsInSettings();
  renderGroupColorPickers();
  showToast("✅ گروه حذف شد!", "success");
}

// ==================== رنگ گروه‌ها ====================
function renderGroupColorPickers() {
  const container = document.getElementById("groupColorsList");
  const groups = loadGroups();
  const colors = loadGroupColors();

  container.innerHTML = groups.map(g =>
    `<div class="color-picker-row">
      <span class="color-label">📂 ${escapeHtml(g)}</span>
      <input type="color" value="${colors[g] || '#7dccae'}" onchange="updateGroupColor('${g.replace(/'/g, "\\'")}', this.value)">
    </div>`
  ).join("");
}

function updateGroupColor(groupName, color) {
  const colors = loadGroupColors();
  colors[groupName] = color;
  saveGroupColors(colors);
  renderFoodList();
  showToast("✅ رنگ ذخیره شد!", "success");
}

// ==================== آپدیت ====================
async function checkUpdate() {
  const status = document.getElementById("updateStatus");
  status.style.display = "block";
  status.style.background = "#eef6f2";
  status.style.color = "#3a4a5a";
  status.innerHTML = "🔄 در حال بررسی آپدیت...";

  try {
    const res = await fetch("version.json?t=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("bad response");
    const data = await res.json();
    const remoteVersion = data.version;
    if (!remoteVersion) throw new Error("no version field");

    if (remoteVersion === APP_VERSION) {
      status.style.background = "#e6f7ee";
      status.style.color = "#2f7a52";
      status.innerHTML = "✅ شما از آخرین نسخه استفاده می‌کنید (نسخه " + APP_VERSION + ")";
    } else {
      status.style.background = "#fff3cd";
      status.style.color = "#856404";
      status.innerHTML = "🆕 نسخهٔ جدیدی موجود است: " + escapeHtml(remoteVersion) +
        " (نسخهٔ فعلی شما: " + APP_VERSION + ")<br>برای دریافت نسخهٔ جدید، صفحه را کاملاً ببندید و از لینک اپ دوباره باز کنید.";
    }
  } catch (err) {
    status.style.background = "#fdecea";
    status.style.color = "#b3261e";
    status.innerHTML = "❌ بررسی آپدیت ممکن نشد (اتصال اینترنت را بررسی کنید).<br>نسخهٔ فعلی شما: " + APP_VERSION;
  }
}

// ==================== پشتیبان‌گیری ====================
function exportBackup() {
  const backup = {
    version: APP_VERSION,
    exportDate: new Date().toISOString(),
    foods: loadFoods(),
    groups: loadGroups(),
    groupColors: loadGroupColors(),
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `food-recorder-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("✅ فایل پشتیبان دانلود شد!", "success");
}

function importBackup(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if (!data.foods || !Array.isArray(data.foods)) {
        showToast("❌ فایل پشتیبان نامعتبر است", "error");
        return;
      }
      if (!confirm("⚠️ این عملیات داده‌های فعلی را جایگزین می‌کند. ادامه می‌دهید؟")) return;

      saveFoods(data.foods);
      if (data.groups && Array.isArray(data.groups)) saveGroups(data.groups);
      if (data.groupColors) saveGroupColors(data.groupColors);

      migrateFoodIds();
      refreshGroupDropdowns();
      renderFoodList();
      renderGroupsInSettings();
      renderGroupColorPickers();
      showToast("✅ داده‌ها بازیابی شدند!", "success");
    } catch (err) {
      showToast("❌ خطا در خواندن فایل", "error");
    }
  };
  reader.readAsText(file);
}

// ==================== پاک کردن ====================
function clearAllData() {
  if (!confirm("⚠️ تمام غذاها و گروه‌ها حذف می‌شوند. این عمل قابل بازگشت نیست!")) return;
  if (!confirm("آیا واقعاً مطمئن هستید؟")) return;

  saveFoods([]);
  saveGroups([...DEFAULT_GROUPS]);
  saveGroupColors({ ...DEFAULT_GROUP_COLORS });

  refreshGroupDropdowns();
  renderFoodList();
  renderGroupsInSettings();
  renderGroupColorPickers();
  showToast("✅ همه داده‌ها پاک شدند!", "success");
}
