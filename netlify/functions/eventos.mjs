// Lee el feed ICS público del calendario de eventos y devuelve JSON.
// El calendario debe estar compartido como "Público" en Google Calendar.
const CAL_ID = "c_481b0aad9e3c7aa672c454a1844f61468e769770373aaa507be67a2315f82e9d@group.calendar.google.com";

function pad(n){return String(n).padStart(2,"0");}
function parseDT(line){
  // line: value after property name, e.g. "20261018T103000" with optional params
  const mTz = line.match(/TZID=[^:;]+/);
  const isDate = /VALUE=DATE(?![-])/.test(line) || /VALUE=DATE:/.test(line);
  const val = line.split(":").pop().trim();
  const m = val.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/);
  if(!m) return null;
  let [_,Y,Mo,D,h,mi,s,z] = m;
  if(!h){ return {date:`${Y}-${Mo}-${D}`, time:""}; } // all-day
  let date=`${Y}-${Mo}-${D}`, time=`${h}:${mi}`;
  if(z){ // UTC -> America/Argentina/Cordoba (UTC-3)
    const dt=new Date(Date.UTC(+Y,+Mo-1,+D,+h,+mi,+(s||0)));
    dt.setUTCHours(dt.getUTCHours()-3);
    date=`${dt.getUTCFullYear()}-${pad(dt.getUTCMonth()+1)}-${pad(dt.getUTCDate())}`;
    time=`${pad(dt.getUTCHours())}:${pad(dt.getUTCMinutes())}`;
  }
  return {date,time};
}
function unescape(v){return (v||"").replace(/\\n/g,' ').replace(/\\,/g,',').replace(/\;/g,';').replace(/\\\\/g,'\\').trim();}

export const handler = async () => {
  const url = `https://calendar.google.com/calendar/ical/${encodeURIComponent(CAL_ID)}/public/basic.ics`;
  try{
    const r = await fetch(url, {headers:{'User-Agent':'rene-boiero-site'}});
    if(!r.ok) throw new Error("ICS "+r.status);
    let txt = await r.text();
    txt = txt.replace(/\r\n[ \t]/g,"").replace(/\n[ \t]/g,""); // unfold
    const blocks = txt.split("BEGIN:VEVENT").slice(1);
    const events = [];
    for(const b of blocks){
      const body = b.split("END:VEVENT")[0];
      const get = (k)=>{ const m=body.match(new RegExp("\\n"+k+"[^:\\n]*:([^\\n]*)")); return m?m[1].trim():""; };
      const dtLine = (body.match(/\nDTSTART([^\n]*)/)||[,""])[1];
      const dt = parseDT(dtLine);
      if(!dt) continue;
      const summary = unescape(get("SUMMARY")) || "Evento";
      const place = unescape(get("LOCATION"));
      const desc = unescape(get("DESCRIPTION"));
      let link = get("URL");
      if(!link){ const m=desc.match(/https?:\/\/[^\s"'<>\\]+/); if(m) link=m[0]; }
      else { const m=link.match(/https?:\/\/[^\s"'<>\\]+/); if(m) link=m[0]; }
      const status = get("STATUS");
      if(status==="CANCELLED") continue;
      events.push({title:summary, date:dt.date, time:dt.time, place, url: link||"#"});
    }
    events.sort((a,b)=> (a.date+a.time).localeCompare(b.date+b.time));
    return { statusCode:200, headers:{"content-type":"application/json","cache-control":"public, max-age=600","access-control-allow-origin":"*"}, body: JSON.stringify({events}) };
  }catch(e){
    return { statusCode:200, headers:{"content-type":"application/json"}, body: JSON.stringify({events:[], error:String(e)}) };
  }
};
