"use strict";const e=require("electron");e.contextBridge.exposeInMainWorld("electronAPI",{getInfoOnSubnets:()=>e.ipcRenderer.invoke("get-info-on-subnets")});
