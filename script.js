// ==================== تنظیمات اولیه ====================
const APP_VERSION = "1.1";
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

// ==================== راه‌اندازی ====================
document.addEventListener("DOMContentLoaded", () => {
  if (!localStorage.getItem("groups")) saveGroups([...DEFAULT_GROUPS]);
  if (!localStorage.getItem("groupColors")) saveGroupColors({ ...DEFAULT_GROUP_COLORS });

  setTimeout(() => {
    document.getElementById("splash").style.display = "none";
    document.getElementById("appContainer").style.display = "block";
  }, 2800);

  document.getElementById("btnOpenAdd").addEventListener("click", openAddModal);
  document.getElementById("btnCloseAdd").addEventListener("click", closeAddModal);
  document.getElementById("btnOpenSettings").addEventListener("click", openSettingsModal);
  document.getElementById("btnCloseSettings").addEventListener("click", closeSettingsModal);
  document.getElementById("btnAddFood").addEventListener("click", addFood);
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

// ==================== مودال‌ها ====================
function openAddModal() {
  document.getElementById("addModal").classList.add("show");
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("foodDate").value = today;
}

function closeAddModal() {
  document.getElementById("addModal").classList.remove("show");
  document.getElementById("foodName").value = "";
  document.getElementById("foodMaker").value = "";
  document.getElementById("suggestions").classList.remove("show");
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
function refreshGroupDropdowns() {
  const groups = loadGroups();
  const colors = loadGroupColors();

  const sel1 = document.getElementById("foodGroup");
  sel1.innerHTML = '<option value="">— انتخاب گروه —</option>' +
    groups.map(g => `<option value="${g}">${g}</option>`).join("");

  const sel2 = document.getElementById("filterGroup");
  sel2.innerHTML = '<option value="">📂 همه گروه‌ها</option>' +
    groups.map(g => `<option value="${g}">${g}</option>`).join("");

  const foods = loadFoods();
  const makers = [...new Set(foods.map(f => f.maker).filter(m => m && m !== "نامشخص"))];
  const sel3 = document.getElementById("filterMaker");
  sel3.innerHTML = '<option value="">👨‍🍳 همه تهیه‌کننده‌ها</option>' +
    makers.map(m => `<option value="${m}">${m}</option>`).join("");
}

// ==================== ثبت غذا ====================
function addFood() {
  const name = document.getElementById("foodName").value.trim();
  const group = document.getElementById("foodGroup").value;
  const date = document.getElementById("foodDate").value;
  const maker = document.getElementById("foodMaker").value.trim();

  if (!name) { showToast("⚠️ نام غذا را وارد کنید", "error"); return; }
  if (!group) { showToast("⚠️ گروه غذا را انتخاب کنید", "error"); return; }
  if (!date) { showToast("⚠️ تاریخ را انتخاب کنید", "error"); return; }

  const foods = loadFoods();
  foods.push({
    name, group,
    date: date,
    maker: maker || "نامشخص",
    timestamp: Date.now(),
  });
  saveFoods(foods);

  closeAddModal();
  refreshGroupDropdowns();
  renderFoodList();
  showToast("✅ غذا ثبت شد!", "success");
}

// ==================== پیشنهادات هوشمند ====================
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
    `<div class="suggestion-item" onclick="selectSuggestion('${n.replace(/'/g, "\\'")}')">🍽️ ${n}</div>`
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

  const grouped = {};
  filtered.forEach(f => {
    if (!grouped[f.name]) grouped[f.name] = [];
    grouped[f.name].push(f);
  });

  const sortedNames = Object.keys(grouped).sort((a, b) => {
    const aDates = grouped[a].map(f => f.date).sort().reverse();
    const bDates = grouped[b].map(f => f.date).sort().reverse();
    return bDates[0].localeCompare(aDates[0]);
  });

  let html = "";
  sortedNames.forEach(name => {
    const records = grouped[name].sort((a, b) => b.date.localeCompare(a.date));
    const count = records.length;
    const groupColor = colors[records[0].group] || "#7dccae";

    html += `<div class="food-item">
      <div class="food-header" onclick="toggleDetails(this)">
        <div class="food-icon" style="background:${groupColor}20; color:${groupColor};">🍽️</div>
        <span class="food-name">${name}</span>
        <span class="food-count">${count} بار</span>
        <span class="food-arrow">▼</span>
      </div>
      <div class="food-details">`;

    records.forEach(r => {
      html += `<div class="food-detail-entry">
        <div class="detail-row"><span class="detail-label">📅 تاریخ:</span><span class="detail-value">${formatDate(r.date)}</span></div>
        <div class="detail-row"><span class="detail-label">📂 گروه:</span><span class="detail-value">${r.group}</span></div>
        <div class="detail-row"><span class="detail-label">👨‍🍳 تهیه:</span><span class="detail-value">${r.maker}</span></div>
      </div>`;
    });

    html += `</div></div>`;
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
      <span class="g-name">📂 ${g}</span>
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
      <span class="color-label">📂 ${g}</span>
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
function checkUpdate() {
  const status = document.getElementById("updateStatus");
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
