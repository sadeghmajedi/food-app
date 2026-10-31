// ==================== تنظیمات اولیه ====================
const APP_VERSION = "1.10";
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
let formIngEditor = null;     // v1.10: ورودی مواد در فرم ثبت/ویرایش
let dishIngEditor = null;     // v1.10: ورودی مواد در پنجره‌ی «مواد اصلی» یک غذا
let dishIngEditingName = null;
let ingFilter = [];           // v1.10: مواد انتخاب‌شده در فیلتر: [{ k: کلید یکسان‌شده, l: برچسب }]
let ingFilterMode = "all";    // "all" = شامل همه‌ی این مواد، "only" = فقط با همین مواد

// ==================== یکسان‌سازی متن فارسی/عربی ====================
// کیبورد عربی و فارسی آیفون «ی»، «ک» و ارقام را با کدهای Unicode متفاوت تولید می‌کنند
// (ي/ى در برابر ی، ك در برابر ک). این تابع فقط در لحظه‌ی مقایسه، جستجو و گروه‌بندی
// استفاده می‌شود و هیچ داده‌ی ذخیره‌شده‌ای را تغییر نمی‌دهد.
function normalizeFa(s) {
  if (s == null) return "";
  return String(s)
    .replace(/[\u064A\u0649]/g, "\u06CC")                              // ي ى → ی
    .replace(/\u0643/g, "\u06A9")                                      // ك → ک
    .replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660)) // ارقام عربی → لاتین
    .replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0)) // ارقام فارسی → لاتین
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")                       // اعراب و کشیده
    .replace(/[\u200C\u200D\u200E\u200F]/g, "")                        // نیم‌فاصله و نویسه‌های جهت
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// حذف موارد تکراری بر اساس شکل یکسان‌شده؛ ترتیب اولین مشاهده حفظ می‌شود
// و برای نمایش، آخرین شکل ثبت‌شده (معمولاً با کیبورد فارسی) نگه داشته می‌شود
function uniqueByNormalized(arr) {
  const seen = new Map();
  arr.forEach(v => {
    const k = normalizeFa(v);
    if (k) seen.set(k, v);
  });
  return [...seen.values()];
}

