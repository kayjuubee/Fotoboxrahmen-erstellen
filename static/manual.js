/* Manual ChatGPT workflow: no authentication handoff and no generation request. */
(() => {
  const mode = $('creationMode');
  function promptText() {
    const [w,h] = dimensions();
    const area = Number($('area').value), factor = Math.sqrt(1-area/100);
    const background = window.selectedBackground;
    return [
      'Erstelle ein dekoratives Rahmenbild für eine Fotobox.',
      `Zielformat: ${w} × ${h} Pixel, Seitenverhältnis ${w}:${h}. Falls die native Auflösung nicht möglich ist, liefere das gleiche Seitenverhältnis in möglichst hoher Auflösung.`,
      `Der Rahmen soll etwa ${area.toLocaleString('de-DE')} % der gesamten Bildfläche einnehmen. In der Mitte bleibt ein rechteckiger Fotobereich von etwa ${Math.round(w*factor)} × ${Math.round(h*factor)} Pixeln frei. Das Rahmenstudio schneidet diesen mittleren Bereich später aus.`,
      'Platziere Dekorationen am äußeren Rand. Keine Personen und keine Fotomontage im Bild. Wichtige Motive und Texte müssen im sichtbaren Rahmen bleiben.',
      `Mein Gestaltungswunsch: ${$('prompt').value.trim() || '[Hier deinen Wunschrahmen beschreiben]'}`,
      background ? `Das erste angehängte Bild „${background.name}“ ist mein gewählter Fotobox-Hintergrund. Stimme Farben, Licht, Stimmung und Stil des NEUEN Rahmens darauf ab. Übernimm nicht die komplette Hintergrundszene. Ich hänge dieses Bild manuell an.` : 'Kein Hintergrund als Referenz ausgewählt.',
      references.length ? `Zusätzliche Designreferenzen, die ich selbst anhänge: ${references.map(r=>r.name).join(', ')}.` : '',
      'Liefere das fertige Rahmenbild zum Herunterladen, vorzugsweise als PNG. Ich importiere es anschließend ins Rahmenstudio.'
    ].filter(Boolean).join('\n\n');
  }
  window.refreshManualPrompt = () => {
    try { $('chatgptPrompt').value = promptText(); }
    catch(e) { $('chatgptPrompt').value = e.message; }
    $('downloadBackground').disabled = !window.selectedBackground;
  };
  function setMode() {
    const manual = mode.value === 'manual';
    $('manualMode').hidden = !manual;
    $('apiMode').hidden = manual;
    $('modeHint').textContent = manual ? 'Ohne API-Schlüssel: Du nutzt ChatGPT im eigenen Browser und importierst das Ergebnis.' : 'Direkte Erstellung mit eigenem OpenAI-API-Schlüssel; separate API-Abrechnung.';
    $('message').textContent = '';
    window.refreshManualPrompt();
  }
  mode.onchange = setMode;
  $('prompt').addEventListener('input', window.refreshManualPrompt);
  document.querySelectorAll('[data-prompt]').forEach(b=>b.addEventListener('click',window.refreshManualPrompt));
  $('copyPrompt').onclick = async () => {
    try {
      const text = promptText(); $('chatgptPrompt').value = text;
      try {
        await navigator.clipboard.writeText(text);
        $('message').textContent = 'Anweisung kopiert. In ChatGPT einfügen und den Hintergrund sowie Referenzbilder selbst anhängen.';
      } catch {
        $('chatgptPrompt').focus(); $('chatgptPrompt').select();
        $('message').textContent = 'Automatisches Kopieren ist nicht verfügbar. Der Text ist markiert: mit Strg+C kopieren.';
      }
    } catch(e) { $('message').textContent=e.message; }
  };
  $('downloadBackground').onclick = () => {
    const background=window.selectedBackground; if(!background)return;
    const a=document.createElement('a');a.href=background.url;a.download='fotobox-hintergrund-fuer-chatgpt.png';document.body.append(a);a.click();a.remove();
    $('message').textContent='Hintergrund-Download gestartet. Diese Datei bitte als erstes Bild in ChatGPT anhängen.';
  };
  $('frameFile').onchange = async () => {
    const file=$('frameFile').files[0];if(!file)return;
    try {
      if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>20_000_000)throw Error('Bitte PNG, JPG oder WebP bis 20 MB auswählen.');
      dimensions();
      const url=URL.createObjectURL(file);let image;
      try {image=await imageFrom(url);}finally{URL.revokeObjectURL(url);}
      if(image.width*image.height>32_000_000)throw Error('Das Rahmenbild darf maximal 32 Megapixel haben.');
      artwork=image;render();
      $('frameStatus').textContent=`Aktiver Rahmen: ${file.name} (${image.width} × ${image.height} px).`;
      $('message').textContent='Rahmen importiert. Prüfe ihn mit Hintergrund und Personen und speichere danach den Rahmen oder die Gesamtvorschau als PNG.';
    } catch(e) { $('message').textContent=e.message; }
    finally { $('frameFile').value=''; }
  };
  setMode();
})();
