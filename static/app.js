const $ = id => document.getElementById(id);
const canvas = $('preview'), ctx = canvas.getContext('2d');
let artwork = null, references = [];
function dimensions() {
  const w = Number($('width').value), h = Number($('height').value);
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 256 || h < 256 || w > 8000 || h > 8000 || w*h > 32000000) throw Error('Bitte Maße zwischen 256 und 8000 px wählen (maximal 32 Megapixel).');
  return [w,h];
}
function contrast(a,b) {
  const rgb = hex => hex.match(/[a-f\d]{2}/gi).map(x => parseInt(x,16));
  return Math.hypot(...rgb(a).map((v,i)=>v-rgb(b)[i]));
}
function render(exporting=false, target=canvas, composite=false) {
  const [w,h] = dimensions(); target.width=w; target.height=h;
  const c=target.getContext('2d');
  c.fillStyle=$('frameColor').value; c.fillRect(0,0,w,h);
  if (artwork) {
    const scale=Math.max(w/artwork.width,h/artwork.height);
    c.drawImage(artwork,(w-artwork.width*scale)/2,(h-artwork.height*scale)/2,artwork.width*scale,artwork.height*scale);
  } else {
    c.strokeStyle='#ffffff88'; c.lineWidth=Math.max(2,w/1000);
    c.strokeRect(w*.012,h*.012,w*.976,h*.976);
  }
  const factor=Math.sqrt(1-Number($('area').value)/100);
  const innerW=Math.round(w*factor), innerH=Math.round(h*factor), x=Math.round((w-innerW)/2), y=Math.round((h-innerH)/2);
  if ((!exporting || composite) && window.hasScene?.()) {
    c.save(); c.beginPath(); c.rect(x,y,innerW,innerH); c.clip();
    c.fillStyle=$('photoColor').value; c.fillRect(x,y,innerW,innerH);
    window.drawScene(c,w,h); c.restore();
  } else if (exporting && $('transparent').checked) c.clearRect(x,y,innerW,innerH);
  else {
    c.fillStyle=$('photoColor').value;c.fillRect(x,y,innerW,innerH);
    if(!exporting){
      c.fillStyle='#273123';c.textAlign='center';c.font=`500 ${Math.round(w*.018)}px sans-serif`;
      c.fillText('PLATZ FÜR DEIN FOTO',w/2,h/2);
      c.font=`${Math.round(w*.009)}px sans-serif`;c.fillText(`${(100-Number($('area').value)).toLocaleString('de-DE')} % deiner Bildfläche`,w/2,h/2+h*.04);
    }
  }
  $('sizeLabel').textContent=`${w} × ${h} px`;
  $('areaValue').textContent=Number($('area').value).toLocaleString('de-DE')+' %';
  window.refreshManualPrompt?.();
}
function update() {
  try {
    if(contrast($('frameColor').value,$('photoColor').value)<160) $('photoColor').value=contrast($('frameColor').value,'#d1ff34')>160?'#d1ff34':'#ff35b8';
    render();$('message').textContent='';
  } catch(e){$('message').textContent=e.message;}
}
$('format').onchange=()=>{if($('format').value!=='custom'){const [w,h]=$('format').value.split(',');$('width').value=w;$('height').value=h;update();}};
for(const id of ['width','height','area','frameColor','photoColor','transparent']) $(id).addEventListener('input',()=>{if(id==='width'||id==='height')$('format').value='custom';update();});
document.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>{$('prompt').value=b.dataset.prompt;$('prompt').focus();});
function imageFrom(src){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('Bild konnte nicht gelesen werden.'));im.src=src;});}
function showReferences(){ $('uploads').replaceChildren();references.forEach((ref,i)=>{const b=document.createElement('button');b.title='Referenz entfernen';b.setAttribute('aria-label',`Referenz ${i+1} entfernen`);const img=document.createElement('img');img.src=ref.url;img.alt=ref.name;b.append(img,document.createTextNode('Entfernen ×'));b.onclick=()=>{references.splice(i,1);showReferences();window.refreshManualPrompt?.();};$('uploads').append(b);});}
$('files').onchange=async()=>{
  try{
    const files=[...$('files').files];if(files.length+references.length>4)throw Error('Bitte maximal vier Referenzbilder auswählen.');
    const added=[];
    for(const file of files){
      if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5000000)throw Error('Erlaubt sind PNG, JPG und WebP bis je 5 MB.');
      const url=URL.createObjectURL(file);let im;try{im=await imageFrom(url);}finally{URL.revokeObjectURL(url);}
      const c=document.createElement('canvas'),scale=Math.min(1,1536/Math.max(im.width,im.height));c.width=Math.round(im.width*scale);c.height=Math.round(im.height*scale);c.getContext('2d').drawImage(im,0,0,c.width,c.height);
      const png=c.toDataURL('image/png');if(png.length>6600000)throw Error('Dieses Bild ist nach der Konvertierung zu groß. Bitte ein kleineres Bild wählen.');
      added.push({name:file.name,url:png,data:png.split(',')[1]});
    }
    references.push(...added);showReferences();window.refreshManualPrompt?.();$('message').textContent=$('creationMode').value==='api'?'Referenzen werden bei der KI-Erstellung an OpenAI gesendet.':'Diese Referenzbilder bitte selbst in ChatGPT anhängen.';
  }catch(e){$('message').textContent=e.message;}finally{$('files').value='';}
};
$('generate').onclick=async()=>{
  if ($('creationMode').value !== 'api') return;
  if(!$('prompt').value.trim()){$('message').textContent='Beschreibe zuerst deinen Wunschrahmen.';$('prompt').focus();return;}
  const button=$('generate');button.disabled=true;button.textContent='✦ Dein Rahmen entsteht …';$('message').textContent='Die Erstellung kann einige Minuten dauern. Die OpenAI-API rechnet sie separat ab.';
  try{
    const response=await fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:$('prompt').value,hasBackground:!!window.selectedBackground,images:[...(window.selectedBackground?[{data:window.selectedBackgroundData}]:[]),...references.map(({data})=>({data}))]})});
    const result=await response.json();if(!response.ok)throw Error(result.error||'Die Erstellung ist fehlgeschlagen.');
    artwork=await imageFrom('data:image/png;base64,'+result.image);$('frameStatus').textContent='Aktiver Rahmen: mit API erstellt.';render();$('message').textContent='Dein KI-Design ist fertig. Du kannst es jetzt als PNG herunterladen.';
  }catch(e){$('message').textContent=e.message;}finally{button.disabled=false;button.textContent='✦ Mit KI gestalten ↗';}
};
$('reset').onclick=()=>{artwork=null;$('frameStatus').textContent='Rahmen zurückgesetzt.';update();};
async function downloadPNG(composite=false){
  try{
    const out=document.createElement('canvas');render(true,out,composite);
    const blob=await new Promise(resolve=>out.toBlob(resolve,'image/png'));if(!blob)throw Error('PNG konnte nicht erstellt werden. Bitte kleinere Maße versuchen.');
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${composite?'fotobox-vorschau':'fotoboxrahmen'}-${out.width}x${out.height}.png`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
    $('message').textContent='PNG-Download gestartet. Der Speicherort richtet sich nach deinen Browser-Einstellungen.';
  }catch(e){$('message').textContent=e.message;}
};
$('download').onclick=()=>downloadPNG(false);
$('downloadScene').onclick=()=>downloadPNG(true);
fetch('/api/status').then(r=>r.json()).then(s=>{$('apiStatus').textContent=s.configured?'OpenAI-API verbunden · Erstellung wird separat berechnet.':'KI benötigt einen OpenAI-API-Schlüssel auf dem Server. Gestaltung und PNG-Export sind bereits verfügbar.';}).catch(()=>{$('apiStatus').textContent='Server nicht erreichbar.';});
update();
