(() => {
  const cfg = window.LAB_CONFIG || {};
  const DATA = window.LAB_CONTENT || {projects:[],blogs:[],site:{base:""}};
  const qs = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => [...r.querySelectorAll(s)];
  const escapeHtml = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  // Theme + sound
  const savedTheme = localStorage.getItem("lab-theme");
  if(savedTheme) document.documentElement.dataset.theme = savedTheme;
  qs("#themeToggle")?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next; localStorage.setItem("lab-theme", next);
  });
  let audioCtx;
  let soundOn = false;
  function tone(freq=220, dur=.06){
    if(!soundOn) return;
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const o=audioCtx.createOscillator(), g=audioCtx.createGain();
    o.frequency.value=freq; o.type="sine"; g.gain.setValueAtTime(.0001,audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(.018,audioCtx.currentTime+.01); g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+dur);
    o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime+dur+.02);
  }
  qs("#soundToggle")?.addEventListener("click",()=>{soundOn=!soundOn; if(soundOn) tone(260,.08); qs("#soundToggle").textContent=soundOn?"◉":"♪";});

  // Mobile nav
  qs(".nav-toggle")?.addEventListener("click",()=>{
    const links=qs("#navLinks"), open=links.classList.toggle("open");
    qs(".nav-toggle").setAttribute("aria-expanded",String(open));
  });
  qsa("#navLinks a").forEach(a=>a.addEventListener("click",()=>qs("#navLinks")?.classList.remove("open")));

  // Unpredictable but deterministic-per-visit loader.
  const visit = Number(localStorage.getItem("lab-visit-count") || 0) + 1;
  localStorage.setItem("lab-visit-count", String(visit));
  const thoughts = ["মনের ভেতর কী চলছে?","আপনি কিছু খুঁজছেন।","কোনটা আগে দেখবেন?","কিছু একটা connect হচ্ছে।","এইবার একটু অন্যভাবে দেখুন।"];
  const loaders = ["INIT /","THINK /","TRACE /","SYNC /","DISCOVER /"];
  qs("#loaderThought").textContent = thoughts[(visit-1)%thoughts.length];
  const loaderCode = qs("#loaderCode");
  let progress=0; const timer=setInterval(()=>{progress += Math.round(7+Math.random()*16); loaderCode.textContent=`${loaders[(visit-1)%loaders.length]} ${Math.min(progress,100)}%`; if(progress>=100){clearInterval(timer); setTimeout(()=>qs("#loader")?.classList.add("hide"),260)}},70);

  // Reveal observer
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if(e.isIntersecting){e.target.classList.add("visible"); tone(150,.04); io.unobserve(e.target);}
  }), {threshold:.14});
  qsa(".reveal-section").forEach(el=>io.observe(el));

  // Surprise portrait: intent-like cues without recording/storing personal behavior.
  let hoverMs=0;
  const stage=qs("#portraitStage"), secret=qs("#portraitSecret"), hint=qs("#labHint");
  const reveal=()=>{ secret?.classList.add("revealed"); if(hint) hint.textContent="আবিষ্কার করেছেন।"; tone(410,.09); };
  stage?.addEventListener("mouseenter",()=>{hoverMs=Date.now()});
  stage?.addEventListener("mouseleave",()=>{if(Date.now()-hoverMs>1400) reveal();});
  stage?.addEventListener("focus", reveal);
  stage?.addEventListener("click", reveal);

  // Content cards + smart-ish search.
  const datasets = {
    projects:{items:DATA.projects, grid:"#projectsGrid", empty:"#projectsEmpty", search:"#projectSearch", filters:"#projectFilters", more:"#projectsMore", limit:8},
    blogs:{items:DATA.blogs, grid:"#blogsGrid", empty:"#blogsEmpty", search:"#blogSearch", filters:"#blogFilters", limit:6}
  };
  function card(item,type){
    const tags=(item.tags||[]).slice(0,5).map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join("");
    const href=`${DATA.site.base}${item.url}`;
    return `<article class="content-card" data-item="${escapeHtml(item.slug)}">
      ${item.featured?'<span class="featured-mark">FEATURED</span>':''}
      <div class="meta"><span>${escapeHtml(item.typeLabel||type.toUpperCase())}</span><span>${escapeHtml(item.dateLabel||"")}</span></div>
      <h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p>
      <div class="tag-row">${tags}</div><a class="card-link" href="${href}">Open ↗</a>
    </article>`;
  }
  function setup(type){
    const d=datasets[type]; if(!d.items?.length){qs(d.empty).hidden=false; return;}
    const tags=["All",...new Set(d.items.flatMap(x=>x.tags||[]))].slice(0,7);
    let activeTag="All", shown=d.limit;
    const renderFilters=()=>{qs(d.filters).innerHTML=tags.map((t,i)=>`<button type="button" class="${(activeTag===t?'active':'')}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join("")};
    renderFilters();
    qs(d.filters).addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;activeTag=b.dataset.tag;shown=d.limit;renderFilters();render();tone(210,.04)});
    qs(d.search).addEventListener("input",render);
    function score(item,q){
      if(!q) return 1;
      const hay=[item.title,item.description,item.contentSnippet,...(item.tags||[])].join(" ").toLowerCase();
      const words=q.toLowerCase().split(/\s+/).filter(Boolean);
      return words.reduce((s,w)=>s+(hay.includes(w)?1:0),0);
    }
    function render(){
      const q=qs(d.search).value.trim();
      let items=d.items.filter(x=>activeTag==="All"||(x.tags||[]).includes(activeTag))
        .map(x=>({...x,_score:score(x,q)})).filter(x=>!q||x._score>0).sort((a,b)=>(b._score-a._score)||Number(Boolean(b.pinned))-Number(Boolean(a.pinned))||Number(Boolean(b.featured))-Number(Boolean(a.featured))||String(b.date).localeCompare(String(a.date)));
      const total=items.length; items=items.slice(0,shown);
      qs(d.grid).innerHTML=items.map(x=>card(x,type)).join("");
      qs(d.empty).hidden=Boolean(total);
      if(d.more){d.more.hidden=total<=shown;d.more.onclick=()=>{shown+=d.limit;render()}}
    }
    render();
  }
  setup("projects"); setup("blogs");

  // Contact data conditional rendering
  const contactActions=qs("#contactActions");
  const actions=[];
  if(cfg.email) actions.push(`<a class="btn btn-primary magnetic" href="mailto:${escapeHtml(cfg.email)}">Email করুন ↗</a><button class="btn btn-ghost copy-email" type="button">Email copy</button>`);
  if(cfg.phone) actions.push(`<a class="btn btn-ghost magnetic" href="tel:${escapeHtml(cfg.phone)}">Call ↗</a>`);
  if(cfg.github) actions.push(`<a class="btn btn-ghost magnetic" target="_blank" rel="noreferrer" href="${escapeHtml(cfg.github)}">GitHub ↗</a>`);
  contactActions.innerHTML=actions.join("");
  qs(".copy-email")?.addEventListener("click", async()=>{try{await navigator.clipboard.writeText(cfg.email);qs(".copy-email").textContent="Copied ✓";tone(500,.08)}catch{}});
  qs("#year").textContent=new Date().getFullYear();

  // Magnetic micro-interaction
  qsa(".magnetic").forEach(el=>{
    el.addEventListener("pointermove",e=>{const r=el.getBoundingClientRect();el.style.transform=`translate(${(e.clientX-r.left-r.width/2)*.08}px, ${(e.clientY-r.top-r.height/2)*.08}px)`});
    el.addEventListener("pointerleave",()=>el.style.transform="");
  });

  // AI Assistant: local retrieval first; server proxy when configured.
  const panel=qs("#aiPanel"), launcher=qs("#aiLauncher"), close=qs("#aiClose"), msgs=qs("#aiMessages"), form=qs("#aiForm"), input=qs("#aiInput");
  launcher?.addEventListener("click",()=>{const open=!panel.hidden;panel.hidden=open;launcher.setAttribute("aria-expanded",String(!open));if(!open)input?.focus()});
  close?.addEventListener("click",()=>{panel.hidden=true;launcher.setAttribute("aria-expanded","false")});
  function addMsg(text,who="ai"){
    const div=document.createElement("div");div.className=`ai-msg ${who}`;
    if(who==="ai"){
      const safe=escapeHtml(text);
      const linked=safe.replace(/(https?:\/\/[^\s<]+)/g, url=>{
        const clean=url.replace(/[),.;]+$/,""), label=clean.length>55?clean.slice(0,52)+"…":clean;
        return `<a href="${clean}" target="_blank" rel="noreferrer">${label} ↗</a>`;
      });
      div.innerHTML=linked.replace(/\n/g,"<br>");
    }else div.textContent=text;
    msgs.appendChild(div);msgs.scrollTop=msgs.scrollHeight;
  }
  function localAnswer(q){
    const l=q.toLowerCase();
    if(l.includes("email")||l.includes("যোগাযোগ")||l.includes("contact")) return cfg.email?`যোগাযোগের জন্য email: ${cfg.email}`:"বর্তমানে public email দেওয়া নেই।";
    if(l.includes("github")) return `GitHub: ${cfg.github||"বর্তমানে দেওয়া নেই"}`;
    if(l.includes("who")||l.includes("কে")||l.includes("about")||l.includes("সম্পর্কে")) return `${cfg.owner} — ${cfg.role}. ${cfg.tagline}.`;
    if(l.includes("project")||l.includes("প্রজেক্ট")) return DATA.projects.slice(0,5).map(x=>`${x.title}: ${x.description}`).join(" | ") || "এখনও project index খালি।";
    if(l.includes("blog")||l.includes("ব্লগ")) return DATA.blogs.slice(0,5).map(x=>x.title).join(", ") || "এখনও blog index খালি।";
    const all=[...DATA.projects,...DATA.blogs];
    const hit=all.find(x=>[x.title,x.description,...(x.tags||[])].join(" ").toLowerCase().includes(l));
    return hit?`${hit.title}: ${hit.description}`:"এই প্রশ্নের উত্তর আমার প্রকাশিত site data-তে পাইনি। Project, blog, about বা contact নিয়ে জিজ্ঞেস করে দেখুন।";
  }
  async function answer(q){
    if(cfg.aiEndpoint){
      try{
        const r=await fetch(cfg.aiEndpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:q,context:{owner:cfg.owner,role:cfg.role,email:cfg.email,github:cfg.github,projects:DATA.projects,blogs:DATA.blogs,media:DATA.media||[]}})});
        if(!r.ok) throw new Error("AI endpoint failed");
        const data=await r.json(); return data.reply || localAnswer(q);
      }catch(e){return localAnswer(q)+" (AI service unavailable, local index used.)";}
    }
    return localAnswer(q);
  }
  form?.addEventListener("submit",async e=>{e.preventDefault();const q=input.value.trim();if(!q)return;input.value="";addMsg(q,"user");addMsg("একটু index দেখি…","ai");const last=msgs.lastElementChild;const reply=await answer(q);last.textContent=reply;tone(330,.07)});
  qsa("[data-ai-q]").forEach(b=>b.addEventListener("click",()=>{input.value=b.dataset.aiQ;form.requestSubmit()}));

  // Section-sensitive micro copy
  const copyMap={home:"আপনি প্রথম তিন সেকেন্ডে বুঝেছেন তো আমি কী করি? না হলে একটু নিচে যান।",projects:"এখানে machine-এর কাজ repetitive, আপনার কাজ explore করা।",blogs:"কিছু idea পড়লে মাথার ভেতর আরেকটা tab খুলে যায়।",contact:"Connection তৈরি হয় ছোট একটা message দিয়েই।"};
  const sectionHint=qs("#labHint");
  const observer=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting&&copyMap[e.target.id]) sectionHint.textContent=copyMap[e.target.id]}),{threshold:.55});
  ["home","projects","blogs","contact"].forEach(id=>{const el=qs("#"+id);if(el)observer.observe(el)});
})();
