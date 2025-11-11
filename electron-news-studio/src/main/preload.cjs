const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  export: (project) => ipcRenderer.invoke("export", project),
  preview: (project) => ipcRenderer.invoke("preview", project),
  saveProject: (projectData) => ipcRenderer.invoke("save-project", projectData),
  loadProject: () => ipcRenderer.invoke("load-project"),
  onExportProgress: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on("export-progress", listener);
    // Return cleanup function
    return () => ipcRenderer.removeListener("export-progress", listener);
  },
  onPreviewProgress: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on("preview-progress", listener);
    // Return cleanup function
    return () => ipcRenderer.removeListener("preview-progress", listener);
  }
});