// ==================== Service Worker (کش آفلاین + بروزرسانی خودکار) ====================
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then((reg) => {
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

// ==================== مواد اصلی غذاها (v1.10) ====================
// مواد مال «غذا» است، نه هر رکورد: dishIngredients = { نام یکسان‌شده‌ی غذا: ["گوشت", "لپه", ...] }
// رکوردهای foods دست نمی‌خورند. اگر نام غذا عوض شود، مواد به نام جدید منتقل نمی‌شود.
function loadDishIngredients() {
  const m = getData("dishIngredients", {});
  return (m && typeof m === "object" && !Array.isArray(m)) ? m : {};
}
function saveDishIngredients(m) { setData("dishIngredients", m); }

function getDishIngredients(name, map) {
  const m = map || loadDishIngredients();
  const list = m[normalizeFa(name)];
  return Array.isArray(list) ? list : [];
}

function setDishIngredients(name, list) {
  const key = normalizeFa(name);
  if (!key) return;
  const m = loadDishIngredients();
  if (list.length) m[key] = list;
  else delete m[key];
  saveDishIngredients(m);
}

// همه‌ی مواد شناخته‌شده: کلید یکسان‌شده → [شکل اولین ثبت، تعداد غذاهایی که آن را دارند]
// شکل اولین ثبت برای مواد جدید استفاده می‌شود تا «گوشت» همه‌جا یکسان بماند
function knownIngredientLabels() {
  const seen = new Map();
  Object.values(loadDishIngredients()).forEach((list) => {
    (Array.isArray(list) ? list : []).forEach((label) => {
      const k = normalizeFa(label);
      if (!k) return;
      const prev = seen.get(k);
      seen.set(k, [prev ? prev[0] : label, (prev ? prev[1] : 0) + 1]);
    });
  });
  return seen;
}

// ورودی چیپی مواد؛ هم در فرم ثبت و هم در پنجره‌ی «مواد اصلی» یک غذا استفاده می‌شود.
// root باید .ing-chips، .ing-input، .ing-add-btn و .ing-sugg داشته باشد.
// touched یعنی کاربر خودش ماده‌ای اضافه یا حذف کرده (فقط در این حالت ذخیره می‌شود).
function createIngredientEditor(root) {
  const chipsEl = root.querySelector(".ing-chips");
  const input = root.querySelector(".ing-input");
  const addBtn = root.querySelector(".ing-add-btn");
  const sugg = root.querySelector(".ing-sugg");
  let items = [];
  const ed = { touched: false };

  function render() {
    chipsEl.innerHTML = items.map((label, i) =>
      `<span class="ing-chip">${escapeHtml(label)}<button type="button" class="ing-chip-x" data-i="${i}" aria-label="حذف">✕</button></span>`
    ).join("");
    chipsEl.style.display = items.length ? "" : "none";
  }

  function add(raw) {
    const known = knownIngredientLabels();
    String(raw).split(/[،,]/).forEach((part) => {
      const text = part.replace(/\s+/g, " ").trim();
      const k = normalizeFa(text);
      if (!k || items.some((x) => normalizeFa(x) === k)) return;
      const existing = known.get(k);
      items.push(existing ? existing[0] : text);
      ed.touched = true;
    });
    render();
  }

  function commitInput() {
    if (input.value.trim()) add(input.value);
    input.value = "";
  }

  function showSugg() {
    const q = normalizeFa(input.value);
    const chosen = new Set(items.map(normalizeFa));
    const all = [...knownIngredientLabels().entries()]
      .filter(([k]) => !chosen.has(k))
      .sort((a, b) => b[1][1] - a[1][1] || a[1][0].localeCompare(b[1][0], "fa"));
    const matches = (q ? all.filter(([k]) => k.includes(q)) : all).slice(0, 12);
    if (matches.length === 0) { sugg.classList.remove("show"); return; }
    sugg.innerHTML = matches.map(([, [label]]) =>
      `<div class="suggestion-item" data-label="${escapeHtml(label)}">🥕 ${escapeHtml(label)}</div>`
    ).join("");
    sugg.classList.add("show");
  }

  input.addEventListener("input", () => {
    if (/[،,]/.test(input.value)) commitInput();
    showSugg();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); commitInput(); showSugg(); }
  });
  input.addEventListener("focus", showSugg);
  input.addEventListener("blur", () => {
    setTimeout(() => { sugg.classList.remove("show"); }, 200);
  });
  addBtn.addEventListener("click", () => { commitInput(); showSugg(); });
  sugg.addEventListener("mousedown", (e) => e.preventDefault()); // فوکوس از فیلد نرود
  sugg.addEventListener("click", (e) => {
    const it = e.target.closest(".suggestion-item");
    if (!it) return;
    add(it.dataset.label);
    input.value = "";
    showSugg();
  });
  chipsEl.addEventListener("click", (e) => {
    const b = e.target.closest(".ing-chip-x");
    if (!b) return;
    items.splice(Number(b.dataset.i), 1);
    ed.touched = true;
    render();
  });

  // متن تایپ‌شده‌ای که هنوز چیپ نشده هم حساب می‌شود
  ed.get = () => { commitInput(); return [...items]; };
  ed.set = (list) => {
    items = [...list];
    ed.touched = false;
    input.value = "";
    sugg.classList.remove("show");
    render();
  };
  render();
  return ed;
}

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
    maybeShowWhatsNew();
  }, 2800);

  // v1.10: مواد اصلی و فیلتر مواد
  formIngEditor = createIngredientEditor(document.getElementById("formIngEditor"));
  dishIngEditor = createIngredientEditor(document.getElementById("dishIngEditor"));
  document.getElementById("foodName").addEventListener("input", autoFillFormIngredients);
  document.getElementById("btnOpenIngFilter").addEventListener("click", openIngFilter);
  document.getElementById("btnCloseIngFilter").addEventListener("click", closeIngFilter);
  document.getElementById("btnApplyIngFilter").addEventListener("click", closeIngFilter);
  document.getElementById("btnClearIngFilter").addEventListener("click", () => {
    ingFilter = [];
    renderIngFilterSheet();
    renderFoodList();
  });
  document.getElementById("ingFilterSearch").addEventListener("input", renderIngFilterSheet);
  document.querySelectorAll("#ingModePicker .meal-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      ingFilterMode = btn.dataset.mode;
      renderIngFilterSheet();
      renderFoodList();
    });
  });
  document.getElementById("ingFilterChips").addEventListener("click", (e) => {
    const chip = e.target.closest(".ing-fchip");
    if (!chip || chip.disabled) return;
    toggleIngFilter(chip.dataset.k, chip.dataset.l);
  });
  document.getElementById("ingActive").addEventListener("click", (e) => {
    if (e.target.closest(".ing-active-clear")) { ingFilter = []; renderFoodList(); return; }
    const x = e.target.closest(".ing-active-chip");
    if (x) toggleIngFilter(x.dataset.k, "");
  });
  document.getElementById("foodList").addEventListener("click", (e) => {
    const b = e.target.closest(".btn-ing-edit");
    if (b) openDishIngEditor(b.dataset.dish);
  });
  document.getElementById("noIngList").addEventListener("click", (e) => {
    const b = e.target.closest(".btn-ing-edit");
    if (b) openDishIngEditor(b.dataset.dish);
  });
  document.getElementById("btnCloseDishIng").addEventListener("click", closeDishIngEditor);
  document.getElementById("btnSaveDishIng").addEventListener("click", saveDishIngEditor);
  document.getElementById("btnCloseWhatsNew").addEventListener("click", closeWhatsNew);
  document.getElementById("ingFilterModal").addEventListener("click", (e) => {
    if (e.target.id === "ingFilterModal") closeIngFilter();
  });
  document.getElementById("dishIngModal").addEventListener("click", (e) => {
    if (e.target.id === "dishIngModal") closeDishIngEditor();
  });
  document.getElementById("whatsNewModal").addEventListener("click", (e) => {
    if (e.target.id === "whatsNewModal") closeWhatsNew();
  });

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
  formIngEditor.set([]);
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("foodDate").value = today;
  document.getElementById("addModal").classList.add("show");
}

