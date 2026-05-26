import{a as l,b as p,c as u}from"./chunk-BSKAHWXT.js";import{m as s}from"./chunk-ELWJDFFB.js";var t=null,a=null,c=null,h=null,n="";function m(){t||(t=document.createElement("div"),t.id="opd-search-modal",t.className="opd-search-modal",t.setAttribute("role","dialog"),t.setAttribute("aria-modal","true"),t.setAttribute("aria-label","Search prompts"),t.hidden=!0,t.innerHTML=`
    <div class="opd-search-backdrop" data-opd-search-close></div>
    <div class="opd-search-dialog">
      <div class="opd-search-header">
        <span class="opd-search-header-label">Search prompts</span>
        <kbd class="opd-search-kbd">ESC</kbd>
        <button type="button" class="opd-search-close" aria-label="Close search" data-opd-search-close>
          ${s("close")}
        </button>
      </div>
      <div class="opd-search-input-wrap">
        ${s("search","opd-search-input-icon")}
        <input type="search" class="opd-search-input" placeholder="Search by title or prompt text\u2026" autocomplete="off" aria-label="Search prompts" />
      </div>
      <div class="opd-search-results" aria-live="polite"></div>
    </div>
  `,document.body.appendChild(t),a=t.querySelector(".opd-search-input"),c=t.querySelector(".opd-search-results"),t.querySelectorAll("[data-opd-search-close]").forEach(e=>{e.addEventListener("click",i)}),a.addEventListener("input",()=>{clearTimeout(h),h=setTimeout(()=>{n=a.value.trim(),u(c,n)},l)}),a.addEventListener("keydown",e=>{if(e.key==="ArrowDown"||e.key==="ArrowUp"){let r=[...c.querySelectorAll(".opd-search-hit")];if(!r.length)return;e.preventDefault();let f=document.activeElement,o=r.indexOf(f);e.key==="ArrowDown"?o=o<r.length-1?o+1:0:o=o>0?o-1:r.length-1,r[o].focus();return}if(e.key==="Enter"&&n){if(document.activeElement?.classList?.contains("opd-search-hit"))return;window.location.href=`/browse?q=${encodeURIComponent(n)}`}}))}function v(e){if(!e||!(e instanceof HTMLElement))return!1;let r=e.tagName;return r==="INPUT"||r==="TEXTAREA"||r==="SELECT"||e.isContentEditable}function d(){m(),t.hidden=!1,document.body.classList.add("opd-search-open"),a.value="",n="",p(c,"Type to search the prompt catalog."),setTimeout(()=>a.focus(),50)}function i(){t&&(t.hidden=!0,document.body.classList.remove("opd-search-open"))}function b(){m(),document.addEventListener("keydown",e=>{if((e.metaKey||e.ctrlKey)&&e.key==="k"){e.preventDefault(),t.hidden?d():i();return}if(e.key==="/"&&!v(e.target)&&t?.hidden){if(document.body.classList.contains("opd-page-home")){document.querySelector(".opd-hero-search-input")?.focus();return}e.preventDefault(),d();return}e.key==="Escape"&&t&&!t.hidden&&i()}),window.__opdOpenSearch=d}export{i as closeSearch,b as initSearch,d as openSearch};
