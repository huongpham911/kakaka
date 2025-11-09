const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  export: (project) => ipcRenderer.invoke("export", project),
  saveProject: (projectData) => ipcRenderer.invoke("save-project", projectData),
  loadProject: () => ipcRenderer.invoke("load-project")
});
