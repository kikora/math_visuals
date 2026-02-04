# Frontend-issueoversikt

| # | Prioritet | Type | Estimat | Tittel | Beskrivelse |
| - | --------- | ---- | ------- | ------ | ----------- |
| 1 | Høy | Feature | 2,5 dag | Søk og filtrering i hovedmenyen | Navigasjonen i `index.html` består av et langt horisontalt ikon-bibliotek uten søk, noe som gjør det tidkrevende å finne riktig app på små skjermer; legg til søkefelt/filtre og tastaturnavigasjon som begrenser listen mens man skriver. |
| 2 | Medium | Bug | 1 dag | Mobilnavigasjon bør kunne lukkes med Escape/fokusbytte | Burger-menyen styres kun av et klikk-handler på `nav-toggle`, og lukkes bare automatisk ved klikk på lenker i småskjerm-modus; legg til Escape/fokus-håndtering slik at menyen ikke forblir åpen for tastaturbrukere. |
| 3 | Medium | Feature | 1,5 dag | Lastestatus for innhold-iframe | `index.html` peker `iframe`-en direkte mot valgt app uten mellomliggende status; vis loader/feilmelding når appen hentes eller feiler, slik at brukeren får respons mens innholdet byttes. |
