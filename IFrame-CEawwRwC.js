import{c as L,b9 as T,J as $,X as B,Z as O,r as d,a1 as j,ba as b,at as z,k as _,w as A,l as S,m as N,n as p,H as W,q as x,aN as D,s as n,a8 as y,ak as G,G as t,Q as i,ag as H,ah as K,S as k,ai as F,aj as q,bb as E,R as M,T as J,aA as P,bc as Q,aa as X,bd as Z,F as Y,be as ee,ac as ae,ad as te,_ as se}from"./index-wQ7i2K1-.js";const le=r=>(ae("data-v-2823bce5"),r=r(),te(),r),oe={class:"w-full h-full"},ne=["src"],ie=le(()=>p("p",null,"Iframe Source",-1)),ue={class:"flex items-center justify-between"},re=L({__name:"IFrame",props:{widget:{}},setup(r){T(e=>({"6f56b4ce":R.value}));const U=$(),u=B(),a=O(r).widget,g=d(!1),f=d(0),l=d(a.value.options.source),c=d(!1),v=d(""),m=e=>ee(e)?!0:"URL is not valid.",w=()=>{const e=m(l.value);if(e!==!0){v.value=`${e} Please enter a valid URL.`,c.value=!0;return}a.value.options.source=l.value,v.value=`IFrame URL sucessfully updated to '${l.value}'.`,c.value=!0};j(()=>{Object.keys(a.value.options).length===0&&(a.value.options={source:b},l.value=b)});const{width:h,height:V}=z(),C=_(()=>{let e="";return e=e.concat(" ","position: absolute;"),e=e.concat(" ",`left: ${a.value.position.x*h.value}px;`),e=e.concat(" ",`top: ${a.value.position.y*V.value}px;`),e=e.concat(" ",`width: ${a.value.size.width*h.value}px;`),e=e.concat(" ",`height: ${a.value.size.height*V.value}px;`),u.editingMode&&(e=e.concat(" ","pointer-events:none; border:0;")),u.isWidgetVisible(a.value)||(e=e.concat(" ","display: none;")),e}),R=_(()=>(100-f.value)/100);function I(){console.log("Finished loading"),g.value=!0}return A(a,()=>{u.widgetManagerVars(a.value.hash).configMenuOpen===!1&&m(l.value)!==!0&&(l.value=a.value.options.source)},{deep:!0}),(e,s)=>(S(),N(Y,null,[p("div",oe,[(S(),W(G,{to:".widgets-view"},[x(p("iframe",{src:n(a).options.source,style:y(C.value),frameborder:"0",onLoad:I},null,44,ne),[[D,g.value]])])),t(X,{modelValue:n(u).widgetManagerVars(n(a).hash).configMenuOpen,"onUpdate:modelValue":s[3]||(s[3]=o=>n(u).widgetManagerVars(n(a).hash).configMenuOpen=o),"min-width":"400","max-width":"35%"},{default:i(()=>[t(H,{class:"pa-2",style:y(n(U).globalGlassMenuStyles)},{default:i(()=>[t(K,{class:"text-center"},{default:i(()=>[k("Settings")]),_:1}),t(F,null,{default:i(()=>[ie,p("div",ue,[t(q,{modelValue:l.value,"onUpdate:modelValue":s[0]||(s[0]=o=>l.value=o),variant:"filled",outlined:"",rules:[m],onKeydown:E(w,["enter"])},null,8,["modelValue","rules"]),x(t(M,{icon:"mdi-check",class:"mx-1 mb-5 bg-[#FFFFFF22]",rounded:"lg",flat:"",onClick:w},null,512),[[J,"Set",void 0,{bottom:!0}]])])]),_:1}),t(F,null,{default:i(()=>[t(P,{modelValue:f.value,"onUpdate:modelValue":s[1]||(s[1]=o=>f.value=o),label:"Transparency",color:"white",min:0,max:90},null,8,["modelValue"])]),_:1}),t(Q,{class:"flex justify-end"},{default:i(()=>[t(M,{color:"white",onClick:s[2]||(s[2]=o=>n(u).widgetManagerVars(n(a).hash).configMenuOpen=!1)},{default:i(()=>[k(" Close ")]),_:1})]),_:1})]),_:1},8,["style"])]),_:1},8,["modelValue"])]),t(Z,{"open-snackbar":c.value,message:v.value,duration:3e3,"close-button":!1,"onUpdate:openSnackbar":s[4]||(s[4]=o=>c.value=o)},null,8,["open-snackbar","message"])],64))}}),pe=se(re,[["__scopeId","data-v-2823bce5"]]);export{pe as default};