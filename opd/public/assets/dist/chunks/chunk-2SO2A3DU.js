import{d as u,g as b,m as c,r as y}from"./chunk-ELWJDFFB.js";var g="Open Prompt Database",I="Community prompt templates for Open Prompt Manager. Browse, search, and import prompts into your library.";function C(e,t=window.location.origin){return`Hey, check out this prompt: ${String(e.title||"Untitled prompt").trim()}`}function O(e,t=window.location.origin){return e?.id?`${t}/og/p/${encodeURIComponent(e.id)}.svg`:`${t}/og/default.svg`}function k(e,t){let o=document.querySelector(e);return o||(o=t(),document.head.appendChild(o)),o}function s(e,t,o){let a=`meta[${e}="${t}"]`;k(a,()=>{let r=document.createElement("meta");return r.setAttribute(e,t),r}).setAttribute("content",o)}function S(e){let t=k('link[rel="canonical"]',()=>{let o=document.createElement("link");return o.rel="canonical",o});t.href=e}function L(e={}){let t=window.location.origin,o=e.path??window.location.pathname,a=`${t}${o}`,n=e.title??g,r=e.description??I,i=`${t}/og/default.svg`;document.title=n,s("name","description",r),S(a),s("property","og:type","website"),s("property","og:site_name",g),s("property","og:title",n),s("property","og:description",r),s("property","og:url",a),s("property","og:image",i),s("name","twitter:card","summary"),s("name","twitter:title",n),s("name","twitter:description",r),s("name","twitter:image",i)}function U(e,t){let o=window.location.origin,a=`${e.title} \u2014 ${g}`,n=C(e,o),r=O(e,o);document.title=a,s("name","description",n),S(t),s("property","og:type","article"),s("property","og:site_name",g),s("property","og:title",e.title),s("property","og:description",n),s("property","og:url",t),s("property","og:image",r),s("name","twitter:card","summary_large_image"),s("name","twitter:title",e.title),s("name","twitter:description",n),s("name","twitter:image",r);let i=document.getElementById("opd-jsonld");i&&i.remove();let m=document.createElement("script");m.id="opd-jsonld",m.type="application/ld+json",m.textContent=JSON.stringify({"@context":"https://schema.org","@type":"CreativeWork",name:e.title,description:n,url:t,image:r,author:{"@type":"Person",name:e.author},datePublished:e.publishedAt,keywords:(e.tags||[]).join(", ")}),document.head.appendChild(m)}var E="opd-theme-override",x="opd-theme",T=!1;function _(){try{let e=localStorage.getItem(x);(e==="light"||e==="dark")&&localStorage.setItem(E,e),e&&localStorage.removeItem(x)}catch{}}function A(){try{let e=localStorage.getItem(E);if(e==="light"||e==="dark")return e}catch{}return null}function l(){let e=A();return e||(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")}function H(e){try{localStorage.setItem(E,e)}catch{}w(l()),p()}function N(){H(l()==="dark"?"light":"dark")}function w(e){document.documentElement.dataset.opdTheme=e,document.body.classList.toggle("opd-theme-dark",e==="dark")}function B(e){return e==="dark"?{icon:"light_mode",label:"Switch to light theme"}:{icon:"dark_mode",label:"Switch to dark theme"}}function p(){let e=l(),{icon:t,label:o}=B(e);document.querySelectorAll("[data-opd-theme-toggle]").forEach(a=>{let n=a.querySelector(".opd-nav-drawer-btn-icon");n?n.innerHTML=c(t):a.innerHTML=c(t),a.setAttribute("aria-label",o),a.setAttribute("title",o)})}function P(){_(),w(l()),p(),T||(T=!0,window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",()=>{A()||w(l()),p()}),document.addEventListener("click",e=>{e.target.closest("[data-opd-theme-toggle]")&&(e.preventDefault(),N())}))}P();var d=8,$="https://chromewebstore.google.com/detail/open-prompt-manager/gmhaghdbihgenofhnmdbglbkbplolain",q=[{href:"/about",label:"About this catalog",description:"What Open Prompt Database is and how to use it safely.",iconKey:"info"},{href:"/about/changelog",label:"Changelog",description:"Site updates and Open Prompt Manager releases.",iconKey:"notes"},{href:"https://github.com/jonathanbertholet/promptmanager",label:"GitHub repository",description:"Source code, issues, and contributions.",external:!0,icon:"/assets/icons/md-github.svg"},{href:"https://buymeacoffee.com/jonathanbertholet",label:"Buy me a coffee",description:"Support the Open Prompt Manager project.",external:!0,icon:"/assets/icons/coffee.svg"}],h=null;async function W(){return h||(h=await import("./opd-search-7CQOQ4DA.js"),h.initSearch()),h}function D(){document.getElementById("opd-search-toggle")?.addEventListener("click",async()=>{let t=await W();document.body.classList.contains("opd-search-open")?t.closeSearch():t.openSearch()})}function v(){return window.matchMedia("(max-width: 900px)").matches}function R(e){let t=e.querySelector(".opd-nav-group-summary"),o=e.querySelector(".opd-mega-panel");if(!t||!o)return;let a=null,n=()=>{a&&(clearTimeout(a),a=null),document.querySelectorAll(".opd-nav-group.is-open").forEach(i=>{i!==e&&(i.classList.remove("is-open"),i.querySelector(".opd-nav-group-summary")?.setAttribute("aria-expanded","false"))}),e.classList.add("is-open"),t.setAttribute("aria-expanded","true")},r=()=>{a=setTimeout(()=>{e.classList.remove("is-open"),t.setAttribute("aria-expanded","false"),a=null},140)};e.addEventListener("mouseenter",()=>{v()||n()}),e.addEventListener("mouseleave",()=>{v()||r()}),o.addEventListener("mouseenter",()=>{!v()&&a&&clearTimeout(a)}),o.addEventListener("mouseleave",()=>{v()||r()}),t.addEventListener("click",i=>{i.preventDefault(),i.stopPropagation(),e.classList.contains("is-open")?(e.classList.remove("is-open"),t.setAttribute("aria-expanded","false")):n()}),document.addEventListener("keydown",i=>{i.key==="Escape"&&e.classList.contains("is-open")&&(e.classList.remove("is-open"),t.setAttribute("aria-expanded","false"))})}function j(){let e=document.getElementById("opd-nav-toggle"),t=document.getElementById("opd-nav-menu");if(!e||!t||e.dataset.opdMobileWired==="1")return;e.dataset.opdMobileWired="1";let o=a=>{document.body.classList.toggle("opd-nav-open",a),e.setAttribute("aria-expanded",a?"true":"false"),e.setAttribute("aria-label",a?"Close menu":"Open menu"),e.innerHTML=c(a?"close":"menu"),a||document.querySelectorAll(".opd-nav-group.is-open").forEach(n=>{n.classList.remove("is-open"),n.querySelector(".opd-nav-group-summary")?.setAttribute("aria-expanded","false")})};e.addEventListener("click",a=>{a.preventDefault(),a.stopPropagation(),o(!document.body.classList.contains("opd-nav-open"))}),t.querySelectorAll(".opd-nav-item, .opd-mega-panel a").forEach(a=>{a.addEventListener("click",()=>o(!1))}),document.documentElement.dataset.opdNavEscapeWired||(document.documentElement.dataset.opdNavEscapeWired="1",document.addEventListener("keydown",a=>{a.key==="Escape"&&document.body.classList.contains("opd-nav-open")&&o(!1)})),document.documentElement.dataset.opdNavOutsideWired||(document.documentElement.dataset.opdNavOutsideWired="1",document.addEventListener("click",a=>{document.body.classList.contains("opd-nav-open")&&(a.target.closest(".opd-nav-bar")||a.target.closest(".opd-nav-menu")||o(!1))},!0))}function G(e,t){e.innerHTML="";for(let o of t){let a=document.createElement("a");a.className="opd-mega-link",a.href=o.href,o.external&&(a.target="_blank",a.rel="noopener noreferrer");let n="";o.iconKey?n=c(o.iconKey,"opd-mega-link-icon opd-icon--symbol"):o.icon&&(n=`<span class="opd-mega-link-icon-wrap" aria-hidden="true"><img class="opd-mega-link-icon opd-mega-link-icon--img" src="${o.icon}" width="20" height="20" alt="" /></span>`),a.innerHTML=`
      ${n}
      <span class="opd-mega-link-text">
        <span class="opd-mega-link-label">${u(o.label)}</span>
        <span class="opd-mega-link-desc">${u(o.description)}</span>
      </span>
    `,e.appendChild(a)}}function f(e=[]){let t=document.getElementById("opd-mega-tags");if(t){if(t.innerHTML="",t.className="opd-mega-tag-grid",t.removeAttribute("aria-busy"),!e.length){t.textContent="No tags yet.";return}for(let{tag:o,count:a}of e){let n=document.createElement("a");n.className="opd-mega-link",n.href=`/t/${encodeURIComponent(o)}`,n.innerHTML=`
        <span class="opd-mega-link-text">
          <span class="opd-mega-link-label">${u(o)}</span>
          <span class="opd-mega-link-desc">${a} prompt${a===1?"":"s"}</span>
        </span>
      `,t.appendChild(n)}}}function K(e){document.querySelectorAll(".opd-nav-item").forEach(t=>{let o=t.getAttribute("href")||"",a=e==="home"&&o==="/",n=e==="browse"&&o==="/browse";t.classList.toggle("is-active",a||n)}),document.querySelectorAll(".opd-nav-group").forEach(t=>{let o=t.dataset.navGroup||"",a=t.querySelector(".opd-nav-group-summary");a&&a.classList.toggle("is-active",e===o)})}function M(e){K(e),document.documentElement.dataset.opdNavWired!=="1"&&(document.documentElement.dataset.opdNavWired="1",document.querySelectorAll(".opd-nav-group").forEach(R),document.querySelectorAll(".opd-mega-panel").forEach(t=>t.removeAttribute("hidden")),G(document.getElementById("opd-mega-about-links"),q),D(),p()),j()}async function ee(e="",t=null){t&&L(t);let o=document.getElementById("opd-nav-root");if(!o)return;if(o.hasAttribute("data-opd-nav-prerendered")||o.querySelector(".opd-nav-bar")){M(e);let n=document.getElementById("opd-mega-tags");if(t?.popularTags?.length){f(t.popularTags.slice(0,d));return}y(n,d);try{let{items:r}=await b(`/tags?popular=${d}`);f(r)}catch{n&&(n.textContent="Could not load tags.")}return}o.innerHTML=`
    <nav class="opd-nav-bar" aria-label="Main navigation">
      <div class="opd-nav-bar-inner">
        <a href="/" class="opd-nav-brand">
          <img src="/assets/icons/icon128.png" alt="" width="26" height="26" />
          <span class="opd-nav-brand-text">
            <span class="opd-nav-brand-title">Open Prompt Database</span>
            <span class="opd-nav-brand-sub">Community catalog for Open Prompt Manager</span>
          </span>
        </a>

        <div class="opd-nav-menu" id="opd-nav-menu">
          <a href="/" class="opd-nav-item${e==="home"?" is-active":""}">Home</a>
          <a href="/browse" class="opd-nav-item${e==="browse"?" is-active":""}">Browse</a>

          <div class="opd-nav-group" data-nav-group="tags">
            <button type="button" class="opd-nav-group-summary${e==="tags"?" is-active":""}" aria-expanded="false" aria-haspopup="true">
              <span>Tags</span>
              <span class="opd-nav-chevron">${c("expand_more")}</span>
            </button>
            <div class="opd-mega-panel" hidden>
              <div class="opd-mega-shell">
                <div class="opd-mega-intro">
                  <span class="opd-mega-eyebrow">Browse</span>
                  <p class="opd-mega-title">Tags</p>
                  <p class="opd-mega-description">Jump into popular categories or open the full directory grouped by letter.</p>
                </div>
                <div class="opd-mega-body">
                  <div class="opd-mega-tag-grid" id="opd-mega-tags" aria-live="polite"></div>
                  <div class="opd-mega-footer">
                    <a href="/tags" class="opd-mega-action">
                      ${c("apps")}
                      See all tags
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="opd-nav-group" data-nav-group="about">
            <button type="button" class="opd-nav-group-summary${e==="about"?" is-active":""}" aria-expanded="false" aria-haspopup="true">
              <span>About</span>
              <span class="opd-nav-chevron">${c("expand_more")}</span>
            </button>
            <div class="opd-mega-panel" hidden>
              <div class="opd-mega-shell opd-mega-shell--compact">
                <div class="opd-mega-intro">
                  <span class="opd-mega-eyebrow">About</span>
                  <p class="opd-mega-title">Open Prompt Database</p>
                  <p class="opd-mega-description">How this catalog works, trust &amp; safety, and project links.</p>
                </div>
                <div class="opd-mega-body">
                  <div class="opd-mega-links opd-mega-links--stacked" id="opd-mega-about-links"></div>
                </div>
              </div>
            </div>
          </div>

          <div class="opd-nav-menu-footer" aria-label="Preferences and extension">
            <button type="button" class="opd-nav-drawer-btn" data-opd-theme-toggle aria-label="Switch theme">
              <span class="opd-nav-drawer-btn-icon" aria-hidden="true">${c("dark_mode")}</span>
              <span>Theme</span>
            </button>
            <a href="${$}" class="opd-chrome-cta opd-chrome-cta--drawer" target="_blank" rel="noopener noreferrer">
              <span class="opd-chrome-cta-icon-wrap" aria-hidden="true">
                <img src="/assets/icons/chrome.svg?v=2" class="opd-chrome-cta-icon" width="22" height="22" alt="" />
              </span>
              <span class="opd-chrome-cta-label">Get Chrome Extension</span>
            </a>
          </div>
        </div>

        <div class="opd-nav-end">
          <div class="opd-nav-actions opd-nav-actions--bar">
            <button type="button" class="opd-nav-icon-btn" id="opd-search-toggle" aria-label="Search prompts" title="Search">
              ${c("search")}
            </button>
            <button type="button" class="opd-nav-icon-btn" data-opd-theme-toggle aria-label="Switch theme">
              ${c("dark_mode")}
            </button>
            <a href="${$}" class="opd-chrome-cta" target="_blank" rel="noopener noreferrer" title="Chrome Extension">
              <span class="opd-chrome-cta-icon-wrap" aria-hidden="true">
                <img src="/assets/icons/chrome.svg?v=2" class="opd-chrome-cta-icon" width="22" height="22" alt="" />
              </span>
              <span class="opd-chrome-cta-label">Chrome Extension</span>
            </a>
          </div>
          <button
            type="button"
            class="opd-nav-toggle"
            id="opd-nav-toggle"
            aria-expanded="false"
            aria-controls="opd-nav-menu"
            aria-label="Open menu"
          >
            ${c("menu")}
          </button>
        </div>
      </div>
    </nav>
    <div class="opd-nav-spacer" aria-hidden="true"></div>
  `,M(e);let a=document.getElementById("opd-mega-tags");if(t?.popularTags?.length){f(t.popularTags.slice(0,d));return}y(a,d);try{let{items:n}=await b(`/tags?popular=${d}`);f(n)}catch{a&&(a.textContent="Could not load tags.")}}export{C as a,L as b,U as c,f as d,ee as e};
