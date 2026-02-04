# GitHub Pages vs. Vercel for math_visuals

## Distribusjonsmodell
- **GitHub Pages** bygger statiske filer direkte fra en gren (f.eks. `main` eller `gh-pages`).
- **Vercel** bygger et prosjekt via sin egen pipeline og kan håndtere både statiske og server-side genererte sider.

## Bygg og deploy
- GitHub Pages trigges vanligvis ved push til valgt gren eller `docs/`-mappen og krever at statiske artefakter allerede er sjekket inn eller genereres via GitHub Actions.
- Vercel kjører `npm install`, `npm run build` osv. automatisk på hver push og lagrer bygde artefakter i sin edge-infrastruktur.

## URL og ruting
- GitHub Pages serverer innhold fra et domenenavn under `github.io` (f.eks. `brukernavn.github.io/math_visuals/`).
- Vercel gir et eget domenenavn per prosjekt (f.eks. `project-slug.vercel.app`) og støtter egendefinerte domener.

## Ytelse og funksjoner
- GitHub Pages er optimalisert for enkel hosting av statiske filer uten serverlogikk.
- Vercel tilbyr funksjoner som edge caching, serverløse funksjoner og forhåndsvisningsdeploy per pull request.

## Lenking mellom plattformer
- Du kan lenke fra et GitHub Pages-nettsted til en Vercel-distribusjon ved å bruke en vanlig `<a href="https://...">`-lenke. Hvis du vil beholde eksisterende URL-er, kan GitHub Pages fungere som en portal som peker brukerne videre til den nye adressen på Vercel.
