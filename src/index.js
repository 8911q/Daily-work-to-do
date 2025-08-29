// This script is a self-contained Cloudflare Worker that serves a weekly planner HTML page.
// It uses KV for data storage and is designed to be deployed via the Cloudflare dashboard.

// The main viewer HTML page, with all management functionality removed.
const viewerHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>每日工作计划备忘录</title>
    <meta name="description" content="零依赖的每日工作计划管理工具，支持拖拽排序、Excel导入导出、离线使用">
    
    <link rel="manifest" href="./manifest.json">
    <meta name="theme-color" content="#0078f5">
    
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        :root {
            --primary-color: #0078f5;
            --secondary-color: #f8f9fa;
            --border-color: #e1e5e9;
            --text-color: #333;
            --text-light: #666;
            --success-color: #28a745;
            --warning-color: #ffc107;
            --danger-color: #dc3545;
            --priority-high: #dc3545;
            --priority-medium: #ffc107;
            --priority-low: #28a745;
            --shadow: 0 2px 4px rgba(0,0,0,0.1);
            --border-radius: 8px;
        }

        [data-theme="dark"] {
            --primary-color: #4a9eff;
            --secondary-color: #1a1a1a;
            --border-color: #444;
            --text-color: #e1e5e9;
            --text-light: #aaa;
            --secondary-color-light: #2d2d2d;
            --shadow: 0 2px 4px rgba(255,255,255,0.1);
            --success-color: #4caf50;
            --warning-color: #ff9800;
            --danger-color: #f44336;
            --priority-high: #f44336;
            --priority-medium: #ff9800;
            --priority-low: #4caf50;
        }

        [data-theme="dark"] .header {
            background: var(--secondary-color-light);
            color: var(--text-color);
        }

        [data-theme="dark"] .task-cell {
            background: #2a2a2a;
        }

        [data-theme="dark"] .task-cell:hover {
            background: linear-gradient(135deg, rgba(74, 158, 255, 0.15), rgba(74, 158, 255, 0.08));
        }

        [data-theme="dark"] .task-card {
            background: linear-gradient(135deg, #333, #2a2a2a);
            color: var(--text-color);
            border-color: var(--border-color);
        }

        [data-theme="dark"] .task-card:hover {
            background: linear-gradient(135deg, #3a3a3a, #333);
        }

        [data-theme="dark"] .modal-content {
            background: var(--secondary-color-light);
            color: var(--text-color);
        }

        [data-theme="dark"] .form-control {
            background: #333;
            color: var(--text-color);
            border-color: var(--border-color);
        }

        [data-theme="dark"] .form-control:focus {
            border-color: var(--primary-color);
        }

        [data-theme="dark"] .properties-panel {
            background: var(--secondary-color-light);
            color: var(--text-color);
        }

        [data-theme="dark"] .day-header {
            background: linear-gradient(135deg, #333, #2a2a2a);
            color: var(--text-color);
        }

        [data-theme="dark"] .day-header:hover {
            background: linear-gradient(135deg, #3a3a3a, #333);
        }

        [data-theme="dark"] .time-label {
            background: linear-gradient(135deg, #333, #2a2a2a);
            color: var(--text-color);
        }

        [data-theme="dark"] .time-label:hover {
            background: linear-gradient(135deg, #3a3a3a, #333);
        }

        [data-theme="dark"] .drop-zone {
            border-color: var(--border-color);
            color: var(--text-light);
        }

        [data-theme="dark"] .drop-zone.dragover {
            border-color: var(--primary-color);
            background: rgba(74, 158, 255, 0.1);
        }

        [data-theme="green"] {
            --primary-color: #28a745;
            --secondary-color: #f0f8f0;
            --border-color: #c3e6c3;
            --text-color: #2d5a2d;
            --text-light: #5a7a5a;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: var(--secondary-color);
            color: var(--text-color);
            line-height: 1.6;
            overflow-x: hidden;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
            display: grid;
            grid-template-columns: 1fr;
            gap: 20px;
            height: 100vh;
        }

        .header {
            grid-column: 1 / -1;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 20px;
            background: white;
            border-radius: var(--border-radius);
            box-shadow: var(--shadow);
            margin-bottom: 20px;
        }

        .header-info {
            display: flex;
            align-items: center;
            gap: 20px;
        }

        .date-display {
            font-size: 1.2em;
            font-weight: bold;
            color: var(--primary-color);
        }

        .week-info {
            color: var(--text-light);
        }

        .controls {
            display: flex;
            gap: 10px;
            align-items: center;
        }

        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: var(--border-radius);
            cursor: pointer;
            font-size: 14px;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .btn-primary {
            background: var(--primary-color);
            color: white;
        }

        .btn-secondary {
            background: var(--secondary-color);
            color: var(--text-color);
            border: 1px solid var(--border-color);
        }

        .btn:hover {
            transform: translateY(-1px);
            box-shadow: var(--shadow);
        }

        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
        }

        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }

        .main-content {
            background: white;
            border-radius: var(--border-radius);
            box-shadow: var(--shadow);
            overflow: hidden;
        }

        .weekly-grid {
            display: grid;
            grid-template-columns: 120px repeat(7, 1fr);
            height: calc(100vh - 200px);
            min-height: 600px;
            border: 2px solid var(--border-color);
            border-radius: var(--border-radius);
            overflow: hidden;
            box-shadow: var(--shadow);
        }

        .time-slot-header {
            background: linear-gradient(135deg, var(--primary-color), #0056b3);
            color: white;
            padding: 15px 8px;
            text-align: center;
            font-weight: 600;
            border-bottom: 2px solid var(--border-color);
            border-right: 2px solid var(--border-color);
            font-size: 14px;
            letter-spacing: 0.5px;
            text-shadow: 0 1px 2px rgba(0,0,0,0.1);
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .day-header {
            background: linear-gradient(135deg, #f8f9fa, #e9ecef);
            padding: 15px 8px;
            text-align: center;
            font-weight: 600;
            border-bottom: 2px solid var(--border-color);
            border-right: 2px solid var(--border-color);
            font-size: 14px;
            color: var(--text-color);
            letter-spacing: 0.5px;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .day-header:hover {
            background: linear-gradient(135deg, #e9ecef, #dee2e6);
            transform: translateY(-1px);
        }

        .day-header.today {
            background: linear-gradient(135deg, var(--primary-color), #0056b3);
            color: white;
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
            text-shadow: 0 1px 2px rgba(0,0,0,0.2);
        }

        .time-label {
            background: linear-gradient(135deg, #f1f3f4, #e8eaed);
            padding: 20px 15px;
            text-align: center;
            font-weight: 600;
            border-right: 2px solid var(--border-color);
            border-bottom: 2px solid var(--border-color);
            writing-mode: vertical-lr;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            color: var(--text-color);
            letter-spacing: 1px;
            min-height: 140px;
            transition: all 0.3s ease;
        }

        .time-label:hover {
            background: linear-gradient(135deg, #e8eaed, #dadce0);
            transform: translateX(-2px);
        }

        .task-cell {
            border-right: 2px solid var(--border-color);
            border-bottom: 2px solid var(--border-color);
            padding: 12px;
            min-height: 140px;
            position: relative;
            overflow-y: auto;
            background: #fafbfc;
            transition: all 0.3s ease;
        }

        .task-cell:hover {
            background: linear-gradient(135deg, rgba(0, 120, 245, 0.08), rgba(0, 120, 245, 0.04));
            box-shadow: inset 0 0 10px rgba(0, 120, 245, 0.1);
            transform: scale(1.02);
        }

        .task-card {
            background: linear-gradient(135deg, #ffffff, #f8f9fa);
            border: 1px solid var(--border-color);
            border-radius: 10px;
            padding: 12px;
            margin-bottom: 8px;
            transition: all 0.3s ease;
            position: relative;
            font-size: 13px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }

        .task-card:hover {
            box-shadow: 0 4px 16px rgba(0,0,0,0.15);
            transform: translateY(-2px) scale(1.02);
            background: linear-gradient(135deg, #ffffff, #f0f2f5);
        }

        .task-card.dragging {
            opacity: 0.5;
            transform: rotate(5deg);
        }

        .task-card.done {
            opacity: 0.6;
            text-decoration: line-through;
        }

        .task-card.high-priority {
            border-left: 3px solid var(--priority-high);
        }

        .task-card.medium-priority {
            border-left: 3px solid var(--priority-medium);
        }

        .task-card.low-priority {
            border-left: 3px solid var(--priority-low);
        }

        .task-checkbox {
            margin-right: 5px;
        }

        .task-title {
            font-weight: bold;
            margin-bottom: 2px;
            word-break: break-word;
        }

        .task-time {
            font-size: 11px;
            color: var(--text-light);
            margin-bottom: 2px;
        }

        .task-note {
            font-size: 11px;
            color: var(--text-light);
            word-break: break-word;
        }

        .task-actions {
            position: absolute;
            top: 2px;
            right: 2px;
            opacity: 0;
            transition: opacity 0.3s;
        }

        .task-card:hover .task-actions {
            opacity: 1;
        }

        .delete-btn {
            background: linear-gradient(135deg, var(--danger-color), #c82333);
            color: white;
            border: none;
            border-radius: 50%;
            width: 22px;
            height: 22px;
            font-size: 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 6px rgba(220, 53, 69, 0.3);
            transition: all 0.3s ease;
        }

        .delete-btn:hover {
            transform: scale(1.1);
            box-shadow: 0 4px 12px rgba(220, 53, 69, 0.4);
        }

        .add-task-btn {
            position: absolute;
            bottom: 8px;
            right: 8px;
            background: linear-gradient(135deg, var(--primary-color), #0056b3);
            color: white;
            border: none;
            border-radius: 50%;
            width: 28px;
            height: 28px;
            font-size: 16px;
            cursor: pointer;
            opacity: 0.7;
            transition: all 0.3s ease;
            box-shadow: 0 2px 8px rgba(0, 120, 245, 0.3);
        }

        .task-cell:hover .add-task-btn {
            opacity: 1;
            transform: scale(1.1);
            box-shadow: 0 4px 12px rgba(0, 120, 245, 0.4);
        }

        .properties-panel {
            background: white;
            border-radius: var(--border-radius);
            box-shadow: var(--shadow);
            padding: 20px;
            height: fit-content;
            position: sticky;
            top: 20px;
        }

        .properties-panel h3 {
            margin-bottom: 15px;
            color: var(--primary-color);
        }

        .form-group {
            margin-bottom: 15px;
        }

        .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
            font-size: 14px;
        }

        .form-control {
            width: 100%;
            padding: 8px;
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius);
            font-size: 14px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.5;
        }

        input[type="time"].form-control,
        textarea.form-control {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            font-size: 14px;
            line-height: 1.5;
            color: var(--text-color);
        }

        #taskNote {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            font-size: 14px;
            line-height: 1.5;
            resize: vertical;
        }

        .form-control:focus {
            outline: none;
            border-color: var(--primary-color);
        }

        .priority-selector {
            display: flex;
            gap: 5px;
        }

        .priority-btn {
            flex: 1;
            padding: 5px;
            border: 1px solid var(--border-color);
            background: white;
            cursor: pointer;
            font-size: 12px;
            border-radius: var(--border-radius);
        }

        .priority-btn.active {
            background: var(--primary-color);
            color: white;
        }

        .repeat-selector {
            display: flex;
            gap: 5px;
        }

        .repeat-btn {
            flex: 1;
            padding: 5px;
            border: 1px solid var(--border-color);
            background: white;
            cursor: pointer;
            font-size: 12px;
            border-radius: var(--border-radius);
        }

        .repeat-btn.active {
            background: var(--primary-color);
            color: white;
        }

        .weekday-selector {
            display: flex;
            gap: 5px;
            flex-wrap: wrap;
        }

        .weekday-btn {
            flex: 1;
            min-width: 50px;
            padding: 5px;
            border: 1px solid var(--border-color);
            background: white;
            cursor: pointer;
            font-size: 12px;
            border-radius: var(--border-radius);
        }

        .weekday-btn.active {
            background: var(--primary-color);
            color: white;
        }

        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 1000;
        }

        .modal-content {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 30px;
            border-radius: var(--border-radius);
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .close-btn {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: var(--text-light);
        }

        .theme-selector {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
        }

        .theme-btn {
            width: 30px;
            height: 30px;
            border-radius: 50%;
            border: 2px solid var(--border-color);
            cursor: pointer;
        }

        .theme-btn.active {
            border-color: var(--primary-color);
        }

        .drop-zone {
            border: 2px dashed var(--border-color);
            border-radius: var(--border-radius);
            padding: 20px;
            text-align: center;
            color: var(--text-light);
            margin-bottom: 15px;
        }

        .drop-zone.dragover {
            border-color: var(--primary-color);
            background: rgba(0, 120, 245, 0.1);
        }

        @media (max-width: 768px) {
            .container {
                grid-template-columns: 1fr;
                padding: 10px;
            }

            .weekly-grid {
                grid-template-columns: 80px repeat(7, 1fr);
                font-size: 12px;
                min-height: 500px;
            }

            .time-label {
                padding: 15px 8px;
                font-size: 14px;
                min-height: 120px;
            }

            .task-cell {
                padding: 8px;
                min-height: 120px;
            }

            .day-header, .time-slot-header {
                padding: 12px 6px;
                font-size: 12px;
            }

            .task-card {
                padding: 8px;
                font-size: 12px;
                margin-bottom: 6px;
            }

            .add-task-btn {
                width: 24px;
                height: 24px;
                font-size: 14px;
                bottom: 6px;
                right: 6px;
            }

            .header {
                flex-direction: column;
                gap: 10px;
                align-items: stretch;
            }

            .controls {
                justify-content: center;
                flex-wrap: wrap;
            }


        }

        .toast {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 4px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
        }

        .toast.show {
            opacity: 1;
            transform: translateX(0);
        }

        .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid var(--primary-color);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .hidden {
            display: none !important;
        }
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <div class="header-info">
                <div class="date-display" id="currentDate"></div>
                <div class="week-info" id="weekInfo"></div>
            </div>
            <div class="controls">
                <a class="btn btn-secondary" href="/admin.html">管理任务</a>
            </div>
        </header>

        <main class="main-content">
            <div class="weekly-grid" id="weeklyGrid">
                <div class="time-slot-header">时间</div>
                <div class="day-header" data-day="1">周一</div>
                <div class="day-header" data-day="2">周二</div>
                <div class="day-header" data-day="3">周三</div>
                <div class="day-header" data-day="4">周四</div>
                <div class="day-header" data-day="5">周五</div>
                <div class="day-header" data-day="6">周六</div>
                <div class="day-header" data-day="7">周日</div>

                <div class="time-label">上午<br>08:00-12:00</div>
                <div class="task-cell" data-day="1" data-slot="AM"></div>
                <div class="task-cell" data-day="2" data-slot="AM"></div>
                <div class="task-cell" data-day="3" data-slot="AM"></div>
                <div class="task-cell" data-day="4" data-slot="AM"></div>
                <div class="task-cell" data-day="5" data-slot="AM"></div>
                <div class="task-cell" data-day="6" data-slot="AM"></div>
                <div class="task-cell" data-day="7" data-slot="AM"></div>

                <div class="time-label">下午<br>13:00-18:00</div>
                <div class="task-cell" data-day="1" data-slot="PM"></div>
                <div class="task-cell" data-day="2" data-slot="PM"></div>
                <div class="task-cell" data-day="3" data-slot="PM"></div>
                <div class="task-cell" data-day="4" data-slot="PM"></div>
                <div class="task-cell" data-day="5" data-slot="PM"></div>
                <div class="task-cell" data-day="6" data-slot="PM"></div>
                <div class="task-cell" data-day="7" data-slot="PM"></div>

                <div class="time-label">晚上<br>19:00-23:00</div>
                <div class="task-cell" data-day="1" data-slot="EVENING"></div>
                <div class="task-cell" data-day="2" data-slot="EVENING"></div>
                <div class="task-cell" data-day="3" data-slot="EVENING"></div>
                <div class="task-cell" data-day="4" data-slot="EVENING"></div>
                <div class="task-cell" data-day="5" data-slot="EVENING"></div>
                <div class="task-cell" data-day="6" data-slot="EVENING"></div>
                <div class="task-cell" data-day="7" data-slot="EVENING"></div>
            </div>
        </main>
        </div>
    <div id="toast" class="toast"></div>

    <script>
        // ------------------------- 全局变量 -------------------------
        let tasks = []; // 任务列表

        // ------------------------- KV API -------------------------
        const API_BASE = '/api';

        async function loadTasksFromKV() {
            try {
                const response = await fetch(\`\${API_BASE}/tasks\`);
                if (response.ok) {
                    const data = await response.json();
                    tasks = data || [];
                    console.log('从KV加载任务成功，任务数量：', tasks.length);
                } else {
                    console.error('从KV加载任务失败:', response.statusText);
                    showToast('加载任务失败！', 'danger');
                }
            } catch (error) {
                console.error('从KV加载任务失败:', error);
                showToast('加载任务失败！', 'danger');
            }
        }

        // ------------------------- 任务渲染 -------------------------

        function renderTasks() {
            // 清空所有任务单元格和任务池
            document.querySelectorAll('.task-cell, #taskPool').forEach(el => el.innerHTML = '');

            tasks.forEach(task => {
                const taskCard = document.createElement('div');
                taskCard.className = \`task-card \${task.done ? 'done' : ''} \${task.priority === 1 ? 'high-priority' : task.priority === 2 ? 'medium-priority' : 'low-priority'}\`;
                taskCard.id = task.id;
                taskCard.setAttribute('data-id', task.id);
                taskCard.setAttribute('data-day', task.day);
                taskCard.setAttribute('data-slot', task.slot);

                taskCard.innerHTML = \`
                    <div class="task-title">\${task.title}</div>
                    <div class="task-time">\${task.startTime}-\${task.endTime}</div>
                    <div class="task-note">\${task.note}</div>
                \`;

                if (task.slot === 'pool') {
                    // 任务池在查看页面不显示
                } else {
                    const cell = document.querySelector(\`.task-cell[data-day="\${task.day}"][data-slot="\${task.slot}"]\`);
                    if (cell) {
                        cell.appendChild(taskCard);
                    }
                }
            });
        }

        // ------------------------- 辅助函数 -------------------------

        function showToast(message, type = 'success') {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.style.backgroundColor = type === 'success' ? '#28a745' : '#dc3545';
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }

        // ------------------------- 日期和主题 -------------------------

        function updateDateDisplay() {
            const today = new Date();
            const dateDisplay = document.getElementById('currentDate');
            const weekInfo = document.getElementById('weekInfo');
            
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            dateDisplay.textContent = today.toLocaleDateString('zh-CN', options);
            
            const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() + 1);
            const endOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() + 7);
            const startStr = startOfWeek.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
            const endStr = endOfWeek.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
            weekInfo.textContent = \`本周：\${startStr} - \${endStr}\`;
            
            // 高亮今天的星期
            document.querySelectorAll('.day-header').forEach(header => {
                const day = parseInt(header.getAttribute('data-day'));
                if (day === (today.getDay() === 0 ? 7 : today.getDay())) {
                    header.classList.add('today');
                } else {
                    header.classList.remove('today');
                }
            });
        }
        
        function setTheme(theme) {
            document.body.setAttribute('data-theme', theme);
        }
        
        async function loadSettings() {
            try {
                const response = await fetch(\`\${API_BASE}/settings\`);
                if (response.ok) {
                    const settings = await response.json();
                    if (settings && settings.theme) {
                        setTheme(settings.theme);
                    }
                }
            } catch (error) {
                console.error('加载设置失败:', error);
            }
        }
        
        // ------------------------- 初始化 -------------------------
        document.addEventListener('DOMContentLoaded', async () => {
            updateDateDisplay();
            await loadSettings();
            await loadTasksFromKV();
            renderTasks();
            
            setInterval(updateDateDisplay, 60000);
            
            console.log('页面加载完成，任务数量：', tasks.length);
        });

    </script>
</body>
</html>`;

// The new admin HTML page
const adminHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>每日工作计划备忘录 - 管理后台</title>
    
    <link rel="manifest" href="./manifest.json">
    <meta name="theme-color" content="#0078f5">
    
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        :root {
            --primary-color: #0078f5;
            --secondary-color: #f8f9fa;
            --border-color: #e1e5e9;
            --text-color: #333;
            --text-light: #666;
            --success-color: #28a745;
            --warning-color: #ffc107;
            --danger-color: #dc3545;
            --priority-high: #dc3545;
            --priority-medium: #ffc107;
            --priority-low: #28a745;
            --shadow: 0 2px 4px rgba(0,0,0,0.1);
            --border-radius: 8px;
        }

        [data-theme="dark"] {
            --primary-color: #4a9eff;
            --secondary-color: #1a1a1a;
            --border-color: #444;
            --text-color: #e1e5e9;
            --text-light: #aaa;
            --secondary-color-light: #2d2d2d;
            --shadow: 0 2px 4px rgba(255,255,255,0.1);
            --success-color: #4caf50;
            --warning-color: #ff9800;
            --danger-color: #f44336;
            --priority-high: #f44336;
            --priority-medium: #ff9800;
            --priority-low: #4caf50;
        }

        [data-theme="dark"] .header {
            background: var(--secondary-color-light);
            color: var(--text-color);
        }

        [data-theme="dark"] .task-cell {
            background: #2a2a2a;
        }

        [data-theme="dark"] .task-card {
            background: linear-gradient(135deg, #333, #2a2a2a);
            color: var(--text-color);
            border-color: var(--border-color);
        }

        [data-theme="dark"] .modal-content {
            background: var(--secondary-color-light);
            color: var(--text-color);
        }

        [data-theme="dark"] .form-control {
            background: #333;
            color: var(--text-color);
            border-color: var(--border-color);
        }

        [data-theme="dark"] .form-control:focus {
            border-color: var(--primary-color);
        }

        [data-theme="dark"] .properties-panel {
            background: var(--secondary-color-light);
            color: var(--text-color);
        }

        [data-theme="dark"] .day-header {
            background: linear-gradient(135deg, #333, #2a2a2a);
            color: var(--text-color);
        }

        [data-theme="dark"] .day-header:hover {
            background: linear-gradient(135deg, #3a3a3a, #333);
        }

        [data-theme="dark"] .time-label {
            background: linear-gradient(135deg, #333, #2a2a2a);
            color: var(--text-color);
        }

        [data-theme="dark"] .time-label:hover {
            background: linear-gradient(135deg, #3a3a3a, #333);
        }

        [data-theme="dark"] .drop-zone {
            border-color: var(--border-color);
            color: var(--text-light);
        }

        [data-theme="dark"] .drop-zone.dragover {
            border-color: var(--primary-color);
            background: rgba(74, 158, 255, 0.1);
        }

        [data-theme="green"] {
            --primary-color: #28a745;
            --secondary-color: #f0f8f0;
            --border-color: #c3e6c3;
            --text-color: #2d5a2d;
            --text-light: #5a7a5a;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: var(--secondary-color);
            color: var(--text-color);
            line-height: 1.6;
            overflow-x: hidden;
            padding: 20px;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
            background: white;
            border-radius: var(--border-radius);
            box-shadow: var(--shadow);
        }
        
        h1, h2, h3 {
            color: var(--primary-color);
            margin-bottom: 20px;
        }

        .controls {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-bottom: 20px;
            align-items: center;
        }

        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: var(--border-radius);
            cursor: pointer;
            font-size: 14px;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .btn-primary {
            background: var(--primary-color);
            color: white;
        }

        .btn-secondary {
            background: var(--secondary-color);
            color: var(--text-color);
            border: 1px solid var(--border-color);
        }
        
        .btn-danger {
            background: var(--danger-color);
            color: white;
        }

        .btn:hover {
            transform: translateY(-1px);
            box-shadow: var(--shadow);
        }

        .form-group {
            margin-bottom: 15px;
        }

        .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
            font-size: 14px;
        }

        .form-control {
            width: 100%;
            padding: 8px;
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius);
            font-size: 14px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.5;
        }

        .drop-zone {
            border: 2px dashed var(--border-color);
            border-radius: var(--border-radius);
            padding: 20px;
            text-align: center;
            color: var(--text-light);
            margin-bottom: 15px;
        }

        .drop-zone.dragover {
            border-color: var(--primary-color);
            background: rgba(0, 120, 245, 0.1);
        }

        .tasks-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        
        .tasks-table th, .tasks-table td {
            padding: 12px;
            border: 1px solid var(--border-color);
            text-align: left;
        }

        .tasks-table th {
            background-color: var(--secondary-color);
            font-weight: bold;
        }
        
        .tasks-table tr:nth-child(even) {
            background-color: #f6f6f6;
        }

        .tasks-table tr:hover {
            background-color: #eef;
        }

        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 1000;
        }

        .modal-content {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 30px;
            border-radius: var(--border-radius);
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .close-btn {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: var(--text-light);
        }

        .toast {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 4px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
        }

        .toast.show {
            opacity: 1;
            transform: translateX(0);
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>每日工作计划备忘录 - 管理后台</h1>
        <p style="margin-bottom: 20px;"><a href="/">返回主页</a></p>

        <h2>任务操作</h2>
        <div class="controls">
            <button class="btn btn-primary" onclick="showTaskModal('add')">+ 添加新任务</button>
            <button class="btn btn-danger" onclick="clearData()">清空所有任务</button>
            <button class="btn btn-secondary" onclick="exportToCSV()">📊 CSV导出</button>
            <button class="btn btn-secondary" onclick="showImportModal()">📥 CSV导入</button>
            <button class="btn btn-secondary" onclick="refreshTasks()">🔄 刷新列表</button>
        </div>

        <h2>任务列表</h2>
        <table class="tasks-table">
            <thead>
                <tr>
                    <th>标题</th>
                    <th>星期</th>
                    <th>时段</th>
                    <th>开始时间</th>
                    <th>结束时间</th>
                    <th>优先级</th>
                    <th>状态</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody id="tasksTableBody">
            </tbody>
        </table>

        <div class="modal" id="taskModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="modalTitle">添加任务</h3>
                    <button class="close-btn" onclick="closeModal('taskModal')">&times;</button>
                </div>
                <form id="taskForm">
                    <div class="form-group">
                        <label>任务标题</label>
                        <input type="text" class="form-control" id="taskTitle" required>
                    </div>
                    <div class="form-group">
                        <label>星期</label>
                        <select class="form-control" id="taskDay">
                            <option value="1">周一</option>
                            <option value="2">周二</option>
                            <option value="3">周三</option>
                            <option value="4">周四</option>
                            <option value="5">周五</option>
                            <option value="6">周六</option>
                            <option value="7">周日</option>
                            <option value="pool">任务池</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>时段</label>
                        <select class="form-control" id="taskSlot">
                            <option value="AM">上午</option>
                            <option value="PM">下午</option>
                            <option value="EVENING">晚上</option>
                            <option value="pool">任务池</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>开始时间</label>
                        <input type="time" class="form-control" id="taskStart">
                    </div>
                    <div class="form-group">
                        <label>结束时间</label>
                        <input type="time" class="form-control" id="taskEnd">
                    </div>
                    <div class="form-group">
                        <label>优先级</label>
                        <select class="form-control" id="taskPriority">
                            <option value="1">高</option>
                            <option value="2">中</option>
                            <option value="3">低</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>是否完成</label>
                        <input type="checkbox" id="taskDone">
                    </div>
                    <div class="form-group">
                        <label>备注</label>
                        <textarea class="form-control" id="taskNote" rows="3"></textarea>
                    </div>
                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button type="button" class="btn btn-secondary" onclick="closeModal('taskModal')">取消</button>
                        <button type="submit" class="btn btn-primary">保存</button>
                    </div>
                </form>
            </div>
        </div>

        <div class="modal" id="importModal">
            <div class="modal-content" style="max-width: 600px; width: 90%;">
                <div class="modal-header">
                    <h3 style="margin: 0; color: var(--primary-color);"> <span style="margin-right: 8px;">📥</span>CSV任务导入 </h3>
                    <button class="close-btn" onclick="closeModal('importModal')" style="font-size: 24px; color: var(--text-light);">&times;</button>
                </div>
                <div class="modal-body" style="padding: 30px;">
                    <div class="import-upload-area" style=" border: 2px dashed var(--border-color); border-radius: 12px; padding: 40px 20px; text-align: center; transition: all 0.3s ease; margin-bottom: 25px; background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; " onmouseover="this.style.borderColor='var(--primary-color)'; this.style.background='linear-gradient(135deg, #f0f4ff 0%, #e8f0ff 100%)';" onmouseout="this.style.borderColor='var(--border-color)'; this.style.background='linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%)';">
                        <div style="font-size: 48px; margin-bottom: 15px; color: var(--primary-color);">📁</div>
                        <h4 style="margin: 0 0 10px 0; color: var(--text-color);">拖拽文件到此处或点击选择</h4>
                        <p style="margin: 0 0 15px 0; color: var(--text-light); font-size: 14px;"> 支持CSV格式文件，文件大小不超过5MB </p>
                        <input type="file" id="fileInput" accept=".csv" onchange="handleFileSelect(event)" style=" display: none; ">
                        <div style="display: flex; gap: 10px;">
                            <button type="button" class="btn btn-secondary" onclick="document.getElementById('fileInput').click()">选择文件</button>
                            <a href="./weekly_template.csv" download class="btn btn-secondary" style="text-decoration: none;">下载模板</a>
                        </div>
                    </div>
                    <p style="margin-top: 20px; color: var(--text-light); font-size: 14px; text-align: center;">请确保CSV文件格式与模板一致。</p>
                </div>
            </div>
        </div>
    </div>
    <div id="toast" class="toast"></div>

    <script>
        let tasks = [];
        let currentTaskId = null;
        const API_BASE = '/api';

        const getAuthToken = () => {
            const name = 'auth_token=';
            const decodedCookie = decodeURIComponent(document.cookie);
            const ca = decodedCookie.split(';');
            for(let i = 0; i <ca.length; i++) {
                let c = ca[i];
                while (c.charAt(0) === ' ') {
                    c = c.substring(1);
                }
                if (c.indexOf(name) === 0) {
                    return c.substring(name.length, c.length);
                }
            }
            return '';
        }

        async function refreshTasks() {
            const authToken = getAuthToken();
            try {
                const response = await fetch(\`\${API_BASE}/tasks\`, {
                    headers: { 'Authorization': \`Bearer \${authToken}\` }
                });
                if (response.ok) {
                    const data = await response.json();
                    tasks = data || [];
                    renderTasksTable();
                } else if (response.status === 401) {
                    showToast('未授权，请重新登录。', 'danger');
                    window.location.href = '/admin.html';
                } else {
                    showToast('加载任务失败！', 'danger');
                }
            } catch (error) {
                showToast('加载任务失败！', 'danger');
            }
        }

        function renderTasksTable() {
            const tableBody = document.getElementById('tasksTableBody');
            tableBody.innerHTML = '';
            tasks.sort((a, b) => a.day - b.day || a.slot.localeCompare(b.slot) || a.startTime.localeCompare(b.startTime));
            tasks.forEach(task => {
                const row = tableBody.insertRow();
                row.insertCell().textContent = task.title;
                row.insertCell().textContent = getWeekdayString(task.day);
                row.insertCell().textContent = getSlotString(task.slot);
                row.insertCell().textContent = task.startTime;
                row.insertCell().textContent = task.endTime;
                row.insertCell().textContent = getPriorityString(task.priority);
                row.insertCell().textContent = task.done ? '是' : '否';

                const actionsCell = row.insertCell();
                actionsCell.innerHTML = \`
                    <button class="btn btn-primary" onclick="showTaskModal('edit', '\${task.id}')">编辑</button>
                    <button class="btn btn-danger" onclick="deleteTask('\${task.id}')">删除</button>
                \`;
            });
        }

        async function saveTask(event) {
            event.preventDefault();
            const authToken = getAuthToken();

            const task = {
                id: currentTaskId,
                title: document.getElementById('taskTitle').value,
                day: document.getElementById('taskDay').value === 'pool' ? '' : parseInt(document.getElementById('taskDay').value),
                slot: document.getElementById('taskSlot').value,
                startTime: document.getElementById('taskStart').value,
                endTime: document.getElementById('taskEnd').value,
                priority: parseInt(document.getElementById('taskPriority').value),
                note: document.getElementById('taskNote').value,
                done: document.getElementById('taskDone').checked
            };

            const url = \`\${API_BASE}/tasks/add\`;
            const method = 'POST';

            try {
                const response = await fetch(url, {
                    method: method,
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': \`Bearer \${authToken}\`
                    },
                    body: JSON.stringify(task)
                });

                if (response.ok) {
                    showToast('任务保存成功！', 'success');
                    closeModal('taskModal');
                    refreshTasks();
                } else if (response.status === 401) {
                    showToast('未授权，请重新登录。', 'danger');
                    window.location.href = '/admin.html';
                } else {
                    showToast('保存任务失败！', 'danger');
                }
            } catch (error) {
                showToast('保存任务失败！', 'danger');
            }
        }

        async function deleteTask(id) {
            if (!confirm('确定删除此任务？')) return;
            const authToken = getAuthToken();
            try {
                const response = await fetch(\`\${API_BASE}/tasks/delete/\${id}\`, { 
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': \`Bearer \${authToken}\`
                    }
                });
                if (response.ok) {
                    showToast('任务删除成功！', 'success');
                    refreshTasks();
                } else if (response.status === 401) {
                    showToast('未授权，请重新登录。', 'danger');
                    window.location.href = '/admin.html';
                } else {
                    showToast('删除任务失败！', 'danger');
                }
            } catch (error) {
                showToast('删除任务失败！', 'danger');
            }
        }

        async function clearData() {
            if (!confirm('确定清空所有数据？此操作不可逆！')) return;
            const authToken = getAuthToken();
            try {
                const response = await fetch(\`\${API_BASE}/tasks/clear\`, { 
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': \`Bearer \${authToken}\`
                    }
                });
                if (response.ok) {
                    showToast('所有数据已清空！', 'success');
                    refreshTasks();
                } else if (response.status === 401) {
                    showToast('未授权，请重新登录。', 'danger');
                    window.location.href = '/admin.html';
                } else {
                    showToast('清空数据失败！', 'danger');
                }
            } catch (error) {
                showToast('清空数据失败！', 'danger');
            }
        }

        function exportToCSV() {
            const authToken = getAuthToken();
            window.location.href = \`\${API_BASE}/tasks/export?auth_token=\${authToken}\`;
            showToast('任务已导出，下载即将开始。', 'success');
        }

        function showImportModal() {
            document.getElementById('importModal').style.display = 'block';
        }
        
        function handleFileSelect(event) {
            const file = event.target.files[0];
            if (!file) return;
            const authToken = getAuthToken();

            const reader = new FileReader();
            reader.onload = async function(e) {
                const content = e.target.result;
                try {
                    const response = await fetch(\`\${API_BASE}/tasks/import\`, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'text/csv',
                            'Authorization': \`Bearer \${authToken}\` 
                        },
                        body: content
                    });
                    if (response.ok) {
                        const result = await response.json();
                        showToast(\`成功导入 \${result.importedCount} 个任务！\`, 'success');
                        closeModal('importModal');
                        refreshTasks();
                    } else if (response.status === 401) {
                        showToast('未授权，请重新登录。', 'danger');
                        window.location.href = '/admin.html';
                    } else {
                        showToast('导入失败，请检查文件格式！', 'danger');
                    }
                } catch (error) {
                    showToast('导入失败！', 'danger');
                }
            };
            reader.readAsText(file);
        }

        function showTaskModal(mode, id = null) {
            const modal = document.getElementById('taskModal');
            const form = document.getElementById('taskForm');
            form.reset();
            currentTaskId = null;
            
            document.getElementById('modalTitle').textContent = mode === 'add' ? '添加任务' : '编辑任务';
            
            if (mode === 'edit') {
                const task = tasks.find(t => t.id === id);
                if (task) {
                    currentTaskId = task.id;
                    document.getElementById('taskTitle').value = task.title;
                    document.getElementById('taskDay').value = task.day || 'pool';
                    document.getElementById('taskSlot').value = task.slot;
                    document.getElementById('taskStart').value = task.startTime;
                    document.getElementById('taskEnd').value = task.endTime;
                    document.getElementById('taskPriority').value = task.priority;
                    document.getElementById('taskNote').value = task.note;
                    document.getElementById('taskDone').checked = task.done;
                }
            }

            modal.style.display = 'block';
        }

        function closeModal(modalId) {
            document.getElementById(modalId).style.display = 'none';
        }
        
        window.onclick = function(event) {
            if (event.target.id === 'taskModal') {
                closeModal('taskModal');
            }
            if (event.target.id === 'importModal') {
                closeModal('importModal');
            }
        };
        
        // Helper functions for data conversion
        function getWeekdayString(day) {
            const map = {1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六', 7: '周日', '': '任务池'};
            return map[day] || '';
        }
        
        function getSlotString(slot) {
            const map = {'AM': '上午', 'PM': '下午', 'EVENING': '晚上', 'pool': '任务池'};
            return map[slot] || '';
        }

        function getPriorityString(priority) {
            const map = {1: '高', 2: '中', 3: '低'};
            return map[priority] || '';
        }
        
        function getWeekdayNumber(dayString) {
            const map = {'周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6, '周日': 7, '任务池': 'pool'};
            return map[dayString] || null;
        }
        
        function getSlotType(slotString) {
            const map = {'上午': 'AM', '下午': 'PM', '晚上': 'EVENING', '任务池': 'pool'};
            return map[slotString] || 'pool';
        }

        function getPriorityNumber(priorityString) {
            const map = {'高': 1, '中': 2, '低': 3};
            return map[priorityString] || 3;
        }

        function showToast(message, type = 'success') {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.style.backgroundColor = type === 'success' ? '#28a745' : '#dc3545';
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }

        // Initialize
        document.addEventListener('DOMContentLoaded', refreshTasks);
        document.getElementById('taskForm').addEventListener('submit', saveTask);

    </script>
</body>
</html>`;

const loginHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>管理员登录</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background-color: #f0f2f5;
        }
        .login-container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            text-align: center;
            width: 100%;
            max-width: 400px;
        }
        h2 {
            margin-bottom: 20px;
            color: #0078f5;
        }
        .form-group {
            margin-bottom: 20px;
        }
        .form-control {
            width: 100%;
            padding: 12px;
            border: 1px solid #e1e5e9;
            border-radius: 8px;
            font-size: 16px;
            box-sizing: border-box;
        }
        .btn-primary {
            width: 100%;
            padding: 12px;
            border: none;
            border-radius: 8px;
            background-color: #0078f5;
            color: white;
            font-size: 16px;
            cursor: pointer;
            transition: background-color 0.3s ease;
        }
        .btn-primary:hover {
            background-color: #0056b3;
        }
        .error-message {
            color: #dc3545;
            margin-top: 10px;
            display: none;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <h2>管理员登录</h2>
        <form id="loginForm">
            <div class="form-group">
                <input type="password" id="passwordInput" class="form-control" placeholder="请输入管理员密码" required>
            </div>
            <button type="submit" class="btn-primary">登录</button>
        </form>
        <p id="errorMessage" class="error-message">密码错误，请重试！</p>
    </div>

    <script>
        document.getElementById('loginForm').addEventListener('submit', async (event) => {
            event.preventDefault();
            const password = document.getElementById('passwordInput').value;
            const errorMessage = document.getElementById('errorMessage');

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: password })
                });

                if (response.ok) {
                    window.location.href = '/admin.html';
                } else {
                    errorMessage.style.display = 'block';
                }
            } catch (error) {
                errorMessage.textContent = '登录失败，请稍后重试。';
                errorMessage.style.display = 'block';
            }
        });

        // If the user has a cookie, skip the login page.
        const hasCookie = document.cookie.split(';').some((item) => item.trim().startsWith('auth_token='));
        if (hasCookie) {
            window.location.href = '/admin.html';
        }
    </script>
</body>
</html>`;

const manifest = `{
  "name": "每日工作计划备忘录",
  "short_name": "工作计划",
  "description": "零依赖的每日工作计划管理工具，支持拖拽排序、Excel导入导出、离线使用",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0078f5",
  "icons": [
    {
      "src": "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyIiBoZWlnaHQ9IjE5MiIgdmlld0JveD0iMCAwIDE5MiAxOTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxOTIiIGhlaWdodD0iMTkyIiByeD0iMjQiIGZpbGw9IiMwMDc4RjUiLz4KPHN2ZyB4PSI0OCIgeT0iNDgiIHdpZHRoPSI5NiIgaGVpZ2h0PSI5NiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJ3aGl0ZSI+CjxwYXRoIGQ9Ik0xOSA0SDVjLTEuMTEgMC0yIC44OS0yIDJ2MTJjMCAxLjExLjg5IDIgMiAyaDE0YzEuMTEgMCAyLS44OSAyLTJWNmMwLTEuMTEtLjg5LTItMi0yem0wIDE0SDVWNmgxNHYxMnptLTcuNTEtNC4yOVwxMiAxNGwtMi40OS0yLjI5TDcgMTIuNTEgMTIg...
  ]
}`;

const csvTemplate = `星期,时段,任务标题,开始时间,结束时间,优先级,是否完成,备注
周一,上午,晨间阅读,08:00,09:00,中,否,阅读30分钟专业书籍
周一,下午,项目会议,14:00,15:30,高,否,与客户讨论需求
周二,上午,代码开发,09:00,12:00,高,否,完成用户登录功能
周二,下午,代码审查,14:00,15:00,中,否,review同事提交的代码
周三,上午,团队例会,09:30,10:30,中,否,同步项目进度
周三,晚上,学习计划,19:00,21:00,低,否,学习新技术栈
周四,上午,需求分析,10:00,11:30,高,否,分析新功能需求
周四,下午,测试用例,15:00,17:00,中,否,编写功能测试用例
周五,上午,周报总结,09:00,10:00,中,否,整理本周工作总结
周五,下午,技术分享,16:00,17:00,低,否,准备下周分享内容
周六,上午,健身运动,08:30,10:00,低,否,跑步5公里
周六,晚上,家庭时间,19:00,21:00,低,否,陪家人看电影
周日,上午,休息放松,09:00,11:00,低,是,充分休息
`;


function generateUniqueId() {
    return 'task-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function getWeekdayNumber(dayString) {
    const map = {'周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6, '周日': 7, '任务池': 'pool'};
    return map[dayString];
}

function getSlotType(slotString) {
    const map = {'上午': 'AM', '下午': 'PM', '晚上': 'EVENING', '任务池': 'pool'};
    return map[slotString];
}

function getPriorityNumber(priorityString) {
    const map = {'高': 1, '中': 2, '低': 3};
    return map[priorityString];
}

function getWeekdayString(day) {
    const map = {1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六', 7: '周日', '': '任务池'};
    return map[day] || '';
}

function getSlotString(slot) {
    const map = {'AM': '上午', 'PM': '下午', 'EVENING': '晚上', 'pool': '任务池'};
    return map[slot] || '';
}

function getPriorityString(priority) {
    const map = {1: '高', 2: '中', 3: '低'};
    return map[priority] || '';
}

function getAuthTokenFromHeader(request) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }
    return null;
}

async function handleApiRequest(request, env, path) {
    const authToken = getAuthTokenFromHeader(request);
    
    if (env.ADMIN_PASSWORD && authToken !== env.ADMIN_PASSWORD) {
        return new Response('Unauthorized', { status: 401 });
    }
    
    // 获取任务列表
    if (path === '/api/tasks' && request.method === 'GET') {
        const tasks = await env.TASK_KV.get('tasks');
        return new Response(tasks || '[]', {
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // 保存设置
    if (path === '/api/settings' && request.method === 'GET') {
        const settings = await env.TASK_KV.get('settings');
        return new Response(settings || '{}', {
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // 添加或编辑任务
    if (path === '/api/tasks/add' && request.method === 'POST') {
        const newTask = await request.json();
        let tasks = await env.TASK_KV.get('tasks', 'json') || [];
        if (!newTask.id) {
            newTask.id = generateUniqueId();
            tasks.push(newTask);
        } else {
            const index = tasks.findIndex(t => t.id === newTask.id);
            if (index !== -1) {
                tasks[index] = newTask;
            } else {
                tasks.push(newTask);
            }
        }
        await env.TASK_KV.put('tasks', JSON.stringify(tasks));
        return new Response('Task saved', { status: 200 });
    }

    // 删除任务
    if (path.startsWith('/api/tasks/delete/')) {
        const taskId = path.split('/').pop();
        let tasks = await env.TASK_KV.get('tasks', 'json') || [];
        tasks = tasks.filter(t => t.id !== taskId);
        await env.TASK_KV.put('tasks', JSON.stringify(tasks));
        return new Response('Task deleted', { status: 200 });
    }

    // 清空所有任务
    if (path === '/api/tasks/clear' && request.method === 'POST') {
        await env.TASK_KV.delete('tasks');
        return new Response('Tasks cleared', { status: 200 });
    }
    
    // 导出CSV
    if (path === '/api/tasks/export' && request.method === 'GET') {
        const authToken = new URL(request.url).searchParams.get('auth_token');
        if (env.ADMIN_PASSWORD && authToken !== env.ADMIN_PASSWORD) {
            return new Response('Unauthorized', { status: 401 });
        }
        const tasks = await env.TASK_KV.get('tasks', 'json') || [];
        const header = ['星期', '时段', '任务标题', '开始时间', '结束时间', '优先级', '是否完成', '备注'];
        const rows = tasks.map(task => [
            getWeekdayString(task.day),
            getSlotString(task.slot),
            task.title,
            task.startTime,
            task.endTime,
            getPriorityString(task.priority),
            task.done ? '是' : '否',
            task.note
        ]);
        const csvContent = "\uFEFF" + header.map(e => `"${e}"`).join(',') + '\n' + rows.map(row => row.map(e => `"${e}"`).join(',')).join('\n');
        return new Response(csvContent, {
            headers: {
                'Content-Type': 'text/csv;charset=utf-8',
                'Content-Disposition': 'attachment; filename="weekly_plan.csv"'
            }
        });
    }
    
    // 导入CSV
    if (path === '/api/tasks/import' && request.method === 'POST') {
        const csvString = await request.text();
        const lines = csvString.split('\n').map(line => line.trim()).filter(line => line);
        const importedTasks = [];
        const header = lines[0].split(',').map(h => h.replace(/"/g, ''));
        const headerMap = {
            '星期': 'day', '时段': 'slot', '任务标题': 'title', '开始时间': 'startTime',
            '结束时间': 'endTime', '优先级': 'priority', '是否完成': 'done', '备注': 'note'
        };
    
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.replace(/"/g, ''));
            if (values.length !== header.length) continue;
    
            const task = {
                id: generateUniqueId(),
                repeatType: 'once'
            };
    
            values.forEach((value, index) => {
                const key = headerMap[header[index]];
                if (key) {
                    let parsedValue = value;
                    if (key === 'day') {
                        parsedValue = getWeekdayNumber(value);
                    } else if (key === 'slot') {
                        parsedValue = getSlotType(value);
                    } else if (key === 'priority') {
                        parsedValue = getPriorityNumber(value);
                    } else if (key === 'done') {
                        parsedValue = value === '是';
                    }
                    task[key] = parsedValue;
                }
            });
            importedTasks.push(task);
        }
    
        let tasks = await env.TASK_KV.get('tasks', 'json') || [];
        tasks = [...tasks, ...importedTasks];
        await env.TASK_KV.put('tasks', JSON.stringify(tasks));
    
        return new Response(JSON.stringify({ importedCount: importedTasks.length }), {
            headers: { 'Content-Type': 'application/json' },
        });
    }
    
    return new Response('API Not Found', { status: 404 });
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;
        const cookies = request.headers.get('Cookie');

        // Login API
        if (path === '/api/login' && request.method === 'POST') {
            const { password } = await request.json();
            if (env.ADMIN_PASSWORD && password === env.ADMIN_PASSWORD) {
                // Set the authentication cookie on successful login
                const headers = new Headers();
                headers.append('Set-Cookie', `auth_token=${env.ADMIN_PASSWORD}; Path=/; HttpOnly; Max-Age=3600`);
                headers.append('Content-Type', 'text/plain');
                return new Response('Login successful', { status: 200, headers: headers });
            } else {
                return new Response('Unauthorized', { status: 401 });
            }
        }

        // Authentication middleware
        const authToken = cookies && cookies.split(';').map(s => s.trim()).find(s => s.startsWith('auth_token='));

        if (path.startsWith('/api/') && path !== '/api/login') {
            // Check for both Authorization header (from JS) and cookie (for export)
            const authHeaderToken = getAuthTokenFromHeader(request);
            const authQueryToken = url.searchParams.get('auth_token');

            if (env.ADMIN_PASSWORD && authHeaderToken !== env.ADMIN_PASSWORD && authQueryToken !== env.ADMIN_PASSWORD) {
                 return new Response('Unauthorized', { status: 401 });
            }
            return handleApiRequest(request, env, path);
        }
        
        // 静态文件服务
        if (path === '/') {
            return new Response(viewerHtml, {
                headers: { 'content-type': 'text/html;charset=UTF-8' },
            });
        } else if (path === '/index.html') {
            return new Response(viewerHtml, {
                headers: { 'content-type': 'text/html;charset=UTF-8' },
            });
        } else if (path === '/admin.html') {
            if (env.ADMIN_PASSWORD && (!authToken || authToken.split('=')[1] !== env.ADMIN_PASSWORD)) {
                return new Response(loginHtml, {
                    headers: { 'content-type': 'text/html;charset=UTF-8' },
                });
            }
            return new Response(adminHtml, {
                headers: { 'content-type': 'text/html;charset=UTF-8' },
            });
        } else if (path === '/manifest.json') {
            return new Response(manifest, {
                headers: { 'content-type': 'application/json;charset=UTF-8' },
            });
        } else if (path === '/weekly_template.csv') {
            return new Response(csvTemplate, {
                headers: { 'content-type': 'text/csv;charset=UTF-8' },
            });
        }

        return new Response('Not Found', { status: 404 });
    },
};
