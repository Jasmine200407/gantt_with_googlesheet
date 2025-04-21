const API_BASE = 'https://gantt-with-googlesheet.onrender.com';

// ===========================
// 🕖️ 工具函式區（日期處理）
// ===========================
function parseDate(str) {
    const parts = str.split('/');
    if (parts.length === 3) {
        const [y, m, d] = parts.map(Number);
        return new Date(y, m - 1, d);
    }
    return new Date(NaN); // 轉換失敗時明確 NaN
}

function formatDate(date) {
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${m}/${d}`;
}

function getDaysBetween(start, end) {
  return Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
}

function todayPosition(start, end) {
    const total = getDaysBetween(start, end);
    const now = new Date();
    now.setHours(0, 0, 0, 0); // ✅ 將 now 設為今日 00:00
    const passed = getDaysBetween(start, now);
    return Math.min(100, Math.max(0, (passed / total) * 100));
}


// ===========================
// 📦 書櫃卡片產生器
// ===========================
let allTasks = [];

function createShelfCard(projectName, type = 'default') {
    const card = document.createElement("div");
    card.className = "task-group";
    card.draggable = true;
    card.dataset.project = projectName;
    card.dataset.type = type;

    const header = document.createElement("div");
    header.className = "group-header";
    header.textContent = projectName;
    card.appendChild(header);

    card.addEventListener("dragstart", e => {
        e.dataTransfer.setData("text/plain", JSON.stringify({ project: projectName, type }));
    });

    return card;
}

// ===========================
// 🎨 預設顏色集（隨機挑選專案色）
// ===========================
const predefinedColors = [
    '#A0B9E1', '#ADD6F8', '#C7E6EB', '#FFF2DD',
    '#F4ABC4', '#5C5A82', '#20203C', '#DBF4F3',
    '#FFE6E6', '#A7F6C1', '#B5D0FF', '#AECBFA',
    '#80BCBD', '#C2F0C2', '#FFECB3', '#DCD6F7',
    '#A6B1E1', '#424874', '#F4EEFF', '#F1F6F9'
];

function getProjectColor(name) {
    const hash = Array.from(name).reduce((sum, c) => sum + c.charCodeAt(0), 0);
    return predefinedColors[hash % predefinedColors.length];
}

// ===========================
// 🧙 融合卡片顯示邏輯（依樣畫葫蘁）
// ===========================
function renderMergedGroup(groupKey, groupData) {
    const group = document.createElement('div');
    group.className = 'task-group';
    group.setAttribute('data-group', groupKey);
    group.style.cursor = 'move';
    group.style.marginTop = '2rem';

    const header = document.createElement('div');
    header.className = 'group-header';
    header.textContent = groupKey;
    group.appendChild(header);

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '刪除卡片';
    deleteBtn.className = 'delete-fusion-btn';  // ➤ 指定 class 名稱
    deleteBtn.title = '刪除此融合卡片';
    deleteBtn.addEventListener('click', () => {
        group.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        group.style.opacity = '0';
        group.style.transform = 'scale(0.9)';
        setTimeout(() => group.remove(), 400);
    });
    group.appendChild(deleteBtn);

    const allTasks = groupData.tasks;
    const startDates = allTasks.map(t => parseDate(t['開始日期'])).filter(d => !isNaN(d));
    const projectEndDates = allTasks.map(t => parseDate(t['專案截止日期'])).filter(d => !isNaN(d));

    const invalid = allTasks.filter(t =>
        isNaN(parseDate(t['開始日期'])) || isNaN(parseDate(t['專案截止日期']))
    );
    if (invalid.length > 0) {
        console.warn("❌ 以下任務的日期欄位格式錯誤：", invalid);
        alert("有任務日期格式錯誤，請打開 Console 查看詳情！");
        return;
    }

    if (startDates.length === 0 || projectEndDates.length === 0) {
        alert("融合卡片失敗：日期欄位錯誤或遺失");
        return;
    }
    console.log("🧱 任務：", t['專案名稱'], t['任務名稱'], "開始：", t['開始日期'], "解析後：", parseDate(t['開始日期']), "→ offset 天數：", getDaysBetween(start, parseDate(t['開始日期'])));

    const start = new Date(Math.min(...startDates));
    const end = new Date(Math.max(...projectEndDates));
    const now = new Date();

    const timeline = document.createElement('div');
    timeline.className = 'timeline-wrapper';
    timeline.innerHTML = `
      <div class="timeline-label start">${formatDate(start)}</div>
      <div class="little-man" style="left: ${todayPosition(start, end)}%"></div>
      <div class="timeline-line"></div>
      <div class="timeline-label end">${formatDate(end)}</div>
    `;
    group.appendChild(timeline);

    const colorMap = {};
    const legend = document.createElement("div");
    legend.className = "legend-area";

    const sortedTasks = [...allTasks].filter(t => parseDate(t['結束日期']) > now).sort((a, b) => {
        const daysA = getDaysBetween(now, parseDate(a['結束日期']));
        const daysB = getDaysBetween(now, parseDate(b['結束日期']));
        return daysA - daysB;
    });

    sortedTasks.forEach(t => {
        const bar = document.createElement('div');
        bar.className = 'task-bar';

        const taskStart = parseDate(t['開始日期']);
        const taskEnd = parseDate(t['結束日期']);
        const offset = getDaysBetween(start, taskStart);
        const duration = getDaysBetween(taskStart, taskEnd);
        const total = getDaysBetween(start, end);
        bar.style.marginLeft = `${(offset / total) * 100}%`;
        bar.style.width = `${(duration / total) * 100}%`;

        const remainingDays = getDaysBetween(now, taskEnd);
        const projectName = t['專案名稱'];
        bar.innerHTML = `<img src='/static/clock.png' style='width:16px;height:16px;margin-right:4px;'>${remainingDays}天`;
        bar.setAttribute('data-subtask', `${projectName} - ${t['任務名稱']}`);
        bar.title = `開始：${t['開始日期']}\n結束：${t['結束日期']}`;

        const color = getProjectColor(projectName);
        bar.style.background = color;
        bar.style.boxShadow = `0 0 6px ${color}`;

        if (!colorMap[projectName]) {
            colorMap[projectName] = color;
            const legendItem = document.createElement("div");
            legendItem.className = "legend-item";
            legendItem.innerHTML = `<span class="legend-color" style="background:${color}"></span>${projectName}`;
            legend.appendChild(legendItem);
        }

        group.appendChild(bar);
    });

    group.appendChild(legend);
    document.getElementById('fusionResult').appendChild(group);
}

// ===========================
// 🗕️ 抓取資料並顯示書櫃卡片
// ===========================
function fetchTasksAndInit() {
    fetch(`${API_BASE}/tasks`)
        .then(res => res.json())
        .then(data => {
            allTasks = data;
            const shelf = document.getElementById("cardShelf");
            const categories = [...new Set(data.map(t => t['專案名稱']))];
            categories.forEach(cat => shelf.appendChild(createShelfCard(cat)));
        });
}

// ===========================
// 🌟 拖曳融合操作設定
// ===========================
function setupDragAndFusion() {
    const dropZone = document.getElementById("fusionDropZone");
    dropZone.addEventListener("dragover", e => e.preventDefault());
    dropZone.addEventListener("drop", e => {
        e.preventDefault();
        const { project, type } = JSON.parse(e.dataTransfer.getData("text/plain"));
        if (![...dropZone.children].some(c => c.dataset.project === project)) {
            dropZone.appendChild(createShelfCard(project, type));
        }
    });
    document.getElementById("selectAllFusion").addEventListener("click", () => {
        const dropZone = document.getElementById("fusionDropZone");
        const shelfCards = document.querySelectorAll("#cardShelf .task-group");

        shelfCards.forEach(card => {
            const project = card.dataset.project;
            const type = card.dataset.type || 'default';

            const alreadyExists = [...dropZone.children].some(c => c.dataset.project === project);
            if (!alreadyExists) {
                dropZone.appendChild(createShelfCard(project, type));
            }
        });
    });


    document.getElementById("createFusion").addEventListener("click", () => {
        const fusionName = document.getElementById("fusionName").value.trim();
        if (!fusionName) return alert("請輸入融合卡片名稱");
        const selectedProjects = [...dropZone.children].map(c => c.dataset.project);
        const filtered = allTasks.filter(t => selectedProjects.includes(t['專案名稱']));
        if (filtered.length === 0) return alert("請先拖入任務卡片");

        renderMergedGroup(fusionName, {
            tasks: filtered
        });

        dropZone.innerHTML = "";
        document.getElementById("fusionName").value = "";
    });

    document.getElementById("clearFusion").addEventListener("click", () => {
        document.getElementById("fusionDropZone").innerHTML = "";
    });
}

// ===========================
// ↕️ 融合結果區啟用排序
// ===========================
function enableFusionSort() {
    const fusionResult = document.getElementById("fusionResult");
    if (!fusionResult) return;
    new Sortable(fusionResult, {
        animation: 200,
        ghostClass: 'sortable-ghost'
    });
}

// ===========================
// 🚀 初始化
// ===========================
document.addEventListener("DOMContentLoaded", () => {
    fetchTasksAndInit();
    setupDragAndFusion();
    enableFusionSort();
});
