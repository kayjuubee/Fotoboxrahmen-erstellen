// Desktop-only controls are hidden when using the Python development server.
(async()=>{
 try{
  const status=await(await fetch('/api/status')).json();if(!status.desktop)return;
  const {token}=await(await fetch('/api/desktop-session',{headers:{'X-Rahmenstudio':'desktop'}})).json();
  const controls=document.createElement('div');controls.className='desktop-controls';
  const settings=document.createElement('button');settings.className='secondary';settings.textContent='API-Einstellungen';
  const quit=document.createElement('button');quit.className='secondary';quit.textContent='Programm beenden';controls.append(settings,quit);document.querySelector('header').append(controls);
  const dialog=document.createElement('dialog');dialog.className='api-dialog';
  dialog.innerHTML='<form><h2>OpenAI-API verbinden</h2><p>Der Schlüssel bleibt nur für diese Programmsitzung im Arbeitsspeicher. ChatGPT-Abonnements beinhalten keinen API-Zugang.</p><label for="desktopKey">API-Schlüssel</label><input id="desktopKey" type="password" autocomplete="off" spellcheck="false" placeholder="OpenAI-API-Schlüssel"><p class="hint">Eine leere Eingabe trennt die Verbindung. Die Bilderstellung wird separat von OpenAI berechnet.</p><p class="desktop-feedback" role="status"></p><div class="dialog-actions"><button type="button" class="secondary">Schließen</button><button type="submit" class="dark">Für diese Sitzung übernehmen</button></div></form>';
  document.body.append(dialog);const field=dialog.querySelector('input');settings.onclick=()=>{dialog.showModal();field.focus();};dialog.querySelector('[type=button]').onclick=()=>dialog.close();
  dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();const feedback=dialog.querySelector('.desktop-feedback');try{const res=await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json','X-Rahmenstudio-Token':token},body:JSON.stringify({key:field.value})});if(!res.ok)throw Error('Einstellung konnte nicht übernommen werden.');const result=await res.json();field.value='';document.getElementById('apiStatus').textContent=result.configured?'API-Schlüssel für diese Sitzung hinterlegt · Erstellung wird separat berechnet.':'Keine API-Verbindung. Vorschau und PNG-Export bleiben verfügbar.';feedback.textContent=result.configured?'Schlüssel übernommen. Die erste Bilderstellung prüft den API-Zugang.':'API-Verbindung getrennt.';}catch(e){feedback.textContent=e.message;}};
  dialog.addEventListener('close',()=>{field.value='';});
  quit.onclick=async()=>{try{const res=await fetch('/api/shutdown',{method:'POST',headers:{'X-Rahmenstudio-Token':token}});if(!res.ok)throw Error();document.body.replaceChildren();const note=document.createElement('p');note.className='closed-note';note.textContent='Rahmenstudio wurde beendet. Du kannst dieses Browserfenster schließen.';document.body.append(note);}catch{quit.textContent='Beenden fehlgeschlagen. Bitte erneut versuchen.';}};
 }catch{ /* Normal editor remains usable if desktop initialization is unavailable. */ }
})();
