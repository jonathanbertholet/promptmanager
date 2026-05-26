import{a as w,b as I}from"./chunks/chunk-LCSPI4NV.js";import{a as v,c as x,e as B}from"./chunks/chunk-2SO2A3DU.js";import{a as m,d as l,g as f,h as b,j as y,k as h,l as g,m as s,n as c,u as C}from"./chunks/chunk-ELWJDFFB.js";var r=null;function k(){return r||(r=document.createElement("div"),r.id="opd-report-modal",r.className="opd-report-modal",r.setAttribute("role","dialog"),r.setAttribute("aria-modal","true"),r.setAttribute("aria-label","Report prompt"),r.hidden=!0,r.innerHTML=`
    <div class="opd-report-backdrop" data-opd-report-close></div>
    <div class="opd-report-dialog">
      <h2 class="opd-report-title">Report this prompt</h2>
      <p class="pm-subtitle opd-report-body" id="opd-report-status">
        Choose a reason and submit. Reports are reviewed manually.
      </p>
      <label class="settings-field-label" for="opd-report-reason">Reason</label>
      <select id="opd-report-reason" class="opm-input-field">
        <option value="spam">Spam</option>
        <option value="malware">Malware / unsafe</option>
        <option value="illegal">Illegal content</option>
        <option value="harassment">Harassment</option>
        <option value="other">Other</option>
      </select>
      <label class="settings-field-label" for="opd-report-detail">Details (optional)</label>
      <textarea id="opd-report-detail" class="opm-input-field" rows="3" maxlength="500"></textarea>
      <div class="opd-report-actions">
        <button type="button" class="main" id="opd-report-submit">Submit report</button>
        <button type="button" class="main opd-btn-secondary" data-opd-report-close>Close</button>
      </div>
    </div>
  `,document.body.appendChild(r),r.querySelectorAll("[data-opd-report-close]").forEach(o=>{o.addEventListener("click",E)}),document.addEventListener("keydown",o=>{o.key==="Escape"&&r&&!r.hidden&&E()}),r)}function P(){k(),r.hidden=!1,document.body.classList.add("opd-report-open")}function E(){r&&(r.hidden=!0,document.body.classList.remove("opd-report-open"))}async function L(o){let e=k(),n=e.querySelector("#opd-report-status"),i=e.querySelector("#opd-report-submit");n&&(n.textContent="Choose a reason and submit. Reports are reviewed manually."),P(),!(!i||i.dataset.opdWired==="1")&&(i.dataset.opdWired="1",i.addEventListener("click",async()=>{let a=e.querySelector("#opd-report-reason")?.value||"other",p=e.querySelector("#opd-report-detail")?.value||"";i.disabled=!0;try{let u=await fetch(`${m}/v1/prompts/${encodeURIComponent(o.id)}/report`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reason:a,detail:p})});u.ok||u.status===202?n&&(n.textContent="Thank you \u2014 your report was received."):n&&(n.textContent="Could not submit report. Try again later.")}catch{n&&(n.textContent="Could not submit report. Try again later.")}finally{i.disabled=!1}}))}function M(o){return`${window.location.origin}/p/${encodeURIComponent(o.id)}`}function S(){return navigator.share?window.matchMedia("(max-width: 768px)").matches?!0:/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||""):!1}async function $(o){let e=M(o),n=v(o),i=`${n}
${e}`;if(S())try{return await navigator.share({title:"Open Prompt Database",text:n,url:e}),"shared"}catch(a){if(a?.name==="AbortError")return"cancelled"}try{return await navigator.clipboard.writeText(i),"copied"}catch{return"unsupported"}}var t={breadcrumbCurrent:document.getElementById("opd-breadcrumb-current"),title:document.getElementById("opd-detail-title"),stats:document.getElementById("opd-detail-stats"),tags:document.getElementById("opd-detail-tags"),content:document.getElementById("opd-detail-content"),contentHint:document.getElementById("opd-content-hint"),status:document.getElementById("opd-import-status"),importBtn:document.getElementById("opd-import-btn"),copyBtn:document.getElementById("opd-copy-btn"),shareBtn:document.getElementById("opd-share-btn"),reportBtn:document.getElementById("opd-report-btn"),authorLink:document.getElementById("opd-author-link")};function T(o){if(!t.stats)return;let e=o.stats?.imports??0,n=e===0?"No imports yet":`${e} import${e===1?"":"s"}`;t.stats.innerHTML=`
    <li>
      ${s("person")}
      <a href="/u/${encodeURIComponent(o.author)}">@${l(o.author)}</a>
    </li>
    <li>
      ${s("calendar_today")}
      <time datetime="${l(o.publishedAt||"")}">${h(o.publishedAt)}</time>
    </li>
    <li>
      ${s("download")}
      <span>${n}</span>
    </li>
  `}function d(o,e){let n=o.innerHTML;o.innerHTML=`${s("check")} ${e}`,o.disabled=!0,setTimeout(()=>{o.innerHTML=n,o.disabled=!1},2e3)}function A(){let o=[["opd-import-btn","download"],["opd-copy-btn","content_copy"],["opd-share-btn","share"],["opd-report-btn","flag"]];for(let[n,i]of o){let p=document.getElementById(n)?.querySelector(".material-symbols-rounded");p&&(p.outerHTML=s(i))}let e=document.querySelector(".opd-trust-icon.material-symbols-rounded");e&&(e.outerHTML=s("verified_user","opd-trust-icon"))}async function H(){A(),C({breadcrumb:t.breadcrumbCurrent,title:t.title,stats:t.stats,tags:t.tags,content:t.content}),await B("");let o=b();if(!o){t.status&&(t.status.textContent="Missing prompt id.");return}try{let{prompt:e}=await f(`/prompts/${encodeURIComponent(o)}`),n=`${window.location.origin}/p/${encodeURIComponent(e.id)}`;x(e,n),t.breadcrumbCurrent&&(c(t.breadcrumbCurrent),t.breadcrumbCurrent.textContent=e.title),t.title&&(c(t.title),t.title.textContent=e.title),t.stats&&t.stats.removeAttribute("aria-busy"),T(e),t.authorLink&&(t.authorLink.href=`/u/${encodeURIComponent(e.author)}`,t.authorLink.textContent=`@${e.author}`),t.tags&&g(t.tags,e.tags,{link:!0});let i=/#[a-zA-Z0-9_-]+#/.test(e.content||"");t.contentHint&&(t.contentHint.hidden=!i),t.content&&(t.content.classList.remove("opd-skeleton-content-block"),t.content.removeAttribute("aria-busy"),t.content.innerHTML=y(e.content)),t.copyBtn&&t.copyBtn.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(e.content),t.status&&(t.status.textContent=""),d(t.copyBtn,"Copied")}catch{t.status&&(t.status.textContent="Copy failed \u2014 select the prompt text manually.")}}),t.shareBtn&&t.shareBtn.addEventListener("click",async()=>{let a=await $(e);t.status&&(a==="shared"?t.status.textContent="Shared.":a==="copied"?(t.status.textContent="Share link copied to clipboard.",d(t.shareBtn,"Copied")):a==="cancelled"?t.status.textContent="":t.status.textContent="Share is not supported in this browser.")}),t.reportBtn&&t.reportBtn.addEventListener("click",()=>L(e)),t.importBtn&&t.importBtn.addEventListener("click",async()=>{t.importBtn.disabled=!0;let a=await I(e);t.importBtn.disabled=!1,a==="ok"?d(t.importBtn,"Added!"):a==="updated"?d(t.importBtn,"Updated!"):a==="already"&&d(t.importBtn,"In library"),t.status&&(a==="ok"?t.status.textContent="Added to Open Prompt Manager.":a==="updated"?t.status.textContent="Updated in Open Prompt Manager (catalog changed).":a==="already"?t.status.textContent="Already in your Open Prompt Manager library.":a==="no_extension"?t.status.textContent=w():t.status.textContent="Could not import \u2014 try again or copy the prompt manually.")})}catch(e){t.title&&(t.title.textContent="Prompt not found"),t.breadcrumbCurrent&&(t.breadcrumbCurrent.textContent="Not found"),t.status&&(t.status.textContent=e.status===404?"This prompt does not exist or was removed.":"Could not load prompt.")}}H();
