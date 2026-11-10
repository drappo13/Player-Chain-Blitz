# Build client/src/data/photo-finish.json: ~4 BBC PL match reports per season, each with
# a real match photo (jpg, not a graphic), its own caption, the score, date and intro.
import json,urllib.request,urllib.parse,re,time,random,html,sys
UA={"User-Agent":"Mozilla/5.0"}
PER_SEASON=20
OUT=sys.argv[1]
random.seed(2026)
import hashlib,os,concurrent.futures as cf
os.makedirs("cache",exist_ok=True)
def get(u):
    f="cache/"+hashlib.md5(u.encode()).hexdigest()
    if os.path.exists(f): return open(f,"rb").read()
    for i in range(3):
        try:
            b=urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=25).read()
            if "scores-fixtures" not in u: open(f,"wb").write(b)
            return b
        except Exception as e:
            if i==2: raise
            time.sleep(3)
clean=lambda s: re.sub(r"\s+"," ",html.unescape(re.sub(r"<.*?>","",s or ""))).strip()
CUP=re.compile(r"Shield|Cup|Champions League|Europa|Conference|friendly|Carabao|play-off",re.I)
SCORE=re.compile(r"^(.+?) (\d+)-(\d+) (.+)$")
def season_of(date):
    if "2020-07-01"<=date<="2020-08-09": return 2019  # COVID restart ran into the summer
    y,m=int(date[:4]),int(date[5:7]); return y if m>=7 else y-1
def https(u): return u.replace("http://","https://")

def old(url):
    raw=get(url).decode("latin-1")
    g=lambda p:(m.group(1) if (m:=re.search(p,raw,re.S|re.I)) else None)
    head=clean(g(r'<meta name="Headline" content="([^"]*)"'))
    score=head if SCORE.match(head) else None
    if not score:
        b=re.search(r"<b>([A-Z][A-Za-z .'&]+ \d+-\d+ [A-Z][A-Za-z .'&]+)</b>",raw); score=b and clean(b.group(1))
    if not score: return None
    m=None
    for mm in re.finditer(r"<img[^>]+/media/images/[^>]+>",raw):
        if "holdingImage" in mm.group(0): continue
        w=re.search(r'width="(\d+)"',mm.group(0))
        if w and int(w.group(1))>=150: m=mm; break
    if not m: return None
    tag=m.group(0); src=re.search(r'src="([^"]+)"',tag).group(1)
    if not src.lower().endswith(".jpg"): return None
    alt=clean((re.search(r'alt="([^"]*)"',tag) or [None,""])[1])
    rest=raw[m.end():]; nxt=re.search(r"<img[^>]+/media/images/",rest)
    cm=re.search(r'class="cap"[^>]*>(.*?)</',rest[:nxt.start()] if nxt else rest[:3000],re.S)
    caption=(clean(cm.group(1)) if cm else "") or alt
    date=(g(r'OriginalPublicationDate" content="([^"]+)"') or "")[:10].replace("/","-")
    intro=clean(g(r'<meta name="Description" content="([^"]*)"'))
    w=int(re.search(r'width="(\d+)"',tag).group(1))
    return dict(date=date,score=score,caption=caption,intro=intro,img=https(src),url=url,small=w<300)

def figures(raw):
    out=[]
    for f in re.findall(r"<figure.*?</figure>",raw,re.S):
        srcs=re.findall(r'(https://ichef\.bbci\.co\.uk/[^"\s,]+)\s+(\d+)w',f)
        if not srcs: continue
        src=urllib.parse.quote(html.unescape(max(srcs,key=lambda x:int(x[1]))[0].replace(".webp","")),safe=":/%")
        if not re.search(r"\.jpe?g$",src,re.I): continue  # pngs are stats graphics
        fc=re.search(r"<figcaption.*?</figcaption>",f,re.S)
        cap=clean(fc.group(0)).replace("Image caption,","").strip() if fc else ""
        if not fc:  # 2013-era lead photos carry only alt text
            alt=re.search(r'<img[^>]*alt="([^"]*)"',f)
            cap=clean(alt.group(1)) if alt else ""
            if len(cap)<6 or cap.lower() in ("image","football","bbc sport"): continue
        if not cap or cap.startswith("Media caption") or cap.startswith("Figure caption"): continue
        out.append((re.sub(r"/standard/\d+/","/standard/976/",src),cap))
    return out

def modern(url):
    raw=get(url).decode("utf-8","ignore")
    g=lambda p:(m.group(1) if (m:=re.search(p,raw,re.S)) else None)
    section=g(r'property="article:section" content="([^"]+)"')
    desc=clean(g(r'property="og:description" content="([^"]+)"'))
    title=clean(g(r"<h1[^>]*>(.*?)</h1>")).split(":")[0].strip()
    # Pre-2016 reports file under plain "Football"; keep those unless they're a cup game
    if section!="Premier League" and not (section=="Football" and not CUP.search(title+" "+desc)): return None
    if not SCORE.match(title): return None
    figs=figures(raw)
    if not figs: return None
    img,cap=figs[0]
    return dict(date=(g(r'"datePublished":"([^"]+)"') or "")[:10],score=title,caption=cap,
        intro=desc,img=img,url=url.replace("/sport/0/","/sport/"),small=False)

