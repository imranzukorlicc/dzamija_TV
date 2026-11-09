NAMASKA VREMENA - uputstvo
==========================

POKRETANJE
  Windows: dvoklik na start-server.bat (potreban Python), pa http://localhost:8080
  (Fajl index.html ne radi dvoklikom jer preglednik blokira učitavanje JSON fajlova.)
  Za TV: postavite folder na bilo koji hosting (Netlify, GitHub Pages, vlastiti server)
  ili otvorite adresu računara u mreži. Na TV-u otvorite stranicu preko preglednika
  (preporuka: Chrome / Fully Kiosk Browser u punom ekranu).

TV KOJI STOJI USPRAVNO
  - Ako TV/sistem podržava rotaciju ekrana (Android TV, Windows, Raspberry Pi) - rotirajte
    ekran u postavkama i otvorite običnu adresu. Izgled je tada kao na slici.
  - Ako TV šalje pejzažnu sliku, a fizički je okrenut, dodajte u adresu:
        ?rotate=90      (okreće sliku u smjeru kazaljke)
        ?rotate=-90     (suprotno)
    npr. http://localhost:8080/?rotate=90

LOGO
  Zamijenite fajl assets/logo.png svojim (PNG, najbolje kvadratni, prozirna pozadina).

NAMASKA VREMENA  (data/namaz-2026.json, namaz-2027.json, namaz-2028.json)
  - Vremena su preuzeta iz službenih podataka vaktija.ba (https://github.com/vaktija/vaktija.ba)
    za Novi Pazar, uz ljetno računanje vremena uračunato za svaku godinu posebno.
  - Aplikacija sama bira fajl po tekućoj godini (namaz-GODINA.json); ako ga nema, koristi
    data/namaz.json (isti format). Ključ je datum "MM-DD", format vremena HH:MM.
  - Ispravke radite direktno u tim fajlovima.
  - Novu godinu ili drugi grad generišete ovako (potreban Python i internet):
        python tools/vaktija_to_json.py "Novi Pazar" 2029 2030
    Gradovi su isti kao na vaktija.ba (npr. Sjenica, Tutin, Prijepolje, Sarajevo...).

HADISI  (data/hadisi.json)
  Polja: arapski (nije obavezno), tekst, prenosilac, izvor (ko bilježi), slika (nije obavezno).
  Slike stavljajte u assets/hadis/ i upišite putanju, npr. "assets/hadis/slika1.jpg".
  Primjeri hadisa su opšteg karaktera - provjerite ih sa imamom prije javnog prikaza.

POSTAVKE  (data/config.json)
  naziv, vremenskaZona, hidzretPomak (-1/0/+1 dan za ispravku hidžretskog datuma),
  hadisSekundi (koliko traje jedan hadis), nazivi namaza.

TAČNO VRIJEME
  Aplikacija se na početku i svakih 30 min usklađuje sa internetom (worldtimeapi.org,
  timeapi.io, a ako ni to nije dostupno - vrijeme web servera). Ako nema interneta,
  koristi se sat uređaja.

JSON fajlovi se samo ponovo učitaju svakih sat vremena - ili osvježite stranicu (F5).
