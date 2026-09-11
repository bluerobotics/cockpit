const a=/^\/mavlink\/(?:\d+|\{\{autopilotSystemId\}\})\/\d+\/(.+)$/,n=o=>{var t;return(t=o.match(a))==null?void 0:t[1]},e=(o,t)=>{const i=n(t);if(i)return o.find(r=>n(r.value)===i)};export{e as f};
