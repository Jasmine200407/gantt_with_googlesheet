const API_BASE = 'https://gantt-with-googlesheet.onrender.com';
function toggleIntroModal() {
  const modal = document.getElementById('introModal');
  modal.classList.toggle('hidden');
}
// ============================
// 🔧 工具區：日期處理 functions
// ============================
function parseDate(str) {
  const parts = str.split('/');
  if (parts.length === 3) {
    const [y, m, d] = parts.map(Number);
    return new Date(y, m - 1, d);
  } else if (parts.length === 2) {
    const [m, d] = parts.map(Number);
    return new Date(2025, m - 1, d); // 預設年份
  }
  return new Date();
}

function formatDate(date) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${m}/${d}`;
}

function getDaysBetween(start, end) {
  return Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
}

function todayPosition(start, end) {
  const total = getDaysBetween(start, end);
  const now = new Date();
  const passed = getDaysBetween(start, now);
  return Math.min(100, Math.max(0, (passed / total) * 100));
}

// ============================
// 📅 flatpickr 初始化
// ============================
flatpickr(".date-picker", {
  dateFormat: "Y/m/d"
});

// 📊 甘特圖任務群組渲染區塊

// ✅ 渲染單一任務群組與時間軸進度條
function renderTaskGroup(groupKey, groupData) {
  const group = document.createElement('div');
  group.className = 'task-group';
  group.setAttribute('data-group', groupKey);

  const header = document.createElement('div');
  header.className = 'group-header';
  header.textContent = groupKey;
  group.appendChild(header);

  const start = groupData.start;
  const end = groupData.end;
  const now = new Date();

  const timeline = document.createElement('div');
  timeline.className = 'timeline-wrapper';
  timeline.innerHTML = `
    <div class="timeline-label start">${groupData.startText}</div>
    <div class="little-man" style="left: ${todayPosition(start, end)}%"></div>
    <div class="timeline-line"></div>
    <div class="timeline-label end">${groupData.endText}</div>
  `;
  group.appendChild(timeline);

  const sortedTasks = [...groupData.tasks].sort((a, b) => {
    const daysA = getDaysBetween(now, parseDate(a['結束日期']));
    const daysB = getDaysBetween(now, parseDate(b['結束日期']));
    return daysA - daysB;
  });

  sortedTasks.forEach(t => {
    if (parseDate(t['結束日期']) <= now) return;

    const bar = document.createElement('div');
    bar.className = 'task-bar';
    const offset = getDaysBetween(start, parseDate(t['開始日期']));
    const duration = getDaysBetween(parseDate(t['開始日期']), parseDate(t['結束日期']));
    const total = getDaysBetween(start, end);
    bar.style.marginLeft = `${(offset / total) * 100}%`;
    bar.style.width = `${(duration / total) * 100}%`;
    const remainingDays = getDaysBetween(now, parseDate(t['結束日期']));
    bar.textContent = `🕒${remainingDays}天`;
    bar.setAttribute('data-subtask', t['任務名稱']);
    group.appendChild(bar);
  });

  document.getElementById('taskGroups').appendChild(group);
}

// ✅ 渲染任務表格，含打勾完成與編輯按鈕
function renderTable(tasks) {
  const now = new Date();
  const tbody = document.getElementById('taskTable');
  tbody.innerHTML = '';

  tasks.forEach(t => {
    const endDate = parseDate(t['結束日期']);
    if (endDate < now) return;

    const memo = t['備註'] || '';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const memoHtml = memo.replace(urlRegex, url => {
      return `<a href="${url}" target="_blank" style="color: #00f8f1; text-decoration: underline;">${url}</a>`;
    });

    const tr = document.createElement('tr');
    tr.innerHTML = `
  <td>${t['專案名稱']}</td>
  <td>${t['任務名稱']}
    <button class="edit-btn" title="編輯任務">
      <img src="/static/pencil.png" alt="edit" class="edit-icon" />
    </button>
  </td>
  <td>${t['開始日期']}</td>
  <td>${t['結束日期']}</td>
  <td>${getDaysBetween(now, endDate)} 天</td>
  <td class="memo-cell" title="${memo}">${memoHtml}</td>
  <td><input type="checkbox" data-subtask="${t['任務名稱']}"></td>
