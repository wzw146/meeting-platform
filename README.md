# 会议进度共享平台

基于 Node.js 的会议流程进度协同工具，支持 Zeabur 一键部署。

## 功能
- 添加会议（名称 + 日期 + 负责人）
- 9 个流程阶段：OA申请 → 协议盖章 → 医信申请 → 会议举办 → 线上材料提交 → 线下材料提交 → 会议打款 → 取回发票 → 会议核销
- 每完成一个阶段点击标记为绿色，自动记录完成日期
- 全部完成后整场会议显示绿色视觉效果
- 可终止会议（红色视觉效果 + 备注）
- 单场会议分享给同事，同事打开独立页面标记进度，实时同步回总表
- 导出 CSV 表格统计所有会议进度

## 部署到 Zeabur

### 方式一：通过 GitHub（推荐）

1. 打开 [zeabur.com](https://zeabur.com)，用 GitHub 登录
2. 点击「新建项目」
3. 选择「部署你的代码」
4. 连接你的 GitHub 仓库（需将本代码推送到 GitHub）
5. 选择仓库，Zeabur 会自动部署
6. 部署完成后，自动生成 `https://xxx.zeabur.app` 固定域名

### 方式二：上传 ZIP

1. 打开 [zeabur.com](https://zeabur.com)，用 GitHub 登录
2. 点击「新建项目」
3. 选择「上传 ZIP」
4. 将本目录打包为 ZIP 上传
5. Zeabur 自动识别 Node.js 项目并部署

### 数据持久化（可选）

如需数据重启后不丢失：
1. 在 Zeabur 项目设置中，添加「持久化存储」
2. 挂载路径设为 `/data`
3. 系统会自动设置 `ZEABUR_VOLUME_DATA` 环境变量

## 本地开发

```bash
npm install
npm start
```

访问 http://localhost:3456

## 技术栈
- **后端**: Node.js + Express + Socket.IO
- **前端**: 原生 HTML/CSS/JS （无需框架）
- **数据**: JSON 文件存储（本地）/ 持久化存储（云端）
