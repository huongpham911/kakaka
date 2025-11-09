const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  export: (project) => ipcRenderer.invoke("export", project)
});
