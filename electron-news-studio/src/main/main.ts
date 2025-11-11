import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
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
  ipcMain.handle("export", async (event, project) => {
    return await exporter.exportProject(project, (percent, timemark) => {
      // Send progress update to renderer
      event.sender.send("export-progress", { percent, timemark });
    });
  });

  ipcMain.handle("preview", async (event, project) => {
    return await exporter.generatePreview(project, (percent, timemark) => {
      // Send progress update to renderer
      event.sender.send("preview-progress", { percent, timemark });
    });
  });

  // Save project dialog
  ipcMain.handle("save-project", async (_e, projectData: string) => {
    if (!win) return null;

    const result = await dialog.showSaveDialog(win, {
      title: "Save Project",
      defaultPath: "untitled.nsproj",
      filters: [
        { name: "News Studio Project", extensions: ["nsproj"] },
        { name: "JSON", extensions: ["json"] }
      ]
    });

    if (result.canceled || !result.filePath) return null;

    try {
      await fs.writeFile(result.filePath, projectData, "utf-8");
      return result.filePath;
    } catch (error) {
      console.error("Save error:", error);
      throw error;
    }
  });

  // Load project dialog
  ipcMain.handle("load-project", async (_e) => {
    if (!win) return null;

    const result = await dialog.showOpenDialog(win, {
      title: "Load Project",
      filters: [
        { name: "News Studio Project", extensions: ["nsproj", "json"] }
      ],
      properties: ["openFile"]
    });

    if (result.canceled || !result.filePaths[0]) return null;

    try {
      const data = await fs.readFile(result.filePaths[0], "utf-8");
      return { path: result.filePaths[0], data };
    } catch (error) {
      console.error("Load error:", error);
      throw error;
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
