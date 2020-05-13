'use strict';

// Jean Michel Cid Matrciule: 20031706 SAAH Yann Matricule: 20061840
// Date:14/12/2018

/* Ce programmme se charge de prendre sous forme de sondage les presences
   a des evenements a des dates et des heures differentes.
   Il s'ecrit sous la forme de doodle... */

var http = require("http");
var fs = require('fs');
var urlParse = require('url').parse;
var pathParse = require('path').parse;
var querystring = require('querystring');

var port = 1337;
var hostUrl = 'http://localhost:' + port + '/';
var defaultPage = '/index.html';

var mimes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
};

// --- Helpers ---
var readFile = function(path) {
    return fs.readFileSync(path).toString('utf8');
};

var writeFile = function(path, texte) {
    fs.writeFileSync(path, texte);
};

// --- Server handler ---
var redirect = function(reponse, path, query) {
    var newLocation = path + (query == null ? '' : '?' + query);
    reponse.writeHeader(302, {
        'Location': newLocation
    });
    reponse.end('302 page déplacé');
};

var getDocument = function(url) {
    var pathname = url.pathname;
    var parsedPath = pathParse(url.pathname);
    var result = {
        data: null,
        status: 200,
        type: null
    };

    if (parsedPath.ext in mimes) {
        result.type = mimes[parsedPath.ext];
    } else {
        result.type = 'text/plain';
    }

    try {
        result.data = readFile('./public' + pathname);
        console.log('[' + new Date().toLocaleString('iso') + "] GET " + url.path);
    } catch (e) {
        // File not found.
        console.log('[' + new Date().toLocaleString('iso') + "] GET " +
            url.path + ' not found');
        result.data = readFile('template/error404.html');
        result.type = 'text/html';
        result.status = 404;
    }

    return result;
};
var sendPage = function(reponse, page) {
    reponse.writeHeader(page.status, {
        'Content-Type': page.type
    });
    reponse.end(page.data);
};

var indexQuery = function(query) {

    var resultat = {
        exists: false,
        id: null
    };

    if (query !== null) {

        query = querystring.parse(query);
        if ('id' in query && 'titre' in query &&
            query.id.length > 0 && query.titre.length > 0) {

            resultat.exists = creerSondage(
                query.titre, query.id,
                query.dateDebut, query.dateFin,
                query.heureDebut, query.heureFin);

        }

        if (resultat.exists) {
            resultat.id = query.id;
        }
    }

    return resultat;
};

var calQuery = function(id, query) {
    if (query !== null) {
        query = querystring.parse(query);
        // query = { nom: ..., disponibilites: ... }
        ajouterParticipant(id, query.nom, query.disponibilites);
        return true;
    }
    return false;
};

var getIndex = function(replacements) {
    return {
        status: 200,
        data: readFile('template/index.html'),
        type: 'text/html'
    };
};

var mois = [
    'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
    'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Dec'
];

var MILLIS_PAR_JOUR = (24 * 60 * 60 * 1000);
var sondage = {}; // enregistrement pour le informations du sondage
var matriceDispo = []; // matrice des valeurs rentré des plages horaires
// du Calendrier
var participants = []; // tableau des données des participants

// retourne un tableau de dates entre dateDebut et dateFin
var getTabDates = function(dateDebut, dateFin) {
    var tabDates = new Array();
    var dateIniciale = new Date(dateDebut); // conversion
    var dateFinale = new Date(dateFin);

    dateIniciale.setDate(dateIniciale.getDate() + 1); // ajustement
    dateFinale.setDate(dateFinale.getDate() + 1);

  // Corrigr date Initiale
    while (dateIniciale <= dateFinale) {
        tabDates.push(new Date(dateIniciale));
        dateIniciale.setDate(dateIniciale.getDate() + 1);
    }
    return tabDates;
};

