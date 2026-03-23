SET search_path TO public, extensions;

-- Migration: Replace Template 2 (SaaS License + DPA) with updated 3-part contract
-- Version 2026-03-11: Complete rewrite with proper Norwegian, 22-section license, 12-section DPA
-- Replaces: c0000002-0000-0000-0000-000000000002

UPDATE public.contract_template
SET
  name = 'Smartout Kontrakt + Lisens + DPA',
  content_html = '
<h1>KONTRAKT</h1>
<p><strong>Avtale om kjop og bruk av Smartout</strong><br/>Versjon: 2026-03-11</p>

<div data-type="clause-block" data-clause-id="parter" data-title="Avtaleparter" data-category="parties" data-collapsed="false">
<table>
<tbody>
<tr>
<td><strong>SELGER</strong> (heretter kalt Databehandler)</td>
<td><strong>KUNDE</strong> (heretter kalt Lisensinnehaver / Behandlingsansvarlig)</td>
</tr>
<tr>
<td>
<p>Firma: Smartout AS</p>
<p>Adresse: Europaveien 227</p>
<p>Postnr./-sted: 3962 Stathelle</p>
<p>Org.nr.: 929 620 291</p>
<p>Tlf.: 31 01 62 12</p>
<p>E-post: post@smartout.no</p>
<p>Kontakt: Pontus S. Lindroth</p>
</td>
<td>
<p>Firma: <span data-type="placeholder-field" data-key="name_company" data-label="Firmanavn" data-placeholder-type="manual" data-value="">{{name_company}}</span></p>
<p>Adresse: <span data-type="placeholder-field" data-key="company_street" data-label="Adresse" data-placeholder-type="manual" data-value="">{{company_street}}</span></p>
<p>Postnr./-sted: <span data-type="placeholder-field" data-key="company_zip_code" data-label="Postnr." data-placeholder-type="manual" data-value="">{{company_zip_code}}</span>, <span data-type="placeholder-field" data-key="workspace_city" data-label="Sted" data-placeholder-type="manual" data-value="">{{workspace_city}}</span></p>
<p>Org.nr.: <span data-type="placeholder-field" data-key="company_org_number" data-label="Org.nr." data-placeholder-type="manual" data-value="">{{company_org_number}}</span></p>
<p>Tlf.: <span data-type="placeholder-field" data-key="company_phone" data-label="Telefon" data-placeholder-type="manual" data-value="">{{company_phone}}</span></p>
<p>E-post: <span data-type="placeholder-field" data-key="company_email" data-label="E-post" data-placeholder-type="manual" data-value="">{{company_email}}</span></p>
<p>Faktura e-post: <span data-type="placeholder-field" data-key="invoice_email" data-label="Faktura e-post" data-placeholder-type="manual" data-value="">{{invoice_email}}</span></p>
<p>Daglig leder: <span data-type="placeholder-field" data-key="legal_agent_name" data-label="Daglig leder" data-placeholder-type="manual" data-value="">{{legal_agent_name}}</span></p>
</td>
</tr>
</tbody>
</table>
</div>

<div data-type="clause-block" data-clause-id="priser_vilkar" data-title="Priser og vilkar" data-category="pricing" data-collapsed="false">
<h2>PRISER OG VILKAR</h2>
<table>
<tbody>
<tr><td><strong>Abonnement:</strong></td><td><span data-type="placeholder-field" data-key="subscription_plan" data-label="Abonnement" data-placeholder-type="manual" data-value="">{{subscription_plan}}</span></td></tr>
<tr><td><strong>Startdato:</strong></td><td><span data-type="placeholder-field" data-key="workspace_start" data-label="Startdato" data-placeholder-type="manual" data-value="">{{workspace_start}}</span></td></tr>
<tr><td><strong>Pris:</strong></td><td><span data-type="placeholder-field" data-key="subscription_price" data-label="Pris" data-placeholder-type="manual" data-value="">{{subscription_price}}</span>,-</td></tr>
<tr><td><strong>Inkluderte brukere:</strong></td><td><span data-type="placeholder-field" data-key="included_users" data-label="Inkluderte brukere" data-placeholder-type="manual" data-value="">{{included_users}}</span></td></tr>
<tr><td><strong>Pris per mnd. per tilleggsbruker:</strong></td><td><span data-type="placeholder-field" data-key="extra_user_price" data-label="Tilleggsbrukerpris" data-placeholder-type="manual" data-value="">{{extra_user_price}}</span>,-</td></tr>
<tr><td><strong>Faktureringsintervall:</strong></td><td><span data-type="placeholder-field" data-key="billing_interval" data-label="Faktureringsintervall" data-placeholder-type="manual" data-value="">{{billing_interval}}</span></td></tr>
<tr><td><strong>Betalingsbetingelser:</strong></td><td><span data-type="placeholder-field" data-key="payment_terms" data-label="Betalingsbetingelser" data-placeholder-type="manual" data-value="">{{payment_terms}}</span> dager</td></tr>
<tr><td><strong>Oppsigelsestid:</strong></td><td>1 maned</td></tr>
</tbody>
</table>
<p><em>Alle priser er oppgitt eks. mva.</em></p>
<ul>
<li>Abonnement forskuddsfaktureres per <span data-type="placeholder-field" data-key="billing_interval" data-label="Faktureringsintervall" data-placeholder-type="manual" data-value="">{{billing_interval}}</span></li>
<li>Tilleggsbrukere (utover <span data-type="placeholder-field" data-key="included_users" data-label="Inkluderte brukere" data-placeholder-type="manual" data-value="">{{included_users}}</span> stk. inkl.) etterskuddsfaktureres per maned</li>
<li>Avtalen kan kanselleres kostnadsfritt innen 30 dager fra startdato</li>
</ul>
</div>

