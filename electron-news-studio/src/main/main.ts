import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { createExporter } from "./render/exporter.js";

const isDev = !!process.env.VITE_DEV_SERVER;

let win: BrowserWindow | null = null;

async function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(app.getAppPath(), "dist", "main", "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const devURL = "http://localhost:5173";
  const prodURL = path.join(app.getAppPath(), "dist", "renderer", "index.html");
  if (isDev) {
    await win.loadURL(devURL);
    win.webContents.openDevTools();
  } else {
    await win.loadFile(prodURL);
  }

  const exporter = createExporter();
  ipcMain.handle("export", (_e, project) => exporter.exportProject(project));
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
