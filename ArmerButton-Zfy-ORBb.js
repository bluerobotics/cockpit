import{d as l,u as m,o as c,c as u,a,t as f,b as t,n as p,s as r,e as n,E as o}from"./index-T5w5uREq.js";const g={class:"inline-block font-extrabold align-middle"},h=l({__name:"ArmerButton",setup(b){const e=m(),i=()=>{r(e.arm,{command:"Arm"},n(o.ARM))},d=()=>{r(e.disarm,{command:"Disarm"},n(o.DISARM))};return(x,s)=>(c(),u("button",{class:"relative flex items-center justify-center w-32 p-1 rounded-md shadow-inner h-9 bg-slate-800/60",onClick:s[0]||(s[0]=A=>t(e).isArmed?d():i())},[a("div",{class:p(["absolute top-auto flex items-center px-1 rounded-[4px] shadow transition-all w-[70%] h-[80%]",t(e).isArmed===void 0?"justify-start bg-slate-800/60 text-slate-400 left-[4%]":t(e).isArmed?"bg-red-700 hover:bg-red-800 text-slate-50 justify-end left-[26%]":"bg-green-700 hover:bg-green-800 text-slate-400 justify-start left-[4%]"])},[a("span",g,f(t(e).isArmed===void 0?"...":t(e).isArmed?"Armed":"Disarmed"),1)],2)]))}});export{h as default};