<div data-type="clause-block" data-clause-id="spesielle_vilkar" data-title="Spesielle vilkar og kommentarer" data-category="special" data-collapsed="false">
<h2>SPESIELLE VILKAR OG KOMMENTARER</h2>
<p><span data-type="placeholder-field" data-key="special_terms" data-label="Spesielle vilkar" data-placeholder-type="manual" data-value="">{{special_terms}}</span></p>
</div>

<div data-type="clause-block" data-clause-id="samtykke" data-title="Samtykke" data-category="legal" data-collapsed="false">
<h2>SAMTYKKE</h2>
<p>Kunden samtykker herved til Smartouts Lisens- og brukeravtale (Del 2).</p>
<p>Kunden samtykker herved til Smartouts Databehandlingsavtale (Del 3).</p>
</div>

<div data-type="clause-block" data-clause-id="signatur_kontrakt" data-title="Signaturer" data-category="signatures" data-collapsed="false">
<h2>SIGNATURER</h2>
<table>
<tbody>
<tr><td colspan="2"><strong>Kundens signatur</strong></td></tr>
<tr><td>Navn:</td><td><span data-type="placeholder-field" data-key="legal_agent_name" data-label="Daglig leder" data-placeholder-type="manual" data-value="">{{legal_agent_name}}</span></td></tr>
<tr><td>E-post:</td><td><span data-type="placeholder-field" data-key="legal_agent_email" data-label="E-post daglig leder" data-placeholder-type="manual" data-value="">{{legal_agent_email}}</span></td></tr>
<tr><td>Tittel:</td><td>Daglig leder</td></tr>
<tr><td>Dato:</td><td><span data-type="placeholder-field" data-key="current_date" data-label="Dato" data-placeholder-type="auto" data-value="">{{current_date}}</span></td></tr>
</tbody>
</table>
<div data-type="signature-field" data-role="recipient" data-label="Kundens signatur" data-required="true"></div>
<table>
<tbody>
<tr><td colspan="2"><strong>Smartouts signatur</strong></td></tr>
<tr><td>Navn:</td><td>Pontus S. Lindroth</td></tr>
<tr><td>Tittel:</td><td>Daglig leder</td></tr>
<tr><td>Dato:</td><td><span data-type="placeholder-field" data-key="current_date" data-label="Dato" data-placeholder-type="auto" data-value="">{{current_date}}</span></td></tr>
</tbody>
</table>
<div data-type="signature-field" data-role="sender" data-label="Smartouts signatur" data-required="true"></div>
<p><em>Innholdet i kontrakten, inkl. priser og betingelser, er a anse som konfidensielt og skal kun vaere kjent for de signerende parter.</em></p>
</div>

<hr/>

<h1>DEL 2 - LISENS- OG BRUKERAVTALE</h1>
<p><strong>mellom Kjoper (LISENSINNEHAVER) og leverandor (SMARTOUT)</strong><br/>Versjon: 2026-03-11</p>

<div data-type="clause-block" data-clause-id="lisens_1" data-title="1. Formal og bestilling" data-category="legal" data-collapsed="false">
<h3>1. Formal og bestilling</h3>
<p>Denne lisens- og brukeravtalen (&laquo;Avtalen&raquo;) regulerer LISENSINNEHAVERS tilgang til og bruk av Smartout-plattformen, levert av SMARTOUT AS (&laquo;SMARTOUT&raquo;). Avtalen trer i kraft nar LISENSINNEHAVER skriftlig aksepterer et gyldig tilbud fra SMARTOUT (&laquo;Tilbudet&raquo;). Avtalen gjelder for alle bestillinger og leveranser fra SMARTOUT. Ufravikelig lov gjelder foran Avtalen.</p>
</div>

<div data-type="clause-block" data-clause-id="lisens_2" data-title="2. Avtalens dokumenter og prioritet" data-category="legal" data-collapsed="false">
<h3>2. Avtalens dokumenter og prioritet</h3>
<p>Folgende dokumenter utgjor Avtalen. Ved motstrid gjelder prioritet i angitt rekkefolge:</p>
<ol type="A">
<li>Tilbudet (inkludert eventuelle tjenestebeskrivelser og prislister som det henvises til)</li>
<li>Denne Lisens- og brukeravtalen</li>
<li>Databehandleravtalen (Del 3)</li>
</ol>
</div>

