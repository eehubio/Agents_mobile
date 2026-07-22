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


## V3：智能体设计方案文档

- `docs/agent-01.md` 至 `docs/agent-47.md`：47 份设计方案。
- `docs/index.json`：智能体与 Markdown 文件的映射。
- 点击智能体卡片或“查看设计方案”，会打开手机端 Markdown 阅读器。
- 阅读器支持目录、阅读进度、文内搜索、字号切换、上一篇/下一篇和 Markdown 下载。
- Service Worker 会预缓存全部 47 份文档，安装 PWA 后可以离线阅读。
- 更新某个智能体文档时，替换对应 `docs/agent-XX.md` 并修改 `sw.js` 的缓存版本。


## V4 修复

- 工作流抽屉层级高于移动端底部导航。
- 打开工作流时自动隐藏底部导航。
- 禁止背景页面继续滚动。
- 底部“清空当前 / 复制 JSON / 导出当前”固定在抽屉内部。
- 支持 iPhone `safe-area-inset-bottom`。
- 使用 `100dvh / 100svh` 适配微信、Safari 和 Chrome 的动态工具栏。
- Service Worker 缓存升级为 `eeagent-mobile-v4-docs`。


## V5

- 工作流面板改为“独立滚动内容区 + 永久可见底部操作栏”。
- 底部按钮不再使用 `position: sticky`。
- 手机打开工作流后隐藏页面底部导航。
- Markdown 文档网络优先，离线缓存兜底。
- 桌面和手机右上角增加 `↻` 强制刷新按钮。
- 强制刷新不会删除收藏和工作流。
- Service Worker 缓存：`eeagent-mobile-v5-docs`。


## V6：Markdown 大片空白修复

问题原因：

- `#docLoading` 使用 `hidden=true` 隐藏；
- 但 `.doc-reader-state { display:grid; min-height:54dvh; }` 覆盖了浏览器的默认隐藏行为；
- 因此加载占位区仍占据约半个视口高度，正文被推到下方。

修复：

- 增加 `.doc-reader-state[hidden] { display:none!important; }`；
- 加载成功后显式设置 `style.display = "none"` 并清空占位内容；
- 加载开始和失败时再显式恢复为 `display:grid`；
- Service Worker 缓存升级为 `eeagent-mobile-v6-docs`。


## V7：空白首页修复

V6 的 Markdown Reader DOM 在工作流布局调整时被误删，导致：

```text
Cannot set properties of null (setting 'onclick')
```

脚本在首页 `render()` 之前停止，所以卡片区域为空。

V7：

- 恢复完整 Markdown Reader DOM；
- 文档控件使用容错初始化；
- Escape 和可选按钮绑定使用空值保护；
- 增加启动错误提示；
- 缓存升级为 `eeagent-mobile-v7-docs`。
