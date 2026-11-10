# Fetches every PL player's season-by-season apps/goals/assists per club into careers.json
# (run from this folder; then run build-career-path.py, which also needs standings.json:
# the final PL table for each season, from /football/standings?compSeasons=<id>).
# Per-season, per-club PL apps/goals/assists for every player, from the PL stats API.
import json,urllib.request,time,re,concurrent.futures as cf
H={"Origin":"https://www.premierleague.com","User-Agent":"Mozilla/5.0"}
def get(u):
    for i in range(4):
        try: return json.load(urllib.request.urlopen(urllib.request.Request(u,headers=H),timeout=30))
        except Exception as e: time.sleep(2*(i+1))
    return None
API="https://footballapi.pulselive.com/football"
seasons=[(int(s["id"]),int(re.search(r"(\d{4})/\d{2}",s["label"]).group(1))) for s in get(f"{API}/competitions/1/compseasons?page=0&pageSize=100")["content"] if re.search(r"(\d{4})/\d{2}",s["label"])]
jobs=[]
for sid,year in seasons:
    for t in get(f"{API}/compseasons/{sid}/teams") or []:
        jobs.append((sid,year,int(t["id"]),t.get("shortName") or t["name"]))
print(len(seasons),"seasons",len(jobs),"team-seasons",flush=True)
def stat(job,s):
    sid,year,tid,_=job; out={}; page=0; pages=1
    while page<pages:
        d=get(f"{API}/stats/ranked/players/{s}?page={page}&pageSize=100&comps=1&compSeasons={sid}&teams={tid}&altIds=true")
        if not d: break
        pages=d["stats"]["pageInfo"]["numPages"]
        for e in d["stats"]["content"]:
            o=e["owner"]; out[int(o.get("playerId") or o["id"])]=(o["name"]["display"],e["value"])
        page+=1
    return out
def team(job):
    return job,{s:stat(job,s) for s in ("appearances","goals","goal_assist")}
players={}
done=0
with cf.ThreadPoolExecutor(6) as ex:
    for job,st in ex.map(team,jobs):
        sid,year,tid,tname=job
        for pid,(name,apps) in st["appearances"].items():
            if apps<=0: continue
            p=players.setdefault(pid,{"name":name,"seasons":{}})
            p["seasons"].setdefault(str(year),[]).append([tname,int(apps),int(st["goals"].get(pid,(0,0))[1]),int(st["goal_assist"].get(pid,(0,0))[1])])
        done+=1
        if done%50==0: print(done,"/",len(jobs),flush=True)
json.dump(players,open("careers.json","w"))
print("players",len(players))