<div data-type="clause-block" data-clause-id="lisens_3" data-title="3. Definisjoner" data-category="legal" data-collapsed="false">
<h3>3. Definisjoner</h3>
<p><strong>Plattformen:</strong> Smartout programvare og relaterte moduler levert som skytjeneste (SaaS).</p>
<p><strong>Bruker:</strong> Navngitt fysisk person registrert som aktiv i Smartout.</p>
<p><strong>Ansatt:</strong> Arbeidstaker eller innleid person registrert i LISENSINNEHAVERS ansattkartotek i Smartout.</p>
<p><strong>Support:</strong> Kundestotte levert av SMARTOUT i henhold til pkt. 7.3.</p>
<p><strong>Virkedag:</strong> Mandag-fredag, unntatt norske offentlige hoytidsdager.</p>
<p><strong>AI-generert innhold:</strong> Tekst, dokumenter, analyser, rutiner eller annet materiale som er helt eller delvis produsert av kunstig intelligens integrert i Plattformen.</p>
</div>

<div data-type="clause-block" data-clause-id="lisens_4" data-title="4. Bruksrett (lisens)" data-category="legal" data-collapsed="false">
<h3>4. Bruksrett (lisens)</h3>
<p>4.1 LISENSINNEHAVER gis en ikke-eksklusiv, ikke-overforbar, tidsbegrenset rett til a benytte Plattformen via nettleser og mobilklienter for intern virksomhet. Bruksretten omfatter tilgang til data lagret pa servere driftet for SMARTOUT.</p>
<p>4.2 Lisensen kan brukes pa enheter som tilhorer LISENSINNEHAVER eller deres ansatte/innleide. Tredjeparter kan ikke gis tilgang, med mindre annet fremgar av Tilbudet eller skriftlig avtale.</p>
<p>4.3 LISENSINNEHAVER kan ikke reverse engineere, dekompilere, kopiere, leie ut, lease, underlisensiere eller pa annen mate rade over Plattformen utover det som folger av Avtalen eller ufravikelig lov.</p>
</div>

<div data-type="clause-block" data-clause-id="lisens_5" data-title="5. Antall brukere og lisensomfang" data-category="legal" data-collapsed="false">
<h3>5. Antall brukere og lisensomfang</h3>
<p>5.1 Lisensen er begrenset til antallet aktive Brukere/Ansatte som fremgar av Tilbudet. &laquo;Aktiv&raquo; betyr registrert som aktiv i ansattkartoteket.</p>
<p>5.2 Reduksjon i antall brukere utfores av LISENSINNEHAVER i administrasjonsdashbordet og far virkning fra neste fakturaperiode, med mindre annet er avtalt i Tilbudet.</p>
<p>5.3 Okning utover avtalt volum meldes i administrasjonsdashbordet. Tilgang kan skaleres automatisk og faktureres fra pafolgende maned basert pa hoyeste samtidige aktive antall i perioden.</p>
<p>5.4 Deling av en lisens mellom flere foretak er ikke tillatt. Hvert juridisk foretak ma ha egen avtale og egen database, med mindre annet er skriftlig avtalt.</p>
</div>

<div data-type="clause-block" data-clause-id="lisens_6" data-title="6. Leveranse, vedlikehold og endringer" data-category="legal" data-collapsed="false">
<h3>6. Leveranse, vedlikehold og endringer</h3>
<p>6.1 SMARTOUT leverer Plattformen som SaaS. SMARTOUT kan gjore oppdateringer, forbedringer og endringer som ikke vesentlig forringer funksjonaliteten. Vesentlige endringer varsles med rimelig frist.</p>
<p>6.2 Planlagt vedlikehold legges primaert til lavtrafikkvinduer. Varsel gis normalt minst 48 timer i forkant. Kritiske sikkerhetsoppdateringer kan utfores uten forhandsvarsel.</p>
</div>

<div data-type="clause-block" data-clause-id="lisens_7" data-title="7. Service, support og tjenesteniva" data-category="legal" data-collapsed="false">
<h3>7. Service, support og tjenesteniva</h3>
<p>7.1 Drift: SMARTOUT tilstreber 99,5 % tilgjengelighet malt per kalendermaned, ekskludert varslet vedlikehold og forhold utenfor SMARTOUTs kontroll.</p>
<p>7.2 Backup: Daglige sikkerhetskopier oppbevares rullerende i minimum 30 dager. Gjenoppretting gjores pa best effort.</p>
<p>7.3 Support: Digital support leveres pa virkedager 09:00-16:00 CET via e-post, chat eller tilsvarende. Forstelinje respons innen 1 virkedag. Kunder med separat supportavtale kan ha utvidede vinduer og responstider.</p>
<p>7.4 Prioritering: Kunder med gyldig supportavtale prioriteres. Uansett far alle henvendelser svar senest innen 48 timer pa virkedager.</p>
<p>7.5 Feilhandtering: SMARTOUT vil rette meldte feil i henhold til alvorlighetsgrad. Kritiske driftsfeil prioriteres forst. Forbedringsonsker behandles uten forpliktelse til gjennomforing.</p>
<p>7.6 Inkludert support: Rimelig bruk av e-post- og chat-support i forbindelse med normal bruk av Plattformen er inkludert i abonnementet. Hva som utgjor rimelig bruk vurderes av SMARTOUT basert pa omfang og frekvens.</p>
</div>

