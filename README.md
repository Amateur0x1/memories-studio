# Memories Studio

一个本地处理照片的复古相册工作室。替换照片，预览旋转胶片与双窗动画，导出带固定配乐的视频。

[GitHub](https://github.com/Amateur0x1/memories-studio) · [线上体验](https://memories-studio.pages.dev)

## 功能

- 14 个照片槽位，支持逐张替换和批量导入。
- 横图、竖图均保留原比例完整显示，无自动裁切和拉伸；可先自行裁好构图再导入。主照片以圆角羽化蒙版融入黑色背景，预览与导出使用相同蒙版。
- 4:3、960 × 720、约 22 秒的复古观片器动画。
- 配乐和标题固定；界面仅提供照片替换、预览与视频导出。
- 优先导出带音轨的 MP4；浏览器不支持时导出 WebM。
- 导出在本机实时编码，约需 22 秒；保持页面在前台，可随时取消。
- 照片仅在浏览器处理；IndexedDB 自动恢复上次照片，不上传服务器。

单张照片上限 30 MB，导入后最长边缩小至 1600 px。批量导入最多取前 14 张，未替换的槽位保留原照片。

## 使用

推荐最新版 Chrome / Edge。直接打开 `index.html` 或双击 `打开工作室.command` 即可离线使用，无需安装依赖。首次运行使用默认示例照片和固定配乐。

预览支持播放、暂停、回到开头、时间轴拖动与空格键。关闭标签页、清理浏览器数据后可能丢失本地照片，请保留原始照片与导出文件。

## 开发与检查

需要 Node.js 22 或更新版本：

```sh
npm ci
npm run build
npm run dev
```

浏览器回归检查覆盖不同屏幕宽度下的画布缩放、横竖照片导入、原比例显示、羽化边缘和恢复、播放控制、导出取消，以及完整视频下载：

```sh
npx playwright install chromium
npm test
```

可通过 `CHROME_PATH` 指定本机 Chrome 路径。测试使用临时浏览器配置，不访问你平常浏览器中的照片草稿。

## Cloudflare Pages 部署

```sh
npx wrangler login
npm run deploy
```

第一次部署前，如账号中还没有对应的 Pages 项目，先执行：

```sh
npx wrangler pages project create memories-studio --production-branch main --force
```

项目已创建后，日常部署无需 `--force`。项目 `.npmrc` 固定使用公网 `https://registry.npmjs.org/`。

`npm run build` 只复制运行所需文件到 `public/`，部署不会包含源码配置、测试或本地凭据。

## 文件结构

- `index.html` / `studio.css`：照片工作室界面。
- `app.js`：照片导入、本地草稿、预览缩放、实时视频与音轨导出。
- `scene.css` / `motion.js` / `composition.js`：画面布局、动作参数、暂停 GSAP 时间轴。
- `defaults.js` / `scene-assets.js` / `assets/`：固定配乐、示例照片、机身、胶片盘、字体与本地 GSAP。
- `scripts/build.mjs` / `wrangler.toml`：静态构建与 Cloudflare Pages 配置。

页面包含编辑器界面，并不是可直接交给 HyperFrames 渲染的纯视频入口；网页的视频导出由 Canvas 与 MediaRecorder 完成。

## 开源许可

原创应用代码采用 [MIT](LICENSE) 许可，作者为 [Amateur0x1](https://github.com/Amateur0x1)。示例媒体、字体与第三方库不在 MIT 授权范围内，详见 [素材与第三方说明](THIRD_PARTY_NOTICES.md)。画面 PNG 以 data URL 内嵌在 `scene-assets.js`，确保 `file://` 下导出 Canvas 不会受跨源限制。