// retourne un tableau d'heures les deux temps différents fixé en paramêtre
var getTabHeures = function(heureDebut, heureFinale) {
    var tabHeures = new Array();

// Pourquoi un + devant le tabHeures...
    while (+heureDebut <= heureFinale) {
        tabHeures.push(+heureDebut);
        heureDebut++;
    }

    return tabHeures;
};
// convertie une date en un format string voulu pour afficher sur le calendrier
var date2String = function(date) {

    return date.getDate() + " " + mois[+date.getMonth()];
}
// retourne un matrice qui contiens des valeurs de 0
var creerMatrice = function(colonne, rangee) {

    var tableau = new Array(colonne);

    var matrice = tableau.fill().map(function(x) {
        return new Array(rangee).fill(0);
    });

    return matrice;
};

// simplification d'écriture de l'attribute style.
var style = function(prop) {
    return "style='" + prop + "'";
};
// simplification d'écriture de l'attribute id pour identifier les elements
// du calendrier.
var id = function(x, y) {
    return "id='" + x + "-" + y + "'";
};
// simplification d'écriture du balise html avec l'option de deposer son
// contenues.
var balise = function(nom, attrib, contenu) {
    return "<" + nom + " " + attrib + ">" + contenu + "</" + nom + ">";
};

// fonction qui modifie un template de la page du calendrier ('calendar.html') à
// partir des donnée rentré par l'usager dans index.html pour ensuite retourner
// le contenue modifier.
var getCalendar = function(sondageId) {

    // pour la dimension du calendrier
    var tabDates = getTabDates(sondage.dateDebut, sondage.dateFin);
    var tabHeures = getTabHeures(sondage.heureDebut, sondage.heureFin);

    // matrice pour l'affichage du calendrier et des valeur stocker par l'usager
    var matriceCalendrier = creerMatrice(tabHeures.length+1, tabDates.length+1);
    matriceDispo = creerMatrice(tabHeures.length+1, tabDates.length+1);

    // on lit le contenue html pour en faire un tableau séparé par Les
    // "{{"  et "}}" ou veut modifier les element à l'interieure ces symboles
    var template = readFile("template/calendar.html");
    var tabContenue = template.split("{{").join("*").split("}}")
    .join("*").split("*");

    //modification d'élément du tableau du contenue:
    //le titre du sondage
    tabContenue[tabContenue.indexOf("titre")] = sondageId;
    tabContenue[tabContenue.lastIndexOf("titre")] = sondage.titre;
    // pour le URL
    tabContenue[tabContenue.lastIndexOf("url")] = "http://localhost:1337/"
    + sondageId;

    // contenue css pour mettre dans le html table du calendrier
    var grosseur = "width: 100%;";
    var padding = "padding-left: 15px; padding-right: 15px;";
    var greyBg = "background-color: #E0E0E0;";
    var whiteBg = "background-color: #FFFFFF;";
    var height = " height: 25px;"
    // évenement activer quand on clic sur les pages horaires choisit.
    var click = "onmousedown='onClick(event);' onmouseover='onMove(event);' ";
    // id pour le calendrier fait à partir d'un html table
    var idTable = " id='calendrier' ";
    // id pour la colonnes et ligne des cellules du des identifiant des jours
    // et heures du calendrier
    var idDateJour = " id='dateJour' ";
    var fontTd = " color:black; font-weight: bold; font-size:115%; font-family:"
                 +" 'Arial Black', Gadget, sans-serif;";
    var data = "data-nbjours='" + tabDates.length + "' data-nbheures='"
               + tabHeures.length + "'";

   // creation d'une 'table' pour le calendrier q'on fait à partir de la
   // matriceCalendrier qui partage les bonnes dimensions.
    var table = balise("table", idTable + style(grosseur) + " " + click + " " +
        data, matriceCalendrier.map(function(ligne, i) {
            return balise("tr", style(height),
                ligne.map(function(idCellule, j) {
                    if (i == 0 && j == 0) //la première cellule vide
                        return balise("td", style(whiteBg + padding)
                        + idDateJour, " ");
                    // ligne qui identifie la date
                    else if (i == 0 && j > 0)
                        return balise("td", idDateJour +  style(whiteBg +
                           fontTd + padding), date2String(tabDates[j - 1]));
                    // colonne qui identifie l'heure
                    else if (j == 0)
                        return balise("td", idDateJour +
                    style(whiteBg + fontTd + padding), tabHeures[i - 1] + "h");
                    else
                        return balise("td",
                        style(greyBg) + " " + id(i, j), "");
                }).join(""));
        }).join(""));

    tabContenue[tabContenue.lastIndexOf("table")] = table;

    return tabContenue.join("");
};

