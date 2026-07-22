# EEAgent Mobile PWA

将整个目录部署到 Vercel 或其他 HTTPS 静态站点。

Vercel：导入目录对应的 GitHub 仓库，Framework Preset 选择 Other，无需 Build Command。

iPhone：Safari 打开后，点“分享”→“添加到主屏幕”。
Android：Chrome 打开后，点菜单→“安装应用”或“添加到主屏幕”。

部署后支持离线缓存、主屏幕图标、收藏和工作流本地保存。


## V2 更新

- 修复移动端分类 TAB 点击后横向跳动。
- 支持创建和保存多个工作流。
- 支持打开、复制、删除已保存工作流。
- 支持导出全部工作流备份和 JSON 导入。
- 当前草稿、收藏和工作流库保存在浏览器 localStorage。
- Service Worker 缓存版本升级为 `eeagent-mobile-v2`。

工作流默认只保存在同一浏览器、同一域名中。清除网站数据、改用其他浏览器或更换域名后，本地数据不会自动同步，因此建议定期使用“备份全部”。
