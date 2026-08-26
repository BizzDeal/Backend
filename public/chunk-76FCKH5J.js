function f(e){if(!e)return"U";let t=e.trim().split(" ").filter(Boolean);return t.length===0?"U":t.length===1?t[0].substring(0,2).toUpperCase():(t[0].charAt(0)+t[t.length-1].charAt(0)).toUpperCase()}function g(e){if(!e)return"linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)";let t=["linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)","linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)","linear-gradient(135deg, #10b981 0%, #047857 100%)","linear-gradient(135deg, #f59e0b 0%, #b45309 100%)","linear-gradient(135deg, #ec4899 0%, #be185d 100%)","linear-gradient(135deg, #06b6d4 0%, #0e7490 100%)"],n=0;for(let a=0;a<e.length;a++)n=e.charCodeAt(a)+((n<<5)-n);let r=Math.abs(n)%t.length;return t[r]}function c(e){let t=f(e),n=[{start:"#3b82f6",end:"#1d4ed8"},{start:"#8b5cf6",end:"#6d28d9"},{start:"#10b981",end:"#047857"},{start:"#f59e0b",end:"#b45309"},{start:"#ec4899",end:"#be185d"},{start:"#06b6d4",end:"#0e7490"}],r=0,a=e||"User";for(let i=0;i<a.length;i++)r=a.charCodeAt(i)+((r<<5)-r);let d=Math.abs(r)%n.length,{start:o,end:l}=n[d],s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${o}" />
      <stop offset="100%" stop-color="${l}" />
    </linearGradient>
  </defs>
  <rect width="100" height="100" fill="url(#g)" />
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="44px" font-weight="600">${t}</text>
</svg>`;return typeof btoa<"u"?`data:image/svg+xml;base64,${btoa(s)}`:`data:image/svg+xml;utf8,${encodeURIComponent(s)}`}export{f as a,g as b,c};
