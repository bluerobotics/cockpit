import{c as w,a0 as x,r as m,o as C,a1 as V,k as i,D as g,l as r,m as v,q as J,T as F,x as _,G as l,s as c,H as B,v as N,N as d,n as f,a2 as h,a3 as z,Q as D,a4 as I}from"./index-BoF4Ct4_.js";const T={class:"flex items-center justify-center mb-4 flex-col"},j=f("span",{class:"mr-2"},null,-1),A=w({__name:"JoystickCommIndicator",setup(S){const t=x(),o=m(!1),n=m(!1);C(()=>{V.onJoystickUpdate(s=>{p(s)})});const p=s=>{o.value=s.size!==0},k=i(()=>o.value?t.enableForwarding?"text-slate-50":"text-yellow-500":"text-gray-700"),b=i(()=>o.value?t.enableForwarding?"Joystick connected and enabled":"Joystick connected but disabled":"Joystick disconnected"),y=i(()=>t.enableForwarding?"Joystick commands enabled":"Joystick commands paused");return(s,e)=>{const u=g("FontAwesomeIcon");return r(),v("div",null,[J((r(),v("div",{class:_(["relative cursor-pointer",k.value]),onClick:e[0]||(e[0]=a=>n.value=!0)},[l(u,{icon:"fa-solid fa-gamepad",size:"xl"}),!o.value||!c(t).enableForwarding?(r(),B(u,{key:0,icon:"fa-solid fa-slash",size:"xl",class:"absolute left-0"})):N("",!0)],2)),[[F,b.value]]),l(I,{modelValue:n.value,"onUpdate:modelValue":e[3]||(e[3]=a=>n.value=a),title:o.value?"Joystick connected":"Joystick disconnected","max-width":"400px",variant:"text-only"},{content:d(()=>[f("div",T,[j,l(h,{modelValue:c(t).enableForwarding,"onUpdate:modelValue":e[1]||(e[1]=a=>c(t).enableForwarding=a),"hide-details":"",label:y.value,color:"white",disabled:!o.value},null,8,["modelValue","label","disabled"])])]),actions:d(()=>[l(z,{onClick:e[2]||(e[2]=a=>n.value=!1)},{default:d(()=>[D("Close")]),_:1})]),_:1},8,["modelValue","title"])])}}});export{A as default};