// procédure qui pour but de stocker les valeur rentré du tableau
// d'enregistrement des participants en utilisant élément dispo créé dans
// calendar.js dans une même dans une variable globale sous forme de
// matrice (matriceDispo)
var placeDispoMatrice = function() {

    participants.forEach(function(x) {
        var index = -1;
        matriceDispo = matriceDispo.map(function(y, i) {
            if (i > 0) {
                return y.map(function(z, j) {
                    if (j > 0) {
                        index++;
                        if (x.dispo.charAt(index) == "1") {
                            return z + 1;
                        } else
                              return z + 0;
                    } else
                          return -1; // si la cellule est celle de la date/heure
                });
            } else {
                  return y.map(function(z, j) {
                      return -1;
                });
            }
        });
    });
};

// fonction qui trouve la valeur minimale stocké dans matriceDispo des cellule
// du calendrier du sondage qui sont les affecté par les usagers.
var trouverMin = function() {
    var valeurMin = Number.MAX_VALUE;
    matriceDispo.forEach(
        function(x, i) {
            if (i > 0) {
                x.map(function(y, j) {
                    if (j > 0 && +y < valeurMin) {
                        valeurMin = y;
                    }
                });
            }
        });
    return valeurMin;
};

// fonction qui trouve la valeur maximale dans la matriceDispo...
var trouverMax = function() {
    var valeurMax = -1;
    matriceDispo.forEach(
        function(x, i) {
            if (i > 0) {
                x.map(function(y, j) {
                    if (j > 0 && +y > valeurMax) {
                        valeurMax = y;
                    }
                });
            }
        });
    return valeurMax;
};

//simplification d'un attribut style et son contenu pour l'utiliser dans
var styleCouleur = function(couleur) {
    return "style=' background-color: " + couleur + "; color: "
           + couleur + ";'";
}

// Retourne le texte HTML à afficher à l'utilisateur pour voir les
// résultats du sondage demandé
// Doit retourner false si le calendrier demandé n'existe pas
var getResults = function(sondageId) {

    var tabDates = getTabDates(sondage.dateDebut, sondage.dateFin);
    var tabHeures = getTabHeures(sondage.heureDebut, sondage.heureFin);
    var matriceCalendrier = creerMatrice(tabHeures.length + 1,
                                         tabDates.length + 1);
    var total = participants.length;
    // place des valeur de disponibilité dans la matriceDispo
    placeDispoMatrice();

    var template = readFile("template/results.html");
    var tabContenue = template.split("{{").join("*").split("}}").
    join("*").split("*");

    tabContenue[tabContenue.indexOf("titre")] = sondageId;
    tabContenue[tabContenue.lastIndexOf("titre")] = sondage.titre;
    tabContenue[tabContenue.lastIndexOf("url")] = "http://localhost:1337/"
    + sondageId;

    // trouve valeur minimal et maximale pour bien modifier les td du table
    var valeurMax = trouverMax();
    var valeurMin = trouverMin();
    // contenue css
    var classMin = "class = 'min'";
    var classMax = "class = 'max'";
    var border = " border: 0;";
    var fontTd = "  font-weight: bold;";

    var index = -1; // index pour se situer dans la matrice et le table

    //creation de la table resultat du sondage
    var tableCalendrier = balise("table", style(),
        matriceCalendrier.map(function(ligne, i) {
            return balise("tr", style(),
                ligne.map(function(idCellule, j) {
                    index++;
                    if (i == 0 && j == 0) {
                        index--; // on affecte pas si on se trouve sur la
                        // premiere cellule, etc.
                        return balise("td", style(border + fontTd), " ");
                    } else if (i == 0 && j > 0) {
                        index--;
                        return balise("td", style(border + fontTd),
                               date2String(tabDates[j - 1]));
                    } else if (j == 0) {
                        index--;
                        return balise("td", style(border + fontTd),
                                     tabHeures[i - 1] + "h");
                    } else if (valeurMin == matriceDispo[i][j]) {
                          return balise("td", style("") + " " + classMin,
                                 participants.map(function(participant, i) {
                              // on compare l'index avec l'element de
                              // l'enregistrement des participants qui
                              // correspont à ses disponiblilté. ("10011001..")
                              if (participant.dispo.charAt(index) == "1")
                                  return balise("span",
                                  styleCouleur(genColor(i, total - 1)), ".");
                                  }).join(""));
                    } else if (valeurMax == matriceDispo[i][j]) {
                          return balise("td", style("") + " " + classMax,
                              participants.map(function(participant, i) {
                              if (participant.dispo.charAt(index) == "1")
                                   return balise("span",
                                       styleCouleur(genColor(i, total)), ".");
                              }).join(""));
                    } else {
                        return balise("td", style("") + " ",
                            participants.map(function(participant, i) {
                            if (participant.dispo.charAt(index) == "1")
                                return balise("span",
                                styleCouleur(genColor(i, total)), ".");
                            }).join(""));
                    }
                }).join(""));
        }).join(""));

    var fontLi = "font-size: 120%; text-align:center-left; line-height: 30px;" +
                 " padding-top: 10px;  font-family: Trebuchet MS, Helvetica, " +
                 "sans-serif;";
    var padding = " padding-left: 30px; ";

    // creation des éléments de la list non ordonné de la legende
    var tableLegende = participants.map(function(ligne, i) {
        return balise("li", style(padding + fontLi +
            colorStyleList(genColor(i, total))), " " + participants[i].nom);
    });

    tabContenue[tabContenue.lastIndexOf("table")] = tableCalendrier;
    tabContenue[tabContenue.lastIndexOf("legende")] = tableLegende;

    return tabContenue.join("");
};

