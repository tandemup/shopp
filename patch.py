from pathlib import Path
p=Path('/mnt/data/fase4j_build/src/screens/playlist/PrintMusicCardScreen.js')
s=p.read_text()
needle='  const print = () => {\n'
insert='''  // Fase 4J: validación integral, sin alterar HTML de impresión ni calibraciones.
  const [sheetCheck, setSheetCheck] = useState(null);
  const [checkingSheet, setCheckingSheet] = useState(false);
  const sheetInspection = useMemo(() => {
    const errors = [];
    const warnings = [];
    const active = cardEntries;
    const publicOrigin = normalizePublicBase(publicBaseUrl);
    if (!publicOrigin || !/^https:\\/\\//i.test(publicOrigin)) errors.push("La dirección pública de Shopp debe ser HTTPS.");
    if (!active.length) errors.push("No hay tarjetas válidas para imprimir.");
    if (active.some(c => !String(c.title || "").trim())) warnings.push("Hay tarjetas sin título impreso.");
    active.forEach((card, i) => {
      const n = i + 1;
      if (!card.url || !/^https:\\/\\//i.test(card.url)) errors.push(`Tarjeta ${n}: el enlace QR no es HTTPS válido.`);
      if (!card.cover) warnings.push(`Tarjeta ${n}: no tiene carátula.`);
      if (card.trackIndices?.length > 1) {
        const indices = card.trackIndices;
        if (new Set(indices).size !== indices.length || indices.some(index => !validTracks[index])) errors.push(`Tarjeta ${n}: movimientos inexistentes o duplicados.`);
        if (!card.selectionPublicId) errors.push(`Tarjeta ${n}: falta identificador público de la obra.`);
      }
    });
    if (format === "a4" && cardMode === "songs" && active.length > 10)
      warnings.push(`La selección contiene ${active.length} tarjetas: se imprimirá en varias hojas A4.`);
    if (format === "a4" && cardMode === "songs" && active.length < 10)
      warnings.push(`Quedarán ${10 - active.length} posiciones vacías en la hoja A4.`);
    if (!doubleSided) warnings.push("La impresión a doble cara está desactivada.");
    return { errors, warnings, count: active.length,
      signature: JSON.stringify(active.map(c => [c.url, c.title, c.cover, c.trackIndices, c.printOrder])),
    };
  }, [cardEntries, publicBaseUrl, validTracks, format, cardMode, doubleSided]);

  const verifyWholeSheet = async () => {
    if (checkingSheet) return;
    setCheckingSheet(true);
    const errors = [...sheetInspection.errors];
    const warnings = [...sheetInspection.warnings];
    const groups = cardEntries.filter(c => c.selectionPublicId);
    const checked = new Map();
    try {
      for (const card of groups) {
        const id = card.selectionPublicId;
        if (checked.has(id)) continue;
        const manifestUrl = getPublicManifestUrl(publicBaseUrl, id);
        if (!manifestUrl) { errors.push(`${card.title}: URL de manifiesto inválida.`); continue; }
        try {
          const response = await fetch(`${manifestUrl}${manifestUrl.includes("?") ? "&" : "?"}check=${Date.now()}`, { cache: "no-store" });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const manifest = await response.json();
          const expected = card.trackIndices.map(index => workTrackKey(validTracks[index]));
          const actual = (manifest?.tracks || []).map(track => workTrackKey(track));
          if (manifest?.schema !== "shopp-public-music-card" || manifest?.version !== 1 || manifest?.id !== id ||
              expected.length !== actual.length || expected.some((v, i) => v !== actual[i]))
            throw new Error("el JSON no coincide con los movimientos en el orden previsto");
          checked.set(id, true);
        } catch (error) {
          errors.push(`${card.title}: manifiesto no verificado (${error?.message || error}).`);
          checked.set(id, false);
        }
      }
      if (cardMode === "playlist" && qrDestination !== "youtube" && !published)
        errors.push("La playlist completa aún no está marcada como publicada y verificada.");
      const report = { errors, warnings, verified: checked.size, signature: sheetInspection.signature };
      setSheetCheck(report);
      showNotice(errors.length ? "Impresión bloqueada" : "Comprobación completada",
        errors.length ? `${errors.length} problema(s) que debes corregir antes de imprimir.` :
        `Sin errores bloqueantes. ${checked.size} manifiesto(s) de obra verificado(s), ${warnings.length} aviso(s).`,
        errors.length ? "warning" : "success");
    } finally { setCheckingSheet(false); }
  };

'''
assert needle in s
s=s.replace(needle,insert+needle,1)
needle='''    const html = buildPrintHtml({'''
replacement='''    if (sheetInspection.errors.length) {
      showNotice("Impresión bloqueada", sheetInspection.errors.join("\\n"), "warning");
      return;
    }
    const currentGroups = cardEntries.some(card => card.selectionPublicId);
    if (currentGroups && (!sheetCheck || sheetCheck.signature !== sheetInspection.signature || sheetCheck.errors.length)) {
      showNotice("Verificación necesaria", "Pulsa «Verificar toda la hoja» antes de imprimir: se deben comprobar los manifiestos públicos de las obras seleccionadas.", "warning");
      return;
    }
    const html = buildPrintHtml({'''
assert needle in s
s=s.replace(needle,replacement,1)
needle='''            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setPrintOpen(false)}'''
replacement='''            <View style={{ paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#e2e8f0", gap: 6 }}>
              <Text style={{ fontWeight: "700", color: "#0f172a" }}>Comprobación previa de la hoja · {sheetInspection.count} tarjetas</Text>
              {sheetInspection.errors.map((message, i) => <Text key={`error-${i}`} style={{ color: "#b91c1c", fontSize: 12 }}>✖ {message}</Text>)}
              {sheetInspection.warnings.map((message, i) => <Text key={`warning-${i}`} style={{ color: "#92400e", fontSize: 12 }}>⚠ {message}</Text>)}
              {!sheetInspection.errors.length && <Text style={{ color: "#15803d", fontSize: 12 }}>✓ Enlaces y datos locales sin errores bloqueantes.</Text>}
              {sheetCheck?.signature === sheetInspection.signature && <Text style={{ color: sheetCheck.errors.length ? "#b91c1c" : "#15803d", fontSize: 12 }}>
                {sheetCheck.errors.length ? sheetCheck.errors.join(" · ") : `✓ ${sheetCheck.verified} manifiesto(s) público(s) comprobado(s).`}
              </Text>}
              <Pressable onPress={verifyWholeSheet} disabled={checkingSheet} style={[styles.previewButton, checkingSheet && styles.disabled]}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text style={styles.buttonText}>{checkingSheet ? "Comprobando publicación…" : "Verificar toda la hoja"}</Text>
              </Pressable>
            </View>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setPrintOpen(false)}'''
assert needle in s
s=s.replace(needle,replacement,1)
p.write_text(s)
