import{d as M,aF as O,m as P,D as j,u as I,p as m,aG as $,aK as z,x as H,b7 as F,k as L,a_ as q,a$ as l,b8 as G,q as A,aZ as S,aW as K,af as Q,o as X,c as Y,a as i,h as V,A as Z,aQ as J,b as r,b9 as ee,L as ae,ar as te,as as se,_ as oe}from"./index-T5w5uREq.js";import{g as c}from"./index-ZORhgBxb.js";const ne=o=>(te("data-v-073c2966"),o=o(),se(),o),le=["height","width"],ie={class:"w-full h-full"},re={class:"flex flex-col items-center justify-around"},ce={class:"flex items-center justify-between w-full my-1"},de=ne(()=>i("span",{class:"mr-1 text-slate-100"},"Heading style",-1)),ge={class:"w-40"};var R=(o=>(o.NORTH_UP="North Up",o.HEAD_UP="Head Up",o))(R||{});const ue=M({__name:"Compass",props:{widget:{}},setup(o){const U=O();P.registerUsage(j.heading);const y=I(),x=m(),d=m(),_=m(),E={0:"N",45:"NE",90:"E",135:"SE",180:"S",225:"SW",270:"W",315:"NW"},T=Object.values(R),n=$(o).widget;z(()=>{Object.keys(n.value.options).length===0&&(n.value.options={headingStyle:T[0]})}),H(()=>{N(),C()});const{width:k,height:W}=F(x),g=L(()=>k.value<W.value?k.value:W.value),C=()=>{if(d.value===void 0||d.value===null)return;_.value===void 0&&(_.value=d.value.getContext("2d"));const e=_.value;q(e);const a=.5*g.value,s=.13*g.value,p=.03*a;e.textAlign="center",e.strokeStyle="white",e.font=`bold ${s}px Arial`,e.fillStyle="white",e.lineWidth=p,e.textBaseline="middle";const v=.7*a,D=.4*a,b=.55*a;e.translate(a,a),e.font=`bold ${s}px Arial`,e.fillText(`${t.yawAngleDegrees.toFixed(0)}°`,.15*s,0),e.rotate(l(-90)),n.value.options.headingStyle=="Head Up"&&e.rotate(l(t.yawAngleDegrees));for(const[w,B]of Object.entries(E))e.save(),e.rotate(l(Number(w))),e.beginPath(),e.moveTo(b,0),e.lineTo(v,0),e.textBaseline="bottom",e.font=`bold ${.7*s}px Arial`,e.translate(v*1.025,0),e.rotate(l(90)),e.fillText(B,0,0),e.stroke(),e.restore();for(const w of G(360))w%9===0&&(e.save(),e.lineWidth=.25*p,e.rotate(l(Number(w))),e.beginPath(),e.moveTo(1.1*b,0),e.lineTo(v,0),e.stroke(),e.restore());e.beginPath(),e.arc(0,0,v,0,l(360)),e.stroke(),n.value.options.headingStyle=="North Up"?e.rotate(l(t.yawAngleDegrees)):e.rotate(-l(t.yawAngleDegrees)),e.beginPath(),e.lineWidth=1,e.strokeStyle="red",e.fillStyle="red";const h=.05*a;e.moveTo(D,h),e.lineTo(b-.5*h,0),e.lineTo(D,-h),e.lineTo(D,h),e.closePath(),e.fill(),e.stroke()},u=m(.01);let f;A(y.attitude,e=>{if(f===void 0){u.value=S(y.attitude.yaw),f=e.yaw;return}Math.abs(S(e.yaw-f))>.1&&(f=e.yaw,u.value=S(y.attitude.yaw))});const t=K({yawAngleDegrees:0}),N=()=>{const e=u.value,a=e<0?e+360:e,s=t.yawAngleDegrees>270&&a<90,p=t.yawAngleDegrees<90&&a>270;s?(c.to(t,.05,{yawAngleDegrees:0}),c.fromTo(t,.05,{yawAngleDegrees:0},{yawAngleDegrees:a})):p?(c.to(t,.05,{yawAngleDegrees:360}),c.fromTo(t,.05,{yawAngleDegrees:360},{yawAngleDegrees:a})):c.to(t,.1,{yawAngleDegrees:a})};return A(u,()=>N()),A(t,()=>{U.isWidgetVisible(n.value)&&Q(()=>C())}),(e,a)=>(X(),Y(ae,null,[i("div",{ref_key:"compassRoot",ref:x,class:"compass"},[i("canvas",{ref_key:"canvasRef",ref:d,height:g.value,width:g.value,class:"rounded-[15%] bg-slate-950/70"},null,8,le)],512),V(ee,{show:r(n).managerVars.configMenuOpen,"onUpdate:show":a[1]||(a[1]=s=>r(n).managerVars.configMenuOpen=s),class:"w-72"},{default:Z(()=>[i("div",ie,[i("div",re,[i("div",ce,[de,i("div",ge,[V(J,{modelValue:r(n).options.headingStyle,"onUpdate:modelValue":a[0]||(a[0]=s=>r(n).options.headingStyle=s),options:r(T)},null,8,["modelValue","options"])])])])])]),_:1},8,["show"])],64))}}),he=oe(ue,[["__scopeId","data-v-073c2966"]]);export{he as default};