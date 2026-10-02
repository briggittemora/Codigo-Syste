import{r as i,j as e}from"./radix-CKgpsSS2.js";import{m as T}from"./motion-Sdi-4knI.js";const h={sm:"h-12",md:"h-16",lg:"h-20",rectangle:"h-[250px]"},g="e4c11c1ea1cc54b5fdfd61ef580a6a7b",b=468,y=60,M=({className:w="",height:v="md",adKey:o=g,adWidth:s=b,adHeight:r=y,backgroundVideoUrl:c="",backgroundVideoPlaybackRate:j=1,backgroundScrollSymbols:m=!1,backgroundScrollSpeed:d=22,backgroundScrollOpacity:N=.35,smartLinkUrl:u=""})=>{const n="HTML CSS JS TS REACT VUE ANGULAR NODE PYTHON JAVA C# C++ GO RUST PHP SQL MONGO REDIS AWS AZURE GIT DOCKER K8S",f=i.useRef(null),[l,A]=i.useState(1);i.useEffect(()=>{const t=f.current;if(!t||typeof ResizeObserver>"u")return;const a=new ResizeObserver(E=>{const p=E?.[0]?.contentRect?.width;if(!p)return;const x=Math.min(1,p/s);A(Number.isFinite(x)?x:1)});return a.observe(t),()=>a.disconnect()},[s]);const R=i.useMemo(()=>{const t=String(o||"").trim();return t?`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>html,body{margin:0;padding:0;overflow:hidden;background:transparent;}</style>
  </head>
  <body>
    <script type="text/javascript">
      atOptions = {
        'key' : '${t}',
        'format' : 'iframe',
        'height' : ${Number(r)||y},
        'width' : ${Number(s)||b},
        'params' : {}
      };
    <\/script>
    <script type="text/javascript" src="https://hypothesisgarden.com/${t}/invoke.js"><\/script>
  </body>
</html>`:""},[o,r,s]);return e.jsxs(T.div,{initial:{opacity:0,y:20},animate:{opacity:1,y:0},transition:{duration:.5,ease:[.22,1,.36,1]},className:`relative w-full ${h[v]||h.md} bg-transparent border-0 rounded-none flex items-center justify-center overflow-hidden ${w}`,children:[m?e.jsx("style",{children:"@keyframes adBannerMarquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}@keyframes adBannerMarqueeReverse{0%{transform:translateX(-50%)}100%{transform:translateX(0)}}"}):null,c?e.jsx("video",{className:"absolute inset-0 h-full w-full object-cover",src:c,autoPlay:!0,loop:!0,muted:!0,playsInline:!0,onLoadedMetadata:t=>{const a=Number(j);Number.isFinite(a)&&a>0&&(t.currentTarget.playbackRate=a)}}):null,m?e.jsxs("div",{className:"pointer-events-none absolute inset-0 z-0 overflow-hidden",style:{opacity:N},children:[e.jsxs("div",{className:"absolute left-0 top-2 flex w-[200%] whitespace-nowrap",style:{animation:`adBannerMarquee ${Number(d)||22}s linear infinite`},children:[e.jsx("span",{className:"mx-6 text-sm text-slate-300",children:n}),e.jsx("span",{className:"mx-6 text-sm text-slate-300",children:n})]}),e.jsxs("div",{className:"absolute left-0 bottom-2 flex w-[200%] whitespace-nowrap",style:{animation:`adBannerMarqueeReverse ${Number(d)||22}s linear infinite`},children:[e.jsx("span",{className:"mx-6 text-sm text-slate-300",children:n}),e.jsx("span",{className:"mx-6 text-sm text-slate-300",children:n})]})]}):null,e.jsx("div",{className:"relative z-10 w-full px-3 flex justify-center",children:e.jsx("div",{ref:f,className:"w-full max-w-[468px]",children:e.jsx("div",{className:"mx-auto overflow-hidden",style:{width:s*l,height:r*l},children:e.jsx("div",{style:{width:s,height:r,transform:`scale(${l})`,transformOrigin:"top left"},children:e.jsx("iframe",{title:"Publicidad",srcDoc:R,width:s,height:r,scrolling:"no",style:{border:0,display:"block"},sandbox:"allow-scripts allow-popups allow-forms allow-same-origin"})})})})}),u?e.jsx("a",{href:u,target:"_blank",rel:"noopener noreferrer","aria-label":"Abrir publicidad",className:"absolute inset-0 z-20"}):null]})};export{M as A};
