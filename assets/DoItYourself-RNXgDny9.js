import{aK as Ee,aL as Be,aM as ge,aN as ze,aO as Ae,aP as Je,aQ as Ke,aR as Q,aS as me,aT as He,aU as qe,aV as Ge,aW as Qe,aX as Ze,aY as Xe,aZ as he,a_ as et,a$ as tt,b0 as at,b1 as ye,b2 as st,b3 as it,b4 as nt,b5 as ot,b6 as rt,d as lt,b7 as ct,h as ve,b8 as dt,a as ut,u as pt,Z as ft,b9 as gt,t as mt,r as U,ap as be,o as ht,$ as yt,a0 as vt,v as ke,x as we,y,z as p,B as z,C as l,A as m,V as bt,a4 as J,F as C,E as kt,G as b,aa as d,H as wt,ba as Ct,a2 as St,N as It,O as oe,P as re,Q as le,bb as ce,bc as Vt,ay as xt,ab as Y,S as Dt,T as Et,bd as At,be as Lt,bf as _t,bg as N,bh as Z,bi as jt,_ as Ot}from"./index-C1NCPr-t.js";const Le="cockpit-diy-widget",Tt=(t,u)=>`
(() => {
  const frameId = ${JSON.stringify(t)}
  const post = (message) => window.parent.postMessage({ channel: '${Le}', frameId, ...message }, '*')
  // Every new document, however the frame came to reload, starts by saying so, ahead of any request.
  post({ type: 'hello' })
  const listeners = new Map()
  let lastId = 0
  // Cockpit's reads are synchronous, so the frame answers them from a cache Cockpit fills on load and keeps current.
  const canonical = (id) => String(id).replace(/^\\/+/, '')
  const values = new Map()
  const writtenIds = new Map()
  const timestamps = new Map()
  let infos = {}
  const actions = {}
  const actionCallbacks = new Map()
  const storageItems = new Map()
  // Keys this document wrote are its own, so a refresh from Cockpit that raced the write does not undo it.
  const storageWrites = new Set()
  // Cockpit sends times since the epoch, which this frame turns back into its own performance.now() clock.
  const frameClock = (timestamp) => (timestamp === undefined ? undefined : timestamp - performance.timeOrigin)
  const applyValues = (state) => {
    Object.entries(state.values).forEach(([id, value]) => {
      values.set(canonical(id), value)
      writtenIds.set(canonical(id), id)
    })
    Object.entries(state.timestamps).forEach(([id, timestamp]) => timestamps.set(canonical(id), frameClock(timestamp)))
  }
  const applyState = (state) => {
    infos = state.infos
    applyValues(state)
    Object.keys(actions).forEach((id) => delete actions[id])
    Object.assign(actions, state.actions)
    ;[...storageItems.keys()].filter((key) => !storageWrites.has(key) && !(key in state.storage)).forEach((key) => storageItems.delete(key))
    Object.entries(state.storage).forEach(([key, value]) => storageWrites.has(key) || storageItems.set(key, value))
  }
  applyState(${JSON.stringify(u).replace(/</g,"\\u003c")})
  const watched = new Map()
  let listing = false
  let refreshing = false
  const watch = (variableId, withTimestamp) => {
    const id = canonical(variableId)
    const current = watched.get(id)
    if (current === true || current === withTimestamp) return
    const listenerId = 'cache:' + id
    if (current !== undefined) post({ type: 'unlisten', listenerId })
    watched.set(id, withTimestamp)
    listeners.set(listenerId, (value, timestamp) => {
      values.set(id, value)
      timestamps.set(id, frameClock(timestamp))
    })
    post({ type: 'listen', variableId: id, listenerId, notifyOnTimestampChange: withTimestamp })
  }
  const reportError = (error) => post({ type: 'error', message: String(error) })
  window.addEventListener('message', (event) => {
    if (event.source !== window.parent) return
    const message = event.data
    if (message.type === 'value') listeners.get(message.listenerId)?.(message.value, message.timestamp)
    if (message.type === 'restore') values.set(canonical(message.variableId), message.value)
    if (message.type === 'storageRestore') {
      if (message.value === null) storageItems.delete(message.key)
      else storageItems.set(message.key, message.value)
    }
    if (message.type === 'infos') infos = message.infos
    if (message.type === 'actions') {
      Object.keys(actions).forEach((id) => delete actions[id])
      Object.assign(actions, message.actions)
    }
    if (message.type === 'snapshot' || message.type === 'values') refreshing = false
    if (message.type === 'snapshot') applyState(message)
    if (message.type === 'values') applyValues(message)
    if (message.type === 'fonts') {
      message.fonts.forEach(({ family, source, descriptors }) => document.fonts.add(new FontFace(family, source, descriptors)))
    }
    if (message.type === 'runAction') {
      const callback = actionCallbacks.get(message.actionId)
      if (callback) Promise.resolve().then(callback).catch(reportError)
    }
  })
  window.addEventListener('error', (event) => reportError(event.error ?? event.message))
  window.addEventListener('unhandledrejection', (event) => reportError(event.reason))
  const getDataLakeVariableData = (variableId) => {
    watch(variableId, false)
    return values.get(canonical(variableId))
  }
  const setDataLakeVariableData = (variableId, value) => {
    // Watching first makes Cockpit's answer to the write reach the cache, after the value the frame assumed.
    watch(variableId, false)
    values.set(canonical(variableId), value)
    post({ type: 'set', variableId, value })
  }
  // ponytail: listing answers from the cache, refreshed once per listing, rather than watching every variable, which
  // would post each MAVLink update to the frame until it reloads; reads made in the same turn as the listing are one
  // refresh behind, and listing every frame sends the whole lake each time, bounded to one refresh in flight.
  const listVariables = () => {
    if (!listing) {
      listing = true
      queueMicrotask(() => {
        listing = false
      })
    }
    if (!refreshing) {
      refreshing = true
      post({ type: 'refresh' })
    }
    return [...values.keys()].map((id) => writtenIds.get(id) ?? id)
  }
  const variableKey = (key) => (typeof key === 'string' ? writtenIds.get(canonical(key)) ?? key : undefined)
  // Cockpit's own dataLakeVariableData is a live object, which this one stands in for over the frame's cache.
  const dataLakeVariableData = new Proxy({}, {
    get: (_target, key) => {
      // JSON.stringify and await probe these on any object, which is no reason to watch a variable by that name.
      if (typeof key !== 'string' || key === 'toJSON' || key === 'then') return undefined
      return listing ? values.get(canonical(key)) : getDataLakeVariableData(key)
    },
    set: (_target, key, value) => {
      if (typeof key === 'string') setDataLakeVariableData(key, value)
      return true
    },
    has: (_target, key) => typeof key === 'string' && values.has(canonical(key)),
    ownKeys: listVariables,
    getOwnPropertyDescriptor: (_target, key) => {
      const id = variableKey(key)
      return id !== undefined && values.has(canonical(id))
        ? { value: values.get(canonical(id)), enumerable: true, configurable: true, writable: true }
        : undefined
    },
  })
  const storageSize = () => [...storageItems].reduce((size, [key, value]) => size + key.length + value.length, 0)
  const makeStorage = (items, persist) => {
    const api = {
      getItem: (key) => items.get(String(key)) ?? null,
      setItem: (key, value) => {
        key = String(key)
        value = String(value)
        const previous = items.get(key)
        items.set(key, value)
        if (persist && storageSize() > ${ze}) {
          if (previous === undefined) items.delete(key)
          else items.set(key, previous)
          throw new DOMException('The widget storage is full', 'QuotaExceededError')
        }
        if (persist) {
          storageWrites.add(key)
          post({ type: 'storageSet', key, value })
        }
      },
      removeItem: (key) => {
        key = String(key)
        items.delete(key)
        if (persist) {
          storageWrites.add(key)
          post({ type: 'storageRemove', key })
        }
      },
      clear: () => {
        items.forEach((_value, key) => persist && storageWrites.add(key))
        items.clear()
        if (persist) post({ type: 'storageClear' })
      },
      key: (index) => [...items.keys()][index] ?? null,
      get length() {
        return items.size
      },
    }
    return new Proxy(api, {
      get: (target, key) => (key in target ? target[key] : typeof key === 'string' ? items.get(key) : undefined),
      set: (target, key, value) => {
        if (typeof key === 'string' && !(key in target)) target.setItem(key, value)
        return true
      },
      deleteProperty: (target, key) => {
        if (typeof key === 'string') target.removeItem(key)
        return true
      },
      has: (target, key) => key in target || items.has(key),
      ownKeys: () => [...items.keys()],
      getOwnPropertyDescriptor: (_target, key) =>
        items.has(key) ? { value: items.get(key), enumerable: true, configurable: true, writable: true } : undefined,
    })
  }
  // An opaque-origin frame has no storage of its own, so the widget's localStorage lives in Cockpit, per widget.
  Object.defineProperty(window, 'localStorage', { value: makeStorage(storageItems, true), configurable: true })
  Object.defineProperty(window, 'sessionStorage', { value: makeStorage(new Map(), false), configurable: true })
  window.cockpit = {
    dataLakeVariableData,
    listenDataLakeVariable: (variableId, callback, options) => {
      const listenerId = String(++lastId)
      listeners.set(listenerId, (value) => callback(value))
      post({ type: 'listen', variableId, listenerId, notifyOnTimestampChange: options?.notifyOnTimestampChange === true })
      return listenerId
    },
    unlistenDataLakeVariable: (variableId, listenerId) => {
      listeners.delete(listenerId)
      post({ type: 'unlisten', listenerId })
    },
    getDataLakeVariableData,
    getDataLakeVariableInfo: (variableId) => Object.values(infos).find((info) => canonical(info.id) === canonical(variableId)),
    getAllDataLakeVariablesInfo: () => ({ ...infos }),
    getDataLakeVariableLastUpdateTimestamp: (variableId) => {
      watch(variableId, true)
      return timestamps.get(canonical(variableId))
    },
    setDataLakeVariableData,
    createDataLakeVariable: (variable, initialValue) => post({ type: 'create', variable, initialValue }),
    updateDataLakeVariableInfo: (variable) => post({ type: 'updateInfo', variable }),
    deleteDataLakeVariable: (variableId) => post({ type: 'delete', variableId }),
    availableCockpitActions: actions,
    registerNewAction: (action) => {
      actions[action.id] = { id: action.id, name: action.name }
      post({ type: 'registerAction', actionId: action.id, name: action.name })
    },
    deleteAction: (actionId) => {
      delete actions[actionId]
      actionCallbacks.delete(actionId)
      post({ type: 'deleteAction', actionId })
    },
    registerActionCallback: (action, callback) => {
      actionCallbacks.set(action.id, callback)
      post({ type: 'registerCallback', actionId: action.id })
      return action.id
    },
    unregisterActionCallback: (actionId) => {
      actionCallbacks.delete(actionId)
      post({ type: 'unregisterCallback', actionId })
    },
    executeActionCallback: (actionId) => post({ type: 'action', actionId }),
    onCleanup: () => undefined,
    setInterval: window.setInterval.bind(window),
    setTimeout: window.setTimeout.bind(window),
  }
  // The sandbox silently skips these dialogs, so a confirm would read as a refusal.
  ;['alert', 'confirm', 'prompt'].forEach((name) => {
    window[name] = () => { throw new Error(name + ' is not available to DIY widgets, which run isolated from Cockpit') }
  })
})()
`,Mt="html, body { margin: 0; width: 100%; height: 100%; background: transparent; color: white; font-family: 'Roboto', sans-serif; }",Ce=t=>t.replace(/<\/(script)/gi,"<\\/$1"),$t=t=>`(function (root, cockpit) {
${t}
})(document.body, window.cockpit)`,_e=t=>t.replace(/<\/(style)/gi,"<\\/$1"),je=t=>{try{return Array.from(t.cssRules)}catch{return}};let K,H;const Ut=()=>{if((K==null?void 0:K[0])===document.styleSheets.length)return K[1];const t=Array.from(document.styleSheets).map(u=>{const c=je(u);if(c===void 0)return u.href?`<link rel="stylesheet" href="${u.href.replace(/"/g,"&quot;")}">`:"";const h=c.filter(v=>!(v instanceof CSSFontFaceRule)).map(v=>v.cssText);return`<style>${_e(h.join(`
`))}</style>`}).join(`
`);return K=[document.styleSheets.length,t],t},de=new Map,Ft=t=>{if(!de.has(t)){const u=fetch(t).then(c=>c.ok?c.arrayBuffer():void 0).catch(()=>{});de.set(t,u)}return de.get(t)},Rt=async()=>{const t=Array.from(document.styleSheets).flatMap(c=>(je(c)??[]).filter(h=>h instanceof CSSFontFaceRule));return(await Promise.all(t.map(async c=>{var S,L;const h=(S=c.style.getPropertyValue("src").match(/url\(\s*["']?([^"')]+)/))==null?void 0:S[1];if(h===void 0)return;const v=await Ft(new URL(h,((L=c.parentStyleSheet)==null?void 0:L.href)??document.baseURI).href);if(v===void 0)return;const w=a=>c.style.getPropertyValue(a)||void 0;return{family:c.style.getPropertyValue("font-family").replace(/^["']|["']$/g,""),source:v,descriptors:{style:w("font-style"),weight:w("font-weight"),unicodeRange:w("unicode-range"),display:w("font-display")}}}))).filter(c=>c!==void 0)},Wt=()=>((H==null?void 0:H[0])!==document.styleSheets.length&&(H=[document.styleSheets.length,Rt()]),H[1]),ee=()=>Object.fromEntries(Object.values(Ae).map(({id:t,name:u})=>[t,{id:t,name:u}])),Oe=t=>{const u=Je(t);return u===void 0?void 0:u+performance.timeOrigin},Te=()=>({values:ge,timestamps:Object.fromEntries(Object.keys(ge).map(t=>[t,Oe(t)]))}),Me=t=>({...Te(),infos:Be(),actions:ee(),storage:Ee(t)}),Pt=(t,u,c,h)=>`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<script>${Ce(Tt(u,h))}<\/script>
${c}
<style>${Mt}</style>
<style>${_e(t.css)}</style>
</head>
<body>
${t.html}
<script>${Ce(t.scopedScript?$t(t.js):t.js)}<\/script>
</body>
</html>`,Se=t=>typeof t=="string"||typeof t=="number"&&Number.isFinite(t)||typeof t=="boolean",D=t=>typeof t=="string"&&t.length>0,Ie=t=>typeof t=="string"?t:void 0,Ve=t=>typeof t=="boolean"?t:void 0,xe=t=>{if(typeof t!="object"||t===null)return;const{id:u,name:c,type:h,description:v,unit:w,persistent:S,persistValue:L}=t;if(!(!D(u)||!D(c)||h!=="string"&&h!=="number"&&h!=="boolean"))return{id:u,name:c,type:h,description:Ie(v),unit:Ie(w),persistent:Ve(S),persistValue:Ve(L),systemOwned:!1}},T=new Map,X=t=>{var w;const u=T.get(t)??[],c=u[u.length-1];if(c===void 0){T.delete(t),ye(t),st(t);return}const h=new it(t,c.name);nt(h);const v=(w=[...u].reverse().find(S=>S.callback!==void 0))==null?void 0:w.callback;v===void 0?ye(t):ot(h,v)},Yt=(t,u,c,h)=>{const v=new Map,w={},S=new Set;let L=!1,a=!1,j;const E=s=>{L||(L=!0,h(s))},I=()=>{v.forEach(s=>he(...s)),v.clear()},M=s=>{var i;return(i=T.get(s))==null?void 0:i.find(e=>e.bridge===w)},F=s=>{var i;T.set(s,((i=T.get(s))==null?void 0:i.filter(e=>e.bridge!==w))??[]),S.delete(s),X(s)},R=()=>[...S].forEach(F),W=(s,i)=>{const e=xe(s);if(e===void 0)return;const r=Q(e.id);if(r===void 0)return e;if(!me(e.id)){E(`cockpit.${i} cannot change "${e.id}", which belongs to Cockpit`);return}const{name:V,type:_,description:B,unit:te,persistent:ae,persistValue:se}=e;return{...r,name:V,type:_,description:B,unit:te,persistent:ae??r.persistent,persistValue:se??r.persistValue}},$=s=>{const i=new Map(Object.entries(Ee(u))),e=new Map(i);s(e),!at(u,Object.fromEntries(e))&&(new Set([...i.keys(),...e.keys()]).forEach(r=>{i.get(r)!==e.get(r)&&c({type:"storageRestore",key:r,value:i.get(r)??null})}),E("The storage DIY widgets share on this computer is full"))};return{handleMessage:s=>{if(a||typeof s!="object"||s===null)return;const i=s;if(!(i.channel!==Le||i.frameId!==t))switch(i.type){case"hello":I(),R(),L=!1,j??(j=tt(e=>c({type:"infos",infos:e}))),c({type:"snapshot",...Me(u)}),Wt().then(e=>{!a&&e.length>0&&c({type:"fonts",fonts:e})});return;case"refresh":c({type:"values",...Te()});return;case"listen":{const{variableId:e,listenerId:r}=i;if(!D(e)||!D(r)||v.has(r))return;const V=et(e,_=>c({type:"value",listenerId:r,value:_,timestamp:Oe(e)}),{notifyOnTimestampChange:i.notifyOnTimestampChange===!0});v.set(r,[e,V]);return}case"unlisten":{const{listenerId:e}=i;if(!D(e))return;const r=v.get(e);if(r===void 0)return;he(...r),v.delete(e);return}case"set":{const{variableId:e,value:r}=i;if(!D(e)||!Se(r))return;if(Q(e)!==void 0&&!Qe(e)){c({type:"restore",variableId:e,value:Ze(e)}),E(`cockpit.setDataLakeVariableData cannot change "${e}", which belongs to Cockpit`);return}Xe(e,r);return}case"create":{const e=W(i.variable,"createDataLakeVariable");e!==void 0&&Ge(e,Se(i.initialValue)?i.initialValue:void 0);return}case"updateInfo":{const e=xe(i.variable);if(e===void 0||Q(e.id)===void 0)return;const r=W(e,"updateDataLakeVariableInfo");r!==void 0&&qe(r);return}case"delete":{const{variableId:e}=i;if(!D(e)||Q(e)===void 0)return;if(!me(e)){E(`cockpit.deleteDataLakeVariable cannot delete "${e}", which belongs to Cockpit`);return}He(e);return}case"registerAction":{const{actionId:e,name:r}=i;if(!D(e)||!D(r))return;if(e in Ae&&!T.has(e)){E(`cockpit.registerNewAction cannot replace the existing action "${e}"`),c({type:"actions",actions:ee()});return}const V=M(e)??{bridge:w,name:r};V.name=r,T.set(e,[...(T.get(e)??[]).filter(_=>_!==V),V]),S.add(e),X(e),c({type:"actions",actions:ee()});return}case"deleteAction":{const{actionId:e}=i;D(e)&&S.has(e)&&F(e),c({type:"actions",actions:ee()});return}case"registerCallback":{const{actionId:e}=i;if(!D(e))return;const r=M(e);if(r===void 0){E(`cockpit.registerActionCallback only takes actions the widget added, not "${e}"`);return}r.callback=()=>c({type:"runAction",actionId:e}),X(e);return}case"unregisterCallback":{const{actionId:e}=i,r=D(e)?M(e):void 0;if(r===void 0)return;r.callback=void 0,X(e);return}case"action":D(i.actionId)&&Ke(i.actionId);return;case"storageSet":{const{key:e,value:r}=i;if(typeof e!="string"||typeof r!="string")return;$(V=>V.set(e,r));return}case"storageRemove":{const{key:e}=i;typeof e=="string"&&$(r=>r.delete(e));return}case"storageClear":$(e=>e.clear());return;case"error":E(String(i.message))}},dispose:()=>{a=!0,I(),R(),j!==void 0&&rt(j)}}},Nt={class:"main"},Bt=["title","srcdoc"],zt={key:0,class:"help-panel mb-4 p-4 rounded bg-white/5"},Jt={class:"text-lg mb-2"},Kt={class:"text-sm text-white/70 list-disc pl-4 space-y-1"},Ht={class:"flex justify-between items-center px-4 w-full h-full"},qt={class:"flex gap-x-3"},De=50,Gt=lt({__name:"DoItYourself",props:{widget:{}},setup(t){ct(n=>({"7e40a446":G.value}));const u=dt("cockpit-diy-widget-auto-save",!1),c=ut(),h=pt(),{openSnackbar:v}=ft(),{showDialog:w,closeDialog:S}=gt(),a=mt(t).widget,j=U(null),E=U(be());let I;const M=U(null),F=U(null),R=U(null),W=U(!1),$=U(["html","css","js"]);let f=null,g=null,s=null;const i={html:`<!-- Write your HTML code here -->
<div id="diy-container">
  <span>Create your own widget!</span>
</div>`,css:`/* Write your CSS code here */
#diy-container {
  width: 100%;
  height: 100%;
  padding: 1rem;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
  text-align: center;
  font-family: 'Roboto', sans-serif;
  font-weight: 500;
}`,js:`// Write your JavaScript code here
document.addEventListener('DOMContentLoaded', () => {
  // Your code here
});`,inheritCockpitStyles:!0};let e={key:"",document:""};const r=ve(()=>{const n={html:a.value.options.html||i.html,css:a.value.options.css||i.css,js:a.value.options.js||i.js,scopedScript:a.value.options.scopedScript===!0},o=JSON.stringify([n,E.value]);return o!==e.key&&(e={key:o,document:Pt(n,E.value,Ut(),Me(a.value.hash))}),e.document}),V=(n,o,x,k)=>_t(n,{language:o,value:x,dataLakeCompletionType:k}),_=n=>{n.addCommand(N.CtrlCmd|Z.Enter,()=>P()),n.addCommand(N.CtrlCmd|Z.KeyS,()=>P()),n.addCommand(N.CtrlCmd|N.Alt|Z.UpArrow,()=>{f&&f.hasTextFocus()&&g?g.focus():s&&s.hasTextFocus()&&f?f.focus():g&&g.hasTextFocus()&&s&&s.focus()}),n.addCommand(N.CtrlCmd|N.Alt|Z.DownArrow,()=>{f&&f.hasTextFocus()&&s?s.focus():s&&s.hasTextFocus()&&g?g.focus():g&&g.hasTextFocus()&&f&&f.focus()})},B=n=>{n.onDidChangeModelContent(()=>{ae()})},te=async()=>{f||!M.value||s||!R.value||g||!F.value||(f=V(M.value,"html",a.value.options.html||i.html),s=V(R.value,"javascript",a.value.options.js||i.js,"use-api-function"),g=V(F.value,"css",a.value.options.css||i.css),f&&(_(f),B(f)),s&&(_(s),B(s)),g&&(_(g),B(g)))},ae=()=>{u.value&&P()},se=async()=>{await te()},$e=async()=>{ie()},P=()=>{!f||!g||!s||(logUserAction("Applied changes to Do-It-Yourself widget"),a.value.options.html=f.getValue(),a.value.options.css=g.getValue(),a.value.options.js=s.getValue(),ue())},Ue=n=>{logUserAction(`${n?"Enabled":"Disabled"} running the Do-It-Yourself widget script in its own scope`),a.value.options.scopedScript=n===!0},ue=()=>{I==null||I.dispose(),E.value=be(),I=Yt(E.value,a.value.hash,n=>{var o,x;return(x=(o=j.value)==null?void 0:o.contentWindow)==null?void 0:x.postMessage(n,"*")},n=>{jt(new Error(`Error running the DIY widget "${a.value.name}" script: ${n}`))})},pe=n=>{j.value===null||n.source!==j.value.contentWindow||I==null||I.handleMessage(n.data)},Fe=()=>{!f||!g||!s||(logUserAction("Reset Do-It-Yourself widget editors"),f.setValue(a.value.options.html||i.html),g.setValue(a.value.options.css||i.css),s.setValue(a.value.options.js||i.js))},ie=()=>{f&&(f.dispose(),f=null),g&&(g.dispose(),g=null),s&&(s.dispose(),s=null)},Re=()=>{h.widgetManagerVars(a.value.hash).configMenuOpen=!1,u.value&&P(),ie()},We=()=>{if(!f||!g||!s)return;logUserAction("Exported Do-It-Yourself widget configuration");const n={html:f.getValue(),css:g.getValue(),js:s.getValue(),inheritCockpitStyles:a.value.options.inheritCockpitStyles||!1,scopedScript:a.value.options.scopedScript===!0},o=JSON.stringify(n,null,2),x=new Blob([o],{type:"application/json"}),k=URL.createObjectURL(x),A=document.createElement("a");A.href=k,A.download="diy-widget-config.json",document.body.appendChild(A),A.click(),document.body.removeChild(A),URL.revokeObjectURL(k)},q=n=>{!f||!g||!s||(a.value.options.libraryId=Lt({name:a.value.name,html:f.getValue(),css:g.getValue(),js:s.getValue(),inheritCockpitStyles:a.value.options.inheritCockpitStyles===!0,scopedScript:a.value.options.scopedScript===!0},n),v({message:n?d`Updated "${a.value.name}" in the DIY widget library.`:d`Saved "${a.value.name}" in the DIY widget library.`,variant:"success",duration:3e3}))},Pe=()=>{logUserAction(`Pressed "Save to library" on Do-It-Yourself widget "${a.value.name}"`);const n=a.value.options.libraryId,o=n===void 0?void 0:At()[n];if(o===void 0)return q(void 0);if(!h.currentProfile.views.some(k=>k.widgets.some(A=>A.hash!==a.value.hash&&A.options.libraryId===n)))return q(n);w({title:d`Update the library entry?`,variant:"warning",maxWidth:520,persistent:!1,message:d`Other widgets also come from "${o.name}" in the library. Update that entry, or save this widget as a new one?`,actions:[{text:d`Save as new`,action:()=>{logUserAction(`Saved Do-It-Yourself widget "${a.value.name}" as a new library entry`),S(),q(void 0)}},{text:d`Update entry`,class:"bg-[#FFFFFF33] text-white",action:()=>{logUserAction(`Updated the library entry "${o.name}" from a Do-It-Yourself widget`),S(),q(n)}}]}).catch(()=>{logUserAction('Closed the "Update the library entry?" prompt without saving')})},Ye=()=>{logUserAction("Imported Do-It-Yourself widget configuration");const n=document.createElement("input");n.type="file",n.onchange=o=>{const x=o.target;if(!x.files||!x.files[0]||!f||!g||!s)return;const k=x.files[0],A=new FileReader;A.onload=Ne=>{var fe;try{const ne=(fe=Ne.target)==null?void 0:fe.result,O=JSON.parse(ne);if(!O.html||!O.css||!O.js)throw new Error("Invalid configuration file");f&&f.setValue(O.html),g&&g.setValue(O.css),s&&s.setValue(O.js),a.value.options.inheritCockpitStyles=O.inheritCockpitStyles||!1,a.value.options.scopedScript=O.scopedScript===!0,P()}catch(ne){console.error("Error importing configuration:",ne),alert(d`Invalid configuration file`)}},A.readAsText(k)},document.body.appendChild(n),n.click(),document.body.removeChild(n)},G=ve(()=>{const n=$.value.length;return n===0?`${De}vh`:`${Math.round(De/n)}vh`});return ht(()=>{const n=a.value.options.scopedScript??a.value.options.html===void 0;a.value.options=Object.assign({},i,a.value.options,{scopedScript:n}),window.addEventListener("message",pe),ue()}),yt(()=>{ie(),window.removeEventListener("message",pe),I==null||I.dispose()}),(n,o)=>{const x=vt("vue-draggable-resizable");return we(),ke(Et,null,[y("div",Nt,[y("div",{class:"w-full h-full",style:z(l(a).options.inheritCockpitStyles?l(c).globalGlassMenuStyles:{})},[y("iframe",{ref_key:"frame",ref:j,title:l(a).name,class:"w-full h-full border-0",sandbox:"allow-scripts allow-forms allow-downloads allow-popups",srcdoc:r.value},null,8,Bt)],4)]),p(Dt,{modelValue:l(h).widgetManagerVars(l(a).hash).configMenuOpen,"onUpdate:modelValue":o[4]||(o[4]=k=>l(h).widgetManagerVars(l(a).hash).configMenuOpen=k),"max-width":l(c).isOnSmallScreen?"100%":"800px",onAfterEnter:se,onAfterLeave:$e},{default:m(()=>[p(x,{"drag-handle":".drag-handle",w:"auto",h:"auto",handles:["tm","mr","bm","ml"]},{default:m(()=>[p(bt,{class:"pa-2",style:z(l(c).globalGlassMenuStyles)},{default:m(()=>[p(J,{class:"drag-handle absolute top-[12px] left-[12px] cursor-grab"},{default:m(()=>o[5]||(o[5]=[C("mdi-drag")])),_:1,__:[5]}),p(J,{class:"absolute top-[12px] right-[12px] cursor-pointer",onClick:o[0]||(o[0]=k=>W.value=!W.value)},{default:m(()=>o[6]||(o[6]=[C(" mdi-help-circle-outline ")])),_:1,__:[6]}),p(kt,{class:"w-full text-center mt-2"},{default:m(()=>[C(b(l(d)`DIY widget configuration`),1)]),_:1}),p(wt,{class:"mx-2 flex flex-col gap-y-3"},{default:m(()=>[p(Ct,null,{default:m(()=>[W.value?(we(),ke("div",zt,[y("h3",Jt,b(l(d)`Editor instructions`),1),y("ul",Kt,[y("li",null,b(l(d)`Use the HTML, CSS, and JS editors to create your custom widget`),1),y("li",null,b(l(d)`Changes are applied when you click Apply or press Cmd/Ctrl + Enter/S`),1),y("li",null,b(l(d)`Navigate between editors using Cmd/Ctrl + Option/Alt + ↑/↓`),1),y("li",null,b(l(d)`Reset to last saved state using the Reset button`),1),y("li",null,b(l(d)`Your code runs isolated in its own frame, with its own page, so it cannot reach the rest of Cockpit's interface. Applying the code again, or removing the widget, stops everything it started`),1),y("li",null,b(l(d)`The script reaches Cockpit through the cockpit object, with the same data-lake and action functions as before, answering reads synchronously with the latest values Cockpit has sent to the frame`),1),y("li",null,b(l(d)`A widget can change and delete only its own data-lake variables and those the user may change, and can register callbacks only for actions it added. Refused requests are reported in a notification`),1),y("li",null,b(l(d)`localStorage keeps its items per widget, on this computer; sessionStorage lasts until the widget reloads; indexedDB and cookies are not available. Requests with fetch reach only servers that accept other origins, as BlueOS does`),1),y("li",null,b(l(d)`A script run in its own scope gets root (the page body) and cockpit as arguments, and its top-level names stay local, so inline handlers in the HTML cannot call its functions`),1),y("li",null,b(l(d)`You can use the console to debug your code`),1),y("li",null,b(l(d)`You can use the data-lake system to inject or consume data from Cockpit. Check the docs for more information around this.`),1),y("li",null,b(l(d)`Click on each editor's header to expand it to full size`),1)])])):St("",!0)]),_:1}),p(It,{modelValue:$.value,"onUpdate:modelValue":o[1]||(o[1]=k=>$.value=k),class:"editors-container",multiple:""},{default:m(()=>[p(oe,{value:"html"},{default:m(()=>[p(re,{static:"",height:"30px",class:"text-white/60"},{default:m(()=>o[7]||(o[7]=[C(" HTML ")])),_:1,__:[7]}),p(le,{eager:""},{default:m(()=>[y("div",{ref_key:"htmlEditorContainer",ref:M,class:"editor-container",style:z({height:G.value})},null,4)]),_:1})]),_:1}),p(oe,{value:"js"},{default:m(()=>[p(re,{static:"",height:"30px",class:"text-white/60"},{default:m(()=>o[8]||(o[8]=[C(" JS ")])),_:1,__:[8]}),p(le,{eager:""},{default:m(()=>[y("div",{ref_key:"jsEditorContainer",ref:R,class:"editor-container",style:z({height:G.value})},null,4)]),_:1})]),_:1}),p(oe,{value:"css"},{default:m(()=>[p(re,{static:"",height:"30px",class:"text-white/60"},{default:m(()=>o[9]||(o[9]=[C(" CSS ")])),_:1,__:[9]}),p(le,{eager:""},{default:m(()=>[y("div",{ref_key:"cssEditorContainer",ref:F,class:"editor-container",style:z({height:G.value})},null,4)]),_:1})]),_:1})]),_:1},8,["modelValue"]),p(ce,{modelValue:l(u),"onUpdate:modelValue":o[2]||(o[2]=k=>Vt(u)?u.value=k:null),label:l(d)`Auto Save`,density:"compact",class:"-mb-2","hide-details":""},null,8,["modelValue","label"]),p(ce,{"model-value":l(a).options.scopedScript,label:l(d)`Run script in its own scope`,density:"compact",class:"-mb-2","hide-details":"","onUpdate:modelValue":Ue},null,8,["model-value","label"]),p(ce,{modelValue:l(a).options.inheritCockpitStyles,"onUpdate:modelValue":o[3]||(o[3]=k=>l(a).options.inheritCockpitStyles=k),label:l(d)`Inherit Cockpit interface styles`,density:"compact",class:"-mb-2","hide-details":""},null,8,["modelValue","label"])]),_:1}),p(xt,null,{default:m(()=>[y("div",Ht,[p(Y,{class:"text-white/60",variant:"text",onClick:Re},{default:m(()=>[C(b(l(d)`Close`),1)]),_:1}),y("div",qt,[p(Y,{class:"text-white/60",variant:"text",title:l(d)`Export configuration`,onClick:We},{default:m(()=>[p(J,{class:"mr-1 mt-[2px]"},{default:m(()=>o[10]||(o[10]=[C("mdi-download")])),_:1,__:[10]}),C(" "+b(l(d)`Export`),1)]),_:1},8,["title"]),p(Y,{class:"text-white/60",variant:"text",title:l(d)`Import configuration`,onClick:Ye},{default:m(()=>[p(J,{class:"mr-1 mt-[2px]"},{default:m(()=>o[11]||(o[11]=[C("mdi-upload")])),_:1,__:[11]}),C(" "+b(l(d)`Import`),1)]),_:1},8,["title"]),p(Y,{class:"text-white/60 mr-10",variant:"text",title:l(d)`Save to the DIY widget library`,onClick:Pe},{default:m(()=>[p(J,{class:"mr-1 mt-[2px]"},{default:m(()=>o[12]||(o[12]=[C("mdi-bookshelf")])),_:1,__:[12]}),C(" "+b(l(d)`Save to library`),1)]),_:1},8,["title"]),p(Y,{class:"text-white/60",variant:"text",onClick:Fe},{default:m(()=>[C(b(l(d)`Reset`),1)]),_:1}),p(Y,{class:"text-white",variant:"text",onClick:P},{default:m(()=>[C(b(l(d)`Apply`),1)]),_:1})])])]),_:1})]),_:1},8,["style"])]),_:1})]),_:1},8,["modelValue","max-width"])],64)}}}),Zt=Ot(Gt,[["__scopeId","data-v-9bbda70b"]]);export{Zt as default};