// simplification du contenue css pour un attribut style
var colorStyleList = function(color) {
    return " background-color:" + color + "; color: white; ";
};

// valider
var lettre = function(car) {
    return (car >= "a" && car <= "z") ||
        (car >= "A" && car <= "Z");
};

// fonction qui valide un chiffre
var chiffre = function(car) {
    return (car >= "0" && car <= "9");
};

// valide heure
var valideHeure = function(heureDebut, heureFin) {
    return +heureDebut < +heureFin;
};

// Cette fonction valide les dates choisies
var valideDate = function(dateDebut, dateFin) {
    var dateD = new Date(dateDebut); // conversion
    var dateF = new Date(dateFin);

    var diffTemps = dateF.getTime() - dateD.getTime();
    var diffJours = Math.ceil(diffTemps / MILLIS_PAR_JOUR);

    return ((dateD <= dateF) && (diffJours <= 30)) ? true : false;
};

// valide fonction valide les identifiants respectifs des utilisateurs
var valideId = function(id){

    for (var i = 0; i < id.length; i++) {
        if (!chiffre(id.charAt(i)) && !lettre(id.charAt(i)) &&
        "-" != id.charAt(i))
            return false;
    }
    return true;
};

// Cette fonction valide les données des utilisateurs.
var valideDonnee = function( id, dateDebut, dateFin, heureDebut, heureFin) {

    return (valideHeure(heureDebut, heureFin) && valideDate(dateDebut, dateFin)
           && valideId(id));
};


var creerSondage = function(titre, id, dateDebut, dateFin,
    heureDebut, heureFin) {
    // réinitialisation des tableaux quand on clic sur nouveau sondage
    sondage = [];
    participants = [];
    matriceDispo = [];

    var valide = valideDonnee( id, dateDebut, dateFin, heureDebut, heureFin);

    if (valide) {
        sondage = {
            "titre": titre,
            "id": id,
            "dateDebut": dateDebut,
            "dateFin": dateFin,
            "heureDebut": heureDebut,
            "heureFin": heureFin
        };
        return true;
    } else
        return false;
};

// verifier si participant est déjà présent
var dejaPresent = function(nom) {
    var trouver = false;
    participants.forEach(function(x) {
        if (x.nom == nom) {
            trouver = true;
        }
    });

    return trouver;
}