`;

    tr.querySelector(".edit-btn").addEventListener("click", () => {
      currentEditData = t;
      document.getElementById("editName").value = t["任務名稱"];
      document.getElementById("editStart").value = t["開始日期"];
      document.getElementById("editEnd").value = t["結束日期"];
      document.getElementById("editMemo").value = t["備註"] || "";
      editTaskModal.style.display = "block";
    });

    tr.querySelector('input[type="checkbox"]').addEventListener('change', e => {
      const checked = e.target.checked;
      const taskBars = document.querySelectorAll(`[data-subtask="${t['任務名稱']}"]`);
      taskBars.forEach(bar => {
        bar.style.display = checked ? 'none' : '';
        bar.classList.toggle('completed', checked);
      });

      if (checked) {
        fetch(`${API_BASE}/tasks`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            '任務名稱': t['任務名稱'],
            '開始日期': t['開始日期'],
            '結束日期': t['結束日期']
          })
        })
          .then(res => res.json())
          .then(data => {
            if (data.status === 'deleted') fetchAndRenderTasks();
          });
      } else {
        tr.style.display = '';
      }
    });

    tbody.appendChild(tr);
  });
}
// ============================
// 🔍 選擇篩選區邏輯
// ============================
function filterTasks() {
  const filterInstance = document.querySelector('#filterCategory')?.tomselect;
  const cat = filterInstance ? filterInstance.getValue() : 'all';

  const dateLimit = document.getElementById('taskFilterByDate').value.trim();
  const memoKeyword = document.getElementById('filterMemo').value.trim();
  const dateLimitParsed = dateLimit ? parseDate(dateLimit) : null;

  const rows = document.querySelectorAll('#taskTable tr');
  rows.forEach(r => {
    const project = r.cells[0].textContent;
    const endDate = parseDate(r.cells[3].textContent);
    const memoText = r.cells[5].textContent || '';

    const matchCat = cat === 'all' || project === cat;
    const matchDate = !dateLimitParsed || endDate <= dateLimitParsed;
    const matchMemo = memoKeyword === '' || memoText.includes(memoKeyword);

    r.style.display = matchCat && matchDate && matchMemo ? '' : 'none';
  });
}
let taskCategorySelect;
let filterCategorySelect;
let categoryEndDates = {};

function populateFilters(data) {
  const categories = [...new Set(data.map(d => d['專案名稱']))];
  const filter = document.getElementById('filterCategory');
  filter.innerHTML = '<option value="all">全部</option>';
  categories.forEach(cat => {
    filter.innerHTML += `<option value="${cat}">${cat}</option>`;
  });

  // ✅ 更新截止日對應表
  categoryEndDates = {};
  data.forEach(d => {
    categoryEndDates[d['專案名稱']] = d['專案截止日期'];
  });

  // ✅ 初始化「新增任務」類別欄位（允許輸入 + 自訂）
  if (!taskCategorySelect) {
    taskCategorySelect = new TomSelect("#taskCategory", {
      create: true,
      maxItems: 1,
      hideSelected: true,
      dropdownInput: true,
      persist: false,
      selectOnTab: false,
      render: {
        option_create: function (data, escape) {
          return `<div class="create">➕ 新增類別：<strong>${escape(data.input)}</strong></div>`;
        }
      },
      onType: function () {
        this.setActiveOption(null); // 不自動選第一個
      },
      sortField: {
        field: "text",
        direction: "asc"
      },
      onChange: function (value) {
        const endInput = document.getElementById('taskEndDate');
        if (categoryEndDates[value]) {
          const [m, d] = categoryEndDates[value].split('/');
          const date = new Date(2025, parseInt(m) - 1, parseInt(d));
          const formatted = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
          endInput.value = formatted;
          endInput.setAttribute('readonly', true);
          endInput.setAttribute('disabled', true);
        } else {
          endInput.value = '';
          endInput.removeAttribute('readonly');
          endInput.removeAttribute('disabled');
        }
      }
    });
  }

  // ✅ 初始化「篩選器」類別欄位（禁止輸入）
  if (!filterCategorySelect) {
    filterCategorySelect = new TomSelect("#filterCategory", {
      create: false,
      dropdownInput: false, // ⛔ 禁止輸入
      allowEmptyOption: true,
      sortField: [
        {
          field: "value",
          direction: "asc",
          sorter: (a, b) => {
            if (a.value === 'all') return -1;
            if (b.value === 'all') return 1;
            return a.text.localeCompare(b.text, 'zh-Hant');
          }
        }
      ]
    });

    // ✅ 綁定一次就好
    filterCategorySelect.on('change', filterTasks);
    document.getElementById('taskFilterByDate').addEventListener('input', filterTasks);
    document.getElementById('filterMemo').addEventListener('input', filterTasks);
  }

  // ✅ 更新「新增」選項
  taskCategorySelect.clearOptions();
  categories.forEach(cat => {
    taskCategorySelect.addOption({ value: cat, text: cat });
  });
  taskCategorySelect.refreshOptions(false);

  // ✅ 更新「篩選」選項
  filterCategorySelect.clearOptions();
  filterCategorySelect.addOption({ value: 'all', text: '全部' });
  categories.forEach(cat => {
    filterCategorySelect.addOption({ value: cat, text: cat });
  });
  filterCategorySelect.refreshOptions(false);
}

// ============================
// ➕ 新增任務區（handleForm）
// ============================

// ✅ 綁定新增任務表單提交事件，寫入後端 Google Sheet
function handleForm() {
  const form = document.getElementById('taskForm');
  form.addEventListener('submit', e => {
    e.preventDefault(); // 阻止表單預設送出行為

    const taskCategory = document.getElementById('taskCategory').value.trim();
    const taskEndDate = document.getElementById('taskEndDate').value.trim();
    const taskName = document.getElementById('taskName').value.trim();
    const startDate = document.getElementById('taskStartDate').value.trim();
    const finishDate = document.getElementById('taskFinishDate').value.trim();
    const memo = document.getElementById('taskMemo').value.trim();

    if (!taskCategory || !taskEndDate || !taskName || !startDate || !finishDate) {
      alert("⚠️ 請完整填寫所有欄位！");
      return;
    }

    const newTask = {
      '專案名稱': taskCategory,
      '專案截止日期': formatDate(new Date(taskEndDate)),
      '任務名稱': taskName,
      '開始日期': formatDate(new Date(startDate)),
      '結束日期': formatDate(new Date(finishDate)),
      '備註': memo
    };

    // ✅ 取得按鈕並暫時停用，避免連點
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "新增中...";

    fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTask)
    }).then(res => res.json())
      .then(() => {
        form.reset();
        fetchAndRenderTasks();
      })
      .finally(() => {
        // ✅ 2 秒後恢復按鈕狀態
        setTimeout(() => {
          submitBtn.disabled = false;
          submitBtn.textContent = "點擊新增";
        }, 2000);
      });
  });
}

// ============================
// ✏️ 編輯任務功能區（Modal 彈窗）
// ============================

// ✅ 初始化任務編輯 Modal 彈窗 DOM 結構
let editTaskModal = document.createElement('div');
editTaskModal.id = "editTaskModal";
editTaskModal.style.position = "fixed";
editTaskModal.style.top = "50%";
editTaskModal.style.left = "50%";
editTaskModal.style.transform = "translate(-50%, -50%)";
editTaskModal.style.background = "#111";
editTaskModal.style.border = "1px solid #00f8f1";
editTaskModal.style.padding = "20px";
editTaskModal.style.display = "none";
editTaskModal.style.zIndex = "10000";
editTaskModal.innerHTML = `
  <h3 style="color:#00f8f1;">編輯任務</h3>
  <input id="editName" placeholder="任務名稱" /><br/><br/>
  <input id="editStart" placeholder="開始日期 mm/dd" /><br/><br/>
  <input id="editEnd" placeholder="結束日期 mm/dd" /><br/><br/>
  <input id="editMemo" placeholder="備註" /><br/><br/>
    <div style="margin-top: 1rem;">
    <button class="modal-btn" onclick="saveEdit()">儲存</button>
    <button class="modal-btn" onclick="editTaskModal.style.display='none'">取消</button>
  </div>
