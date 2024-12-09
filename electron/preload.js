"use strict";const e=require("electron");e.contextBridge.exposeInMainWorld("electronAPI",{getNetworkInfo:()=>e.ipcRenderer.invoke("get-network-info")});