<div data-type="clause-block" data-clause-id="lisens_8" data-title="8. Tredjepartstjenester og integrasjoner" data-category="legal" data-collapsed="false">
<h3>8. Tredjepartstjenester og integrasjoner</h3>
<p>8.1 Plattformen kan integrere mot tredjepartstjenester. LISENSINNEHAVER er ansvarlig for egne avtaler og kostnader hos slike tredjeparter.</p>
<p>8.2 SMARTOUT er ikke ansvarlig for nedetid eller endringer hos tredjepart.</p>
</div>

<div data-type="clause-block" data-clause-id="lisens_9" data-title="9. Priser og betaling" data-category="pricing" data-collapsed="false">
<h3>9. Priser og betaling</h3>
<p>9.1 Abonnement: LISENSINNEHAVER betaler abonnementsavgift angitt i Tilbudet fra ikrafttredelse. Faktureringsintervall (manedlig eller arlig) fremgar av Tilbudet.</p>
<p>9.2 Prisjustering: Abonnementspris indeksreguleres arlig per 1. januar med Konsumprisindeksen (totalindeks, SSB) uten saerskilt varsel. Prisjustering utover KPI varsles med 60 dagers frist.</p>
<p>9.3 Support utover inkludert omfang: Supporttjenester utover rimelig bruk (jf. pkt. 7.6) faktureres per pabegynt 15 minutt til NOK 850 eks. mva per time, med mindre saerskilt supportavtale foreligger.</p>
<p>9.4 Faktura: Betalingsfrist fremgar av Tilbudet (standard 15 dager). Forsinkelsesrente etter forsinkelsesrenteloven. Fakturagebyr og mva etter gjeldende regler.</p>
<p>9.5 Suspensjon ved manglende betaling: Manglende betaling kan medfore midlertidig stans av tilgang inntil oppgjor. SMARTOUT varsler skriftlig minst 14 dager for suspensjon.</p>
</div>

<div data-type="clause-block" data-clause-id="lisens_10" data-title="10. Rettigheter til immaterielle verdier" data-category="legal" data-collapsed="false">
<h3>10. Rettigheter til immaterielle verdier</h3>
<p>All immateriell rett til Plattformen, herunder kildekode, databasedesign, algoritmer, AI-modeller, merkevarer og dokumentasjon, tilhorer SMARTOUT eller SMARTOUTs lisensgivere. Avtalen overforer ikke eierskap. Data som LISENSINNEHAVER legger inn i Plattformen er til enhver tid LISENSINNEHAVERS eiendom.</p>
</div>

<div data-type="clause-block" data-clause-id="lisens_11" data-title="11. AI-generert innhold og ansvar" data-category="legal" data-collapsed="false">
<h3>11. AI-generert innhold og ansvar</h3>
<p>11.1 Plattformen benytter kunstig intelligens (AI) som er under aktiv utvikling. AI-generert innhold kan inneholde feil, unoyaktigheter eller mangler.</p>
<p>11.2 Alt materiale som AI genererer, leverer eller presenterer gjennom Plattformen skal kontrolleres og bekreftes av ansvarlig person hos LISENSINNEHAVER for bruk. LISENSINNEHAVER er ansvarlig for a verifisere AI-generert innhold for det tas i bruk i virksomheten.</p>
<p>11.3 SMARTOUT er ikke ansvarlig for tap, skade eller konsekvenser som oppstar som folge av AI-generert innhold som ikke er verifisert av LISENSINNEHAVER, eller som brukes i strid med pkt. 11.2.</p>
<p>11.4 SMARTOUT kan benytte anonymiserte og aggregerte data fra Plattformen til a forbedre AI-modeller og tjenestekvalitet, uten at enkeltpersoner eller kunder kan identifiseres.</p>
</div>

<div data-type="clause-block" data-clause-id="lisens_12" data-title="12. Datasikkerhet og personvern" data-category="legal" data-collapsed="false">
<h3>12. Datasikkerhet og personvern</h3>
<p>12.1 Roller: Ved behandling av personopplysninger fungerer LISENSINNEHAVER som behandlingsansvarlig og SMARTOUT som databehandler.</p>
<p>12.2 Databehandleravtale: Partene inngar databehandleravtale i samsvar med GDPR art. 28. Databehandleravtalen utgjor Del 3 og gjelder foran denne Avtalen ved motstrid om personvernforpliktelser.</p>
<p>12.3 Sikkerhet: SMARTOUT opprettholder tekniske og organisatoriske tiltak som star i rimelig forhold til risiko, inkludert tilgangsstyring, kryptering i transitt og hvile, logging og jevnlige sikkerhetsoppdateringer.</p>
<p>12.4 Brudd: Brudd pa personopplysningssikkerheten varsles LISENSINNEHAVER uten ugrunnet opphold og senest innen 24 timer etter at SMARTOUT ble kjent med bruddet.</p>
<p>12.5 Underleverandorer: SMARTOUT kan benytte underdatabehandlere. Oppdatert liste holdes tilgjengelig i Vedlegg 2 til Databehandleravtalen. Vesentlige endringer varsles med mulighet for a protestere nar saklig begrunnet.</p>
<p>12.6 Dataeksport: LISENSINNEHAVER kan eksportere egne data via tilgjengelige funksjoner eller pa foresporsel i et alminnelig maskinlesbart format.</p>
</div>

