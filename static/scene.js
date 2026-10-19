/* Uploaded assets stay in this browser's IndexedDB; no server upload for preview. */
(() => {
  let backgrounds=[], people=[], activePerson=null, db=null;
  window.selectedBackground=null;
  const status=text=>$('assetStatus').textContent=text;
  function repaint(){try{render();}catch(e){status(e.message);}}
  function database(){return new Promise((resolve,reject)=>{const r=indexedDB.open('rahmenstudio-assets',1);r.onupgradeneeded=()=>r.result.createObjectStore('assets',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  async function persist(asset,remove=false){
    if(!db){status('Browserspeicher nicht verfügbar. Neue Bilder bleiben nur bis zum Neuladen erhalten.');return;}
    try{await new Promise((resolve,reject)=>{const tx=db.transaction('assets','readwrite');const store=tx.objectStore('assets');if(remove)store.delete(asset.id);else{const {image,...record}=asset;store.put(record);}tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
    catch{status('Speichern im Browser fehlgeschlagen. Bitte Speicherplatz freigeben; dieses Bild ist nur vorübergehend verfügbar.');}
  }
  function preset(name,top,bottom){const c=document.createElement('canvas');c.width=1200;c.height=800;const x=c.getContext('2d');const g=x.createLinearGradient(0,0,1200,800);g.addColorStop(0,top);g.addColorStop(1,bottom);x.fillStyle=g;x.fillRect(0,0,1200,800);return {id:name,name,type:'background',url:c.toDataURL(),builtin:true};}
  function cover(c,im,w,h){const s=Math.max(w/im.width,h/im.height);c.drawImage(im,(w-im.width*s)/2,(h-im.height*s)/2,im.width*s,im.height*s);}
  window.hasScene=()=>$('scene').checked && (!!window.selectedBackground || people.some(p=>p.visible)||$('samplePeople').checked);
  window.drawScene=(c,w,h)=>{
    if(window.selectedBackground)cover(c,window.selectedBackground.image,w,h);
    if($('samplePeople').checked){
      for(const [x,size,color] of [[.36,.79,'#4e5a60'],[.62,.88,'#866d61']]){
        c.save();c.translate(w*x,h*.93);c.fillStyle=color;
        c.beginPath();c.ellipse(0,-h*size*.73,h*size*.095,h*size*.115,0,0,Math.PI*2);c.fill();
        c.beginPath();c.moveTo(-h*size*.18,0);c.quadraticCurveTo(-h*size*.24,-h*size*.6,0,-h*size*.59);c.quadraticCurveTo(h*size*.24,-h*size*.6,h*size*.18,0);c.closePath();c.fill();c.restore();
      }
    }
    for(const p of people.filter(p=>p.visible)){
      const ph=h*p.scale/100,pw=ph*p.image.width/p.image.height;
      c.drawImage(p.image,w*p.x/100-pw/2,h*p.y/100-ph,pw,ph);
    }
  };
  function card(asset,selected,onSelect,onRemove){
    const card=document.createElement('div');card.className='asset-card'+(selected?' selected':'');
    const b=document.createElement('button');b.className='select-asset';b.setAttribute('aria-pressed',String(selected));b.title=asset.name;
    const im=document.createElement('img');im.src=asset.url;im.alt='';const label=document.createElement('span');label.className='asset-name';label.textContent=asset.name;b.append(im,label);b.onclick=onSelect;card.append(b);
    if(onRemove){const r=document.createElement('button');r.className='asset-remove';r.textContent='Löschen ×';r.setAttribute('aria-label',asset.name+' löschen');r.onclick=onRemove;card.append(r);}
    return card;
  }
  function galleries(){
    $('backgrounds').replaceChildren();
    const none=document.createElement('button');none.className='secondary';none.textContent='Ohne Hintergrund';none.onclick=()=>{window.selectedBackground=null;galleries();repaint();};$('backgrounds').append(none);
    for(const a of backgrounds)$('backgrounds').append(card(a,window.selectedBackground===a,()=>{window.selectedBackground=a;$('scene').checked=true;galleries();repaint();},a.builtin?null:async()=>{backgrounds=backgrounds.filter(x=>x!==a);if(window.selectedBackground===a)window.selectedBackground=null;await persist(a,true);galleries();repaint();}));
    $('people').replaceChildren();
    for(const p of people)$('people').append(card(p,activePerson===p,()=>{activePerson=p;controls();galleries();}));
    controls();
  }
  function controls(){
    $('personControls').hidden=!activePerson;
    if(activePerson)for(const [id,key] of [['personX','x'],['personY','y'],['personScale','scale']])$(id).value=activePerson[key];
  }
  for(const [id,key] of [['personX','x'],['personY','y'],['personScale','scale']]){
    $(id).oninput=()=>{if(activePerson){activePerson[key]=Number($(id).value);repaint();}};
    $(id).onchange=()=>{if(activePerson)persist(activePerson);};
  }
  $('removePerson').onclick=async()=>{if(!activePerson)return;const p=activePerson;people=people.filter(x=>x!==p);activePerson=people.at(-1)||null;await persist(p,true);galleries();repaint();};
  $('scene').onchange=repaint;$('samplePeople').onchange=repaint;
  async function addFiles(input,type){
    try{
      const files=[...input.files];if(files.length+(type==='background'?backgrounds.filter(b=>!b.builtin).length:people.length)>20)throw Error('Maximal 20 eigene Bilder pro Kategorie.');
      for(const file of files){
        if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5000000)throw Error('Bitte PNG, JPG oder WebP bis je 5 MB verwenden.');
        const objectURL=URL.createObjectURL(file);let image;
        try{image=await imageFrom(objectURL);}finally{URL.revokeObjectURL(objectURL);}
        const c=document.createElement('canvas');const s=Math.min(1,1600/Math.max(image.width,image.height));c.width=Math.max(1,Math.round(image.width*s));c.height=Math.max(1,Math.round(image.height*s));c.getContext('2d').drawImage(image,0,0,c.width,c.height);
        const url=c.toDataURL('image/png');if(url.length>6600000)throw Error('Das konvertierte Bild ist zu groß. Bitte kleineres Bild auswählen.');
        const asset={id:crypto.randomUUID(),name:file.name,type,url,image:await imageFrom(url),x:50,y:100,scale:80,visible:true};
        if(type==='background'){backgrounds.push(asset);window.selectedBackground=asset;$('scene').checked=true;}else{people.push(asset);activePerson=asset;$('scene').checked=true;}
        await persist(asset);galleries();repaint();
      }
    }catch(e){status(e.message);}finally{input.value='';}
  }
  $('backgroundFiles').onchange=()=>addFiles($('backgroundFiles'),'background');
  $('personFiles').onchange=()=>addFiles($('personFiles'),'person');
  // Only the selected background travels to OpenAI, never the preview people.
  Object.defineProperty(window,'selectedBackgroundData',{get:()=>window.selectedBackground?.url.split(',')[1]});
  async function init(){
    try{db=await database();const saved=await new Promise((resolve,reject)=>{const r=db.transaction('assets').objectStore('assets').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
      for(const a of saved){try{a.image=await imageFrom(a.url);if(a.type==='background')backgrounds.push(a);else if(a.type==='person')people.push(a);}catch{status('Ein gespeichertes Bild konnte nicht geladen werden.');}}
    }catch{status('Lokales Speichern nicht verfügbar. Bilder bleiben nur für diese Sitzung erhalten.');}
    for(const a of [preset('Salbei','#d7dfcb','#8fa68b'),preset('Abendlicht','#f3d4a5','#a36986'),preset('Mitternacht','#243954','#101b29')]){a.image=await imageFrom(a.url);backgrounds.push(a);}
    galleries();repaint();
  }
  init();
})();
