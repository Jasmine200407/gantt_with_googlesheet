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
    return new Date(NaN);
}

function formatDate(date) {
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${m}/${d}`;
}

function getOffsetDays(start, date) {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.floor((date - start) / msPerDay);
}

function getDurationDays(start, end) {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.floor((end - start) / msPerDay) + 1;
}

function todayPosition(start, end) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const totalDays = getOffsetDays(start, end) + 1;
    const passedDays = getOffsetDays(start, now);
    return Math.min(100, Math.max(0, (passedDays / totalDays) * 100));
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
// 🧙 融合卡片顯示邏輯
// ===========================
function renderMergedGroup(groupKey, groupData) {
    const group = document.createElement('div');
    group.className = 'task-group';
    group.setAttribute('data-group', groupKey);

    const header = document.createElement('div');
    header.className = 'group-header';
    header.textContent = groupKey;
    group.appendChild(header);

    const start = groupData.start;
    const end = groupData.end;
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const total = getOffsetDays(start, end) + 1;

    const timeline = document.createElement('div');
    timeline.className = 'timeline-wrapper';
    timeline.innerHTML = `
      <div class="timeline-label start">${groupData.startText}</div>
      <div class="timeline-line"></div>
      <div class="timeline-label end">${groupData.endText}</div>
    `;

    const littleMan = document.createElement('div');
    littleMan.className = 'little-man';
    littleMan.style.left = `${todayPosition(start, end)}%`;
    littleMan.style.transform = 'translateX(-50%)';
    timeline.appendChild(littleMan);
    group.appendChild(timeline);

    const sortedTasks = [...groupData.tasks].filter(t => parseDate(t['結束日期']) > now).sort((a, b) => {
        const daysA = getOffsetDays(now, parseDate(a['結束日期']));
        const daysB = getOffsetDays(now, parseDate(b['結束日期']));
        return daysA - daysB;
    });

    sortedTasks.forEach(t => {
        const taskStart = parseDate(t['開始日期']);
        const taskEnd = parseDate(t['結束日期']);
        taskStart.setHours(0, 0, 0, 0);
        taskEnd.setHours(0, 0, 0, 0);

        const offset = getOffsetDays(start, taskStart);
        const duration = getOffsetDays(taskStart, taskEnd) + 1;

        const wrapper = document.createElement('div');
        wrapper.className = 'task-bar-wrapper';
        wrapper.style.position = 'relative';

        const bar = document.createElement('div');
        bar.className = 'task-bar';
        bar.style.position = 'absolute';
        bar.style.left = `${(offset / total) * 100}%`;
        bar.style.width = `${(duration / total) * 100}%`;
        bar.style.transform = 'translateX(-50%)';

        const remainingDays = getOffsetDays(now, taskEnd);
        bar.innerHTML = `<img src='/static/clock.png' style='width:16px;height:16px;margin-right:4px;'>${remainingDays}天`;
        bar.setAttribute('data-subtask', t['任務名稱']);
        bar.title = `${t['任務名稱']}\n${t['開始日期']} - ${t['結束日期']}`;

        wrapper.appendChild(bar);
        group.appendChild(wrapper);
    });

    document.getElementById('taskGroups').appendChild(group);
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
// ✨ 拖曳融合操作設定
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
