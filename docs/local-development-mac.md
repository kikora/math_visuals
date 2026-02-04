# Lokal utvikling på Mac (steg for steg)

Denne siden er en **enkel veiledning** for å kjøre Math Visuals lokalt og sjekke at eksemplene faktisk lagres. Følg punktene i rekkefølge.

## 0. Sørg for riktig Node- og npm-versjon

`@cortex-js/compute-engine` krever minst **Node 21.7.3** og **npm 10.5.0**. Hvis du ser advarsler om «Unsupported engine», må du oppdatere Node/npm.

### 0a. Installer `nvm` (hvis du får `command not found`)

1. Åpne Terminal (⌘ + Mellomrom → skriv `Terminal`).
2. Lim inn denne linjen og trykk Enter:
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
   ```
3. Lukk terminalvinduet helt og åpne et nytt. (I VS Code: lukk terminalfanen og åpne `Terminal` på nytt.)
4. Sjekk at `nvm` nå finnes:
   ```bash
   command -v nvm
   ```
   Hvis du ser `nvm`, er installasjonen vellykket. Hvis den fortsatt mangler, se feilsøking nederst.

> **Alternativ uten nvm:** Hvis du foretrekker Homebrew, kan du kjøre `brew install node@22` og deretter `brew link --overwrite node@22`. Pass da på at `node -v` i terminalen din viser `v22.x` før du går videre.

### 0b. Bytt til Node 22 med `nvm`

1. I terminalen:
   ```bash
   nvm install 22
   nvm use 22
   node -v && npm -v
   ```
2. Output skal vise Node ≥ 22 og npm ≥ 10.5.
3. Hvis du jobber i VS Code, lukk og åpne terminalen på nytt etter `nvm use 22`, slik at den fanger opp riktig versjon.

## 1. Last ned prosjektet lokalt

1. Gå til GitHub/Vercel og last ned prosjektet som **zip**, eller klon repoet med Git.
2. Pakk ut zip-filen.
3. Inne i zip-mappen ligger ofte en ekstra undermappe, for eksempel `math_visuals-main/math_visuals`.
4. Åpne VS Code i innerste mappe (`File → Open Folder …`).

## 2. Åpne terminal i riktig mappe

1. I VS Code: `View → Terminal` (eller ``⌃` ``).
2. Skriv `pwd` for å se hele stien.
3. Skriv `ls` og sjekk at du ser `package.json` i lista. Hvis ikke: `cd` videre inn til mappen som inneholder `package.json`.
   ```bash
   cd path/til/mappen/med/packagejson
   ls
   ```

## 3. Installer avhengigheter

Kjør dette én gang etter at du har riktig Node-versjon og står i mappen med `package.json`:

```bash
npm install
```

Du kan ignorere meldinger om utdaterte pakker, men **ikke** meldingen «Unsupported engine». Hvis den fortsatt dukker opp, sjekk at `node -v` er 22.x i samme terminal.

## 4. Start utviklingsserveren

1. I terminalen kjører du:
   ```bash
   npx vercel dev
   ```
   `npx` gjør at du slipper å installere Vercel CLI globalt.
2. Første gang må du kanskje logge inn i Vercel fra terminalen. Følg instruksjonene som dukker opp.
3. Når serveren er i gang ser du en linje som ligner:
   ```
   > Ready! Available at http://localhost:3000
   ```
4. La terminalen stå åpen. Så lenge denne prosessen kjører er både front-end og API tilgjengelig lokalt.

## 5. Test at lagringen er varig

Åpne et **nytt** terminalvindu (eller fanen `+` i VS Code-terminalen), og pass på at du fortsatt er i prosjektmappen.

```bash
npm run check-examples-api
```

* Får du «varig lagring (kv)», er alt satt opp riktig (kv betyr at Redis er i bruk).
* Får du «midlertidig minne», må du legge inn `REDIS_ENDPOINT`, `REDIS_PORT` og `REDIS_PASSWORD` (se neste seksjon).
* Får du feilmelding om at API-et ikke svarer, kjører ikke `vercel dev`-prosessen eller du peker mot feil URL. Start `npx vercel dev` og prøv igjen.

## 6. Legg inn Redis-hemmeligheter når du trenger permanent lagring

1. Sett `REGION` og `DATA_STACK` til de samme verdiene som i AWS (for eksempel `eu-west-1` og `math-visuals-data`).
2. Kjør de samme kommandoene som beskrevet i `docs/examples-storage.md` for å hente Parameter Store- og Secrets Manager-verdiene:
   ```bash
   REGION=eu-west-1
   DATA_STACK=math-visuals-data

   REDIS_ENDPOINT_PARAMETER=$(aws cloudformation describe-stacks \
     --region "$REGION" \
     --stack-name "$DATA_STACK" \
     --query 'Stacks[0].Outputs[?OutputKey==`RedisEndpointParameterName`].OutputValue' \
     --output text)

   REDIS_PORT_PARAMETER=$(aws cloudformation describe-stacks \
     --region "$REGION" \
     --stack-name "$DATA_STACK" \
     --query 'Stacks[0].Outputs[?OutputKey==`RedisPortParameterName`].OutputValue' \
     --output text)

   export REDIS_ENDPOINT=$(aws ssm get-parameter --region "$REGION" --name "$REDIS_ENDPOINT_PARAMETER" --query 'Parameter.Value' --output text)
   export REDIS_PORT=$(aws ssm get-parameter --region "$REGION" --name "$REDIS_PORT_PARAMETER" --query 'Parameter.Value' --output text)

   REDIS_PASSWORD_SECRET=$(aws cloudformation describe-stacks \
     --region "$REGION" \
     --stack-name "$DATA_STACK" \
     --query 'Stacks[0].Outputs[?OutputKey==`RedisPasswordSecretName`].OutputValue' \
     --output text)

   export REDIS_PASSWORD=$(aws secretsmanager get-secret-value --region "$REGION" --secret-id "$REDIS_PASSWORD_SECRET" --query 'SecretString' --output text | jq -r '.authToken')
   ```
   Lagre verdiene i `.env.local` hvis du vil slippe å eksportere dem for hver økt (filen er allerede ignorert av Git).
3. Start `npx vercel dev` på nytt etter at variablene er satt, slik at backend kan koble seg til Redis.
4. Kjør `npm run check-examples-api` igjen for å bekrefte at lagringen nå er «varig».

## 7. Test i nettleseren

1. Åpne `http://localhost:3000/arealmodell.html` (eller et annet verktøy).
2. Lag et eksempel og lagre det.
3. Last siden på nytt (⌘ + R). Eksemplet skal fortsatt være der hvis Redis er konfigurert.

## 8. Når bør du be om hjelp?

* Du får ikke logget inn i Vercel CLI.
* `npm run check-examples-api` klarer ikke å koble til API-et.
* Du ser fortsatt «midlertidig minne» etter at du har lagt inn `REDIS_*`-variablene.

Del skjermdump eller terminal-output når du spør om hjelp – da er det enklere å se hva som mangler.

## Feilsøking

**`nvm` finnes fortsatt ikke etter installasjon**

1. Sjekk at du har lagt til følgende i `~/.zshrc` eller `~/.bashrc` (installasjonsskriptet gjør det automatisk, men hvis du bruker VS Code sin innebygde terminal kan det hende du må logge helt ut/inn):
   ```bash
   export NVM_DIR="$HOME/.nvm"
   [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
   [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
   ```
2. Lukk alle terminalvinduer og åpne et nytt. Skriv `command -v nvm` igjen.
3. Fungerer det fortsatt ikke, prøv å installere på nytt eller bruk `brew install node@22` som midlertidig løsning.
