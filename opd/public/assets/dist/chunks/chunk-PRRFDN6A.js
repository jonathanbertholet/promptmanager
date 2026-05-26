import{a as d,b as m,c as n}from"./chunk-BSKAHWXT.js";import{m as l}from"./chunk-ELWJDFFB.js";function E(s,f){let{resultsEl:i,showLibraryButton:v=!1,initialQuery:c="",onSubmit:u,placeholder:y="Search prompts\u2026"}=f;s.className="opd-hero-search",s.innerHTML=`
    <form class="opd-hero-search-form" role="search" autocomplete="off">
      <div class="opd-hero-search-field">
        <input
          type="search"
          class="opd-hero-search-input"
          placeholder="${y}"
          aria-label="Search prompts"
          autocomplete="off"
        />
        <button type="submit" class="opd-hero-search-submit" aria-label="Search">
          ${l("search","opd-hero-search-icon")}
        </button>
        ${v?`<a href="/browse" class="opd-hero-search-library" title="Browse library" aria-label="Browse library">
                 ${l("apps","opd-hero-search-icon")}
               </a>`:""}
      </div>
    </form>
  `;let h=s.querySelector(".opd-hero-search-form"),t=s.querySelector(".opd-hero-search-input"),p=null,o=c.trim();return c&&(t.value=c),t.addEventListener("input",()=>{clearTimeout(p),p=setTimeout(()=>{o=t.value.trim(),n(i,o)},d)}),t.addEventListener("keydown",e=>{if(e.key==="ArrowDown"||e.key==="ArrowUp"){let r=[...i.querySelectorAll(".opd-search-hit")];if(!r.length)return;e.preventDefault();let b=document.activeElement,a=r.indexOf(b);e.key==="ArrowDown"?a=a<r.length-1?a+1:0:a=a>0?a-1:r.length-1,r[a].focus();return}if(e.key==="Enter"){if(document.activeElement?.classList?.contains("opd-search-hit"))return;e.preventDefault(),h.requestSubmit()}}),h.addEventListener("submit",e=>{e.preventDefault();let r=t.value.trim();if(o=r,u){u(r);return}r&&(window.location.href=`/browse?q=${encodeURIComponent(r)}`)}),o?n(i,o):m(i,"Type to search the prompt catalog."),{input:t,focus:()=>t.focus(),setQuery:e=>{t.value=e,o=e.trim(),n(i,o)}}}export{E as a};
