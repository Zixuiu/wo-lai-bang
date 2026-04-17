/**
 * 自定义日期时间选择器
 * 替代原生 datetime-local 控件
 */

class DateTimePicker {
    constructor(inputElement, options = {}) {
        this.input = inputElement;
        this.options = {
            minDate: options.minDate || null,
            maxDate: options.maxDate || null,
            format: options.format || 'YYYY-MM-DD HH:mm',
            placeholder: options.placeholder || '请选择日期时间',
            ...options
        };
        
        this.currentDate = new Date();
        this.selectedDate = null;
        this.selectedHour = null;
        this.selectedMinute = null;
        this.isOpen = false;
        
        this.init();
    }
    
    init() {
        this.createWrapper();
        this.createPopup();
        this.bindEvents();
        
        // 如果输入框有值，解析它
        if (this.input.value) {
            this.parseInputValue(this.input.value);
        }
    }
    
    createWrapper() {
        // 创建包装器
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'datetime-picker-wrapper';
        
        // 替换原输入框
        this.input.parentNode.insertBefore(this.wrapper, this.input);
        this.wrapper.appendChild(this.input);
        
        // 修改原输入框样式
        this.input.className = 'datetime-input';
        this.input.placeholder = this.options.placeholder;
        this.input.readOnly = true;
        
        // 添加日历图标
        this.icon = document.createElement('span');
        this.icon.className = 'datetime-input-icon';
        this.icon.innerHTML = '📅';
        this.wrapper.appendChild(this.icon);
        
        // 创建隐藏的 input 存储实际值
        this.hiddenInput = document.createElement('input');
        this.hiddenInput.type = 'hidden';
        this.hiddenInput.name = this.input.name;
        this.wrapper.appendChild(this.hiddenInput);
        
        // 移除原 input 的 name，避免重复提交
        this.input.removeAttribute('name');
    }
    
    createPopup() {
        // 创建遮罩层
        this.overlay = document.createElement('div');
        this.overlay.className = 'datetime-picker-overlay';
        document.body.appendChild(this.overlay);
        
        // 创建弹窗
        this.popup = document.createElement('div');
        this.popup.className = 'datetime-picker-popup';
        this.popup.innerHTML = `
            <!-- 快捷选项 -->
            <div class="quick-options">
                <button class="quick-option" data-value="today">今天</button>
                <button class="quick-option" data-value="tomorrow">明天</button>
                <button class="quick-option" data-value="weekend">本周末</button>
                <button class="quick-option" data-value="nextWeek">下周</button>
            </div>
            
            <!-- 日历头部 -->
            <div class="calendar-header">
                <div class="calendar-nav">
                    <button class="calendar-nav-btn" data-action="prevYear">«</button>
                    <button class="calendar-nav-btn" data-action="prevMonth">‹</button>
                </div>
                <div class="calendar-title"></div>
                <div class="calendar-nav">
                    <button class="calendar-nav-btn" data-action="nextMonth">›</button>
                    <button class="calendar-nav-btn" data-action="nextYear">»</button>
                </div>
            </div>
            
            <!-- 星期标题 -->
            <div class="calendar-weekdays">
                <div class="calendar-weekday">日</div>
                <div class="calendar-weekday">一</div>
                <div class="calendar-weekday">二</div>
                <div class="calendar-weekday">三</div>
                <div class="calendar-weekday">四</div>
                <div class="calendar-weekday">五</div>
                <div class="calendar-weekday">六</div>
            </div>
            
            <!-- 日期网格 -->
            <div class="calendar-days"></div>
            
            <!-- 时间选择器 -->
            <div class="time-picker">
                <div class="time-picker-label">
                    <span>⏰</span>
                    <span>选择时间</span>
                </div>
                <div class="time-picker-row">
                    <div class="time-picker-group">
                        <label>时</label>
                        <select class="time-picker-select" id="hour-select"></select>
                    </div>
                    <span class="time-separator">:</span>
                    <div class="time-picker-group">
                        <label>分</label>
                        <select class="time-picker-select" id="minute-select"></select>
                    </div>
                </div>
            </div>
            
            <!-- 底部按钮 -->
            <div class="datetime-picker-footer">
                <button class="datetime-picker-btn secondary" data-action="clear">清空</button>
                <button class="datetime-picker-btn primary" data-action="confirm">确定</button>
            </div>
        `;
        
        this.wrapper.appendChild(this.popup);
        
        // 缓存元素引用
        this.calendarTitle = this.popup.querySelector('.calendar-title');
        this.calendarDays = this.popup.querySelector('.calendar-days');
        this.hourSelect = this.popup.querySelector('#hour-select');
        this.minuteSelect = this.popup.querySelector('#minute-select');
        
        // 初始化时间选择器
        this.initTimeSelects();
        
        // 渲染日历
        this.renderCalendar();
    }
    
