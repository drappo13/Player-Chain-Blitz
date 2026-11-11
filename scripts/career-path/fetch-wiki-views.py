# Fetches average monthly English Wikipedia views for every PL player into views_all.json
# (then merge into client/src/data/pl-players.json as wikiViews). The batch API returns page
# views in instalments, so follow 'continue' for every batch.
import json,urllib.request,urllib.parse,time,re
UA={"User-Agent":"drapkin-research/0.1 (personal hobby; github drappo13)"}
REPO=__import__("os").path.abspath(__import__("os").path.join(__import__("os").path.dirname(__file__),"../.."))
P=json.load(open(f"{REPO}/client/src/data/pl-players.json"))
def batch(titles):
    for i in range(6):
        try:
            u="https://en.wikipedia.org/w/api.php?"+urllib.parse.urlencode(dict(action="query",titles="|".join(titles),prop="pageviews|description",redirects=1,format="json",formatversion=2))
            return json.load(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=30))
        except Exception as e:
            print("retry",e,flush=True); time.sleep(5*(i+1))
    return None
def lookup(cands):
    """cands: {pid: title}. Returns {pid: (title, monthly views)} for footballer articles."""
    found={}; items=list(cands.items())
    for k in range(0,len(items),50):
        chunk=items[k:k+50]; d=batch([t for _,t in chunk])
        if not d: continue
        q=d["query"]; alias={}
        for m in q.get("normalized",[])+q.get("redirects",[]): alias[m["from"]]=m["to"]
        pages={p["title"]:p for p in q.get("pages",[])}
        for pid,t in chunk:
            tt=t
            while tt in alias: tt=alias[tt]
            p=pages.get(tt)
            if not p or p.get("missing"): continue
            desc=(p.get("description") or "").lower()
            if "football" not in desc and "soccer" not in desc: continue
            pv=[v for v in (p.get("pageviews") or {}).values() if v is not None]
            found[pid]=(p["title"], round(sum(pv)/max(1,len(pv))*30))
        time.sleep(0.5)
        print(k+len(chunk),"/",len(items),flush=True)
    return found
out={}
names={int(p["playerId"]):p["displayName"] for p in P}
dob={int(p["playerId"]):(re.search(r"(\d{4})",p.get("dob","")) or [None,""])[1] for p in P}
todo=dict(names)
for variant in ["{n}","{n} (footballer)","{n} (footballer, born {y})","{n} (English footballer)","{n} (Scottish footballer)","{n} (Welsh footballer)","{n} (Irish footballer)"]:
    if not todo: break
    print("variant",variant,len(todo),flush=True)
    f=lookup({pid:variant.format(n=names[pid],y=dob[pid]) for pid in todo})
    out.update(f)
    for pid in f: todo.pop(pid,None)
json.dump({str(k):v for k,v in out.items()},open("views_all.json","w"))
print("DONE matched",len(out),"of",len(names))

# --- second pass: page views for any matched article that came back empty ---
import json,urllib.request,urllib.parse,time
UA={"User-Agent":"drapkin-research/0.1 (personal hobby; github drappo13)"}
V=json.load(open("views_all.json"))
zero=[(k,t) for k,(t,v) in V.items() if not v]
def get(params):
    for i in range(8):
        try:
            u="https://en.wikipedia.org/w/api.php?"+urllib.parse.urlencode(params)
            return json.load(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=30))
        except Exception as e: print("retry",e,flush=True); time.sleep(5*(i+1))
for k0 in range(0,len(zero),50):
    chunk=zero[k0:k0+50]; titles=[t for _,t in chunk]
    params=dict(action="query",titles="|".join(titles),prop="pageviews",format="json",formatversion=2)
    views={}
    while True:
        d=get(params)
        if not d: break
        for p in d["query"]["pages"]:
            pv=[v for v in (p.get("pageviews") or {}).values() if v is not None]
            if pv: views[p["title"]]=round(sum(pv)/len(pv)*30)
        if "continue" not in d: break
        params.update(d["continue"]); time.sleep(0.4)
    for k,t in chunk:
        if t in views: V[k][1]=views[t]
    print(k0+len(chunk),"/",len(zero),flush=True); time.sleep(0.4)
json.dump(V,open("views_all.json","w"))
print("DONE still zero:",sum(1 for t,v in V.values() if not v))