<div data-type="clause-block" data-clause-id="lisens_13" data-title="13. LISENSINNEHAVERS plikter" data-category="legal" data-collapsed="false">
<h3>13. LISENSINNEHAVERS plikter</h3>
<p>13.1 LISENSINNEHAVER skal sikre at registrerte brukere er autoriserte og at tilgangsstyring er korrekt.</p>
<p>13.2 LISENSINNEHAVER er ansvarlig for korrekt registrering og vedlikehold av egne data.</p>
<p>13.3 Ved skriftlig varsel om uforholdsmessig hoy trafikk eller belastning skal LISENSINNEHAVER tilpasse bruken uten ugrunnet opphold.</p>
<p>13.4 Misbruk, forsok pa omgaelse av sikkerhetsmekanismer, uautorisert testing eller angrep (inkl. DoS) er vesentlig mislighold.</p>
<p>13.5 LISENSINNEHAVER er ansvarlig for a gi egne administratorer og brukere nodvendig opplaering i sikker bruk av Plattformen.</p>
</div>

<div data-type="clause-block" data-clause-id="lisens_14" data-title="14. Ansvarsbegrensning" data-category="legal" data-collapsed="false">
<h3>14. Ansvarsbegrensning</h3>
<p>14.1 SMARTOUT er ikke ansvarlig for indirekte tap, herunder tapt fortjeneste, tapt data, tap av goodwill eller produksjonstap.</p>
<p>14.2 Samlet ansvar for direkte tap i en 12-manedersperiode er begrenset til det belop LISENSINNEHAVER faktisk har betalt for Plattformen i samme periode. Begrensningen gjelder ikke ved forsett eller grov uaktsomhet, eller ansvar som ikke kan begrenses etter ufravikelig lov.</p>
</div>

<div data-type="clause-block" data-clause-id="lisens_15" data-title="15. Konfidensialitet" data-category="legal" data-collapsed="false">
<h3>15. Konfidensialitet</h3>
<p>15.1 Partene skal bevare taushet om hverandres konfidensielle opplysninger. Lonns-, personal- og driftsdata hos LISENSINNEHAVER anses konfidensielt. Produktplaner, testresultater og forretningsutvikling hos SMARTOUT anses konfidensielt.</p>
<p>15.2 Konfidensialitetsplikten gjelder i Avtalens lopetid og i 5 ar etter opphor, eller lenger der lov krever det.</p>
</div>

<div data-type="clause-block" data-clause-id="lisens_16" data-title="16. Varighet, fornyelse og oppsigelse" data-category="legal" data-collapsed="false">
<h3>16. Varighet, fornyelse og oppsigelse</h3>
<p>16.1 Ikrafttredelse: Avtalen loper fra aksept av Tilbudet.</p>
<p>16.2 Lopende avtale: Avtalen loper pa manedlig eller arlig basis som angitt i Tilbudet, og fornyes automatisk for tilsvarende perioder.</p>
<p>16.3 Oppsigelse: Begge parter kan si opp med 1 maneds skriftlig varsel gjeldende fra forste dag i pafolgende maned. Eventuell bindingstid fremgar av Tilbudet.</p>
<p>16.4 Kanselleringsrett: Avtalen kan kanselleres kostnadsfritt innen 30 dager fra startdato.</p>
<p>16.5 Heving: Vesentlig mislighold som ikke er rettet innen rimelig frist etter skriftlig varsel gir rett til heving med umiddelbar virkning.</p>
<p>16.6 Virkninger av opphor: Tilgang opphorer ved utlopet av oppsigelsestiden. SMARTOUT sletter personopplysninger i henhold til Databehandleravtalen og ovrige data etter 60 dager, med mindre lagring kreves ved lov eller videre lagring er skriftlig avtalt. Data kan eksporteres for sletting.</p>
</div>

<div data-type="clause-block" data-clause-id="lisens_17" data-title="17. Force majeure" data-category="legal" data-collapsed="false">
<h3>17. Force majeure</h3>
<p>Ingen av partene er ansvarlig for manglende oppfyllelse som skyldes forhold utenfor partens rimelige kontroll, inkludert krig, streik, pandemi, brann, strom- eller nettstans, tredjeparts skytjenestefeil eller offentlige palegg. Forpliktelser suspenderes sa lenge forholdet varer. Dersom force majeure vedvarer i mer enn 90 dager, kan begge parter si opp Avtalen med umiddelbar virkning.</p>
</div>

<div data-type="clause-block" data-clause-id="lisens_18" data-title="18. Endringer i vilkar" data-category="legal" data-collapsed="false">
<h3>18. Endringer i vilkar</h3>
<p>SMARTOUT kan oppdatere Avtalen ved behov. Vesentlige endringer varsles minst 60 dager for ikrafttredelse. Fortsatt bruk etter ikrafttredelse anses som aksept. Prisendringer reguleres av pkt. 9.2.</p>
</div>

