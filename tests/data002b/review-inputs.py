"""Read diagnostic exports, writing individual details ONLY outside the repository.
This never fabricates match results and cannot recreate a missing match backup.
"""
from pathlib import Path
import argparse,json,csv,datetime,hashlib
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--integrity',required=True);p.add_argument('--registry',required=True);p.add_argument('--private-output',required=True);args=p.parse_args()
output=Path(args.private_output).resolve()
if output.is_relative_to(ROOT):raise SystemExit('Output individuale nel repository vietato: scegliere una cartella privata esterna.')
integrity=Path(args.integrity).resolve();registry=Path(args.registry).resolve()
if output in [integrity,registry]:raise SystemExit('Non sovrascrivere gli originali.')
d=json.loads(integrity.read_text());a=json.loads(registry.read_text());names={c['id']:c['name'] for c in a['clubs']};changes={c['index']:c for c in d.get('changes',[])}
output.mkdir(parents=True,exist_ok=True)
with (output/'DIAGNOSI_RAPPORTO_RICEVUTO.csv').open('w') as f:
 w=csv.writer(f);w.writerow(['riga_prima_1_based','riga_seconda_1_based','data_UTC','campionato','casa','ospite','risultati','id_casa','id_ospite','cambio_nome_documentato','causa_verificabile','classificazione_risultati','trattamento'])
 for c in d['collisions']:
  date,league,home,away=json.loads(c['id']);change=changes.get(c['second']);w.writerow([c['first']+1,c['second']+1,datetime.datetime.fromtimestamp(date/1000,datetime.timezone.utc).date(),league,names.get(home,home),names.get(away,away),'NON DISPONIBILI NEL RAPPORTO',home,away,json.dumps(change,ensure_ascii=False),'Identica chiave dopo normalizzazione delle identità; FT non disponibile','NON DETERMINABILE senza record originali','Riclassificare sul backup originale. Nessuna eliminazione automatica.'])
unspecified=[c for c in a['clubs'] if c['country']=='UNSPECIFIED'];context=[c for c in unspecified if any(x['country']!='UNSPECIFIED' and x['name'].casefold()==c['name'].casefold() for x in a['clubs'])]
summary={'inputRowsReported':d.get('inputCount'),'collisionsActuallyPresent':len(d['collisions']),'errorsReported':len(d.get('errors',[])),'resultsAvailable':False,'originalMatchBackupAvailable':False,'observedClubs':len(a['clubs']),'unspecified':len(unspecified),'sameNameContextCandidates':len(context),'noPersonalRowsPublished':True,'inputSHA256':{'integrity':hashlib.sha256(integrity.read_bytes()).hexdigest(),'registry':hashlib.sha256(registry.read_bytes()).hexdigest()}}
(output/'RIEPILOGO_PRIVATO.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary))