    initTimeSelects() {
        // 小时选项 (00-23)
        for (let i = 0; i < 24; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = String(i).padStart(2, '0');
            this.hourSelect.appendChild(option);
        }
        
        // 分钟选项 (00-59，步进5分钟)
        for (let i = 0; i < 60; i += 5) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = String(i).padStart(2, '0');
            this.minuteSelect.appendChild(option);
        }
        
        // 设置默认时间
        const now = new Date();
        this.hourSelect.value = now.getHours();
        this.minuteSelect.value = Math.floor(now.getMinutes() / 5) * 5;
    }
    
    renderCalendar() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        // 更新标题
        this.calendarTitle.textContent = `${year}年${month + 1}月`;
        
        // 获取当月第一天和最后一天
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const prevLastDay = new Date(year, month, 0);
        
        // 获取星期几（0=周日）
        const firstDayWeek = firstDay.getDay();
        const daysInMonth = lastDay.getDate();
        const daysInPrevMonth = prevLastDay.getDate();
        
        let html = '';
        
        // 上月日期
        for (let i = firstDayWeek - 1; i >= 0; i--) {
            const day = daysInPrevMonth - i;
            html += `<button class="calendar-day other-month" data-day="${day}" data-month="${month - 1}">${day}</button>`;
        }
        
        // 当月日期
        const today = new Date();
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            let className = 'calendar-day';
            
            // 今天
            if (date.toDateString() === today.toDateString()) {
                className += ' today';
            }
            
            // 选中日期
            if (this.selectedDate && date.toDateString() === this.selectedDate.toDateString()) {
                className += ' selected';
            }
            
            // 禁用日期
            if (this.isDateDisabled(date)) {
                className += ' disabled';
            }
            
            html += `<button class="${className}" data-day="${day}" data-month="${month}">${day}</button>`;
        }
        
        // 下月日期
        const remainingCells = 42 - (firstDayWeek + daysInMonth); // 6行 x 7列 = 42
        for (let day = 1; day <= remainingCells; day++) {
            html += `<button class="calendar-day other-month" data-day="${day}" data-month="${month + 1}">${day}</button>`;
        }
        
        this.calendarDays.innerHTML = html;
    }
    
    isDateDisabled(date) {
        if (this.options.minDate && date < this.options.minDate) {
            return true;
        }
        if (this.options.maxDate && date > this.options.maxDate) {
            return true;
        }
        return false;
    }
    
    bindEvents() {
        // 输入框点击事件
        this.input.addEventListener('click', () => this.open());
        this.icon.addEventListener('click', () => this.open());
        
        // 遮罩层点击事件
        this.overlay.addEventListener('click', () => this.close());
        
        // 日历导航按钮
        this.popup.querySelectorAll('.calendar-nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                switch (action) {
                    case 'prevYear':
                        this.currentDate.setFullYear(this.currentDate.getFullYear() - 1);
                        break;
                    case 'nextYear':
                        this.currentDate.setFullYear(this.currentDate.getFullYear() + 1);
                        break;
                    case 'prevMonth':
                        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
                        break;
                    case 'nextMonth':
                        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
                        break;
                }
                this.renderCalendar();
            });
        });
        
        // 日期点击事件
        this.calendarDays.addEventListener('click', (e) => {
            if (e.target.classList.contains('calendar-day') && !e.target.classList.contains('disabled')) {
                const day = parseInt(e.target.dataset.day);
                const monthOffset = parseInt(e.target.dataset.month);

                this.selectedDate = new Date(
                    this.currentDate.getFullYear(),
                    monthOffset,
                    day
                );

                this.renderCalendar();

                // 自动确认填充
                this.confirm();
            }
        });
        
        // 快捷选项
        this.popup.querySelectorAll('.quick-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const value = e.target.dataset.value;
                const now = new Date();
                
                switch (value) {
                    case 'today':
                        this.selectedDate = new Date();
                        break;
                    case 'tomorrow':
                        this.selectedDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
                        break;
                    case 'weekend':
                        const daysUntilWeekend = (6 - now.getDay() + 7) % 7 || 7;
                        this.selectedDate = new Date(now.getTime() + daysUntilWeekend * 24 * 60 * 60 * 1000);
                        break;
                    case 'nextWeek':
                        this.selectedDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                        break;
                }
                
                this.currentDate = new Date(this.selectedDate);
                this.renderCalendar();
                
                // 更新快捷选项样式
                this.popup.querySelectorAll('.quick-option').forEach(opt => opt.classList.remove('active'));
                e.target.classList.add('active');
            });
        });
        
        // 底部按钮
        this.popup.querySelectorAll('.datetime-picker-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                
                if (action === 'clear') {
                    this.clear();
                } else if (action === 'confirm') {
                    this.confirm();
                }
            });
        });
        
        // 时间选择变化
        this.hourSelect.addEventListener('change', () => {
            this.selectedHour = parseInt(this.hourSelect.value);
        });
        
        this.minuteSelect.addEventListener('change', () => {
            this.selectedMinute = parseInt(this.minuteSelect.value);
        });
        
        // 点击外部关闭
        document.addEventListener('click', (e) => {
            if (this.isOpen && !this.wrapper.contains(e.target)) {
                this.close();
            }
        });
    }
    
    open() {
        this.isOpen = true;
        this.popup.classList.add('active');
        this.overlay.classList.add('active');
        
        // 如果有选中日期，切换到该月份
        if (this.selectedDate) {
            this.currentDate = new Date(this.selectedDate);
            this.renderCalendar();
        }
    }
    
    close() {
        this.isOpen = false;
        this.popup.classList.remove('active');
        this.overlay.classList.remove('active');
    }
    
    clear() {
        this.selectedDate = null;
        this.selectedHour = null;
        this.selectedMinute = null;
        this.input.value = '';
        this.hiddenInput.value = '';
        this.renderCalendar();
        this.close();
    }
    
    confirm() {
        if (!this.selectedDate) {
            // 如果没有选择日期，默认选择今天
            this.selectedDate = new Date();
        }
        
        const hour = parseInt(this.hourSelect.value);
        const minute = parseInt(this.minuteSelect.value);
        
        this.selectedDate.setHours(hour, minute, 0, 0);
        
        // 格式化显示值
        const formatted = this.formatDate(this.selectedDate);
        this.input.value = formatted;
        
        // 设置隐藏input的值（用于表单提交）
        const isoString = this.toISOString(this.selectedDate);
        this.hiddenInput.value = isoString;
        
        // 触发自定义事件
        this.input.dispatchEvent(new CustomEvent('datetimeChange', {
            detail: { date: this.selectedDate, value: isoString }
        }));
        
        this.close();
    }
    
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');
        
        return `${year}-${month}-${day} ${hour}:${minute}`;
    }
    
    toISOString(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');
        
        return `${year}-${month}-${day}T${hour}:${minute}`;
    }
    
    parseInputValue(value) {
        // 尝试解析 datetime-local 格式 (YYYY-MM-DDTHH:mm)
        const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
        if (match) {
            const [, year, month, day, hour, minute] = match;
            this.selectedDate = new Date(year, month - 1, day);
            this.selectedHour = parseInt(hour);
            this.selectedMinute = parseInt(minute);
            
            this.hourSelect.value = this.selectedHour;
            this.minuteSelect.value = Math.floor(this.selectedMinute / 5) * 5;
            
            this.input.value = this.formatDate(this.selectedDate);
            this.hiddenInput.value = value;
        }
    }
    
    // 公共方法：设置值
    setValue(date) {
        if (date instanceof Date) {
            this.selectedDate = date;
            this.selectedHour = date.getHours();
            this.selectedMinute = date.getMinutes();
            
            this.hourSelect.value = this.selectedHour;
            this.minuteSelect.value = Math.floor(this.selectedMinute / 5) * 5;
            
            this.input.value = this.formatDate(date);
            this.hiddenInput.value = this.toISOString(date);
        }
    }
    
    // 公共方法：获取值
    getValue() {
        return this.hiddenInput.value;
    }
    
    // 公共方法：获取日期对象
    getDate() {
        if (!this.selectedDate) return null;
        
        const date = new Date(this.selectedDate);
        date.setHours(parseInt(this.hourSelect.value), parseInt(this.minuteSelect.value), 0, 0);
        return date;
    }
}

// 自动初始化页面中的日期时间输入框
function initDateTimePickers() {
    // 查找 name 为 start_time 或 deadline 的输入框
    // 注意：start_time 已改为 select，deadline 已改为 date 类型输入框，不再需要日期选择器
    document.querySelectorAll('input[name="start_time"], input[name="deadline"]').forEach(input => {
        // 跳过已改为自定义控件的输入框
        if (input.id === 'deadline-input' || input.type === 'date') {
            return;
        }
        // 检查是否已经初始化
        if (!input.dataset.datetimePickerInitialized) {
            const picker = new DateTimePicker(input, {
                minDate: new Date(), // 默认最小日期为今天
                placeholder: input.placeholder || '请选择日期时间'
            });

            // 标记已初始化
            input.dataset.datetimePickerInitialized = 'true';

            // 将实例存储在元素上，方便外部访问
            input._dateTimePicker = picker;
        }
    });
}

// DOM 加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDateTimePickers);
} else {
    initDateTimePickers();
}

// 导出类供外部使用
window.DateTimePicker = DateTimePicker;
window.initDateTimePickers = initDateTimePickers;