<div data-type="clause-block" data-clause-id="lisens_19" data-title="19. Overdragelse" data-category="legal" data-collapsed="false">
<h3>19. Overdragelse</h3>
<p>LISENSINNEHAVER kan ikke overdra Avtalen uten skriftlig samtykke fra SMARTOUT. SMARTOUT kan overdra Avtalen som ledd i virksomhetsoverdragelse, fusjon eller salg av virksomheten, forutsatt at rettighetene til LISENSINNEHAVER ikke forringes.</p>
</div>

<div data-type="clause-block" data-clause-id="lisens_20" data-title="20. Varsler" data-category="legal" data-collapsed="false">
<h3>20. Varsler</h3>
<p>Varsler etter Avtalen gis skriftlig til oppgitte kontaktpunkter eller via administrasjonsdashbordet. Elektronisk kommunikasjon oppfyller skriftlighetskrav.</p>
</div>

<div data-type="clause-block" data-clause-id="lisens_21" data-title="21. Lovvalg og verneting" data-category="legal" data-collapsed="false">
<h3>21. Lovvalg og verneting</h3>
<p>Avtalen er underlagt norsk rett. Tvister sokes lost i minnelighet. Dersom soksmal reises, er Telemark tingrett verneting.</p>
</div>

<div data-type="clause-block" data-clause-id="lisens_22" data-title="22. Helhetsavtale" data-category="legal" data-collapsed="false">
<h3>22. Helhetsavtale</h3>
<p>Avtalen utgjor sammen med Tilbudet og Databehandleravtalen hele avtalen mellom partene om Plattformen og erstatter tidligere avtaler om samme forhold.</p>
</div>

<hr/>

<h1>DEL 3 - DATABEHANDLINGSAVTALE</h1>
<p><strong>mellom Behandlingsansvarlig (LISENSINNEHAVER) og Databehandler (SMARTOUT)</strong><br/>Versjon: 2026-03-11</p>

<div data-type="clause-block" data-clause-id="dpa_1" data-title="1. Formal, omfang og varighet" data-category="legal" data-collapsed="false">
<h3>1. Formal, omfang og varighet</h3>
<p>Avtalen er inngatt i henhold til GDPR (EU) 2016/679 artikkel 28 og personopplysningsloven av 15. juni 2018 nr. 38. Avtalen regulerer Smartout AS'' behandling av personopplysninger pa vegne av Behandlingsansvarlig som ledd i leveranse av Smartout-plattformen (SaaS) for arbeidsplan, opplaering, kommunikasjon, kvalitetsstyring og relaterte moduler. Avtalen gjelder sa lenge lisensavtalen loper. Smartout behandler kun etter dokumenterte instrukser fra Behandlingsansvarlig.</p>
</div>

<div data-type="clause-block" data-clause-id="dpa_2" data-title="2. Behandlingen av personopplysninger" data-category="legal" data-collapsed="false">
<h3>2. Behandlingen av personopplysninger</h3>
<h4>2.1 Tjenester/Moduler</h4>
<p>Smartout leverer elektroniske systemer for arbeidsplanlegging, rutiner og prosedyrer, kommunikasjon, varebeholdning, opplaering og rapportering. Avtalen omfatter all behandling i moduler hvor personopplysninger behandles, herunder ansattkontoer, arbeidsplan, tidsregistrering, meldinger, dokumentasjon og rapportering.</p>
<h4>2.2 Personopplysninger som behandles</h4>
<p>Behandlingsansvarlig fastsetter hvilke felter som tas i bruk i trad med dataminimering. Typiske opplysninger:</p>
<ul>
<li>Fornavn og etternavn (eller intern ID ved pseudonymisering)</li>
<li>Fodselsdato og fodselsnummer kun der strengt nodvendig og uttrykkelig instruert, med saerskilt rettslig grunnlag og tiltak</li>
<li>Ansattnummer</li>
<li>Adresse, kommunenummer, telefonnummer</li>
<li>E-postadresse</li>
<li>Stilling/tittel og ansettelsesforhold</li>
<li>Ansettelsesdato</li>
<li>Lonnstype/timesats der relevant</li>
<li>Avdelingstilhorighet</li>
<li>Disponibel ferie/avspasering</li>
<li>Timelister og stemplinger</li>
<li>Vaktlister og oppgaveplaner</li>
<li>Systemhendelser og meldinger relatert til tjenesten</li>
</ul>
<h4>2.3 Smartouts behandling av data</h4>
<p>Smartout drifter og administrerer tjenesten og skal sikre konfidensialitet, integritet og tilgjengelighet. Kun autorisert personell med tjenstlig behov far tilgang. All trafikk er kryptert. Lagring skjer hos godkjente underbehandlere beskrevet i Vedlegg 2. Smartout bruker ikke personopplysninger til andre formal enn avtalt, herunder drift, sikkerhet, feillogging, brukerstotte og fakturagrunnlag. Aggregert og anonymisert statistikk kan benyttes til tjenesteforbedring uten identifisering av person eller kunde.</p>
<h4>2.4 Tilgang for Behandlingsansvarlig</h4>
<p>Tilgang gis via passordbeskyttet nettilgang med rollebasert tilgangsstyring (RBAC). Behandlingsansvarlig bestemmer interne tilgangsniva. Smartout oppretter og administrerer kundetilganger iht. instruks.</p>
<h4>2.5 Utlevering</h4>
<p>Utlevering til tredjeparter skjer kun til godkjente underbehandlere (Vedlegg 2), eller der det folger av lov/gyldig rettskjennelse. Alle Smartout-ansatte og kontraktorer er underlagt taushetsplikt.</p>
</div>

