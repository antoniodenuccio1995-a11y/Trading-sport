/* TA-CSV-001: CSV ingestion only. No statistical model changes. */
(function(root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./ta-clubs-v1.js') : root.TAClubs);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TACsv = api;
})(typeof globalThis === 'object' ? globalThis : this, function(Clubs) {
  'use strict';
  const codes = {I1:'Serie A',I2:'Serie B',E0:'Premier League',E1:'Championship',E2:'League One',E3:'League Two',CL:'Champions League',D1:'Bundesliga',F1:'Ligue 1',F2:'Ligue 2',SP1:'La Liga',SP2:'Segunda División',N1:'Eredivisie',P1:'Primeira Liga',DNK:'Superliga Danimarca',ROU:'SuperLiga Romania',T1:'Süper Lig',B1:'Jupiler Pro League'};
  // Preserve aliases already registered by v0.2T, including normalized utility codes.
  Object.assign(codes,{P2:'Liga Portugal 2',ESP2:'Segunda División',FRA2:'Ligue 2',POR2:'Liga Portugal 2',DK1:'Superliga Danimarca',DK2:'1st Division Danimarca',HR1:'HNL Croazia',HR2:'Prva NL Croazia',CRO1:'HNL Croazia',CRO2:'Prva NL Croazia',DEN1:'Superliga Danimarca',DEN2:'1st Division Danimarca',RO1:'SuperLiga Romania',RO2:'Liga II Romania',ROM1:'SuperLiga Romania',ROM2:'Liga II Romania'});
  const clean = v => String(v ?? '').normalize('NFC').replace(/\s+/g,' ').trim();
  const key = v => clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const aliases = Object.fromEntries(Object.entries(codes).flatMap(([code,name]) => [[key(code),name],[key(name),name]]));
  Object.assign(aliases, {superligaromania:codes.ROU,romaniasuperliga:codes.ROU,romanialiga1:codes.ROU,liga1romania:codes.ROU,romania:codes.ROU,denmark:codes.DNK,danmark:codes.DNK,superligadenmark:codes.DNK,danishsuperliga:codes.DNK,superligadanimarca:codes.DNK,superligaen:codes.DNK,primeiraliga:codes.P1,ligaportugal:codes.P1,portugalprimeiraliga:codes.P1,segunda:codes.SP2,segundadivision:codes.SP2,laliga2:codes.SP2,ligue1:codes.F1,ligue2:codes.F2,eredivisie:codes.N1});
  Object.assign(aliases, {denmarksuperliga:codes.DNK,romanialigai:codes.ROU});
  const leagues=[...new Set(Object.values(codes))];
  for(const name of leagues)aliases[key(name)]=name;
  const leagueName = value => aliases[key(value)] || '';
  const fields = {
    Date:['date','matchdate','data'], HomeTeam:['hometeam','home','team1','squadracasa'], AwayTeam:['awayteam','away','team2','squadraospite'],
    FTHG:['fthg','hg','fthome','homegoals','goalshome'], FTAG:['ftag','ag','ftaway','awaygoals','goalsaway'],
    HTHG:['hthg','hthome','ht home goals','halftimehomegoals'], HTAG:['htag','htaway','ht away goals','halftimeawaygoals'],
    Div:['div','division','leaguecode','competitioncode'], League:['league','campionato','competition'], Country:['country','paese'],
    Season:['season','stagione','seasonyear'], FT:['ft','fulltime'], HT:['ht','halftime'], Time:['time','kickoff'],
    HS:['hs'], AS:['as'], HST:['hst'], AST:['ast'],
    Provider:['provider','sourceprovider'], HomeProvider:['homeprovider'], AwayProvider:['awayprovider'],
    HomeTeamID:['hometeamid','homeid','team1id'], AwayTeamID:['awayteamid','awayid','team2id'],
    HomeCountry:['homecountry','countryhome'], AwayCountry:['awaycountry','countryaway']
  };
  const headerNames = {};
  for (const [canonical,names] of Object.entries(fields)) for (const name of names) headerNames[key(name)] = canonical;
  function grid(text) {
    text = String(text).replace(/^\uFEFF/,'');
    if (/^sep=[,;\t]\r?\n/i.test(text)) text = text.replace(/^sep=[,;\t]\r?\n/i,'');
    let quoted=false, first='';
    for (let i=0;i<text.length;i++) {const c=text[i];if(c==='"') quoted=!quoted;if((c==='\n'||c==='\r')&&!quoted)break;first+=c;}
    const counts = {',':0,';':0,'\t':0}; quoted=false;
    for (let i=0;i<first.length;i++){const c=first[i];if(c==='"'){if(quoted&&first[i+1]==='"')i++;else quoted=!quoted;}else if(!quoted&&c in counts)counts[c]++;}
    const delimiter=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];
    const out=[];let row=[],cell='';quoted=false;
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
      else if(c===delimiter&&!quoted){row.push(cell);cell='';}
      else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))out.push(row);row=[];cell='';}
      else cell+=c;
    }
    if(quoted)throw Error('CSV con virgolette non chiuse');
    row.push(cell);if(row.some(v=>v.trim()))out.push(row);
    return out;
  }
  function season(value) {
    const s=clean(value); let m=/^(19\d{2}|20\d{2})(?:\s*[\/\-_]\s*(\d{2}|\d{4}))?$/.exec(s);
    if(m){const y=+m[1];return !m[2]||(+m[2]<100?(y+1)%100===+m[2]:y+1===+m[2])?y:null;}
    m=/^(\d{2})(\d{2})$/.exec(s);
    return m&&(+m[1]+1)%100===+m[2]?(+m[1]>=90?1900:2000)+ +m[1]:null;
  }
  function date(value) {
    const s=clean(value);
    const iso=/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(s);
    const eu=/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{2}|\d{4})$/.exec(s);
    let y,m,d;
    if(iso){[,y,m,d]=iso.map(Number);}
    else if(eu){d=+eu[1];m=+eu[2];y=+eu[3];if(y<100)y+=y<70?2000:1900;}
    else {
      // The cache publishes English month names; never guess numeric MM/DD dates.
      const named=/^(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+)?([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})$/.exec(s);
      if(!named)return null;
      m=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].findIndex(x=>x.toLowerCase()===named[1].toLowerCase())+1;d=+named[2];y=+named[3];
    }
    if(y<1900||y>2099)return null;
    const n=Date.UTC(y,m-1,d),check=new Date(n);
    return check.getUTCFullYear()===y&&check.getUTCMonth()===m-1&&check.getUTCDate()===d?n:null;
  }
  const dateSeason = d => new Date(d).getUTCFullYear()-(new Date(d).getUTCMonth()<6?1:0);
  const score = v => /^\d+$/.test(clean(v)) && Number.isSafeInteger(+v) ? +v : null;
  const missing = v => /^(?:|\?|n\/?a|null|none|nan|-)$/i.test(clean(v));
  const pair = v => {const m=/^(\d+)\s*[-:]\s*(\d+)$/.exec(clean(v));return m?[score(m[1]),score(m[2])]:[null,null];};
  function filenameLeague(name) {
    const tokens=String(name||'').replace(/\.csv$/i,'').split(/[^\p{L}\p{N}]+/u);
    for(const token of tokens)if(codes[token.toUpperCase()])return codes[token.toUpperCase()];
    const normalized=key(name);
    // Long names first: Ligue 1 cannot consume Ligue 2, Segunda cannot become La Liga.
    for(const [alias,league] of Object.entries(aliases).filter(([a])=>a.length>5).sort((a,b)=>b[0].length-a[0].length))if(normalized.includes(alias))return league;
    return '';
  }
  function filenameSeason(name) {
    const m=/(?:^|\D)((?:19|20)\d{2})[_ -]((?:19|20)?\d{2})(?:\D|$)/.exec(name||'');
    if(m)return season(m[1]+'/'+m[2]);
    const short=/(?:^|\D)(\d{4})(?:\D|$)/g;let x;
    while((x=short.exec(name||''))){const y=season(x[1]);if(y!==null&&x[1].slice(0,2)!=='20')return y;}
    return null;
  }
  function read(text,options={}) {
    const data=grid(text);if(data.length<2)throw Error('CSV vuoto o senza partite');
    const headers=data[0].map(h=>headerNames[key(h)]||clean(h));
    const canonical=headers.filter(h=>Object.hasOwn(fields,h));
    if(new Set(canonical).size!==canonical.length)throw Error('Intestazioni duplicate o equivalenti: controllare il CSV');
    if(!['Date','HomeTeam','AwayTeam'].every(h=>headers.includes(h)))throw Error('Schema non riconosciuto: servono Date,HomeTeam,AwayTeam (oppure Date,Home,Away / Date,Team 1,Team 2)');
    const raw=data.slice(1).map((r,i)=>{if(r.length>headers.length&&r.slice(headers.length).some(v=>clean(v)))throw Error('Riga '+(i+2)+': numero di colonne diverso dall’intestazione');const o=Object.fromEntries(headers.map((h,j)=>[h,clean(r[j])]));Object.defineProperty(o,'__rawHome',{value:String(r[headers.indexOf('HomeTeam')]??'')});Object.defineProperty(o,'__rawAway',{value:String(r[headers.indexOf('AwayTeam')]??'')});return o});
    const known=new Set(),unknown=new Set(),rowMetadata=new Map();
    for(const o of raw){
      const inRow=new Set(),rowUnknown=[];
      for(const field of ['Div','League'])if(o[field]){const lg=leagueName(o[field])||(field==='League'?leagueName(o.Country+' '+o.League):'');if(lg)inRow.add(lg);else {unknown.add(o[field]);rowUnknown.push(o[field]);}}
      if(inRow.size>1)throw Error('Campionato contraddittorio nelle colonne Div/League');
      for(const l of inRow)known.add(l);
      rowMetadata.set(o,{league:[...inRow][0]||'',unknown:rowUnknown});
    }
    if(known.size>1)throw Error('CSV con più campionati: separare i file prima di importare');
    const explicit=options.league?leagueName(options.league):'',fromColumns=[...known][0]||'',fromName=filenameLeague(options.filename);
    if(options.league&&!explicit)throw Error('Campionato selezionato non supportato');
    if(explicit&&fromColumns&&explicit!==fromColumns)throw Error('Campionato selezionato in conflitto con Div/League: nessun dato importato');
    const league=explicit||fromColumns||(unknown.size?'':fromName);
    const unresolved=raw.map((o,i)=>({row:i+2,...rowMetadata.get(o)})).filter(m=>known.size>0&&(!m.league||m.unknown.length));
    const unresolvedNumbers=new Set(unresolved.map(m=>m.row));
    if(unresolved.length&&!options.inspect&&!options.confirmUnknownRows)throw Error('Campionato non risolto nelle righe '+unresolved.map(m=>m.row).join(', ')+': necessaria conferma esplicita delle sole righe anomale prima di qualsiasi scrittura');
    if(unresolved.length&&options.confirmUnknownRows&&!explicit)throw Error('Selezionare esplicitamente il campionato per risolvere le righe anomale');
    const selected=options.season===''||options.season==null?null:season(options.season);
    if(options.season!==''&&options.season!=null&&selected===null)throw Error('Stagione selezionata non valida');
    const records=[],issues=[],seasons=new Map();let invalid=0,incomplete=0,outOfSeason=0,missingHT=0,seasonReassigned=0,quarantinedLeagueRows=0;
    for(let i=0;i<raw.length;i++){
      const o=raw[i],line=i+2,d=date(o.Date),H=clean(o.HomeTeam),A=clean(o.AwayTeam);
      if(unresolvedNumbers.has(line)&&!options.confirmUnknownRows){quarantinedLeagueRows++;continue;}
      const reject=why=>{invalid++;issues.push('Riga '+line+': '+why);};
      const distinctCodes=o.HomeTeamID&&o.AwayTeamID&&String(o.HomeTeamID)!==String(o.AwayTeamID)||o.HomeID&&o.AwayID&&String(o.HomeID)!==String(o.AwayID);
      const distinctCountries=o.HomeCountry&&o.AwayCountry&&key(o.HomeCountry)!==key(o.AwayCountry);
      if(d===null||!H||!A||key(H)===key(A)&&!distinctCodes&&!distinctCountries){reject('data o squadre non valide');continue;}
      let y=o.Season?season(o.Season):null;
      if(o.Season&&y===null){reject('Season non valida');continue;}
      if(selected!==null&&y!==null&&selected!==y){outOfSeason++;continue;}
      y=y??selected??dateSeason(d);
      if(d<Date.UTC(y,5,1)||d>=Date.UTC(y+1,7,1)){if(selected!==null){outOfSeason++;continue;}reject('data incompatibile con Season');continue;}
      let h=score(o.FTHG),a=score(o.FTAG);
      if(o.FT!==undefined&&o.FTHG===undefined&&o.FTAG===undefined)[h,a]=pair(o.FT);
      const noResult=o.FT!==undefined&&o.FTHG===undefined?missing(o.FT):missing(o.FTHG)&&missing(o.FTAG);
      const up=h===null||a===null;
      if(up){if(!noResult){reject('risultato finale incompleto o non valido');continue;}if(!options.allowFixtures){incomplete++;continue;}}
      let hth=score(o.HTHG),hta=score(o.HTAG);
      if(o.HT!==undefined&&o.HTHG===undefined&&o.HTAG===undefined)[hth,hta]=pair(o.HT);
      if(up||hth===null||hta===null||hth>h||hta>a){hth=null;hta=null;missingHT++;}
      if(!o.Season&&selected!==null&&selected!==dateSeason(d))seasonReassigned++;
      const shots=['HS','AS','HST','AST'].map(k=>score(o[k]));
      const validShots=shots.every(x=>x!==null)&&shots[2]<=shots[0]&&shots[3]<=shots[1];
      seasons.set(y,(seasons.get(y)||0)+1);
      const rowLeague=rowMetadata.get(o).league||explicit||league;
      const output={d,lg:rowLeague,H,A,h:up?null:h,a:up?null:a,ht:hth===null?null:hth+hta,hth,hta,up,shots:validShots?shots:null,o:{...o,CsvSeason:y,CsvSourceFile:options.filename||'',ClubHomeRaw:o.__rawHome,ClubAwayRaw:o.__rawAway}};
      if(unresolvedNumbers.has(line))output.o.CsvLeagueResolution={row:line,originalDiv:o.Div||'',originalLeague:o.League||'',target:rowLeague,method:'explicit-user-confirmation'};
      records.push(Clubs&&rowLeague&&!options.inspect?Clubs.canonicalMatch(output):output);
    }
    if(!records.length&&!options.inspect)throw Error('Nessun incontro importabile: '+invalid+' righe non valide, '+incomplete+' senza risultato, '+outOfSeason+' fuori stagione');
    if(!league&&!options.inspect)throw Error('Campionato non riconosciuto: selezionarlo esplicitamente');
    return {records,league,fromColumns,fromName,unresolvedLeagueRows:unresolved,quarantinedLeagueRows,unknown:[...unknown],seasons,actual:[...seasons.keys()].sort((a,b)=>a-b),invalid,incomplete,outOfSeason,missingHT,seasonReassigned,issues,format:headers.includes('FT')?'cache':headers.includes('FTHG')?'results':'fixtures',confidence:fromColumns?'Colonne CSV':league&&fromName?'Nome file':'Da selezionare',filenameYear:filenameSeason(options.filename)};
  }
  return {codes,leagues,clean,key,leagueName,grid,season,date,dateSeason,filenameLeague,filenameSeason,read};
});