// v1.10: با تایپ یا انتخاب نام غذا، مواد ثبت‌شده‌ی آن غذا نمایش داده می‌شود؛
// اگر کاربر خودش مواد را تغییر داده باشد، دست نمی‌خورد
function autoFillFormIngredients() {
  if (!formIngEditor || formIngEditor.touched) return;
  formIngEditor.set(getDishIngredients(document.getElementById("foodName").value));
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
  formIngEditor.set(getDishIngredients(food.name));
  document.getElementById("addModal").classList.add("show");
}

function closeAddModal() {
  document.getElementById("addModal").classList.remove("show");
  document.getElementById("foodName").value = "";
  document.getElementById("foodMaker").value = "";
  document.getElementById("foodServing").value = "";
  selectedMeal = "";
  syncMealPicker();
  formIngEditor.set([]);
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

// v1.9: سهم هر رکورد در «تعداد دفعات صرف» = ۱ ÷ تعداد غذاهای ثبت‌شده در همان تاریخ و همان وعده
// (۲ غذا در یک وعده → هرکدام ۰.۵؛ ۳ غذا → هرکدام ⅓). رکورد بدون وعده سهم کامل ۱ دارد،
// چون معلوم نیست با کدام غذاها در یک وعده بوده. فقط هنگام نمایش محاسبه می‌شود و داده‌ی ذخیره‌شده دست نمی‌خورد.
// همیشه روی کل رکوردها (بدون فیلتر) حساب شود؛ کلید Map خود شیء رکورد است.
function computeMealShares(allFoods) {
  const slotKey = (f) => (f.meal && f.date ? f.date + "|" + f.meal : null);
  const slotSize = new Map();
  allFoods.forEach((f) => {
    const k = slotKey(f);
    if (k) slotSize.set(k, (slotSize.get(k) || 0) + 1);
  });
  const shares = new Map();
  allFoods.forEach((f) => {
    const k = slotKey(f);
    shares.set(f, k ? 1 / slotSize.get(k) : 1);
  });
  return shares;
}

// نمایش شمارش کسری با حداکثر یک رقم اعشار (⅓ → 0.3)؛ جمع‌ها با مقدار دقیق محاسبه می‌شوند
function formatCount(n) {
  return String(Math.round(n * 10) / 10);
}

function countBy(items, keyFn, weightFn) {
  // شمارش بر اساس شکل یکسان‌شده تا «ی/ک» عربی و فارسی یک مورد حساب شوند
  const counts = new Map();
  items.forEach((item) => {
    const label = keyFn(item);
    if (!label) return;
    const k = normalizeFa(label);
    if (!k) return;
    const prev = counts.get(k);
    const w = weightFn ? weightFn(item) : 1;
    counts.set(k, [label, (prev ? prev[1] : 0) + w]);
  });
  return [...counts.values()].sort((a, b) => b[1] - a[1]);
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
      <span class="stat-bar-count">${formatCount(count)}</span>
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
  document.getElementById("statUniqueFoods").textContent = uniqueByNormalized(foods.map(f => f.name)).length;
  document.getElementById("statUniqueMakers").textContent =
    uniqueByNormalized(foods.map(f => f.maker).filter(m => m && m !== "نامشخص")).length;

  // توزیع وعده‌ها همیشه بر اساس کل داده‌ها محاسبه می‌شود تا نمای کلی حفظ شود
  const MEAL_ORDER = ["صبحانه", "ناهار", "شام"];
  const mealCounts = MEAL_ORDER
    .map(m => [m, allFoods.filter(f => f.meal === m).length])
    .filter(([, c]) => c > 0);
  const noMealCount = allFoods.filter(f => !f.meal).length;
  if (noMealCount > 0) mealCounts.push(["بدون وعده", noMealCount]);
  mealCounts.sort((a, b) => b[1] - a[1]);

  const shares = computeMealShares(allFoods);
  const foodCounts = countBy(foods, f => f.name, f => shares.get(f));
  const makerCounts = countBy(foods, f => f.maker && f.maker !== "نامشخص" ? f.maker : null);

  renderBarList("statsMealList", mealCounts);
  renderBarList("statsFoodList", foodCounts);
  renderBarList("statsMakerList", makerCounts);
}

function openSettingsModal() {
  document.getElementById("settingsModal").classList.add("show");
  renderGroupsInSettings();
  renderGroupColorPickers();
  renderNoIngredientList();
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
  const makers = sortAlpha(uniqueByNormalized(foods.map(f => f.maker).filter(m => m && m !== "نامشخص")));
  const sel3 = document.getElementById("filterMaker");
  const prevVal3 = sel3.value;
  sel3.innerHTML = '<option value="">👨‍🍳 تهیه‌کننده‌ها</option>' +
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

  // v1.10: مواد فقط وقتی ذخیره می‌شود که کاربر آن را تغییر داده باشد (برای همه‌ی رکوردهای این غذا)
  const ingredients = formIngEditor.get();
  if (formIngEditor.touched) setDishIngredients(name, ingredients);

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
  const query = normalizeFa(document.getElementById("foodName").value);
  const suggDiv = document.getElementById("suggestions");

  if (query.length < 2) {
    suggDiv.classList.remove("show");
    return;
  }

  const foods = loadFoods();
  const allNames = uniqueByNormalized(foods.map(f => f.name));
  const matches = allNames.filter(n => normalizeFa(n).includes(query));

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
  const existing = foods.find(f => normalizeFa(f.name) === normalizeFa(name));
  if (existing) {
    document.getElementById("foodGroup").value = existing.group;
  }
  autoFillFormIngredients();
}

// ==================== پیشنهادات هوشمند (تهیه‌کننده / مکان) ====================
function showMakerSuggestions() {
  const query = normalizeFa(document.getElementById("foodMaker").value);
  const suggDiv = document.getElementById("makerSuggestions");

  if (query.length < 1) {
    suggDiv.classList.remove("show");
    return;
  }

  const foods = loadFoods();
  const allMakers = uniqueByNormalized(foods.map(f => f.maker).filter(m => m && m !== "نامشخص"));
  const matches = allMakers.filter(m => normalizeFa(m).includes(query));

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
  const query = normalizeFa(document.getElementById("foodServing").value);
  const suggDiv = document.getElementById("servingSuggestions");

  if (query.length < 1) {
    suggDiv.classList.remove("show");
    return;
  }

  const foods = loadFoods();
  const allServings = uniqueByNormalized(foods.map(f => f.serving).filter(v => v));
  const matches = allServings.filter(v => normalizeFa(v).includes(query));

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
// فیلترهای جستجو، گروه و تهیه‌کننده (بدون فیلتر مواد)؛ پنجره‌ی فیلتر مواد هم روی همین نتیجه شمارش می‌کند
function getBaseFilteredFoods(foods) {
  const searchQuery = normalizeFa(document.getElementById("searchInput").value);
  const filterGroup = document.getElementById("filterGroup").value;
  const filterMaker = document.getElementById("filterMaker").value;
  let filtered = foods;
  if (searchQuery) {
    filtered = filtered.filter(f => normalizeFa(f.name).includes(searchQuery));
  }
  if (filterGroup) {
    filtered = filtered.filter(f => f.group === filterGroup);
  }
  if (filterMaker) {
    filtered = filtered.filter(f => normalizeFa(f.maker) === normalizeFa(filterMaker));
  }
  return filtered;
}

// ==================== فیلتر مواد (v1.10) ====================
// «شامل همه»: غذا همه‌ی مواد انتخاب‌شده را دارد.
// «فقط با همین مواد»: همه‌ی مواد غذا جزو انتخاب‌هاست (غذای بدون مواد هیچ‌وقت نمایش داده نمی‌شود).
function dishPassesIngFilter(ingKeys, selectedKeys, mode) {
  if (selectedKeys.length === 0) return true;
  if (mode === "only") {
    if (ingKeys.size === 0) return false;
    const sel = new Set(selectedKeys);
    return [...ingKeys].every(k => sel.has(k));
  }
  return selectedKeys.every(k => ingKeys.has(k));
}

// غذاهای یکتا (کلید یکسان‌شده‌ی نام) → مجموعه‌ی کلید مواد
function dishIngredientKeys(records, map) {
  const dishes = new Map();
  records.forEach((f) => {
    const k = normalizeFa(f.name);
    if (!k || dishes.has(k)) return;
    const list = Array.isArray(map[k]) ? map[k] : [];
    dishes.set(k, new Set(list.map(normalizeFa).filter(Boolean)));
  });
  return dishes;
}

function toggleIngFilter(k, label) {
  const i = ingFilter.findIndex(x => x.k === k);
  if (i >= 0) ingFilter.splice(i, 1);
  else ingFilter.push({ k, l: label });
  if (document.getElementById("ingFilterModal").classList.contains("show")) renderIngFilterSheet();
  renderFoodList();
}

// دکمه‌ی «مواد» و چیپ‌های مواد انتخاب‌شده زیر نوار فیلتر
function renderIngActive() {
  const btn = document.getElementById("btnOpenIngFilter");
  btn.textContent = ingFilter.length ? `🥕 مواد (${ingFilter.length})` : "🥕 مواد";
  btn.classList.toggle("active", ingFilter.length > 0);
  const box = document.getElementById("ingActive");
  if (!ingFilter.length) { box.innerHTML = ""; box.style.display = "none"; return; }
  const modeLabel = ingFilterMode === "only" ? "فقط با همین مواد:" : "شامل همه:";
  box.innerHTML = `<span class="ing-active-mode">${modeLabel}</span>` +
    ingFilter.map(x =>
      `<button type="button" class="ing-active-chip" data-k="${escapeHtml(x.k)}">${escapeHtml(x.l)} ✕</button>`
    ).join("") +
    `<button type="button" class="ing-active-clear">پاک کردن</button>`;
  box.style.display = "";
}

function openIngFilter() {
  document.getElementById("ingFilterSearch").value = "";
  renderIngFilterSheet();
  document.getElementById("ingFilterModal").classList.add("show");
}

function closeIngFilter() {
  document.getElementById("ingFilterModal").classList.remove("show");
}

function renderIngFilterSheet() {
  document.querySelectorAll("#ingModePicker .meal-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === ingFilterMode);
  });
  document.getElementById("ingModeHint").textContent = ingFilterMode === "only"
    ? "غذاهایی که همه‌ی مواد اصلی‌شان جزو مواد انتخاب‌شده است؛ یعنی با همین‌ها می‌شود پخت."
    : "غذاهایی که همه‌ی مواد انتخاب‌شده را دارند.";

  const map = loadDishIngredients();
  const dishes = dishIngredientKeys(getBaseFilteredFoods(loadFoods()), map);
  const selectedKeys = ingFilter.map(x => x.k);
  const countWith = (keys) =>
    [...dishes.values()].filter(set => dishPassesIngFilter(set, keys, ingFilterMode)).length;

  // مواد غذاهای موجود در نتیجه‌ی فعلی، به ترتیب تعداد غذا
  const index = new Map();
  dishes.forEach((set, dishKey) => {
    (map[dishKey] || []).forEach((label) => {
      const k = normalizeFa(label);
      if (!k) return;
      const prev = index.get(k);
      index.set(k, [prev ? prev[0] : label, (prev ? prev[1] : 0) + 1]);
    });
  });
  ingFilter.forEach(x => { if (!index.has(x.k)) index.set(x.k, [x.l, 0]); });

  const q = normalizeFa(document.getElementById("ingFilterSearch").value);
  const entries = [...index.entries()]
    .filter(([k]) => !q || k.includes(q) || selectedKeys.includes(k))
    .sort((a, b) => b[1][1] - a[1][1] || a[1][0].localeCompare(b[1][0], "fa"));

  const chipsBox = document.getElementById("ingFilterChips");
  if (index.size === 0) {
    chipsBox.innerHTML = '<div class="empty-msg ing-empty">هنوز برای هیچ غذایی مواد ثبت نشده.<br>از ⚙️ تنظیمات ← «غذاهای بدون مواد» شروع کنید.</div>';
  } else if (entries.length === 0) {
    chipsBox.innerHTML = '<div class="empty-msg ing-empty">ماده‌ای با این نام پیدا نشد.</div>';
  } else {
    chipsBox.innerHTML = entries.map(([k, [label]]) => {
      const on = selectedKeys.includes(k);
      // عدد = تعداد غذاهایی که با افزودن این ماده نمایش داده می‌شوند
      const n = on ? null : countWith([...selectedKeys, k]);
      const dead = !on && ingFilterMode === "all" && n === 0;
      return `<button type="button" class="ing-fchip${on ? " on" : ""}${dead ? " dead" : ""}" data-k="${escapeHtml(k)}" data-l="${escapeHtml(label)}"${dead ? " disabled" : ""}>` +
        `${escapeHtml(label)}${n !== null ? `<span class="ing-fchip-n">${n}</span>` : ""}</button>`;
    }).join("");
  }

  const total = countWith(selectedKeys);
  document.getElementById("btnApplyIngFilter").textContent = `نمایش ${total} غذا`;
}

function renderFoodList() {
  renderIngActive();
  const foods = loadFoods();
  const colors = loadGroupColors();
  const container = document.getElementById("foodList");

  if (foods.length === 0) {
    container.innerHTML = '<div class="empty-msg">📭 هنوز غذایی ثبت نشده.<br>برای ثبت غذا روی دکمه + بزنید.</div>';
    return;
  }

  const ingMap = loadDishIngredients();
  let filtered = getBaseFilteredFoods(foods);
  if (ingFilter.length) {
    const dishes = dishIngredientKeys(filtered, ingMap);
    const selectedKeys = ingFilter.map(x => x.k);
    filtered = filtered.filter(f =>
      dishPassesIngFilter(dishes.get(normalizeFa(f.name)) || new Set(), selectedKeys, ingFilterMode));
  }

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-msg">🔍 نتیجه‌ای یافت نشد.</div>';
    return;
  }

  // سهم هر رکورد روی کل داده‌ها (نه فقط نتیجه‌ی فیلتر) حساب می‌شود
  const shares = computeMealShares(foods);

  // گروه‌بندی رکوردها بر اساس نام غذا (یکسان‌شده، تا «ی/ک» عربی و فارسی یکی شوند)
  const grouped = {};
  filtered.forEach(f => {
    const key = normalizeFa(f.name);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(f);
  });

  // هر غذا زیر «آخرین تاریخ تهیه»‌اش قرار می‌گیرد
  const byDate = {};
  Object.keys(grouped).forEach(key => {
    const records = grouped[key].sort((a, b) => b.date.localeCompare(a.date));
    const name = records[0].name;
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
      const count = records.reduce((sum, r) => sum + shares.get(r), 0);
      const groupColor = colors[records[0].group] || "#7dccae";
      // نشان فقط وقتی شمارش دقیقاً ۱ نیست (چند بار صرف، یا سهم کسری از یک وعده‌ی مشترک)
      const repeatBadge = Math.abs(count - 1) > 1e-9 ? `<span class="food-count">${formatCount(count)} بار</span>` : "";

      html += `<div class="food-item">
        <div class="food-header" onclick="toggleDetails(this)">
          <div class="food-icon" style="background:${groupColor}20; color:${groupColor};">🍽️</div>
          <span class="food-name">${escapeHtml(name)}</span>
          ${repeatBadge}
          <span class="food-arrow">▼</span>
        </div>
        <div class="food-details">`;

      // v1.10: مواد اصلی یک‌بار برای کل غذا، بالای رکوردها
      const ings = getDishIngredients(name, ingMap);
      html += ings.length
        ? `<div class="food-ing-row"><span class="detail-label">🥕 مواد اصلی:</span><span class="detail-value">${ings.map(escapeHtml).join("، ")}</span>
            <button type="button" class="btn-ing-edit btn-ing-small" data-dish="${escapeHtml(name)}">✏️</button></div>`
        : `<div class="food-ing-row"><button type="button" class="btn-ing-edit btn-ing-link" data-dish="${escapeHtml(name)}">➕ افزودن مواد اصلی</button></div>`;

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

// ==================== غذاهای بدون مواد و ویرایش مواد یک غذا (v1.10) ====================
function renderNoIngredientList() {
  const container = document.getElementById("noIngList");
  const countEl = document.getElementById("noIngCount");
  const map = loadDishIngredients();
  const names = sortAlpha(uniqueByNormalized(loadFoods().map(f => f.name)));
  const missing = names.filter(n => getDishIngredients(n, map).length === 0);
  countEl.textContent = missing.length ? `(${missing.length})` : "";

  if (names.length === 0) {
    container.innerHTML = '<div class="no-ing-msg">هنوز غذایی ثبت نشده.</div>';
    return;
  }
  if (missing.length === 0) {
    container.innerHTML = '<div class="no-ing-msg">✅ برای همه‌ی غذاها مواد اصلی ثبت شده است.</div>';
    return;
  }
  container.innerHTML = missing.map(n =>
    `<div class="group-item">
      <span class="g-name">🍽️ ${escapeHtml(n)}</span>
      <button type="button" class="btn-ing-edit btn-ing-add-sm" data-dish="${escapeHtml(n)}">➕ مواد</button>
    </div>`
  ).join("");
}

function openDishIngEditor(name) {
  dishIngEditingName = name;
  document.getElementById("dishIngTitle").textContent = `🥕 مواد اصلی «${name}»`;
  dishIngEditor.set(getDishIngredients(name));
  document.getElementById("dishIngModal").classList.add("show");
}

function closeDishIngEditor() {
  document.getElementById("dishIngModal").classList.remove("show");
  dishIngEditingName = null;
}

function saveDishIngEditor() {
  if (!dishIngEditingName) return;
  const list = dishIngEditor.get();
  setDishIngredients(dishIngEditingName, list);
  closeDishIngEditor();
  renderNoIngredientList();
  renderFoodList();
  showToast("✅ مواد ذخیره شد!", "success");
}

// ==================== تازه‌های نسخه (v1.10) ====================
// با هر بالا رفتن نسخه، یک ورودی به ابتدای این آرایه اضافه کن (همان شماره‌ی APP_VERSION).
// بعد از آپدیت، ورودی‌های جدیدتر از food_seen_version یک‌بار در پنجره نمایش داده می‌شوند.
// نسخه‌ای که ورودی ندارد پنجره‌ای باز نمی‌کند. food_seen_version مخصوص دستگاه است و در پشتیبان نمی‌آید.
const WHATS_NEW = [
  { v: "1.10", items: [
    "🥕 مواد اصلی هر غذا: در فرم ثبت، فیلد جدید «مواد اصلی» اضافه شد (مثلاً قیمه: گوشت، لپه، لیمو عمانی). مواد هر غذا فقط یک‌بار وارد می‌شود و دفعه‌های بعد که همان غذا را ثبت کنید، خودکار نمایش داده می‌شود.",
    "🔍 فیلتر مواد: دکمه‌ی «مواد» در نوار فیلتر بالای لیست؛ با انتخاب هر ماده، فقط غذاهایی نمایش داده می‌شوند که همه‌ی مواد انتخاب‌شده را دارند.",
    "🍳 حالت «فقط با همین مواد»: با روشن کردن این گزینه، غذاهایی نمایش داده می‌شوند که همه‌ی مواد اصلی‌شان جزو مواد انتخاب‌شده است؛ یعنی با همان چیزهایی که در خانه دارید می‌شود پختشان.",
    "📋 غذاهای بدون مواد: بخش جدیدی در تنظیمات که غذاهای ثبت‌شده‌ی بدون مواد را فهرست می‌کند تا سریع تکمیل شوند.",
    "نوار فیلتر جمع‌وجورتر شد و از سه ردیف به دو ردیف رسید.",
    "مواد هر غذا در جزئیات آن غذا در لیست نمایش داده می‌شود و در فایل پشتیبان هم ذخیره می‌شود.",
  ]},
];

function cmpVer(a, b) {
  const x = String(a).split(".").map(Number);
  const y = String(b).split(".").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

function markVersionSeen() {
  try { localStorage.setItem("food_seen_version", APP_VERSION); } catch (e) {}
}

function maybeShowWhatsNew() {
  let seen = null;
  try { seen = localStorage.getItem("food_seen_version"); } catch (e) {}
  // نصب تازه (بدون غذا) پنجره را نمی‌بیند؛ کاربر قدیمی‌ای که این کلید را ندارد فقط تازه‌های همین نسخه را می‌بیند
  if (!seen) {
    if (!loadFoods().length) { markVersionSeen(); return; }
    seen = "0";
  }
  if (cmpVer(seen, APP_VERSION) >= 0) {
    if (cmpVer(seen, APP_VERSION) > 0) markVersionSeen();
    return;
  }
  const entries = WHATS_NEW
    .filter(e => cmpVer(e.v, seen) > 0 && cmpVer(e.v, APP_VERSION) <= 0)
    .sort((a, b) => cmpVer(b.v, a.v));
  const shown = seen === "0" ? entries.filter(e => e.v === APP_VERSION) : entries;
  if (!shown.length) { markVersionSeen(); return; }

  document.getElementById("whatsNewTitle").textContent = shown.length === 1
    ? `✨ تازه‌های نسخه ${shown[0].v}`
    : "✨ تازه‌های نسخه‌های جدید";
  document.getElementById("whatsNewBody").innerHTML = shown.map(e =>
    (shown.length > 1 ? `<div class="wn-ver">نسخه ${escapeHtml(e.v)}</div>` : "") +
    `<ul class="wn-list">${e.items.map(t => `<li>${escapeHtml(t)}</li>`).join("")}</ul>`
  ).join("");
  document.getElementById("whatsNewModal").classList.add("show");
}

function closeWhatsNew() {
  document.getElementById("whatsNewModal").classList.remove("show");
  markVersionSeen();
}

// ==================== آپدیت ====================
async function checkUpdate() {
  const status = document.getElementById("updateStatus");
  status.style.display = "block";
  status.style.background = "#D3F8E2";
  status.style.color = "#3B2F4A";
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
    dishIngredients: loadDishIngredients(),
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
      // v1.10: فایل پشتیبان قدیمی مواد ندارد؛ در آن حالت مواد فعلی دست نمی‌خورد
      if (data.dishIngredients && typeof data.dishIngredients === "object" && !Array.isArray(data.dishIngredients)) {
        saveDishIngredients(data.dishIngredients);
      }
      ingFilter = [];

      migrateFoodIds();
      refreshGroupDropdowns();
      renderFoodList();
      renderGroupsInSettings();
      renderGroupColorPickers();
      renderNoIngredientList();
      showToast("✅ داده‌ها بازیابی شدند!", "success");
    } catch (err) {
      showToast("❌ خطا در خواندن فایل", "error");
    }
  };
  reader.readAsText(file);
}

// ==================== پاک کردن ====================
function clearAllData() {
  if (!confirm("⚠️ تمام غذاها، گروه‌ها و مواد غذاها حذف می‌شوند. این عمل قابل بازگشت نیست!")) return;
  if (!confirm("آیا واقعاً مطمئن هستید؟")) return;

  saveFoods([]);
  saveGroups([...DEFAULT_GROUPS]);
  saveGroupColors({ ...DEFAULT_GROUP_COLORS });
  saveDishIngredients({});
  ingFilter = [];

  refreshGroupDropdowns();
  renderFoodList();
  renderGroupsInSettings();
  renderGroupColorPickers();
  renderNoIngredientList();
  showToast("✅ همه داده‌ها پاک شدند!", "success");
}
