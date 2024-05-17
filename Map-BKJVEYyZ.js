import{be as ve,bf as ye,bg as Me,bh as $,bi as Te,bj as te,bk as ke,bl as xe,d as we,bb as Ie,aG as Ae,u as Se,bm as Ve,p as g,k as N,m as ae,D as ne,aK as Oe,bn as m,x as Ce,bo as y,ai as Ee,q as M,bp as De,aZ as _e,v as Ne,bq as ie,aW as He,aF as Le,f as Re,o as q,c as se,a as z,w as le,h as w,n as re,b as p,ak as C,N as F,an as Pe,j as ue,A as U,V as $e,B as ze,G as Fe,C as Ue,b0 as Be,O as Xe,i as We,aa as Ye,L as Ge,s as Ze,e as je,E as qe,aM as ce}from"./index-T5w5uREq.js";function me(i,v){if(i==null)throw new TypeError("assign requires that input parameter not be null or undefined");for(var s in v)Object.prototype.hasOwnProperty.call(v,s)&&(i[s]=v[s]);return i}function Ke(i){return me({},i)}var de=1440,Je=2520,K=43200,Qe=86400;function eo(i,v,s){var r,f;ve(2,arguments);var t=xe(),l=(r=(f=s==null?void 0:s.locale)!==null&&f!==void 0?f:t.locale)!==null&&r!==void 0?r:ye;if(!l.formatDistance)throw new RangeError("locale must contain formatDistance property");var b=Me(i,v);if(isNaN(b))throw new RangeError("Invalid time value");var n=me(Ke(s),{addSuffix:!!(s!=null&&s.addSuffix),comparison:b}),I,A;b>0?(I=$(v),A=$(i)):(I=$(i),A=$(v));var T=Te(A,I),B=(te(A)-te(I))/1e3,c=Math.round((T-B)/60),d;if(c<2)return s!=null&&s.includeSeconds?T<5?l.formatDistance("lessThanXSeconds",5,n):T<10?l.formatDistance("lessThanXSeconds",10,n):T<20?l.formatDistance("lessThanXSeconds",20,n):T<40?l.formatDistance("halfAMinute",0,n):T<60?l.formatDistance("lessThanXMinutes",1,n):l.formatDistance("xMinutes",1,n):c===0?l.formatDistance("lessThanXMinutes",1,n):l.formatDistance("xMinutes",c,n);if(c<45)return l.formatDistance("xMinutes",c,n);if(c<90)return l.formatDistance("aboutXHours",1,n);if(c<de){var h=Math.round(c/60);return l.formatDistance("aboutXHours",h,n)}else{if(c<Je)return l.formatDistance("xDays",1,n);if(c<K){var _=Math.round(c/de);return l.formatDistance("xDays",_,n)}else if(c<Qe)return d=Math.round(c/K),l.formatDistance("aboutXMonths",d,n)}if(d=ke(A,I),d<12){var H=Math.round(c/K);return l.formatDistance("xMonths",H,n)}else{var L=d%12,E=Math.floor(d/12);return L<3?l.formatDistance("aboutXYears",E,n):L<9?l.formatDistance("overXYears",E,n):l.formatDistance("almostXYears",E+1,n)}}function oo(i,v){return ve(1,arguments),eo(i,Date.now(),v)}(function(i){let v;if(typeof define=="function"&&define.amd)define(["leaflet"],i);else if(typeof module=="object"&&typeof module.exports=="object")v=require("leaflet"),module.exports=i(v);else{if(typeof window.L>"u")throw"Leaflet must be loaded first";i(window.L)}})(function(i){const v=i.Marker.prototype._initIcon,s=i.Marker.prototype._setPos,r=i.DomUtil.TRANSFORM==="msTransform";i.Marker.addInitHook(function(){let t=this.options.icon&&this.options.icon.options&&this.options.icon.options.iconAnchor;t&&(t=t[0]+"px "+t[1]+"px"),this.options.rotationOrigin=this.options.rotationOrigin||t||"center bottom",this.options.rotationAngle=this.options.rotationAngle||0,this.on("drag",function(l){l.target._applyRotation()})}),i.Marker.include({_initIcon:function(){v.call(this)},_setPos:function(f){s.call(this,f),this._applyRotation()},_applyRotation:function(){this.options.rotationAngle&&(this._icon.style[i.DomUtil.TRANSFORM+"Origin"]=this.options.rotationOrigin,r?this._icon.style[i.DomUtil.TRANSFORM]="rotate("+this.options.rotationAngle+"deg)":this._icon.style[i.DomUtil.TRANSFORM]+=" rotateZ("+this.options.rotationAngle+"deg)")},setRotationAngle:function(f){return this.options.rotationAngle=f,this.update(),this},setRotationOrigin:function(f){return this.options.rotationOrigin=f,this.update(),this}})});const to={class:"page-base"},ao=["id"],io=we({__name:"Map",props:{widget:{}},setup(i){var oe;Ie(e=>({"68a9b1f7":be.value}));const v=i,s=Ae(v).widget,r=Se(),f=Ve(),t=g(),l=g(15),b=g([-27.5935,-48.55854]),n=g(b.value),I=N(()=>`map-${s.value.hash}`);ae.registerUsage(ne.latitude),ae.registerUsage(ne.longitude),Oe(()=>{Object.keys(s.value.options).length===0&&(s.value.options={showVehiclePath:!0}),d.enableAutoUpdate()});const A=m.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap"}),T=m.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:19,attribution:"© Esri World Imagery"}),B={OpenStreetMap:A,"Esri World Imagery":T};Ce(async()=>{t.value=m.map(I.value,{layers:[A,T]}).setView(b.value,l.value),t.value.zoomControl.setPosition("bottomright"),t.value.on("moveend",()=>{if(t.value===void 0)return;let{lat:o,lng:a}=t.value.getCenter();o&&a&&(b.value=[o,a])}),t.value.on("zoomend",()=>{var o;t.value!==void 0&&(l.value=((o=t.value)==null?void 0:o.getZoom())??b.value)}),t.value.on("click",()=>{t.value!==void 0&&t.value.on("click",J)}),t.value.on("contextmenu",()=>{Q()});const e=m.control.layers(B);t.value.addControl(e),d.enableAutoUpdate(),window.addEventListener("keydown",ee),d.goToTarget(y.HOME)}),Ee(()=>{d.disableAutoUpdate(),window.removeEventListener("keydown",ee),t.value&&(t.value.off("click",J),t.value.off("contextmenu"))}),M(b,(e,o)=>{var a,u,S;e.toString()!==o.toString()&&((a=t.value)==null||a.panTo(e),(S=(u=V.value)==null?void 0:u.getTooltip())==null||S.setContent(`Home: ${e[0].toFixed(6)}, ${e[1].toFixed(6)}`))}),M(t,(e,o)=>{t.value!==void 0&&(e==null?void 0:e.options)===void 0&&(t.value=o)}),M(l,(e,o)=>{var a;e!==o&&((a=t.value)==null||a.setZoom(l.value))}),M(v.widget,()=>{var e;(e=t.value)==null||e.invalidateSize()});const c=g(void 0),d=new De(e=>c.value=e,e=>b.value=e);d.setTrackableTarget(y.VEHICLE,()=>h.value),d.setTrackableTarget(y.HOME,()=>n.value);const h=N(()=>r.coordinates.latitude?[r.coordinates.latitude,r.coordinates.longitude]:void 0),_=N(()=>{var e;return r.attitude.yaw?_e((e=r.attitude)==null?void 0:e.yaw):0}),H=N(()=>{const e=r.lastHeartbeat;return e?`${oo(e??0,{includeSeconds:!0})} ago`:"never"}),{history:L}=Ne(h);(oe=navigator==null?void 0:navigator.geolocation)==null||oe.watchPosition(e=>n.value=[e.coords.latitude,e.coords.longitude],e=>console.error(`Failed to get position: (${e.code}) ${e.message}`),{enableHighAccuracy:!1,timeout:5e3,maximumAge:0});let E=!0;M([n,t],async()=>{n.value===b.value||!t.value||!E||(d.goToTarget(y.HOME),E=!1)});const k=g();M(r.coordinates,()=>{if(!(!t.value||!h.value)){if(k.value===void 0){k.value=m.marker(h.value);let e="/src/assets/generic-vehicle-marker.png";r.vehicleType===ie.MAV_TYPE_SURFACE_BOAT?e="/src/assets/blueboat-marker.png":r.vehicleType===ie.MAV_TYPE_SUBMARINE&&(e="/src/assets/brov2-marker.png");const o=new m.Icon({iconUrl:e,iconSize:[64,64],iconAnchor:[32,32]});k.value.setIcon(o);const a=m.tooltip({content:"No data available",className:"waypoint-tooltip"});k.value.bindTooltip(a),t.value.addLayer(k.value)}k.value.setLatLng(h.value)}}),M([h,_,H,()=>r.isArmed],()=>{var e,o,a,u;k.value!==void 0&&((u=k.value.getTooltip())==null||u.setContent(`
    <p>Coordinates: ${(e=h.value)==null?void 0:e[0].toFixed(6)}, ${(o=h.value)==null?void 0:o[1].toFixed(6)}</p>
    <p>Velocity: ${((a=r.velocity.ground)==null?void 0:a.toFixed(2))??"N/A"} m/s</p>
    <p>Heading: ${_.value.toFixed(2)}°</p>
    <p>${r.isArmed?"Armed":"Disarmed"}</p>
    <p>Last seen: ${H.value}</p>
  `),k.value.setRotationAngle(_.value))});const V=g();M(n,()=>{if(t.value===void 0)return;const e=n.value;if(e!==void 0){if(V.value===void 0){V.value=m.marker(e);const o=m.divIcon({className:"marker-icon",iconSize:[32,32],iconAnchor:[16,16],html:"H"});V.value.setIcon(o);const a=m.tooltip({content:"No data available",className:"waypoint-tooltip"});V.value.bindTooltip(a),t.value.addLayer(V.value)}V.value.setLatLng(n.value)}});const X=g();M(f.currentPlanningWaypoints,e=>{if(t.value!==void 0){if(X.value===void 0){const o=e.map(a=>a.coordinates);X.value=m.polyline(o,{color:"#358AC3"}).addTo(t.value)}X.value.setLatLngs(e.map(o=>o.coordinates)),e.forEach((o,a)=>{var x;const u=m.marker(o.coordinates),S=m.divIcon({className:"marker-icon",iconSize:[32,32],iconAnchor:[16,16],html:`${a}`});u.setIcon(S),(x=t.value)==null||x.addLayer(u)})}});const W=g();M(L,e=>{if(t.value===void 0||e===void 0)return;W.value===void 0&&(W.value=m.polyline([],{color:"#358AC3"}).addTo(t.value));const o=e.filter(a=>a.snapshot!==void 0).map(a=>a.snapshot);W.value.setLatLngs(o)});const R=g(!1),D=g(null),P=He({top:"0px",left:"0px"}),O=g(),J=e=>{var o,a,u,S;if(O.value!==void 0&&t.value!==void 0&&((o=O.value)==null||o.removeFrom(t.value)),((a=e==null?void 0:e.latlng)==null?void 0:a.lat)!=null&&((u=e==null?void 0:e.latlng)==null?void 0:u.lng)!=null){D.value=[e.latlng.lat,e.latlng.lng],R.value=!0;const x=(S=t.value)==null?void 0:S.getContainer();if(x){const{x:Z,y:j}=x.getBoundingClientRect();P.left=`${e.originalEvent.clientX-Z}px`,P.top=`${e.originalEvent.clientY-j}px`}}else console.error("Invalid event structure:",e);if(t.value!==void 0){O.value=m.marker(D.value);const x=m.divIcon({className:"marker-icon",iconSize:[32,32],iconAnchor:[16,16]});O.value.setIcon(x),t.value.addLayer(O.value)}},fe=e=>{switch(console.debug(`Map context menu option selected: ${e}.`),e){case"goto":if(D.value){const x=r.coordinates.altitude??0,Z=D.value[0],j=D.value[1];Ze(()=>{r.goTo(0,0,0,0,Z,j,x)},{command:"GoTo"},je(qe.GOTO))}break;default:console.warn("Unknown menu option selected:",e)}R.value=!1},Q=()=>{R.value=!1,D.value=null,t.value!==void 0&&O.value!==void 0&&t.value.removeLayer(O.value)},ee=e=>{e.key==="Escape"&&Q()},Y=g(!1),G=g(0),pe=async()=>{for(Y.value=!0,G.value=0;f.currentPlanningWaypoints.length>0;)f.currentPlanningWaypoints.pop();const e=async o=>{G.value=o};try{(await r.fetchMission(e)).forEach(a=>{f.currentPlanningWaypoints.push(a),ce.fire({icon:"success",title:"Mission download succeed!",timer:2e3})})}catch(o){ce.fire({icon:"error",title:"Mission download failed",text:o,timer:5e3})}finally{Y.value=!1}},ge=()=>{r.startMission()},he=Le(),be=N(()=>`${he.widgetBottomClearanceForVisibleArea(s.value)}px`);return(e,o)=>{const a=Re("tooltip");return q(),se(Ge,null,[z("div",to,[z("div",{id:I.value,ref_key:"map",ref:t,class:"map"},[le(w(F,{class:re(["absolute left-0 m-3 bottom-button bg-slate-50",n.value?"":"active-events-on-disabled"]),color:c.value==p(y).HOME?"red":"",elevation:"2",style:{"z-index":"1002","border-radius":"0px"},icon:"mdi-home-map-marker",size:"x-small",disabled:!n.value,onClick:o[0]||(o[0]=C(u=>p(d).goToTarget(p(y).HOME,!0),["stop"])),onDblclick:o[1]||(o[1]=C(u=>p(d).follow(p(y).HOME),["stop"]))},null,8,["class","color","disabled"]),[[a,n.value?void 0:"Home position is currently undefined"]]),le(w(F,{class:re(["absolute m-3 bottom-button left-10 bg-slate-50",h.value?"":"active-events-on-disabled"]),color:c.value==p(y).VEHICLE?"red":"",elevation:"2",style:{"z-index":"1002","border-radius":"0px"},icon:"mdi-airplane-marker",size:"x-small",disabled:!h.value,onClick:o[2]||(o[2]=C(u=>p(d).goToTarget(p(y).VEHICLE,!0),["stop"])),onDblclick:o[3]||(o[3]=C(u=>p(d).follow(p(y).VEHICLE),["stop"]))},null,8,["class","color","disabled"]),[[a,h.value?void 0:"Vehicle position is currently undefined"]]),w(F,{class:"absolute m-3 bottom-button left-20 bg-slate-50",elevation:"2",style:{"z-index":"1002","border-radius":"0px"},icon:"mdi-download",size:"x-small",onClick:C(pe,["stop"])}),w(F,{class:"absolute mb-3 ml-1 bottom-button left-32 bg-slate-50",elevation:"2",style:{"z-index":"1002","border-radius":"0px"},icon:"mdi-play",size:"x-small",onClick:C(ge,["stop"])})],8,ao)]),R.value?(q(),se("div",{key:0,class:"context-menu",style:Pe({top:P.top,left:P.left})},[z("ul",{onClick:o[5]||(o[5]=C(()=>{},["stop"]))},[z("li",{onClick:o[4]||(o[4]=u=>fe("goto"))},"GoTo")])],4)):ue("",!0),w(Xe,{modelValue:p(s).managerVars.configMenuOpen,"onUpdate:modelValue":o[7]||(o[7]=u=>p(s).managerVars.configMenuOpen=u),width:"auto"},{default:U(()=>[w($e,{class:"pa-2"},{default:U(()=>[w(ze,null,{default:U(()=>[Fe("Map widget settings")]),_:1}),w(Ue,null,{default:U(()=>[w(Be,{modelValue:p(s).options.showVehiclePath,"onUpdate:modelValue":o[6]||(o[6]=u=>p(s).options.showVehiclePath=u),class:"my-1",label:"Show vehicle path",color:p(s).options.showVehiclePath?"rgb(0, 20, 80)":void 0,"hide-details":""},null,8,["modelValue","color"])]),_:1})]),_:1})]),_:1},8,["modelValue"]),Y.value?(q(),We(Ye,{key:1,"model-value":G.value,height:"10",absolute:"",bottom:"",color:"#358AC3"},null,8,["model-value"])):ue("",!0)],64)}}});export{io as default};