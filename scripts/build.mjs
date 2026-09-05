import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SITE = path.join(ROOT, "site");
const DIST = path.join(ROOT, "dist");
const CONTENT = path.join(ROOT, "content");
const SITE_ORIGIN = (process.env.SITE_ORIGIN || "").replace(/\/+$/,"");
const repo = process.env.GITHUB_REPOSITORY || "";
const pagesBase = process.env.GITHUB_ACTIONS && repo.includes("/")
  ? `/${repo.split("/")[1]}`
  : "";
const BASE = process.env.SITE_BASE || pagesBase;

const ensure = p => fs.mkdirSync(p,{recursive:true});
const copyDir = (src,dst) => {
  ensure(dst);
  for(const item of fs.readdirSync(src,{withFileTypes:true})){
    const a=path.join(src,item.name), b=path.join(dst,item.name);
    item.isDirectory()?copyDir(a,b):fs.copyFileSync(a,b);
  }
};
const clean = p => { if(fs.existsSync(p)) fs.rmSync(p,{recursive:true,force:true}); };
const read = p => fs.readFileSync(p,"utf8");

function parseFrontmatter(raw){
  const m=raw.match(/^---\s*([\s\S]*?)\s*---\s*/);
  if(!m) return {meta:{}, body:raw};
  const meta={};
  for(const line of m[1].split(/\r?\n/)){
    const i=line.indexOf(":"); if(i<0) continue;
    const k=line.slice(0,i).trim(), v=line.slice(i+1).trim();
    meta[k]=v.replace(/^['"]|['"]$/g,"");
  }
  return {meta,body:raw.slice(m[0].length)};
}
function fallbackMeta(folder, raw, type){
  const {meta,body}=parseFrontmatter(raw);
  const h=body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const firstP=(body.split(/\r?\n/).find(x=>x.trim() && !x.startsWith("#") && !x.startsWith("-"))||"").trim();
  const title=meta.title || h || folder.replace(/[-_]+/g," ").replace(/\b\w/g,c=>c.toUpperCase());
  const description=meta.description || firstP.slice(0,180) || `${title} — ${type}.`;
  const tags=(meta.tags||meta.category||type).split(",").map(x=>x.trim()).filter(Boolean);
  const stat=fs.statSync(path.join(CONTENT,type,folder));
  return {meta,body,title,description,tags,date:meta.date||stat.mtime.toISOString().slice(0,10),snippet:firstP.slice(0,260)};
}
function listContent(type){
  const root=path.join(CONTENT,type); if(!fs.existsSync(root)) return [];
  return fs.readdirSync(root,{withFileTypes:true}).filter(x=>x.isDirectory()).map(dir=>{
    const folder=dir.name, full=path.join(root,folder), md=path.join(full,"content.md");
    let raw="";
    if(fs.existsSync(md)) raw=read(md);
    else {
      const possible=fs.readdirSync(full).find(x=>/\.md$/i.test(x));
      if(possible) raw=read(path.join(full,possible));
    }
    const d=fallbackMeta(folder,raw||`# ${folder}`,type);
    const images=fs.readdirSync(full).filter(x=>/\.(png|jpe?g|webp|avif|gif)$/i.test(x));
    const cover=images[0] ? `${type}/${folder}/${images[0]}` : "";
    return {
      slug:folder,title:d.title,description:d.description,tags:d.tags,category:d.meta.category||d.tags[0]||"General",
      featured:/^(true|yes|1)$/i.test(d.meta.featured||""),pinned:/^(true|yes|1)$/i.test(d.meta.pinned||""),
      date:d.date, dateLabel:d.date, typeLabel:type==="projects"?"PROJECT":"BLOG", cover,
      github:d.meta.github||"", live:d.meta.live||"", contentSnippet:d.snippet,
      url:`${type}/${folder}/`
    };
  }).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function mdToHtml(md){
  const {body}=parseFrontmatter(md);
  let s=esc(body).replace(/^### (.+)$/gm,"<h3>$1</h3>").replace(/^## (.+)$/gm,"<h2>$1</h2>").replace(/^# (.+)$/gm,"<h1>$1</h1>")
    .replace(/^\-\s+(.+)$/gm,"<li>$1</li>").replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")
    .replace(/\n{2,}/g,"</p><p>").replace(/\n/g,"<br>");
  s=s.replace(/(<li>.*?<\/li>)/gs,"<ul>$1</ul>");
  return `<p>${s}</p>`;
}
function detailPage(item,type,raw){
  const title=esc(item.title), desc=esc(item.description);
  const canonical=(SITE_ORIGIN||"")+`${BASE}/${item.url}`.replace(/\/{2,}/g,"/");
  const body=mdToHtml(raw||`# ${item.title}\n\n${item.description}`);
  const related=[...(type==="projects"?listContent("projects"):listContent("blogs"))].filter(x=>x.slug!==item.slug).slice(0,3);
  return `<!doctype html><html lang="bn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — Obaid's Laboratory</title><meta name="description" content="${desc}"><meta name="robots" content="index,follow"><link rel="canonical" href="${esc(canonical)}"><link rel="icon" href="${BASE}/assets/favicon.svg"><link rel="stylesheet" href="${BASE}/assets/app.css"><style>.detail{max-width:900px;margin:0 auto;padding:140px 20px 80px}.detail article{padding:32px;border:1px solid var(--line);border-radius:24px;background:var(--surface)}.detail h1{font-size:clamp(2.4rem,6vw,5rem);line-height:1}.detail h2{margin-top:2em}.detail-nav{display:flex;justify-content:space-between;gap:10px;margin-bottom:24px}.related{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:25px}@media(max-width:720px){.related{grid-template-columns:1fr}}</style></head><body><header class="nav-shell"><nav class="nav"><a class="brand" href="${BASE}/#home"><span class="brand-mark">O</span><span><strong>Obaid's</strong><small>Laboratory</small></span></a><a class="btn btn-ghost" href="${BASE}/#${type}">← Back</a></nav></header><main class="detail"><div class="detail-nav"><span class="eyebrow">${type==="projects"?"PROJECT":"BLOG"}</span><span class="eyebrow">${esc(item.dateLabel)}</span></div><article>${item.cover?`<img src="${BASE}/${item.cover}" alt="${title}" loading="lazy" style="display:block;width:100%;max-height:420px;object-fit:cover;border-radius:18px;margin-bottom:24px">`:``}${body}<div class="tag-row">${item.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join("")}</div>${item.live?`<p><a class="btn btn-primary" target="_blank" rel="noreferrer" href="${esc(item.live)}">Live preview ↗</a></p>`:""}${item.github?`<p><a class="btn btn-ghost" target="_blank" rel="noreferrer" href="${esc(item.github)}">GitHub ↗</a></p>`:""}</article><div class="related">${related.map(r=>`<a class="content-card" href="${BASE}/${r.url}"><div class="meta"><span>${r.typeLabel}</span></div><h3>${esc(r.title)}</h3><p>${esc(r.description)}</p></a>`).join("")}</div></main><footer class="footer"><div><strong>Obaid's Laboratory</strong><span>Think differently build smartly</span></div><div>© ${new Date().getFullYear()} Mohammed Obaidul Hoque</div></footer></body></html>`;
}

clean(DIST); ensure(DIST); copyDir(SITE,DIST);
for(const t of ["projects","blogs"]){ const items=listContent(t); for(const item of items){
  const folder=path.join(CONTENT,t,item.slug); const md=fs.readdirSync(folder).find(x=>/\.md$/i.test(x)); if(!md) continue;
  const out=path.join(DIST,t,item.slug,"index.html"); ensure(path.dirname(out));
  fs.writeFileSync(out,detailPage(item,t,read(path.join(folder,md))));
  for(const f of fs.readdirSync(folder)){ if(f!==md){ const s=path.join(folder,f); if(fs.statSync(s).isFile()) fs.copyFileSync(s,path.join(DIST,t,item.slug,f));}}
}}
const projects=listContent("projects"), blogs=listContent("blogs");
const media=[];
function collectMedia(dir, rel=""){
  if(!fs.existsSync(dir)) return;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name), r=rel?`${rel}/${entry.name}`:entry.name;
    if(entry.isDirectory()) collectMedia(full,r);
    else if(/\.(png|jpe?g|webp|avif|gif|mp4|webm)$/i.test(entry.name)) media.push({path:r,type:/\.(mp4|webm)$/i.test(entry.name)?"video":"image"});
  }
}
collectMedia(path.join(ROOT,"assets"),"assets");
collectMedia(path.join(CONTENT),"content");
ensure(path.join(DIST,"assets"));
fs.writeFileSync(path.join(DIST,"assets","content.js"),`window.LAB_CONTENT=${JSON.stringify({projects,blogs,media,site:{base:BASE}})};`);
const origin=SITE_ORIGIN || (process.env.GITHUB_REPOSITORY?`https://${process.env.GITHUB_REPOSITORY.split("/")[0]}.github.io`:"");
const siteUrl=`${origin}${BASE}/`.replace(/\/+/g,"/").replace("https:/","https://");
const urls=["",...projects.map(x=>x.url),...blogs.map(x=>x.url)];
const sitemap=`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u=>`<url><loc>${esc(siteUrl+u)}</loc></url>`).join("")}</urlset>`;
fs.writeFileSync(path.join(DIST,"sitemap.xml"),sitemap);
fs.writeFileSync(path.join(DIST,"robots.txt"),`User-agent: *\nAllow: /\nSitemap: ${siteUrl}sitemap.xml\n`);
fs.writeFileSync(path.join(DIST,"feed.xml"),`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Obaid's Laboratory</title><link>${esc(siteUrl)}</link><description>Projects and blogs by Mohammed Obaidul Hoque</description>${[...blogs,...projects].slice(0,20).map(x=>`<item><title>${esc(x.title)}</title><link>${esc(siteUrl+x.url)}</link><description>${esc(x.description)}</description><pubDate>${new Date(x.date).toUTCString()}</pubDate></item>`).join("")}</channel></rss>`);


function validateOutput(){
  const required=["index.html","assets/app.css","assets/app.js","assets/content.js","sitemap.xml","robots.txt","feed.xml"];
  const missing=required.filter(x=>!fs.existsSync(path.join(DIST,x)));
  if(missing.length) throw new Error(`Missing: ${missing.join(", ")}`);
  const htmlFiles=[];
  const walk=(dir)=>{
    for(const d of fs.readdirSync(dir,{withFileTypes:true})){
      const f=path.join(dir,d.name); if(d.isDirectory()) walk(f); else if(/\.html$/i.test(d.name)) htmlFiles.push(f);
    }
  }; walk(DIST);
  const broken=new Set();
  for(const f of htmlFiles){
    const raw=read(f);
    for(const m of raw.matchAll(/(?:href|src)="([^"]+)"/g)){
      let u=m[1]; if(!u || /^(https?:|mailto:|tel:|#|data:|javascript:)/i.test(u)) continue;
      u=u.split("#")[0].split("?")[0];
      const target=path.join(path.dirname(f),u);
      if(!fs.existsSync(target) && !fs.existsSync(path.join(DIST,u.replace(/^\/+/,"")))) broken.add(`${path.relative(DIST,f)} -> ${u}`);
    }
  }
  if(broken.size) throw new Error(`Broken local references:\n${[...broken].join("\n")}`);
  console.log(`Integrity OK: ${htmlFiles.length} HTML files, ${projects.length} projects, ${blogs.length} blogs, ${urls.length} URLs.`);
}

if(process.argv.includes("--validate-only")){
  validateOutput();
} else {
  console.log(`Built ${DIST}: ${projects.length} projects, ${blogs.length} blogs.`);
}
