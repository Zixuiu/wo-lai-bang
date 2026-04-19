此次合并对应用进行了全面的移动端设计重构和功能增强，包括地理位置选择优化、UI界面改进、功能逻辑调整等。主要变更集中在前端页面和交互逻辑上，提升了用户体验和功能完整性。
| 文件 | 变更 |
|------|---------|
| android/app/src/main/assets/www/index.html | - 扩展了城市和区县数据，增加更多地区选项<br>- 改进地理位置选择界面，使用网格布局替代下拉选择<br>- 增加根据城市获取省份的功能<br>- 优化地理位置保存逻辑，保留原有经纬度信息 |
| android/app/src/main/assets/www/js/app.js | - 改进地理位置定位逻辑，优化城市和区县匹配<br>- 统一使用getAvatar函数处理头像显示<br>- 移除暗黑模式相关功能<br>- 优化个人资料编辑功能，增加技能标签建议<br>- 改进表单验证逻辑，移除必填项错误提示<br>- 优化登录弹窗逻辑，支持重定向 |
| android/app/src/main/assets/www/css/mobile-redesign.css | - 重构requests.html页面移动端布局，优化瀑布流展示<br>- 改进筛选栏和搜索框设计，提升用户体验<br>- 调整快速操作网格样式和尺寸<br>- 优化卡片样式和交互效果<br>- 增加移动端骨架屏优化 |
| android/app/src/main/assets/www/js/app.v2.js | - 新增完整的v2版本应用逻辑文件 |
| android/app/src/main/assets/www/js/core.js | - 新增核心功能模块文件 |
| android/app/src/main/assets/www/ui-preview.html | - 新增UI预览页面 |
| android/app/src/main/assets/www/css/ui-preview.css | - 新增UI预览页面样式 |
| android/app/src/main/assets/www/forgot.html | - 新增忘记密码页面 |
| android/app/src/main/assets/www/css/back-button.css | - 新增返回按钮样式 |
| frontend/js/app.v2.js | - 新增完整的v2版本应用逻辑文件 |