`;
document.body.appendChild(editTaskModal);

let currentEditData = null; // ✅ 儲存被編輯的任務資料

// ✅ 發送 PUT 請求更新任務資料
function saveEdit() {
  const updatedTask = {
    originalName: currentEditData['任務名稱'],
    originalStart: currentEditData['開始日期'],
    originalEnd: currentEditData['結束日期'],
    '專案名稱': currentEditData['專案名稱'],
    '專案截止日期': currentEditData['專案截止日期'],
    '任務名稱': document.getElementById('editName').value,
    '開始日期': document.getElementById('editStart').value,
    '結束日期': document.getElementById('editEnd').value,
    '備註': document.getElementById('editMemo').value
  };

  fetch(`${API_BASE}/tasks`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatedTask)
  })
    .then(res => res.json())
    .then(data => {
      if (data.status === 'updated') {
        editTaskModal.style.display = 'none';
        fetchAndRenderTasks();
      } else {
        alert('更新失敗');
      }
    });
}
// ============================
// 🧠 備註推薦系統模組化（可套用多欄位）
// ============================
// setupMemoSuggestion(input, getSuggestions, onSelect)
// 支援鍵盤選擇、模糊比對、自動填入等
let allMemos = [];

// ✅ 根據任務陣列整理出所有不重複備註字串
function updateMemoSuggestions(tasks) {
  const raw = tasks.map(t => t['備註']).filter(Boolean);
  const unique = [...new Set(raw)];
  allMemos = unique;
}

// ✅ 套用推薦功能到任意 input 欄位
function setupMemoSuggestion(inputElement, getSuggestionArray, onSelect) {
  let dropdown = document.createElement("ul");
  dropdown.className = "dropdown-list";
  dropdown.style.display = "none";
  inputElement.parentNode.style.position = "relative";
  inputElement.parentNode.appendChild(dropdown);

  let currentIndex = -1;

  inputElement.addEventListener("input", () => {
    const val = inputElement.value.trim();
    const list = getSuggestionArray();
    dropdown.innerHTML = "";
    currentIndex = -1;

    if (!val || !list.length) {
      dropdown.style.display = "none";
      return;
    }

    const matched = list.filter(m =>
      m.toLowerCase().replace(/\s/g, '').includes(val.toLowerCase().replace(/\s/g, ''))
    );

    if (!matched.length) {
      dropdown.innerHTML = `<li class="no-match">無相關建議</li>`;
      dropdown.style.display = "block";
      return;
    }

    matched.forEach((m, i) => {
      const li = document.createElement("li");
      li.textContent = m;
      li.setAttribute("data-index", i);
      li.onclick = () => {
        inputElement.value = m;
        dropdown.style.display = "none";
        if (onSelect) onSelect(m);
      };
      dropdown.appendChild(li);
    });

    dropdown.style.display = "block";
  });

  inputElement.addEventListener("keydown", (e) => {
    const items = dropdown.querySelectorAll("li:not(.no-match)");
    if (!items.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      currentIndex = (currentIndex + 1) % items.length;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      currentIndex = (currentIndex - 1 + items.length) % items.length;
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (currentIndex >= 0 && currentIndex < items.length) {
        inputElement.value = items[currentIndex].textContent;
        dropdown.style.display = "none";
        if (onSelect) onSelect(inputElement.value);
      }
    }

    items.forEach((li, i) => {
      li.style.backgroundColor = i === currentIndex ? "#00f8f1" : "";
      li.style.color = i === currentIndex ? "#000" : "";
    });
  });

  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target) && e.target !== inputElement) {
      dropdown.style.display = "none";
    }
  });
}
// ============================
// 🚀 初始畫面邏輯（fetch + 初始化）
// ============================

// ✅ 從後端取得資料後依群組渲染甘特圖、表格、篩選器與備註建議
function fetchAndRenderTasks() {
  fetch(`${API_BASE}/tasks`)
    .then(res => res.json())
    .then(data => {
      if (Array.isArray(data)) {
        // 如果返回的是數組，繼續執行以下邏輯
        const grouped = {};
        data.forEach(t => {
          const key = t['專案名稱'];
          if (!grouped[key]) {
            grouped[key] = {
              endText: t['專案截止日期'],
              end: parseDate(t['專案截止日期']),
              start: parseDate(t['開始日期']),
              startText: t['開始日期'],
              tasks: []
            };
          }
          const taskStart = parseDate(t['開始日期']);
          if (taskStart < grouped[key].start) {
            grouped[key].start = taskStart;
            grouped[key].startText = t['開始日期'];
          }
          grouped[key].tasks.push(t);
        });

        // 渲染任務群組、表格和篩選器
        document.getElementById('taskGroups').innerHTML = '';
        Object.entries(grouped).forEach(([key, value]) => renderTaskGroup(key, value));
        renderTable(data);
        populateFilters(data);
        updateMemoSuggestions(data);
      } else {
        console.error('API 返回的數據不是一個有效的數組', data);
        // 可以在這裡顯示一個錯誤訊息給用戶
      }
    })
    .catch(error => {
      console.error('API 請求錯誤:', error);
      // 可以在這裡顯示一個錯誤訊息給用戶
    });
}


// ✅ 畫面載入後初始化所有功能
window.addEventListener('DOMContentLoaded', () => {
  fetchAndRenderTasks();
  handleForm();
  document.getElementById('filterCategory').addEventListener('change', filterTasks);
  document.getElementById('taskFilterByDate').addEventListener('input', filterTasks);
  document.getElementById('filterMemo').addEventListener('input', filterTasks);
  setupMemoSuggestion(document.getElementById('taskMemo'), () => allMemos);
  setupMemoSuggestion(document.getElementById('filterMemo'), () => allMemos, filterTasks);

  new Sortable(document.getElementById('taskGroups'), { animation: 150 });
  new Sortable(document.querySelector('.right-panel'), { animation: 150, handle: '.card-header' });
});