<div data-type="clause-block" data-clause-id="dpa_3" data-title="3. Roller, instruks og plikter" data-category="legal" data-collapsed="false">
<h3>3. Roller, instruks og plikter</h3>
<h4>3.1 Behandlingsansvarliges plikter</h4>
<p>Behandlingsansvarlig forplikter seg til a:</p>
<ul>
<li>Fastsette behandlingsgrunnlag for alle formal, og dokumentere formal, kategorier og lagringstider (art. 5 og 6).</li>
<li>Informere de registrerte iht. art. 13/14 og oppdatere personvernerklaering.</li>
<li>Ivareta dataminimering, riktighet og slettepolicy, inkl. rutiner for arlig gjennomgang av felter i bruk.</li>
<li>Konfigurere tilgangsstyring i kundekontoen, gjennomfore periodisk tilgangsrevisjon og opprette/sperre brukere.</li>
<li>Beslutte og dokumentere bruk av fodselsnummer kun der nodvendig og med saerskilt grunnlag, samt alternative identifikatorer der mulig.</li>
<li>Utfore og holde oppdatert DPIA der risikoniva tilsier det (art. 35) og konsultere Datatilsynet ved behov (art. 36).</li>
<li>Handtere henvendelser fra registrerte og gi Smartout nodvendig instruks og frister for bistand.</li>
<li>Godkjenne/innvende mot nye underbehandlere innen fristen i pkt. 5 og gjennomga Vedlegg 2 arlig.</li>
<li>Sorge for lovlig overforing ved integrasjoner som Behandlingsansvarlig initierer, og sikre databehandleravtaler med egne tredjepartsleverandorer.</li>
<li>Varsle Smartout uten ugrunnet opphold ved feil i data, feilaktige instrukser eller mistenkte brudd i eget miljo.</li>
<li>Betale avtalt vederlag for bistand utover lovpalagt minimum, jf. pkt. 7.</li>
<li>Sikre at egne administratorer og brukere far nodvendig opplaering i sikker bruk av losningen.</li>
</ul>
<h4>3.2 Databehandlers rolle</h4>
<p>Smartout opptrer som databehandler og folger art. 28(3): kun etter instruks, konfidensialitet, sikkerhetstiltak, underbehandlere med like vilkar, bistand til rettigheter/DPIA, handtering av brudd, sletting/retur, og tilgjengeliggjoring av etterlevelsesinformasjon.</p>
</div>

<div data-type="clause-block" data-clause-id="dpa_4" data-title="4. Tekniske og organisatoriske tiltak (TOMs)" data-category="legal" data-collapsed="false">
<h3>4. Tekniske og organisatoriske tiltak (TOMs)</h3>
<p>Smartout opprettholder tiltak listet i Vedlegg 1: RBAC/least-privilege, MFA, kryptering i transitt og hvile, nokkelstyring, sikker utvikling, sarbarhetsshandtering, logging/overvakning, hendelseshandtering, backup/BCP, leverandorstyring, opplaering og regelmessige tester.</p>
</div>

<div data-type="clause-block" data-clause-id="dpa_5" data-title="5. Underbehandlere" data-category="legal" data-collapsed="false">
<h3>5. Underbehandlere</h3>
<p>Godkjente underbehandlere fremgar av Vedlegg 2. Nye eller endrede underbehandlere varsles minst 30 dager for bruk. Behandlingsansvarlig kan fremme saklig innsigelse; ved uenighet kan berort tjeneste sies opp gebyrfritt. Smartout palegger underbehandlere minst samme forpliktelser.</p>
</div>

<div data-type="clause-block" data-clause-id="dpa_6" data-title="6. Behandlingssted og overforinger" data-category="legal" data-collapsed="false">
<h3>6. Behandlingssted og overforinger</h3>
<p>Primaer lagring skjer innen EOS der dette er etablert. Overforing utenfor EOS krever forhandssamtykke fra Behandlingsansvarlig, gyldig overforingsgrunnlag (f.eks. EUs standardbestemmelser eller EU-US Data Privacy Framework) og dokumentert TIA. Se Vedlegg 2.</p>
</div>

<div data-type="clause-block" data-clause-id="dpa_7" data-title="7. Bistand og etterlevelse" data-category="legal" data-collapsed="false">
<h3>7. Bistand og etterlevelse</h3>
<p>Smartout bistar uten ugrunnet opphold med: innsyn, retting, sletting, begrensning, dataportabilitet, DPIA og forhandsdrofting, samt tilsynsforesporsel. Smartout gjor tilgjengelig nodvendig informasjon for a pavise etterlevelse, jf. art. 28(3)(h). Bistand utover rimelig omfang kan faktureres etter medgatt tid iht. gjeldende timepris.</p>
</div>