// Ajoute un participant et ses disponibilités aux résultats d'un
// sondage. Les disponibilités sont envoyées au format textuel
// fourni par la fonction compacterDisponibilites() de public/calendar.js
// Cette fonction ne retourne rien
var ajouterParticipant = function(sondageId, nom, disponibilites) {

    if (!dejaPresent(nom))
        participants.push({
            "idSondage": sondageId,
            "nom": nom,
            "dispo": disponibilites
        });
    else // si il est déjà présent, on modifie seulement ces disponibilité
        participants.map(function(x) {
            if (x.nom == nom)
                x.dispo = disponibilites;
        });
};

//convertir un element avec toString() prend qui seulement 1 parametre pour
// convertir en une base(de 2 à 36).
var getBase16 = function(couleur) {
    var hexa = couleur.toString(16);
    return hexa.length == 1 ? "0" + hexa : "" + hexa;
}
// Cette fonction convertie RGB en valeur hexadécimal de couleur
var rgb2Hex = function(rouge, vert, bleu) {

    if (rouge < 0) rouge = 0;
    if (vert < 0) vert = 0;
    if (bleu < 0) bleu = 0;
    if (rouge > 1) rouge = 1;
    if (vert > 1) vert = 1;
    if (bleu > 1) bleu = 1;

    var rouge = Math.floor(rouge * 255);
    var vert = Math.floor(vert * 255);
    var bleu = Math.floor(bleu * 255);

    return "#" + getBase16(rouge) + getBase16(vert) + getBase16(bleu);
};

// Génère la `i`ème couleur parmi un nombre total `total` au format
// hexadécimal HTML
// Notez que pour un grand nombre de couleurs (ex.: 250), générer
// toutes les couleurs et les afficher devrait donner un joli dégradé qui
// commence en rouge, qui passe par toutes les autres couleurs et qui
// revient à rouge.
var genColor = function(i, nbTotal) {

    var color = "#FFFFFF;";
    var teinte = (i * 360) / nbTotal;
    var h = teinte / 60;
    var c = 0.7;
    var x = c * (1 - Math.abs((h % 2) - 1));

    switch (Math.floor(h)) {
        case 0:
            color = rgb2Hex(c, x, 0);
            break;
        case 1:
            color = rgb2Hex(x, c, 0);
            break;
        case 2:
            color = rgb2Hex(0, c, x);
            break;
        case 3:
            color = rgb2Hex(0, x, c);
            break;
        case 4:
            color = rgb2Hex(x, 0, c);
            break;
        case 5:
            color = rgb2Hex(c, 0, x);
            break;
        default:
            color = rgb2Hex(0, 0, 0);
    }

    return color;
};

/*
 * Création du serveur HTTP
 * Note : pas besoin de toucher au code ici (sauf peut-être si vous
 * faites les bonus)
 */
http.createServer(function(requete, reponse) {
    var url = urlParse(requete.url);

    // Redirect to index.html
    if (url.pathname == '/') {
        redirect(reponse, defaultPage, url.query);
        return;
    }

    var doc;

    if (url.pathname == defaultPage) {
        var res = indexQuery(url.query);

        if (res.exists) {
            redirect(reponse, res.id);
            return;
        } else {
            doc = getIndex(res.data);
        }
    } else {
        var parsedPath = pathParse(url.pathname);

        if (parsedPath.ext.length == 0) {
            var id;

            if (parsedPath.dir == '/') {
                id = parsedPath.base;

                if (calQuery(id, url.query)) {
                    redirect(reponse, '/' + id + '/results')
                    return;
                }

                var data = getCalendar(id);

                if (data === false) {
                    redirect(reponse, '/error404.html');
                    return;
                }

                doc = {
                    status: 200,
                    data: data,
                    type: 'text/html'
                };
            } else {
                if (parsedPath.base == 'results') {
                    id = parsedPath.dir.slice(1);
                    var data = getResults(id);

                    if (data === false) {
                        redirect(reponse, '/error404.html');
                        return;
                    }

                    doc = {
                        status: 200,
                        data: data,
                        type: 'text/html'
                    };
                } else {
                    redirect(reponse, '/error404.html');
                    return;
                }
            }
        } else {
            doc = getDocument(url);
        }
    }

    sendPage(reponse, doc);

}).listen(port);
