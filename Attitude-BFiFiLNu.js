import{c as te,J as ae,K as oe,M as $,Y as B,u as le,I as se,r as w,av as ie,L as ne,o as re,aw as ue,k as U,ax as k,w as p,ay as V,az as ce,aA as de,aB as b,ap as M,aC as he,l as ve,m as pe,n as y,G as i,N as h,V as ge,O as me,s as o,P as fe,Q as j,R as we,a4 as O,aD as G,aE as Ve,W as be,F as xe,_ as Ce}from"./index-CmwIAKgn.js";import{g as C}from"./index-DjKJqAo0.js";import{V as Fe,a as Te,b as De,c as Pe}from"./VExpansionPanels-BRn5MxS5.js";const Se={class:"main"},Ae=["width","height"],Re={class:"flex justify-center gap-x-8 mb-4"},Le=te({__name:"Attitude",props:{widget:{}},setup(I){const D=ae(),Y=oe();$.registerUsage(B.roll),$.registerUsage(B.pitch);const g=le(),t=se(I).widget,x=w(),P=w(),F=w(0),T=w(0),m=w(void 0),S=[-90,-70,-45,-30,-10,0,10,30,45,70,90],s=ie({rollDegrees:0,pitchLinesHeights:{},cameraTiltDeg:0,pitchDegrees:0}),E=w([["#FFFFFF"],["#FF2D2D"],["#0ADB0ACC"]]),J={showCenterAim:!0,showPitchLines:!0,showRollPitchValues:!0,desiredAimRadius:150,hudColor:E.value[0][0],cameraFOV:64};ne(()=>{Object.entries(J).forEach(([e,a])=>{t.value.options[e]===void 0&&(t.value.options[e]=a)})}),re(()=>{S.forEach(e=>s.pitchLinesHeights[e]=5*e),R()});const{width:K,height:Q}=ue(),r=U(()=>({width:t.value.size.width*K.value,height:t.value.size.height*Q.value})),n=U(()=>k(t.value.options.desiredAimRadius,35,.2*r.value.width));let N,W;p(g.attitude,e=>{const a=Math.abs(V(e.roll-(N||0))),l=Math.abs(V(e.pitch-(W||0)));a>.1&&(N=e.roll,F.value=V(g.attitude.roll)),l>.1&&(W=e.pitch,T.value=V(g.attitude.pitch))}),p(g.genericVariables,e=>{const a=e.cameraTiltDeg;(m.value===void 0||Math.abs(a-m.value)>.1)&&(m.value=a)});const A=e=>{const a=180/t.value.options.cameraFOV;return e/180*a*r.value.height},q=ce(x);p(q,(e,a)=>{e&&!a&&R()});const R=()=>{if(x.value===void 0||x.value===null)return;if(P.value===void 0){console.debug("Canvas context undefined!"),P.value=x.value.getContext("2d");return}const e=P.value;de(e);const a=.5*r.value.width,l=.5*r.value.height,z=12,L=22,f=2;e.textAlign="center",e.strokeStyle="white",e.font=`bold ${z}px Arial`,e.fillStyle="white";const c=2*n.value;e.translate(a,l),e.rotate(b(s.rollDegrees));let v=0;m.value!==void 0&&(v=-A(s.cameraTiltDeg+s.pitchDegrees));for(const[d,u]of Object.entries(s.pitchLinesHeights)){e.beginPath();const X=Number(d)===0?1:.7,Z=Number(d)===0?[]:[5,2],ee=Number(d)===0?3:2;if(e.lineWidth=ee,e.setLineDash(Z),t.value.options.showPitchLines){const H=c+X*(a-c);e.moveTo(-H+f,u),e.lineTo(-c,u),e.lineTo(-c+5,u+15),e.fillText(Number(d),-c-4*f,u-3*f),e.moveTo(+H-f,u),e.lineTo(c,u),e.lineTo(c-5,u+15),e.fillText(Number(d),c+4*f,u-3*f),e.stroke()}}if(e.lineWidth=3,e.setLineDash([]),e.font=`bold ${L}px Arial`,t.value.options.showCenterAim&&(e.beginPath(),e.moveTo(-n.value,v),e.lineTo(-1.5*n.value,v),e.stroke(),e.beginPath(),e.arc(0,v,n.value,b(135),b(225)),e.stroke(),e.beginPath(),e.moveTo(n.value,v),e.lineTo(1.5*n.value,v),e.stroke(),e.beginPath(),e.arc(0,v,n.value,b(-45),b(45)),e.stroke()),t.value.options.showRollPitchValues){const d=`r: ${Number(F.value).toFixed(2)}`,u=`p: ${Number(T.value).toFixed(2)}`;e.rotate(b(-s.rollDegrees)),n.value<200?(e.fillText(d,0,k(-1.5*n.value,-.8*l,0)),e.fillText(u,0,k(1.5*n.value,0,.8*l))):(e.textAlign="start",e.fillText(d,-n.value+L,-30),e.fillText(u,-n.value+L,30)),e.stroke()}e.translate(-a,-l),e.globalCompositeOperation="source-in";const _=e.createLinearGradient(0,0,r.value.width,r.value.height);_.addColorStop(0,t.value.options.hudColor),_.addColorStop(1,t.value.options.hudColor),e.fillStyle=_,e.fillRect(0,0,r.value.width,r.value.height)};return p(T,()=>{S.forEach(e=>{const a=-M(A(e+s.cameraTiltDeg-V(g.attitude.pitch)),2);C.to(s.pitchLinesHeights,.1,{[e]:a})}),C.to(s,.1,{pitchDegrees:T.value})}),p(F,()=>{C.to(s,.1,{rollDegrees:-M(F.value,2)})}),p(m,()=>{C.to(s,.1,{cameraTiltDeg:m.value}),S.forEach(e=>{const a=-M(A(e+s.cameraTiltDeg-V(g.attitude.pitch)),2);C.to(s.pitchLinesHeights,.1,{[e]:a})})}),p([s,r,t.value.options],()=>{D.isWidgetVisible(t.value)&&he(()=>R())}),(e,a)=>(ve(),pe(xe,null,[y("div",Se,[y("canvas",{ref_key:"canvasRef",ref:x,width:r.value.width,height:r.value.height},null,8,Ae)]),i(be,{modelValue:o(D).widgetManagerVars(o(t).hash).configMenuOpen,"onUpdate:modelValue":a[6]||(a[6]=l=>o(D).widgetManagerVars(o(t).hash).configMenuOpen=l),"min-width":"400","max-width":"45%"},{default:h(()=>[i(ge,{class:"pa-4",style:me([o(Y).globalGlassMenuStyles,{"border-radius":"15px"}])},{default:h(()=>[i(fe,{class:"text-center"},{default:h(()=>[j("Attitude widget config")]),_:1}),i(we,null,{default:h(()=>[y("div",Re,[i(O,{class:"ma-1",label:"Show roll/pitch values","model-value":o(t).options.showRollPitchValues,color:o(t).options.showRollPitchValues?"white":void 0,"hide-details":"",onChange:a[0]||(a[0]=l=>o(t).options.showRollPitchValues=!o(t).options.showRollPitchValues)},null,8,["model-value","color"]),i(O,{class:"ma-1",label:"Show center aim","model-value":o(t).options.showCenterAim,color:o(t).options.showCenterAim?"white":void 0,"hide-details":"",onChange:a[1]||(a[1]=l=>o(t).options.showCenterAim=!o(t).options.showCenterAim)},null,8,["model-value","color"]),i(O,{class:"ma-1",label:"Show pitch lines","model-value":o(t).options.showPitchLines,color:o(t).options.showPitchLines?"white":void 0,"hide-details":"",onChange:a[2]||(a[2]=l=>o(t).options.showPitchLines=!o(t).options.showPitchLines)},null,8,["model-value","color"])]),i(G,{modelValue:o(t).options.cameraFOV,"onUpdate:modelValue":a[3]||(a[3]=l=>o(t).options.cameraFOV=l),color:"white",label:"Camera vertical FOV",min:20,max:180,"thumb-label":""},null,8,["modelValue"]),i(G,{modelValue:o(t).options.desiredAimRadius,"onUpdate:modelValue":a[4]||(a[4]=l=>o(t).options.desiredAimRadius=l),label:"Center circle radius",color:"white",min:10,max:300,"thumb-label":""},null,8,["modelValue"]),i(Fe,{theme:"dark"},{default:h(()=>[i(Te,{class:"bg-[#FFFFFF22]"},{default:h(()=>[i(De,null,{default:h(()=>[j("Color")]),_:1}),i(Pe,{class:"pa-2"},{default:h(()=>[i(Ve,{modelValue:o(t).options.hudColor,"onUpdate:modelValue":a[5]||(a[5]=l=>o(t).options.hudColor=l),class:"ma-1 bg-[#FFFFFF11] text-white",swatches:E.value,"show-swatches":"",width:"100%"},null,8,["modelValue","swatches"])]),_:1})]),_:1})]),_:1})]),_:1})]),_:1},8,["style"])]),_:1},8,["modelValue"])],64))}}),Oe=Ce(Le,[["__scopeId","data-v-64737875"]]);export{Oe as default};