def live(url):
    raw=get(url).decode("utf-8","ignore")
    g=lambda p:(m.group(1) if (m:=re.search(p,raw,re.S)) else None)
    ft=g(r">([^<>]+? \d+ , [^<>]+? \d+) at Full time<")
    if not ft: return None
    mm=re.match(r"(.+?) (\d+) , (.+?) (\d+)$",clean(ft))
    score=f"{mm.group(1)} {mm.group(2)}-{mm.group(4)} {mm.group(3)}"
    title=clean(g(r'property="og:title" content="([^"]+)"'))
    figs=figures(raw)
    if figs: img,cap=figs[0]
    else:
        og=g(r'property="og:image" content="([^"]+)"') or ""
        if "ichef" not in og: return None
        img=re.sub(r"/ace/branded_sport/\d+/","/ace/standard/1024/",og)
        cap=re.sub(r"^[^:]*\d+-\d+[^:]*:\s*","",title)
    return dict(date=(g(r'"datePublished":"([^"]+)"') or "")[:10],score=score,caption=cap,
        intro=clean(g(r'property="og:description" content="([^"]+)"')),img=img,url=url,small=False)

def prettify(r):
    m=SCORE.match(r["score"]); r["score"]=f"{m.group(1)} {m.group(2)}–{m.group(3)} {m.group(4)}"
    r["caption"]=r["caption"].replace("Watkson","Watkins"); return r

def usable(r):
    bad=re.compile(r"preview|team news|follow live|live text",re.I)
    return len(r["caption"])>=12 and len(r["intro"])>=30 and not bad.search(r["caption"]) and not bad.search(r["intro"])
pool={};seen=set()
def take(s,urls,fn):
    """Fetch candidates for season s in parallel batches until PER_SEASON are accepted."""
    for k in range(0,len(urls),16):
        if len(pool.get(s,[]))>=PER_SEASON: return
        batch=urls[k:k+16]
        with cf.ThreadPoolExecutor(8) as ex:
            res=list(ex.map(lambda u:(u,_try(fn,u)),batch))
        for u,r in res:
            if len(pool.get(s,[]))>=PER_SEASON: return
            if not r or not r["date"] or season_of(r["date"])!=s or not usable(r): continue
            if r["date"][5:7]=="07" and not r["date"].startswith("2020"): continue  # pre-season friendlies
            key=(r["score"],r["date"])
            if r["url"] in seen or key in seen or r["img"] in seen: continue
            seen.update([r["url"],key,r["img"]])
            r["season"]=s; pool.setdefault(s,[]).append(prettify(r))
def _try(fn,u):
    try: return fn(u)
    except Exception: return None
links={}
for fname in ["links.json","wiki_links.json","gather.json"]:
    for t,ls in json.load(open(fname)).items(): links.setdefault(int(t[:4]),[]).extend(l for l in ls if "web.archive" not in l)
for s in sorted(links):
    if s>=2024: continue
    ls=list(dict.fromkeys(links[s])); random.shuffle(ls)
    take(s,ls,lambda u: old(u) if u.endswith(".stm") else modern(u))
    print(s,len(pool.get(s,[])),"from",len(ls),flush=True)
# 2024/25 onwards: BBC's fixtures pages link the live match pages
def months(a,b):
    y,m=a; out=[]
    while (y,m)<=b: out.append(f"{y}-{m:02d}"); m+=1; y,m=(y+1,1) if m>12 else (y,m)
    return [x for x in out if x[5:7] not in ("06","07")]
for s,(a,b) in {2024:((2024,8),(2025,5)),2025:((2025,8),(2026,5)),2026:((2026,8),(2026,11))}.items():
    ls=[]
    for mo in months(a,b):
        try: fx=get(f"https://www.bbc.co.uk/sport/football/premier-league/scores-fixtures/{mo}").decode("utf-8","ignore")
        except Exception: continue
        ls+=sorted(set(re.findall(r"/sport/football/live/[a-z0-9]{10,}",fx)))
    ls=list(dict.fromkeys(ls)); random.shuffle(ls)
    take(s,["https://www.bbc.co.uk"+l for l in ls],live)
    print(s,len(pool.get(s,[])),"from",len(ls),flush=True)
flat=sorted((r for v in pool.values() for r in v),key=lambda r:r["date"])
json.dump([{k:r[k] for k in ["season","date","score","caption","intro","img","url","small"]} for r in flat],open(OUT,"w"),indent=1,ensure_ascii=False)
print("TOTAL",len(flat),{s:len(v) for s,v in sorted(pool.items())})
