:root{--green:#0b8a3e;--green-d:#06602b;--red:#d3222a;--ink:#16241b;--mute:#5b6b61;--paper:#f4fbf6;--line:#d8eadd}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{font-family:'Segoe UI',system-ui,-apple-system,Roboto,sans-serif;color:var(--ink);background:var(--paper);min-height:100vh;min-height:100dvh;line-height:1.5}
img{max-width:100%;display:block}
button,input,select,textarea{font:inherit;color:inherit}
:focus-visible{outline:3px solid var(--green);outline-offset:2px}
#zam-loader{position:fixed;inset:0;z-index:9999;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;transition:opacity .45s}
#zam-loader.done{opacity:0;pointer-events:none}
#zam-loader img{animation:zl-pop 1.4s ease-in-out infinite}
#zam-loader p{color:var(--green-d);font-weight:600;letter-spacing:.04em}
.zl-bar{width:150px;height:5px;border-radius:5px;background:var(--line);overflow:hidden}
.zl-bar span{display:block;height:100%;width:40%;border-radius:5px;background:linear-gradient(90deg,var(--green),var(--red));animation:zl-run 1s ease-in-out infinite}
@keyframes zl-run{0%{transform:translateX(-100%)}100%{transform:translateX(260%)}}
@keyframes zl-pop{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
#zam-toasts{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:9998;display:flex;flex-direction:column;gap:10px;width:min(92vw,400px)}
.zt{display:flex;gap:10px;align-items:flex-start;padding:13px 16px;border-radius:14px;background:#fff;border-left:5px solid var(--green);box-shadow:0 10px 30px rgba(6,60,30,.18);opacity:0;transform:translateY(-14px);transition:.3s}
.zt.show{opacity:1;transform:none}
.zt i{margin-top:3px}
.zt-ok i{color:var(--green)}
.zt-err{border-left-color:var(--red)}
.zt-err i{color:var(--red)}
.zt-warn{border-left-color:#e0a100}
.zt-warn i{color:#e0a100}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