<div data-type="clause-block" data-clause-id="dpa_8" data-title="8. Varsling ved brudd pa personopplysningssikkerheten" data-category="legal" data-collapsed="false">
<h3>8. Varsling ved brudd pa personopplysningssikkerheten</h3>
<p>Smartout varsler Behandlingsansvarlig uten ugrunnet opphold og senest innen 24 timer etter kjennskap til brudd, med opplysninger iht. art. 33(3). Partene samarbeider om tiltak og dokumentasjon.</p>
</div>

<div data-type="clause-block" data-clause-id="dpa_9" data-title="9. Revisjon og innsyn" data-category="legal" data-collapsed="false">
<h3>9. Revisjon og innsyn</h3>
<p>Behandlingsansvarlig kan arlig gjennomfore revisjon med minst 10 arbeidsdagers varsel, eller motta uavhengig revisorattest/sertifikat. Initiativtaker dekker kostnader, med mindre vesentlige avvik avdekkes.</p>
</div>

<div data-type="clause-block" data-clause-id="dpa_10" data-title="10. Sletting og retur ved opphor eller instruks" data-category="legal" data-collapsed="false">
<h3>10. Sletting og retur ved opphor eller instruks</h3>
<p>Pa instruks eller ved opphor: eksport i maskinlesbart format innen 30 dager; sletting av aktive kopier innen 60 dager; sanitering av backup via rotasjon senest innen 90 dager. Smartout utsteder slettesertifikat.</p>
</div>

<div data-type="clause-block" data-clause-id="dpa_11" data-title="11. Varighet og oppsigelse" data-category="legal" data-collapsed="false">
<h3>11. Varighet og oppsigelse</h3>
<p>Avtalen gjelder sa lenge Smartout behandler pa vegne av Behandlingsansvarlig. Oppsigelse og opphor handteres i samsvar med lisensavtalen, men sletting/retur folger punkt 10.</p>
</div>

<div data-type="clause-block" data-clause-id="dpa_12" data-title="12. Forrang, lovvalg og verneting" data-category="legal" data-collapsed="false">
<h3>12. Forrang, lovvalg og verneting</h3>
<p>Ved motstrid mellom denne avtalen og Lisens- og brukeravtalen har denne avtalen forrang for personvern og informasjonssikkerhet. Norsk rett gjelder. Verneting: Telemark tingrett.</p>
</div>
',
  description = 'Komplett 3-delt Smartout-kontrakt (v2026-03-11): Del 1 Kontrakt med priser/vilkar, Del 2 Lisens- og brukeravtale (22 seksjoner), Del 3 Databehandlingsavtale GDPR art. 28 (12 seksjoner). Norsk rett, Telemark tingrett.',
  placeholders = '[
    {"key": "name_company", "label": "Firmanavn", "source": "workspace.company", "field": "name", "required": true},
    {"key": "company_street", "label": "Adresse", "source": "workspace", "field": "address_line_1", "required": true},
    {"key": "company_zip_code", "label": "Postnr.", "source": "workspace", "field": "postal_code", "required": true},
    {"key": "workspace_city", "label": "Sted", "source": "workspace", "field": "city", "required": true},
    {"key": "company_org_number", "label": "Org.nr.", "source": "workspace.company", "field": "org_number", "required": true},
    {"key": "company_phone", "label": "Telefon", "source": "manual", "required": false},
    {"key": "company_email", "label": "E-post", "source": "manual", "required": true},
    {"key": "invoice_email", "label": "Faktura e-post", "source": "manual", "required": false},
    {"key": "legal_agent_name", "label": "Daglig leder", "source": "manual", "required": true},
    {"key": "legal_agent_email", "label": "E-post daglig leder", "source": "manual", "required": true},
    {"key": "subscription_plan", "label": "Abonnement", "source": "manual", "required": true, "default_value": "Basic"},
    {"key": "workspace_start", "label": "Startdato", "source": "manual", "required": true},
    {"key": "subscription_price", "label": "Pris", "source": "manual", "required": true},
    {"key": "included_users", "label": "Inkluderte brukere", "source": "manual", "required": true, "default_value": "10"},
    {"key": "extra_user_price", "label": "Tilleggsbrukerpris", "source": "manual", "required": false, "default_value": "50"},
    {"key": "billing_interval", "label": "Faktureringsintervall", "source": "manual", "required": true, "default_value": "ar"},
    {"key": "payment_terms", "label": "Betalingsbetingelser", "source": "manual", "required": false, "default_value": "15"},
    {"key": "special_terms", "label": "Spesielle vilkar", "source": "manual", "required": false},
    {"key": "current_date", "label": "Dato", "source": "auto", "required": true}
  ]'::jsonb,
  status = 'active',
  is_active = true
WHERE template_id = 'c0000002-0000-0000-0000-000000000002';
